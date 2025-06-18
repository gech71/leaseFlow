
"use client";

import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/custom/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Building as BuildingIcon, PlusCircle, Edit3, Trash2, MapPin, Clock, Percent, DollarSign as DollarSignLucide } from 'lucide-react';
import type { Building } from '@/lib/types';
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
        // Ensure penaltyPolicy is correctly parsed or defaulted
        const parsed = JSON.parse(stored) as Building[];
        return parsed.map(b => ({
          ...b,
          penaltyPolicy: b.penaltyPolicy || undefined // Ensure it's undefined if not present
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

export default function BuildingsPage() {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [isMounted, setIsMounted] = useState(false);
  const { toast } = useToast();

  const [currentBuilding, setCurrentBuilding] = useState<Partial<Building>>({});
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'add' | 'edit'>('add');
  const [buildingToDelete, setBuildingToDelete] = useState<Building | null>(null);

  useEffect(() => {
    setIsMounted(true);
    setBuildings(getStoredBuildings());
  }, []);

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!currentBuilding.name?.trim()) {
      toast({ title: "Error", description: "Building name is required.", variant: "destructive" });
      return;
    }

    const gracePeriodDays = currentBuilding.penaltyPolicy?.gracePeriodDays;
    const feeValue = currentBuilding.penaltyPolicy?.feeValue;

    if (gracePeriodDays !== undefined && (isNaN(gracePeriodDays) || gracePeriodDays < 0)) {
        toast({ title: "Error", description: "Grace period must be a non-negative number.", variant: "destructive" });
        return;
    }
    if (feeValue !== undefined && (isNaN(feeValue) || feeValue < 0)) {
        toast({ title: "Error", description: "Fee value must be a non-negative number.", variant: "destructive" });
        return;
    }
    if (currentBuilding.penaltyPolicy?.feeType && feeValue === undefined) {
        toast({ title: "Error", description: "Fee value is required if fee type is selected.", variant: "destructive" });
        return;
    }


    const buildingData: Building = {
      id: formMode === 'add' ? `building-${Date.now()}` : currentBuilding.id!,
      name: currentBuilding.name.trim(),
      address: currentBuilding.address?.trim() || undefined,
      penaltyPolicy: currentBuilding.penaltyPolicy?.feeType // Only save policy if feeType is chosen
        ? {
            gracePeriodDays: Number(currentBuilding.penaltyPolicy.gracePeriodDays || 0),
            feeType: currentBuilding.penaltyPolicy.feeType,
            feeValue: Number(currentBuilding.penaltyPolicy.feeValue || 0),
          }
        : undefined,
      createdAt: currentBuilding.createdAt || new Date().toISOString(),
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
    setCurrentBuilding({});
  };

  const openAddForm = () => {
    setFormMode('add');
    setCurrentBuilding({ penaltyPolicy: { gracePeriodDays: 0, feeType: 'Fixed', feeValue: 0 } });
    setIsFormOpen(true);
  };

  const openEditForm = (building: Building) => {
    setFormMode('edit');
    setCurrentBuilding({ ...building, penaltyPolicy: building.penaltyPolicy || { gracePeriodDays: 0, feeType: 'Fixed', feeValue: 0 } });
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
        if (!isOpen) setCurrentBuilding({});
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
                  value={currentBuilding.name || ''} 
                  onChange={(e) => setCurrentBuilding(prev => ({ ...prev, name: e.target.value }))} 
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
                  value={currentBuilding.address || ''} 
                  onChange={(e) => setCurrentBuilding(prev => ({ ...prev, address: e.target.value }))} 
                  placeholder="e.g., 123 Main St, Anytown, USA" 
                  rows={3}
                  className="mt-1"
                />
              </div>
              
              <div className="space-y-1 pt-2 border-t">
                 <h4 className="text-md font-semibold text-foreground mb-2">Late Fee Policy (Optional)</h4>
                 <div>
                    <Label htmlFor="gracePeriodDays" className="flex items-center text-sm font-medium">
                      <Clock className="mr-2 h-4 w-4 text-primary" />Grace Period (Days)
                    </Label>
                    <Input
                      id="gracePeriodDays"
                      type="number"
                      value={currentBuilding.penaltyPolicy?.gracePeriodDays ?? ''}
                      onChange={(e) => setCurrentBuilding(prev => ({ ...prev, penaltyPolicy: { ...prev.penaltyPolicy!, gracePeriodDays: parseInt(e.target.value) } }))}
                      placeholder="e.g., 5"
                      className="mt-1"
                    />
                 </div>
                 <div>
                    <Label htmlFor="feeType" className="flex items-center text-sm font-medium mt-2">
                        <Percent className="mr-2 h-4 w-4 text-primary" />Fee Type
                    </Label>
                    <Select
                        value={currentBuilding.penaltyPolicy?.feeType || ''}
                        onValueChange={(value) => setCurrentBuilding(prev => ({ ...prev, penaltyPolicy: { ...prev.penaltyPolicy!, feeType: value as 'Fixed' | 'Percentage' } }))}
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
                 <div>
                    <Label htmlFor="feeValue" className="flex items-center text-sm font-medium mt-2">
                      <DollarSignLucide className="mr-2 h-4 w-4 text-primary" />Fee Value
                    </Label>
                    <Input
                      id="feeValue"
                      type="number"
                      step="0.01"
                      value={currentBuilding.penaltyPolicy?.feeValue ?? ''}
                      onChange={(e) => setCurrentBuilding(prev => ({ ...prev, penaltyPolicy: { ...prev.penaltyPolicy!, feeValue: parseFloat(e.target.value) } }))}
                      placeholder={currentBuilding.penaltyPolicy?.feeType === 'Percentage' ? "e.g., 5 for 5%" : "e.g., 50 for $50"}
                      className="mt-1"
                    />
                    {currentBuilding.penaltyPolicy?.feeType === 'Percentage' && <p className="text-xs text-muted-foreground mt-1">Enter percentage as a number (e.g., 5 for 5%).</p>}
                 </div>
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
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the building "{buildingToDelete?.name}".
              Ensure no spaces are currently associated with this building.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setBuildingToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteBuilding} className="bg-destructive hover:bg-destructive/90">
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
              <CardContent className="text-sm space-y-2">
                 <p className="text-xs text-muted-foreground">Registered: {format(new Date(building.createdAt), 'PP')}</p>
                 {building.penaltyPolicy ? (
                    <div className="mt-2 pt-2 border-t border-border/50">
                        <h5 className="text-xs font-semibold text-foreground mb-1">Late Fee Policy:</h5>
                        <p><Clock className="inline mr-1 h-3 w-3 text-primary" />Grace: {building.penaltyPolicy.gracePeriodDays} days</p>
                        <p><DollarSignLucide className="inline mr-1 h-3 w-3 text-primary" />Fee: {building.penaltyPolicy.feeType === 'Fixed' ? `$${building.penaltyPolicy.feeValue.toFixed(2)}` : `${building.penaltyPolicy.feeValue}% of rent`}</p>
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

