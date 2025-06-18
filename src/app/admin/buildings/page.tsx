
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
            scope: tier.scope || 'Building', // Default old data to 'Building'
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

interface PenaltyRuleFormItem {
  id: string; 
  durationDays?: number; 
  feeType?: 'Fixed' | 'Percentage';
  feeValue?: number;
}

interface ScopedPenaltyPolicyForm {
  id: string; // For React list keys
  scope: 'Building' | 'Floor' | 'SpecificSpaces';
  applicableFloor?: string;
  applicableSpaceIdNamesStr?: string; // Comma-separated string for UI
  rules: PenaltyRuleFormItem[];
}

interface BuildingFormState {
  id?: string;
  name?: string;
  address?: string;
  createdAt?: string;
  scopedPolicies: ScopedPenaltyPolicyForm[];
}

export default function BuildingsPage() {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [isMounted, setIsMounted] = useState(false);
  const { toast } = useToast();

  const [currentBuildingForm, setCurrentBuildingForm] = useState<BuildingFormState>({ scopedPolicies: [] });
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'add' | 'edit'>('add');
  const [buildingToDelete, setBuildingToDelete] = useState<Building | null>(null);

  useEffect(() => {
    setIsMounted(true);
    setBuildings(getStoredBuildings());
  }, []);

  const handleAddScopedPolicy = () => {
    setCurrentBuildingForm(prev => ({
      ...prev,
      scopedPolicies: [
        ...prev.scopedPolicies,
        { 
          id: `scopedPolicy-${Date.now()}`, 
          scope: 'Building', 
          rules: [{ id: `rule-${Date.now()}`, feeType: 'Fixed' }] 
        }
      ]
    }));
  };

  const handleRemoveScopedPolicy = (scopedPolicyId: string) => {
    setCurrentBuildingForm(prev => ({
      ...prev,
      scopedPolicies: prev.scopedPolicies.filter(sp => sp.id !== scopedPolicyId)
    }));
  };

  const handleScopedPolicyChange = (scopedPolicyId: string, field: keyof Omit<ScopedPenaltyPolicyForm, 'id' | 'rules'>, value: any) => {
    setCurrentBuildingForm(prev => ({
      ...prev,
      scopedPolicies: prev.scopedPolicies.map(sp =>
        sp.id === scopedPolicyId
          ? { ...sp, [field]: value, 
              // Reset conditional fields if scope changes
              applicableFloor: field === 'scope' && value !== 'Floor' ? undefined : sp.applicableFloor,
              applicableSpaceIdNamesStr: field === 'scope' && value !== 'SpecificSpaces' ? undefined : sp.applicableSpaceIdNamesStr,
            }
          : sp
      )
    }));
  };
  
  const handleAddRuleToScopedPolicy = (scopedPolicyId: string) => {
    setCurrentBuildingForm(prev => ({
      ...prev,
      scopedPolicies: prev.scopedPolicies.map(sp =>
        sp.id === scopedPolicyId
          ? { ...sp, rules: [...sp.rules, { id: `rule-${Date.now()}-${scopedPolicyId}`, feeType: 'Fixed' }] }
          : sp
      )
    }));
  };

  const handleRemoveRuleFromScopedPolicy = (scopedPolicyId: string, ruleId: string) => {
     setCurrentBuildingForm(prev => ({
      ...prev,
      scopedPolicies: prev.scopedPolicies.map(sp =>
        sp.id === scopedPolicyId
          ? { ...sp, rules: sp.rules.filter(rule => rule.id !== ruleId) }
          : sp
      )
    }));
  };

  const handleRuleChangeInScopedPolicy = (scopedPolicyId: string, ruleId: string, field: keyof Omit<PenaltyRuleFormItem, 'id'>, value: any) => {
    setCurrentBuildingForm(prev => ({
      ...prev,
      scopedPolicies: prev.scopedPolicies.map(sp =>
        sp.id === scopedPolicyId
          ? { ...sp, rules: sp.rules.map(rule => 
              rule.id === ruleId 
                ? { ...rule, [field]: (field === 'durationDays' || field === 'feeValue') ? (value ? Number(value) : undefined) : value }
                : rule
            )}
          : sp
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

    for (const scopedPolicy of currentBuildingForm.scopedPolicies) {
      if (scopedPolicy.scope === 'Floor' && !scopedPolicy.applicableFloor?.trim()) {
        toast({ title: "Error", description: `Floor name is required for floor-scoped policy.`, variant: "destructive" });
        return;
      }
      if (scopedPolicy.scope === 'SpecificSpaces' && !scopedPolicy.applicableSpaceIdNamesStr?.trim()) {
         toast({ title: "Error", description: `Space ID(s) are required for space-scoped policy.`, variant: "destructive" });
        return;
      }

      let cumulativeStartDay = 1;
      for (let i = 0; i < scopedPolicy.rules.length; i++) {
        const rule = scopedPolicy.rules[i];
        if (!rule.durationDays || rule.durationDays <= 0 || !rule.feeType || rule.feeValue === undefined || rule.feeValue < 0) {
          toast({ title: "Error", description: `Rule ${i + 1} in a scoped policy is incomplete or invalid. 'Duration Days' and 'Fee Value' must be positive.`, variant: "destructive" });
          return;
        }

        const fromDay = cumulativeStartDay;
        const toDay = (i === scopedPolicy.rules.length - 1) ? null : (cumulativeStartDay + rule.durationDays - 1);

        finalPenaltyTiers.push({
          fromDay: fromDay,
          toDay: toDay,
          feeType: rule.feeType,
          feeValue: Number(rule.feeValue),
          scope: scopedPolicy.scope,
          applicableFloor: scopedPolicy.scope === 'Floor' ? scopedPolicy.applicableFloor?.trim() : undefined,
          applicableSpaceIdNames: scopedPolicy.scope === 'SpecificSpaces' ? scopedPolicy.applicableSpaceIdNamesStr?.split(',').map(s => s.trim()).filter(s => s) : undefined,
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
    setCurrentBuildingForm({ scopedPolicies: [] });
  };

  const openAddForm = () => {
    setFormMode('add');
    setCurrentBuildingForm({ 
      name: '', 
      address: '', 
      scopedPolicies: [{ 
        id: `scopedPolicy-${Date.now()}`, 
        scope: 'Building', 
        rules: [{ id: `rule-${Date.now()}`, feeType: 'Fixed' }] 
      }]
    });
    setIsFormOpen(true);
  };

  const openEditForm = (building: Building) => {
    setFormMode('edit');
    
    const groupedTiers: Record<string, PenaltyTier[]> = {};
    (building.penaltyPolicyTiers || []).forEach(tier => {
      let key = tier.scope;
      if (tier.scope === 'Floor' && tier.applicableFloor) key += `_${tier.applicableFloor}`;
      if (tier.scope === 'SpecificSpaces' && tier.applicableSpaceIdNames) key += `_${tier.applicableSpaceIdNames.join(',')}`;
      if (!groupedTiers[key]) groupedTiers[key] = [];
      groupedTiers[key].push(tier);
    });

    const formScopedPolicies: ScopedPenaltyPolicyForm[] = Object.values(groupedTiers).map((tiersInScope, index) => {
      // Sort tiers by fromDay to correctly reconstruct durations
      const sortedTiers = [...tiersInScope].sort((a,b) => a.fromDay - b.fromDay);
      
      const uiRules: PenaltyRuleFormItem[] = sortedTiers.map((tier, ruleIdx, arr) => {
        let durationDays: number | undefined;
        if (tier.toDay !== null && tier.toDay !== undefined) {
          durationDays = tier.toDay - tier.fromDay + 1;
        } else { // Last rule in this scope sequence (indefinite)
          // For UI, we might set a placeholder or let user know it's indefinite.
          // For now, let's assume a duration that made it the last, or simply 1 if it's the only rule.
           durationDays = (arr.length === 1 || ruleIdx === arr.length -1) ? 1 : undefined; // Placeholder for indefinite, needs UI hint
        }
        return {
          id: `rule-edit-${index}-${ruleIdx}-${Date.now()}`,
          durationDays: durationDays,
          feeType: tier.feeType,
          feeValue: tier.feeValue,
        };
      });
      
      const firstTierInScope = sortedTiers[0];
      return {
        id: `scopedPolicy-edit-${index}-${Date.now()}`,
        scope: firstTierInScope.scope,
        applicableFloor: firstTierInScope.applicableFloor,
        applicableSpaceIdNamesStr: firstTierInScope.applicableSpaceIdNames?.join(', '),
        rules: uiRules.length > 0 ? uiRules : [{ id: `rule-empty-${index}-${Date.now()}`, feeType: 'Fixed'}]
      };
    });

    setCurrentBuildingForm({ 
      id: building.id,
      name: building.name,
      address: building.address,
      createdAt: building.createdAt,
      scopedPolicies: formScopedPolicies.length > 0 ? formScopedPolicies : [{ id: `scopedPolicy-empty-${Date.now()}`, scope: 'Building', rules: [{ id: `rule-empty-inner-${Date.now()}`, feeType: 'Fixed'}] }],
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
        description="Add, view, and manage your property buildings. Define late fee policies applicable to the entire building, specific floors, or specific spaces."
        actions={
          <Button onClick={openAddForm} className="bg-primary hover:bg-primary/90 text-primary-foreground">
            <PlusCircle className="mr-2 h-5 w-5" /> Add New Building
          </Button>
        }
      />

      <Dialog open={isFormOpen} onOpenChange={(isOpen) => {
        setIsFormOpen(isOpen);
        if (!isOpen) setCurrentBuildingForm({ scopedPolicies: [] });
      }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-headline">{formMode === 'add' ? 'Add New Building' : 'Edit Building'}</DialogTitle>
            <DialogDescription>
              Fill in building details. Add penalty policies for different scopes (Building, Floor, Space). For each scope, define sequential rules; the last rule applies indefinitely.
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
              
                <div className="space-y-4 pt-3 border-t">
                  <div className="flex justify-between items-center">
                      <h4 className="text-md font-semibold text-foreground">Late Fee Policies (Scoped)</h4>
                      <Button type="button" variant="outline" size="sm" onClick={handleAddScopedPolicy}>
                          <PlusCircle className="mr-1.5 h-4 w-4"/> Add Policy Scope
                      </Button>
                  </div>
                  {currentBuildingForm.scopedPolicies.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">No penalty policies defined. Click "Add Policy Scope" to begin.</p>}

                  {currentBuildingForm.scopedPolicies.map((scopedPolicy, spIndex) => (
                    <Card key={scopedPolicy.id} className="p-3 bg-secondary/20 shadow-sm">
                      <CardHeader className="p-2 pb-1">
                        <div className="flex justify-between items-center">
                          <CardTitle className="text-base">Policy Scope {spIndex + 1}</CardTitle>
                          <Button type="button" variant="ghost" size="icon" 
                                  onClick={() => handleRemoveScopedPolicy(scopedPolicy.id)}
                                  className="h-7 w-7 text-destructive hover:bg-destructive/10">
                              <Trash2 className="h-4 w-4"/>
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="p-2 space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <Label htmlFor={`scopeType-${scopedPolicy.id}`}>Scope Type</Label>
                                <Select value={scopedPolicy.scope} onValueChange={(value) => handleScopedPolicyChange(scopedPolicy.id, 'scope', value as ScopedPenaltyPolicyForm['scope'])}>
                                    <SelectTrigger id={`scopeType-${scopedPolicy.id}`} className="mt-1"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Building">Entire Building</SelectItem>
                                        <SelectItem value="Floor">Specific Floor</SelectItem>
                                        <SelectItem value="SpecificSpaces">Specific Space(s)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            {scopedPolicy.scope === 'Floor' && (
                                <div>
                                    <Label htmlFor={`applicableFloor-${scopedPolicy.id}`}>Floor Name</Label>
                                    <Input id={`applicableFloor-${scopedPolicy.id}`} placeholder="e.g., 5th Floor" value={scopedPolicy.applicableFloor || ''} 
                                           onChange={(e) => handleScopedPolicyChange(scopedPolicy.id, 'applicableFloor', e.target.value)} className="mt-1"/>
                                </div>
                            )}
                        </div>
                        {scopedPolicy.scope === 'SpecificSpaces' && (
                            <div>
                                <Label htmlFor={`applicableSpaces-${scopedPolicy.id}`}>Space ID Names (comma-separated)</Label>
                                <Input id={`applicableSpaces-${scopedPolicy.id}`} placeholder="e.g., Unit 10A, Office 202B" value={scopedPolicy.applicableSpaceIdNamesStr || ''} 
                                       onChange={(e) => handleScopedPolicyChange(scopedPolicy.id, 'applicableSpaceIdNamesStr', e.target.value)} className="mt-1"/>
                                <p className="text-xs text-muted-foreground mt-0.5">Enter exact 'Space ID/Name' from Spaces page.</p>
                            </div>
                        )}

                        <div className="pt-2 border-t border-border/50">
                            <div className="flex justify-between items-center mb-1.5">
                                <h5 className="text-sm font-medium">Rules for this Scope (Sequential):</h5>
                                <Button type="button" variant="outline" size="xs" onClick={() => handleAddRuleToScopedPolicy(scopedPolicy.id)}>
                                    <PlusCircle className="mr-1 h-3 w-3"/> Add Rule
                                </Button>
                            </div>
                            {scopedPolicy.rules.length === 0 && <p className="text-xs text-muted-foreground text-center py-1">No rules for this scope. Add at least one.</p>}
                            {scopedPolicy.rules.map((rule, ruleIndex) => (
                                <div key={rule.id} className="p-2.5 border rounded-md space-y-2 bg-background my-2 relative">
                                     <p className="text-xs font-semibold text-muted-foreground">
                                        Rule {ruleIndex + 1} for this scope 
                                        {ruleIndex === scopedPolicy.rules.length - 1 ? " (Applies indefinitely from its start if last)" : ""}
                                    </p>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                                        <div>
                                            <Label htmlFor={`ruleDuration-${rule.id}`}>Duration (Days)</Label>
                                            <Input id={`ruleDuration-${rule.id}`} type="number" min="1" placeholder="e.g., 5" 
                                                   value={rule.durationDays ?? ''} 
                                                   onChange={(e) => handleRuleChangeInScopedPolicy(scopedPolicy.id, rule.id, 'durationDays', e.target.value)} 
                                                   className="mt-1 text-xs h-8"
                                                   disabled={ruleIndex === scopedPolicy.rules.length - 1 && scopedPolicy.rules.length > 0} // Disable duration for the last rule, as it's indefinite
                                                   />
                                            {ruleIndex === scopedPolicy.rules.length - 1 && <p className="text-xs text-muted-foreground mt-0.5">Last rule: indefinite.</p>}
                                        </div>
                                        <div>
                                            <Label htmlFor={`ruleFeeType-${rule.id}`}>Fee Type</Label>
                                            <Select value={rule.feeType || 'Fixed'} onValueChange={(value) => handleRuleChangeInScopedPolicy(scopedPolicy.id, rule.id, 'feeType', value as any)}>
                                                <SelectTrigger id={`ruleFeeType-${rule.id}`} className="mt-1 text-xs h-8"><SelectValue /></SelectTrigger>
                                                <SelectContent><SelectItem value="Fixed">Fixed</SelectItem><SelectItem value="Percentage">Percentage</SelectItem></SelectContent>
                                            </Select>
                                        </div>
                                        <div>
                                            <Label htmlFor={`ruleFeeValue-${rule.id}`}>Fee Value</Label>
                                            <Input id={`ruleFeeValue-${rule.id}`} type="number" step="0.01" min="0" placeholder="e.g., 50 or 2.5" 
                                                   value={rule.feeValue ?? ''} 
                                                   onChange={(e) => handleRuleChangeInScopedPolicy(scopedPolicy.id, rule.id, 'feeValue', e.target.value)} 
                                                   className="mt-1 text-xs h-8"/>
                                        </div>
                                    </div>
                                    {scopedPolicy.rules.length > 1 && (
                                        <Button type="button" variant="ghost" size="icon" 
                                                onClick={() => handleRemoveRuleFromScopedPolicy(scopedPolicy.id, rule.id)}
                                                className="absolute top-0.5 right-0.5 h-6 w-6 text-destructive hover:bg-destructive/10">
                                            <Trash2 className="h-3.5 w-3.5"/>
                                        </Button>
                                    )}
                                </div>
                            ))}
                        </div>
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
            const policiesByScope: Record<string, PenaltyTier[]> = {};
            (building.penaltyPolicyTiers || []).forEach(tier => {
              let key = tier.scope;
              if (tier.scope === 'Floor' && tier.applicableFloor) key += `: ${tier.applicableFloor}`;
              if (tier.scope === 'SpecificSpaces' && tier.applicableSpaceIdNames?.length) key += `: ${tier.applicableSpaceIdNames.join(', ')}`;
              if (!policiesByScope[key]) policiesByScope[key] = [];
              policiesByScope[key].push(tier);
            });

            return (
            <Card key={building.id} className="flex flex-col justify-between shadow-lg hover:shadow-xl transition-shadow duration-300 transform hover:-translate-y-1">
              <CardHeader>
                <CardTitle className="font-headline text-xl mb-1">{building.name}</CardTitle>
                {building.address && <CardDescription className="text-sm flex items-center"><MapPin className="mr-1.5 h-4 w-4 text-muted-foreground" />{building.address}</CardDescription>}
              </CardHeader>
              <CardContent className="text-sm space-y-2 flex-grow">
                   <p className="text-xs text-muted-foreground">Registered: {format(new Date(building.createdAt), 'PP')}</p>
                   {Object.keys(policiesByScope).length > 0 ? (
                      <div className="mt-2 pt-2 border-t border-border/50 space-y-2.5">
                          <h5 className="text-xs font-semibold text-foreground mb-1">Late Fee Policies:</h5>
                          {Object.entries(policiesByScope).map(([scopeKey, tiers]) => (
                            <div key={scopeKey} className="p-1.5 bg-secondary/30 rounded-sm">
                                <p className="text-xs font-medium text-primary capitalize flex items-center">
                                    {tiers[0].scope === 'Building' && <BuildingIcon className="inline mr-1 h-3 w-3"/>}
                                    {tiers[0].scope === 'Floor' && <Layers className="inline mr-1 h-3 w-3"/>}
                                    {tiers[0].scope === 'SpecificSpaces' && <HomeIcon className="inline mr-1 h-3 w-3"/>}
                                    Scope: {scopeKey}
                                </p>
                                {tiers.sort((a,b)=>a.fromDay - b.fromDay).map((tier, index) => {
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
    
