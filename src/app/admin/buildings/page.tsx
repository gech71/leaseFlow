
"use client";

import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/custom/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Building as BuildingIcon, PlusCircle, Edit3, Trash2, MapPin } from 'lucide-react';
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

const getStoredBuildings = (): Building[] => {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('buildings');
    return stored ? JSON.parse(stored) : [];
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

    const newBuildingData: Building = {
      id: formMode === 'add' ? `building-${Date.now()}` : currentBuilding.id!,
      name: currentBuilding.name.trim(),
      address: currentBuilding.address?.trim() || undefined,
      createdAt: currentBuilding.createdAt || new Date().toISOString(),
    };

    let updatedBuildings;
    if (formMode === 'add') {
      updatedBuildings = [newBuildingData, ...buildings];
      toast({ title: "Building Added", description: `${newBuildingData.name} has been added.` });
    } else {
      updatedBuildings = buildings.map(b => b.id === newBuildingData.id ? newBuildingData : b);
      toast({ title: "Building Updated", description: `${newBuildingData.name} has been updated.` });
    }
    setBuildings(updatedBuildings);
    storeBuildings(updatedBuildings);
    setIsFormOpen(false);
    setCurrentBuilding({});
  };

  const openAddForm = () => {
    setFormMode('add');
    setCurrentBuilding({});
    setIsFormOpen(true);
  };

  const openEditForm = (building: Building) => {
    setFormMode('edit');
    setCurrentBuilding({ ...building });
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
        description="Add, view, and manage your property buildings."
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
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="font-headline">{formMode === 'add' ? 'Add New Building' : 'Edit Building'}</DialogTitle>
            <DialogDescription>
              Fill in the details for the building. Click save when you're done.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleFormSubmit}>
            <div className="grid gap-4 py-4">
              <div className="space-y-1.5">
                <Label htmlFor="buildingName" className="flex items-center">
                  <BuildingIcon className="mr-2 h-4 w-4 text-primary" />Building Name
                </Label>
                <Input 
                  id="buildingName" 
                  value={currentBuilding.name || ''} 
                  onChange={(e) => setCurrentBuilding(prev => ({ ...prev, name: e.target.value }))} 
                  placeholder="e.g., Sunrise Tower" 
                  required 
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="buildingAddress" className="flex items-center">
                  <MapPin className="mr-2 h-4 w-4 text-primary" />Address (Optional)
                </Label>
                <Textarea 
                  id="buildingAddress" 
                  value={currentBuilding.address || ''} 
                  onChange={(e) => setCurrentBuilding(prev => ({ ...prev, address: e.target.value }))} 
                  placeholder="e.g., 123 Main St, Anytown, USA" 
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
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
              <CardContent className="text-sm">
                <p className="text-xs text-muted-foreground">Registered: {format(new Date(building.createdAt), 'PP')}</p>
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
