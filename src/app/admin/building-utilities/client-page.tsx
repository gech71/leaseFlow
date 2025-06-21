"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlusCircle, Trash2, Building as BuildingIconLucide, CalendarIcon, DollarSign as DollarSignIcon, Layers, HomeIcon, Loader2, EyeOff } from 'lucide-react';
import type { Building as BuildingPrismaType, BuildingMonthlyUtilities as BuildingMonthlyUtilitiesPrismaType, BuildingUtilityItem as BuildingUtilityItemPrismaType } from '@prisma/client';
import { useToast } from '@/hooks/use-toast';
import { getYear, getMonth, format, setYear, setMonth, parseISO } from 'date-fns';
import { Textarea } from '@/components/ui/textarea';
import { getBuildingUtilitiesAction, saveBuildingUtilitiesAction, getAllBuildingUtilitiesForListAction, type BuildingUtilityItemInput } from './actions';
import { usePermissions } from '@/contexts/PermissionContext';

interface UIUtilityItem extends BuildingUtilityItemInput {
  uiId: string; 
  applicableSpaceIdNamesStr?: string; 
}

interface ClientBuildingPrismaType extends Omit<BuildingPrismaType, 'createdAt' | 'updatedAt'> {
  createdAt: string;
  updatedAt: string;
}
interface ClientBuildingMonthlyUtilitiesPrismaType extends Omit<BuildingMonthlyUtilitiesPrismaType, 'createdAt' | 'updatedAt' | 'utilities'> {
  createdAt: string;
  updatedAt: string;
  utilities: BuildingUtilityItemPrismaType[]; 
}

interface BuildingUtilitiesClientPageProps {
  initialBuildings: ClientBuildingPrismaType[];
  initialUtilityRecords: ClientBuildingMonthlyUtilitiesPrismaType[];
}

export function BuildingUtilitiesClientPage({ initialBuildings, initialUtilityRecords }: BuildingUtilitiesClientPageProps) {
  const [allUtilityRecords, setAllUtilityRecords] = useState<ClientBuildingMonthlyUtilitiesPrismaType[]>(initialUtilityRecords);
  const [registeredBuildings, setRegisteredBuildings] = useState<ClientBuildingPrismaType[]>(initialBuildings);
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
        if (existingEntry) {
          setCurrentUtilityItems(existingEntry.utilities.map((u, index) => ({
            uiId: u.id || `dbItem-${index}-${Date.now()}`,
            name: u.name,
            totalCost: u.totalCost,
            appliesToScope: u.appliesToScope as BuildingUtilityItemInput['appliesToScope'],
            applicableFloor: u.applicableFloor || '',
            applicableSpaceIdNamesStr: u.applicableSpaceIdNames?.join(', ') || '',
            applicableSpaceIdNames: u.applicableSpaceIdNames || [],
          })));
        } else {
          setCurrentUtilityItems([{ uiId: `newItem-${Date.now()}`, name: '', totalCost: 0, appliesToScope: 'Building', applicableFloor: '', applicableSpaceIdNamesStr: '', applicableSpaceIdNames: [] }]);
        }
        setIsLoadingData(false);
      };
      fetchUtilities();
    } else if (isMounted) { 
      setCurrentUtilityItems([{ uiId: `newItem-${Date.now()}`, name: '', totalCost: 0, appliesToScope: 'Building', applicableFloor: '', applicableSpaceIdNamesStr: '', applicableSpaceIdNames: [] }]);
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
    setCurrentUtilityItems([...currentUtilityItems, { uiId: `newItem-${Date.now()}`, name: '', totalCost: 0, appliesToScope: 'Building', applicableFloor: '', applicableSpaceIdNamesStr: '', applicableSpaceIdNames: [] }]);
  };

  const handleRemoveUtilityItem = (uiIdToRemove: string) => {
    if (!canSaveUtilities) return;
    setCurrentUtilityItems(currentUtilityItems.filter(item => item.uiId !== uiIdToRemove));
  };

  const handleUtilityItemChange = (uiIdToChange: string, field: keyof UIUtilityItem, value: string | number | string[]) => {
    if (!canSaveUtilities) return;
    setCurrentUtilityItems(prevItems => prevItems.map(item => {
      if (item.uiId !== uiIdToChange) return item;
      
      let updatedItem = { ...item, [field]: value };

      if (field === 'totalCost' && typeof value === 'string') {
        updatedItem.totalCost = parseFloat(value) || 0;
      } else if (field === 'appliesToScope' && typeof value === 'string') {
        updatedItem.appliesToScope = value as BuildingUtilityItemInput['appliesToScope'];
        updatedItem.applicableFloor = ''; 
        updatedItem.applicableSpaceIdNamesStr = '';
        updatedItem.applicableSpaceIdNames = [];
      } else if (field === 'applicableSpaceIdNamesStr' && typeof value === 'string') {
        updatedItem.applicableSpaceIdNamesStr = value;
        updatedItem.applicableSpaceIdNames = value.split(',').map(s => s.trim()).filter(s => s);
      }
      return updatedItem;
    }));
  };

  const handleSaveUtilities = async () => {
    if (!canSaveUtilities) {
      toast({ title: "Permission Denied", description: "You do not have permission to save utilities.", variant: "destructive" });
      return;
    }
    if (!selectedBuildingId) {
      toast({ title: 'Error', description: 'Please select a building.', variant: 'destructive' });
      return;
    }
    const selectedBuildingObject = registeredBuildings.find(b => b.id === selectedBuildingId);
    if (!selectedBuildingObject) {
      toast({ title: 'Error', description: 'Selected building not found.', variant: 'destructive' });
      return;
    }

    const finalUtilityItemsForDb: BuildingUtilityItemInput[] = [];
    for (const item of currentUtilityItems) {
        if (!item.name.trim() || item.totalCost <= 0) {
            toast({ title: 'Validation Error', description: `Utility Item "${item.name || 'Unnamed'}" must have a name and a positive cost.`, variant: 'destructive' });
            return;
        }
        if (item.appliesToScope === 'Floor' && !item.applicableFloor?.trim()) {
            toast({ title: 'Validation Error', description: `Applicable floor is required for floor-scoped utility: "${item.name}".`, variant: 'destructive' });
            return;
        }
        if (item.appliesToScope === 'SpecificSpaces' && (!item.applicableSpaceIdNames || item.applicableSpaceIdNames.length === 0)) {
            toast({ title: 'Validation Error', description: `Applicable Space IDs are required for space-scoped utility: "${item.name}".`, variant: 'destructive' });
            return;
        }
        finalUtilityItemsForDb.push({
            name: item.name,
            totalCost: item.totalCost,
            appliesToScope: item.appliesToScope,
            applicableFloor: item.appliesToScope === 'Floor' ? item.applicableFloor : undefined,
            applicableSpaceIdNames: item.appliesToScope === 'SpecificSpaces' ? item.applicableSpaceIdNames : undefined,
        });
    }
    
    setIsSaving(true);
    const result = await saveBuildingUtilitiesAction(
      selectedBuildingId,
      selectedBuildingObject.name,
      selectedYear,
      selectedMonth,
      finalUtilityItemsForDb
    );
    setIsSaving(false);

    if (result.success) {
      toast({ title: 'Utilities Saved', description: `Utility costs for ${selectedBuildingObject.name} for ${format(setMonth(setYear(new Date(), selectedYear), selectedMonth), 'MMMM yyyy')} have been saved.` });
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
                    <div className="grid grid-cols-3 gap-4">
                        <div className="col-span-2">
                            <Label htmlFor={`utilityName-${item.uiId}`}>Type</Label>
                            <Input id={`utilityName-${item.uiId}`} placeholder="e.g., Electricity" value={item.name} onChange={(e) => handleUtilityItemChange(item.uiId, 'name', e.target.value)} className="mt-1.5" disabled={isSaving || !canSaveUtilities}/>
                        </div>
                        <div className="col-span-1">
                            <Label htmlFor={`utilityCost-${item.uiId}`} className="flex items-center"><DollarSignIcon className="mr-1 h-3 w-3"/>Total Cost</Label>
                            <Input id={`utilityCost-${item.uiId}`} type="number" placeholder="e.g., 500.00" value={item.totalCost} onChange={(e) => handleUtilityItemChange(item.uiId, 'totalCost', e.target.value)} className="mt-1.5" disabled={isSaving || !canSaveUtilities}/>
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor={`utilityScope-${item.uiId}`} className="flex items-center"><Layers className="mr-2 h-4 w-4 text-primary" />Applies To</Label>
                        <Select value={item.appliesToScope} onValueChange={(value) => handleUtilityItemChange(item.uiId, 'appliesToScope', value)} disabled={isSaving || !canSaveUtilities}>
                            <SelectTrigger id={`utilityScope-${item.uiId}`}><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="Building">Entire Building</SelectItem><SelectItem value="Floor">Specific Floor</SelectItem><SelectItem value="SpecificSpaces">Specific Spaces</SelectItem></SelectContent>
                        </Select>
                    </div>
                    {item.appliesToScope === 'Floor' && (
                        <div className="space-y-1.5">
                            <Label htmlFor={`applicableFloor-${item.uiId}`}>Floor Name</Label>
                            <Input id={`applicableFloor-${item.uiId}`} placeholder="e.g., 10th" value={item.applicableFloor || ''} onChange={(e) => handleUtilityItemChange(item.uiId, 'applicableFloor', e.target.value)} disabled={isSaving || !canSaveUtilities}/>
                        </div>
                    )}
                    {item.appliesToScope === 'SpecificSpaces' && (
                        <div className="space-y-1.5">
                            <Label htmlFor={`applicableSpaces-${item.uiId}`} className="flex items-center"><HomeIcon className="mr-2 h-4 w-4 text-primary"/>Space IDs (comma-separated)</Label>
                            <Textarea id={`applicableSpaces-${item.uiId}`} placeholder="e.g., Unit 10A, Office 201" value={item.applicableSpaceIdNamesStr || ''} onChange={(e) => handleUtilityItemChange(item.uiId, 'applicableSpaceIdNamesStr', e.target.value)} rows={2} disabled={isSaving || !canSaveUtilities}/>
                            <p className="text-xs text-muted-foreground">Enter exact 'Space ID/Name' from Spaces page.</p>
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
                                                {util.appliesToScope === 'SpecificSpaces' && util.applicableSpaceIdNames && util.applicableSpaceIdNames.length > 0 ? ` - Spaces: ${util.applicableSpaceIdNames.join(', ')}` : ''})</span></li>))}</ul>
                                <p className="text-xs text-muted-foreground/70 mt-1">Last Saved: {format(parseISO(entry.updatedAt as unknown as string), 'PPp')}</p>
                            </div></Button>))}</div>)}
        </CardContent>
      </Card>
    </div>
  );
}
