
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
import { ShieldCheck, Edit, Trash2, PlusCircle, Loader2, AlertTriangle, BadgeAlert, ListChecks, EyeOff } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { getAllRolesAction, createRoleAction, updateRoleAction, deleteRoleAction, type RoleUpsertData } from './actions';
import type { Role } from '@prisma/client';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ALL_RESOURCE_PERMISSIONS } from '@/lib/types'; 
import { usePermissions } from '@/contexts/PermissionContext';
import { cn } from '@/lib/utils';

export interface ClientRole extends Omit<Role, 'createdAt' | 'updatedAt'> {
  createdAt: string;
  updatedAt?: string | null;
}

const roleFormSchema = z.object({
  name: z.string().min(2, "Role name must be at least 2 characters.").max(50, "Role name cannot exceed 50 characters.")
    .regex(/^[A-Z_]+$/, "Role name must be uppercase and can include underscores (e.g., PROPERTY_MANAGER)."),
  description: z.string().max(255, "Description cannot exceed 255 characters.").optional().or(z.literal('')),
  permissions: z.array(z.string()).min(0, "Select at least one permission or none if applicable.").optional().default([]),
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

  const { hasPermission: contextHasPermission, isSuperAdmin } = usePermissions(); 
  const canManageRoles = isSuperAdmin || contextHasPermission('settings:role_management:manage');
  const canViewRoles = isSuperAdmin || contextHasPermission('settings:role_management:view') || canManageRoles;


  const form = useForm<RoleFormValues>({
    resolver: zodResolver(roleFormSchema),
    defaultValues: { name: "", description: "", permissions: [] },
  });

  const selectedPermissions = form.watch('permissions');

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
    if (!canManageRoles) {
      toast({ title: "Permission Denied", description: "You do not have permission to add roles.", variant: "destructive" });
      return;
    }
    setFormMode('add');
    setCurrentRoleForForm(null);
    form.reset({ name: "", description: "", permissions: [] });
    setIsFormOpen(true);
  };

  const handleOpenEditForm = (role: ClientRole) => {
    if (!canViewRoles) {
         toast({ title: "Permission Denied", description: "You do not have permission to view or edit roles.", variant: "destructive" });
         return;
    }
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
    if (!canManageRoles) {
      toast({ title: "Permission Denied", description: "You do not have permission to save roles.", variant: "destructive" });
      return;
    }
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
    if (!canManageRoles) {
      toast({ title: "Permission Denied", description: "You do not have permission to delete roles.", variant: "destructive" });
      return;
    }
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

  const handleResourceGroupToggle = (group: typeof ALL_RESOURCE_PERMISSIONS[0], isChecked: boolean) => {
    const currentPermissions = form.getValues('permissions') || [];
    const groupPermissionIds = group.permissions.map(p => p.id);
    let newPermissions: string[];

    if (isChecked) {
      newPermissions = Array.from(new Set([...currentPermissions, ...groupPermissionIds]));
    } else {
      newPermissions = currentPermissions.filter(pId => !groupPermissionIds.includes(pId));
    }
    form.setValue('permissions', newPermissions, { shouldValidate: true, shouldDirty: true });
  };

  const handlePermissionToggle = (permissionId: string, isChecked: boolean) => {
    const currentPermissions = form.getValues('permissions') || [];
    let newPermissions: string[];

    if (isChecked) {
      newPermissions = Array.from(new Set([...currentPermissions, permissionId]));
    } else {
      newPermissions = currentPermissions.filter(pId => pId !== permissionId);
    }
    form.setValue('permissions', newPermissions, { shouldValidate: true, shouldDirty: true });
  };

  if (!isMounted && roles.length === 0 && !canViewRoles) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  
  if (!canViewRoles && isMounted) { 
    return (
      <Card className="shadow-lg">
        <CardHeader><CardTitle className="text-destructive flex items-center"><EyeOff className="mr-2"/>Access Denied</CardTitle></CardHeader>
        <CardContent><p>You do not have permission to view or manage roles.</p></CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-lg">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="font-headline text-xl">Manage Roles</CardTitle>
          <CardDescription>Define user roles and their permissions within the application.</CardDescription>
        </div>
        {canManageRoles && (
          <Button onClick={handleOpenAddForm} disabled={isSaving}>
            <PlusCircle className="mr-2 h-4 w-4" /> Add New Role
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {roles.length === 0 && canViewRoles ? (
          <div className="text-center py-10 text-muted-foreground">
            <ShieldCheck className="mx-auto h-12 w-12 mb-4" />
            <p>No roles defined yet. {canManageRoles ? 'Click "Add New Role" to get started.' : 'Contact an administrator to add roles.'}</p>
          </div>
        ) : (
          <ScrollArea className="max-h-[60vh]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden md:table-cell">Description</TableHead>
                  <TableHead>Permissions Count</TableHead>
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
                        <Badge variant="secondary" className="text-xs">{role.permissions.length} assigned</Badge>
                      ) : <span className="text-xs text-muted-foreground italic">None</span>}
                    </TableCell>
                    <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => handleOpenEditForm(role)} className="mr-1 h-8 w-8" disabled={isSaving}>
                          {canManageRoles ? <Edit className="h-4 w-4 text-blue-600" /> : <EyeOff className="h-4 w-4 text-blue-600" />}
                        </Button>
                      {canManageRoles && (
                          <Button variant="ghost" size="icon" onClick={() => setRoleToDelete(role)} className="h-8 w-8" disabled={isSaving || role.name === 'SUPER_ADMIN' || role.name === 'PROPERTY_MANAGER' || role.name === 'ACCOUNTANT' || role.name === 'SUPPORT_STAFF'}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
      </CardContent>

      <Dialog open={isFormOpen} onOpenChange={(open) => { if (!open) setCurrentRoleForForm(null); setIsFormOpen(open); }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="font-headline text-xl">{formMode === 'add' ? 'Add New Role' : (canManageRoles ? 'Edit Role' : 'View Role Details')}</DialogTitle>
            <DialogDescription>
              {formMode === 'add' ? 'Create a new role and define its permissions.' : (canManageRoles ? `Update the role "${currentRoleForForm?.name.replace(/_/g, ' ')}".` : `Viewing details for role "${currentRoleForForm?.name.replace(/_/g, ' ')}".`)}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4 py-2 overflow-y-auto flex-grow pr-1">
              <div>
                <FormLabel htmlFor="roleName">Role Name</FormLabel>
                <FormControl>
                  <Input id="roleName" {...form.register("name")} placeholder="E.g., PROPERTY_MANAGER" className="mt-1" disabled={isSaving || !canManageRoles || (formMode === 'edit' && (currentRoleForForm?.name === 'SUPER_ADMIN' || currentRoleForForm?.name === 'PROPERTY_MANAGER' || currentRoleForForm?.name === 'ACCOUNTANT' || currentRoleForForm?.name === 'SUPPORT_STAFF'))} />
                </FormControl>
                <FormMessage>{form.formState.errors.name?.message}</FormMessage>
                <p className="text-xs text-muted-foreground mt-1">Must be uppercase with underscores (e.g., BILLING_CLERK). System roles (SUPER_ADMIN, PROPERTY_MANAGER, ACCOUNTANT, SUPPORT_STAFF) cannot have their names changed.</p>
              </div>
              <div>
                <FormLabel htmlFor="roleDescription">Description (Optional)</FormLabel>
                <FormControl>
                  <Textarea id="roleDescription" {...form.register("description")} placeholder="Briefly describe this role's purpose" className="mt-1" rows={2} disabled={isSaving || !canManageRoles}/>
                </FormControl>
                <FormMessage>{form.formState.errors.description?.message}</FormMessage>
              </div>
              
              <FormItem>
                <div className="mb-2">
                  <FormLabel className="text-base flex items-center"><ListChecks className="mr-2 h-5 w-5 text-primary"/>Permissions</FormLabel>
                  <p className="text-sm text-muted-foreground">Select permissions for this role. Expand a section to see individual permissions.</p>
                </div>
                <Accordion type="multiple" className="w-full">
                  {ALL_RESOURCE_PERMISSIONS.map((group) => {
                    const groupPermissionIds = group.permissions.map(p => p.id);
                    const selectedCount = groupPermissionIds.filter(pId => selectedPermissions?.includes(pId)).length;
                    const isGroupChecked = selectedCount === groupPermissionIds.length;
                    const isGroupIndeterminate = !isGroupChecked && selectedCount > 0;

                    return (
                      <AccordionItem value={group.resourceId} key={group.resourceId}>
                        <AccordionTrigger className={cn("hover:no-underline", isGroupIndeterminate ? "text-primary" : "")}>
                          <div className="flex flex-1 items-center gap-2">
                             <Checkbox
                                id={`group-${group.resourceId}-trigger`}
                                checked={isGroupChecked}
                                data-indeterminate={isGroupIndeterminate ? "true" : undefined}
                                className="data-[state=checked]:bg-primary data-[indeterminate=true]:bg-primary/50"
                                onClick={(e) => { e.stopPropagation(); handleResourceGroupToggle(group, !isGroupChecked); }}
                                disabled={isSaving || !canManageRoles}
                              />
                            <span className="font-semibold">{group.resourceLabel}</span>
                          </div>
                          <Badge variant={selectedCount > 0 ? "default" : "secondary"}>{selectedCount} / {groupPermissionIds.length}</Badge>
                        </AccordionTrigger>
                        <AccordionContent className="pl-8 pr-2">
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-2">
                            {group.permissions.map((permission) => (
                              <FormItem key={permission.id} className="flex flex-row items-center space-x-2 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={selectedPermissions?.includes(permission.id)}
                                    onCheckedChange={(checked) => handlePermissionToggle(permission.id, !!checked)}
                                    disabled={isSaving || !canManageRoles}
                                  />
                                </FormControl>
                                <FormLabel className="text-sm font-normal cursor-pointer">
                                  {permission.label}
                                </FormLabel>
                              </FormItem>
                            ))}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
                <FormMessage>{form.formState.errors.permissions?.message}</FormMessage>
              </FormItem>

            <DialogFooter className="pt-4 mt-auto border-t">
              <DialogClose asChild><Button type="button" variant="outline" disabled={isSaving}>Cancel</Button></DialogClose>
              {canManageRoles && (
                <Button type="submit" disabled={isSaving || !canManageRoles} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                  {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {formMode === 'add' ? 'Create Role' : 'Save Changes'}
                </Button>
              )}
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
            <AlertDialogAction onClick={handleDeleteRole} className="bg-destructive hover:bg-destructive/90" disabled={isSaving || !canManageRoles}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Delete Role
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
