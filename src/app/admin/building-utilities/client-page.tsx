
"use client";

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlusCircle, Trash2, Building as BuildingIconLucide, CalendarIcon, Banknote as BanknoteIcon, Layers, HomeIcon, Loader2, EyeOff, InfoIcon, Percent, AlertTriangle, Edit, Search } from 'lucide-react';
import type { Building as BuildingPrismaType, BuildingMonthlyUtilities as BuildingMonthlyUtilitiesPrismaType, BuildingUtilityItem as BuildingUtilityItemPrismaType, Space as SpacePrismaType } from '@prisma/client';
import { useToast } from '@/hooks/use-toast';
import { getYear, getMonth, format, setYear, setMonth, parseISO, subMonths } from 'date-fns';
import { getBuildingUtilitiesAction, saveBuildingUtilitiesAction, getAllBuildingUtilitiesForListAction, deleteBuildingUtilitiesAction, type BuildingUtilityItemInput } from './actions';
import { usePermissions } from '@/contexts/PermissionContext';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PaginationControls } from '@/components/custom/PaginationControls';


// Client-safe types passed as props
interface ClientSpace extends Omit<SpacePrismaType, 'createdAt' | 'updatedAt'> {
  createdAt: string;
  updatedAt: string;
}
interface ClientBuilding extends Omit<BuildingPrismaType, 'createdAt' | 'updatedAt' | 'spaces'> {
  createdAt: string;
  updatedAt: string;
  spaces: ClientSpace[];
}
export interface ClientBuildingMonthlyUtilitiesPrismaType extends Omit<BuildingMonthlyUtilitiesPrismaType, 'createdAt' | 'updatedAt' | 'utilities'> {
  createdAt: string;
  updatedAt: string;
  utilities: BuildingUtilityItemPrismaType[]; 
}

// Internal state type for a "logical" utility item in the UI
interface UIUtilityItem {
  uiId: string;
  name: string;
  appliesToScope: 'Building' | 'Floor' | 'SpecificSpaces';
  totalCost?: number;
  applicableFloor?: string;
  perSpaceCosts?: { [spaceId: string]: number };
  perSpacePercentages?: { [spaceId: string]: number };
}


interface BuildingUtilitiesClientPageProps {
  initialBuildings: ClientBuilding[];
  initialUtilityRecords: ClientBuildingMonthlyUtilitiesPrismaType[];
}

export function BuildingUtilitiesClientPage({ initialBuildings, initialUtilityRecords }: BuildingUtilitiesClientPageProps) {
  const [allUtilityRecords, setAllUtilityRecords] = useState<ClientBuildingMonthlyUtilitiesPrismaType[]>(initialUtilityRecords);
  const [registeredBuildings, setRegisteredBuildings] = useState<ClientBuilding[]>(initialBuildings);
  const [isMounted, setIsMounted] = useState(false);
  const { toast } = useToast();
  
  // Default to the previous month for data entry
  const [defaultDate] = useState(() => subMonths(new Date(), 1));

  const [selectedBuildingId, setSelectedBuildingId] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<number>(() => getYear(defaultDate));
  const [selectedMonth, setSelectedMonth] = useState<number>(() => getMonth(defaultDate)); 
  
  const [currentUtilityItems, setCurrentUtilityItems] = useState<UIUtilityItem[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<ClientBuildingMonthlyUtilitiesPrismaType | null>(null);
  const [utilityFilterTerm, setUtilityFilterTerm] = useState('');
  const [filterYear, setFilterYear] = useState<number | 'all'>('all');
  const [filterMonth, setFilterMonth] = useState<number | 'all'>('all');


  const { hasPermission, isSuperAdmin } = usePermissions();
  const canSaveUtilities = isSuperAdmin || hasPermission('building_utility:save');
  const canViewUtilities = isSuperAdmin || hasPermission('building_utility:view') || canSaveUtilities;

  const [recordsCurrentPage, setRecordsCurrentPage] = useState(1);
  const [recordsItemsPerPage, setRecordsItemsPerPage] = useState(5);

  const handleRecordsItemsPerPageChange = (newSize: number) => {
    setRecordsItemsPerPage(newSize);
    setRecordsCurrentPage(1);
  };
  
  useEffect(() => {
    setRecordsCurrentPage(1);
  }, [utilityFilterTerm, filterYear, filterMonth]);

  const filteredRecords = useMemo(() => {
    return allUtilityRecords.filter(record => {
      const matchesSearchTerm = record.buildingName.toLowerCase().includes(utilityFilterTerm.toLowerCase());
      const matchesYear = filterYear === 'all' || record.year === filterYear;
      const matchesMonth = filterMonth === 'all' || record.month === filterMonth;
      
      // If a year is selected, month filter can apply. If no year, month filter is ignored.
      if (filterYear === 'all') {
        return matchesSearchTerm && matchesYear;
      }
      
      return matchesSearchTerm && matchesYear && matchesMonth;
    });
  }, [allUtilityRecords, utilityFilterTerm, filterYear, filterMonth]);

  const recordsTotalPages = Math.ceil(filteredRecords.length / recordsItemsPerPage);
  
  const paginatedUtilityRecords = useMemo(() => {
    const sortedRecords = [...filteredRecords].sort((a, b) => {
      return parseISO(b.createdAt).getTime() - parseISO(a.createdAt).getTime();
    });
    return sortedRecords.slice(
      (recordsCurrentPage - 1) * recordsItemsPerPage,
      recordsCurrentPage * recordsItemsPerPage
    );
  }, [filteredRecords, recordsCurrentPage, recordsItemsPerPage]);


  const selectedBuilding = useMemo(() => {
    return registeredBuildings.find(b => b.id === selectedBuildingId);
  }, [selectedBuildingId, registeredBuildings]);
  
  const uniqueFloors = useMemo(() => {
    if (!selectedBuilding) return [];
    const floors = selectedBuilding.spaces.map(s => s.floor).filter(Boolean); // filter out null/empty floors
    // Sort numerically if possible, otherwise alphabetically
    return [...new Set(floors)].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [selectedBuilding]);

  const createEmptyItem = (): UIUtilityItem => ({
    uiId: `newItem-${Date.now()}`, name: '', appliesToScope: 'Building', totalCost: 0, perSpaceCosts: {}, perSpacePercentages: {}
  });

  useEffect(() => {
    setIsMounted(true);
    if (initialBuildings.length > 0 && !selectedBuildingId) {
      setSelectedBuildingId(initialBuildings[0].id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialBuildings]); 

  useEffect(() => {
    if (isMounted && selectedBuildingId && selectedYear !== undefined && selectedMonth !== undefined) {
      const fetchUtilities = async () => {
        setIsLoadingData(true);
        const existingEntry = await getBuildingUtilitiesAction(selectedBuildingId, selectedYear, selectedMonth);
        
        if (existingEntry && existingEntry.utilities && selectedBuilding) {
            const logicalGroups: { [key: string]: BuildingUtilityItemPrismaType[] } = {};

            // Group DB items into logical UI items
            for (const item of existingEntry.utilities) {
                let groupKey: string;
                if (item.appliesToScope === 'Building') {
                    groupKey = `Building_${item.name}`;
                } else {
                    const spaceForItem = selectedBuilding.spaces.find(s => s.spaceIdName === item.applicableSpaceIdNames?.[0]);
                    const floorName = spaceForItem?.floor || 'unknown_floor';
                    groupKey = `Floor_${floorName}_${item.name}`;
                }
                
                if (!logicalGroups[groupKey]) {
                    logicalGroups[groupKey] = [];
                }
                logicalGroups[groupKey].push(item);
            }

            const uiItems: UIUtilityItem[] = Object.values(logicalGroups).map(group => {
                const firstItem = group[0];
                const spaceForFirstItem = selectedBuilding.spaces.find(s => s.spaceIdName === firstItem.applicableSpaceIdNames?.[0]);
                
                const groupTotalCost = group.reduce((sum, i) => sum + i.totalCost, 0);
                
                const perSpacePercentages: { [spaceId: string]: number } = {};
                if (groupTotalCost > 0) {
                    group.forEach(item => {
                        const space = selectedBuilding.spaces.find(s => s.spaceIdName === item.applicableSpaceIdNames?.[0]);
                        if (space) {
                            perSpacePercentages[space.id] = (item.totalCost / groupTotalCost) * 100;
                        }
                    });
                }
                
                // Determine the scope for the UI
                let scope: UIUtilityItem['appliesToScope'] = 'SpecificSpaces';
                let applicableFloor: string | undefined = undefined;

                if (firstItem.appliesToScope === 'Building') {
                    scope = 'Building';
                } else if (spaceForFirstItem?.floor) {
                    const floorName = spaceForFirstItem.floor;
                    const spacesOnFloor = selectedBuilding.spaces.filter(s => s.floor === floorName);
                    const groupCoversAllSpacesOnFloor = spacesOnFloor.every(s => 
                        group.some(item => item.applicableSpaceIdNames?.includes(s.spaceIdName))
                    );
                    if (groupCoversAllSpacesOnFloor && group.length === spacesOnFloor.length) {
                        scope = 'Floor';
                        applicableFloor = floorName;
                    }
                }
                
                return {
                    uiId: `logical-${firstItem.name}-${spaceForFirstItem?.floor || firstItem.id}`,
                    name: firstItem.name,
                    appliesToScope: scope,
                    totalCost: groupTotalCost,
                    applicableFloor: applicableFloor,
                    perSpacePercentages: perSpacePercentages,
                    perSpaceCosts: {},
                };
            });

            setCurrentUtilityItems(uiItems.length > 0 ? uiItems : [createEmptyItem()]);
        } else {
          setCurrentUtilityItems([createEmptyItem()]);
        }
        setIsLoadingData(false);
      };
      fetchUtilities();
    } else if (isMounted) { 
      setCurrentUtilityItems([createEmptyItem()]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBuildingId, selectedYear, selectedMonth, isMounted]);
  
  const refreshUtilityRecordsList = async () => {
    setIsLoadingData(true); 
    const records = await getAllBuildingUtilitiesForListAction();
    
    setAllUtilityRecords(records.map(r => {
      const totalCost = (r.utilities || []).reduce((sum, util) => sum + util.totalCost, 0);
      return {
        ...r,
        totalCost: totalCost, // This is the new computed total cost
        createdAt: r.createdAt.toISOString(), 
        updatedAt: r.updatedAt?.toISOString() || r.createdAt.toISOString(),
        utilities: r.utilities.map(u => ({...u}))
      }
    }) as ClientBuildingMonthlyUtilitiesPrismaType[]);

    setIsLoadingData(false);
  };


  const handleAddUtilityItem = () => {
    if (!canSaveUtilities) return;
    setCurrentUtilityItems([...currentUtilityItems, createEmptyItem()]);
  };

  const handleRemoveUtilityItem = (uiIdToRemove: string) => {
    if (!canSaveUtilities) return;
    setCurrentUtilityItems(currentUtilityItems.filter(item => item.uiId !== uiIdToRemove));
  };

  const handleUtilityItemChange = (uiIdToChange: string, field: keyof UIUtilityItem, value: any) => {
    if (!canSaveUtilities) return;
    setCurrentUtilityItems(prevItems => prevItems.map(item => {
        if (item.uiId !== uiIdToChange) return item;

        let updatedItem = { ...item, [field]: value };

        if (field === 'appliesToScope') {
            updatedItem.totalCost = 0;
            updatedItem.perSpaceCosts = {};
            updatedItem.perSpacePercentages = {};
            updatedItem.applicableFloor = '';
        }
        
        return updatedItem;
    }));
  };

   const handlePerSpaceCostChange = (uiId: string, spaceId: string, costStr: string) => {
        if (!canSaveUtilities) return;
        const cost = parseFloat(costStr);
        setCurrentUtilityItems(prev => prev.map(item => {
            if (item.uiId !== uiId) return item;
            
            const newPerSpaceCosts = { ...item.perSpaceCosts, [spaceId]: isNaN(cost) ? 0 : cost };
            return { ...item, perSpaceCosts: newPerSpaceCosts };
        }));
   };

   const handlePerSpacePercentageChange = (uiId: string, spaceId: string, percentageStr: string) => {
        if (!canSaveUtilities) return;
        const percentage = parseFloat(percentageStr);
        setCurrentUtilityItems(prev => prev.map(item => {
            if (item.uiId !== uiId) return item;
            
            const newPercentages = { ...item.perSpacePercentages, [spaceId]: isNaN(percentage) ? 0 : percentage };
            return { ...item, perSpacePercentages: newPercentages };
        }));
   };


  const handleSaveUtilities = async () => {
    if (!canSaveUtilities) {
      toast({ title: "Permission Denied", description: "You do not have permission to save utilities.", variant: "destructive" });
      return;
    }
    if (!selectedBuilding) {
      toast({ title: 'Error', description: 'Please select a building.', variant: 'destructive' });
      return;
    }

    const finalUtilityItemsForDb: BuildingUtilityItemInput[] = [];
    let validationFailed = false;

    for (const item of currentUtilityItems) {
      if (validationFailed) break;

      if (!item.name.trim()) {
        if (currentUtilityItems.length > 1 || (currentUtilityItems.length === 1 && (item.totalCost && item.totalCost > 0))) {
          toast({ title: 'Validation Error', description: `An unnamed utility item cannot be saved.`, variant: 'destructive' });
          validationFailed = true;
        }
        continue;
      }

      if (item.appliesToScope === 'Building') {
        if (!item.totalCost || item.totalCost <= 0) {
          toast({ title: 'Validation Error', description: `Utility "${item.name}" must have a positive Total Cost.`, variant: 'destructive' });
          validationFailed = true;
          continue;
        }
        finalUtilityItemsForDb.push({
          name: item.name,
          totalCost: item.totalCost,
          appliesToScope: item.appliesToScope,
        });
      } else if (item.appliesToScope === 'Floor' || item.appliesToScope === 'SpecificSpaces') {
        const totalCostForAllocation = item.totalCost || 0;
        if (totalCostForAllocation <= 0) {
          toast({ title: 'Validation Error', description: `Utility "${item.name}" must have a positive Total Cost for allocation.`, variant: 'destructive' });
          validationFailed = true;
          continue;
        }
        if (item.appliesToScope === 'Floor' && !item.applicableFloor) {
          toast({ title: 'Validation Error', description: `A floor must be selected for "${item.name}".`, variant: 'destructive' });
          validationFailed = true;
          continue;
        }

        const percentages = item.perSpacePercentages || {};
        const spacesToProcess = item.appliesToScope === 'Floor'
          ? selectedBuilding.spaces.filter(s => s.floor === item.applicableFloor)
          : selectedBuilding.spaces;
        
        for (const space of spacesToProcess) {
          const percentageForSpace = percentages[space.id] || 0;
          if (percentageForSpace > 0) {
            const costForSpace = totalCostForAllocation * (percentageForSpace / 100);
            finalUtilityItemsForDb.push({
              name: item.name,
              totalCost: parseFloat(costForSpace.toFixed(2)),
              appliesToScope: 'SpecificSpaces',
              applicableSpaceIdNames: [space.spaceIdName],
            });
          }
        }
      }
    }

    if (validationFailed) {
      return;
    }
    
    setIsSaving(true);
    try {
      const result = await saveBuildingUtilitiesAction(
        selectedBuilding.id,
        selectedBuilding.name,
        selectedYear,
        selectedMonth,
        finalUtilityItemsForDb
      );

      if (result?.success) {
        toast({ title: 'Utilities Saved', description: `Utility costs for ${selectedBuilding.name} for ${format(setMonth(setYear(new Date(), selectedYear), selectedMonth), 'MMMM yyyy')} have been saved.` });
        await refreshUtilityRecordsList();
      } else {
        toast({ title: 'Error Saving Utilities', description: result?.error || 'An unknown server error occurred.', variant: 'destructive' });
      }
    } catch (error) {
       console.error("Error during saveBuildingUtilitiesAction call:", error);
       toast({ title: 'Request Failed', description: 'Could not communicate with the server to save utilities.', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };


  const handleConfirmDelete = async () => {
    if (!recordToDelete || !canSaveUtilities) return;
    setIsSaving(true);
    const result = await deleteBuildingUtilitiesAction(recordToDelete.id);
    setIsSaving(false);
    
    if (result.success) {
      toast({ title: "Record Deleted", description: `Utility record for ${recordToDelete.buildingName} - ${format(setMonth(setYear(new Date(), recordToDelete.year), recordToDelete.month), 'MMMM yyyy')} has been removed.`});
      setAllUtilityRecords(prev => prev.filter(r => r.id !== recordToDelete.id));
    } else {
      toast({ title: "Error Deleting Record", description: result.error, variant: "destructive" });
    }
    setRecordToDelete(null);
  };
  
  const yearsForFilter = useMemo(() => {
    const years = new Set(allUtilityRecords.map(r => r.year));
    return Array.from(years).sort((a,b) => b - a);
  }, [allUtilityRecords]);
  
  const monthsForFilter = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => ({
      value: i,
      label: format(new Date(0, i), 'MMMM'),
    }));
  }, []);


  const yearsForEntry = Array.from({ length: 10 }, (_, i) => getYear(new Date()) - 5 + i); 
  const monthsForEntry = Array.from({ length: 12 }, (_, i) => ({
    value: i,
    label: format(new Date(0, i), 'MMMM'),
  }));

  const selectedBuildingName = registeredBuildings.find(b => b.id === selectedBuildingId)?.name || "";

  if (!isMounted && registeredBuildings.length === 0 && !canViewUtilities) {
    return <div className="flex justify-center items-center h-[calc(100vh-200px)]"><Loader2 className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"/></div>;
  }
  
  if (!canViewUtilities && isMounted) {
    return (
      <Card className="shadow-lg text-center py-12">
        <CardHeader><CardTitle className="text-destructive flex items-center justify-center"><EyeOff className="mr-2"/>Access Denied</CardTitle></CardHeader>
        <CardContent><p>You do not have permission to view building utilities.</p></CardContent>
      </Card>
    );
  }


  return (
    <div className="animate-fadeIn">
      {registeredBuildings.length === 0 && isMounted && (
         <Card className="mb-6 bg-yellow-50 border-yellow-300">
          <CardHeader><CardTitle className="text-yellow-700">No Buildings Registered</CardTitle>
            <CardDescription className="text-yellow-600">Please register buildings on the "Buildings" page first.</CardDescription>
          </CardHeader>
        </Card>
      )}

      <AlertDialog open={!!recordToDelete} onOpenChange={(open) => { if(!open) setRecordToDelete(null); }}>
        <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle className="flex items-center"><AlertTriangle className="text-destructive mr-2 h-5 w-5"/>Confirm Deletion</AlertDialogTitle>
            <AlertDialogDescription>
                Are you sure you want to delete the utility record for {recordToDelete?.buildingName} for {recordToDelete ? format(setMonth(setYear(new Date(), recordToDelete.year), recordToDelete.month), 'MMMM yyyy') : ''}? This action cannot be undone.
            </AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter> 
              <AlertDialogCancel onClick={() => setRecordToDelete(null)} disabled={isSaving}>Cancel</AlertDialogCancel> 
              <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive hover:bg-destructive/90" disabled={isSaving || !canSaveUtilities}> 
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Delete Record
              </AlertDialogAction> 
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline text-xl">Enter Utility Costs</CardTitle>
          <CardDescription>Select building and period, then input utility details. A bill due in a given month uses utilities from that same month.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <Label htmlFor="buildingName" className="flex items-center mb-1"><BuildingIconLucide className="mr-2 h-4 w-4 text-primary" />Building</Label>
              <Select value={selectedBuildingId} onValueChange={setSelectedBuildingId} disabled={registeredBuildings.length === 0 || isLoadingData || isSaving || !canSaveUtilities}>
                <SelectTrigger id="buildingName"><SelectValue placeholder="Select a building" /></SelectTrigger>
                <SelectContent>{registeredBuildings.map(building => (<SelectItem key={building.id} value={building.id}>{building.name}</SelectItem>))}</SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="year" className="flex items-center mb-1"><CalendarIcon className="mr-2 h-4 w-4 text-primary" />Year</Label>
              <Select value={String(selectedYear)} onValueChange={(val) => setSelectedYear(Number(val))} disabled={registeredBuildings.length === 0 || isLoadingData || isSaving || !canSaveUtilities}>
                <SelectTrigger id="year"><SelectValue /></SelectTrigger>
                <SelectContent>{yearsForEntry.map(year => (<SelectItem key={year} value={String(year)}>{year}</SelectItem>))}</SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="month" className="flex items-center mb-1"><CalendarIcon className="mr-2 h-4 w-4 text-primary" />Month</Label>
              <Select value={String(selectedMonth)} onValueChange={(val) => setSelectedMonth(Number(val))} disabled={registeredBuildings.length === 0 || isLoadingData || isSaving || !canSaveUtilities}>
                <SelectTrigger id="month"><SelectValue /></SelectTrigger>
                <SelectContent>{monthsForEntry.map(month => (<SelectItem key={month.value} value={String(month.value)}>{month.label}</SelectItem>))}</SelectContent>
              </Select>
            </div>
          </div>

          {selectedBuildingId && (
            <div className="space-y-4 pt-4 border-t">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold text-lg text-foreground">
                  Utility Items for {selectedBuildingName} - {format(setMonth(setYear(new Date(), selectedYear), selectedMonth), 'MMMM yyyy')}
                </h3>
                {canSaveUtilities && (
                  <Button variant="outline" onClick={handleAddUtilityItem} size="sm" disabled={isLoadingData || isSaving}>
                      <PlusCircle className="mr-2 h-4 w-4" /> Add Item
                  </Button>
                )}
              </div>
              {isLoadingData && <div className="flex justify-center py-4"><Loader2 className="animate-spin h-6 w-6 text-primary"/></div>}
              {!isLoadingData && currentUtilityItems.map((item, index) => {
                const totalPercentage = Object.values(item.perSpacePercentages || {}).reduce((sum, p) => sum + (p || 0), 0);

                return (
                <Card key={item.uiId} className="p-4 bg-secondary/30 shadow-sm">
                  <CardContent className="p-0 space-y-4">
                    <div className="flex justify-between items-start">
                        <Label className="text-base font-medium text-foreground">Utility Item {index + 1}</Label>
                        {canSaveUtilities && (
                          <Button variant="ghost" size="icon" onClick={() => handleRemoveUtilityItem(item.uiId)} className="text-destructive hover:bg-destructive/10 h-7 w-7" disabled={isSaving}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                       <div className="space-y-1.5">
                            <Label htmlFor={`utilityName-${item.uiId}`}>Type</Label>
                            <Input id={`utilityName-${item.uiId}`} placeholder="e.g., Electricity" value={item.name} onChange={(e) => handleUtilityItemChange(item.uiId, 'name', e.target.value)} disabled={isSaving || !canSaveUtilities}/>
                        </div>
                        <div className="space-y-1.5">
                             <Label htmlFor={`utilityScope-${item.uiId}`} className="flex items-center"><Layers className="mr-2 h-4 w-4 text-primary" />Applies To</Label>
                            <Select value={item.appliesToScope} onValueChange={(value) => handleUtilityItemChange(item.uiId, 'appliesToScope', value as UIUtilityItem['appliesToScope'])} disabled={isSaving || !canSaveUtilities}>
                                <SelectTrigger id={`utilityScope-${item.uiId}`}><SelectValue /></SelectTrigger>
                                <SelectContent><SelectItem value="Building">Entire Building</SelectItem><SelectItem value="Floor">Specific Floor</SelectItem><SelectItem value="SpecificSpaces">Specific Spaces</SelectItem></SelectContent>
                            </Select>
                        </div>
                    </div>
                    
                    {item.appliesToScope === 'Building' && (
                        <div className="space-y-1.5">
                            <Label htmlFor={`utilityCost-${item.uiId}`} className="flex items-center"><BanknoteIcon className="mr-1 h-3 w-3"/>Total Cost for Building</Label>
                            <Input id={`utilityCost-${item.uiId}`} type="number" placeholder="e.g., 500.00" value={item.totalCost || ''} onChange={(e) => handleUtilityItemChange(item.uiId, 'totalCost', parseFloat(e.target.value))} disabled={isSaving || !canSaveUtilities}/>
                            <p className="text-xs text-muted-foreground">This cost will be prorated among all spaces based on their individual Proration Share %.</p>
                        </div>
                    )}

                    {item.appliesToScope === 'Floor' && (
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                            <div className="space-y-1.5">
                                <Label htmlFor={`utilityCost-${item.uiId}`} className="flex items-center"><BanknoteIcon className="mr-1 h-3 w-3"/>Total Cost for Floor</Label>
                                <Input id={`utilityCost-${item.uiId}`} type="number" placeholder="e.g., 200.00" value={item.totalCost || ''} onChange={(e) => handleUtilityItemChange(item.uiId, 'totalCost', parseFloat(e.target.value))} disabled={isSaving || !canSaveUtilities}/>
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor={`applicableFloor-${item.uiId}`}>Floor</Label>
                                <Select value={item.applicableFloor || ''} onValueChange={(value) => handleUtilityItemChange(item.uiId, 'applicableFloor', value)} disabled={isSaving || !canSaveUtilities}>
                                    <SelectTrigger id={`applicableFloor-${item.uiId}`}><SelectValue placeholder="Select a floor" /></SelectTrigger>
                                    <SelectContent>{uniqueFloors.map(floor => (<SelectItem key={floor} value={floor}>{floor}</SelectItem>))}</SelectContent>
                                </Select>
                            </div>
                        </div>
                        {item.applicableFloor && (
                             <div className="space-y-2 pt-2">
                                <Label className="flex items-center text-sm font-medium"><Percent className="mr-2 h-4 w-4 text-primary"/>Per-Space Percentage Allocation</Label>
                                <p className="text-xs text-muted-foreground">Define how the total cost is split. This is not required to add up to 100%.</p>
                                <ScrollArea className="max-h-60 w-full rounded-md border p-2 bg-background">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 p-2">
                                        {selectedBuilding?.spaces.filter(s => s.floor === item.applicableFloor).map(space => (
                                            <div key={space.id} className="flex items-center gap-2">
                                                <Label htmlFor={`space-percent-${item.uiId}-${space.id}`} className="flex-1 text-sm text-muted-foreground truncate" title={space.spaceIdName}>
                                                    {space.spaceIdName}
                                                </Label>
                                                <div className="relative w-28">
                                                    <Input
                                                        id={`space-percent-${item.uiId}-${space.id}`}
                                                        type="number"
                                                        placeholder="0"
                                                        value={item.perSpacePercentages?.[space.id] || ''}
                                                        onChange={(e) => handlePerSpacePercentageChange(item.uiId, space.id, e.target.value)}
                                                        className="w-full h-8 pr-6"
                                                        disabled={isSaving || !canSaveUtilities}
                                                    />
                                                    <span className="absolute inset-y-0 right-0 flex items-center pr-2 text-muted-foreground text-sm">%</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </ScrollArea>
                                <div className="text-right text-sm font-medium mt-2">
                                    Total Allocated: 
                                    <span className="text-foreground ml-1">
                                        {totalPercentage.toFixed(2)}%
                                    </span>
                                </div>
                            </div>
                        )}
                      </div>
                    )}
                    
                    {item.appliesToScope === 'SpecificSpaces' && (
                        <div className="space-y-3">
                          <div className="space-y-1.5">
                            <Label htmlFor={`utilityCost-${item.uiId}`} className="flex items-center"><BanknoteIcon className="mr-1 h-3 w-3"/>Total Cost to Allocate</Label>
                            <Input id={`utilityCost-${item.uiId}`} type="number" placeholder="e.g., 300.00" value={item.totalCost || ''} onChange={(e) => handleUtilityItemChange(item.uiId, 'totalCost', parseFloat(e.target.value))} disabled={isSaving || !canSaveUtilities}/>
                          </div>

                          <div className="space-y-2 pt-2">
                            <Label className="flex items-center text-sm font-medium"><Percent className="mr-2 h-4 w-4 text-primary"/>Per-Space Percentage Allocation</Label>
                            <p className="text-xs text-muted-foreground">Define how the total cost is split across any spaces. This is not required to add up to 100%.</p>
                            <ScrollArea className="max-h-60 w-full rounded-md border p-2 bg-background">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 p-2">
                                {(selectedBuilding?.spaces ?? []).length > 0 ? selectedBuilding?.spaces.map(space => (
                                    <div key={space.id} className="flex items-center gap-2">
                                        <Label htmlFor={`space-percent-${item.uiId}-${space.id}`} className="flex-1 text-sm text-muted-foreground truncate" title={space.spaceIdName}>
                                            {space.spaceIdName}
                                        </Label>
                                        <div className="relative w-28">
                                            <Input
                                                id={`space-percent-${item.uiId}-${space.id}`}
                                                type="number"
                                                placeholder="0"
                                                value={item.perSpacePercentages?.[space.id] || ''}
                                                onChange={(e) => handlePerSpacePercentageChange(item.uiId, space.id, e.target.value)}
                                                className="w-full h-8 pr-6"
                                                disabled={isSaving || !canSaveUtilities}
                                            />
                                            <span className="absolute inset-y-0 right-0 flex items-center pr-2 text-muted-foreground text-sm">%</span>
                                        </div>
                                    </div>
                                )) : (
                                    <p className="text-sm text-muted-foreground text-center col-span-2">No spaces found in this building.</p>
                                )}
                              </div>
                            </ScrollArea>
                            <div className="text-right text-sm font-medium mt-2">
                                Total Allocated: 
                                <span className="text-foreground ml-1">
                                    {totalPercentage.toFixed(2)}%
                                </span>
                            </div>
                          </div>
                        </div>
                    )}

                  </CardContent>
                </Card>
                );
              })}
            </div>
          )}
        </CardContent>
        {canSaveUtilities && (
          <CardFooter className="border-t p-6">
            <Button onClick={handleSaveUtilities} disabled={!selectedBuildingId || currentUtilityItems.length === 0 || registeredBuildings.length === 0 || isLoadingData || isSaving || !canSaveUtilities} className="w-full md:w-auto bg-primary hover:bg-primary/90 text-primary-foreground">
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
              Save Utilities for {selectedBuildingName ? `${selectedBuildingName} - ${format(setMonth(setYear(new Date(), selectedYear), selectedMonth), 'MMMM yyyy')}` : 'Selected Period'}
            </Button>
          </CardFooter>
        )}
      </Card>

      <Card className="mt-8 shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline text-xl">Saved Utility Records</CardTitle>
          <CardDescription>Overview of previously entered utility costs. Click the edit icon to load and modify a record.</CardDescription>
        </CardHeader>
        <CardContent>
           <div className="flex flex-col sm:flex-row gap-2 mb-4">
              <div className="relative flex-grow">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  id="utility-filter"
                  placeholder="Filter by building name..."
                  className="pl-10 h-9"
                  value={utilityFilterTerm}
                  onChange={(e) => setUtilityFilterTerm(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Select value={String(filterYear)} onValueChange={(val) => { setFilterYear(val === 'all' ? 'all' : Number(val)); if(val === 'all') setFilterMonth('all'); }}>
                    <SelectTrigger className="w-full sm:w-[120px] h-9">
                        <SelectValue placeholder="Year" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Years</SelectItem>
                        {yearsForFilter.map(year => (
                            <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Select value={String(filterMonth)} onValueChange={(val) => setFilterMonth(val === 'all' ? 'all' : Number(val))} disabled={filterYear === 'all'}>
                    <SelectTrigger className="w-full sm:w-[150px] h-9">
                        <SelectValue placeholder="Month" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Months</SelectItem>
                        {monthsForFilter.map(month => (
                             <SelectItem key={month.value} value={String(month.value)}>{month.label}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
           </div>

          {isLoadingData && filteredRecords.length === 0 && <div className="flex justify-center py-4"><Loader2 className="animate-spin h-6 w-6 text-primary"/></div>}
          {!isLoadingData && filteredRecords.length === 0 && (<p className="text-muted-foreground text-center py-4">{utilityFilterTerm || filterYear !== 'all' ? "No records match your filters." : "No utility records saved yet."}</p>)}
          {filteredRecords.length > 0 && (
            <>
              <div className="border rounded-md overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Building</TableHead>
                      <TableHead>Period</TableHead>
                      <TableHead className="text-right">Total Cost</TableHead>
                      <TableHead className="text-center hidden sm:table-cell">Items</TableHead>
                      <TableHead className="hidden md:table-cell">Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedUtilityRecords.map(entry => {
                      const totalCost = (entry.utilities || []).reduce((sum, util) => sum + util.totalCost, 0);
                      return (
                        <TableRow key={entry.id}>
                          <TableCell className="font-medium">{entry.buildingName}</TableCell>
                          <TableCell>{format(setMonth(setYear(new Date(), entry.year), entry.month), 'MMMM yyyy')}</TableCell>
                          <TableCell className="text-right whitespace-nowrap">{totalCost.toFixed(2)} Birr</TableCell>
                          <TableCell className="text-center hidden sm:table-cell">{(entry.utilities || []).length}</TableCell>
                          <TableCell className="hidden md:table-cell text-xs">{format(parseISO(entry.createdAt), 'PP')}</TableCell>
                          <TableCell className="text-right">
                              <Button variant="ghost" size="icon" onClick={() => { setSelectedBuildingId(entry.buildingId); setSelectedYear(entry.year); setSelectedMonth(entry.month);}} className="h-8 w-8 text-blue-600 hover:text-blue-700">
                                  <Edit className="h-4 w-4" />
                                  <span className="sr-only">Edit Record</span>
                              </Button>
                              {canSaveUtilities && (
                                  <Button variant="ghost" size="icon" onClick={() => setRecordToDelete(entry)} disabled={isSaving} className="h-8 w-8 text-destructive hover:text-destructive/80">
                                      <Trash2 className="h-4 w-4" />
                                      <span className="sr-only">Delete Record</span>
                                  </Button>
                              )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
              <PaginationControls
                currentPage={recordsCurrentPage}
                totalPages={recordsTotalPages}
                onPageChange={setRecordsCurrentPage}
                itemsPerPage={recordsItemsPerPage}
                onItemsPerPageChange={handleRecordsItemsPerPageChange}
                className="mt-4"
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
