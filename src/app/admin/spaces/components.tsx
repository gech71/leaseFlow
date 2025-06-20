
"use client";

import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/custom/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Building2, PlusCircle, MapPin, Maximize, Percent, DollarSign, Trash2, Edit3, Loader2 } from 'lucide-react';
import type { Building as BuildingTypePrisma, Space as SpaceTypePrisma, Prisma } from '@prisma/client';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createSpaceAction, updateSpaceAction, deleteSpaceAction } from './actions';
// Removed: import { databaseService } from '@/lib/services/databaseService'; // Prisma should not be in client components

export interface SpaceWithBuildingName extends SpaceTypePrisma {
  buildingName: string; 
  createdAt: string; // Ensure this is string if serialized
  updatedAt: string; // Ensure this is string if serialized
}

export function SpacesClientPage({ initialSpaces, initialBuildings }: { initialSpaces: SpaceWithBuildingName[], initialBuildings: BuildingTypePrisma[] }) {
  const [spaces, setSpaces] = useState<SpaceWithBuildingName[]>(initialSpaces);
  const [buildings, setBuildings] = useState<BuildingTypePrisma[]>(initialBuildings);
  const [isMounted, setIsMounted] = useState(false);
  const { toast } = useToast();

  const [currentSpaceData, setCurrentSpaceData] = useState<Partial<SpaceTypePrisma & { buildingName?: string }>>({});
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'add' | 'edit'>('add');
  const [spaceToDelete, setSpaceToDelete] = useState<SpaceWithBuildingName | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    // Update client state if initial props change (e.g., after server action revalidation)
    setSpaces(initialSpaces); 
    setBuildings(initialBuildings);
  }, [initialSpaces, initialBuildings]);


  const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSaving(true);

    if (!currentSpaceData.buildingId) {
      toast({ title: "Validation Error", description: "Please select a building.", variant: "destructive" });
      setIsSaving(false);
      return;
    }
    if (!currentSpaceData.spaceIdName?.trim()) {
      toast({ title: "Validation Error", description: "Space ID/Name is required.", variant: "destructive" });
      setIsSaving(false);
      return;
    }
    if (currentSpaceData.area === undefined || currentSpaceData.area <= 0) {
      toast({ title: "Validation Error", description: "Area must be a positive number.", variant: "destructive" });
      setIsSaving(false);
      return;
    }
    const prorationShareValue = currentSpaceData.utilityProrationShare;
    if (prorationShareValue === undefined || prorationShareValue < 0 || prorationShareValue > 1) {
      toast({ title: "Validation Error", description: "Proration share must be between 0 and 1 (e.g., 0.1 for 10%).", variant: "destructive" });
      setIsSaving(false);
      return;
    }
    if (currentSpaceData.monthlyRentalPrice === undefined || currentSpaceData.monthlyRentalPrice <= 0) {
      toast({ title: "Validation Error", description: "Monthly rent must be a positive number.", variant: "destructive" });
      setIsSaving(false);
      return;
    }

    const selectedBuilding = buildings.find(b => b.id === currentSpaceData.buildingId);

    const spaceInputData = {
      buildingId: currentSpaceData.buildingId!,
      buildingName: selectedBuilding?.name || 'Unknown Building',
      spaceIdName: currentSpaceData.spaceIdName.trim(),
      area: Number(currentSpaceData.area),
      floor: currentSpaceData.floor || 'N/A',
      utilityProrationShare: Number(prorationShareValue),
      monthlyRentalPrice: Number(currentSpaceData.monthlyRentalPrice),
      isOccupied: currentSpaceData.isOccupied || false,
      tenantId: currentSpaceData.tenantId || null,
    };

    let result;
    if (formMode === 'add') {
      result = await createSpaceAction(spaceInputData);
    } else {
      if (!currentSpaceData.id) {
        toast({ title: "Error", description: "Space ID is missing for update.", variant: "destructive" });
        setIsSaving(false);
        return;
      }
      const updatePayload: Prisma.SpaceUpdateInput = {
        building: { connect: { id: spaceInputData.buildingId } },
        buildingName: spaceInputData.buildingName,
        spaceIdName: spaceInputData.spaceIdName,
        area: spaceInputData.area,
        floor: spaceInputData.floor,
        utilityProrationShare: spaceInputData.utilityProrationShare,
        monthlyRentalPrice: spaceInputData.monthlyRentalPrice,
      };
      result = await updateSpaceAction(currentSpaceData.id, updatePayload);
    }
    setIsSaving(false);

    if (result.success) {
      toast({ title: `Space ${formMode === 'add' ? 'Added' : 'Updated'}`, description: `${result.space?.spaceIdName} has been saved.` });
      setIsFormOpen(false);
      setCurrentSpaceData({});
      // Data refresh will be handled by revalidatePath in server actions.
      // For immediate client-side update, you might optimistically update `spaces` state
      // or wait for Next.js to re-render with fresh props from revalidation.
    } else {
      toast({ title: `Error ${formMode === 'add' ? 'Adding' : 'Updating'} Space`, description: result.error, variant: "destructive" });
    }
  };
  
  const openAddForm = () => {
    if (buildings.length === 0) {
      toast({ title: "No Buildings Found", description: "Please add a building first before adding spaces.", variant: "destructive"});
      return;
    }
    setFormMode('add');
    setCurrentSpaceData({ utilityProrationShare: 0.1, buildingId: buildings[0]?.id || "" }); 
    setIsFormOpen(true);
  };

  const openEditForm = (space: SpaceWithBuildingName) => {
    setFormMode('edit');
    setCurrentSpaceData({
      ...space,
      // Ensure all fields expected by the form are present, converting types if necessary
      utilityProrationShare: Number(space.utilityProrationShare), 
      area: Number(space.area),
      monthlyRentalPrice: Number(space.monthlyRentalPrice),
    });
    setIsFormOpen(true);
  };

  const handleDeleteSpace = async () => {
    if (!spaceToDelete) return;
    setIsSaving(true);
    const result = await deleteSpaceAction(spaceToDelete.id);
    setIsSaving(false);
    if (result.success) {
      toast({ title: "Space Deleted", description: "The space has been removed."});
      setSpaceToDelete(null);
      // Data refresh handled by revalidatePath.
    } else {
      toast({ title: "Error Deleting Space", description: result.error, variant: "destructive" });
    }
  };

  if (!isMounted) {
    return <div className="flex justify-center items-center h-screen"><Loader2 className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"/></div>;
  }

  return (
    <div className="animate-fadeIn">
      <PageHeader
        title="Manage Spaces"
        icon={Building2}
        description="Add, view, and manage rental spaces."
        actions={
          <Button onClick={openAddForm} className="bg-primary hover:bg-primary/90 text-primary-foreground" disabled={buildings.length === 0 || isSaving}>
            <PlusCircle className="mr-2 h-5 w-5" /> Add New Space
          </Button>
        }
      />
       {buildings.length === 0 && isMounted && ( // Check isMounted here too
        <Card className="mb-6 bg-yellow-50 border-yellow-300">
          <CardHeader>
            <CardTitle className="text-yellow-700">No Buildings Found</CardTitle>
            <CardDescription className="text-yellow-600">
              You need to add buildings before you can add spaces. Please go to the "Buildings" page to register a building.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <Dialog open={isFormOpen} onOpenChange={(isOpen) => {
        setIsFormOpen(isOpen);
        if (!isOpen) setCurrentSpaceData({});
      }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-headline">{formMode === 'add' ? 'Add New Space' : 'Edit Space'}</DialogTitle>
            <DialogDescription>
              Fill in the details for the rental space. Click save when you're done.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleFormSubmit}>
            <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto pr-2">
              <div>
                <Label htmlFor="buildingId">Building</Label>
                <Select 
                  value={currentSpaceData.buildingId || ""}
                  onValueChange={(value) => setCurrentSpaceData(prev => ({...prev, buildingId: value}))}
                  required
                  disabled={isSaving}
                >
                  <SelectTrigger id="buildingId" className="mt-1">
                    <SelectValue placeholder="Select a building" />
                  </SelectTrigger>
                  <SelectContent>
                    {buildings.map(building => (
                      <SelectItem key={building.id} value={building.id}>
                        {building.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="spaceIdName">Space ID/Name</Label>
                <Input id="spaceIdName" value={currentSpaceData.spaceIdName || ''} onChange={(e) => setCurrentSpaceData(prev => ({...prev, spaceIdName: e.target.value}))} className="mt-1" placeholder="e.g., Unit 10A, Suite 200" required disabled={isSaving}/>
              </div>
              <div>
                <Label htmlFor="area">Area (sq ft)</Label>
                <Input id="area" type="number" value={currentSpaceData.area || ''} onChange={(e) => setCurrentSpaceData(prev => ({...prev, area: parseFloat(e.target.value)}))} className="mt-1" placeholder="e.g., 1200" required disabled={isSaving}/>
              </div>
              <div>
                <Label htmlFor="floor">Floor</Label>
                <Input id="floor" value={currentSpaceData.floor || ''} onChange={(e) => setCurrentSpaceData(prev => ({...prev, floor: e.target.value}))} className="mt-1" placeholder="e.g., 10th, Ground" disabled={isSaving}/>
              </div>
              <div>
                <Label htmlFor="utilityProrationShare">Proration Share (e.g., 10 for 10%)</Label>
                <Input 
                    id="utilityProrationShare" 
                    type="number" 
                    step="0.01" 
                    min="0" max="100"
                    value={currentSpaceData.utilityProrationShare !== undefined ? (Number(currentSpaceData.utilityProrationShare) * 100).toFixed(2) : ''} 
                    onChange={(e) => {
                        const percentageValue = parseFloat(e.target.value);
                        if (!isNaN(percentageValue)) {
                            setCurrentSpaceData(prev => ({...prev, utilityProrationShare: percentageValue / 100 }));
                        } else {
                            setCurrentSpaceData(prev => ({...prev, utilityProrationShare: undefined }));
                        }
                    }}
                    className="mt-1" 
                    placeholder="e.g., 10 for 10%" 
                    required 
                    disabled={isSaving}
                />
              </div>
              <div>
                <Label htmlFor="monthlyRentalPrice">Monthly Rent</Label>
                <Input id="monthlyRentalPrice" type="number" value={currentSpaceData.monthlyRentalPrice || ''} onChange={(e) => setCurrentSpaceData(prev => ({...prev, monthlyRentalPrice: parseFloat(e.target.value)}))} className="mt-1" placeholder="e.g., 2500" required disabled={isSaving}/>
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={isSaving}>Cancel</Button>
              </DialogClose>
              <Button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isSaving}>
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {formMode === 'add' ? 'Add Space' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!spaceToDelete} onOpenChange={(open) => { if (!open) setSpaceToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the space "{spaceToDelete?.spaceIdName}".
              Ensure the space is not occupied and has no active agreements.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSpaceToDelete(null)} disabled={isSaving}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteSpace} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground" disabled={isSaving}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Delete Space
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {spaces.length === 0 && isMounted ? ( // Check isMounted
        <Card className="text-center py-12 shadow-sm">
          <CardContent>
            <Building2 className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2 font-headline">No Spaces Yet</h3>
            <p className="text-muted-foreground mb-4">
              {buildings.length > 0 ? "Get started by adding your first rental space." : "Please add buildings first."}
            </p>
            {buildings.length > 0 && (
                <Button onClick={openAddForm} disabled={isSaving}>
                    <PlusCircle className="mr-2 h-5 w-5" /> Add Space
                </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {spaces.map((space) => (
            <Card key={space.id} className="flex flex-col justify-between shadow-lg hover:shadow-xl transition-shadow duration-300 transform hover:-translate-y-1">
              <CardHeader>
                <div className="flex flex-col sm:flex-row justify-between items-start gap-2">
                  <div>
                    <CardTitle className="font-headline text-xl mb-1">{space.spaceIdName}</CardTitle>
                    <CardDescription className="text-sm">{space.buildingName}</CardDescription>
                  </div>
                  <span className={`px-2 py-1 text-xs rounded-full self-start sm:self-center ${space.isOccupied ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                    {space.isOccupied ? 'Occupied' : 'Vacant'}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center"><MapPin className="mr-2 h-4 w-4 text-primary" /> Floor: {space.floor}</div>
                <div className="flex items-center"><Maximize className="mr-2 h-4 w-4 text-primary" /> Area: {space.area} sq ft</div>
                <div className="flex items-center"><Percent className="mr-2 h-4 w-4 text-primary" /> Proration Share: {(Number(space.utilityProrationShare) * 100).toFixed(0)}%</div>
                <div className="flex items-center"><DollarSign className="mr-2 h-4 w-4 text-primary" /> Rent: ${Number(space.monthlyRentalPrice).toLocaleString()}/month</div>
              </CardContent>
              <CardFooter className="border-t pt-4 flex flex-col sm:flex-row justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => openEditForm(space)} className="w-full sm:w-auto" disabled={isSaving}>
                  <Edit3 className="mr-1 h-4 w-4" /> Edit
                </Button>
                <Button variant="destructive" size="sm" onClick={() => setSpaceToDelete(space)} disabled={space.isOccupied || isSaving} className="w-full sm:w-auto">
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
