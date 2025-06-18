
"use client";

import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/custom/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Building as BuildingIcon, PlusCircle, Edit3, Trash2, MapPin, Clock, DollarSign as DollarSignLucide, AlertTriangle } from 'lucide-react';
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

const getStoredBuildings = (): Building[] => {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('buildings');
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as Building[];
        return parsed.map(b => ({
          ...b,
          penaltyPolicyTiers: b.penaltyPolicyTiers || [], 
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

// This state is for the form UI
interface PenaltyRuleFormItem {
  id: string; // For React list keys
  days?: number; // Duration for this specific tier
  feeType?: 'Fixed' | 'Percentage';
  feeValue?: number;
}

interface BuildingFormState {
  id?: string;
  name?: string;
  address?: string;
  createdAt?: string;
  penaltyRules: PenaltyRuleFormItem[];
}


export default function BuildingsPage() {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [isMounted, setIsMounted] = useState(false);
  const { toast } = useToast();

  const [currentBuildingForm, setCurrentBuildingForm] = useState<BuildingFormState>({ penaltyRules: [] });
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'add' | 'edit'>('add');
  const [buildingToDelete, setBuildingToDelete] = useState<Building | null>(null);

  useEffect(() => {
    setIsMounted(true);
    setBuildings(getStoredBuildings());
  }, []);

  // Penalty Rule form handlers
  const handleAddPenaltyRule = () => {
    setCurrentBuildingForm(prev => ({
      ...prev,
      penaltyRules: [...prev.penaltyRules, { id: `rule-${Date.now()}`, feeType: 'Fixed' }]
    }));
  };

  const handleRemovePenaltyRule = (ruleId: string) => {
    setCurrentBuildingForm(prev => ({
      ...prev,
      penaltyRules: prev.penaltyRules.filter(rule => rule.id !== ruleId)
    }));
  };

  const handlePenaltyRuleChange = (ruleId: string, field: keyof Omit<PenaltyRuleFormItem, 'id'>, value: any) => {
    setCurrentBuildingForm(prev => ({
      ...prev,
      penaltyRules: prev.penaltyRules.map(rule => 
        rule.id === ruleId 
          ? { ...rule, [field]: field === 'days' || field === 'feeValue' ? (value ? Number(value) : undefined) : value } 
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
    let cumulativeStartDay = 1;

    for (let i = 0; i < currentBuildingForm.penaltyRules.length; i++) {
      const rule = currentBuildingForm.penaltyRules[i];
      if (!rule.days || rule.days <= 0 || !rule.feeType || rule.feeValue === undefined || rule.feeValue < 0) {
        toast({ title: "Error", description: `Penalty Rule ${i + 1} is incomplete or invalid. 'Days' and 'Fee Value' must be positive.`, variant: "destructive" });
        return;
      }

      const fromDay = cumulativeStartDay;
      const toDay = (i === currentBuildingForm.penaltyRules.length - 1) ? null : (cumulativeStartDay + rule.days - 1);

      finalPenaltyTiers.push({
        fromDay: fromDay,
        toDay: toDay,
        feeType: rule.feeType,
        feeValue: Number(rule.feeValue),
      });

      if (toDay !== null) {
        cumulativeStartDay = toDay + 1;
      } else {
        // This is the last rule and it's indefinite, so break if there are somehow more UI rules.
        // This check might be redundant if UI prevents adding more after an indefinite one.
        break; 
      }
    }
    
    // Validate that if multiple tiers, the 'toDay' of a preceding tier is less than 'fromDay' of next.
    // This is handled by cumulativeStartDay logic.

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
    setCurrentBuildingForm({ penaltyRules: [] });
  };

  const openAddForm = () => {
    setFormMode('add');
    setCurrentBuildingForm({ 
      name: '', 
      address: '', 
      penaltyRules: [{ id: `rule-${Date.now()}`, feeType: 'Fixed' }] // Start with one empty rule
    });
    setIsFormOpen(true);
  };

  const openEditForm = (building: Building) => {
    setFormMode('edit');
    const formRules: PenaltyRuleFormItem[] = (building.penaltyPolicyTiers || []).map((tier, index, arr) => {
      let days;
      if (tier.toDay === null) { // Last, indefinite tier
        // If it's the only tier and indefinite, 'days' could be a placeholder like 1, or UI could show "thereafter"
        // For now, let's make 'days' reflect the start for simplicity in UI, actual duration is indefinite.
        // Or, if this is the last tier, days could be considered '1' if fromDay is the start of this indefinite period
        // This might need a better UI representation like a checkbox "applies thereafter" for the last rule.
        // For simplicity, let's make `days` represent the duration from its start day if toDay is not null.
        // If toDay is null, it means it's indefinite from fromDay.
        // The user inputs duration for each segment.
        // If the last saved tier has toDay: null, it means its original 'days' input led to it being last.
        // For display, we'll assume it had a 'days' value that made it the last one.
        // If toDay is null, then this rule had a 'days' input, but it's the last, so it goes on forever.
        // The simplest is to calculate the original days if toDay is not null.
        // If toDay is null for the last one, we can just use its fromDay to indicate where it started.
        // The user provides duration for each tier.
         days = (tier.toDay !== null) ? (tier.toDay - tier.fromDay + 1) : 1; // default to 1 if it's the indefinite one
         if (tier.toDay === null && arr.length > 1) { // if it's last and not the only one
            const prevTier = arr[index-1];
            if (prevTier && prevTier.toDay) {
                 // this is just a placeholder, as it's indefinite
            }
         } else if (tier.toDay === null && arr.length === 1) {
            // only one tier, and it's indefinite. User must have entered some 'days' for it.
         }

      } else {
        days = tier.toDay - tier.fromDay + 1;
      }


      return {
        id: `rule-edit-${index}-${Date.now()}`,
        days: (tier.toDay !== null) ? (tier.toDay - tier.fromDay + 1) : (building.penaltyPolicyTiers && building.penaltyPolicyTiers.length === 1 ? 1 : undefined), // If last tier (toDay is null), days is less defined this way. User will re-enter or it defaults.
        feeType: tier.feeType,
        feeValue: tier.feeValue,
      };
    });


    setCurrentBuildingForm({ 
      id: building.id,
      name: building.name,
      address: building.address,
      createdAt: building.createdAt,
      penaltyRules: formRules.length > 0 ? formRules : [{ id: `rule-${Date.now()}`, feeType: 'Fixed' }],
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
        description="Add, view, and manage your property buildings, including multi-tier late fee policies."
        actions={
          <Button onClick={openAddForm} className="bg-primary hover:bg-primary/90 text-primary-foreground">
            <PlusCircle className="mr-2 h-5 w-5" /> Add New Building
          </Button>
        }
      />

      <Dialog open={isFormOpen} onOpenChange={(isOpen) => {
        setIsFormOpen(isOpen);
        if (!isOpen) setCurrentBuildingForm({ penaltyRules: [] });
      }}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="font-headline">{formMode === 'add' ? 'Add New Building' : 'Edit Building'}</DialogTitle>
            <DialogDescription>
              Fill in the details for the building. Add penalty rules sequentially. The last rule applies indefinitely.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleFormSubmit}>
            <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto pr-3">
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
                    <h4 className="text-md font-semibold text-foreground">Late Fee Policy Rules</h4>
                    <Button type="button" variant="outline" size="sm" onClick={handleAddPenaltyRule}>
                        <PlusCircle className="mr-1.5 h-4 w-4"/> Add Rule
                    </Button>
                 </div>
                 {currentBuildingForm.penaltyRules.length === 0 && <p className="text-xs text-muted-foreground">No penalty rules defined. Add rules that will apply sequentially.</p>}

                 {currentBuildingForm.penaltyRules.map((rule, index) => (
                    <div key={rule.id} className="p-3 border rounded-md space-y-2 bg-secondary/30 relative">
                        <p className="text-xs font-semibold text-muted-foreground">Rule {index + 1}{index === currentBuildingForm.penaltyRules.length - 1 ? " (Applies indefinitely from its start)" : ""}</p>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                                <Label htmlFor={`ruleDays-${rule.id}`}>Duration (Days)</Label>
                                <Input id={`ruleDays-${rule.id}`} type="number" min="1" placeholder="e.g., 5" 
                                       value={rule.days ?? ''} 
                                       onChange={(e) => handlePenaltyRuleChange(rule.id, 'days', e.target.value)} 
                                       className="mt-1"/>
                                <p className="text-xs text-muted-foreground mt-0.5">For how many days this rule applies.</p>
                            </div>
                            <div>
                                <Label htmlFor={`ruleFeeType-${rule.id}`}>Fee Type</Label>
                                <Select value={rule.feeType || 'Fixed'} onValueChange={(value) => handlePenaltyRuleChange(rule.id, 'feeType', value as any)}>
                                    <SelectTrigger id={`ruleFeeType-${rule.id}`} className="mt-1"><SelectValue /></SelectTrigger>
                                    <SelectContent><SelectItem value="Fixed">Fixed</SelectItem><SelectItem value="Percentage">Percentage</SelectItem></SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label htmlFor={`ruleFeeValue-${rule.id}`}>Fee Value</Label>
                                <Input id={`ruleFeeValue-${rule.id}`} type="number" step="0.01" min="0" placeholder="e.g., 50 or 2.5" 
                                       value={rule.feeValue ?? ''} 
                                       onChange={(e) => handlePenaltyRuleChange(rule.id, 'feeValue', e.target.value)} 
                                       className="mt-1"/>
                                <p className="text-xs text-muted-foreground mt-0.5">{rule.feeType === 'Percentage' ? '% of rent' : 'Fixed amount'}</p>
                            </div>
                        </div>
                        <Button type="button" variant="ghost" size="icon" 
                                onClick={() => handleRemovePenaltyRule(rule.id)}
                                className="absolute top-1 right-1 h-7 w-7 text-destructive hover:bg-destructive/10">
                            <Trash2 className="h-4 w-4"/>
                        </Button>
                    </div>
                 ))}
              </div>
            </div>
            <DialogFooter className="mt-4">
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
          {buildings.map((building) => (
            <Card key={building.id} className="flex flex-col justify-between shadow-lg hover:shadow-xl transition-shadow duration-300 transform hover:-translate-y-1">
              <CardHeader>
                <CardTitle className="font-headline text-xl mb-1">{building.name}</CardTitle>
                {building.address && <CardDescription className="text-sm flex items-center"><MapPin className="mr-1.5 h-4 w-4 text-muted-foreground" />{building.address}</CardDescription>}
              </CardHeader>
              <CardContent className="text-sm space-y-2 flex-grow">
                   <p className="text-xs text-muted-foreground">Registered: {format(new Date(building.createdAt), 'PP')}</p>
                   {building.penaltyPolicyTiers && building.penaltyPolicyTiers.length > 0 ? (
                      <div className="mt-2 pt-2 border-t border-border/50 space-y-1.5">
                          <h5 className="text-xs font-semibold text-foreground mb-1">Late Fee Policy:</h5>
                          {building.penaltyPolicyTiers.map((tier, index, arr) => {
                            let tierDurationDesc;
                            if (index === 0) { // First tier
                                tierDurationDesc = `First ${tier.toDay ? tier.toDay - tier.fromDay + 1 : '?'} days (Days ${tier.fromDay}${tier.toDay ? `-${tier.toDay}` : '+'})`;
                            } else if (tier.toDay === null) { // Last tier, indefinite
                                tierDurationDesc = `From Day ${tier.fromDay} onwards`;
                            } else { // Intermediate tier
                                tierDurationDesc = `Next ${tier.toDay - tier.fromDay + 1} days (Days ${tier.fromDay}-${tier.toDay})`;
                            }
                             if (arr.length === 1 && tier.toDay === null) { // Single indefinite tier
                                tierDurationDesc = `From Day ${tier.fromDay} onwards`;
                            }


                            return (
                            <div key={index} className="text-xs p-1.5 bg-secondary/30 rounded-sm">
                                <p className="font-medium">Rule {index + 1}:</p>
                                <p><Clock className="inline mr-1 h-3 w-3 text-primary" />
                                    {tierDurationDesc}
                                </p>
                                <p><DollarSignLucide className="inline mr-1 h-3 w-3 text-primary" />Fee: {tier.feeType === 'Fixed' ? `$${tier.feeValue.toFixed(2)}` : `${tier.feeValue}% of rent`}</p>
                            </div>
                          )})}
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
          ))}
        </div>
      )}
    </div>
  );
}
    
