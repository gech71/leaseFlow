
import { PageHeader } from '@/components/custom/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, PlusCircle, Mail, Phone, BedDouble, Trash2, Edit3, AlertTriangle, UserSquare, Hash, PhoneIncoming, Contact, Eye, Loader2 } from 'lucide-react';
import type { Tenant as TenantTypePrisma, Space as SpaceTypePrisma, Agreement as AgreementTypePrisma, Prisma } from '@prisma/client';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';
import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogDescription as DialogPrimitiveDescription, 
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
  AlertDialogDescription as AlertDialogPrimitiveDescription, 
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
import { databaseService } from '@/lib/services/databaseService';
import { createTenantAction, updateTenantAction, deleteTenantAction } from './actions';
import { useState, useEffect } from 'react';
import { format } from 'date-fns';

// Prisma types include relations, which is good.
interface TenantWithRelations extends TenantTypePrisma {
  rentedSpace: SpaceTypePrisma | null;
  agreements: AgreementTypePrisma[];
}
interface SpaceWithTenant extends SpaceTypePrisma {
  tenant: TenantTypePrisma | null;
}

const tenantFormSchema = z.object({
  name: z.string().min(2, { message: "Tenant name must be at least 2 characters." }),
  email: z.string().email({ message: "Please enter a valid email address." }),
  phone: z.string().optional(),
  alternativePhone: z.string().optional(),
  nationalId: z.string().optional(),
  representativeName: z.string().optional(),
  representativePhone: z.string().optional(),
  rentedSpaceId: z.string().nullable().optional(), 
});
type TenantFormValues = z.infer<typeof tenantFormSchema>;

// Client Component Part
function TenantsClientPage({ 
  initialTenants, 
  initialSpaces,
  initialAgreements 
}: { 
  initialTenants: TenantWithRelations[], 
  initialSpaces: SpaceWithTenant[],
  initialAgreements: AgreementTypePrisma[]
}) {
  const [tenants, setTenantsState] = useState<TenantWithRelations[]>(initialTenants);
  const [spaces, setSpacesState] = useState<SpaceWithTenant[]>(initialSpaces);
  // Agreements are mostly for read-only checks here (e.g., active agreement before delete)
  const [agreements, setAgreementsState] = useState<AgreementTypePrisma[]>(initialAgreements);

  const [isMounted, setIsMounted] = useState(false);
  const { toast } = useToast();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'add' | 'edit'>('add');
  const [currentTenantForForm, setCurrentTenantForForm] = useState<TenantWithRelations | null>(null);
  const [tenantToDelete, setTenantToDelete] = useState<TenantWithRelations | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<TenantFormValues>({
    resolver: zodResolver(tenantFormSchema),
    defaultValues: {
      name: "", email: "", phone: "", alternativePhone: "", nationalId: "", 
      representativeName: "", representativePhone: "", rentedSpaceId: null,
    },
  });

  useEffect(() => {
    setIsMounted(true);
    setTenantsState(initialTenants);
    setSpacesState(initialSpaces);
    setAgreementsState(initialAgreements);
  }, [initialTenants, initialSpaces, initialAgreements]);

  const refreshData = async () => {
    // This function could be called to ensure client state matches server after complex ops
    // if revalidatePath isn't sufficient or immediate feedback is needed.
    try {
      setIsSaving(true); // Use isSaving as a general loading indicator
      const fetchedTenants = await databaseService.getAllTenants({ include: { rentedSpace: true, agreements: true }, orderBy: { createdAt: 'desc' } });
      const fetchedSpaces = await databaseService.getAllSpaces({ include: { tenant: true }, orderBy: { buildingName: 'asc', spaceIdName: 'asc' } });
      setTenantsState(fetchedTenants.map(t => ({...t, createdAt: t.createdAt.toISOString(), updatedAt: t.updatedAt.toISOString(), agreements: t.agreements.map(a => ({...a, startDate: a.startDate.toISOString(), nextPaymentDueDate: a.nextPaymentDueDate.toISOString(), createdAt: a.createdAt.toISOString(), updatedAt: a.updatedAt.toISOString()})), rentedSpace: t.rentedSpace ? {...t.rentedSpace, createdAt: t.rentedSpace.createdAt.toISOString(), updatedAt: t.rentedSpace.updatedAt.toISOString()} : null })));
      setSpacesState(fetchedSpaces.map(s => ({...s, createdAt: s.createdAt.toISOString(), updatedAt: s.updatedAt.toISOString(), tenant: s.tenant ? {...s.tenant, createdAt: s.tenant.createdAt.toISOString(), updatedAt: s.tenant.updatedAt.toISOString(), rentedSpaceId: s.tenant.rentedSpaceId || null} : null })));
    } catch (error) {
      toast({ title: "Error", description: "Could not refresh data.", variant: "destructive"});
    } finally {
      setIsSaving(false);
    }
  };


  const getSpaceDetails = (space: SpaceTypePrisma | null | undefined): string => {
    if (!space) return "No space assigned";
    return `${space.spaceIdName}, ${space.buildingName}`;
  };
  
  const availableSpacesForAssignment = spaces.filter(s => 
    !s.isOccupied || (formMode === 'edit' && currentTenantForForm?.rentedSpaceId && s.id === currentTenantForForm.rentedSpaceId)
  );

  const handleOpenAddForm = () => {
    setFormMode('add');
    setCurrentTenantForForm(null); 
    form.reset({ 
      name: "", email: "", phone: "", alternativePhone: "", nationalId: "", 
      representativeName: "", representativePhone: "", rentedSpaceId: null 
    });
    setIsFormOpen(true);
  };

  const handleOpenEditForm = (tenant: TenantWithRelations) => {
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
    setIsSaving(true);
    const newRentedSpaceIdFromForm = values.rentedSpaceId === "null" ? null : values.rentedSpaceId || null;
    
    const tenantInputData: Prisma.TenantCreateInput | Prisma.TenantUpdateInput = {
      name: values.name,
      email: values.email,
      phone: values.phone || undefined,
      alternativePhone: values.alternativePhone || undefined,
      nationalId: values.nationalId || undefined,
      representativeName: values.representativeName || undefined,
      representativePhone: values.representativePhone || undefined,
      // rentedSpaceId is handled by linking/unlinking the space relation below
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
      await refreshData(); // Re-fetch data to reflect changes
    } else {
      toast({ title: `Error ${formMode === 'add' ? 'Adding' : 'Updating'} Tenant`, description: result.error, variant: "destructive" });
    }
  };

  const handleDeleteTenant = async () => {
    if (!tenantToDelete) return;
    setIsSaving(true);
    
    const result = await deleteTenantAction(tenantToDelete.id);
    
    setIsSaving(false);
    if (result.success) {
      toast({ title: "Tenant Removed", description: `${tenantToDelete.name} has been removed.`});
      setTenantToDelete(null); 
      await refreshData(); // Re-fetch data
    } else {
      toast({ title: "Error Deleting Tenant", description: result.error, variant: "destructive" });
    }
  };

  if (!isMounted) {
     return <div className="flex justify-center items-center h-screen"><Loader2 className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"/></div>;
  }

  return (
    <div className="animate-fadeIn">
      <PageHeader
        title="Manage Tenants"
        icon={Users}
        description="Add, view, and manage tenant information and their assigned spaces."
        actions={
          <Button onClick={handleOpenAddForm} className="bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isSaving}>
            <PlusCircle className="mr-2 h-5 w-5" /> Add New Tenant
          </Button>
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
            <DialogTitle className="font-headline">{formMode === 'add' ? 'Add New Tenant' : 'Edit Tenant'}</DialogTitle>
            <DialogPrimitiveDescription>
              {formMode === 'add' ? "Enter the details for the new tenant." : "Update the tenant's details."}
            </DialogPrimitiveDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-3 py-2 max-h-[70vh] overflow-y-auto pr-2">
              <FormField control={form.control} name="name" render={({ field }) => ( <FormItem> <FormLabel className="flex items-center"><UserSquare className="mr-2 h-4 w-4 text-primary" />Name</FormLabel> <FormControl><Input placeholder="e.g., John Doe" {...field} disabled={isSaving}/></FormControl> <FormMessage /> </FormItem> )}/>
              <FormField control={form.control} name="email" render={({ field }) => ( <FormItem> <FormLabel className="flex items-center"><Mail className="mr-2 h-4 w-4 text-primary" />Email</FormLabel> <FormControl><Input type="email" placeholder="e.g., john.doe@example.com" {...field} disabled={isSaving}/></FormControl> <FormMessage /> </FormItem> )}/>
              <FormField control={form.control} name="phone" render={({ field }) => ( <FormItem> <FormLabel className="flex items-center"><Phone className="mr-2 h-4 w-4 text-primary" />Phone Number</FormLabel> <FormControl><Input placeholder="e.g., 555-123-4567" {...field} disabled={isSaving}/></FormControl> <FormMessage /> </FormItem> )}/>
              <FormField control={form.control} name="alternativePhone" render={({ field }) => ( <FormItem> <FormLabel className="flex items-center"><PhoneIncoming className="mr-2 h-4 w-4 text-primary" />Alternative Phone</FormLabel> <FormControl><Input placeholder="e.g., 555-987-6543" {...field} disabled={isSaving}/></FormControl> <FormMessage /> </FormItem> )}/>
              <FormField control={form.control} name="nationalId" render={({ field }) => ( <FormItem> <FormLabel className="flex items-center"><Hash className="mr-2 h-4 w-4 text-primary" />National ID Number</FormLabel> <FormControl><Input placeholder="e.g., AB1234567" {...field} disabled={isSaving}/></FormControl> <FormMessage /> </FormItem> )}/>
              <FormField control={form.control} name="representativeName" render={({ field }) => ( <FormItem> <FormLabel className="flex items-center"><Contact className="mr-2 h-4 w-4 text-primary" />Representative Name</FormLabel> <FormControl><Input placeholder="e.g., Jane Smith (Spouse, Agent)" {...field} disabled={isSaving}/></FormControl> <FormMessage /> </FormItem> )}/>
              <FormField control={form.control} name="representativePhone" render={({ field }) => ( <FormItem> <FormLabel className="flex items-center"><Phone className="mr-2 h-4 w-4 text-primary" />Representative Phone</FormLabel> <FormControl><Input placeholder="e.g., 555- representative phone" {...field} disabled={isSaving}/></FormControl> <FormMessage /> </FormItem> )}/>
              <FormField
                control={form.control}
                name="rentedSpaceId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center"><BedDouble className="mr-2 h-4 w-4 text-primary" />Assign Space (Optional)</FormLabel>
                    <Select 
                      onValueChange={(value) => field.onChange(value === "null" ? null : value)} 
                      value={field.value ?? "null"}
                      disabled={isSaving}
                    >
                      <FormControl><SelectTrigger><SelectValue placeholder="Select a space to assign" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="null">No space assigned / Vacate</SelectItem>
                        {availableSpacesForAssignment.map(space => (
                          <SelectItem key={space.id} value={space.id}>
                            {space.spaceIdName} ({space.buildingName}) - ${space.monthlyRentalPrice.toLocaleString()}/month
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
                <Button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isSaving}>
                  {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {formMode === 'add' ? 'Add Tenant' : 'Save Changes'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!tenantToDelete} onOpenChange={(open) => { if(!open) setTenantToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center"><AlertTriangle className="text-destructive mr-2 h-6 w-6" />Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogPrimitiveDescription>
              This action cannot be undone. This will permanently delete the tenant "{tenantToDelete?.name}"
              {tenantToDelete?.rentedSpace ? ` and mark their space (${getSpaceDetails(tenantToDelete.rentedSpace)}) as vacant.` : '.'}
              Check for active agreements before deleting.
            </AlertDialogPrimitiveDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setTenantToDelete(null)} disabled={isSaving}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTenant} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground" disabled={isSaving}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Yes, delete tenant
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {tenants.length === 0 && !isSaving ? (
         <Card className="text-center py-12 shadow-sm">
          <CardContent>
            <Users className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2 font-headline">No Tenants Yet</h3>
            <p className="text-muted-foreground mb-4">Add tenants by clicking the button above.</p>
             <Button onClick={handleOpenAddForm} disabled={isSaving}>
                <PlusCircle className="mr-2 h-5 w-5" /> Add New Tenant
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {tenants.map((tenant) => {
            const tenantAgreement = agreements.find(ag => ag.tenantId === tenant.id); // Assuming agreements state is up-to-date
            return (
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
                  {tenant.phone && (
                    <div className="flex items-center text-muted-foreground">
                      <Phone className="mr-2 h-4 w-4 text-primary" /> Phone: {tenant.phone}
                    </div>
                  )}
                  <div className="flex items-center">
                    <BedDouble className="mr-2 h-4 w-4 text-primary" /> 
                    Rented Space: {getSpaceDetails(tenant.rentedSpace)}
                  </div>
                   <p className="text-xs text-muted-foreground pt-2">Joined: {tenant.createdAt ? format(new Date(tenant.createdAt), 'PP') : 'N/A'}</p>
                </CardContent>
                <CardFooter className="border-t pt-4 flex justify-between items-center gap-2">
                   <div>
                    {tenantAgreement && tenantAgreement.id ? (
                      <Link href={`/admin/agreements/${tenantAgreement.id}`} passHref>
                        <Button variant="outline" size="sm" disabled={isSaving}>
                          <Eye className="mr-1 h-4 w-4" /> View Agreement
                        </Button>
                      </Link>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">No active agreement</span>
                    )}
                  </div>
                  <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenEditForm(tenant)} disabled={isSaving}>
                          <Edit3 className="h-4 w-4 text-blue-600" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setTenantToDelete(tenant)} disabled={isSaving}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                  </div>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}


// Server Component Part
export default async function TenantsPage() {
  const tenantsData = await databaseService.getAllTenants({ 
    include: { rentedSpace: true, agreements: { where: { endDate: { gte: new Date() } } } }, // Include rented space and active agreements
    orderBy: { createdAt: 'desc' } 
  });
  const spacesData = await databaseService.getAllSpaces({ 
    include: { tenant: true }, // To know if space is occupied for the dropdown
    orderBy: [{ buildingName: 'asc' }, { spaceIdName: 'asc' }]
  });
  const agreementsData = await databaseService.getAllAgreements({
    where: { endDate: { gte: new Date() } } // Fetch only active/future agreements
  });

  // Serialize date fields for client component props
  const serializableTenants = tenantsData.map(tenant => ({
    ...tenant,
    createdAt: tenant.createdAt.toISOString(),
    updatedAt: tenant.updatedAt.toISOString(),
    rentedSpace: tenant.rentedSpace ? {
      ...tenant.rentedSpace,
      createdAt: tenant.rentedSpace.createdAt.toISOString(),
      updatedAt: tenant.rentedSpace.updatedAt.toISOString(),
    } : null,
    agreements: tenant.agreements.map(ag => ({
      ...ag,
      startDate: ag.startDate.toISOString(),
      endDate: ag.endDate?.toISOString(),
      nextPaymentDueDate: ag.nextPaymentDueDate.toISOString(),
      createdAt: ag.createdAt.toISOString(),
      updatedAt: ag.updatedAt.toISOString(),
      initialPaymentDate: ag.initialPaymentDate?.toISOString(),
    })),
  }));

  const serializableSpaces = spacesData.map(space => ({
    ...space,
    createdAt: space.createdAt.toISOString(),
    updatedAt: space.updatedAt.toISOString(),
    tenant: space.tenant ? {
      ...space.tenant,
      createdAt: space.tenant.createdAt.toISOString(),
      updatedAt: space.tenant.updatedAt.toISOString(),
      rentedSpaceId: space.tenant.rentedSpaceId || null, // ensure rentedSpaceId is present if tenant is
    } : null,
  }));
  
  const serializableAgreements = agreementsData.map(ag => ({
      ...ag,
      startDate: ag.startDate.toISOString(),
      endDate: ag.endDate?.toISOString(),
      nextPaymentDueDate: ag.nextPaymentDueDate.toISOString(),
      createdAt: ag.createdAt.toISOString(),
      updatedAt: ag.updatedAt.toISOString(),
      initialPaymentDate: ag.initialPaymentDate?.toISOString(),
  }));


  return <TenantsClientPage initialTenants={serializableTenants} initialSpaces={serializableSpaces} initialAgreements={serializableAgreements} />;
}
