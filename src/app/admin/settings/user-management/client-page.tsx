

"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { User, Building, ShieldCheck, Edit, Loader2, Search, EyeOff, InfoIcon, Clipboard } from 'lucide-react';
import { updateUserAssignments } from './actions';
import type { Role, Building as BuildingPrisma, User as UserPrisma } from '@prisma/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePermissions } from '@/contexts/PermissionContext';
import { PaginationControls } from '@/components/custom/PaginationControls';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';


export interface ClientRole extends Omit<Role, 'createdAt' | 'updatedAt'> {
  createdAt: string;
  updatedAt?: string | null;
}

export interface ClientBuildingForAssignment extends Omit<BuildingPrisma, 'createdAt' | 'updatedAt' | 'penaltyPolicyTiers' | 'spaces' | 'buildingMonthlyUtilities' | 'manager'> {
  createdAt: string;
  updatedAt?: string | null;
}

export interface ClientUserWithAssignments extends Omit<UserPrisma, 'createdAt' | 'updatedAt' | 'roles' | 'managedBuildings'> {
  createdAt: string;
  updatedAt?: string | null;
  roles: ClientRole[];
  managedBuildings: ClientBuildingForAssignment[];
  tempPassword?: string | null;
}

interface UserManagementClientPageProps {
  initialUsers: ClientUserWithAssignments[];
  initialAllRoles: ClientRole[];
  initialAllBuildings: ClientBuildingForAssignment[];
}

export function UserManagementClientPage({
  initialUsers,
  initialAllRoles,
  initialAllBuildings,
}: UserManagementClientPageProps) {
  const { toast } = useToast();
  const [users, setUsers] = useState<ClientUserWithAssignments[]>(initialUsers);
  const [allRoles] = useState<ClientRole[]>(initialAllRoles);
  const [allBuildings] = useState<ClientBuildingForAssignment[]>(initialAllBuildings);

  const [isMounted, setIsMounted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  const [currentUserToEdit, setCurrentUserToEdit] = useState<ClientUserWithAssignments | null>(null);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [selectedBuildingIds, setSelectedBuildingIds] = useState<Set<string>>(new Set());
  const [buildingSearchTerm, setBuildingSearchTerm] = useState('');

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(3);

  const { hasPermission, isSuperAdmin } = usePermissions();
  const canManageUserAssignments = isSuperAdmin || hasPermission('settings:user_management:assign');
  const canViewUserManagement = isSuperAdmin || hasPermission('settings:user_management:view') || canManageUserAssignments;

  const handleItemsPerPageChange = (newSize: number) => {
    setItemsPerPage(newSize);
    setCurrentPage(1);
  };
  
  const totalPages = Math.ceil(users.length / itemsPerPage);
  const paginatedUsers = users.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );
  
  useEffect(() => {
    setIsMounted(true);
    setUsers(initialUsers);
  }, [initialUsers]);

  const handleEditUser = (user: ClientUserWithAssignments) => {
    if (!canViewUserManagement && !canManageUserAssignments) {
         toast({ title: "Permission Denied", description: "You do not have permission to view or edit user assignments.", variant: "destructive" });
         return;
    }
    setCurrentUserToEdit(user);
    setSelectedRoleId(user.roles[0]?.id || null);
    setSelectedBuildingIds(new Set(user.managedBuildings.map(building => building.id)));
    setBuildingSearchTerm(''); 
    setIsDialogOpen(true);
  };

  const handleRoleSelect = (roleId: string) => {
    setSelectedRoleId(roleId === "null" ? null : roleId); 
  };

  const handleBuildingToggle = (buildingId: string) => {
    setSelectedBuildingIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(buildingId)) {
        newSet.delete(buildingId);
      } else {
        newSet.add(buildingId);
      }
      return newSet;
    });
  };

  const filteredBuildings = useMemo(() => {
    if (!buildingSearchTerm) return allBuildings;
    return allBuildings.filter(building =>
      building.name.toLowerCase().includes(buildingSearchTerm.toLowerCase())
    );
  }, [allBuildings, buildingSearchTerm]);

  const handleSaveChanges = async () => {
    if (!currentUserToEdit) return;
    if (!canManageUserAssignments) {
      toast({ title: "Permission Denied", description: "You do not have permission to modify user assignments.", variant: "destructive" });
      return;
    }
    setIsSaving(true);

    const result = await updateUserAssignments(
      currentUserToEdit.id,
      selectedRoleId,
      Array.from(selectedBuildingIds)
    );

    setIsSaving(false);
    if (result.success) {
      toast({ title: "Success", description: result.message });
      setIsDialogOpen(false);
      setUsers(prevUsers => prevUsers.map(u => {
        if (u.id === currentUserToEdit.id) {
          return {
            ...u,
            roles: selectedRoleId ? allRoles.filter(r => r.id === selectedRoleId) : [],
            managedBuildings: allBuildings.filter(b => selectedBuildingIds.has(b.id)),
          };
        }
        return u;
      }));
    } else {
      toast({ title: "Error", description: result.error, variant: "destructive" });
    }
  };
  
  const copyToClipboard = (textToCopy: string) => {
    navigator.clipboard.writeText(textToCopy);
    toast({ title: "Copied!", description: "Temporary password copied to clipboard."});
  };

  if (!isMounted && users.length === 0 && allRoles.length === 0 && allBuildings.length === 0 && !canViewUserManagement) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  
  if (!canViewUserManagement && isMounted) {
     return (
      <Card className="shadow-lg">
        <CardHeader><CardTitle className="text-destructive flex items-center"><EyeOff className="mr-2"/>Access Denied</CardTitle></CardHeader>
        <CardContent><p>You do not have permission to manage user assignments.</p></CardContent>
      </Card>
    );
  }

  return (
    <TooltipProvider>
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="font-headline text-xl">All Users</CardTitle>
        <CardDescription>View users and manage their roles and building assignments.</CardDescription>
      </CardHeader>
      <CardContent>
        {users.length === 0 && canViewUserManagement ? (
          <div className="text-center py-10 text-muted-foreground">
            <User className="mx-auto h-12 w-12 mb-4" />
            <p>No users found. You can register new users via the "User Registration" settings.</p>
          </div>
        ) : (
          <>
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="hidden md:table-cell">Managed Buildings</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                            <span>{user.name || `${user.firstName} ${user.lastName}`.trim() || 'N/A'}</span>
                            {user.tempPassword && (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <InfoIcon className="h-4 w-4 text-primary cursor-help"/>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <div className="flex items-center gap-2">
                                        <p>Temp Password: <span className="font-semibold">{user.tempPassword}</span></p>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-6 w-6"
                                          onClick={() => copyToClipboard(user.tempPassword!)}
                                        >
                                          <Clipboard className="h-3.5 w-3.5" />
                                        </Button>
                                      </div>
                                    </TooltipContent>
                                </Tooltip>
                            )}
                        </div>
                      </TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell className="text-xs">
                        {user.roles.length > 0 ? user.roles[0].name.replace(/_/g, ' ') : <span className="italic text-muted-foreground">No role</span>}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-xs">
                        {user.managedBuildings.length > 0 ? user.managedBuildings.map(b => b.name).join(', ') : <span className="italic text-muted-foreground">No buildings</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" onClick={() => handleEditUser(user)} disabled={isSaving || !canViewUserManagement}>
                          <Edit className="mr-1 h-3.5 w-3.5" /> {canManageUserAssignments ? 'Edit' : 'View'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <PaginationControls
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              itemsPerPage={itemsPerPage}
              onItemsPerPageChange={handleItemsPerPageChange}
              className="mt-4"
            />
          </>
        )}
      </CardContent>

      {currentUserToEdit && (
        <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) setCurrentUserToEdit(null); setIsDialogOpen(open); }}>
          <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="font-headline text-xl">{canManageUserAssignments ? 'Edit User Assignments' : 'View User Assignments'}: {currentUserToEdit.name || currentUserToEdit.email}</DialogTitle>
              <DialogDescription>{canManageUserAssignments ? 'Manage roles and building assignments for this user.' : 'Viewing roles and building assignments for this user.'}</DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6 py-4 overflow-y-auto flex-grow pr-2">
              <section>
                <h3 className="text-md font-semibold mb-2 flex items-center"><ShieldCheck className="mr-2 h-5 w-5 text-primary"/>Assign Role</h3>
                <Select
                  value={selectedRoleId || "null"}
                  onValueChange={handleRoleSelect}
                  disabled={isSaving || !canManageUserAssignments}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="null">No Role</SelectItem>
                    {allRoles.map(role => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.name.replace(/_/g, ' ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {allRoles.length === 0 && <p className="text-sm text-muted-foreground mt-1">No roles available to assign.</p>}
              </section>

              <section>
                <h3 className="text-md font-semibold mb-2 flex items-center"><Building className="mr-2 h-5 w-5 text-primary"/>Assign Managed Buildings</h3>
                <div className="relative mb-2">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        type="text"
                        placeholder="Search buildings..."
                        value={buildingSearchTerm}
                        onChange={(e) => setBuildingSearchTerm(e.target.value)}
                        className="pl-8 h-9"
                        disabled={isSaving || !canManageUserAssignments}
                    />
                </div>
                <ScrollArea className="space-y-2 p-3 border rounded-md bg-secondary/30 max-h-60">
                  {filteredBuildings.length === 0 && <p className="text-sm text-muted-foreground text-center py-2">{buildingSearchTerm ? "No buildings match your search." : "No buildings available."}</p>}
                  {filteredBuildings.map(building => (
                    <div key={building.id} className="flex items-center space-x-2 py-1">
                      <Checkbox
                        id={`building-${currentUserToEdit.id}-${building.id}`}
                        checked={selectedBuildingIds.has(building.id)}
                        onCheckedChange={() => handleBuildingToggle(building.id)}
                        disabled={isSaving || !canManageUserAssignments}
                      />
                      <Label htmlFor={`building-${currentUserToEdit.id}-${building.id}`} className="text-sm font-normal cursor-pointer">
                        {building.name}
                      </Label>
                    </div>
                  ))}
                </ScrollArea>
              </section>
            </div>
            
            <DialogFooter className="pt-4 border-t mt-auto">
              <DialogClose asChild><Button type="button" variant="outline" disabled={isSaving}>Cancel</Button></DialogClose>
              {canManageUserAssignments && (
                <Button onClick={handleSaveChanges} disabled={isSaving} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                  {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                  Save Changes
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Card>
    </TooltipProvider>
  );
}
