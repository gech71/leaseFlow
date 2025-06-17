
"use client";

import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/custom/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DollarSign, FileText, User, AlertTriangle, CheckCircle, Loader2, Edit, Trash2, Microscope, Zap, Building } from 'lucide-react';
import type { Bill, Agreement, Space } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { analyzeBillAction } from '@/app/actions';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { ScrollArea } from '@/components/ui/scroll-area';
import { addMonths, format, isBefore, startOfDay, isAfter, isSameDay } from 'date-fns';

const initialMockAgreements: Agreement[] = [
  {
    id: 'agreement1',
    tenantId: 'tenant1',
    tenantName: 'Alice Wonderland',
    spaceId: 'space1',
    spaceDescription: 'Unit 101, Sunrise Tower',
    agreementText: 'RENTAL AGREEMENT...',
    startDate: new Date(2023, 0, 15).toISOString(),
    monthlyRentalPrice: 2500,
    createdAt: new Date(2023, 0, 10).toISOString(),
    paymentTermMonths: 12,
    initialPaymentMonths: 1,
    nextPaymentDueDate: addMonths(new Date(2023, 0, 15), 1).toISOString(),
  },
  {
    id: 'agreement2',
    tenantId: 'tenant2',
    tenantName: 'Bob The Builder',
    spaceId: 'space3',
    spaceDescription: 'Office 5B, Downtown Hub',
    agreementText: 'RENTAL AGREEMENT...',
    startDate: new Date(2024, 4, 1).toISOString(),
    monthlyRentalPrice: 3200,
    createdAt: new Date(2024, 4, 1).toISOString(),
    paymentTermMonths: 6,
    initialPaymentMonths: 1,
    nextPaymentDueDate: addMonths(new Date(2024, 4, 1), 1).toISOString(),
  },
  {
    id: 'agreement3',
    tenantId: 'tenant3',
    tenantName: 'Carol Danvers',
    spaceId: 'space4', 
    spaceDescription: 'Penthouse Suite, Galaxy Tower',
    agreementText: 'PREMIUM RENTAL AGREEMENT...',
    startDate: new Date(2024, 6, 1).toISOString(),
    monthlyRentalPrice: 5000,
    createdAt: new Date(2024, 6, 1).toISOString(),
    paymentTermMonths: 24,
    initialPaymentMonths: 3,
    nextPaymentDueDate: addMonths(new Date(2024, 6, 1), 3).toISOString(),
  },
];

const initialMockSpaces: Space[] = [
 { id: 'space1', buildingName: 'Sunrise Tower', spaceIdName: 'Unit 101', area: 1200, floor: '10th', utilityProrationShare: 0.40, monthlyRentalPrice: 2500, isOccupied: true, tenantId: 'tenant1', createdAt: new Date().toISOString() },
 { id: 'space3', buildingName: 'Downtown Hub', spaceIdName: 'Office 5B', area: 1500, floor: '5th', utilityProrationShare: 0.35, monthlyRentalPrice: 3200, isOccupied: true, tenantId: 'tenant2', createdAt: new Date().toISOString() },
 { id: 'space4', buildingName: 'Galaxy Tower', spaceIdName: 'Penthouse Suite', area: 3000, floor: 'Top', utilityProrationShare: 0.60, monthlyRentalPrice: 5000, isOccupied: true, tenantId: 'tenant3', createdAt: new Date().toISOString() },
 { id: 'space5', buildingName: 'Sunrise Tower', spaceIdName: 'Unit 102', area: 1000, floor: '10th', utilityProrationShare: 0.30, monthlyRentalPrice: 2200, isOccupied: false, tenantId: undefined, createdAt: new Date().toISOString()},
];

const initialBills: Bill[] = [
  { id: 'bill1', agreementId: 'agreement1', tenantId: 'tenant1', tenantName: 'Alice Wonderland', spaceDescription: 'Unit 101, Sunrise Tower', billDate: new Date(2024,5,1).toISOString(), dueDate: new Date(2024,5,15).toISOString(), rentAmount: 2500, utilityAmount: 200, totalAmount: 2700, status: 'Paid', paymentDate: new Date(2024,5,10).toISOString() }, // Assuming $500 building utility * 0.4 share
  { id: 'bill2', agreementId: 'agreement2', tenantId: 'tenant2', tenantName: 'Bob The Builder', spaceDescription: 'Office 5B, Downtown Hub', billDate: new Date(2024,5,1).toISOString(), dueDate: new Date(2024,5,15).toISOString(), rentAmount: 3200, utilityAmount: 175, totalAmount: 3375, status: 'Pending' }, // Assuming $500 building utility * 0.35 share
];

export default function BillingPage() {
  const [bills, setBills] = useState<Bill[]>(initialBills);
  const [agreements, setAgreements] = useState<Agreement[]>(initialMockAgreements);
  const [spaces, setSpaces] = useState<Space[]>(initialMockSpaces);
  const [buildingTotalUtilityCosts, setBuildingTotalUtilityCosts] = useState<Record<string, string>>({}); // buildingName: costString
  
  const [selectedBillForAnalysis, setSelectedBillForAnalysis] = useState<Bill | null>(null);
  const [analysisResult, setAnalysisResult] = useState<{ result: string; isAnomalous?: boolean; recommendations?: string } | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const createBillForAgreement = (agreement: Agreement, targetDueDate: Date): Bill | null => {
    const space = spaces.find(sp => sp.id === agreement.spaceId);
    if (!space) {
      console.error(`Space not found for agreement ${agreement.id}`);
      toast({ title: "Error", description: `Space details for ${agreement.spaceDescription} not found.`, variant: "destructive" });
      return null;
    }

    const rentAmount = agreement.monthlyRentalPrice;
    let utilityAmount = 0;
    
    const totalBuildingCostStr = buildingTotalUtilityCosts[space.buildingName];
    const totalBuildingCost = parseFloat(totalBuildingCostStr);

    if (!isNaN(totalBuildingCost) && totalBuildingCost > 0 && space.utilityProrationShare > 0) {
      utilityAmount = totalBuildingCost * space.utilityProrationShare;
    } else if (space.utilityProrationShare > 0) {
      toast({
        title: "Warning: Missing Building Utility Cost",
        description: `Total utility cost for ${space.buildingName} is not set or invalid. Utility amount for ${agreement.tenantName} will be $0.`,
        variant: "default"
      });
    }

    return {
      id: `bill-${Date.now()}-${agreement.id}`,
      agreementId: agreement.id,
      tenantId: agreement.tenantId,
      tenantName: agreement.tenantName,
      spaceDescription: agreement.spaceDescription,
      billDate: targetDueDate.toISOString(),
      dueDate: targetDueDate.toISOString(),
      rentAmount,
      utilityAmount,
      totalAmount: rentAmount + utilityAmount,
      status: 'Pending',
    };
  };
  
  const generateSingleBill = (agreementId: string) => {
    const agreement = agreements.find(ag => ag.id === agreementId);
    if (!agreement) {
      toast({ title: "Error", description: "Agreement not found.", variant: "destructive" });
      return;
    }

    const today = startOfDay(new Date());
    const agreementStartDate = startOfDay(new Date(agreement.startDate));
    const agreementEndDate = addMonths(agreementStartDate, agreement.paymentTermMonths);

    if (isBefore(today, agreementStartDate) || isAfter(today, agreementEndDate)) {
      toast({ title: "Info", description: "Agreement is not currently active or has expired.", variant: "default" });
      return;
    }
    
    const nextDueDate = startOfDay(new Date(agreement.nextPaymentDueDate));

    const existingPendingBill = bills.find(b => 
      b.agreementId === agreement.id && 
      b.status === 'Pending' &&
      isSameDay(startOfDay(new Date(b.dueDate)), nextDueDate)
    );

    if (existingPendingBill) {
      toast({ title: "Info", description: `A pending bill for ${format(nextDueDate, 'PP')} already exists for ${agreement.tenantName}.`, variant: "default" });
      return;
    }

    const newBill = createBillForAgreement(agreement, nextDueDate);
    if (!newBill) return; // Error handled in createBillForAgreement

    setBills(prev => [newBill, ...prev].sort((a,b) => new Date(b.billDate).getTime() - new Date(a.billDate).getTime()));
    setAgreements(prevAgreements => 
      prevAgreements.map(ag => 
        ag.id === agreementId 
          ? { ...ag, nextPaymentDueDate: addMonths(nextDueDate, 1).toISOString() } 
          : ag
      )
    );
    toast({ title: "Bill Generated", description: `New bill for ${agreement.tenantName} (Due: ${format(nextDueDate, 'PP')}) created. Total: $${newBill.totalAmount.toFixed(2)}` });
  };

  const handleGenerateAllDueBills = () => {
    const today = startOfDay(new Date());
    let generatedCount = 0;
    let skippedCount = 0;
    const newBillsBuffer: Bill[] = [];
    const updatedAgreementsData = [...agreements]; 

    agreements.forEach(agreement => {
      const agreementStartDate = startOfDay(new Date(agreement.startDate));
      const agreementEndDate = addMonths(agreementStartDate, agreement.paymentTermMonths);

      if (isBefore(today, agreementStartDate) || isAfter(today, agreementEndDate)) {
        skippedCount++; 
        return;
      }

      const nextDueDate = startOfDay(new Date(agreement.nextPaymentDueDate));

      if (isAfter(nextDueDate, today)) {
        skippedCount++; 
        return;
      }
      
      const existingPendingBill = bills.find(b => 
        b.agreementId === agreement.id && 
        b.status === 'Pending' &&
        isSameDay(startOfDay(new Date(b.dueDate)), nextDueDate)
      );

      if (existingPendingBill) {
        skippedCount++;
        return;
      }

      const newBill = createBillForAgreement(agreement, nextDueDate);
      if (newBill) {
        newBillsBuffer.push(newBill);
        const currentAgreementIndex = updatedAgreementsData.findIndex(a => a.id === agreement.id);
        if (currentAgreementIndex > -1) {
          updatedAgreementsData[currentAgreementIndex] = {
            ...updatedAgreementsData[currentAgreementIndex],
            nextPaymentDueDate: addMonths(nextDueDate, 1).toISOString()
          };
        }
        generatedCount++;
      } else {
        skippedCount++; 
      }
    });

    if (newBillsBuffer.length > 0) {
      setBills(prev => [...newBillsBuffer, ...prev].sort((a,b) => new Date(b.billDate).getTime() - new Date(a.billDate).getTime()));
    }
    setAgreements(updatedAgreementsData);
    toast({ title: "Bulk Bill Generation Complete", description: `${generatedCount} bills generated. ${skippedCount} agreements skipped.` });
  };

  const handleAnalyzeBill = async (bill: Bill) => {
    setSelectedBillForAnalysis(bill);
    setIsAnalyzing(true);
    setAnalysisResult(null);
    setAnalysisError(null);

    const agreement = agreements.find(ag => ag.id === bill.agreementId);
    if (!agreement) {
      setAnalysisError("Associated agreement not found for this bill.");
      setIsAnalyzing(false);
      toast({ title: "Error", description: "Associated agreement not found.", variant: "destructive" });
      return;
    }
    
    const space = spaces.find(s => s.id === agreement.spaceId);

    const previousBillsData = bills
      .filter(b => b.tenantId === bill.tenantId && new Date(b.billDate) < new Date(bill.billDate))
      .slice(0, 3) 
      .map(b => `Date: ${format(new Date(b.billDate), 'PP')}, Total: $${b.totalAmount.toFixed(2)}, Rent: $${b.rentAmount.toFixed(2)}, Utilities: $${b.utilityAmount.toFixed(2)}, Status: ${b.status}`)
      .join('\n');

    const agreementDetailsString = `Agreement for ${agreement.tenantName}:\nRent: $${agreement.monthlyRentalPrice.toFixed(2)}\nStart Date: ${format(new Date(agreement.startDate), 'PP')}\nTerm: ${agreement.paymentTermMonths} months\nInitial Pmt: ${agreement.initialPaymentMonths} month(s)\nNext Official Due: ${format(new Date(agreement.nextPaymentDueDate), 'PP')}\nSpace: ${space?.spaceIdName}, ${space?.buildingName}\nProration Share: ${space ? (space.utilityProrationShare * 100).toFixed(2) + '%' : 'N/A'}\n${agreement.additionalTerms ? 'Additional Terms: ' + agreement.additionalTerms : ''}`;

    const input = {
      billData: `Current Bill for ${bill.tenantName} (${bill.spaceDescription}):\nDate: ${format(new Date(bill.billDate), 'PP')}\nDue Date: ${format(new Date(bill.dueDate), 'PP')}\nRent: $${bill.rentAmount.toFixed(2)}\nUtilities: $${bill.utilityAmount.toFixed(2)}\nTotal: $${bill.totalAmount.toFixed(2)}\nStatus: ${bill.status}`,
      agreementDetails: agreementDetailsString,
      previousBills: previousBillsData || "No previous bills available for comparison.",
    };

    const result = await analyzeBillAction(input);
    setIsAnalyzing(false);
    if ('error' in result) {
      setAnalysisError(result.error);
      toast({ title: "Bill Analysis Failed", description: result.error, variant: "destructive" });
    } else {
      setAnalysisResult({ result: result.analysisResult, isAnomalous: result.isAnomalous, recommendations: result.recommendations });
      setBills(prevBills => prevBills.map(b => b.id === bill.id ? {...b, analysisResult: result.analysisResult, isAnomalous: result.isAnomalous, recommendations: result.recommendations } : b));
      toast({ title: "Bill Analysis Complete", description: "Check the analysis details." });
    }
  };
  
  const getStatusColor = (status: Bill['status']) => {
    switch (status) {
      case 'Paid': return 'text-green-600 bg-green-100';
      case 'Pending': return 'text-yellow-600 bg-yellow-100';
      case 'Overdue': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const uniqueBuildingNamesWithActiveTenants = Array.from(
    new Set(
      agreements
        .filter(ag => {
            const today = startOfDay(new Date());
            const agStartDate = startOfDay(new Date(ag.startDate));
            const agEndDate = addMonths(agStartDate, ag.paymentTermMonths);
            return !isBefore(today, agStartDate) && !isAfter(today, agEndDate); // Active agreements
        })
        .map(ag => spaces.find(s => s.id === ag.spaceId)?.buildingName)
        .filter((name): name is string => !!name)
    )
  );

  if (!isMounted) {
    return <div className="flex justify-center items-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;
  }

  return (
    <div className="animate-fadeIn">
      <PageHeader
        title="Billing Management"
        icon={DollarSign}
        description="Generate and analyze rental and utility bills."
      />

      <Card className="mb-6 shadow-sm">
        <CardHeader>
          <CardTitle className="font-headline">Building Utility Costs (Monthly Total)</CardTitle>
          <CardDescription>Enter the total utility cost for each building for the current billing period before generating bills.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {uniqueBuildingNamesWithActiveTenants.length > 0 ? uniqueBuildingNamesWithActiveTenants.map(buildingName => (
            <div key={buildingName} className="grid grid-cols-1 md:grid-cols-3 items-center gap-2 md:gap-4">
              <Label htmlFor={`building-utility-${buildingName}`} className="md:col-span-1 md:text-right font-medium flex items-center">
                <Building className="h-4 w-4 mr-2 text-primary"/>
                {buildingName}:
              </Label>
              <Input
                id={`building-utility-${buildingName}`}
                type="number"
                placeholder="e.g., 5000.00"
                value={buildingTotalUtilityCosts[buildingName] || ''}
                onChange={(e) => setBuildingTotalUtilityCosts(prev => ({ ...prev, [buildingName]: e.target.value }))}
                className="md:col-span-2"
              />
            </div>
          )) : <p className="text-muted-foreground">No buildings with active agreements found to set utility costs.</p>}
        </CardContent>
      </Card>

      <Card className="mb-6 shadow-sm">
        <CardHeader>
          <CardTitle className="font-headline">Generate Bills</CardTitle>
          <CardDescription>Generate bills for individual agreements or all due agreements.</CardDescription>
        </CardHeader>
        <CardContent>
            <Button onClick={handleGenerateAllDueBills} className="w-full md:w-auto bg-accent text-accent-foreground hover:bg-accent/90">
                <Zap className="mr-2 h-5 w-5" /> Generate All Due Bills
            </Button>
            <p className="text-xs text-muted-foreground mt-2">Generates bills for agreements where the 'Next Payment Due Date' is today or in the past, and no pending bill exists for that period. The agreement's 'Next Payment Due Date' will be advanced by one month after bill generation.</p>
        </CardContent>
        <CardHeader className="pt-4">
          <CardTitle className="font-headline text-lg">Individual Bill Generation</CardTitle>
          <CardDescription>Select an active agreement to generate its next due bill.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agreements.map(agreement => {
            const isAgreementActive = !isBefore(startOfDay(new Date()), startOfDay(new Date(agreement.startDate))) && !isAfter(startOfDay(new Date()), addMonths(startOfDay(new Date(agreement.startDate)), agreement.paymentTermMonths));
            const nextDueDate = startOfDay(new Date(agreement.nextPaymentDueDate));
            const isDue = isAgreementActive && !isAfter(nextDueDate, startOfDay(new Date()));
            
            return (
              <Card key={agreement.id} className={`bg-secondary/30 ${!isAgreementActive ? 'opacity-60' : ''}`}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold">{agreement.tenantName}</CardTitle>
                  <CardDescription className="text-xs">{agreement.spaceDescription}</CardDescription>
                   <CardDescription className="text-xs pt-1">
                    Next Due: {format(nextDueDate, 'PP')}
                    {!isAgreementActive && <span className="text-red-500 ml-1">(Inactive)</span>}
                    {isAgreementActive && isDue && <span className="text-green-600 ml-1">(Due)</span>}
                    {isAgreementActive && !isDue && <span className="text-blue-500 ml-1">(Upcoming)</span>}
                  </CardDescription>
                </CardHeader>
                <CardFooter>
                  <Button 
                    size="sm" 
                    onClick={() => generateSingleBill(agreement.id)} 
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                    disabled={!isAgreementActive}
                  >
                    Generate Bill
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </CardContent>
      </Card>
      
      <Dialog open={!!selectedBillForAnalysis && (!!analysisResult || isAnalyzing || !!analysisError)} onOpenChange={() => {setSelectedBillForAnalysis(null); setAnalysisResult(null); setAnalysisError(null); if(isAnalyzing) setIsAnalyzing(false);}}>
        <DialogContent className="sm:max-w-lg">
            <DialogHeader>
                <DialogTitle className="font-headline text-xl">Bill Analysis Result</DialogTitle>
                <DialogDescription>
                    AI-powered analysis for bill of {selectedBillForAnalysis?.tenantName} ({selectedBillForAnalysis?.spaceDescription}).
                </DialogDescription>
            </DialogHeader>
            {isAnalyzing && (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                    <Loader2 className="h-10 w-10 animate-spin text-primary mb-3" />
                    <p className="font-semibold">Analyzing bill...</p>
                    <p className="text-sm text-muted-foreground">This may take a few moments.</p>
                </div>
            )}
            {analysisError && !isAnalyzing && (
                 <div className="p-4 rounded-md bg-destructive text-destructive-foreground my-4">
                    <div className="flex items-center font-semibold mb-1">
                        <AlertTriangle className="h-5 w-5 mr-2"/> Analysis Error
                    </div>
                    <p className="text-sm">{analysisError}</p>
                </div>
            )}
            {analysisResult && !isAnalyzing && (
                <ScrollArea className="max-h-[60vh] p-1 pr-3 my-4">
                    <div className="space-y-4 text-sm py-2">
                        {analysisResult.isAnomalous && (
                             <div className="p-3 rounded-md bg-red-50 border border-red-200 text-red-700">
                                <div className="flex items-center font-semibold">
                                    <AlertTriangle className="h-5 w-5 mr-2"/> Anomaly Detected!
                                </div>
                            </div>
                        )}
                        {!analysisResult.isAnomalous && typeof analysisResult.isAnomalous === 'boolean' && (
                             <div className="p-3 rounded-md bg-green-50 border border-green-200 text-green-700">
                                <div className="flex items-center font-semibold">
                                    <CheckCircle className="h-5 w-5 mr-2"/> No Anomalies Detected.
                                </div>
                            </div>
                        )}
                        <div>
                            <h4 className="font-semibold text-foreground mb-1 mt-2">Analysis Details:</h4>
                            <p className="text-muted-foreground whitespace-pre-wrap">{analysisResult.result}</p>
                        </div>
                         {analysisResult.recommendations && (
                            <div>
                                <h4 className="font-semibold text-foreground mb-1 mt-3">Recommendations:</h4>
                                <p className="text-muted-foreground whitespace-pre-wrap">{analysisResult.recommendations}</p>
                            </div>
                        )}
                    </div>
                </ScrollArea>
            )}
            <DialogFooter>
                <DialogClose asChild>
                    <Button type="button" variant="outline">Close</Button>
                </DialogClose>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      {bills.length === 0 ? (
        <Card className="text-center py-12 shadow-sm">
          <CardContent>
            <DollarSign className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2 font-headline">No Bills Yet</h3>
            <p className="text-muted-foreground">Generate bills from active agreements to see them here.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
        <h2 className="text-2xl font-headline font-semibold">Generated Bills</h2>
        <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {bills.map((bill) => (
            <Card key={bill.id} className="flex flex-col shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardHeader>
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle className="font-headline text-lg">{bill.tenantName}</CardTitle>
                        <CardDescription className="text-xs">{bill.spaceDescription}</CardDescription>
                    </div>
                    <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${getStatusColor(bill.status)}`}>
                        {bill.status}
                    </span>
                </div>
              </CardHeader>
              <CardContent className="text-sm space-y-2 flex-grow">
                <p><strong>Bill Date:</strong> {format(new Date(bill.billDate), 'PP')}</p>
                <p><strong>Due Date:</strong> {format(new Date(bill.dueDate), 'PP')}</p>
                <p><strong>Rent:</strong> ${bill.rentAmount.toFixed(2)}</p>
                <p><strong>Utilities:</strong> ${bill.utilityAmount.toFixed(2)}</p>
                <p className="font-semibold text-base text-primary"><strong>Total:</strong> ${bill.totalAmount.toFixed(2)}</p>
                {bill.paymentDate && bill.status === 'Paid' && (
                    <p className="text-xs text-muted-foreground">Paid on: {format(new Date(bill.paymentDate), 'PP')}</p>
                )}
                {bill.analysisResult && (
                    <p className={`text-xs italic mt-2 p-2 rounded-md ${bill.isAnomalous ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                        {bill.isAnomalous ? <AlertTriangle className="inline h-4 w-4 mr-1"/> : <CheckCircle className="inline h-4 w-4 mr-1"/>}
                        AI Analysis: {bill.analysisResult.substring(0,50)}... (Click Analyze for full details)
                    </p>
                )}
              </CardContent>
              <CardFooter className="border-t pt-4 flex justify-between items-center">
                 <Button variant="outline" size="sm" onClick={() => handleAnalyzeBill(bill)} disabled={isAnalyzing && selectedBillForAnalysis?.id === bill.id}>
                  {isAnalyzing && selectedBillForAnalysis?.id === bill.id ? <Loader2 className="mr-1 h-4 w-4 animate-spin"/> : <Microscope className="mr-1 h-4 w-4" />}
                  Analyze
                </Button>
                <div className="flex gap-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toast({title: "Edit Bill", description:"Functionality coming soon."})}><Edit className="h-4 w-4"/></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => toast({title: "Delete Bill", description:"Functionality coming soon.", variant: "destructive"})}><Trash2 className="h-4 w-4"/></Button>
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
        </div>
      )}
    </div>
  );
}
