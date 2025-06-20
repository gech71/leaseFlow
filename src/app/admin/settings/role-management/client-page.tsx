"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { ShieldCheck, Edit, Trash2, PlusCircle, Loader2, AlertTriangle, BadgeAlert, ListChecks } from 'lucide-react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { getAllRolesAction, createRoleAction, updateRoleAction, deleteRoleAction, type RoleUpsertData } from './actions';
import type { Role } from '@prisma/client';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";


// Client-side Role type with serialized dates
export interface ClientRole extends Omit<Role, 'createdAt' | 'updatedAt'> {
  createdAt: string;
  updatedAt?: string | null;
}

const AVAILABLE_PERMISSIONS = [
  { id: 'user:manage', label: 'Manage Users & Registration' },
  { id: 'role:manage', label: 'Manage Roles & Permissions' },
  { id: 'building:manage', label: 'Manage Buildings (Create, Edit, Delete)' },
  { id: 'building:read', label: 'View Buildings' },
  { id: 'space:manage', label: 'Manage Spaces (Create, Edit, Delete)' },
  { id: 'space:read', label: 'View Spaces' },
  { id: 'tenant:manage', label: 'Manage Tenants (Create, Edit, Delete)' },
  { id: 'tenant:read', label: 'View Tenants' },
  { id: 'agreement:manage', label: 'Manage Agreements (Create, Edit, Delete)' },
  { id: 'agreement:read', label: 'View Agreements' },
  { id: 'billing:manage', label: 'Manage Billing (Generate Bills, Record Payments)' },
  { id: 'billing:read', label: 'View Billing Information' },
  { id: 'building_utilities:manage', label: 'Manage Building Utilities' },
  { id: 'reports:view_all', label: 'View All Reports / Full Dashboard' },
  { id: 'reports:view_financial', label: 'View Financial Reports' },
  { id: 'reports:view_operational', label: 'View Operational Reports' },
  { id: 'settings:manage', label: 'Manage System Settings (subset of Super Admin)' },
] as const;


const roleFormSchema = z.object({
  name: z.string().min(2, "Role name must be at least 2 characters.").max(50, "Role name cannot exceed 50 characters.")
    .regex(/^[A-Z_]+$/, "Role name must be uppercase and can include underscores (e.g., PROPERTY_MANAGER)."),
  description: z.string().max(255, "Description cannot exceed 255 characters.").optional().or(z.literal('')),
  permissions: z.array(z.string()).optional().default([]),
});

type RoleFormValues = z.infer<typeof roleFormSchema>;

interface RoleManagementClientPageProps {
  initialRoles: ClientRole[];
}

export function RoleManagementClientPage({ initialRoles }: RoleManagementClientPageProps) {
  const { toast } = useToast();
  const [roles, setRoles] = useState<ClientRole[]>(initialRoles);
  const [isMounted, setIsMounted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'add' | 'edit'>('add');
  const [currentRoleForForm, setCurrentRoleForForm] = useState<ClientRole | null>(null);
  const [roleToDelete, setRoleToDelete] = useState<ClientRole | null>(null);

  const form = useForm<RoleFormValues>({
    resolver: zodResolver(roleFormSchema),
    defaultValues: { name: "", description: "", permissions: [] },
  });

  useEffect(() => {
    setIsMounted(true);
    setRoles(initialRoles);
  }, [initialRoles]);
  
  const fetchRoles = async () => {
    const result = await getAllRolesAction();
    if (result.success && result.roles) {
        setRoles(result.roles.map(r => ({
            ...r,
            createdAt: r.createdAt.toISOString(),
            updatedAt: r.updatedAt?.toISOString() ?? null,
        })));
    } else {
        toast({ title: "Error", description: result.error || "Failed to refresh roles.", variant: "destructive" });
    }
  };

  const handleOpenAddForm = () => {
    setFormMode('add');
    setCurrentRoleForForm(null);
    form.reset({ name: "", description: "", permissions: [] });
    setIsFormOpen(true);
  };

  const handleOpenEditForm = (role: ClientRole) => {
    setFormMode('edit');
    setCurrentRoleForForm(role);
    form.reset({
      name: role.name,
      description: role.description || "",
      permissions: role.permissions || [],
    });
    setIsFormOpen(true);
  };

  const handleFormSubmit = async (values: RoleFormValues) => {
    setIsSaving(true);
    
    const roleData: RoleUpsertData = {
      name: values.name.toUpperCase().replace(/\s+/g, '_'),
      description: values.description || undefined,
      permissions: values.permissions || [],
    };

    let result;
    if (formMode === 'add') {
      result = await createRoleAction(roleData);
    } else if (currentRoleForForm?.id) {
      result = await updateRoleAction(currentRoleForForm.id, roleData);
    } else {
      toast({ title: "Error", description: "Role ID missing for update.", variant: "destructive" });
      setIsSaving(false);
      return;
    }

    setIsSaving(false);
    if (result.success && result.role) {
      toast({ title: "Success", description: `Role "${result.role.name}" ${formMode === 'add' ? 'created' : 'updated'}.` });
      setIsFormOpen(false);
      fetchRoles(); 
    } else {
      toast({ title: "Error", description: result.error || "Failed to save role.", variant: "destructive" });
    }
  };

  const handleDeleteRole = async () => {
    if (!roleToDelete) return;
    setIsSaving(true);
    const result = await deleteRoleAction(roleToDelete.id);
    setIsSaving(false);
    if (result.success) {
      toast({ title: "Role Deleted", description: `Role "${roleToDelete.name}" has been removed.` });
      setRoleToDelete(null);
      fetchRoles(); 
    } else {
      toast({ title: "Error Deleting Role", description: result.error, variant: "destructive" });
    }
  };

  if (!isMounted && roles.length === 0) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <Card className="shadow-lg">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="font-headline text-xl">Manage Roles</CardTitle>
          <CardDescription>Define user roles and their permissions within the application.</CardDescription>
        </div>
        <Button onClick={handleOpenAddForm} disabled={isSaving}>
          <PlusCircle className="mr-2 h-4 w-4" /> Add New Role
        </Button>
      </CardHeader>
      <CardContent>
        {roles.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            <ShieldCheck className="mx-auto h-12 w-12 mb-4" />
            <p>No roles defined yet. Click "Add New Role" to get started.</p>
          </div>
        ) : (
          <ScrollArea className="max-h-[60vh]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden md:table-cell">Description</TableHead>
                  <TableHead>Permissions</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roles.map((role) => (
                  <TableRow key={role.id}>
                    <TableCell className="font-medium">{role.name.replace(/_/g, ' ')}</TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground max-w-xs truncate">{role.description || "-"}</TableCell>
                    <TableCell>
                      {role.permissions.length > 0 ? (
                        <div className="flex flex-wrap gap-1 max-w-md">
                          {role.permissions.slice(0, 3).map(permission => {
                             const permLabel = AVAILABLE_PERMISSIONS.find(p => p.id === permission)?.label || permission;
                             return <Badge key={permission} variant="secondary" className="text-xs">{permLabel}</Badge>;
                          })}
                          {role.permissions.length > 3 && <Badge variant="outline" className="text-xs">+{role.permissions.length - 3} more</Badge>}
                        </div>
                      ) : <span className="text-xs text-muted-foreground italic">No permissions</span>}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => handleOpenEditForm(role)} className="mr-1 h-8 w-8" disabled={isSaving}>
                        <Edit className="h-4 w-4 text-blue-600" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setRoleToDelete(role)} className="h-8 w-8" disabled={isSaving || role.name === 'SUPER_ADMIN' || role.name === 'PROPERTY_MANAGER' || role.name === 'ACCOUNTANT' || role.name === 'SUPPORT_STAFF'}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
      </CardContent>

      <Dialog open={isFormOpen} onOpenChange={(open) => { if (!open) setCurrentRoleForForm(null); setIsFormOpen(open); }}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="font-headline text-xl">{formMode === 'add' ? 'Add New Role' : 'Edit Role'}</DialogTitle>
            <DialogDescription>
              {formMode === 'add' ? 'Create a new role and define its permissions.' : `Update the role "${currentRoleForForm?.name.replace(/_/g, ' ')}".`}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4 py-2 overflow-y-auto flex-grow pr-1">
              <div>
                <FormLabel htmlFor="roleName">Role Name</FormLabel>
                <FormControl>
                  <Input id="roleName" {...form.register("name")} placeholder="E.g., PROPERTY_MANAGER" className="mt-1" disabled={isSaving || (formMode === 'edit' && (currentRoleForForm?.name === 'SUPER_ADMIN' || currentRoleForForm?.name === 'PROPERTY_MANAGER' || currentRoleForForm?.name === 'ACCOUNTANT' || currentRoleForForm?.name === 'SUPPORT_STAFF'))} />
                </FormControl>
                <FormMessage>{form.formState.errors.name?.message}</FormMessage>
                <p className="text-xs text-muted-foreground mt-1">Must be uppercase with underscores (e.g., BILLING_CLERK). System roles (SUPER_ADMIN, PROPERTY_MANAGER, ACCOUNTANT, SUPPORT_STAFF) cannot have their names changed.</p>
              </div>
              <div>
                <FormLabel htmlFor="roleDescription">Description (Optional)</FormLabel>
                <FormControl>
                  <Textarea id="roleDescription" {...form.register("description")} placeholder="Briefly describe this role's purpose" className="mt-1" rows={2} disabled={isSaving}/>
                </FormControl>
                <FormMessage>{form.formState.errors.description?.message}</FormMessage>
              </div>
              
              <FormField
                control={form.control}
                name="permissions"
                render={() => (
                  <FormItem>
                    <div className="mb-2">
                      <FormLabel className="text-base flex items-center"><ListChecks className="mr-2 h-5 w-5 text-primary"/>Permissions</FormLabel>
                      <p className="text-sm text-muted-foreground">Select the permissions for this role.</p>
                    </div>
                    <ScrollArea className="max-h-60 w-full rounded-md border p-3 bg-secondary/20">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                        {AVAILABLE_PERMISSIONS.map((item) => (
                          <FormField
                            key={item.id}
                            control={form.control}
                            name="permissions"
                            render={({ field }) => {
                              return (
                                <FormItem
                                  key={item.id}
                                  className="flex flex-row items-center space-x-2 space-y-0"
                                >
                                  <FormControl>
                                    <Checkbox
                                      checked={field.value?.includes(item.id)}
                                      onCheckedChange={(checked) => {
                                        return checked
                                          ? field.onChange([...(field.value || []), item.id])
                                          : field.onChange(
                                              (field.value || []).filter(
                                                (value) => value !== item.id
                                              )
                                            )
                                      }}
                                      disabled={isSaving}
                                    />
                                  </FormControl>
                                  <FormLabel className="text-sm font-normal cursor-pointer">
                                    {item.label}
                                  </FormLabel>
                                </FormItem>
                              )
                            }}
                          />
                        ))}
                      </div>
                    </ScrollArea>
                    <FormMessage />
                  </FormItem>
                )}
              />
            <DialogFooter className="pt-4 mt-auto border-t">
              <DialogClose asChild><Button type="button" variant="outline" disabled={isSaving}>Cancel</Button></DialogClose>
              <Button type="submit" disabled={isSaving} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {formMode === 'add' ? 'Create Role' : 'Save Changes'}
              </Button>
            </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!roleToDelete} onOpenChange={(open) => { if (!open) setRoleToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center"><BadgeAlert className="text-destructive mr-2 h-5 w-5" />Confirm Deletion</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the role "{roleToDelete?.name.replace(/_/g, ' ')}"? This action cannot be undone.
              Users currently assigned this role will lose its permissions.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setRoleToDelete(null)} disabled={isSaving}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteRole} className="bg-destructive hover:bg-destructive/90" disabled={isSaving}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Delete Role
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
