
"use client";

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation'; 
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PlusCircle, Trash2, MapPin, DollarSign as DollarSignLucide, Layers, HomeIcon, Loader2, EyeOff } from 'lucide-react';
import type { PenaltyTier as PenaltyTierTypePrisma, Prisma } from '@prisma/client';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Link from 'next/link'; 
import { createBuildingAction, updateBuildingAction } from '../actions';
import { usePermissions } from '@/contexts/PermissionContext'; 

interface UIPenaltyRule {
  id: string; 
  dbId?: string; 
  durationDays?: number;
  feeType: 'Fixed' | 'Percentage';
  feeValue?: number;
  scope: 'Building' | 'Floor' | 'SpecificSpaces';
  applicableFloor?: string;
  applicableSpaceIdNamesStr?: string; 
}

interface BuildingFormState {
  id?: string; 
  name: string;
  address: string;
  uiPenaltyRules: UIPenaltyRule[];
}

export interface BuildingUpsertFormInternalProps {
  initialBuildingData?: {
    id: string;
    name: string;
    address: string | null; 
    penaltyPolicyTiers: PenaltyTierTypePrisma[];
    createdAt: string; 
  } | null;
  formMode: 'add' | 'edit';
}

export function BuildingUpsertFormInternal({ initialBuildingData, formMode }: BuildingUpsertFormInternalProps) {
  const router = useRouter();
  const searchParams = useSearchParams(); 
  const { toast } = useToast();
  const { hasPermission, isSuperAdmin } = usePermissions(); 

  const isViewOnlyMode = searchParams.get('view') === 'true';
  
  // Determine manage permission based on formMode and user's capabilities
  let canManageThisForm: boolean;
  if (formMode === 'add') {
    canManageThisForm = isSuperAdmin || hasPermission('building:create');
  } else { // edit mode
    canManageThisForm = isSuperAdmin || hasPermission('building:edit');
  }
  // If it's view-only mode, then cannot manage, regardless of other perms
  if (isViewOnlyMode) {
    canManageThisForm = false;
  }


  const [currentBuildingForm, setCurrentBuildingForm] = useState<BuildingFormState>({ name: '', address: '', uiPenaltyRules: [] });
  const [isSaving, setIsSaving] = useState(false);
  
  useEffect(() => {
    if (initialBuildingData) {
      const uiRules: UIPenaltyRule[] = (initialBuildingData.penaltyPolicyTiers || []).map(tier => {
        let duration: number | undefined;
        if (tier.toDay !== null && tier.toDay !== undefined && tier.fromDay !== null && tier.fromDay !== undefined) {
            duration = tier.toDay - tier.fromDay + 1; 
        }
        
        return {
          id: tier.id, 
          dbId: tier.id,
          durationDays: duration,
          feeType: tier.feeType as 'Fixed' | 'Percentage',
          feeValue: tier.feeValue,
          scope: tier.scope as 'Building' | 'Floor' | 'SpecificSpaces',
          applicableFloor: tier.applicableFloor || undefined,
          applicableSpaceIdNamesStr: tier.applicableSpaceIdNames?.join(', ') || undefined,
        };
      });
       uiRules.sort((a, b) => {
        if (a.scope !== b.scope) return a.scope.localeCompare(b.scope);
        const aTier = initialBuildingData.penaltyPolicyTiers.find(t => t.id === a.id);
        const bTier = initialBuildingData.penaltyPolicyTiers.find(t => t.id === b.id);
        if (aTier && bTier) {
            return aTier.fromDay - bTier.fromDay;
        }
        return 0;
      });

      setCurrentBuildingForm({
        id: initialBuildingData.id,
        name: initialBuildingData.name,
        address: initialBuildingData.address || '',
        uiPenaltyRules: uiRules,
      });
    } else {
      setCurrentBuildingForm({ name: '', address: '', uiPenaltyRules: [] });
    }
  }, [initialBuildingData]);


  const handleAddUIPenaltyRule = () => {
    if (!canManageThisForm) return;
    const newRule: UIPenaltyRule = {
      id: `uiRule-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      scope: 'Building',
      feeType: 'Fixed',
      feeValue: undefined,
      durationDays: undefined,
    };
    setCurrentBuildingForm(prev => ({
      ...prev,
      uiPenaltyRules: [...(prev.uiPenaltyRules || []), newRule],
    }));
  };

  const handleRemoveUIPenaltyRule = (ruleId: string) => {
    if (!canManageThisForm) return;
    setCurrentBuildingForm(prev => ({
      ...prev,
      uiPenaltyRules: (prev.uiPenaltyRules || []).filter(rule => rule.id !== ruleId)
    }));
  };

  const handleUIPenaltyRuleChange = (ruleId: string, field: keyof UIPenaltyRule, value: any) => {
    if (!canManageThisForm) return;
    setCurrentBuildingForm(prev => ({
      ...prev,
      uiPenaltyRules: (prev.uiPenaltyRules || []).map(rule => {
        if (rule.id !== ruleId) return rule;
        let updatedRule = { ...rule, [field]: value };

        if (field === 'durationDays' || field === 'feeValue') {
           updatedRule[field] = (value === '' || value === null || value === undefined || isNaN(Number(value))) ? undefined : Number(value);
        }

        if (field === 'scope') {
          updatedRule.scope = value as UIPenaltyRule['scope'];
          if (value !== 'Floor') updatedRule.applicableFloor = undefined;
          if (value !== 'SpecificSpaces') updatedRule.applicableSpaceIdNamesStr = undefined;
        }
        return updatedRule;
      })
    }));
  };

  const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canManageThisForm) {
      toast({ title: "Permission Denied", description: "You do not have permission to save building details.", variant: "destructive" });
      return;
    }
    setIsSaving(true);

    if (!currentBuildingForm.name?.trim()) {
      toast({ title: "Validation Error", description: "Building name is required.", variant: "destructive" });
      setIsSaving(false);
      return;
    }

    const finalPenaltyTiersCreateInput: Prisma.PenaltyTierCreateWithoutBuildingInput[] = [];
    const groupedUIRules: Record<string, UIPenaltyRule[]> = {};

    try {
      currentBuildingForm.uiPenaltyRules.forEach(uiRule => {
        if (!uiRule.feeType || uiRule.feeValue === undefined || uiRule.feeValue < 0) {
            toast({ title: "Validation Error", description: `Rule for scope '${uiRule.scope}' is incomplete. Fee Type and non-negative Fee Value are required.`, variant: "destructive" });
            throw new Error("Incomplete UI rule.");
        }

        let scopeKey = uiRule.scope;
        if (uiRule.scope === 'Floor') {
            if (!uiRule.applicableFloor?.trim()) {
            toast({ title: "Validation Error", description: `Floor name is required for floor-scoped rule.`, variant: "destructive" });
            throw new Error("Missing floor name.");
            }
            scopeKey += `_Floor_${uiRule.applicableFloor.trim()}`;
        } else if (uiRule.scope === 'SpecificSpaces') {
            if (!uiRule.applicableSpaceIdNamesStr?.trim()) {
            toast({ title: "Validation Error", description: `Space ID(s) are required for space-scoped rule.`, variant: "destructive" });
            throw new Error("Missing space IDs.");
            }
            const sortedSpaceIds = uiRule.applicableSpaceIdNamesStr.split(',').map(s => s.trim()).filter(s => s).sort().join(',');
            scopeKey += `_Spaces_${sortedSpaceIds}`;
        }

        if (!groupedUIRules[scopeKey]) groupedUIRules[scopeKey] = [];
        groupedUIRules[scopeKey].push(uiRule);
      });

      for (const scopeKey in groupedUIRules) {
        const rulesInScope = groupedUIRules[scopeKey].sort((a,b) => (a.durationDays ?? Infinity) - (b.durationDays ?? Infinity));
        let cumulativeStartDay = 1;

        for (let i = 0; i < rulesInScope.length; i++) {
            const uiRule = rulesInScope[i];
            const fromDay = cumulativeStartDay;
            let toDay: number | null = null;

            if (uiRule.durationDays === undefined || uiRule.durationDays === null || uiRule.durationDays <= 0) {
              if (i < rulesInScope.length -1) { 
                toast({title: "Validation Error", description: `Only the last rule in a scope group can have an indefinite duration (blank or zero duration days). Please adjust rule for scope: ${scopeKey.split('_')[0]}.`, variant: "destructive"});
                throw new Error("Invalid indefinite duration placement.");
              }
              toDay = null; 
            } else {
              toDay = fromDay + uiRule.durationDays - 1;
            }

            finalPenaltyTiersCreateInput.push({
              fromDay: fromDay,
              toDay: toDay,
              feeType: uiRule.feeType,
              feeValue: Number(uiRule.feeValue!), 
              scope: uiRule.scope,
              applicableFloor: uiRule.scope === 'Floor' ? uiRule.applicableFloor?.trim() : undefined,
              applicableSpaceIdNames: uiRule.scope === 'SpecificSpaces' ? uiRule.applicableSpaceIdNamesStr?.split(',').map(s => s.trim()).filter(s => s) : [],
            });

            if (toDay !== null) {
              cumulativeStartDay = toDay + 1;
            } else {
              break; 
            }
        }
      }
    } catch (error: any) {
        console.error("Validation error during penalty tier processing:", error.message);
        setIsSaving(false);
        return;
    }

    let result;
    if (formMode === 'add') {
      const buildingCreateInput: Prisma.BuildingCreateInput = {
        name: currentBuildingForm.name!.trim(),
        address: currentBuildingForm.address?.trim() || undefined,
        penaltyPolicyTiers: {
          create: finalPenaltyTiersCreateInput,
        },
      };
      result = await createBuildingAction(buildingCreateInput);
    } else {
      const buildingUpdateInput: Prisma.BuildingUpdateInput = {
        name: currentBuildingForm.name!.trim(),
        address: currentBuildingForm.address?.trim() || undefined,
        penaltyPolicyTiers: {
          deleteMany: {}, 
          create: finalPenaltyTiersCreateInput, 
        },
      };
      result = await updateBuildingAction(currentBuildingForm.id!, buildingUpdateInput);
    }

    setIsSaving(false);
    if (result.success) {
      toast({ title: `Building ${formMode === 'add' ? 'Added' : 'Updated'}`, description: `${result.building?.name} has been saved.` });
      router.push('/admin/buildings'); 
      router.refresh(); 
    } else {
      toast({ title: `Error ${formMode === 'add' ? 'Adding' : 'Updating'} Building`, description: result.error, variant: "destructive" });
    }
  };
  
  // Check overall view permission for the page
  const canViewPage = isSuperAdmin || hasPermission('building:view') || hasPermission('building:create') || hasPermission('building:edit');

  if (!canViewPage) {
    return (
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-destructive flex items-center"><EyeOff className="mr-2"/>Access Denied</CardTitle>
        </CardHeader>
        <CardContent>
          <p>You do not have permission to view or manage building details.</p>
        </CardContent>
         <CardFooter>
            <Button onClick={() => router.back()} variant="outline">Go Back</Button>
        </CardFooter>
      </Card>
    );
  }


  return (
      <Card className="shadow-lg">
        <form onSubmit={handleFormSubmit}>
          <CardContent className="p-6 space-y-6">
             {isViewOnlyMode && (
              <div className="p-3 bg-yellow-50 border border-yellow-300 text-yellow-700 text-sm rounded-md flex items-center">
                <EyeOff className="h-5 w-5 mr-2 shrink-0" />
                You are in view-only mode. Editing is disabled.
              </div>
            )}
            <div className="space-y-4 border-b pb-6">
              <div>
                <Label htmlFor="buildingNameMain" className="flex items-center text-sm font-medium">
                  Name
                </Label>
                <Input
                  id="buildingNameMain"
                  value={currentBuildingForm.name || ''}
                  onChange={(e) => setCurrentBuildingForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Sunrise Tower"
                  required
                  className="mt-1"
                  disabled={isSaving || !canManageThisForm}
                />
              </div>
              <div>
                <Label htmlFor="buildingAddressMain" className="flex items-center text-sm font-medium">
                  Address (Optional)
                </Label>
                <Textarea
                  id="buildingAddressMain"
                  value={currentBuildingForm.address || ''}
                  onChange={(e) => setCurrentBuildingForm(prev => ({ ...prev, address: e.target.value }))}
                  placeholder="e.g., 123 Main St, Anytown, USA"
                  rows={2}
                  className="mt-1"
                  disabled={isSaving || !canManageThisForm}
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold text-foreground">Late Fee Penalty Rules</h3>
                  {canManageThisForm && (
                    <Button type="button" variant="outline" size="sm" onClick={handleAddUIPenaltyRule} disabled={isSaving}>
                        <PlusCircle className="mr-1.5 h-4 w-4"/> Add Rule
                    </Button>
                  )}
              </div>
              <CardDescription>
                Define sequential penalty rules for each scope (Building, specific Floor, or specific Spaces). The last rule defined for a given scope will apply indefinitely if no duration (blank or zero days) is set.
              </CardDescription>
              {currentBuildingForm.uiPenaltyRules.length === 0 && <p className="text-sm text-muted-foreground text-center py-3">No penalty rules defined. {canManageThisForm ? 'Click "Add Rule" to begin.' : ''}</p>}

              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                {currentBuildingForm.uiPenaltyRules.map((uiRule, ruleIndex) => (
                  <Card key={uiRule.id} className="p-4 bg-secondary/30 shadow-sm">
                    <CardHeader className="p-0 pb-3">
                      <div className="flex justify-between items-center">
                        <CardTitle className="text-md font-medium">Rule {ruleIndex + 1}</CardTitle>
                        {canManageThisForm && (
                          <Button type="button" variant="ghost" size="icon"
                                  onClick={() => handleRemoveUIPenaltyRule(uiRule.id)}
                                  className="h-7 w-7 text-destructive hover:bg-destructive/10"
                                  disabled={isSaving}>
                              <Trash2 className="h-4 w-4"/>
                          </Button>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="p-0 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                              <Label htmlFor={`ruleDuration-${uiRule.id}`} className="text-xs">Duration (Days)</Label>
                              <Input id={`ruleDuration-${uiRule.id}`} type="number" min="1" placeholder="e.g., 5"
                                      value={uiRule.durationDays ?? ''} 
                                      onChange={(e) => handleUIPenaltyRuleChange(uiRule.id, 'durationDays', e.target.value)}
                                      className="mt-1 text-sm h-9" disabled={isSaving || !canManageThisForm}/>
                              <p className="text-xs text-muted-foreground mt-0.5">For last rule in scope, leave blank/0 for indefinite.</p>
                          </div>
                          <div>
                              <Label htmlFor={`ruleFeeType-${uiRule.id}`} className="text-xs">Fee Type</Label>
                              <Select value={uiRule.feeType} onValueChange={(value) => handleUIPenaltyRuleChange(uiRule.id, 'feeType', value as UIPenaltyRule['feeType'])} disabled={isSaving || !canManageThisForm}>
                                  <SelectTrigger id={`ruleFeeType-${uiRule.id}`} className="mt-1 text-sm h-9"><SelectValue /></SelectTrigger>
                                  <SelectContent><SelectItem value="Fixed">Fixed</SelectItem><SelectItem value="Percentage">Percentage</SelectItem></SelectContent>
                              </Select>
                          </div>
                          <div>
                              <Label htmlFor={`ruleFeeValue-${uiRule.id}`} className="text-xs">Fee Value</Label>
                              <Input id={`ruleFeeValue-${uiRule.id}`} type="number" step="0.01" min="0" placeholder="e.g., 50 or 2.5"
                                      value={uiRule.feeValue ?? ''} 
                                      onChange={(e) => handleUIPenaltyRuleChange(uiRule.id, 'feeValue', e.target.value)}
                                      className="mt-1 text-sm h-9" disabled={isSaving || !canManageThisForm}/>
                          </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                              <Label htmlFor={`scopeType-${uiRule.id}`} className="text-xs flex items-center"><Layers className="mr-1 h-3 w-3"/>Scope</Label>
                              <Select value={uiRule.scope} onValueChange={(value) => handleUIPenaltyRuleChange(uiRule.id, 'scope', value as UIPenaltyRule['scope'])} disabled={isSaving || !canManageThisForm}>
                                  <SelectTrigger id={`scopeType-${uiRule.id}`} className="mt-1 h-9"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                      <SelectItem value="Building">Entire Building</SelectItem>
                                      <SelectItem value="Floor">Specific Floor</SelectItem>
                                      <SelectItem value="SpecificSpaces">Specific Space(s)</SelectItem>
                                  </SelectContent>
                              </Select>
                          </div>
                          {uiRule.scope === 'Floor' && (
                              <div>
                                  <Label htmlFor={`applicableFloor-${uiRule.id}`} className="text-xs">Floor Name</Label>
                                  <Input id={`applicableFloor-${uiRule.id}`} placeholder="e.g., 5th Floor" value={uiRule.applicableFloor || ''}
                                          onChange={(e) => handleUIPenaltyRuleChange(uiRule.id, 'applicableFloor', e.target.value)} className="mt-1 h-9" disabled={isSaving || !canManageThisForm}/>
                              </div>
                          )}
                      </div>
                      {uiRule.scope === 'SpecificSpaces' && (
                          <div>
                              <Label htmlFor={`applicableSpaces-${uiRule.id}`} className="text-xs flex items-center"><HomeIcon className="mr-1 h-3 w-3"/>Space ID Names (comma-separated)</Label>
                              <Input id={`applicableSpaces-${uiRule.id}`} placeholder="e.g., Unit 10A, Office 202B" value={uiRule.applicableSpaceIdNamesStr || ''}
                                      onChange={(e) => handleUIPenaltyRuleChange(uiRule.id, 'applicableSpaceIdNamesStr', e.target.value)} className="mt-1 h-9" disabled={isSaving || !canManageThisForm}/>
                              <p className="text-xs text-muted-foreground mt-0.5">Enter exact 'Space ID/Name' from Spaces page.</p>
                          </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </CardContent>
          <CardFooter className="border-t p-6 flex justify-end gap-2">
            {canManageThisForm && (
              <Button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isSaving}>
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                {isSaving ? 'Saving...' : (formMode === 'add' ? 'Add Building' : 'Save Changes')}
              </Button>
            )}
            {isViewOnlyMode && !canManageThisForm && (
                 <p className="text-sm text-muted-foreground">Viewing details. No edit permission.</p>
            )}
          </CardFooter>
        </form>
      </Card>
  );
}
