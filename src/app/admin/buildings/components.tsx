
"use client"; 

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/custom/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Building as BuildingIcon, PlusCircle, Edit3, Trash2, MapPin, Clock, DollarSign as DollarSignLucide, AlertTriangle, Layers, HomeIcon, Eye, EyeOff } from 'lucide-react'; // Added Eye
import type { Building as BuildingTypePrisma, PenaltyTier as PenaltyTierTypePrisma } from '@prisma/client';
import { useToast } from '@/hooks/use-toast';
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
import { format } from 'date-fns';
import { deleteBuildingAction } from './actions';
import { usePermissions } from '@/contexts/PermissionContext'; 
import { PaginationControls } from '@/components/custom/PaginationControls';

export interface BuildingWithPenaltyTiers extends BuildingTypePrisma {
  penaltyPolicyTiers: PenaltyTierTypePrisma[];
  createdAt: string; 
}

interface BuildingCardProps {
  building: BuildingWithPenaltyTiers;
  onDelete: (building: BuildingWithPenaltyTiers) => void;
  canEdit: boolean;
  canDelete: boolean;
  canViewDetails: boolean; // To determine if "View Details" or "Edit" should be shown
}

function BuildingCard({ building, onDelete, canEdit, canDelete, canViewDetails }: BuildingCardProps) {
  const policiesByScopeGroup: Record<string, PenaltyTierTypePrisma[]> = {};
  (building.penaltyPolicyTiers || []).forEach(tier => {
    let key = tier.scope;
    if (tier.scope === 'Floor' && tier.applicableFloor) key = `Floor: ${tier.applicableFloor}`;
    if (tier.scope === 'SpecificSpaces' && tier.applicableSpaceIdNames?.length) key = `Spaces: ${tier.applicableSpaceIdNames.join(', ')}`;
    
    if (!policiesByScopeGroup[key]) policiesByScopeGroup[key] = [];
    policiesByScopeGroup[key].push(tier);
  });

  return (
    <Card key={building.id} className="flex flex-col justify-between shadow-lg hover:shadow-xl transition-shadow duration-300 transform hover:-translate-y-1">
      <CardHeader>
        <CardTitle className="font-headline text-xl mb-1">{building.name}</CardTitle>
        {building.address && <CardDescription className="text-sm flex items-center"><MapPin className="mr-1.5 h-4 w-4 text-muted-foreground" />{building.address}</CardDescription>}
      </CardHeader>
      <CardContent className="text-sm space-y-2 flex-grow">
           <p className="text-xs text-muted-foreground">Registered: {building.createdAt ? format(new Date(building.createdAt), 'PP') : 'N/A'}</p>
           {Object.keys(policiesByScopeGroup).length > 0 ? (
              <div className="mt-2 pt-2 border-t border-border/50 space-y-2.5">
                  <h5 className="text-xs font-semibold text-foreground mb-1">Late Fee Policies:</h5>
                  {Object.entries(policiesByScopeGroup).map(([scopeKey, tiersInGroup]) => (
                    <div key={scopeKey} className="p-1.5 bg-secondary/30 rounded-sm">
                        <p className="text-xs font-medium text-primary capitalize flex items-center">
                            {tiersInGroup[0].scope === 'Building' && <BuildingIcon className="inline mr-1 h-3 w-3"/>}
                            {tiersInGroup[0].scope === 'Floor' && <Layers className="inline mr-1 h-3 w-3"/>}
                            {tiersInGroup[0].scope === 'SpecificSpaces' && <HomeIcon className="inline mr-1 h-3 w-3"/>}
                            {scopeKey}
                        </p>
                        {tiersInGroup.sort((a,b)=>a.fromDay - b.fromDay).map((tier, index) => {
                            let tierDurationDesc = `Days ${tier.fromDay}`;
                            if (tier.toDay !== null && tier.toDay !== undefined) {
                                tierDurationDesc += ` - ${tier.toDay}`;
                            } else {
                                tierDurationDesc += ` onwards`;
                            }
                            return (
                                <div key={`${tier.id}-${index}`} className="text-xs pl-2 py-0.5">
                                    <p><Clock className="inline mr-1 h-3 w-3"/>{tierDurationDesc}</p>
                                    <p><DollarSignLucide className="inline mr-1 h-3 w-3"/>Fee: {tier.feeType === 'Fixed' ? `${tier.feeValue.toFixed(2)} Birr` : `${tier.feeValue}% of rent`}</p>
                                </div>
                            )
                        })}
                    </div>
                  ))}
              </div>
           ) : (
              <p className="text-xs text-muted-foreground italic mt-2 pt-2 border-t border-border/50">No late fee policy set.</p>
           )}
        </CardContent>
      <CardFooter className="border-t pt-4 flex flex-col sm:flex-row justify-end gap-2">
        {canEdit ? (
          <Link href={`/admin/buildings/upsert?id=${building.id}`} passHref className="w-full sm:w-auto">
            <Button variant="outline" size="sm" className="w-full">
              <Edit3 className="mr-1 h-4 w-4" /> Edit
            </Button>
          </Link>
        ) : canViewDetails ? (
           <Link href={`/admin/buildings/upsert?id=${building.id}&view=true`} passHref className="w-full sm:w-auto">
              <Button variant="outline" size="sm" className="w-full">
                <Eye className="mr-1 h-4 w-4" /> View Details
              </Button>
            </Link>
        ) : null }
        {canDelete && (
            <Button variant="destructive" size="sm" onClick={() => onDelete(building)} className="w-full sm:w-auto">
              <Trash2 className="mr-1 h-4 w-4" /> Delete
            </Button>
        )}
      </CardFooter>
    </Card>
  );
}

export function BuildingsClientPage({ initialBuildings }: { initialBuildings: BuildingWithPenaltyTiers[] }) {
  const [buildings, setBuildings] = useState<BuildingWithPenaltyTiers[]>(initialBuildings);
  const { toast } = useToast();
  const [buildingToDelete, setBuildingToDelete] = useState<BuildingWithPenaltyTiers | null>(null);
  const { hasPermission, isSuperAdmin } = usePermissions(); 
  const router = useRouter();

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const canCreateBuildings = isSuperAdmin || hasPermission('building:create');
  const canEditBuildings = isSuperAdmin || hasPermission('building:edit');
  const canDeleteBuildings = isSuperAdmin || hasPermission('building:delete');
  const canViewBuildings = isSuperAdmin || hasPermission('building:view') || canCreateBuildings || canEditBuildings || canDeleteBuildings; // If can do anything, can view

  const totalPages = Math.ceil(buildings.length / itemsPerPage);
  const paginatedBuildings = buildings.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );
  
  const handleItemsPerPageChange = (newSize: number) => {
    setItemsPerPage(newSize);
    setCurrentPage(1);
  };

  useEffect(() => {
    setBuildings(initialBuildings.map(b => ({...b, createdAt: b.createdAt || new Date().toISOString() })));
  }, [initialBuildings]);
  
  const handleDeleteBuilding = async () => {
    if (!buildingToDelete) return;
    if (!canDeleteBuildings) {
      toast({ title: "Permission Denied", description: "You do not have permission to delete buildings.", variant: "destructive" });
      return;
    }
    
    const result = await deleteBuildingAction(buildingToDelete.id);

    if (result.success) {
      toast({ title: "Building Deleted", description: `${buildingToDelete.name} has been removed.`});
      router.refresh();
    } else {
      toast({ title: "Error Deleting Building", description: result.error, variant: "destructive" });
    }
    setBuildingToDelete(null);
  };

  if (!canViewBuildings) {
     return (
      <Card className="shadow-lg text-center py-12">
        <CardHeader><CardTitle className="text-destructive flex items-center justify-center"><EyeOff className="mr-2"/>Access Denied</CardTitle></CardHeader>
        <CardContent><p>You do not have permission to view buildings.</p></CardContent>
      </Card>
    );
  }

  return (
    <div className="animate-fadeIn">
      <PageHeader
        title="Manage Buildings"
        icon={BuildingIcon}
        description="Add, view, and edit buildings and their late fee penalty policies."
        actions={
          canCreateBuildings && (
            <Link href="/admin/buildings/upsert" passHref>
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
                <PlusCircle className="mr-2 h-5 w-5" /> Add New Building
              </Button>
            </Link>
          )
        }
      />

      <AlertDialog open={!!buildingToDelete} onOpenChange={(open) => { if (!open) setBuildingToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center"><AlertTriangle className="text-destructive mr-2 h-5 w-5"/>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the building "{buildingToDelete?.name}".
              Ensure all associated spaces are removed or reassigned first, as this might fail if spaces still reference this building.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setBuildingToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteBuilding} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground" disabled={!canDeleteBuildings}>
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
            {canCreateBuildings && (
              <Link href="/admin/buildings/upsert" passHref>
                  <Button>
                  <PlusCircle className="mr-2 h-5 w-5" /> Add Building
                  </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {paginatedBuildings.map((building) => (
              <BuildingCard 
                key={building.id} 
                building={building} 
                onDelete={setBuildingToDelete} 
                canEdit={canEditBuildings}
                canDelete={canDeleteBuildings}
                canViewDetails={canViewBuildings}
              />
            ))}
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
