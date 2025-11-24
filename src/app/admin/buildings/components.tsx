


"use client"; 

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/custom/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Building as BuildingIcon, PlusCircle, Edit3, Trash2, MapPin, Clock, Banknote as BanknoteIcon, AlertTriangle, Layers, HomeIcon, Eye, EyeOff, Search, Hash, UserX, UserCheck } from 'lucide-react';
import type { Building as BuildingTypePrisma, PenaltyTier as PenaltyTierTypePrisma, BuildingStatus } from '@prisma/client';
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
import { toggleBuildingStatusAction } from './actions';
import { usePermissions } from '@/contexts/PermissionContext'; 
import { PaginationControls } from '@/components/custom/PaginationControls';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

export interface BuildingWithPenaltyTiers extends BuildingTypePrisma {
  penaltyPolicyTiers: PenaltyTierTypePrisma[];
  createdAt: string; 
}

interface BuildingCardProps {
  building: BuildingWithPenaltyTiers;
  onStatusToggle: (buildingId: string, newStatus: BuildingStatus) => void;
  canEdit: boolean;
  canViewDetails: boolean; // To determine if "View Details" or "Edit" should be shown
}

function BuildingCard({ building, onStatusToggle, canEdit, canViewDetails }: BuildingCardProps) {
  const policiesByScopeGroup: Record<string, PenaltyTierTypePrisma[]> = {};
  (building.penaltyPolicyTiers || []).forEach(tier => {
    let key = tier.scope;
    if (tier.scope === 'Floor' && tier.applicableFloor) key = `Floor: ${tier.applicableFloor}`;
    if (tier.scope === 'SpecificSpaces' && tier.applicableSpaceIdNames?.length) key = `Spaces: ${tier.applicableSpaceIdNames.join(', ')}`;
    
    if (!policiesByScopeGroup[key]) policiesByScopeGroup[key] = [];
    policiesByScopeGroup[key].push(tier);
  });

  const isActive = building.status === 'Active';

  return (
    <Card key={building.id} className="flex flex-col justify-between shadow-lg hover:shadow-xl transition-shadow duration-300 transform hover:-translate-y-1">
      <CardHeader>
        <div className="flex justify-between items-start gap-2">
            <CardTitle className="font-headline text-xl mb-1">{building.name}</CardTitle>
            <Badge variant={isActive ? 'secondary' : 'destructive'} className="capitalize">{building.status}</Badge>
        </div>
        <CardDescription className="text-sm flex flex-col gap-1">
          {building.address && <span className="flex items-center"><MapPin className="mr-1.5 h-4 w-4 text-muted-foreground" />{building.address}</span>}
          {building.accountNumber && <span className="flex items-center"><Hash className="mr-1.5 h-4 w-4 text-muted-foreground" />A/C: {building.accountNumber}</span>}
        </CardDescription>
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
                                    <p><BanknoteIcon className="inline mr-1 h-3 w-3"/>Fee: {tier.penaltyType === 'Fixed' ? `${Number(tier.feeValue).toFixed(2)} Birr` : `${tier.feeValue}%`}{tier.frequency === 'Daily' ? ' daily' : ''}</p>
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
      <CardFooter className="border-t pt-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center space-x-2">
           {canEdit && (
                <Tooltip>
                    <TooltipTrigger asChild>
                        <div className="flex items-center space-x-2">
                            <Switch
                                id={`status-switch-${building.id}`}
                                checked={isActive}
                                onCheckedChange={(checked) => onStatusToggle(building.id, checked ? 'Active' : 'Inactive')}
                                aria-label="Toggle building status"
                            />
                             <Label htmlFor={`status-switch-${building.id}`} className="text-xs text-muted-foreground">
                                {isActive ? 'Active' : 'Inactive'}
                            </Label>
                        </div>
                    </TooltipTrigger>
                    <TooltipContent><p>Toggle Active/Inactive status</p></TooltipContent>
                </Tooltip>
           )}
        </div>
        <div className="flex items-center gap-1">
            {canEdit ? (
            <Tooltip>
                <TooltipTrigger asChild>
                <Link href={`/admin/buildings/add-building?id=${building.id}`} passHref>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Edit3 className="h-4 w-4 text-blue-600" />
                    <span className="sr-only">Edit Building</span>
                    </Button>
                </Link>
                </TooltipTrigger>
                <TooltipContent><p>Edit Building</p></TooltipContent>
            </Tooltip>
            ) : canViewDetails ? (
            <Tooltip>
                <TooltipTrigger asChild>
                <Link href={`/admin/buildings/add-building?id=${building.id}&view=true`} passHref>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Eye className="h-4 w-4 text-blue-600" />
                    <span className="sr-only">View Building</span>
                    </Button>
                </Link>
                </TooltipTrigger>
                <TooltipContent><p>View Building</p></TooltipContent>
            </Tooltip>
            ) : null }
        </div>
      </CardFooter>
    </Card>
  );
}

export function BuildingsClientPage({ initialBuildings }: { initialBuildings: BuildingWithPenaltyTiers[] }) {
  const [buildings, setBuildings] = useState<BuildingWithPenaltyTiers[]>(initialBuildings);
  const { toast } = useToast();
  const { hasPermission, isSuperAdmin, callServerAction } = usePermissions(); 
  const router = useRouter();

  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(3);
  const [filterStatus, setFilterStatus] = useState<'Active' | 'Inactive' | 'All'>('All');


  const canCreateBuildings = isSuperAdmin || hasPermission('building:create');
  const canEditBuildings = isSuperAdmin || hasPermission('building:edit');
  const canDeleteBuildings = isSuperAdmin || hasPermission('building:delete');
  const canViewBuildings = isSuperAdmin || hasPermission('building:view') || canCreateBuildings || canEditBuildings || canDeleteBuildings;

  const filteredBuildings = buildings.filter(building => {
      const statusMatch = filterStatus === 'All' || building.status === filterStatus;
      const searchMatch = building.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (building.address && building.address.toLowerCase().includes(searchTerm.toLowerCase()));
      return statusMatch && searchMatch;
  });

  const totalPages = Math.ceil(filteredBuildings.length / itemsPerPage);
  
  useEffect(() => {
    setBuildings(initialBuildings.map(b => ({...b, createdAt: b.createdAt || new Date().toISOString() })));
  }, [initialBuildings]);
  
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterStatus]);

  useEffect(() => {
    const newTotalPages = Math.ceil(filteredBuildings.length / itemsPerPage);
    if (currentPage > newTotalPages && newTotalPages > 0) {
      setCurrentPage(newTotalPages);
    }
  }, [filteredBuildings.length, itemsPerPage, currentPage]);
  
  const paginatedBuildings = filteredBuildings.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );
  
  const handleItemsPerPageChange = (newSize: number) => {
    setItemsPerPage(newSize);
    setCurrentPage(1);
  };
  
  const handleToggleStatus = async (buildingId: string, newStatus: BuildingStatus) => {
      if (!canEditBuildings) {
          toast({ title: "Permission Denied", description: "You do not have permission to change building status.", variant: "destructive" });
          return;
      }
      
      const result = await callServerAction(toggleBuildingStatusAction, buildingId, newStatus);
      if (result.success) {
          toast({ title: "Status Updated", description: `Building status set to ${newStatus}.` });
          router.refresh();
      } else {
          toast({ title: "Update Failed", description: result.error, variant: "destructive" });
      }
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
            <Link href="/admin/buildings/add-building" passHref>
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
                <PlusCircle className="mr-2 h-5 w-5" /> Add New Building
              </Button>
            </Link>
          )
        }
      />
      
      <Card className="mb-6 shadow-sm">
        <CardContent className="p-4 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-grow">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="Filter buildings by name or address..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center space-x-2">
            <Label htmlFor="status-filter">Status:</Label>
            <div className="flex items-center space-x-2">
                <Button variant={filterStatus === 'All' ? 'default' : 'outline'} size="sm" onClick={() => setFilterStatus('All')}>All</Button>
                <Button variant={filterStatus === 'Active' ? 'default' : 'outline'} size="sm" onClick={() => setFilterStatus('Active')}>Active</Button>
                <Button variant={filterStatus === 'Inactive' ? 'default' : 'outline'} size="sm" onClick={() => setFilterStatus('Inactive')}>Inactive</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {filteredBuildings.length === 0 ? (
        <Card className="text-center py-12 shadow-sm">
          <CardContent>
            <BuildingIcon className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2 font-headline">{searchTerm ? 'No Buildings Found' : 'No Buildings Yet'}</h3>
            <p className="text-muted-foreground mb-4">{searchTerm ? 'No buildings match your search.' : 'Get started by adding your first building.'}</p>
            {!searchTerm && canCreateBuildings && (
              <Link href="/admin/buildings/add-building" passHref>
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
                onStatusToggle={handleToggleStatus} 
                canEdit={canEditBuildings}
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
