
"use client";

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlusCircle, Trash2, Building as BuildingIconLucide, CalendarIcon, DollarSign as DollarSignIcon, Layers, HomeIcon, Loader2, EyeOff, InfoIcon } from 'lucide-react';
import type { Building as BuildingPrismaType, BuildingMonthlyUtilities as BuildingMonthlyUtilitiesPrismaType, BuildingUtilityItem as BuildingUtilityItemPrismaType, Space as SpacePrismaType } from '@prisma/client';
import { useToast } from '@/hooks/use-toast';
import { getYear, getMonth, format, setYear, setMonth, parseISO } from 'date-fns';
import { getBuildingUtilitiesAction, saveBuildingUtilitiesAction, getAllBuildingUtilitiesForListAction, type BuildingUtilityItemInput } from './actions';
import { usePermissions } from '@/contexts/PermissionContext';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

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
interface ClientBuildingMonthlyUtilitiesPrismaType extends Omit<BuildingMonthlyUtilitiesPrismaType, 'createdAt' | 'updatedAt' | 'utilities'> {
  createdAt: string;
  updatedAt: string;
  utilities: BuildingUtilityItemPrismaType[]; 
}

// Internal state type for a "logical" utility item in the UI
interface UIUtilityItem {
  uiId: string;
  name: string;
  appliesToScope: 'Building' | 'Floor' | 'SpecificSpaces';
  totalCost?: number; // Used for Building/Floor scope
  applicableFloor?: string; // Used for Floor scope
  perSpaceCosts?: { [spaceId: string]: number }; // Used for SpecificSpaces scope
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

  const [selectedBuildingId, setSelectedBuildingId] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<number>(getYear(new Date()));
  const [selectedMonth, setSelectedMonth] = useState<number>(getMonth(new Date())); 
  
  const [currentUtilityItems, setCurrentUtilityItems] = useState<UIUtilityItem[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const { hasPermission, isSuperAdmin } = usePermissions();
  const canSaveUtilities = isSuperAdmin || hasPermission('building_utility:save');
  const canViewUtilities = isSuperAdmin || hasPermission('building_utility:view') || canSaveUtilities;

  const selectedBuilding = useMemo(() => {
    return registeredBuildings.find(b => b.id === selectedBuildingId);
  }, [selectedBuildingId, registeredBuildings]);
  
  const uniqueFloors = useMemo(() => {
    if (!selectedBuilding) return [];
    const floors = selectedBuilding.spaces.map(s => s.floor).filter(Boolean); // filter out null/empty floors
    // Sort numerically if possible, otherwise alphabetically
    return [...new Set(floors)].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [selectedBuilding]);


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
        
        if (existingEntry && existingEntry.utilities) {
            // Group DB items into logical UI items
            const groupedItems: { [name: string]: UIUtilityItem } = {};
            existingEntry.utilities.forEach((dbItem, index) => {
                if (dbItem.appliesToScope === 'SpecificSpaces') {
                    if (!groupedItems[dbItem.name]) {
                        groupedItems[dbItem.name] = {
                            uiId: `logical-${dbItem.name}-${Date.now()}`,
                            name: dbItem.name,
                            appliesToScope: 'SpecificSpaces',
                            perSpaceCosts: {},
                        };
                    }
                    const spaceName = dbItem.applicableSpaceIdNames?.[0];
                    const space = selectedBuilding?.spaces.find(s => s.spaceIdName === spaceName);
                    if (space && groupedItems[dbItem.name].perSpaceCosts) {
                        groupedItems[dbItem.name].perSpaceCosts![space.id] = dbItem.totalCost;
                    }
                } else {
                    // For Building/Floor, each DB item is one UI item
                    const uiId = dbItem.id || `dbItem-${index}-${Date.now()}`;
                    groupedItems[uiId] = {
                        uiId: uiId,
                        name: dbItem.name,
                        totalCost: dbItem.totalCost,
                        appliesToScope: dbItem.appliesToScope as 'Building' | 'Floor',
                        applicableFloor: dbItem.applicableFloor || undefined
                    };
                }
            });
            setCurrentUtilityItems(Object.values(groupedItems));
        } else {
          setCurrentUtilityItems([{ uiId: `newItem-${Date.now()}`, name: '', appliesToScope: 'Building', totalCost: 0, perSpaceCosts: {} }]);
        }
        setIsLoadingData(false);
      };
      fetchUtilities();
    } else if (isMounted) { 
      setCurrentUtilityItems([{ uiId: `newItem-${Date.now()}`, name: '', appliesToScope: 'Building', totalCost: 0, perSpaceCosts: {} }]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBuildingId, selectedYear, selectedMonth, isMounted]);
  
  const refreshUtilityRecordsList = async () => {
    setIsLoadingData(true); 
    const records = await getAllBuildingUtilitiesForListAction();
    setAllUtilityRecords(records.map(r => ({
      ...r,
      createdAt: r.createdAt.toISOString(), 
      updatedAt: r.updatedAt?.toISOString() || r.createdAt.toISOString(),
      utilities: r.utilities.map(u => ({...u}))
    })) as ClientBuildingMonthlyUtilitiesPrismaType[]);
    setIsLoadingData(false);
  };


  const handleAddUtilityItem = () => {
    if (!canSaveUtilities) return;
    setCurrentUtilityItems([...currentUtilityItems, { uiId: `newItem-${Date.now()}`, name: '', appliesToScope: 'Building', totalCost: 0, perSpaceCosts: {} }]);
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
    for (const item of currentUtilityItems) {
        if (!item.name.trim()) {
            toast({ title: 'Validation Error', description: `An unnamed utility item cannot be saved.`, variant: 'destructive' });
            return;
        }

        if (item.appliesToScope === 'Building' || item.appliesToScope === 'Floor') {
            if (!item.totalCost || item.totalCost <= 0) {
                 toast({ title: 'Validation Error', description: `Utility "${item.name}" must have a positive Total Cost.`, variant: 'destructive' });
                 return;
            }
             if (item.appliesToScope === 'Floor' && !item.applicableFloor?.trim()) {
                toast({ title: 'Validation Error', description: `Applicable floor is required for floor-scoped utility: "${item.name}".`, variant: 'destructive' });
                return;
            }
            finalUtilityItemsForDb.push({
                name: item.name,
                totalCost: item.totalCost,
                appliesToScope: item.appliesToScope,
                applicableFloor: item.applicableFloor || null,
                applicableSpaceIdNames: null,
            });
        } else if (item.appliesToScope === 'SpecificSpaces') {
            if (!item.perSpaceCosts || Object.keys(item.perSpaceCosts).length === 0) continue; // Skip if no costs entered

            for (const spaceId in item.perSpaceCosts) {
                const cost = item.perSpaceCosts[spaceId];
                if (cost > 0) {
                    const space = selectedBuilding.spaces.find(s => s.id === spaceId);
                    if (space) {
                        finalUtilityItemsForDb.push({
                            name: item.name,
                            totalCost: cost,
                            appliesToScope: 'SpecificSpaces',
                            applicableSpaceIdNames: [space.spaceIdName],
                            applicableFloor: null
                        });
                    }
                }
            }
        }
    }
    
    setIsSaving(true);
    const result = await saveBuildingUtilitiesAction(
      selectedBuilding.id,
      selectedBuilding.name,
      selectedYear,
      selectedMonth,
      finalUtilityItemsForDb
    );
    setIsSaving(false);

    if (result.success) {
      toast({ title: 'Utilities Saved', description: `Utility costs for ${selectedBuilding.name} for ${format(setMonth(setYear(new Date(), selectedYear), selectedMonth), 'MMMM yyyy')} have been saved.` });
      await refreshUtilityRecordsList(); 
    } else {
      toast({ title: 'Error Saving Utilities', description: result.error, variant: 'destructive' });
    }
  };
  
  const years = Array.from({ length: 10 }, (_, i) => getYear(new Date()) - 5 + i); 
  const months = Array.from({ length: 12 }, (_, i) => ({
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

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline text-xl">Enter Utility Costs</CardTitle>
          <CardDescription>Select building, month, and year, then input utility details.</CardDescription>
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
                <SelectContent>{years.map(year => (<SelectItem key={year} value={String(year)}>{year}</SelectItem>))}</SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="month" className="flex items-center mb-1"><CalendarIcon className="mr-2 h-4 w-4 text-primary" />Month</Label>
              <Select value={String(selectedMonth)} onValueChange={(val) => setSelectedMonth(Number(val))} disabled={registeredBuildings.length === 0 || isLoadingData || isSaving || !canSaveUtilities}>
                <SelectTrigger id="month"><SelectValue /></SelectTrigger>
                <SelectContent>{months.map(month => (<SelectItem key={month.value} value={String(month.value)}>{month.label}</SelectItem>))}</SelectContent>
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
              {!isLoadingData && currentUtilityItems.map((item, index) => (
                <Card key={item.uiId} className="p-4 bg-secondary/30 shadow-sm">
                  <CardContent className="p-0 space-y-4">
                    <div className="flex justify-between items-start">
                        <Label className="text-base font-medium text-foreground">Utility Item {index + 1}</Label>
                        {currentUtilityItems.length > 1 && canSaveUtilities && (
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
                            <Select value={item.appliesToScope} onValueChange={(value) => handleUtilityItemChange(item.uiId, 'appliesToScope', value)} disabled={isSaving || !canSaveUtilities}>
                                <SelectTrigger id={`utilityScope-${item.uiId}`}><SelectValue /></SelectTrigger>
                                <SelectContent><SelectItem value="Building">Entire Building</SelectItem><SelectItem value="Floor">Specific Floor</SelectItem><SelectItem value="SpecificSpaces">Specific Spaces</SelectItem></SelectContent>
                            </Select>
                        </div>
                    </div>
                    
                    {item.appliesToScope === 'Building' && (
                        <div className="space-y-1.5">
                            <Label htmlFor={`utilityCost-${item.uiId}`} className="flex items-center"><DollarSignIcon className="mr-1 h-3 w-3"/>Total Cost for Building</Label>
                            <Input id={`utilityCost-${item.uiId}`} type="number" placeholder="e.g., 500.00" value={item.totalCost || ''} onChange={(e) => handleUtilityItemChange(item.uiId, 'totalCost', parseFloat(e.target.value))} disabled={isSaving || !canSaveUtilities}/>
                        </div>
                    )}

                    {item.appliesToScope === 'Floor' && (
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                            <div className="space-y-1.5">
                                <Label htmlFor={`utilityCost-${item.uiId}`} className="flex items-center"><DollarSignIcon className="mr-1 h-3 w-3"/>Total Cost for Floor</Label>
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
                            <div className="space-y-1">
                                <Label className="text-xs font-medium text-muted-foreground">Spaces on this floor (for context):</Label>
                                <div className="flex flex-wrap gap-1.5 text-xs p-2 border rounded-md bg-background min-h-[40px]">
                                    {selectedBuilding?.spaces.filter(s => s.floor === item.applicableFloor).map(s => (
                                        <Badge key={s.id} variant="secondary" className="font-normal">{s.spaceIdName}</Badge>
                                    ))}
                                    {selectedBuilding?.spaces.filter(s => s.floor === item.applicableFloor).length === 0 && <span className="italic">No spaces found for this floor.</span>}
                                </div>
                            </div>
                        )}
                      </div>
                    )}
                    
                    {item.appliesToScope === 'SpecificSpaces' && (
                        <div className="space-y-2 pt-2">
                             <Label className="flex items-center text-sm font-medium"><HomeIcon className="mr-2 h-4 w-4 text-primary"/>Per-Space Costs</Label>
                             <p className="text-xs text-muted-foreground">Enter the specific cost for each space. Only spaces with a cost greater than zero will be saved.</p>
                             <ScrollArea className="max-h-60 w-full rounded-md border p-2 bg-background">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 p-2">
                                {(selectedBuilding?.spaces ?? []).length > 0 ? selectedBuilding?.spaces.map(space => (
                                    <div key={space.id} className="flex items-center gap-2">
                                        <Label htmlFor={`space-cost-${item.uiId}-${space.id}`} className="flex-1 text-sm text-muted-foreground truncate" title={space.spaceIdName}>
                                            {space.spaceIdName}
                                        </Label>
                                        <Input
                                            id={`space-cost-${item.uiId}-${space.id}`}
                                            type="number"
                                            placeholder="0.00"
                                            value={item.perSpaceCosts?.[space.id] || ''}
                                            onChange={(e) => handlePerSpaceCostChange(item.uiId, space.id, e.target.value)}
                                            className="w-28 h-8"
                                            disabled={isSaving || !canSaveUtilities}
                                        />
                                    </div>
                                )) : (
                                    <p className="text-sm text-muted-foreground text-center col-span-2">No spaces found in this building.</p>
                                )}
                                </div>
                             </ScrollArea>
                        </div>
                    )}

                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
        {canSaveUtilities && (
          <CardFooter className="border-t pt-6">
            <Button onClick={handleSaveUtilities} disabled={!selectedBuildingId || currentUtilityItems.length === 0 || registeredBuildings.length === 0 || isLoadingData || isSaving || !canSaveUtilities} className="w-full md:w-auto bg-primary hover:bg-primary/90 text-primary-foreground">
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
              Save Utilities for {selectedBuildingName ? `${selectedBuildingName} - ${format(setMonth(setYear(new Date(), selectedYear), selectedMonth), 'MMMM yyyy')}` : 'Selected Period'}
            </Button>
          </CardFooter>
        )}
      </Card>

      <Card className="mt-8 shadow-lg">
        <CardHeader><CardTitle className="font-headline text-xl">Saved Utility Records</CardTitle><CardDescription>Overview of previously entered utility costs. Click to edit.</CardDescription></CardHeader>
        <CardContent>
            {isLoadingData && allUtilityRecords.length === 0 && <div className="flex justify-center py-4"><Loader2 className="animate-spin h-6 w-6 text-primary"/></div>}
            {!isLoadingData && allUtilityRecords.length === 0 && (<p className="text-muted-foreground">No utility records saved yet in the database.</p>)}
            {allUtilityRecords.length > 0 && (
                <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                    {allUtilityRecords.map(entry => (
                        <Button key={entry.id} variant="outline" className="w-full justify-start h-auto p-4 text-left"
                            onClick={() => { setSelectedBuildingId(entry.buildingId); setSelectedYear(entry.year); setSelectedMonth(entry.month);}}>
                            <div className="w-full">
                                <h4 className="font-semibold">{entry.buildingName} - {format(setMonth(setYear(new Date(), entry.year), entry.month), 'MMMM yyyy')}</h4>
                                <ul className="list-disc list-inside text-sm text-muted-foreground mt-1">
                                    {entry.utilities.map((util, idx) => (
                                        <li key={util.id || `util-${idx}`}> {util.name}: ${util.totalCost.toFixed(2)}
                                            <span className="text-xs italic ml-1">
                                                (Scope: {util.appliesToScope}
                                                {util.appliesToScope === 'Floor' && util.applicableFloor ? ` - Floor: ${util.applicableFloor}` : ''}
                                                {util.appliesToScope === 'SpecificSpaces' && util.applicableSpaceIdNames && util.applicableSpaceIdNames.length > 0 ? ` - Space: ${util.applicableSpaceIdNames.join(', ')}` : ''})</span></li>))}</ul>
                                <p className="text-xs text-muted-foreground/70 mt-1">Last Saved: {format(parseISO(entry.updatedAt as unknown as string), 'PPp')}</p>
                            </div></Button>))}</div>)}
        </CardContent>
      </Card>
    </div>
  );
}
