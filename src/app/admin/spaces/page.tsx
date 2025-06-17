"use client";

import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/custom/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Building2, PlusCircle, Tag, MapPin, Maximize, Percent, DollarSign, Trash2, Edit3 } from 'lucide-react';
import type { Space } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const initialSpaces: Space[] = [
  { id: 'space1', buildingName: 'Sunrise Tower', spaceIdName: 'Unit 101', area: 1200, floor: '10th', utilityRate: 1.0, monthlyRentalPrice: 2500, isOccupied: true, tenantId: 'tenant1', createdAt: new Date().toISOString() },
  { id: 'space2', buildingName: 'Ocean View Plaza', spaceIdName: 'Suite 20A', area: 800, floor: '2nd', utilityRate: 1.0, monthlyRentalPrice: 1800, isOccupied: false, createdAt: new Date().toISOString() },
  { id: 'space3', buildingName: 'Downtown Hub', spaceIdName: 'Office 5B', area: 1500, floor: '5th', utilityRate: 1.0, monthlyRentalPrice: 3200, isOccupied: true, tenantId: 'tenant2', createdAt: new Date().toISOString() },
];

export default function SpacesPage() {
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [isMounted, setIsMounted] = useState(false);
  const { toast } = useToast();

  // Form state for adding/editing a space
  const [currentSpace, setCurrentSpace] = useState<Partial<Space>>({});
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'add' | 'edit'>('add');


  useEffect(() => {
    setIsMounted(true);
    // In a real app, fetch spaces from an API
    setSpaces(initialSpaces);
  }, []);

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const newSpace: Space = {
      id: formMode === 'add' ? `space-${Date.now()}` : currentSpace.id!,
      buildingName: currentSpace.buildingName || 'Default Building',
      spaceIdName: currentSpace.spaceIdName || 'Default Space ID',
      area: Number(currentSpace.area) || 0,
      floor: currentSpace.floor || 'N/A',
      utilityRate: Number(currentSpace.utilityRate) || 1.0,
      monthlyRentalPrice: Number(currentSpace.monthlyRentalPrice) || 0,
      isOccupied: currentSpace.isOccupied || false,
      tenantId: currentSpace.tenantId,
      createdAt: currentSpace.createdAt || new Date().toISOString(),
    };

    if (formMode === 'add') {
      setSpaces(prev => [newSpace, ...prev]);
      toast({ title: "Space Added", description: `${newSpace.spaceIdName} in ${newSpace.buildingName} has been added.` });
    } else {
      setSpaces(prev => prev.map(s => s.id === newSpace.id ? newSpace : s));
      toast({ title: "Space Updated", description: `${newSpace.spaceIdName} has been updated.` });
    }
    setIsFormOpen(false);
    setCurrentSpace({});
  };
  
  const openAddForm = () => {
    setFormMode('add');
    setCurrentSpace({ utilityRate: 1.0 }); // Default utility rate
    setIsFormOpen(true);
  };

  const openEditForm = (space: Space) => {
    setFormMode('edit');
    setCurrentSpace({...space});
    setIsFormOpen(true);
  };

  const handleDeleteSpace = (spaceId: string) => {
    setSpaces(prev => prev.filter(s => s.id !== spaceId));
    toast({ title: "Space Deleted", description: "The space has been removed.", variant: "destructive" });
  };


  if (!isMounted) {
    return <div className="flex justify-center items-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>; // Or a skeleton loader
  }

  return (
    <div className="animate-fadeIn">
      <PageHeader
        title="Manage Spaces"
        icon={Building2}
        description="Add, view, and manage rental spaces."
        actions={
          <Button onClick={openAddForm} className="bg-primary hover:bg-primary/90 text-primary-foreground">
            <PlusCircle className="mr-2 h-5 w-5" /> Add New Space
          </Button>
        }
      />

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
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
                <Input id="buildingName" value={currentSpace.buildingName || ''} onChange={(e) => setCurrentSpace(prev => ({...prev, buildingName: e.target.value}))} className="col-span-3" placeholder="e.g., Sunrise Tower" required />
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
                <Input id="floor" value={currentSpace.floor || ''} onChange={(e) => setCurrentSpace(prev => ({...prev, floor: e.target.value}))} className="col-span-3" placeholder="e.g., 10th, Ground" required />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="utilityRate" className="text-right">Utility Rate (%)</Label>
                <Input id="utilityRate" type="number" step="0.01" value={currentSpace.utilityRate !== undefined ? currentSpace.utilityRate * 100 : ''} onChange={(e) => setCurrentSpace(prev => ({...prev, utilityRate: parseFloat(e.target.value) / 100 }))} className="col-span-3" placeholder="e.g., 100 for 100%" required />
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

      {spaces.length === 0 ? (
        <Card className="text-center py-12 shadow-sm">
          <CardContent>
            <Building2 className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2 font-headline">No Spaces Yet</h3>
            <p className="text-muted-foreground mb-4">Get started by adding your first rental space.</p>
            <Button onClick={openAddForm}>
              <PlusCircle className="mr-2 h-5 w-5" /> Add Space
            </Button>
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
                <div className="flex items-center"><Percent className="mr-2 h-4 w-4 text-primary" /> Utility Rate: {(space.utilityRate * 100).toFixed(0)}%</div>
                <div className="flex items-center"><DollarSign className="mr-2 h-4 w-4 text-primary" /> Rent: ${space.monthlyRentalPrice.toLocaleString()}/month</div>
              </CardContent>
              <CardFooter className="border-t pt-4 flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => openEditForm(space)}>
                  <Edit3 className="mr-1 h-4 w-4" /> Edit
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" disabled={space.isOccupied}>
                      <Trash2 className="mr-1 h-4 w-4" /> Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete the space "{space.spaceIdName}".
                        You can only delete vacant spaces.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDeleteSpace(space.id)} className="bg-destructive hover:bg-destructive/90">
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
