
"use client";

import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/custom/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Building as BuildingIcon, PlusCircle, Edit3, Trash2, MapPin, Clock, Percent, DollarSign as DollarSignLucide, AlertTriangle } from 'lucide-react';
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
  // For UI, we manage a single tier directly
  penaltyStartsFromDay?: number;
  penaltyEndsOnDay?: number | null;
  penaltyFeeType?: 'Fixed' | 'Percentage';
  penaltyFeeValue?: number;
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
      penaltyStartsFromDay, 
      penaltyEndsOnDay, 
      penaltyFeeType, 
      penaltyFeeValue, 
      ...buildingCoreData 
    } = currentBuildingForm;

    let penaltyTiers: PenaltyTier[] = [];

    if (penaltyStartsFromDay !== undefined && penaltyStartsFromDay > 0 && penaltyFeeType && penaltyFeeValue !== undefined && penaltyFeeValue >= 0) {
      if (penaltyStartsFromDay <= 0) {
        toast({ title: "Error", description: "Penalty 'Starts From Day' must be a positive number.", variant: "destructive" });
        return;
      }
      if (penaltyEndsOnDay !== undefined && penaltyEndsOnDay !== null && penaltyEndsOnDay < penaltyStartsFromDay) {
         toast({ title: "Error", description: "Penalty 'Ends On Day' cannot be before 'Starts From Day'.", variant: "destructive" });
        return;
      }
       if (penaltyFeeValue < 0) {
        toast({ title: "Error", description: "Fee value must be a non-negative number.", variant: "destructive" });
        return;
      }
      penaltyTiers.push({
        fromDay: penaltyStartsFromDay,
        toDay: penaltyEndsOnDay === undefined || penaltyEndsOnDay === null ? null : Number(penaltyEndsOnDay),
        feeType: penaltyFeeType,
        feeValue: Number(penaltyFeeValue),
      });
    } else if (penaltyFeeType || penaltyFeeValue !== undefined || penaltyStartsFromDay !== undefined) {
        // If any penalty field is partially filled but not all required ones
        toast({ title: "Error", description: "To set a penalty, 'Starts From Day', 'Fee Type', and 'Fee Value' are required.", variant: "destructive" });
        return;
    }


    const buildingData: Building = {
      id: formMode === 'add' ? `building-${Date.now()}` : buildingCoreData.id!,
      name: buildingCoreData.name!.trim(),
      address: buildingCoreData.address?.trim() || undefined,
      penaltyPolicyTiers: penaltyTiers.length > 0 ? penaltyTiers : undefined,
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
    setCurrentBuildingForm({ penaltyStartsFromDay: 1, penaltyFeeType: 'Fixed', penaltyFeeValue: 0 });
    setIsFormOpen(true);
  };

  const openEditForm = (building: Building) => {
    setFormMode('edit');
    const firstTier = building.penaltyPolicyTiers?.[0];
    setCurrentBuildingForm({ 
      ...building,
      penaltyStartsFromDay: firstTier?.fromDay,
      penaltyEndsOnDay: firstTier?.toDay,
      penaltyFeeType: firstTier?.feeType,
      penaltyFeeValue: firstTier?.feeValue,
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
        description="Add, view, and manage your property buildings, including late fee policies."
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
        <DialogContent className="sm:max-w-[525px]">
          <DialogHeader>
            <DialogTitle className="font-headline">{formMode === 'add' ? 'Add New Building' : 'Edit Building'}</DialogTitle>
            <DialogDescription>
              Fill in the details for the building. Click save when you're done.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleFormSubmit}>
            <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto pr-2">
              <div>
                <Label htmlFor="buildingName" className="flex items-center text-sm font-medium">
                  <BuildingIcon className="mr-2 h-4 w-4 text-primary" />Building Name
                </Label>
                <Input 
                  id="buildingName" 
                  value={currentBuildingForm.name || ''} 
                  onChange={(e) => setCurrentBuildingForm(prev => ({ ...prev, name: e.target.value }))} 
                  placeholder="e.g., Sunrise Tower" 
                  required 
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="buildingAddress" className="flex items-center text-sm font-medium">
                  <MapPin className="mr-2 h-4 w-4 text-primary" />Address (Optional)
                </Label>
                <Textarea 
                  id="buildingAddress" 
                  value={currentBuildingForm.address || ''} 
                  onChange={(e) => setCurrentBuildingForm(prev => ({ ...prev, address: e.target.value }))} 
                  placeholder="e.g., 123 Main St, Anytown, USA" 
                  rows={3}
                  className="mt-1"
                />
              </div>
              
              <div className="space-y-3 pt-3 border-t">
                 <h4 className="text-md font-semibold text-foreground mb-2">Late Fee Policy (Primary Tier)</h4>
                 <p className="text-xs text-muted-foreground -mt-1 mb-3">Define one penalty tier. The system supports multiple, but UI currently allows one. Grace period is implicitly the days before 'Penalty Starts From Day'.</p>
                 
                 <div className="grid grid-cols-2 gap-3">
                    <div>
                        <Label htmlFor="penaltyStartsFromDay" className="flex items-center text-sm font-medium">
                        <Clock className="mr-2 h-4 w-4 text-primary" />Starts From Day
                        </Label>
                        <Input
                        id="penaltyStartsFromDay"
                        type="number"
                        value={currentBuildingForm.penaltyStartsFromDay ?? ''}
                        onChange={(e) => setCurrentBuildingForm(prev => ({ ...prev, penaltyStartsFromDay: e.target.value ? parseInt(e.target.value) : undefined }))}
                        placeholder="e.g., 6 (for 5 grace days)"
                        className="mt-1"
                        min="1"
                        />
                    </div>
                    <div>
                        <Label htmlFor="penaltyEndsOnDay" className="flex items-center text-sm font-medium">
                        <Clock className="mr-2 h-4 w-4 text-primary" />Ends On Day (Optional)
                        </Label>
                        <Input
                        id="penaltyEndsOnDay"
                        type="number"
                        value={currentBuildingForm.penaltyEndsOnDay ?? ''}
                        onChange={(e) => setCurrentBuildingForm(prev => ({ ...prev, penaltyEndsOnDay: e.target.value ? parseInt(e.target.value) : undefined }))}
                        placeholder="e.g., 10 (or blank)"
                        className="mt-1"
                        min={currentBuildingForm.penaltyStartsFromDay || 1}
                        />
                    </div>
                 </div>
                 
                 <div>
                    <Label htmlFor="feeType" className="flex items-center text-sm font-medium mt-2">
                        <Percent className="mr-2 h-4 w-4 text-primary" />Fee Type
                    </Label>
                    <Select
                        value={currentBuildingForm.penaltyFeeType || ''}
                        onValueChange={(value) => setCurrentBuildingForm(prev => ({ ...prev, penaltyFeeType: value as 'Fixed' | 'Percentage' | undefined }))}
                    >
                        <SelectTrigger id="feeType" className="mt-1">
                            <SelectValue placeholder="Select fee type" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Fixed">Fixed Amount</SelectItem>
                            <SelectItem value="Percentage">Percentage of Rent</SelectItem>
                        </SelectContent>
                    </Select>
                 </div>
                 {currentBuildingForm.penaltyFeeType && (
                    <div>
                        <Label htmlFor="feeValue" className="flex items-center text-sm font-medium mt-2">
                        <DollarSignLucide className="mr-2 h-4 w-4 text-primary" />Fee Value
                        </Label>
                        <Input
                        id="feeValue"
                        type="number"
                        step="0.01"
                        value={currentBuildingForm.penaltyFeeValue ?? ''}
                        onChange={(e) => setCurrentBuildingForm(prev => ({ ...prev, penaltyFeeValue: e.target.value ? parseFloat(e.target.value) : undefined }))}
                        placeholder={currentBuildingForm.penaltyFeeType === 'Percentage' ? "e.g., 5 for 5%" : "e.g., 50 for $50"}
                        className="mt-1"
                        min="0"
                        />
                        {currentBuildingForm.penaltyFeeType === 'Percentage' && <p className="text-xs text-muted-foreground mt-1">Enter percentage as a number (e.g., 5 for 5%).</p>}
                    </div>
                 )}
                 {!currentBuildingForm.penaltyFeeType && !currentBuildingForm.penaltyFeeValue && !currentBuildingForm.penaltyStartsFromDay &&
                    <p className="text-xs text-muted-foreground italic mt-2">No penalty policy will be set if fields are left blank.</p>
                 }
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
          {buildings.map((building) => {
            const firstPolicyTier = building.penaltyPolicyTiers?.[0];
            return (
              <Card key={building.id} className="flex flex-col justify-between shadow-lg hover:shadow-xl transition-shadow duration-300 transform hover:-translate-y-1">
                <CardHeader>
                  <CardTitle className="font-headline text-xl mb-1">{building.name}</CardTitle>
                  {building.address && <CardDescription className="text-sm flex items-center"><MapPin className="mr-1.5 h-4 w-4 text-muted-foreground" />{building.address}</CardDescription>}
                </CardHeader>
                <CardContent className="text-sm space-y-2 flex-grow">
                   <p className="text-xs text-muted-foreground">Registered: {format(new Date(building.createdAt), 'PP')}</p>
                   {firstPolicyTier ? (
                      <div className="mt-2 pt-2 border-t border-border/50">
                          <h5 className="text-xs font-semibold text-foreground mb-1">Late Fee Policy (Primary Tier):</h5>
                          <p><Clock className="inline mr-1 h-3 w-3 text-primary" />
                            Applies from Day {firstPolicyTier.fromDay} 
                            {firstPolicyTier.toDay ? ` to Day ${firstPolicyTier.toDay}` : ' onwards'} (overdue)
                          </p>
                          <p><DollarSignLucide className="inline mr-1 h-3 w-3 text-primary" />Fee: {firstPolicyTier.feeType === 'Fixed' ? `$${firstPolicyTier.feeValue.toFixed(2)}` : `${firstPolicyTier.feeValue}% of rent`}</p>
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
            );
          })}
        </div>
      )}
    </div>
  );
}
