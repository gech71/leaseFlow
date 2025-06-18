
"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/custom/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Building as BuildingIcon, PlusCircle, Edit3, Trash2, MapPin, Clock, DollarSign as DollarSignLucide, AlertTriangle, Layers, HomeIcon } from 'lucide-react';
import type { Building, PenaltyTier } from '@/lib/types';
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

const getStoredBuildings = (): Building[] => {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('buildings');
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as Building[];
        return parsed.map(b => ({
          ...b,
          penaltyPolicyTiers: (b.penaltyPolicyTiers || []).map(tier => ({
            ...tier,
            scope: tier.scope || 'Building', 
          })),
        }));
      } catch (e) {
        console.error("Error parsing buildings from localStorage", e);
        return [];
      }
    }
  }
  return [];
};

const storeBuildings = (buildings: Building[]) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('buildings', JSON.stringify(buildings));
  }
};

export default function BuildingsPage() {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [isMounted, setIsMounted] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const [buildingToDelete, setBuildingToDelete] = useState<Building | null>(null);

  useEffect(() => {
    setIsMounted(true);
    setBuildings(getStoredBuildings());
  }, []);


  const handleDeleteBuilding = () => {
    if (!buildingToDelete) return;
    const updatedBuildings = buildings.filter(b => b.id !== buildingToDelete.id);
    setBuildings(updatedBuildings);
    storeBuildings(updatedBuildings);
    toast({ title: "Building Deleted", description: `${buildingToDelete.name} has been removed.`, variant: "destructive" });
    setBuildingToDelete(null);
  };

  if (!isMounted) {
    return <div className="flex justify-center items-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;
  }

  return (
    <div className="animate-fadeIn">
      <PageHeader
        title="Manage Buildings"
        icon={BuildingIcon}
        description="Add, view, and edit buildings and their late fee penalty policies."
        actions={
          <Link href="/admin/buildings/upsert" passHref>
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
              <PlusCircle className="mr-2 h-5 w-5" /> Add New Building
            </Button>
          </Link>
        }
      />

      <AlertDialog open={!!buildingToDelete} onOpenChange={(open) => { if (!open) setBuildingToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center"><AlertTriangle className="text-destructive mr-2 h-5 w-5"/>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the building "{buildingToDelete?.name}".
              Associated spaces or agreements will NOT be deleted but may become orphaned.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setBuildingToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteBuilding} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
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
            <Link href="/admin/buildings/upsert" passHref>
                <Button>
                <PlusCircle className="mr-2 h-5 w-5" /> Add Building
                </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {buildings.map((building) => {
            const policiesByScopeGroup: Record<string, PenaltyTier[]> = {};
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
                   <p className="text-xs text-muted-foreground">Registered: {format(new Date(building.createdAt), 'PP')}</p>
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
                                        <div key={index} className="text-xs pl-2 py-0.5">
                                            <p><Clock className="inline mr-1 h-3 w-3"/>{tierDurationDesc}</p>
                                            <p><DollarSignLucide className="inline mr-1 h-3 w-3"/>Fee: {tier.feeType === 'Fixed' ? `$${tier.feeValue.toFixed(2)}` : `${tier.feeValue}% of rent`}</p>
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
              <CardFooter className="border-t pt-4 flex justify-end gap-2">
                <Link href={`/admin/buildings/upsert?id=${building.id}`} passHref>
                  <Button variant="outline" size="sm">
                    <Edit3 className="mr-1 h-4 w-4" /> Edit
                  </Button>
                </Link>
                <Button variant="destructive" size="sm" onClick={() => setBuildingToDelete(building)}>
                  <Trash2 className="mr-1 h-4 w-4" /> Delete
                </Button>
              </CardFooter>
            </Card>
          )})}
        </div>
      )}
    </div>
  );
}
    
