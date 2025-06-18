
"use client";

import { useState, useEffect, useMemo } from 'react';
import { PageHeader } from '@/components/custom/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Wrench, PlusCircle, Trash2, Building as BuildingIconLucide, CalendarIcon, DollarSign as DollarSignIcon, Layers, HomeIcon } from 'lucide-react';
import type { BuildingMonthlyUtilities, BuildingUtilityItem, Building } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { getYear, getMonth, format, setYear, setMonth } from 'date-fns';
import { Textarea } from '@/components/ui/textarea';

const getStoredBuildings = (): Building[] => {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('buildings');
    return stored ? JSON.parse(stored) : [];
  }
  return [];
};

const getStoredBuildingUtilities = (): BuildingMonthlyUtilities[] => {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('buildingMonthlyUtilities');
    if (stored) {
        try {
            const parsed = JSON.parse(stored) as BuildingMonthlyUtilities[];
            // Ensure default scope for older data
            return parsed.map(entry => ({
                ...entry,
                utilities: entry.utilities.map(util => ({
                    ...util,
                    appliesToScope: util.appliesToScope || 'Building',
                }))
            }));
        } catch (e) {
            console.error("Error parsing building utilities from localStorage", e);
            return [];
        }
    }
  }
  return [];
};

const storeBuildingUtilities = (utilities: BuildingMonthlyUtilities[]) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('buildingMonthlyUtilities', JSON.stringify(utilities));
  }
};

export default function BuildingUtilitiesPage() {
  const [allUtilities, setAllUtilities] = useState<BuildingMonthlyUtilities[]>([]);
  const [registeredBuildings, setRegisteredBuildings] = useState<Building[]>([]);
  const [isMounted, setIsMounted] = useState(false);
  const { toast } = useToast();

  const [selectedBuilding, setSelectedBuilding] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<number>(getYear(new Date()));
  const [selectedMonth, setSelectedMonth] = useState<number>(getMonth(new Date())); // 0-11
  
  // State for utility items being edited/added for the selected building/month/year
  const [currentUtilityItems, setCurrentUtilityItems] = useState<Array<Omit<BuildingUtilityItem, 'applicableSpaceIdNames'> & { applicableSpaceIdNamesStr?: string }>>([]);


  useEffect(() => {
    setIsMounted(true);
    setAllUtilities(getStoredBuildingUtilities());
    setRegisteredBuildings(getStoredBuildings());
  }, []);

  useEffect(() => {
    if (selectedBuilding && isMounted) {
      const existingEntry = allUtilities.find(
        (entry) =>
          entry.buildingName === selectedBuilding &&
          entry.year === selectedYear &&
          entry.month === selectedMonth
      );
      if (existingEntry) {
        setCurrentUtilityItems(existingEntry.utilities.map(u => ({
            ...u,
            appliesToScope: u.appliesToScope || 'Building', // Default if not present
            applicableSpaceIdNamesStr: u.applicableSpaceIdNames?.join(', ') || ''
        })));
      } else {
         setCurrentUtilityItems([{ name: '', totalCost: 0, appliesToScope: 'Building', applicableSpaceIdNamesStr: '' }]);
      }
    } else {
      setCurrentUtilityItems([{ name: '', totalCost: 0, appliesToScope: 'Building', applicableSpaceIdNamesStr: '' }]);
    }
  }, [selectedBuilding, selectedYear, selectedMonth, allUtilities, isMounted]);

  const handleAddUtilityItem = () => {
    setCurrentUtilityItems([...currentUtilityItems, { name: '', totalCost: 0, appliesToScope: 'Building', applicableSpaceIdNamesStr: '' }]);
  };

  const handleRemoveUtilityItem = (index: number) => {
    const newItems = [...currentUtilityItems];
    newItems.splice(index, 1);
    setCurrentUtilityItems(newItems);
  };

  const handleUtilityItemChange = (index: number, field: keyof (typeof currentUtilityItems[0]), value: string | number) => {
    const newItems = [...currentUtilityItems];
    const itemToUpdate = { ...newItems[index] };

    if (field === 'totalCost' && typeof value === 'string') {
        itemToUpdate[field] = parseFloat(value) || 0;
    } else if (field === 'name' && typeof value === 'string') {
        itemToUpdate[field] = value;
    } else if (field === 'appliesToScope' && typeof value === 'string') {
        itemToUpdate[field] = value as 'Building' | 'Floor' | 'SpecificSpaces';
        // Reset dependent fields when scope changes
        itemToUpdate.applicableFloor = '';
        itemToUpdate.applicableSpaceIdNamesStr = '';
    } else if (field === 'applicableFloor' && typeof value === 'string') {
        itemToUpdate[field] = value;
    } else if (field === 'applicableSpaceIdNamesStr' && typeof value === 'string') {
        itemToUpdate[field] = value;
    }
    newItems[index] = itemToUpdate;
    setCurrentUtilityItems(newItems);
  };

  const handleSaveUtilities = () => {
    if (!selectedBuilding) {
      toast({ title: 'Error', description: 'Please select a building.', variant: 'destructive' });
      return;
    }

    const finalUtilityItems: BuildingUtilityItem[] = currentUtilityItems.map(item => {
        if (!item.name.trim() || item.totalCost <= 0) {
            throw new Error('Please ensure all utility items have a name and a positive cost.');
        }
        if (item.appliesToScope === 'Floor' && !item.applicableFloor?.trim()) {
            throw new Error('Applicable floor is required for floor-scoped utilities.');
        }
        if (item.appliesToScope === 'SpecificSpaces' && !item.applicableSpaceIdNamesStr?.trim()) {
            throw new Error('Applicable Space IDs are required for space-scoped utilities.');
        }
        
        const { applicableSpaceIdNamesStr, ...rest } = item;
        return {
            ...rest,
            applicableSpaceIdNames: item.appliesToScope === 'SpecificSpaces' 
                ? applicableSpaceIdNamesStr?.split(',').map(s => s.trim()).filter(s => s) 
                : undefined,
        };
    });


    if (finalUtilityItems.some(item => !item.name.trim() || item.totalCost <= 0 || 
        (item.appliesToScope === 'Floor' && !item.applicableFloor?.trim()) ||
        (item.appliesToScope === 'SpecificSpaces' && (!item.applicableSpaceIdNames || item.applicableSpaceIdNames.length === 0))
    )) {
      toast({ title: 'Error', description: 'Please ensure all utility items are correctly filled based on their scope.', variant: 'destructive' });
      return;
    }


    const utilityEntryId = `${selectedBuilding}-${selectedYear}-${selectedMonth}`;
    const newEntry: BuildingMonthlyUtilities = {
      id: utilityEntryId,
      buildingName: selectedBuilding,
      year: selectedYear,
      month: selectedMonth,
      utilities: finalUtilityItems,
      createdAt: new Date().toISOString(),
    };

    const updatedUtilities = allUtilities.filter(entry => entry.id !== utilityEntryId);
    updatedUtilities.push(newEntry);
    
    setAllUtilities(updatedUtilities);
    storeBuildingUtilities(updatedUtilities);

    toast({ title: 'Utilities Saved', description: `Utility costs for ${selectedBuilding} for ${format(setMonth(setYear(new Date(), selectedYear), selectedMonth), 'MMMM yyyy')} have been saved.` });
  };
  
  const years = Array.from({ length: 5 }, (_, i) => getYear(new Date()) - 2 + i);
  const months = Array.from({ length: 12 }, (_, i) => ({
    value: i, // 0-11
    label: format(new Date(0, i), 'MMMM'),
  }));


  if (!isMounted) {
    return <div className="flex justify-center items-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;
  }

  return (
    <div className="animate-fadeIn">
      <PageHeader
        title="Manage Building Utilities"
        icon={Wrench}
        description="Enter monthly utility costs for each building. Costs can apply to the entire building, specific floors, or specific spaces."
      />

      {registeredBuildings.length === 0 && (
         <Card className="mb-6 bg-yellow-50 border-yellow-300">
          <CardHeader>
            <CardTitle className="text-yellow-700">No Buildings Registered</CardTitle>
            <CardDescription className="text-yellow-600">
              Please register buildings on the "Buildings" page before managing their utilities.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline text-xl">Enter Utility Costs</CardTitle>
          <CardDescription>Select a building, month, and year, then input the total costs for each utility type and define its scope.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <Label htmlFor="buildingName" className="flex items-center mb-1"><BuildingIconLucide className="mr-2 h-4 w-4 text-primary" />Building</Label>
              <Select value={selectedBuilding} onValueChange={setSelectedBuilding} disabled={registeredBuildings.length === 0}>
                <SelectTrigger id="buildingName">
                  <SelectValue placeholder="Select a building" />
                </SelectTrigger>
                <SelectContent>
                  {registeredBuildings.map(building => (
                    <SelectItem key={building.id} value={building.name}>{building.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="year" className="flex items-center mb-1"><CalendarIcon className="mr-2 h-4 w-4 text-primary" />Year</Label>
              <Select value={String(selectedYear)} onValueChange={(val) => setSelectedYear(Number(val))} disabled={registeredBuildings.length === 0}>
                <SelectTrigger id="year">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map(year => (
                    <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="month" className="flex items-center mb-1"><CalendarIcon className="mr-2 h-4 w-4 text-primary" />Month</Label>
              <Select value={String(selectedMonth)} onValueChange={(val) => setSelectedMonth(Number(val))} disabled={registeredBuildings.length === 0}>
                <SelectTrigger id="month">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {months.map(month => (
                    <SelectItem key={month.value} value={String(month.value)}>{month.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {selectedBuilding && (
            <div className="space-y-4 pt-4 border-t">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold text-lg text-foreground">
                  Utility Items for {selectedBuilding} - {format(setMonth(setYear(new Date(), selectedYear), selectedMonth), 'MMMM yyyy')}
                </h3>
                <Button variant="outline" onClick={handleAddUtilityItem} size="sm">
                    <PlusCircle className="mr-2 h-4 w-4" /> Add Utility Item
                </Button>
              </div>
              {currentUtilityItems.map((item, index) => (
                <Card key={index} className="p-4 bg-secondary/30 shadow-sm">
                  <CardContent className="p-0 space-y-3">
                    <div className="flex justify-between items-start">
                        <Label className="text-base font-medium text-foreground">Utility Item {index + 1}</Label>
                        {currentUtilityItems.length > 1 && (
                          <Button variant="ghost" size="icon" onClick={() => handleRemoveUtilityItem(index)} className="text-destructive hover:bg-destructive/10 h-7 w-7">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor={`utilityName-${index}`}>Utility Type</Label>
                            <Input
                            id={`utilityName-${index}`}
                            placeholder="e.g., Electricity, Water, Floor Maintenance"
                            value={item.name}
                            onChange={(e) => handleUtilityItemChange(index, 'name', e.target.value)}
                            />
                        </div>
                        <div>
                            <Label htmlFor={`utilityCost-${index}`} className="flex items-center"><DollarSignIcon className="mr-1 h-3 w-3"/>Total Cost for Scope</Label>
                            <Input
                            id={`utilityCost-${index}`}
                            type="number"
                            placeholder="e.g., 500.00"
                            value={item.totalCost}
                            onChange={(e) => handleUtilityItemChange(index, 'totalCost', e.target.value)}
                            />
                        </div>
                    </div>
                    <div>
                        <Label htmlFor={`utilityScope-${index}`} className="flex items-center mb-1"><Layers className="mr-2 h-4 w-4 text-primary" />Applies To</Label>
                        <Select 
                            value={item.appliesToScope} 
                            onValueChange={(value) => handleUtilityItemChange(index, 'appliesToScope', value)}
                        >
                            <SelectTrigger id={`utilityScope-${index}`}>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Building">Entire Building</SelectItem>
                                <SelectItem value="Floor">Specific Floor</SelectItem>
                                <SelectItem value="SpecificSpaces">Specific Spaces</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    {item.appliesToScope === 'Floor' && (
                        <div>
                            <Label htmlFor={`applicableFloor-${index}`}>Applicable Floor</Label>
                            <Input
                            id={`applicableFloor-${index}`}
                            placeholder="e.g., 1st Floor, Ground, Penthouse"
                            value={item.applicableFloor || ''}
                            onChange={(e) => handleUtilityItemChange(index, 'applicableFloor', e.target.value)}
                            />
                        </div>
                    )}
                    {item.appliesToScope === 'SpecificSpaces' && (
                        <div>
                            <Label htmlFor={`applicableSpaces-${index}`} className="flex items-center"><HomeIcon className="mr-2 h-4 w-4 text-primary"/>Applicable Space IDs (comma-separated)</Label>
                            <Textarea
                            id={`applicableSpaces-${index}`}
                            placeholder="e.g., Unit 10A, Office 201, Suite 3B"
                            value={item.applicableSpaceIdNamesStr || ''}
                            onChange={(e) => handleUtilityItemChange(index, 'applicableSpaceIdNamesStr', e.target.value)}
                            rows={2}
                            />
                             <p className="text-xs text-muted-foreground mt-1">Enter the exact 'Space ID/Name' as registered on the Spaces page.</p>
                        </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
        <CardFooter className="border-t pt-6">
          <Button onClick={handleSaveUtilities} disabled={!selectedBuilding || currentUtilityItems.length === 0 || registeredBuildings.length === 0} className="w-full md:w-auto bg-primary hover:bg-primary/90 text-primary-foreground">
            Save Monthly Utilities for {selectedBuilding ? `${selectedBuilding} - ${format(setMonth(setYear(new Date(), selectedYear), selectedMonth), 'MMMM yyyy')}` : ''}
          </Button>
        </CardFooter>
      </Card>

      <Card className="mt-8 shadow-lg">
        <CardHeader>
            <CardTitle className="font-headline text-xl">Saved Utility Records</CardTitle>
            <CardDescription>Overview of previously entered utility costs. Click to edit.</CardDescription>
        </CardHeader>
        <CardContent>
            {allUtilities.length === 0 ? (
                <p className="text-muted-foreground">No utility records saved yet.</p>
            ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                    {allUtilities.sort((a,b) => {
                        if (b.year !== a.year) return b.year - a.year;
                        if (b.month !== a.month) return b.month - a.month;
                        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                    }).map(entry => (
                        <Button 
                            key={entry.id} 
                            variant="outline" 
                            className="w-full justify-start h-auto p-4 text-left"
                            onClick={() => {
                                setSelectedBuilding(entry.buildingName);
                                setSelectedYear(entry.year);
                                setSelectedMonth(entry.month);
                                // useEffect will populate currentUtilityItems
                            }}
                        >
                            <div className="w-full">
                                <h4 className="font-semibold">{entry.buildingName} - {format(setMonth(setYear(new Date(), entry.year), entry.month), 'MMMM yyyy')}</h4>
                                <ul className="list-disc list-inside text-sm text-muted-foreground mt-1">
                                    {entry.utilities.map((util, idx) => (
                                        <li key={idx}>
                                            {util.name}: ${util.totalCost.toFixed(2)}
                                            <span className="text-xs italic ml-1">
                                                (Scope: {util.appliesToScope}
                                                {util.appliesToScope === 'Floor' && util.applicableFloor ? ` - Floor: ${util.applicableFloor}` : ''}
                                                {util.appliesToScope === 'SpecificSpaces' && util.applicableSpaceIdNames && util.applicableSpaceIdNames.length > 0 ? ` - Spaces: ${util.applicableSpaceIdNames.join(', ')}` : ''}
                                                )
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                                <p className="text-xs text-muted-foreground/70 mt-1">Last Saved: {format(new Date(entry.createdAt), 'Pp')}</p>
                            </div>
                        </Button>
                    ))}
                </div>
            )}
        </CardContent>
      </Card>
    </div>
  );
}
