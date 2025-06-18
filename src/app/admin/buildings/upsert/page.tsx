
"use client";

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PageHeader } from '@/components/custom/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Building as BuildingIconLucide, PlusCircle, Trash2, MapPin, DollarSign as DollarSignLucide, Layers, HomeIcon, ArrowLeft } from 'lucide-react';
import type { Building, PenaltyTier } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Link from 'next/link';

// Represents a rule in the UI before it's converted to PenaltyTier
interface UIPenaltyRule {
  id: string; 
  durationDays?: number; 
  feeType: 'Fixed' | 'Percentage';
  feeValue?: number;
  scope: 'Building' | 'Floor' | 'SpecificSpaces';
  applicableFloor?: string;
  applicableSpaceIdNamesStr?: string; // Comma-separated string of space ID names
}

interface BuildingFormState {
  id?: string;
  name?: string;
  address?: string;
  createdAt?: string;
  uiPenaltyRules: UIPenaltyRule[];
}

const getStoredBuildings = (): Building[] => {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('buildings');
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as Building[];
        return parsed.map(b => ({
          ...b,
          penaltyPolicyTiers: (b.penaltyPolicyTiers || []).map(tier => ({
            ...tier,
            scope: tier.scope || 'Building', 
          })),
        }));
      } catch (e) {
        console.error("Error parsing buildings from localStorage", e);
        return [];
      }
    }
  }
  return [];
};

const storeBuildings = (buildings: Building[]) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('buildings', JSON.stringify(buildings));
  }
};

function BuildingUpsertForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [currentBuildingForm, setCurrentBuildingForm] = useState<BuildingFormState>({ name: '', address: '', uiPenaltyRules: [] });
  const [formMode, setFormMode] = useState<'add' | 'edit'>('add');
  const [isLoading, setIsLoading] = useState(true);
  const [pageTitle, setPageTitle] = useState("Add New Building");

  useEffect(() => {
    const buildingId = searchParams.get('id');
    if (buildingId) {
      setFormMode('edit');
      setPageTitle("Edit Building");
      const buildings = getStoredBuildings();
      const buildingToEdit = buildings.find(b => b.id === buildingId);
      if (buildingToEdit) {
        const loadedUIPenaltyRules: UIPenaltyRule[] = [];
        const tiersByScopeKey: Record<string, PenaltyTier[]> = {};
        (buildingToEdit.penaltyPolicyTiers || []).forEach(tier => {
          let scopeKey = tier.scope;
          if (tier.scope === 'Floor' && tier.applicableFloor) scopeKey += `_Floor_${tier.applicableFloor}`;
          else if (tier.scope === 'SpecificSpaces' && tier.applicableSpaceIdNames?.length) scopeKey += `_Spaces_${tier.applicableSpaceIdNames.sort().join(',')}`;
          
          if (!tiersByScopeKey[scopeKey]) tiersByScopeKey[scopeKey] = [];
          tiersByScopeKey[scopeKey].push(tier);
        });

        Object.values(tiersByScopeKey).forEach(scopeGroup => {
          scopeGroup.sort((a,b) => a.fromDay - b.fromDay).forEach((tier, index) => {
            let duration: number | undefined;
            if (tier.toDay !== null && tier.toDay !== undefined) {
              duration = tier.toDay - tier.fromDay + 1;
            } 
            
            loadedUIPenaltyRules.push({
              id: `uiRule-edit-${index}-${tier.fromDay}-${Math.random().toString(36).substring(2, 9)}`,
              durationDays: duration,
              feeType: tier.feeType,
              feeValue: tier.feeValue,
              scope: tier.scope,
              applicableFloor: tier.applicableFloor,
              applicableSpaceIdNamesStr: tier.applicableSpaceIdNames?.join(', '),
            });
          });
        });
        
        setCurrentBuildingForm({ 
          id: buildingToEdit.id,
          name: buildingToEdit.name,
          address: buildingToEdit.address,
          createdAt: buildingToEdit.createdAt,
          uiPenaltyRules: loadedUIPenaltyRules,
        });
      } else {
        toast({ title: "Error", description: "Building not found.", variant: "destructive" });
        router.push('/admin/buildings');
      }
    } else {
      setFormMode('add');
      setPageTitle("Add New Building");
      setCurrentBuildingForm({ name: '', address: '', uiPenaltyRules: [] });
    }
    setIsLoading(false);
  }, [searchParams, router, toast]);

  const handleAddUIPenaltyRule = () => {
    const newRule: UIPenaltyRule = { 
      id: `uiRule-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`, 
      scope: 'Building', 
      feeType: 'Fixed',
      feeValue: 0,
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
  
  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!currentBuildingForm.name?.trim()) {
      toast({ title: "Error", description: "Building name is required.", variant: "destructive" });
      return;
    }

    const finalPenaltyTiers: PenaltyTier[] = [];
    const groupedUIRules: Record<string, UIPenaltyRule[]> = {}; 

    try {
        currentBuildingForm.uiPenaltyRules.forEach(uiRule => {
        if (!uiRule.feeType || uiRule.feeValue === undefined || uiRule.feeValue < 0) {
            toast({ title: "Error", description: `Rule for scope '${uiRule.scope}' is incomplete. Fee Type and non-negative Fee Value are required.`, variant: "destructive" });
            throw new Error("Incomplete UI rule."); 
        }

        let scopeKey = uiRule.scope;
        if (uiRule.scope === 'Floor') {
            if (!uiRule.applicableFloor?.trim()) {
            toast({ title: "Error", description: `Floor name is required for floor-scoped rule.`, variant: "destructive" });
            throw new Error("Missing floor name.");
            }
            scopeKey += `_Floor_${uiRule.applicableFloor.trim()}`;
        } else if (uiRule.scope === 'SpecificSpaces') {
            if (!uiRule.applicableSpaceIdNamesStr?.trim()) {
            toast({ title: "Error", description: `Space ID(s) are required for space-scoped rule.`, variant: "destructive" });
            throw new Error("Missing space IDs.");
            }
            const sortedSpaceIds = uiRule.applicableSpaceIdNamesStr.split(',').map(s => s.trim()).filter(s => s).sort().join(',');
            scopeKey += `_Spaces_${sortedSpaceIds}`;
        }
        
        if (!groupedUIRules[scopeKey]) groupedUIRules[scopeKey] = [];
        groupedUIRules[scopeKey].push(uiRule);
        });
        
        for (const scopeKey in groupedUIRules) {
        const rulesInScope = groupedUIRules[scopeKey]; 
        let cumulativeStartDay = 1;

        for (let i = 0; i < rulesInScope.length; i++) {
            const uiRule = rulesInScope[i];
            const fromDay = cumulativeStartDay;
            let toDay: number | null = null;

            if (i === rulesInScope.length - 1 || uiRule.durationDays === undefined || uiRule.durationDays === null || uiRule.durationDays <= 0) {
            toDay = null; 
            } else {
            toDay = fromDay + uiRule.durationDays - 1;
            }

            finalPenaltyTiers.push({
            fromDay: fromDay,
            toDay: toDay,
            feeType: uiRule.feeType,
            feeValue: Number(uiRule.feeValue!), 
            scope: uiRule.scope,
            applicableFloor: uiRule.scope === 'Floor' ? uiRule.applicableFloor?.trim() : undefined,
            applicableSpaceIdNames: uiRule.scope === 'SpecificSpaces' ? uiRule.applicableSpaceIdNamesStr?.split(',').map(s => s.trim()).filter(s => s) : undefined,
            });
            
            if (toDay !== null) {
            cumulativeStartDay = toDay + 1;
            } else {
            break; 
            }
        }
        }
    } catch (error: any) {
        // Toast was already shown for validation errors.
        console.error("Validation error during penalty tier processing:", error.message);
        return; 
    }
    
    const buildingData: Building = {
      id: formMode === 'add' ? `building-${Date.now()}` : currentBuildingForm.id!,
      name: currentBuildingForm.name!.trim(),
      address: currentBuildingForm.address?.trim() || undefined,
      penaltyPolicyTiers: finalPenaltyTiers.length > 0 ? finalPenaltyTiers : undefined,
      createdAt: currentBuildingForm.createdAt || new Date().toISOString(),
    };

    const existingBuildings = getStoredBuildings();
    let updatedBuildings;
    if (formMode === 'add') {
      updatedBuildings = [buildingData, ...existingBuildings];
      toast({ title: "Building Added", description: `${buildingData.name} has been added.` });
    } else {
      updatedBuildings = existingBuildings.map(b => b.id === buildingData.id ? buildingData : b);
      toast({ title: "Building Updated", description: `${buildingData.name} has been updated.` });
    }
    storeBuildings(updatedBuildings);
    router.push('/admin/buildings');
  };

  if (isLoading) {
    return <div className="flex justify-center items-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;
  }

  return (
    <div className="animate-fadeIn">
      <PageHeader
        title={pageTitle}
        icon={BuildingIconLucide}
        description="Define building details and late fee policies."
        actions={
            <Link href="/admin/buildings" passHref>
                <Button variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Buildings
                </Button>
            </Link>
        }
      />
      <Card className="shadow-lg">
        <form onSubmit={handleFormSubmit}>
          <CardContent className="p-6 space-y-6">
            {/* Building Details Section */}
            <div className="space-y-4 border-b pb-6">
              <div>
                <Label htmlFor="buildingNameMain" className="flex items-center text-sm font-medium">
                  <BuildingIconLucide className="mr-2 h-4 w-4 text-primary" />Building Name
                </Label>
                <Input 
                  id="buildingNameMain" 
                  value={currentBuildingForm.name || ''} 
                  onChange={(e) => setCurrentBuildingForm(prev => ({ ...prev, name: e.target.value }))} 
                  placeholder="e.g., Sunrise Tower" 
                  required 
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="buildingAddressMain" className="flex items-center text-sm font-medium">
                  <MapPin className="mr-2 h-4 w-4 text-primary" />Address (Optional)
                </Label>
                <Textarea 
                  id="buildingAddressMain" 
                  value={currentBuildingForm.address || ''} 
                  onChange={(e) => setCurrentBuildingForm(prev => ({ ...prev, address: e.target.value }))} 
                  placeholder="e.g., 123 Main St, Anytown, USA" 
                  rows={2}
                  className="mt-1"
                />
              </div>
            </div>

            {/* Penalty Rules Section */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold text-foreground">Late Fee Penalty Rules</h3>
                  <Button type="button" variant="outline" size="sm" onClick={handleAddUIPenaltyRule}>
                      <PlusCircle className="mr-1.5 h-4 w-4"/> Add Rule
                  </Button>
              </div>
              <CardDescription>
                Define sequential penalty rules. Each rule specifies its duration, fee, and scope (Building, Floor, or Specific Spaces). The last rule for each scope applies indefinitely.
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
                                className="h-7 w-7 text-destructive hover:bg-destructive/10">
                            <Trash2 className="h-4 w-4"/>
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                              <Label htmlFor={`ruleDuration-${uiRule.id}`} className="text-xs">Duration (Days)</Label>
                              <Input id={`ruleDuration-${uiRule.id}`} type="number" min="1" placeholder="e.g., 5" 
                                      value={uiRule.durationDays ?? ''} 
                                      onChange={(e) => handleUIPenaltyRuleChange(uiRule.id, 'durationDays', e.target.value)} 
                                      className="mt-1 text-sm h-9"/>
                              <p className="text-xs text-muted-foreground mt-0.5">For last rule in scope, leave blank for indefinite.</p>
                          </div>
                          <div>
                              <Label htmlFor={`ruleFeeType-${uiRule.id}`} className="text-xs">Fee Type</Label>
                              <Select value={uiRule.feeType} onValueChange={(value) => handleUIPenaltyRuleChange(uiRule.id, 'feeType', value as UIPenaltyRule['feeType'])}>
                                  <SelectTrigger id={`ruleFeeType-${uiRule.id}`} className="mt-1 text-sm h-9"><SelectValue /></SelectTrigger>
                                  <SelectContent><SelectItem value="Fixed">Fixed</SelectItem><SelectItem value="Percentage">Percentage</SelectItem></SelectContent>
                              </Select>
                          </div>
                          <div>
                              <Label htmlFor={`ruleFeeValue-${uiRule.id}`} className="text-xs">Fee Value</Label>
                              <Input id={`ruleFeeValue-${uiRule.id}`} type="number" step="0.01" min="0" placeholder="e.g., 50 or 2.5" 
                                      value={uiRule.feeValue ?? ''} 
                                      onChange={(e) => handleUIPenaltyRuleChange(uiRule.id, 'feeValue', e.target.value)} 
                                      className="mt-1 text-sm h-9"/>
                          </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                              <Label htmlFor={`scopeType-${uiRule.id}`} className="text-xs flex items-center"><Layers className="mr-1 h-3 w-3"/>Scope</Label>
                              <Select value={uiRule.scope} onValueChange={(value) => handleUIPenaltyRuleChange(uiRule.id, 'scope', value as UIPenaltyRule['scope'])}>
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
                                          onChange={(e) => handleUIPenaltyRuleChange(uiRule.id, 'applicableFloor', e.target.value)} className="mt-1 h-9"/>
                              </div>
                          )}
                      </div>
                      {uiRule.scope === 'SpecificSpaces' && (
                          <div>
                              <Label htmlFor={`applicableSpaces-${uiRule.id}`} className="text-xs flex items-center"><HomeIcon className="mr-1 h-3 w-3"/>Space ID Names (comma-separated)</Label>
                              <Input id={`applicableSpaces-${uiRule.id}`} placeholder="e.g., Unit 10A, Office 202B" value={uiRule.applicableSpaceIdNamesStr || ''} 
                                      onChange={(e) => handleUIPenaltyRuleChange(uiRule.id, 'applicableSpaceIdNamesStr', e.target.value)} className="mt-1 h-9"/>
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
            <Link href="/admin/buildings" passHref>
                <Button type="button" variant="outline">Cancel</Button>
            </Link>
            <Button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground">
              {formMode === 'add' ? 'Add Building' : 'Save Changes'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

// Using Suspense for client components that use searchParams
export default function BuildingUpsertPage() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>}>
      <BuildingUpsertForm />
    </Suspense>
  );
}

