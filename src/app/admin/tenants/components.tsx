
"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation'; 
import { PageHeader } from '@/components/custom/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, PlusCircle, Mail, Phone, BedDouble, Trash2, Edit3, AlertTriangle, UserSquare, Hash, PhoneIncoming, Contact, Eye, Loader2, EyeOff, Search, Lock, Info, Clipboard, CheckCircle } from 'lucide-react';
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
import { Label } from '@/components/ui/label';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { createTenantAction, updateTenantAction, deleteTenantAction } from './actions';
import { format, isAfter, addMonths, parseISO } from 'date-fns';
import { usePermissions } from '@/contexts/PermissionContext';
import { PaginationControls } from '@/components/custom/PaginationControls';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

// Client-side specific types ensuring dates are strings
export interface ClientSpace extends Omit<SpaceTypePrisma, 'createdAt' | 'updatedAt' | 'tenantId'> {
  createdAt: string;
  updatedAt: string;
  tenantId?: string | null; 
}

export interface ClientAgreement extends Omit<AgreementTypePrisma, 'startDate' | 'endDate' | 'nextPaymentDueDate' | 'createdAt' | 'updatedAt' | 'initialPaymentDate' | 'space'> {
  startDate: string;
  endDate?: string | null;
  nextPaymentDueDate: string;
  createdAt: string;
  updatedAt: string;
  initialPaymentDate?: string | null;
  space: ClientSpace | null;
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

const phoneRegex = /^(09|07)\d{8}$/;
const phoneErrorMessage = "Phone number must start with 09 or 07 and be 10 digits long (e.g., 0912345678).";

const tenantFormSchema = z.object({
  name: z.string().min(2, { message: "Tenant name must be at least 2 characters." }),
  email: z.string().email({ message: "Please enter a valid email address." }),
  phone: z.string().regex(phoneRegex, { message: phoneErrorMessage }),
  alternativePhone: z.string().optional().or(z.literal('')).refine(val => !val || phoneRegex.test(val), {
    message: phoneErrorMessage
  }),
  nationalId: z.string().length(12, { message: "National ID must be exactly 12 digits." }).regex(/^\d+$/, { message: "National ID must only contain digits." }),
  representativeName: z.string().optional().or(z.literal('')),
  representativePhone: z.string().optional().or(z.literal('')).refine(val => !val || phoneRegex.test(val), {
    message: phoneErrorMessage
  }),
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
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);


  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(3);

  const { hasPermission, isSuperAdmin } = usePermissions();
  const canCreateTenants = isSuperAdmin || hasPermission('tenant:create');
  const canEditTenants = isSuperAdmin || hasPermission('tenant:edit');
  const canDeleteTenants = isSuperAdmin || hasPermission('tenant:delete');
  const canViewTenants = isSuperAdmin || hasPermission('tenant:view') || canCreateTenants || canEditTenants || canDeleteTenants;

  const form = useForm<TenantFormValues>({
    resolver: zodResolver(tenantFormSchema),
    defaultValues: {
      name: "", email: "", phone: "", alternativePhone: "", nationalId: "", 
      representativeName: "", representativePhone: "",
    },
  });

  const filteredTenants = tenants.filter(tenant =>
    tenant.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tenant.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (tenant.phone && tenant.phone.includes(searchTerm))
  );

  const totalPages = Math.ceil(filteredTenants.length / itemsPerPage);
  
  useEffect(() => {
    setIsMounted(true);
    setTenantsState(initialTenants);
    setSpacesState(initialSpaces);
    setAgreementsState(initialAgreements);
  }, [initialTenants, initialSpaces, initialAgreements]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  useEffect(() => {
    const newTotalPages = Math.ceil(filteredTenants.length / itemsPerPage);
    if (currentPage > newTotalPages && newTotalPages > 0) {
      setCurrentPage(newTotalPages);
    }
  }, [filteredTenants.length, itemsPerPage, currentPage]);
  
  const paginatedTenants = filteredTenants.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleItemsPerPageChange = (newSize: number) => {
    setItemsPerPage(newSize);
    setCurrentPage(1);
  };

  const getSpaceDetails = (space: ClientSpace | null | undefined): string => {
    if (!space) return "No space assigned";
    return `${space.spaceIdName}, ${space.buildingName}`;
  };

  const handleOpenAddForm = () => {
    if (!canCreateTenants) {
      toast({ title: "Permission Denied", description: "You do not have permission to add tenants.", variant: "destructive" });
      return;
    }
    setFormMode('add');
    setCurrentTenantForForm(null); 
    setGeneratedPassword(null);
    form.reset({ 
        name: "", email: "", phone: "", alternativePhone: "", nationalId: "", 
        representativeName: "", representativePhone: "",
    });
    setIsFormOpen(true);
  };

  const handleOpenEditForm = (tenant: TenantWithRelations) => {
     if (!canEditTenants && !canViewTenants) {
      toast({ title: "Permission Denied", description: "You do not have permission to view or edit tenants.", variant: "destructive" });
      return;
    }
    setFormMode('edit');
    setGeneratedPassword(null);
    setCurrentTenantForForm(tenant);
    form.reset({
      name: tenant.name,
      email: tenant.email,
      phone: tenant.phone || "",
      alternativePhone: tenant.alternativePhone || "",
      nationalId: tenant.nationalId || "",
      representativeName: tenant.representativeName || "",
      representativePhone: tenant.representativePhone || "",
    });
    setIsFormOpen(true);
  };

  const handleFormSubmit = async (values: TenantFormValues) => {
    if ((formMode === 'add' && !canCreateTenants) || (formMode === 'edit' && !canEditTenants)) {
      toast({ title: "Permission Denied", description: "You do not have permission to save tenant details.", variant: "destructive" });
      return;
    }
    setIsSaving(true);
    
    let result;
    if (formMode === 'add') {
      const createData = {
        name: values.name,
        email: values.email,
        phone: values.phone,
        alternativePhone: values.alternativePhone || undefined,
        nationalId: values.nationalId || undefined,
        representativeName: values.representativeName || undefined,
        representativePhone: values.representativePhone || undefined,
      };
      result = await createTenantAction(createData);
      if (result.success && result.tempPassword) {
        setGeneratedPassword(result.tempPassword);
      }
    } else if (currentTenantForForm?.id) {
      const updateData = {
        name: values.name,
        email: values.email,
        phone: values.phone,
        alternativePhone: values.alternativePhone || undefined,
        nationalId: values.nationalId || undefined,
        representativeName: values.representativeName || undefined,
        representativePhone: values.representativePhone || undefined,
      };
      result = await updateTenantAction(
        currentTenantForForm.id, 
        updateData as Prisma.TenantUpdateInput
      );
    } else {
      toast({ title: "Error", description: "Tenant ID missing for update.", variant: "destructive"});
      setIsSaving(false);
      return;
    }

    setIsSaving(false);
    if (result.success) {
      // For adding, we don't close the form immediately, we show the password.
      if (formMode === 'add') {
        toast({ title: "Tenant and User Account Created", description: `Please provide the temporary password to ${result.tenant?.name}.` });
      } else {
        toast({ title: "Tenant Updated", description: `${result.tenant?.name}'s details have been saved.` });
        setIsFormOpen(false); // Close form on successful edit
      }
      setCurrentTenantForForm(null);
      form.reset({ name: "", email: "", phone: "" });
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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied!", description: "Password copied to clipboard." });
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
            form.reset({ name: "", email: "", phone: "" });
            setCurrentTenantForForm(null);
            setGeneratedPassword(null);
          }
      }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-headline">{formMode === 'add' ? 'Add New Tenant' : (canEditTenants ? 'Edit Tenant' : 'View Tenant')}</DialogTitle>
            <DialogDescription>
              {formMode === 'add' ? "Enter details to create a tenant profile and a user account for the portal." : (canEditTenants ? "Update the tenant's details." : "Viewing tenant details.")}
            </DialogDescription>
          </DialogHeader>
          
          {generatedPassword ? (
             <div className="space-y-4 py-4 text-center">
                <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
                <h3 className="text-lg font-semibold">Tenant Account Created!</h3>
                <p className="text-muted-foreground text-sm">Please provide the following temporary password to the tenant. They will be required to change it upon their first login.</p>
                <div className="p-3 bg-secondary rounded-md">
                    <Label className="text-xs text-muted-foreground">Temporary Password</Label>
                    <div className="flex items-center justify-center gap-2 mt-1">
                        <p className="text-2xl font-bold font-mono text-primary">{generatedPassword}</p>
                        <Button variant="ghost" size="icon" onClick={() => copyToClipboard(generatedPassword)}>
                            <Clipboard className="h-5 w-5"/>
                        </Button>
                    </div>
                </div>
                 <DialogFooter className="pt-4">
                    <DialogClose asChild>
                        <Button type="button" variant="outline" onClick={() => { setGeneratedPassword(null); setIsFormOpen(false); }}>Done</Button>
                    </DialogClose>
                </DialogFooter>
            </div>
          ) : (
             <Form {...form}>
              <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-3 py-2 max-h-[70vh] overflow-y-auto pr-2">
                <FormField control={form.control} name="name" render={({ field }) => ( <FormItem> <FormLabel className="flex items-center"><UserSquare className="mr-2 h-4 w-4 text-primary" />Name<span className="text-destructive ml-1">*</span></FormLabel> <FormControl><Input placeholder="Full Name" {...field} disabled={isSaving || !canEditTenants && formMode ==='edit'}/></FormControl> <FormMessage /> </FormItem> )}/>
                <FormField control={form.control} name="email" render={({ field }) => ( <FormItem> <FormLabel className="flex items-center"><Mail className="mr-2 h-4 w-4 text-primary" />Email<span className="text-destructive ml-1">*</span></FormLabel> <FormControl><Input type="email" placeholder="Email Address" {...field} disabled={isSaving || !canEditTenants && formMode ==='edit'}/></FormControl> <FormMessage /> </FormItem> )}/>
                <FormField control={form.control} name="phone" render={({ field }) => ( <FormItem> <FormLabel className="flex items-center"><Phone className="mr-2 h-4 w-4 text-primary" />Phone Number<span className="text-destructive ml-1">*</span></FormLabel> <FormControl><Input type="tel" placeholder="Phone Number" {...field} value={field.value ?? ""} disabled={isSaving || !canEditTenants && formMode ==='edit'}/></FormControl> <FormMessage /> </FormItem> )}/>
                
                <FormField control={form.control} name="alternativePhone" render={({ field }) => ( <FormItem> <FormLabel className="flex items-center"><PhoneIncoming className="mr-2 h-4 w-4 text-primary" />Alternative Phone</FormLabel> <FormControl><Input type="tel" placeholder="Alternative Phone Number" {...field} value={field.value ?? ""} disabled={isSaving || !canEditTenants && formMode ==='edit'}/></FormControl> <FormMessage /> </FormItem> )}/>
                <FormField control={form.control} name="nationalId" render={({ field }) => ( <FormItem> <FormLabel className="flex items-center"><Hash className="mr-2 h-4 w-4 text-primary" />National ID Number<span className="text-destructive ml-1">*</span></FormLabel> <FormControl><Input placeholder="National ID Number" {...field} value={field.value ?? ""} disabled={isSaving || !canEditTenants && formMode ==='edit'}/></FormControl> <FormMessage /> </FormItem> )}/>
                <FormField control={form.control} name="representativeName" render={({ field }) => ( <FormItem> <FormLabel className="flex items-center"><Contact className="mr-2 h-4 w-4 text-primary" />Representative Name</FormLabel> <FormControl><Input placeholder="Representative Name" {...field} value={field.value ?? ""} disabled={isSaving || !canEditTenants && formMode ==='edit'}/></FormControl> <FormMessage /> </FormItem> )}/>
                <FormField control={form.control} name="representativePhone" render={({ field }) => ( <FormItem> <FormLabel className="flex items-center"><Phone className="mr-2 h-4 w-4 text-primary" />Representative Phone</FormLabel> <FormControl><Input type="tel" placeholder="Representative Phone Number" {...field} value={field.value ?? ""} disabled={isSaving || !canEditTenants && formMode ==='edit'}/></FormControl> <FormMessage /> </FormItem> )}/>
                
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
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!tenantToDelete} onOpenChange={(open) => { if(!open) setTenantToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center"><AlertTriangle className="text-destructive mr-2 h-6 w-6" />Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the tenant "{tenantToDelete?.name}"
              {tenantToDelete?.rentedSpace ? ` and mark their space (${getSpaceDetails(tenantToDelete.rentedSpace)}) as vacant.` : '.'}
              This will also delete the associated user account from the identity provider.
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

      <Card className="mb-6 shadow-sm">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="Filter by name, email, or phone..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {filteredTenants.length === 0 && !isSaving && isMounted ? ( 
         <Card className="text-center py-12 shadow-sm">
          <CardContent>
            <Users className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2 font-headline">{searchTerm ? 'No Tenants Found' : 'No Tenants Yet'}</h3>
            <p className="text-muted-foreground mb-4">{searchTerm ? 'No tenants match your search.' : 'Add tenants by clicking the button above.'}</p>
            {!searchTerm && canCreateTenants && (
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
              const activeAgreements = tenant.agreements.filter(ag => {
                if (!ag.startDate || !ag.paymentTermMonths) return false;
                const agreementEndDate = addMonths(parseISO(ag.startDate), ag.paymentTermMonths);
                return isAfter(agreementEndDate, new Date());
              });

              const rentedSpaces = [...new Map(activeAgreements.map(ag => ag.space).filter(Boolean).map(space => [space!.id, space])).values()];
              
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
                    <div className="flex items-start">
                        <BedDouble className="mr-2 h-4 w-4 shrink-0 mt-1 text-primary" />
                        <div>
                            <span className="font-medium">Rented Spaces</span>
                             {rentedSpaces.length > 0 ? (
                                <ul className="list-none text-muted-foreground text-xs space-y-0.5 mt-1">
                                    {rentedSpaces.map(space => (
                                        <li key={space!.id}>{space!.spaceIdName}, {space!.buildingName}</li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-xs text-muted-foreground mt-1">No active spaces</p>
                            )}
                        </div>
                    </div>
                     <p className="text-xs text-muted-foreground pt-2">Joined: {tenant.createdAt ? format(parseISO(tenant.createdAt), 'PP') : 'N/A'}</p>
                  </CardContent>
                  <CardFooter className="border-t pt-4">
                    <div className="flex w-full flex-wrap items-center justify-between gap-2">
                      <div>
                        {canViewTenants && tenantActiveAgreement && tenantActiveAgreement.id ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Link href={`/admin/agreements/${tenantActiveAgreement.id}`} passHref>
                                <Button variant="outline" size="sm" disabled={isSaving} className="h-8">
                                    <Eye className="mr-2 h-4 w-4" />
                                    Agreement
                                </Button>
                              </Link>
                            </TooltipTrigger>
                            <TooltipContent><p>View Active Agreement</p></TooltipContent>
                          </Tooltip>
                        ) : (<div/>) /* Spacer */
                        }
                      </div>
                      <div className="flex items-center gap-1">
                        {(canEditTenants || canViewTenants) && (
                           <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenEditForm(tenant)}>
                                {canEditTenants ? <Edit3 className="h-4 w-4 text-blue-600" /> : <Eye className="h-4 w-4 text-blue-600" />}
                                <span className="sr-only">{canEditTenants ? 'Edit Tenant' : 'View Tenant'}</span>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent><p>{canEditTenants ? 'Edit Tenant' : 'View Tenant'}</p></TooltipContent>
                          </Tooltip>
                        )}
                        {canDeleteTenants && (
                           <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setTenantToDelete(tenant)}>
                                <Trash2 className="h-4 w-4" />
                                <span className="sr-only">Delete Tenant</span>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent><p>Delete Tenant</p></TooltipContent>
                          </Tooltip>
                        )}
                      </div>
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
            itemsPerPage={itemsPerPage}
            onItemsPerPageChange={handleItemsPerPageChange}
            className="mt-8"
          />
        </>
      )}
    </div>
  );
}
