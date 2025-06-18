
"use client";

import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/custom/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Building as BuildingIcon, PlusCircle, Edit3, Trash2, MapPin, Clock, DollarSign as DollarSignLucide, AlertTriangle, Layers, HomeIcon } from 'lucide-react';
import type { Building, PenaltyTier } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from '@/components/ui/textarea';
import { format } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';

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

interface UIPenaltyRule {
  id: string; 
  durationDays?: number; 
  feeType?: 'Fixed' | 'Percentage';
  feeValue?: number;
  scope: 'Building' | 'Floor' | 'SpecificSpaces';
  applicableFloor?: string;
  applicableSpaceIdNamesStr?: string; 
}

interface BuildingFormState {
  id?: string;
  name?: string;
  address?: string;
  createdAt?: string;
  uiPenaltyRules: UIPenaltyRule[];
}

export default function BuildingsPage() {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [isMounted, setIsMounted] = useState(false);
  const { toast } = useToast();

  const [currentBuildingForm, setCurrentBuildingForm] = useState<BuildingFormState>({ uiPenaltyRules: [] });
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'add' | 'edit'>('add');
  const [buildingToDelete, setBuildingToDelete] = useState<Building | null>(null);

  useEffect(() => {
    setIsMounted(true);
    setBuildings(getStoredBuildings());
  }, []);

  const handleAddUIPenaltyRule = () => {
    setCurrentBuildingForm(prev => ({
      ...prev,
      uiPenaltyRules: [
        ...prev.uiPenaltyRules,
        { 
          id: `uiRule-${Date.now()}`, 
          scope: 'Building', 
          feeType: 'Fixed',
          durationDays: 5, 
          feeValue: 0,
        }
      ]
    }));
  };

  const handleRemoveUIPenaltyRule = (ruleId: string) => {
    setCurrentBuildingForm(prev => ({
      ...prev,
      uiPenaltyRules: prev.uiPenaltyRules.filter(rule => rule.id !== ruleId)
    }));
  };

  const handleUIPenaltyRuleChange = (ruleId: string, field: keyof UIPenaltyRule, value: any) => {
    setCurrentBuildingForm(prev => ({
      ...prev,
      uiPenaltyRules: prev.uiPenaltyRules.map(rule =>
        rule.id === ruleId
          ? { ...rule, [field]: (field === 'durationDays' || field === 'feeValue') ? (value ? Number(value) : undefined) : value,
              applicableFloor: field === 'scope' && value !== 'Floor' ? undefined : rule.applicableFloor,
              applicableSpaceIdNamesStr: field === 'scope' && value !== 'SpecificSpaces' ? undefined : rule.applicableSpaceIdNamesStr,
            }
          : rule
      )
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

    currentBuildingForm.uiPenaltyRules.forEach(uiRule => {
      let scopeKey = uiRule.scope;
      if (uiRule.scope === 'Floor' && uiRule.applicableFloor?.trim()) {
        scopeKey += `_Floor_${uiRule.applicableFloor.trim()}`;
      } else if (uiRule.scope === 'SpecificSpaces' && uiRule.applicableSpaceIdNamesStr?.trim()) {
        const sortedSpaceIds = uiRule.applicableSpaceIdNamesStr.split(',').map(s => s.trim()).filter(s => s).sort().join(',');
        scopeKey += `_Spaces_${sortedSpaceIds}`;
      }
      
      if (!groupedUIRules[scopeKey]) {
        groupedUIRules[scopeKey] = [];
      }
      groupedUIRules[scopeKey].push(uiRule);
    });

    for (const scopeKey in groupedUIRules) {
      const rulesInScope = groupedUIRules[scopeKey];
      let cumulativeStartDay = 1;

      for (let i = 0; i < rulesInScope.length; i++) {
        const uiRule = rulesInScope[i];

        if (!uiRule.feeType || uiRule.feeValue === undefined || uiRule.feeValue < 0) {
          toast({ title: "Error", description: `A rule in scope '${scopeKey.replace("_Floor_", " Floor: ").replace("_Spaces_", " Spaces: ")}' is incomplete. Fee Type and non-negative Fee Value are required.`, variant: "destructive" });
          return;
        }
        if (i < rulesInScope.length - 1 && (!uiRule.durationDays || uiRule.durationDays <= 0)) {
             toast({ title: "Error", description: `A rule in scope '${scopeKey.replace("_Floor_", " Floor: ").replace("_Spaces_", " Spaces: ")}' needs a positive duration. Only the last rule for a scope can have an indefinite duration (blank duration).`, variant: "destructive" });
            return;
        }
         if (uiRule.scope === 'Floor' && !uiRule.applicableFloor?.trim()) {
            toast({ title: "Error", description: `Floor name is required for floor-scoped rule.`, variant: "destructive" });
            return;
        }
        if (uiRule.scope === 'SpecificSpaces' && !uiRule.applicableSpaceIdNamesStr?.trim()) {
            toast({ title: "Error", description: `Space ID(s) are required for space-scoped rule.`, variant: "destructive" });
            return;
        }

        const fromDay = cumulativeStartDay;
        let toDay: number | null = null;

        if (i === rulesInScope.length - 1) { 
          toDay = null; 
        } else {
          toDay = fromDay + (uiRule.durationDays || 1) - 1;
        }

        finalPenaltyTiers.push({
          fromDay: fromDay,
          toDay: toDay,
          feeType: uiRule.feeType,
          feeValue: Number(uiRule.feeValue),
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
    
    const buildingData: Building = {
      id: formMode === 'add' ? `building-${Date.now()}` : currentBuildingForm.id!,
      name: currentBuildingForm.name!.trim(),
      address: currentBuildingForm.address?.trim() || undefined,
      penaltyPolicyTiers: finalPenaltyTiers.length > 0 ? finalPenaltyTiers : undefined,
      createdAt: currentBuildingForm.createdAt || new Date().toISOString(),
    };

    let updatedBuildings;
    if (formMode === 'add') {
      updatedBuildings = [buildingData, ...buildings];
      toast({ title: "Building Added", description: `${buildingData.name} has been added.` });
    } else {
      updatedBuildings = buildings.map(b => b.id === buildingData.id ? buildingData : b);
      toast({ title: "Building Updated", description: `${buildingData.name} has been updated.` });
    }
    setBuildings(updatedBuildings);
    storeBuildings(updatedBuildings);
    setIsFormOpen(false);
    setCurrentBuildingForm({ uiPenaltyRules: [] });
  };

  const openAddForm = () => {
    setFormMode('add');
    setCurrentBuildingForm({ 
      name: '', 
      address: '', 
      uiPenaltyRules: [{ 
        id: `uiRule-${Date.now()}`, 
        scope: 'Building', 
        durationDays: 7, 
        feeType: 'Fixed',
        feeValue: 10,
      }]
    });
    setIsFormOpen(true);
  };

  const openEditForm = (building: Building) => {
    setFormMode('edit');
    
    const loadedUIPenaltyRules: UIPenaltyRule[] = [];
    const tiersGroupedByScopeKey: Record<string, PenaltyTier[]> = {};

    (building.penaltyPolicyTiers || []).forEach(tier => {
      let scopeKey = tier.scope;
      if (tier.scope === 'Floor' && tier.applicableFloor) scopeKey += `_Floor_${tier.applicableFloor}`;
      if (tier.scope === 'SpecificSpaces' && tier.applicableSpaceIdNames?.length) scopeKey += `_Spaces_${tier.applicableSpaceIdNames.sort().join(',')}`;
      
      if (!tiersGroupedByScopeKey[scopeKey]) tiersGroupedByScopeKey[scopeKey] = [];
      tiersGroupedByScopeKey[scopeKey].push(tier);
    });

    Object.values(tiersGroupedByScopeKey).forEach(scopeTiers => {
        scopeTiers.sort((a,b) => a.fromDay - b.fromDay).forEach((tier) => {
            let duration: number | undefined;
            if (tier.toDay !== null && tier.toDay !== undefined) {
                duration = tier.toDay - tier.fromDay + 1;
            } else {
                duration = undefined; 
            }
            loadedUIPenaltyRules.push({
                id: `uiRule-edit-${tier.scope}-${tier.fromDay}-${Math.random()}`,
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
      id: building.id,
      name: building.name,
      address: building.address,
      createdAt: building.createdAt,
      uiPenaltyRules: loadedUIPenaltyRules.length > 0 ? loadedUIPenaltyRules : [{ id: `uiRule-empty-${Date.now()}`, scope: 'Building', feeType: 'Fixed', durationDays: 7, feeValue: 0 }],
    });
    setIsFormOpen(true);
  };

  const handleDeleteBuilding = () => {
    if (!buildingToDelete) return;
    const updatedBuildings = buildings.filter(b => b.id !== buildingToDelete.id);
    setBuildings(updatedBuildings);
    storeBuildings(updatedBuildings);
    toast({ title: "Building Deleted", description: `${buildingToDelete.name} has been removed.`, variant: "destructive" });
    setBuildingToDelete(null);
  };

  if (!isMounted) {
    return <div className="flex justify-center items-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;
  }

  return (
    <div className="animate-fadeIn">
      <PageHeader
        title="Manage Buildings"
        icon={BuildingIcon}
        description="Add, view, and manage buildings. Define late fee policies by adding sequential rules, each specifying its duration, fee, and scope (Building, Floor, or Specific Spaces). The last rule for each scope applies indefinitely."
        actions={
          <Button onClick={openAddForm} className="bg-primary hover:bg-primary/90 text-primary-foreground">
            <PlusCircle className="mr-2 h-5 w-5" /> Add New Building
          </Button>
        }
      />

      <Dialog open={isFormOpen} onOpenChange={(isOpen) => {
        setIsFormOpen(isOpen);
        if (!isOpen) setCurrentBuildingForm({ uiPenaltyRules: [] });
      }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-headline">{formMode === 'add' ? 'Add New Building' : 'Edit Building'}</DialogTitle>
            <DialogDescription>
              Fill in building details. Add penalty rules: for each rule, set its duration, fee, and scope. Rules are processed sequentially within their defined scope.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleFormSubmit}>
            <ScrollArea className="max-h-[70vh] pr-3">
              <div className="space-y-4 py-4">
                <div>
                  <Label htmlFor="buildingNameMain" className="flex items-center text-sm font-medium">
                    <BuildingIcon className="mr-2 h-4 w-4 text-primary" />Building Name
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
              
                <div className="space-y-3 pt-3 border-t">
                  <div className="flex justify-between items-center">
                      <h4 className="text-md font-semibold text-foreground">Late Fee Penalty Rules</h4>
                      <Button type="button" variant="outline" size="sm" onClick={handleAddUIPenaltyRule}>
                          <PlusCircle className="mr-1.5 h-4 w-4"/> Add Rule
                      </Button>
                  </div>
                  {currentBuildingForm.uiPenaltyRules.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">No penalty rules defined. Click "Add Rule" to begin.</p>}

                  {currentBuildingForm.uiPenaltyRules.map((uiRule, ruleIndex) => (
                    <Card key={uiRule.id} className="p-3 bg-secondary/20 shadow-sm">
                      <CardHeader className="p-2 pb-1">
                        <div className="flex justify-between items-center">
                          <CardTitle className="text-base">Rule {ruleIndex + 1}</CardTitle>
                          <Button type="button" variant="ghost" size="icon" 
                                  onClick={() => handleRemoveUIPenaltyRule(uiRule.id)}
                                  className="h-7 w-7 text-destructive hover:bg-destructive/10">
                              <Trash2 className="h-4 w-4"/>
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="p-2 space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                                <Label htmlFor={`ruleDuration-${uiRule.id}`}>Duration (Days)</Label>
                                <Input id={`ruleDuration-${uiRule.id}`} type="number" min="1" placeholder="e.g., 5" 
                                        value={uiRule.durationDays ?? ''} 
                                        onChange={(e) => handleUIPenaltyRuleChange(uiRule.id, 'durationDays', e.target.value)} 
                                        className="mt-1 text-xs h-8"/>
                                <p className="text-xs text-muted-foreground mt-0.5">Leave blank if last rule for its scope (indefinite).</p>
                            </div>
                            <div>
                                <Label htmlFor={`ruleFeeType-${uiRule.id}`}>Fee Type</Label>
                                <Select value={uiRule.feeType || 'Fixed'} onValueChange={(value) => handleUIPenaltyRuleChange(uiRule.id, 'feeType', value as any)}>
                                    <SelectTrigger id={`ruleFeeType-${uiRule.id}`} className="mt-1 text-xs h-8"><SelectValue /></SelectTrigger>
                                    <SelectContent><SelectItem value="Fixed">Fixed</SelectItem><SelectItem value="Percentage">Percentage</SelectItem></SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label htmlFor={`ruleFeeValue-${uiRule.id}`}>Fee Value</Label>
                                <Input id={`ruleFeeValue-${uiRule.id}`} type="number" step="0.01" min="0" placeholder="e.g., 50 or 2.5" 
                                        value={uiRule.feeValue ?? ''} 
                                        onChange={(e) => handleUIPenaltyRuleChange(uiRule.id, 'feeValue', e.target.value)} 
                                        className="mt-1 text-xs h-8"/>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <Label htmlFor={`scopeType-${uiRule.id}`}>Scope</Label>
                                <Select value={uiRule.scope} onValueChange={(value) => handleUIPenaltyRuleChange(uiRule.id, 'scope', value as UIPenaltyRule['scope'])}>
                                    <SelectTrigger id={`scopeType-${uiRule.id}`} className="mt-1"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Building">Entire Building</SelectItem>
                                        <SelectItem value="Floor">Specific Floor</SelectItem>
                                        <SelectItem value="SpecificSpaces">Specific Space(s)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            {uiRule.scope === 'Floor' && (
                                <div>
                                    <Label htmlFor={`applicableFloor-${uiRule.id}`}>Floor Name</Label>
                                    <Input id={`applicableFloor-${uiRule.id}`} placeholder="e.g., 5th Floor" value={uiRule.applicableFloor || ''} 
                                            onChange={(e) => handleUIPenaltyRuleChange(uiRule.id, 'applicableFloor', e.target.value)} className="mt-1"/>
                                </div>
                            )}
                        </div>
                        {uiRule.scope === 'SpecificSpaces' && (
                            <div>
                                <Label htmlFor={`applicableSpaces-${uiRule.id}`}>Space ID Names (comma-separated)</Label>
                                <Input id={`applicableSpaces-${uiRule.id}`} placeholder="e.g., Unit 10A, Office 202B" value={uiRule.applicableSpaceIdNamesStr || ''} 
                                        onChange={(e) => handleUIPenaltyRuleChange(uiRule.id, 'applicableSpaceIdNamesStr', e.target.value)} className="mt-1"/>
                                <p className="text-xs text-muted-foreground mt-0.5">Enter exact 'Space ID/Name' from Spaces page.</p>
                            </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </ScrollArea>
            <DialogFooter className="mt-4 pt-4 border-t">
              <DialogClose asChild>
                <Button type="button" variant="outline">Cancel</Button>
              </DialogClose>
              <Button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground">
                {formMode === 'add' ? 'Add Building' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!buildingToDelete} onOpenChange={(open) => { if (!open) setBuildingToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center"><AlertTriangle className="text-destructive mr-2 h-5 w-5"/>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the building "{buildingToDelete?.name}".
              Associated spaces or agreements will NOT be deleted but may become orphaned.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setBuildingToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteBuilding} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
              Delete Building
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {buildings.length === 0 ? (
        <Card className="text-center py-12 shadow-sm">
          <CardContent>
            <BuildingIcon className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2 font-headline">No Buildings Yet</h3>
            <p className="text-muted-foreground mb-4">Get started by adding your first building.</p>
            <Button onClick={openAddForm}>
              <PlusCircle className="mr-2 h-5 w-5" /> Add Building
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {buildings.map((building) => {
            const policiesByScopeGroup: Record<string, PenaltyTier[]> = {};
            (building.penaltyPolicyTiers || []).forEach(tier => {
              let key = tier.scope;
              if (tier.scope === 'Floor' && tier.applicableFloor) key += `: ${tier.applicableFloor}`;
              if (tier.scope === 'SpecificSpaces' && tier.applicableSpaceIdNames?.length) key += `: ${tier.applicableSpaceIdNames.join(', ')}`;
              if (!policiesByScopeGroup[key]) policiesByScopeGroup[key] = [];
              policiesByScopeGroup[key].push(tier);
            });

            return (
            <Card key={building.id} className="flex flex-col justify-between shadow-lg hover:shadow-xl transition-shadow duration-300 transform hover:-translate-y-1">
              <CardHeader>
                <CardTitle className="font-headline text-xl mb-1">{building.name}</CardTitle>
                {building.address && <CardDescription className="text-sm flex items-center"><MapPin className="mr-1.5 h-4 w-4 text-muted-foreground" />{building.address}</CardDescription>}
              </CardHeader>
              <CardContent className="text-sm space-y-2 flex-grow">
                   <p className="text-xs text-muted-foreground">Registered: {format(new Date(building.createdAt), 'PP')}</p>
                   {Object.keys(policiesByScopeGroup).length > 0 ? (
                      <div className="mt-2 pt-2 border-t border-border/50 space-y-2.5">
                          <h5 className="text-xs font-semibold text-foreground mb-1">Late Fee Policies:</h5>
                          {Object.entries(policiesByScopeGroup).map(([scopeKey, tiersInGroup]) => (
                            <div key={scopeKey} className="p-1.5 bg-secondary/30 rounded-sm">
                                <p className="text-xs font-medium text-primary capitalize flex items-center">
                                    {tiersInGroup[0].scope === 'Building' && <BuildingIcon className="inline mr-1 h-3 w-3"/>}
                                    {tiersInGroup[0].scope === 'Floor' && <Layers className="inline mr-1 h-3 w-3"/>}
                                    {tiersInGroup[0].scope === 'SpecificSpaces' && <HomeIcon className="inline mr-1 h-3 w-3"/>}
                                    Scope: {scopeKey.replace("_Floor_", " Floor: ").replace("_Spaces_", " Spaces: ")}
                                </p>
                                {tiersInGroup.sort((a,b)=>a.fromDay - b.fromDay).map((tier, index) => {
                                    let tierDurationDesc = `Days ${tier.fromDay}`;
                                    if (tier.toDay !== null && tier.toDay !== undefined) {
                                        tierDurationDesc += ` - ${tier.toDay}`;
                                    } else {
                                        tierDurationDesc += ` onwards`;
                                    }
                                    return (
                                        <div key={index} className="text-xs pl-2 py-0.5">
                                            <p><Clock className="inline mr-1 h-3 w-3"/>{tierDurationDesc}</p>
                                            <p><DollarSignLucide className="inline mr-1 h-3 w-3"/>Fee: {tier.feeType === 'Fixed' ? `$${tier.feeValue.toFixed(2)}` : `${tier.feeValue}% of rent`}</p>
                                        </div>
                                    )
                                })}
                            </div>
                          ))}
                      </div>
                   ) : (
                      <p className="text-xs text-muted-foreground italic mt-2 pt-2 border-t border-border/50">No late fee policy set.</p>
                   )}
                </CardContent>
              <CardFooter className="border-t pt-4 flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => openEditForm(building)}>
                  <Edit3 className="mr-1 h-4 w-4" /> Edit
                </Button>
                <Button variant="destructive" size="sm" onClick={() => setBuildingToDelete(building)}>
                  <Trash2 className="mr-1 h-4 w-4" /> Delete
                </Button>
              </CardFooter>
            </Card>
          )})}
        </div>
      )}
    </div>
  );
}
    

    