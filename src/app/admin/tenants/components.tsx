
"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation'; 
import { PageHeader } from '@/components/custom/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, PlusCircle, Mail, Phone, BedDouble, Trash2, Edit3, AlertTriangle, UserSquare, Hash, PhoneIncoming, Contact, Eye, Loader2, EyeOff } from 'lucide-react';
import type { Tenant as TenantTypePrisma, Space as SpaceTypePrisma, Agreement as AgreementTypePrisma, Prisma } from '@prisma/client';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';
import Link from 'next/link';
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
import { Input } from '@/components/ui/input';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createTenantAction, updateTenantAction, deleteTenantAction } from './actions';
import { format, isAfter, addMonths, parseISO } from 'date-fns';
import { usePermissions } from '@/contexts/PermissionContext';
import { PaginationControls } from '@/components/custom/PaginationControls';

// Client-side specific types ensuring dates are strings
export interface ClientSpace extends Omit<SpaceTypePrisma, 'createdAt' | 'updatedAt' | 'tenantId'> {
  createdAt: string;
  updatedAt: string;
  tenantId?: string | null; 
}

export interface ClientAgreement extends Omit<AgreementTypePrisma, 'startDate' | 'endDate' | 'nextPaymentDueDate' | 'createdAt' | 'updatedAt' | 'initialPaymentDate'> {
  startDate: string;
  endDate?: string | null;
  nextPaymentDueDate: string;
  createdAt: string;
  updatedAt: string;
  initialPaymentDate?: string | null;
}

export interface TenantWithRelations extends Omit<TenantTypePrisma, 'createdAt' | 'updatedAt' | 'rentedSpace' | 'agreements'> {
  createdAt: string;
  updatedAt: string;
  rentedSpace: ClientSpace | null;
  agreements: ClientAgreement[];
}
export interface SpaceWithTenant extends Omit<SpaceTypePrisma, 'createdAt' | 'updatedAt' | 'tenant'> {
  createdAt: string;
  updatedAt: string;
  tenant: (Omit<TenantTypePrisma, 'createdAt' | 'updatedAt' | 'rentedSpaceId'> & { createdAt: string; updatedAt: string; rentedSpaceId?: string | null}) | null;
}


const tenantFormSchema = z.object({
  name: z.string().min(2, { message: "Tenant name must be at least 2 characters." }),
  email: z.string().email({ message: "Please enter a valid email address." }),
  phone: z.string().optional().or(z.literal('')), 
  alternativePhone: z.string().optional().or(z.literal('')),
  nationalId: z.string().optional().or(z.literal('')),
  representativeName: z.string().optional().or(z.literal('')),
  representativePhone: z.string().optional().or(z.literal('')),
  rentedSpaceId: z.string().nullable().optional(), 
});
type TenantFormValues = z.infer<typeof tenantFormSchema>;

export function TenantsClientPage({ 
  initialTenants, 
  initialSpaces,
  initialAgreements 
}: { 
  initialTenants: TenantWithRelations[], 
  initialSpaces: SpaceWithTenant[],
  initialAgreements: ClientAgreement[] 
}) {
  const [tenants, setTenantsState] = useState<TenantWithRelations[]>(initialTenants);
  const [spaces, setSpacesState] = useState<SpaceWithTenant[]>(initialSpaces);
  const [agreements, setAgreementsState] = useState<ClientAgreement[]>(initialAgreements);

  const [isMounted, setIsMounted] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'add' | 'edit'>('add');
  const [currentTenantForForm, setCurrentTenantForForm] = useState<TenantWithRelations | null>(null);
  const [tenantToDelete, setTenantToDelete] = useState<TenantWithRelations | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 6;

  const { hasPermission, isSuperAdmin } = usePermissions();
  const canCreateTenants = isSuperAdmin || hasPermission('tenant:create');
  const canEditTenants = isSuperAdmin || hasPermission('tenant:edit');
  const canDeleteTenants = isSuperAdmin || hasPermission('tenant:delete');
  const canViewTenants = isSuperAdmin || hasPermission('tenant:view') || canCreateTenants || canEditTenants || canDeleteTenants;

  const form = useForm<TenantFormValues>({
    resolver: zodResolver(tenantFormSchema),
    defaultValues: {
      name: "", email: "", phone: "", alternativePhone: "", nationalId: "", 
      representativeName: "", representativePhone: "", rentedSpaceId: null,
    },
  });

  const totalPages = Math.ceil(tenants.length / ITEMS_PER_PAGE);
  const paginatedTenants = tenants.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  useEffect(() => {
    setIsMounted(true);
    setTenantsState(initialTenants);
    setSpacesState(initialSpaces);
    setAgreementsState(initialAgreements);
  }, [initialTenants, initialSpaces, initialAgreements]);


  const getSpaceDetails = (space: ClientSpace | null | undefined): string => {
    if (!space) return "No space assigned";
    return `${space.spaceIdName}, ${space.buildingName}`;
  };
  
  const availableSpacesForAssignment = spaces.filter(s => 
    !s.isOccupied || (formMode === 'edit' && currentTenantForForm?.rentedSpaceId && s.id === currentTenantForForm.rentedSpaceId)
  );

  const handleOpenAddForm = () => {
    if (!canCreateTenants) {
      toast({ title: "Permission Denied", description: "You do not have permission to add tenants.", variant: "destructive" });
      return;
    }
    setFormMode('add');
    setCurrentTenantForForm(null); 
    form.reset({ 
      name: "", email: "", phone: "", alternativePhone: "", nationalId: "", 
      representativeName: "", representativePhone: "", rentedSpaceId: null 
    });
    setIsFormOpen(true);
  };

  const handleOpenEditForm = (tenant: TenantWithRelations) => {
     if (!canEditTenants && !canViewTenants) {
      toast({ title: "Permission Denied", description: "You do not have permission to view or edit tenants.", variant: "destructive" });
      return;
    }
    setFormMode('edit');
    setCurrentTenantForForm(tenant);
    form.reset({
      name: tenant.name,
      email: tenant.email,
      phone: tenant.phone || "",
      alternativePhone: tenant.alternativePhone || "",
      nationalId: tenant.nationalId || "",
      representativeName: tenant.representativeName || "",
      representativePhone: tenant.representativePhone || "",
      rentedSpaceId: tenant.rentedSpaceId || null,
    });
    setIsFormOpen(true);
  };

  const handleFormSubmit = async (values: TenantFormValues) => {
    if ((formMode === 'add' && !canCreateTenants) || (formMode === 'edit' && !canEditTenants)) {
      toast({ title: "Permission Denied", description: "You do not have permission to save tenant details.", variant: "destructive" });
      return;
    }
    setIsSaving(true);
    const newRentedSpaceIdFromForm = values.rentedSpaceId === "null" || values.rentedSpaceId === "" ? null : values.rentedSpaceId;
    
    const tenantInputData = {
      name: values.name,
      email: values.email,
      phone: values.phone || undefined,
      alternativePhone: values.alternativePhone || undefined,
      nationalId: values.nationalId || undefined,
      representativeName: values.representativeName || undefined,
      representativePhone: values.representativePhone || undefined,
    };

    let result;
    if (formMode === 'add') {
      result = await createTenantAction(tenantInputData as Prisma.TenantCreateInput, newRentedSpaceIdFromForm);
    } else if (currentTenantForForm?.id) {
      const oldRentedSpaceId = currentTenantForForm.rentedSpaceId;
      result = await updateTenantAction(
        currentTenantForForm.id, 
        tenantInputData as Prisma.TenantUpdateInput, 
        newRentedSpaceIdFromForm,
        oldRentedSpaceId
      );
    } else {
      toast({ title: "Error", description: "Tenant ID missing for update.", variant: "destructive"});
      setIsSaving(false);
      return;
    }

    setIsSaving(false);
    if (result.success) {
      toast({ title: `Tenant ${formMode === 'add' ? 'Added' : 'Updated'}`, description: `${result.tenant?.name} has been saved.` });
      setIsFormOpen(false);
      setCurrentTenantForForm(null);
      form.reset({ name: "", email: "", phone: "", rentedSpaceId: null });
      router.refresh(); 
    } else {
      toast({ title: `Error ${formMode === 'add' ? 'Adding' : 'Updating'} Tenant`, description: result.error, variant: "destructive" });
    }
  };
  
  const findActiveAgreementForTenant = (tenantId: string): ClientAgreement | undefined => {
    return agreements.find(ag => {
      if (ag.tenantId !== tenantId) return false;
      const agreementEndDate = addMonths(parseISO(ag.startDate), ag.paymentTermMonths);
      return isAfter(agreementEndDate, new Date());
    });
  };

  const handleDeleteTenant = async () => {
    if (!tenantToDelete) return;
    if (!canDeleteTenants) {
      toast({ title: "Permission Denied", description: "You do not have permission to delete tenants.", variant: "destructive" });
      return;
    }
    setIsSaving(true);
    
    const result = await deleteTenantAction(tenantToDelete.id);
    
    setIsSaving(false);
    if (result.success) {
      toast({ title: "Tenant Removed", description: `${tenantToDelete.name} has been removed.`});
      setTenantToDelete(null); 
      router.refresh(); 
    } else {
      toast({ title: "Error Deleting Tenant", description: result.error, variant: "destructive" });
    }
  };

  if (!isMounted) {
     return <div className="flex justify-center items-center h-screen"><Loader2 className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"/></div>;
  }
  
  if (!canViewTenants && isMounted) {
    return (
      <Card className="shadow-lg text-center py-12">
        <CardHeader><CardTitle className="text-destructive flex items-center justify-center"><EyeOff className="mr-2"/>Access Denied</CardTitle></CardHeader>
        <CardContent><p>You do not have permission to view tenants.</p></CardContent>
      </Card>
    );
  }


  return (
    <div className="animate-fadeIn">
      <PageHeader
        title="Manage Tenants"
        icon={Users}
        description="Add, view, and manage tenant information and their assigned spaces."
        actions={
          canCreateTenants && (
            <Button onClick={handleOpenAddForm} className="bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isSaving}>
              <PlusCircle className="mr-2 h-5 w-5" /> Add New Tenant
            </Button>
          )
        }
      />

      <Dialog open={isFormOpen} onOpenChange={(isOpen) => {
          setIsFormOpen(isOpen);
          if (!isOpen) {
            form.reset({ 
                name: "", email: "", phone: "", alternativePhone: "", nationalId: "",
                representativeName: "", representativePhone: "", rentedSpaceId: null 
            });
            setCurrentTenantForForm(null);
          }
      }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-headline">{formMode === 'add' ? 'Add New Tenant' : (canEditTenants ? 'Edit Tenant' : 'View Tenant')}</DialogTitle>
            <DialogDescription>
              {formMode === 'add' ? "Enter the details for the new tenant." : (canEditTenants ? "Update the tenant's details." : "Viewing tenant details.")}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-3 py-2 max-h-[70vh] overflow-y-auto pr-2">
              <FormField control={form.control} name="name" render={({ field }) => ( <FormItem> <FormLabel className="flex items-center"><UserSquare className="mr-2 h-4 w-4 text-primary" />Name</FormLabel> <FormControl><Input placeholder="e.g., John Doe" {...field} disabled={isSaving || !canEditTenants && formMode ==='edit'}/></FormControl> <FormMessage /> </FormItem> )}/>
              <FormField control={form.control} name="email" render={({ field }) => ( <FormItem> <FormLabel className="flex items-center"><Mail className="mr-2 h-4 w-4 text-primary" />Email</FormLabel> <FormControl><Input type="email" placeholder="e.g., john.doe@example.com" {...field} disabled={isSaving || !canEditTenants && formMode ==='edit'}/></FormControl> <FormMessage /> </FormItem> )}/>
              <FormField control={form.control} name="phone" render={({ field }) => ( <FormItem> <FormLabel className="flex items-center"><Phone className="mr-2 h-4 w-4 text-primary" />Phone Number</FormLabel> <FormControl><Input placeholder="e.g., 555-123-4567" {...field} value={field.value ?? ""} disabled={isSaving || !canEditTenants && formMode ==='edit'}/></FormControl> <FormMessage /> </FormItem> )}/>
              <FormField control={form.control} name="alternativePhone" render={({ field }) => ( <FormItem> <FormLabel className="flex items-center"><PhoneIncoming className="mr-2 h-4 w-4 text-primary" />Alternative Phone</FormLabel> <FormControl><Input placeholder="e.g., 555-987-6543" {...field} value={field.value ?? ""} disabled={isSaving || !canEditTenants && formMode ==='edit'}/></FormControl> <FormMessage /> </FormItem> )}/>
              <FormField control={form.control} name="nationalId" render={({ field }) => ( <FormItem> <FormLabel className="flex items-center"><Hash className="mr-2 h-4 w-4 text-primary" />National ID Number</FormLabel> <FormControl><Input placeholder="e.g., AB1234567" {...field} value={field.value ?? ""} disabled={isSaving || !canEditTenants && formMode ==='edit'}/></FormControl> <FormMessage /> </FormItem> )}/>
              <FormField control={form.control} name="representativeName" render={({ field }) => ( <FormItem> <FormLabel className="flex items-center"><Contact className="mr-2 h-4 w-4 text-primary" />Representative Name</FormLabel> <FormControl><Input placeholder="e.g., Jane Smith (Spouse, Agent)" {...field} value={field.value ?? ""} disabled={isSaving || !canEditTenants && formMode ==='edit'}/></FormControl> <FormMessage /> </FormItem> )}/>
              <FormField control={form.control} name="representativePhone" render={({ field }) => ( <FormItem> <FormLabel className="flex items-center"><Phone className="mr-2 h-4 w-4 text-primary" />Representative Phone</FormLabel> <FormControl><Input placeholder="e.g., 555- representative phone" {...field} value={field.value ?? ""} disabled={isSaving || !canEditTenants && formMode ==='edit'}/></FormControl> <FormMessage /> </FormItem> )}/>
              <FormField
                control={form.control}
                name="rentedSpaceId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center"><BedDouble className="mr-2 h-4 w-4 text-primary" />Assign Space (Optional)</FormLabel>
                    <Select 
                      onValueChange={(value) => field.onChange(value === "null" || value === "" ? null : value)} 
                      value={field.value ?? "null"} 
                      disabled={isSaving || !canEditTenants && formMode ==='edit'}
                    >
                      <FormControl><SelectTrigger><SelectValue placeholder="Select a space to assign" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="null">No space assigned / Vacate</SelectItem>
                        {availableSpacesForAssignment.map(space => (
                          <SelectItem key={space.id} value={space.id}>
                            {space.spaceIdName} ({space.buildingName}) - ${Number(space.monthlyRentalPrice).toLocaleString()}/month
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>Select an available space or 'No space assigned' to vacate.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter className="pt-4">
                <DialogClose asChild><Button type="button" variant="outline" disabled={isSaving}>Cancel</Button></DialogClose>
                { ((formMode === 'add' && canCreateTenants) || (formMode === 'edit' && canEditTenants)) && (
                    <Button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isSaving}>
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        {formMode === 'add' ? 'Add Tenant' : 'Save Changes'}
                    </Button>
                )}
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!tenantToDelete} onOpenChange={(open) => { if(!open) setTenantToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center"><AlertTriangle className="text-destructive mr-2 h-6 w-6" />Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the tenant "{tenantToDelete?.name}"
              {tenantToDelete?.rentedSpace ? ` and mark their space (${getSpaceDetails(tenantToDelete.rentedSpace)}) as vacant.` : '.'}
              Check for active agreements before deleting.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setTenantToDelete(null)} disabled={isSaving}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTenant} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground" disabled={isSaving || !canDeleteTenants}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Yes, delete tenant
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {tenants.length === 0 && !isSaving && isMounted ? ( 
         <Card className="text-center py-12 shadow-sm">
          <CardContent>
            <Users className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2 font-headline">No Tenants Yet</h3>
            <p className="text-muted-foreground mb-4">Add tenants by clicking the button above.</p>
            {canCreateTenants && (
                <Button onClick={handleOpenAddForm} disabled={isSaving}>
                    <PlusCircle className="mr-2 h-5 w-5" /> Add New Tenant
                </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {paginatedTenants.map((tenant) => {
              const tenantActiveAgreement = findActiveAgreementForTenant(tenant.id);
              return (
                <Card key={tenant.id} className="flex flex-col justify-between shadow-lg hover:shadow-xl transition-shadow duration-300 transform hover:-translate-y-1">
                  <CardHeader>
                    <div className="flex items-center gap-4">
                      <Image src={`https://placehold.co/60x60.png?text=${tenant.name.charAt(0)}`} alt={tenant.name} width={60} height={60} className="rounded-full" data-ai-hint="person initial"/>
                      <div>
                        <CardTitle className="font-headline text-xl">{tenant.name}</CardTitle>
                        <CardDescription className="text-sm flex items-center"><Mail className="mr-1.5 h-3.5 w-3.5 text-muted-foreground"/>{tenant.email}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm flex-grow">
                    {tenant.phone && (
                      <div className="flex items-center text-muted-foreground">
                        <Phone className="mr-2 h-4 w-4 text-primary" /> Phone: {tenant.phone}
                      </div>
                    )}
                    <div className="flex items-center">
                      <BedDouble className="mr-2 h-4 w-4 text-primary" /> 
                      Rented Space: {getSpaceDetails(tenant.rentedSpace)}
                    </div>
                     <p className="text-xs text-muted-foreground pt-2">Joined: {tenant.createdAt ? format(parseISO(tenant.createdAt), 'PP') : 'N/A'}</p>
                  </CardContent>
                  <CardFooter className="border-t pt-4 flex flex-col items-stretch gap-2 sm:flex-row sm:justify-between sm:items-center">
                     <div className="flex-shrink-0">
                      {canViewTenants && tenantActiveAgreement && tenantActiveAgreement.id ? (
                        <Link href={`/admin/agreements/${tenantActiveAgreement.id}`} passHref>
                          <Button variant="outline" size="sm" disabled={isSaving} className="w-full sm:w-auto">
                            <Eye className="mr-1 h-4 w-4" /> Agreement
                          </Button>
                        </Link>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">{tenantActiveAgreement ? 'View Agreement' : 'No active agreement'}</span>
                      )}
                    </div>
                    <div className="flex gap-1 self-stretch sm:self-center justify-end">
                        {(canEditTenants || canViewTenants) && (
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenEditForm(tenant)} disabled={isSaving}>
                              {canEditTenants ? <Edit3 className="h-4 w-4 text-blue-600" /> : <Eye className="h-4 w-4 text-blue-600" />}
                          </Button>
                        )}
                        {canDeleteTenants && (
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setTenantToDelete(tenant)} disabled={isSaving}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                    </div>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
          <PaginationControls
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            className="mt-8"
          />
        </>
      )}
    </div>
  );
}
