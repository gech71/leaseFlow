
"use client";

import { useState, useEffect, useMemo } from 'react';
import { PageHeader } from '@/components/custom/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Wrench, PlusCircle, Trash2, Building, CalendarIcon, DollarSign as DollarSignIcon } from 'lucide-react';
import type { BuildingMonthlyUtilities, BuildingUtilityItem, Space } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { getYear, getMonth, format, setYear, setMonth } from 'date-fns';

// Mock spaces data to derive building names (in a real app, fetch this)
const mockSpacesForBuildingNames: Space[] = [
  { id: 'space1', buildingName: 'Sunrise Tower', spaceIdName: 'Unit 101', area: 1200, floor: '10th', utilityProrationShare: 0.4, monthlyRentalPrice: 2500, isOccupied: true, tenantId: 'tenant1', createdAt: new Date().toISOString() },
  { id: 'space2', buildingName: 'Ocean View Plaza', spaceIdName: 'Suite 20A', area: 800, floor: '2nd', utilityProrationShare: 0.25, monthlyRentalPrice: 1800, isOccupied: false, createdAt: new Date().toISOString() },
  { id: 'space3', buildingName: 'Downtown Hub', spaceIdName: 'Office 5B', area: 1500, floor: '5th', utilityProrationShare: 0.35, monthlyRentalPrice: 3200, isOccupied: true, tenantId: 'tenant2', createdAt: new Date().toISOString() },
];


const getStoredBuildingUtilities = (): BuildingMonthlyUtilities[] => {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('buildingMonthlyUtilities');
    return stored ? JSON.parse(stored) : [];
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
  const [isMounted, setIsMounted] = useState(false);
  const { toast } = useToast();

  const [selectedBuilding, setSelectedBuilding] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<number>(getYear(new Date()));
  const [selectedMonth, setSelectedMonth] = useState<number>(getMonth(new Date())); // 0-11
  const [currentUtilityItems, setCurrentUtilityItems] = useState<BuildingUtilityItem[]>([]);

  const uniqueBuildingNames = useMemo(() => {
    return Array.from(new Set(mockSpacesForBuildingNames.map(space => space.buildingName)));
  }, []);

  useEffect(() => {
    setIsMounted(true);
    setAllUtilities(getStoredBuildingUtilities());
  }, []);

  useEffect(() => {
    if (selectedBuilding && isMounted) {
      const existingEntry = allUtilities.find(
        (entry) =>
          entry.buildingName === selectedBuilding &&
          entry.year === selectedYear &&
          entry.month === selectedMonth
      );
      setCurrentUtilityItems(existingEntry ? [...existingEntry.utilities] : [{ name: '', totalCost: 0 }]);
    } else {
      setCurrentUtilityItems([{ name: '', totalCost: 0 }]);
    }
  }, [selectedBuilding, selectedYear, selectedMonth, allUtilities, isMounted]);

  const handleAddUtilityItem = () => {
    setCurrentUtilityItems([...currentUtilityItems, { name: '', totalCost: 0 }]);
  };

  const handleRemoveUtilityItem = (index: number) => {
    const newItems = [...currentUtilityItems];
    newItems.splice(index, 1);
    setCurrentUtilityItems(newItems);
  };

  const handleUtilityItemChange = (index: number, field: keyof BuildingUtilityItem, value: string | number) => {
    const newItems = [...currentUtilityItems];
    if (field === 'totalCost' && typeof value === 'string') {
      newItems[index][field] = parseFloat(value) || 0;
    } else if (field === 'name' && typeof value === 'string') {
      newItems[index][field] = value;
    }
    setCurrentUtilityItems(newItems);
  };

  const handleSaveUtilities = () => {
    if (!selectedBuilding) {
      toast({ title: 'Error', description: 'Please select a building.', variant: 'destructive' });
      return;
    }
    if (currentUtilityItems.some(item => !item.name.trim() || item.totalCost <= 0)) {
      toast({ title: 'Error', description: 'Please ensure all utility items have a name and a positive cost.', variant: 'destructive' });
      return;
    }

    const utilityEntryId = `${selectedBuilding}-${selectedYear}-${selectedMonth}`;
    const newEntry: BuildingMonthlyUtilities = {
      id: utilityEntryId,
      buildingName: selectedBuilding,
      year: selectedYear,
      month: selectedMonth,
      utilities: currentUtilityItems,
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
        description="Enter monthly utility costs for each building. This data will be used for prorating tenant bills."
      />

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline text-xl">Enter Utility Costs</CardTitle>
          <CardDescription>Select a building, month, and year, then input the total costs for each utility type.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <Label htmlFor="buildingName" className="flex items-center mb-1"><Building className="mr-2 h-4 w-4 text-primary" />Building</Label>
              <Select value={selectedBuilding} onValueChange={setSelectedBuilding}>
                <SelectTrigger id="buildingName">
                  <SelectValue placeholder="Select a building" />
                </SelectTrigger>
                <SelectContent>
                  {uniqueBuildingNames.map(name => (
                    <SelectItem key={name} value={name}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="year" className="flex items-center mb-1"><CalendarIcon className="mr-2 h-4 w-4 text-primary" />Year</Label>
              <Select value={String(selectedYear)} onValueChange={(val) => setSelectedYear(Number(val))}>
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
              <Select value={String(selectedMonth)} onValueChange={(val) => setSelectedMonth(Number(val))}>
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
              <h3 className="font-semibold text-lg text-foreground">
                Utility Items for {selectedBuilding} - {format(setMonth(setYear(new Date(), selectedYear), selectedMonth), 'MMMM yyyy')}
              </h3>
              {currentUtilityItems.map((item, index) => (
                <div key={index} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center p-3 border rounded-md bg-secondary/30">
                  <div className="md:col-span-1">
                    <Label htmlFor={`utilityName-${index}`}>Utility Type</Label>
                    <Input
                      id={`utilityName-${index}`}
                      placeholder="e.g., Electricity, Water"
                      value={item.name}
                      onChange={(e) => handleUtilityItemChange(index, 'name', e.target.value)}
                    />
                  </div>
                  <div className="md:col-span-1">
                    <Label htmlFor={`utilityCost-${index}`} className="flex items-center"><DollarSignIcon className="mr-1 h-3 w-3"/>Total Cost for Building</Label>
                    <Input
                      id={`utilityCost-${index}`}
                      type="number"
                      placeholder="e.g., 500.00"
                      value={item.totalCost}
                      onChange={(e) => handleUtilityItemChange(index, 'totalCost', e.target.value)}
                    />
                  </div>
                  <div className="md:col-span-1 flex justify-end pt-5">
                    {currentUtilityItems.length > 1 && (
                      <Button variant="ghost" size="icon" onClick={() => handleRemoveUtilityItem(index)} className="text-destructive hover:bg-destructive/10">
                        <Trash2 className="h-5 w-5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              <Button variant="outline" onClick={handleAddUtilityItem} className="mt-2">
                <PlusCircle className="mr-2 h-4 w-4" /> Add Another Utility Item
              </Button>
            </div>
          )}
        </CardContent>
        <CardFooter className="border-t pt-6">
          <Button onClick={handleSaveUtilities} disabled={!selectedBuilding || currentUtilityItems.length === 0} className="w-full md:w-auto bg-primary hover:bg-primary/90 text-primary-foreground">
            Save Monthly Utilities
          </Button>
        </CardFooter>
      </Card>

      <Card className="mt-8 shadow-lg">
        <CardHeader>
            <CardTitle className="font-headline text-xl">Saved Utility Records</CardTitle>
            <CardDescription>Overview of previously entered utility costs.</CardDescription>
        </CardHeader>
        <CardContent>
            {allUtilities.length === 0 ? (
                <p className="text-muted-foreground">No utility records saved yet.</p>
            ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                    {allUtilities.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map(entry => (
                        <div key={entry.id} className="p-4 border rounded-md">
                            <h4 className="font-semibold">{entry.buildingName} - {format(setMonth(setYear(new Date(), entry.year), entry.month), 'MMMM yyyy')}</h4>
                            <ul className="list-disc list-inside text-sm text-muted-foreground mt-1">
                                {entry.utilities.map(util => (
                                    <li key={util.name}>{util.name}: ${util.totalCost.toFixed(2)}</li>
                                ))}
                            </ul>
                            <p className="text-xs text-muted-foreground/70 mt-1">Saved: {format(new Date(entry.createdAt), 'Pp')}</p>
                        </div>
                    ))}
                </div>
            )}
        </CardContent>
      </Card>
    </div>
  );
}
