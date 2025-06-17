
"use client";

import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/custom/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, PlusCircle, FileText, Mail, Phone, BedDouble, Trash2, Edit3, AlertTriangle } from 'lucide-react';
import type { Tenant, Space } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// Mock data for spaces - needed to show what space a tenant occupies and to update occupancy
const initialMockSpaces: Space[] = [
  { id: 'space1', buildingName: 'Sunrise Tower', spaceIdName: 'Unit 101', area: 1200, floor: '10th', utilityRate: 1.0, monthlyRentalPrice: 2500, isOccupied: true, tenantId: 'tenant1', createdAt: new Date().toISOString() },
  { id: 'space3', buildingName: 'Downtown Hub', spaceIdName: 'Office 5B', area: 1500, floor: '5th', utilityRate: 1.0, monthlyRentalPrice: 3200, isOccupied: true, tenantId: 'tenant2', createdAt: new Date().toISOString() },
  { id: 'space2', buildingName: 'Ocean View Plaza', spaceIdName: 'Suite 20A', area: 800, floor: '2nd', utilityRate: 1.0, monthlyRentalPrice: 1800, isOccupied: false, createdAt: new Date().toISOString() },
  { id: 'space4', buildingName: 'Tech Park One', spaceIdName: 'Lab 3', area: 2000, floor: '1st', utilityRate: 1.0, monthlyRentalPrice: 4500, isOccupied: false, createdAt: new Date().toISOString() },

];

const initialTenants: Tenant[] = [
  { id: 'tenant1', name: 'Alice Wonderland', email: 'alice@example.com', rentedSpaceId: 'space1', createdAt: new Date().toISOString() },
  { id: 'tenant2', name: 'Bob The Builder', email: 'bob@example.com', rentedSpaceId: 'space3', createdAt: new Date().toISOString() },
  { id: 'tenant3', name: 'Charlie Brown', email: 'charlie@example.com', rentedSpaceId: null, createdAt: new Date().toISOString() }, // Prospective tenant
];

const tenantFormSchema = z.object({
  name: z.string().min(2, { message: "Tenant name must be at least 2 characters." }),
  email: z.string().email({ message: "Please enter a valid email address." }),
  rentedSpaceId: z.string().nullable().optional(),
});
type TenantFormValues = z.infer<typeof tenantFormSchema>;


export default function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>(initialTenants);
  const [spaces, setSpaces] = useState<Space[]>(initialMockSpaces);
  const [isMounted, setIsMounted] = useState(false);
  const { toast } = useToast();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'add' | 'edit'>('add');
  const [currentTenant, setCurrentTenant] = useState<Partial<Tenant> | null>(null);
  const [tenantToDelete, setTenantToDelete] = useState<Tenant | null>(null);

  const form = useForm<TenantFormValues>({
    resolver: zodResolver(tenantFormSchema),
    defaultValues: {
      name: "",
      email: "",
      rentedSpaceId: null,
    },
  });

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const getSpaceDetails = (spaceId: string | null) => {
    if (!spaceId) return "No space assigned";
    const space = spaces.find(s => s.id === spaceId);
    return space ? `${space.spaceIdName}, ${space.buildingName}` : "Unknown Space";
  };
  
  const availableSpacesForAssignment = spaces.filter(s => !s.isOccupied || (formMode === 'edit' && s.id === currentTenant?.rentedSpaceId));

  const handleOpenAddForm = () => {
    setFormMode('add');
    setCurrentTenant(null); // Or an empty tenant object
    form.reset({ name: "", email: "", rentedSpaceId: null });
    setIsFormOpen(true);
  };

  const handleOpenEditForm = (tenant: Tenant) => {
    setFormMode('edit');
    setCurrentTenant(tenant);
    form.reset({
      name: tenant.name,
      email: tenant.email,
      rentedSpaceId: tenant.rentedSpaceId,
    });
    setIsFormOpen(true);
  };

  const handleFormSubmit = (values: TenantFormValues) => {
    const newRentedSpaceId = values.rentedSpaceId || null;
    let oldRentedSpaceIdOfCurrentTenant: string | null | undefined = null;

    if (formMode === 'add') {
      const newTenant: Tenant = {
        id: `tenant-${Date.now()}`,
        ...values,
        rentedSpaceId: newRentedSpaceId,
        createdAt: new Date().toISOString(),
      };
      setTenants(prev => [newTenant, ...prev]);
      toast({ title: "Tenant Added", description: `${newTenant.name} has been added.` });
    } else if (currentTenant && currentTenant.id) {
      oldRentedSpaceIdOfCurrentTenant = currentTenant.rentedSpaceId;
      setTenants(prev => prev.map(t => t.id === currentTenant.id ? { ...t, ...values, rentedSpaceId: newRentedSpaceId } : t));
      toast({ title: "Tenant Updated", description: `${values.name} has been updated.` });
    }

    // Update space occupancy
    setSpaces(prevSpaces => {
      return prevSpaces.map(space => {
        // If the space was previously assigned to this tenant and now it's not (or assigned to a different space)
        if (oldRentedSpaceIdOfCurrentTenant && space.id === oldRentedSpaceIdOfCurrentTenant && space.id !== newRentedSpaceId) {
          return { ...space, isOccupied: false, tenantId: undefined };
        }
        // If this space is newly assigned to the tenant
        if (newRentedSpaceId && space.id === newRentedSpaceId) {
          return { ...space, isOccupied: true, tenantId: currentTenant?.id || `tenant-${Date.now()}` }; // Use existing tenant ID or new one
        }
        return space;
      });
    });

    setIsFormOpen(false);
    setCurrentTenant(null);
  };

  const handleDeleteTenant = () => {
    if (!tenantToDelete) return;

    const spaceIdToVacate = tenantToDelete.rentedSpaceId;

    setTenants(prev => prev.filter(t => t.id !== tenantToDelete.id));
    
    if (spaceIdToVacate) {
      setSpaces(prevSpaces => 
        prevSpaces.map(s => 
          s.id === spaceIdToVacate 
            ? { ...s, isOccupied: false, tenantId: undefined } 
            : s
        )
      );
    }
    
    toast({ title: "Tenant Removed", description: `${tenantToDelete.name} has been removed.`, variant: "destructive" });
    setTenantToDelete(null); // Close dialog
  };


  if (!isMounted) {
     return <div className="flex justify-center items-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;
  }

  return (
    <div className="animate-fadeIn">
      <PageHeader
        title="Manage Tenants"
        icon={Users}
        description="View tenant information and manage lease agreements."
        actions={
          <Button onClick={handleOpenAddForm} className="bg-primary hover:bg-primary/90 text-primary-foreground">
            <PlusCircle className="mr-2 h-5 w-5" /> Add New Tenant
          </Button>
        }
      />

      <Dialog open={isFormOpen} onOpenChange={(isOpen) => {
          setIsFormOpen(isOpen);
          if (!isOpen) {
            form.reset();
            setCurrentTenant(null);
          }
      }}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="font-headline">{formMode === 'add' ? 'Add New Tenant' : 'Edit Tenant'}</DialogTitle>
            <DialogDescription>
              {formMode === 'add' ? "Enter the details for the new tenant." : "Update the tenant's details."}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4 py-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., John Doe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="e.g., john.doe@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="rentedSpaceId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assign Space (Optional)</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value || undefined} value={field.value || undefined}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a space to assign" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="null">No space assigned</SelectItem>
                        {availableSpacesForAssignment.map(space => (
                          <SelectItem key={space.id} value={space.id}>
                            {space.spaceIdName} ({space.buildingName}) - ${space.monthlyRentalPrice}/month
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Select an available space to assign to this tenant.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline">Cancel</Button>
                </DialogClose>
                <Button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground">
                  {formMode === 'add' ? 'Add Tenant' : 'Save Changes'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!tenantToDelete} onOpenChange={() => setTenantToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center"><AlertTriangle className="text-destructive mr-2 h-6 w-6" />Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the tenant "{tenantToDelete?.name}"
              {tenantToDelete?.rentedSpaceId ? ` and mark their space (${getSpaceDetails(tenantToDelete.rentedSpaceId)}) as vacant.` : '.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setTenantToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTenant} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
              Yes, delete tenant
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


      {tenants.length === 0 ? (
         <Card className="text-center py-12 shadow-sm">
          <CardContent>
            <Users className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2 font-headline">No Tenants Yet</h3>
            <p className="text-muted-foreground mb-4">Add tenants by clicking the button above.</p>
             <Button onClick={handleOpenAddForm}>
                <PlusCircle className="mr-2 h-5 w-5" /> Add New Tenant
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {tenants.map((tenant) => (
            <Card key={tenant.id} className="flex flex-col justify-between shadow-lg hover:shadow-xl transition-shadow duration-300 transform hover:-translate-y-1">
              <CardHeader>
                <div className="flex items-center gap-4">
                  <Image src={`https://placehold.co/60x60.png?text=${tenant.name.charAt(0)}`} alt={tenant.name} width={60} height={60} className="rounded-full" data-ai-hint="person avatar"/>
                  <div>
                    <CardTitle className="font-headline text-xl">{tenant.name}</CardTitle>
                    <CardDescription className="text-sm flex items-center"><Mail className="mr-1.5 h-3.5 w-3.5 text-muted-foreground"/>{tenant.email}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm flex-grow">
                <div className="flex items-center">
                  <BedDouble className="mr-2 h-4 w-4 text-primary" /> 
                  Rented Space: {getSpaceDetails(tenant.rentedSpaceId)}
                </div>
                <div className="flex items-center text-muted-foreground">
                  <Phone className="mr-2 h-4 w-4 text-primary" /> Phone: (555) 123-4567
                </div>
                 <p className="text-xs text-muted-foreground pt-2">Joined: {new Date(tenant.createdAt).toLocaleDateString()}</p>
              </CardContent>
              <CardFooter className="border-t pt-4 flex justify-between gap-2">
                 <Button variant="outline" size="sm" onClick={() => toast({title: "View Agreement", description: "Agreement viewing coming soon!"})}>
                  <FileText className="mr-1 h-4 w-4" /> Agreement
                </Button>
                <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenEditForm(tenant)}>
                        <Edit3 className="h-4 w-4 text-blue-600" />
                    </Button>
                    <AlertDialogTrigger asChild>
                         <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setTenantToDelete(tenant)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                    </AlertDialogTrigger>
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}


    