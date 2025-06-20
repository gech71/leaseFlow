
"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { User, Building, ShieldCheck, Edit, Loader2, AlertTriangle } from 'lucide-react';
import { updateUserAssignments } from './actions';
import type { Role, Building as BuildingPrisma, User as UserPrisma } from '@prisma/client';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

// Client-side types with serialized dates
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
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null); // Changed from Set to string|null
  const [selectedBuildingIds, setSelectedBuildingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setIsMounted(true);
    setUsers(initialUsers);
  }, [initialUsers]);

  const handleEditUser = (user: ClientUserWithAssignments) => {
    setCurrentUserToEdit(user);
    setSelectedRoleId(user.roles[0]?.id || null); // Assign first role ID or null
    setSelectedBuildingIds(new Set(user.managedBuildings.map(building => building.id)));
    setIsDialogOpen(true);
  };

  const handleRoleSelect = (roleId: string) => { // New handler for RadioGroup
    setSelectedRoleId(roleId);
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

  const handleSaveChanges = async () => {
    if (!currentUserToEdit) return;
    setIsSaving(true);

    const result = await updateUserAssignments(
      currentUserToEdit.id,
      selectedRoleId, // Pass single role ID
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
  
  if (!isMounted && users.length === 0 && allRoles.length === 0 && allBuildings.length === 0) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="font-headline text-xl">All Users</CardTitle>
        <CardDescription>View users and manage their roles and building assignments.</CardDescription>
      </CardHeader>
      <CardContent>
        {users.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            <User className="mx-auto h-12 w-12 mb-4" />
            <p>No users found. You can register new users via the "User Registration" settings.</p>
          </div>
        ) : (
          <ScrollArea className="max-h-[60vh]">
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
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.name || `${user.firstName} ${user.lastName}`.trim() || 'N/A'}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell className="text-xs">
                      {user.roles.length > 0 ? user.roles[0].name : <span className="italic text-muted-foreground">No role</span>}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-xs">
                      {user.managedBuildings.length > 0 ? user.managedBuildings.map(b => b.name).join(', ') : <span className="italic text-muted-foreground">No buildings</span>}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => handleEditUser(user)} disabled={isSaving}>
                        <Edit className="mr-1 h-3.5 w-3.5" /> Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
      </CardContent>

      {currentUserToEdit && (
        <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) setCurrentUserToEdit(null); setIsDialogOpen(open); }}>
          <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="font-headline text-xl">Edit User: {currentUserToEdit.name || currentUserToEdit.email}</DialogTitle>
              <DialogDescription>Manage roles and building assignments for this user.</DialogDescription>
            </DialogHeader>
            
            <ScrollArea className="flex-grow py-4 pr-2 -mr-2">
                <div className="space-y-6">
                    <section>
                        <h3 className="text-md font-semibold mb-2 flex items-center"><ShieldCheck className="mr-2 h-5 w-5 text-primary"/>Assign Role</h3>
                        <RadioGroup
                          value={selectedRoleId || ""}
                          onValueChange={handleRoleSelect}
                          className="space-y-2 p-3 border rounded-md bg-secondary/30 max-h-48 overflow-y-auto"
                          disabled={isSaving}
                        >
                          {allRoles.length === 0 && <p className="text-sm text-muted-foreground">No roles available to assign.</p>}
                          {allRoles.map(role => (
                              <div key={role.id} className="flex items-center space-x-2">
                                <RadioGroupItem value={role.id} id={`role-${currentUserToEdit.id}-${role.id}`} disabled={isSaving} />
                                <Label htmlFor={`role-${currentUserToEdit.id}-${role.id}`} className="text-sm font-normal cursor-pointer">
                                    {role.name} <span className="text-xs text-muted-foreground">({role.description || 'No description'})</span>
                                </Label>
                              </div>
                          ))}
                        </RadioGroup>
                    </section>

                    <section>
                        <h3 className="text-md font-semibold mb-2 flex items-center"><Building className="mr-2 h-5 w-5 text-primary"/>Assign Managed Buildings</h3>
                        <div className="space-y-2 p-3 border rounded-md bg-secondary/30 max-h-60 overflow-y-auto">
                        {allBuildings.length === 0 && <p className="text-sm text-muted-foreground">No buildings available to assign.</p>}
                        {allBuildings.map(building => (
                            <div key={building.id} className="flex items-center space-x-2">
                            <Checkbox
                                id={`building-${currentUserToEdit.id}-${building.id}`}
                                checked={selectedBuildingIds.has(building.id)}
                                onCheckedChange={() => handleBuildingToggle(building.id)}
                                disabled={isSaving}
                            />
                            <Label htmlFor={`building-${currentUserToEdit.id}-${building.id}`} className="text-sm font-normal cursor-pointer">
                                {building.name}
                            </Label>
                            </div>
                        ))}
                        </div>
                    </section>
                </div>
            </ScrollArea>
            
            <DialogFooter className="pt-4 border-t">
              <DialogClose asChild><Button type="button" variant="outline" disabled={isSaving}>Cancel</Button></DialogClose>
              <Button onClick={handleSaveChanges} disabled={isSaving || !selectedRoleId} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
}
