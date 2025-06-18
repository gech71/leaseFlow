
"use client";

import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/custom/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Building as BuildingIcon, PlusCircle, Edit3, Trash2, MapPin, Clock, Percent, DollarSign as DollarSignLucide, AlertTriangle, ArrowRight } from 'lucide-react';
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

interface BuildingFormState extends Partial<Omit<Building, 'penaltyPolicyTiers'>> {
  tier1_fromDay?: number;
  tier1_toDay?: number | null;
  tier1_feeType?: 'Fixed' | 'Percentage';
  tier1_feeValue?: number;

  tier2_fromDay?: number;
  tier2_toDay?: number | null;
  tier2_feeType?: 'Fixed' | 'Percentage';
  tier2_feeValue?: number;
}


export default function BuildingsPage() {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [isMounted, setIsMounted] = useState(false);
  const { toast } = useToast();

  const [currentBuildingForm, setCurrentBuildingForm] = useState<BuildingFormState>({});
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'add' | 'edit'>('add');
  const [buildingToDelete, setBuildingToDelete] = useState<Building | null>(null);

  useEffect(() => {
    setIsMounted(true);
    setBuildings(getStoredBuildings());
  }, []);

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!currentBuildingForm.name?.trim()) {
      toast({ title: "Error", description: "Building name is required.", variant: "destructive" });
      return;
    }

    const { 
      tier1_fromDay, tier1_toDay, tier1_feeType, tier1_feeValue,
      tier2_fromDay, tier2_toDay, tier2_feeType, tier2_feeValue,
      ...buildingCoreData 
    } = currentBuildingForm;

    const newPenaltyTiers: PenaltyTier[] = [];

    // Process Tier 1
    if (tier1_fromDay !== undefined && tier1_feeType && tier1_feeValue !== undefined) {
      if (tier1_fromDay <= 0) {
        toast({ title: "Error (Tier 1)", description: "'From Day' must be positive.", variant: "destructive" }); return;
      }
      if (tier1_toDay !== undefined && tier1_toDay !== null && tier1_toDay < tier1_fromDay) {
        toast({ title: "Error (Tier 1)", description: "'To Day' cannot be before 'From Day'.", variant: "destructive" }); return;
      }
      if (tier1_feeValue < 0) {
         toast({ title: "Error (Tier 1)", description: "Fee value must be non-negative.", variant: "destructive" }); return;
      }
      newPenaltyTiers.push({
        fromDay: tier1_fromDay,
        toDay: tier1_toDay === undefined || tier1_toDay === null ? null : Number(tier1_toDay),
        feeType: tier1_feeType,
        feeValue: Number(tier1_feeValue),
      });
    } else if (tier1_fromDay || tier1_feeType || tier1_feeValue !== undefined) {
      toast({ title: "Error (Tier 1)", description: "Tier 1 is partially filled. Please complete 'From Day', 'Fee Type', and 'Fee Value' or clear all.", variant: "destructive" }); return;
    }

    // Process Tier 2
    if (tier2_fromDay !== undefined && tier2_feeType && tier2_feeValue !== undefined) {
      if (tier2_fromDay <= 0) {
        toast({ title: "Error (Tier 2)", description: "'From Day' must be positive.", variant: "destructive" }); return;
      }
      if (tier2_toDay !== undefined && tier2_toDay !== null && tier2_toDay < tier2_fromDay) {
        toast({ title: "Error (Tier 2)", description: "'To Day' cannot be before 'From Day'.", variant: "destructive" }); return;
      }
       if (tier2_feeValue < 0) {
         toast({ title: "Error (Tier 2)", description: "Fee value must be non-negative.", variant: "destructive" }); return;
      }
      // Ensure Tier 2 starts after Tier 1 ends (if Tier 1 has an end)
      const lastTier1ToDay = newPenaltyTiers[0]?.toDay;
      if (lastTier1ToDay !== null && lastTier1ToDay !== undefined && tier2_fromDay <= lastTier1ToDay) {
        toast({ title: "Error (Tier 2)", description: "'From Day' must be after Tier 1's 'To Day'.", variant: "destructive" }); return;
      }
      if (newPenaltyTiers.length === 0 && tier2_fromDay) {
          toast({ title: "Error (Tier 2)", description: "Please define Tier 1 before defining Tier 2.", variant: "destructive" }); return;
      }

      newPenaltyTiers.push({
        fromDay: tier2_fromDay,
        toDay: tier2_toDay === undefined || tier2_toDay === null ? null : Number(tier2_toDay),
        feeType: tier2_feeType,
        feeValue: Number(tier2_feeValue),
      });
    } else if (tier2_fromDay || tier2_feeType || tier2_feeValue !== undefined) {
      toast({ title: "Error (Tier 2)", description: "Tier 2 is partially filled. Please complete 'From Day', 'Fee Type', and 'Fee Value' or clear all.", variant: "destructive" }); return;
    }
    
    // Sort tiers by fromDay just in case, though UI should enforce sequence
    newPenaltyTiers.sort((a, b) => a.fromDay - b.fromDay);

    const buildingData: Building = {
      id: formMode === 'add' ? `building-${Date.now()}` : buildingCoreData.id!,
      name: buildingCoreData.name!.trim(),
      address: buildingCoreData.address?.trim() || undefined,
      penaltyPolicyTiers: newPenaltyTiers.length > 0 ? newPenaltyTiers : undefined,
      createdAt: buildingCoreData.createdAt || new Date().toISOString(),
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
    setCurrentBuildingForm({});
  };

  const openAddForm = () => {
    setFormMode('add');
    setCurrentBuildingForm({ tier1_fromDay: 1, tier1_feeType: 'Fixed', tier1_feeValue: 0 });
    setIsFormOpen(true);
  };

  const openEditForm = (building: Building) => {
    setFormMode('edit');
    const tier1 = building.penaltyPolicyTiers?.[0];
    const tier2 = building.penaltyPolicyTiers?.[1];
    setCurrentBuildingForm({ 
      ...building,
      tier1_fromDay: tier1?.fromDay,
      tier1_toDay: tier1?.toDay,
      tier1_feeType: tier1?.feeType,
      tier1_feeValue: tier1?.feeValue,
      tier2_fromDay: tier2?.fromDay,
      tier2_toDay: tier2?.toDay,
      tier2_feeType: tier2?.feeType,
      tier2_feeValue: tier2?.feeValue,
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
        if (!isOpen) setCurrentBuildingForm({});
      }}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="font-headline">{formMode === 'add' ? 'Add New Building' : 'Edit Building'}</DialogTitle>
            <DialogDescription>
              Fill in the details for the building. Click save when you're done. Late fee tiers are sequential.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleFormSubmit}>
            <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto pr-2">
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
              
              {/* Tier 1 Fields */}
              <div className="space-y-3 pt-3 border-t">
                 <h4 className="text-md font-semibold text-foreground">Late Fee Policy - Tier 1</h4>
                 <div className="grid grid-cols-2 gap-3">
                    <div>
                        <Label htmlFor="tier1_fromDay">From Day (Overdue)</Label>
                        <Input id="tier1_fromDay" type="number" min="1" placeholder="e.g., 1" value={currentBuildingForm.tier1_fromDay ?? ''} onChange={(e) => setCurrentBuildingForm(prev => ({ ...prev, tier1_fromDay: e.target.value ? parseInt(e.target.value) : undefined }))} className="mt-1"/>
                        <p className="text-xs text-muted-foreground mt-0.5">Penalty starts this day.</p>
                    </div>
                    <div>
                        <Label htmlFor="tier1_toDay">To Day (Overdue)</Label>
                        <Input id="tier1_toDay" type="number" min={currentBuildingForm.tier1_fromDay || 1} placeholder="e.g., 5 (or blank)" value={currentBuildingForm.tier1_toDay ?? ''} onChange={(e) => setCurrentBuildingForm(prev => ({ ...prev, tier1_toDay: e.target.value ? parseInt(e.target.value) : undefined }))} className="mt-1"/>
                        <p className="text-xs text-muted-foreground mt-0.5">Inclusive. Blank if final.</p>
                    </div>
                 </div>
                 <div className="grid grid-cols-2 gap-3">
                    <div>
                        <Label htmlFor="tier1_feeType">Fee Type</Label>
                        <Select value={currentBuildingForm.tier1_feeType || ''} onValueChange={(value) => setCurrentBuildingForm(prev => ({ ...prev, tier1_feeType: value as any }))}>
                            <SelectTrigger id="tier1_feeType" className="mt-1"><SelectValue placeholder="Select type" /></SelectTrigger>
                            <SelectContent><SelectItem value="Fixed">Fixed</SelectItem><SelectItem value="Percentage">Percentage</SelectItem></SelectContent>
                        </Select>
                    </div>
                    <div>
                        <Label htmlFor="tier1_feeValue">Fee Value</Label>
                        <Input id="tier1_feeValue" type="number" step="0.01" min="0" placeholder="e.g., 50 or 2.5" value={currentBuildingForm.tier1_feeValue ?? ''} onChange={(e) => setCurrentBuildingForm(prev => ({ ...prev, tier1_feeValue: e.target.value ? parseFloat(e.target.value) : undefined }))} className="mt-1"/>
                        <p className="text-xs text-muted-foreground mt-0.5">{currentBuildingForm.tier1_feeType === 'Percentage' ? '% of rent' : 'Fixed amount'}</p>
                    </div>
                 </div>
              </div>

              {/* Tier 2 Fields */}
              <div className="space-y-3 pt-3 border-t">
                 <h4 className="text-md font-semibold text-foreground">Late Fee Policy - Tier 2 (Optional)</h4>
                 <div className="grid grid-cols-2 gap-3">
                    <div>
                        <Label htmlFor="tier2_fromDay">From Day (Overdue)</Label>
                        <Input id="tier2_fromDay" type="number" min={(currentBuildingForm.tier1_toDay || 0) + 1} placeholder="e.g., 6" value={currentBuildingForm.tier2_fromDay ?? ''} onChange={(e) => setCurrentBuildingForm(prev => ({ ...prev, tier2_fromDay: e.target.value ? parseInt(e.target.value) : undefined }))} className="mt-1"/>
                    </div>
                    <div>
                        <Label htmlFor="tier2_toDay">To Day (Overdue)</Label>
                        <Input id="tier2_toDay" type="number" min={currentBuildingForm.tier2_fromDay || 1} placeholder="e.g., 10 (or blank)" value={currentBuildingForm.tier2_toDay ?? ''} onChange={(e) => setCurrentBuildingForm(prev => ({ ...prev, tier2_toDay: e.target.value ? parseInt(e.target.value) : undefined }))} className="mt-1"/>
                    </div>
                 </div>
                 <div className="grid grid-cols-2 gap-3">
                    <div>
                        <Label htmlFor="tier2_feeType">Fee Type</Label>
                        <Select value={currentBuildingForm.tier2_feeType || ''} onValueChange={(value) => setCurrentBuildingForm(prev => ({ ...prev, tier2_feeType: value as any }))}>
                            <SelectTrigger id="tier2_feeType" className="mt-1"><SelectValue placeholder="Select type" /></SelectTrigger>
                            <SelectContent><SelectItem value="Fixed">Fixed</SelectItem><SelectItem value="Percentage">Percentage</SelectItem></SelectContent>
                        </Select>
                    </div>
                    <div>
                        <Label htmlFor="tier2_feeValue">Fee Value</Label>
                        <Input id="tier2_feeValue" type="number" step="0.01" min="0" placeholder="e.g., 100 or 5" value={currentBuildingForm.tier2_feeValue ?? ''} onChange={(e) => setCurrentBuildingForm(prev => ({ ...prev, tier2_feeValue: e.target.value ? parseFloat(e.target.value) : undefined }))} className="mt-1"/>
                         <p className="text-xs text-muted-foreground mt-0.5">{currentBuildingForm.tier2_feeType === 'Percentage' ? '% of rent' : 'Fixed amount'}</p>
                    </div>
                 </div>
                 <p className="text-xs text-muted-foreground italic mt-2">If Tier 2 is filled, ensure 'From Day' is after Tier 1's 'To Day'. Leave Tier 2 'To Day' blank for an ongoing final penalty.</p>
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
                          {building.penaltyPolicyTiers.map((tier, index) => (
                            <div key={index} className="text-xs p-1.5 bg-secondary/30 rounded-sm">
                                <p className="font-medium">Tier {index + 1}:</p>
                                <p><Clock className="inline mr-1 h-3 w-3 text-primary" />
                                    Days {tier.fromDay} 
                                    {tier.toDay ? ` - ${tier.toDay}` : '+'} (overdue)
                                </p>
                                <p><DollarSignLucide className="inline mr-1 h-3 w-3 text-primary" />Fee: {tier.feeType === 'Fixed' ? `$${tier.feeValue.toFixed(2)}` : `${tier.feeValue}% of rent`}</p>
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
          ))}
        </div>
      )}
    </div>
  );
}

    