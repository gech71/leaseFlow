
"use client";

import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/custom/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Building2, PlusCircle, MapPin, Maximize, Percent, DollarSign, Trash2, Edit3 } from 'lucide-react';
import type { Space, Building } from '@/lib/types'; // Added Building
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'; // Added Select

const getStoredSpaces = (): Space[] => {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('spaces');
    return stored ? JSON.parse(stored) : [];
  }
  return [];
};

const storeSpaces = (spaces: Space[]) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('spaces', JSON.stringify(spaces));
  }
};

const getStoredBuildings = (): Building[] => {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('buildings');
    return stored ? JSON.parse(stored) : [];
  }
  return [];
};


export default function SpacesPage() {
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]); // State for buildings
  const [isMounted, setIsMounted] = useState(false);
  const { toast } = useToast();

  const [currentSpace, setCurrentSpace] = useState<Partial<Space>>({});
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'add' | 'edit'>('add');
  const [spaceToDelete, setSpaceToDelete] = useState<Space | null>(null);


  useEffect(() => {
    setIsMounted(true);
    setSpaces(getStoredSpaces());
    setBuildings(getStoredBuildings());
  }, []);

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!currentSpace.buildingName) {
      toast({ title: "Error", description: "Please select a building.", variant: "destructive" });
      return;
    }
    if (!currentSpace.spaceIdName?.trim()) {
      toast({ title: "Error", description: "Space ID/Name is required.", variant: "destructive" });
      return;
    }
     if (currentSpace.area === undefined || currentSpace.area <= 0) {
      toast({ title: "Error", description: "Area must be a positive number.", variant: "destructive" });
      return;
    }
    if (currentSpace.utilityProrationShare === undefined || currentSpace.utilityProrationShare < 0 || currentSpace.utilityProrationShare > 1) {
      toast({ title: "Error", description: "Proration share must be between 0% and 100%.", variant: "destructive" });
      return;
    }
     if (currentSpace.monthlyRentalPrice === undefined || currentSpace.monthlyRentalPrice <= 0) {
      toast({ title: "Error", description: "Monthly rent must be a positive number.", variant: "destructive" });
      return;
    }


    const newSpaceData: Space = {
      id: formMode === 'add' ? `space-${Date.now()}` : currentSpace.id!,
      buildingName: currentSpace.buildingName,
      spaceIdName: currentSpace.spaceIdName.trim(),
      area: Number(currentSpace.area),
      floor: currentSpace.floor || 'N/A',
      utilityProrationShare: Number(currentSpace.utilityProrationShare),
      monthlyRentalPrice: Number(currentSpace.monthlyRentalPrice),
      isOccupied: currentSpace.isOccupied || false,
      tenantId: currentSpace.tenantId,
      createdAt: currentSpace.createdAt || new Date().toISOString(),
    };

    let updatedSpaces;
    if (formMode === 'add') {
      updatedSpaces = [newSpaceData, ...spaces];
      toast({ title: "Space Added", description: `${newSpaceData.spaceIdName} in ${newSpaceData.buildingName} has been added.` });
    } else {
      updatedSpaces = spaces.map(s => s.id === newSpaceData.id ? newSpaceData : s);
      toast({ title: "Space Updated", description: `${newSpaceData.spaceIdName} has been updated.` });
    }
    setSpaces(updatedSpaces);
    storeSpaces(updatedSpaces);
    setIsFormOpen(false);
    setCurrentSpace({});
  };
  
  const openAddForm = () => {
    if (buildings.length === 0) {
      toast({ title: "No Buildings Found", description: "Please add a building first before adding spaces.", variant: "destructive"});
      return;
    }
    setFormMode('add');
    setCurrentSpace({ utilityProrationShare: 0.1, buildingName: buildings[0]?.name || "" }); 
    setIsFormOpen(true);
  };

  const openEditForm = (space: Space) => {
    setFormMode('edit');
    setCurrentSpace({...space});
    setIsFormOpen(true);
  };

  const handleDeleteSpace = () => {
    if (!spaceToDelete) return;
    const updatedSpaces = spaces.filter(s => s.id !== spaceToDelete.id);
    setSpaces(updatedSpaces);
    storeSpaces(updatedSpaces);
    toast({ title: "Space Deleted", description: "The space has been removed.", variant: "destructive" });
    setSpaceToDelete(null);
  };


  if (!isMounted) {
    return <div className="flex justify-center items-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;
  }

  return (
    <div className="animate-fadeIn">
      <PageHeader
        title="Manage Spaces"
        icon={Building2}
        description="Add, view, and manage rental spaces."
        actions={
          <Button onClick={openAddForm} className="bg-primary hover:bg-primary/90 text-primary-foreground" disabled={buildings.length === 0}>
            <PlusCircle className="mr-2 h-5 w-5" /> Add New Space
          </Button>
        }
      />
       {buildings.length === 0 && (
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
        if (!isOpen) setCurrentSpace({});
      }}>
        <DialogContent className="sm:max-w-[525px]">
          <DialogHeader>
            <DialogTitle className="font-headline">{formMode === 'add' ? 'Add New Space' : 'Edit Space'}</DialogTitle>
            <DialogDescription>
              Fill in the details for the rental space. Click save when you're done.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleFormSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="buildingName" className="text-right">Building</Label>
                <Select 
                  value={currentSpace.buildingName || ""}
                  onValueChange={(value) => setCurrentSpace(prev => ({...prev, buildingName: value}))}
                  required
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select a building" />
                  </SelectTrigger>
                  <SelectContent>
                    {buildings.map(building => (
                      <SelectItem key={building.id} value={building.name}>
                        {building.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="spaceIdName" className="text-right">Space ID/Name</Label>
                <Input id="spaceIdName" value={currentSpace.spaceIdName || ''} onChange={(e) => setCurrentSpace(prev => ({...prev, spaceIdName: e.target.value}))} className="col-span-3" placeholder="e.g., Unit 10A, Suite 200" required />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="area" className="text-right">Area (sq ft)</Label>
                <Input id="area" type="number" value={currentSpace.area || ''} onChange={(e) => setCurrentSpace(prev => ({...prev, area: parseFloat(e.target.value)}))} className="col-span-3" placeholder="e.g., 1200" required />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="floor" className="text-right">Floor</Label>
                <Input id="floor" value={currentSpace.floor || ''} onChange={(e) => setCurrentSpace(prev => ({...prev, floor: e.target.value}))} className="col-span-3" placeholder="e.g., 10th, Ground" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="utilityProrationShare" className="text-right">Proration Share (%)</Label>
                <Input id="utilityProrationShare" type="number" step="0.01" value={currentSpace.utilityProrationShare !== undefined ? currentSpace.utilityProrationShare * 100 : ''} onChange={(e) => setCurrentSpace(prev => ({...prev, utilityProrationShare: parseFloat(e.target.value) / 100 }))} className="col-span-3" placeholder="e.g., 10 for 10%" required />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="monthlyRentalPrice" className="text-right">Monthly Rent</Label>
                <Input id="monthlyRentalPrice" type="number" value={currentSpace.monthlyRentalPrice || ''} onChange={(e) => setCurrentSpace(prev => ({...prev, monthlyRentalPrice: parseFloat(e.target.value)}))} className="col-span-3" placeholder="e.g., 2500" required />
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">Cancel</Button>
              </DialogClose>
              <Button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground">{formMode === 'add' ? 'Add Space' : 'Save Changes'}</Button>
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
              You can only delete vacant spaces. If this space is occupied, please vacate it first.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSpaceToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteSpace} className="bg-destructive hover:bg-destructive/90">
              Delete Space
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {spaces.length === 0 ? (
        <Card className="text-center py-12 shadow-sm">
          <CardContent>
            <Building2 className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2 font-headline">No Spaces Yet</h3>
            <p className="text-muted-foreground mb-4">
              {buildings.length > 0 ? "Get started by adding your first rental space." : "Please add buildings first."}
            </p>
            {buildings.length > 0 && (
                <Button onClick={openAddForm}>
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
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="font-headline text-xl mb-1">{space.spaceIdName}</CardTitle>
                    <CardDescription className="text-sm">{space.buildingName}</CardDescription>
                  </div>
                  <span className={`px-2 py-1 text-xs rounded-full ${space.isOccupied ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                    {space.isOccupied ? 'Occupied' : 'Vacant'}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center"><MapPin className="mr-2 h-4 w-4 text-primary" /> Floor: {space.floor}</div>
                <div className="flex items-center"><Maximize className="mr-2 h-4 w-4 text-primary" /> Area: {space.area} sq ft</div>
                <div className="flex items-center"><Percent className="mr-2 h-4 w-4 text-primary" /> Proration Share: {(space.utilityProrationShare * 100).toFixed(2)}%</div>
                <div className="flex items-center"><DollarSign className="mr-2 h-4 w-4 text-primary" /> Rent: ${space.monthlyRentalPrice.toLocaleString()}/month</div>
              </CardContent>
              <CardFooter className="border-t pt-4 flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => openEditForm(space)}>
                  <Edit3 className="mr-1 h-4 w-4" /> Edit
                </Button>
                <Button variant="destructive" size="sm" onClick={() => setSpaceToDelete(space)} disabled={space.isOccupied}>
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
