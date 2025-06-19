
"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PlusCircle, Trash2, MapPin, DollarSign as DollarSignLucide, Layers, HomeIcon, Loader2 } from 'lucide-react';
import type { PenaltyTier as PenaltyTierTypePrisma, Prisma } from '@prisma/client';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Link from 'next/link'; // Keep Link if used inside the form, e.g., for cancel. Otherwise, it's part of PageHeader.
import { createBuildingAction, updateBuildingAction } from '../actions';

// Represents a rule in the UI before it's converted to PenaltyTier
interface UIPenaltyRule {
  id: string; // Can be DB id for existing, or temp UI id for new
  dbId?: string; // Store original DB ID for existing tiers to help with updates if needed, though current logic deletes all and recreates
  durationDays?: number;
  feeType: 'Fixed' | 'Percentage';
  feeValue?: number;
  scope: 'Building' | 'Floor' | 'SpecificSpaces';
  applicableFloor?: string;
  applicableSpaceIdNamesStr?: string; // Comma-separated string of space ID names
}

interface BuildingFormState {
  id?: string; // For edit mode
  name: string;
  address: string;
  uiPenaltyRules: UIPenaltyRule[];
}

// Interface for props passed from Server Component
export interface BuildingUpsertFormInternalProps {
  initialBuildingData?: {
    id: string;
    name: string;
    address: string | null; // Prisma type allows null
    penaltyPolicyTiers: PenaltyTierTypePrisma[];
    createdAt: string; // Serialized date
  } | null;
  formMode: 'add' | 'edit';
}

export function BuildingUpsertFormInternal({ initialBuildingData, formMode }: BuildingUpsertFormInternalProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [currentBuildingForm, setCurrentBuildingForm] = useState<BuildingFormState>({ name: '', address: '', uiPenaltyRules: [] });
  const [isSaving, setIsSaving] = useState(false);
  
  useEffect(() => {
    if (initialBuildingData) {
      const uiRules: UIPenaltyRule[] = (initialBuildingData.penaltyPolicyTiers || []).map(tier => {
        // Calculate durationDays from fromDay and toDay
        let duration: number | undefined;
        if (tier.toDay !== null && tier.toDay !== undefined && tier.fromDay !== null && tier.fromDay !== undefined) {
            // toDay is inclusive, so add 1
            duration = tier.toDay - tier.fromDay + 1; 
        }
        // If toDay is null, durationDays remains undefined (indefinite)
        
        return {
          id: tier.id, // Use actual DB ID for key and tracking
          dbId: tier.id,
          durationDays: duration,
          feeType: tier.feeType as 'Fixed' | 'Percentage',
          feeValue: tier.feeValue,
          scope: tier.scope as 'Building' | 'Floor' | 'SpecificSpaces',
          applicableFloor: tier.applicableFloor || undefined,
          applicableSpaceIdNamesStr: tier.applicableSpaceIdNames?.join(', ') || undefined,
        };
      });
      // Sort UI rules for consistent display, e.g., by scope then by days
       uiRules.sort((a, b) => {
        if (a.scope !== b.scope) return a.scope.localeCompare(b.scope);
        // For rules within the same scope, further sort by what makes sense, e.g. fromDay
        // This requires fromDay to be part of UIPenaltyRule or accessible via initialBuildingData mapping
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
    const newRule: UIPenaltyRule = {
      id: `uiRule-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`, // Temporary UI ID
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
    setCurrentBuildingForm(prev => ({
      ...prev,
      uiPenaltyRules: (prev.uiPenaltyRules || []).filter(rule => rule.id !== ruleId)
    }));
  };

  const handleUIPenaltyRuleChange = (ruleId: string, field: keyof UIPenaltyRule, value: any) => {
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
              // This rule implies it's the last one for this scope (indefinite)
              if (i < rulesInScope.length -1) { // If it's not the last rule in the sorted group
                toast({title: "Validation Error", description: `Only the last rule in a scope group can have an indefinite duration (blank or zero duration days). Please adjust rule for scope: ${scopeKey.split('_')[0]}.`, variant: "destructive"});
                throw new Error("Invalid indefinite duration placement.");
              }
              toDay = null; // Indefinite
            } else {
              toDay = fromDay + uiRule.durationDays - 1;
            }

            finalPenaltyTiersCreateInput.push({
              fromDay: fromDay,
              toDay: toDay,
              feeType: uiRule.feeType,
              feeValue: Number(uiRule.feeValue!), // Already validated to be a number
              scope: uiRule.scope,
              applicableFloor: uiRule.scope === 'Floor' ? uiRule.applicableFloor?.trim() : undefined,
              applicableSpaceIdNames: uiRule.scope === 'SpecificSpaces' ? uiRule.applicableSpaceIdNamesStr?.split(',').map(s => s.trim()).filter(s => s) : [],
            });

            if (toDay !== null) {
              cumulativeStartDay = toDay + 1;
            } else {
              // This was the last (indefinite) rule for this scope, break from this inner loop
              break; 
            }
        }
      }
    } catch (error: any) {
        console.error("Validation error during penalty tier processing:", error.message);
        // Toast is already shown for specific validation errors
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
          deleteMany: {}, // Delete existing tiers
          create: finalPenaltyTiersCreateInput, // Create new (updated) tiers
        },
      };
      result = await updateBuildingAction(currentBuildingForm.id!, buildingUpdateInput);
    }

    setIsSaving(false);
    if (result.success) {
      toast({ title: `Building ${formMode === 'add' ? 'Added' : 'Updated'}`, description: `${result.building?.name} has been saved.` });
      router.push('/admin/buildings'); // Navigate back to the list page
      router.refresh(); // Force refresh of the buildings list page
    } else {
      toast({ title: `Error ${formMode === 'add' ? 'Adding' : 'Updating'} Building`, description: result.error, variant: "destructive" });
    }
  };

  return (
      <Card className="shadow-lg">
        <form onSubmit={handleFormSubmit}>
          <CardContent className="p-6 space-y-6">
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
                  disabled={isSaving}
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
                  disabled={isSaving}
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold text-foreground">Late Fee Penalty Rules</h3>
                  <Button type="button" variant="outline" size="sm" onClick={handleAddUIPenaltyRule} disabled={isSaving}>
                      <PlusCircle className="mr-1.5 h-4 w-4"/> Add Rule
                  </Button>
              </div>
              <CardDescription>
                Define sequential penalty rules for each scope (Building, specific Floor, or specific Spaces). The last rule defined for a given scope will apply indefinitely if no duration (blank or zero days) is set.
              </CardDescription>
              {currentBuildingForm.uiPenaltyRules.length === 0 && <p className="text-sm text-muted-foreground text-center py-3">No penalty rules defined. Click "Add Rule" to begin.</p>}

              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                {currentBuildingForm.uiPenaltyRules.map((uiRule, ruleIndex) => (
                  <Card key={uiRule.id} className="p-4 bg-secondary/30 shadow-sm">
                    <CardHeader className="p-0 pb-3">
                      <div className="flex justify-between items-center">
                        <CardTitle className="text-md font-medium">Rule {ruleIndex + 1}</CardTitle>
                        <Button type="button" variant="ghost" size="icon"
                                onClick={() => handleRemoveUIPenaltyRule(uiRule.id)}
                                className="h-7 w-7 text-destructive hover:bg-destructive/10"
                                disabled={isSaving}>
                            <Trash2 className="h-4 w-4"/>
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                              <Label htmlFor={`ruleDuration-${uiRule.id}`} className="text-xs">Duration (Days)</Label>
                              <Input id={`ruleDuration-${uiRule.id}`} type="number" min="1" placeholder="e.g., 5"
                                      value={uiRule.durationDays ?? ''} // Use ?? '' for undefined to show empty input
                                      onChange={(e) => handleUIPenaltyRuleChange(uiRule.id, 'durationDays', e.target.value)}
                                      className="mt-1 text-sm h-9" disabled={isSaving}/>
                              <p className="text-xs text-muted-foreground mt-0.5">For last rule in scope, leave blank/0 for indefinite.</p>
                          </div>
                          <div>
                              <Label htmlFor={`ruleFeeType-${uiRule.id}`} className="text-xs">Fee Type</Label>
                              <Select value={uiRule.feeType} onValueChange={(value) => handleUIPenaltyRuleChange(uiRule.id, 'feeType', value as UIPenaltyRule['feeType'])} disabled={isSaving}>
                                  <SelectTrigger id={`ruleFeeType-${uiRule.id}`} className="mt-1 text-sm h-9"><SelectValue /></SelectTrigger>
                                  <SelectContent><SelectItem value="Fixed">Fixed</SelectItem><SelectItem value="Percentage">Percentage</SelectItem></SelectContent>
                              </Select>
                          </div>
                          <div>
                              <Label htmlFor={`ruleFeeValue-${uiRule.id}`} className="text-xs">Fee Value</Label>
                              <Input id={`ruleFeeValue-${uiRule.id}`} type="number" step="0.01" min="0" placeholder="e.g., 50 or 2.5"
                                      value={uiRule.feeValue ?? ''} // Use ?? '' for undefined
                                      onChange={(e) => handleUIPenaltyRuleChange(uiRule.id, 'feeValue', e.target.value)}
                                      className="mt-1 text-sm h-9" disabled={isSaving}/>
                          </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                              <Label htmlFor={`scopeType-${uiRule.id}`} className="text-xs flex items-center"><Layers className="mr-1 h-3 w-3"/>Scope</Label>
                              <Select value={uiRule.scope} onValueChange={(value) => handleUIPenaltyRuleChange(uiRule.id, 'scope', value as UIPenaltyRule['scope'])} disabled={isSaving}>
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
                                          onChange={(e) => handleUIPenaltyRuleChange(uiRule.id, 'applicableFloor', e.target.value)} className="mt-1 h-9" disabled={isSaving}/>
                              </div>
                          )}
                      </div>
                      {uiRule.scope === 'SpecificSpaces' && (
                          <div>
                              <Label htmlFor={`applicableSpaces-${uiRule.id}`} className="text-xs flex items-center"><HomeIcon className="mr-1 h-3 w-3"/>Space ID Names (comma-separated)</Label>
                              <Input id={`applicableSpaces-${uiRule.id}`} placeholder="e.g., Unit 10A, Office 202B" value={uiRule.applicableSpaceIdNamesStr || ''}
                                      onChange={(e) => handleUIPenaltyRuleChange(uiRule.id, 'applicableSpaceIdNamesStr', e.target.value)} className="mt-1 h-9" disabled={isSaving}/>
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
            {/* Cancel button removed as PageHeader has "Back to Buildings" */}
            <Button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isSaving}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
              {isSaving ? 'Saving...' : (formMode === 'add' ? 'Add Building' : 'Save Changes')}
            </Button>
          </CardFooter>
        </form>
      </Card>
  );
}
