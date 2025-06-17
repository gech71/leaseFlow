
"use client";

import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/custom/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, FileText, User, AlertTriangle, CheckCircle, Loader2, Edit, Trash2, Microscope, Zap } from 'lucide-react';
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
import { addMonths, format, isBefore, startOfDay, isAfter, isSameDay, startOfMonth } from 'date-fns';

// Initial Mock Data (will be loaded into state)
const initialMockAgreements: Agreement[] = [
  {
    id: 'agreement1',
    tenantId: 'tenant1',
    tenantName: 'Alice Wonderland',
    spaceId: 'space1',
    spaceDescription: 'Unit 101, Sunrise Tower',
    agreementText: 'RENTAL AGREEMENT...',
    startDate: new Date(2023, 0, 15).toISOString(), // Jan 15, 2023
    monthlyRentalPrice: 2500,
    utilityRate: 0.05, // Example: 5% of rent for utilities
    createdAt: new Date(2023, 0, 10).toISOString(),
    paymentTermMonths: 12,
    initialPaymentMonths: 1,
    nextPaymentDueDate: addMonths(new Date(2023, 0, 15), 1).toISOString(), // Due Feb 15, 2023
  },
  {
    id: 'agreement2',
    tenantId: 'tenant2',
    tenantName: 'Bob The Builder',
    spaceId: 'space3',
    spaceDescription: 'Office 5B, Downtown Hub',
    agreementText: 'RENTAL AGREEMENT...',
    startDate: new Date(2024, 4, 1).toISOString(), // May 1, 2024
    monthlyRentalPrice: 3200,
    utilityRate: 0.05,
    createdAt: new Date(2024, 4, 1).toISOString(),
    paymentTermMonths: 6,
    initialPaymentMonths: 1,
    nextPaymentDueDate: addMonths(new Date(2024, 4, 1), 1).toISOString(), // Due June 1, 2024
  },
  {
    id: 'agreement3',
    tenantId: 'tenant3',
    tenantName: 'Carol Danvers',
    spaceId: 'space4', 
    spaceDescription: 'Penthouse Suite, Galaxy Tower',
    agreementText: 'PREMIUM RENTAL AGREEMENT...',
    startDate: new Date(2024, 6, 1).toISOString(), // July 1, 2024
    monthlyRentalPrice: 5000,
    utilityRate: 0.05,
    createdAt: new Date(2024, 6, 1).toISOString(),
    paymentTermMonths: 24,
    initialPaymentMonths: 3,
    nextPaymentDueDate: addMonths(new Date(2024, 6, 1), 3).toISOString(), // Due Oct 1, 2024
  },
];

const initialMockSpaces: Space[] = [
 { id: 'space1', buildingName: 'Sunrise Tower', spaceIdName: 'Unit 101', area: 1200, floor: '10th', utilityRate: 0.05, monthlyRentalPrice: 2500, isOccupied: true, tenantId: 'tenant1', createdAt: new Date().toISOString() },
 { id: 'space3', buildingName: 'Downtown Hub', spaceIdName: 'Office 5B', area: 1500, floor: '5th', utilityRate: 0.05, monthlyRentalPrice: 3200, isOccupied: true, tenantId: 'tenant2', createdAt: new Date().toISOString() },
 { id: 'space4', buildingName: 'Galaxy Tower', spaceIdName: 'Penthouse Suite', area: 3000, floor: 'Top', utilityRate: 0.05, monthlyRentalPrice: 5000, isOccupied: true, tenantId: 'tenant3', createdAt: new Date().toISOString() },
];

const initialBills: Bill[] = [
  { id: 'bill1', agreementId: 'agreement1', tenantId: 'tenant1', tenantName: 'Alice Wonderland', spaceDescription: 'Unit 101, Sunrise Tower', billDate: new Date(2024,5,1).toISOString(), dueDate: new Date(2024,5,15).toISOString(), rentAmount: 2500, utilityAmount: 2500 * 0.05, totalAmount: 2500 + (2500 * 0.05), status: 'Paid', paymentDate: new Date(2024,5,10).toISOString() },
  { id: 'bill2', agreementId: 'agreement2', tenantId: 'tenant2', tenantName: 'Bob The Builder', spaceDescription: 'Office 5B, Downtown Hub', billDate: new Date(2024,5,1).toISOString(), dueDate: new Date(2024,5,15).toISOString(), rentAmount: 3200, utilityAmount: 3200 * 0.05, totalAmount: 3200 + (3200 * 0.05), status: 'Pending' },
];

export default function BillingPage() {
  const [bills, setBills] = useState<Bill[]>(initialBills);
  const [agreements, setAgreements] = useState<Agreement[]>(initialMockAgreements);
  const [spaces, setSpaces] = useState<Space[]>(initialMockSpaces); // Though not modified in this flow, good practice if it could be
  
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
      return null;
    }

    const rentAmount = agreement.monthlyRentalPrice;
    // Utility rate from agreement is used if present and valid, otherwise space's rate.
    // Assuming utilityRate on agreement/space is a percentage (e.g., 0.05 for 5%).
    const utilityRateToUse = typeof agreement.utilityRate === 'number' ? agreement.utilityRate : space.utilityRate;
    const utilityAmount = rentAmount * utilityRateToUse;

    return {
      id: `bill-${Date.now()}-${agreement.id}`,
      agreementId: agreement.id,
      tenantId: agreement.tenantId,
      tenantName: agreement.tenantName,
      spaceDescription: agreement.spaceDescription,
      billDate: targetDueDate.toISOString(), // Bill date is the due date for simplicity
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

    // Check if a pending bill already exists for this specific due date
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
    if (!newBill) {
      toast({ title: "Error", description: "Could not create bill due to missing space information.", variant: "destructive" });
      return;
    }

    setBills(prev => [newBill, ...prev]);
    // Advance nextPaymentDueDate for this agreement
    setAgreements(prevAgreements => 
      prevAgreements.map(ag => 
        ag.id === agreementId 
          ? { ...ag, nextPaymentDueDate: addMonths(nextDueDate, 1).toISOString() } 
          : ag
      )
    );
    toast({ title: "Bill Generated", description: `New bill for ${agreement.tenantName} (Due: ${format(nextDueDate, 'PP')}) created.` });
  };


  const handleGenerateAllDueBills = () => {
    const today = startOfDay(new Date());
    let generatedCount = 0;
    let skippedCount = 0;
    const newBills: Bill[] = [];
    const updatedAgreementsData = [...agreements]; // Work on a copy

    agreements.forEach(agreement => {
      const agreementStartDate = startOfDay(new Date(agreement.startDate));
      const agreementEndDate = addMonths(agreementStartDate, agreement.paymentTermMonths);

      if (isBefore(today, agreementStartDate) || isAfter(today, agreementEndDate)) {
        skippedCount++; // Agreement not active or expired
        return;
      }

      const nextDueDate = startOfDay(new Date(agreement.nextPaymentDueDate));

      if (isAfter(nextDueDate, today)) {
         // Only generate if due today or in the past.
         // For "due in X days", this logic would change.
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
        newBills.push(newBill);
        const currentAgreementIndex = updatedAgreementsData.findIndex(a => a.id === agreement.id);
        if (currentAgreementIndex > -1) {
          updatedAgreementsData[currentAgreementIndex] = {
            ...updatedAgreementsData[currentAgreementIndex],
            nextPaymentDueDate: addMonths(nextDueDate, 1).toISOString()
          };
        }
        generatedCount++;
      } else {
        skippedCount++; // Could not create bill (e.g. space not found)
      }
    });

    if (newBills.length > 0) {
      setBills(prev => [...newBills, ...prev].sort((a,b) => new Date(b.billDate).getTime() - new Date(a.billDate).getTime()));
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

    const previousBillsData = bills
      .filter(b => b.tenantId === bill.tenantId && new Date(b.billDate) < new Date(bill.billDate))
      .slice(0, 3) 
      .map(b => `Date: ${format(new Date(b.billDate), 'PP')}, Total: $${b.totalAmount.toFixed(2)}, Status: ${b.status}`)
      .join('\n');

    const input = {
      billData: `Current Bill for ${bill.tenantName} (${bill.spaceDescription}):\nDate: ${format(new Date(bill.billDate), 'PP')}\nDue Date: ${format(new Date(bill.dueDate), 'PP')}\nRent: $${bill.rentAmount.toFixed(2)}\nUtilities: $${bill.utilityAmount.toFixed(2)}\nTotal: $${bill.totalAmount.toFixed(2)}\nStatus: ${bill.status}`,
      agreementDetails: `Agreement for ${agreement.tenantName}:\nRent: $${agreement.monthlyRentalPrice.toFixed(2)}\nUtility Rate: ${agreement.utilityRate * 100}%\nStart Date: ${format(new Date(agreement.startDate), 'PP')}\nTerm: ${agreement.paymentTermMonths} months\nInitial Pmt: ${agreement.initialPaymentMonths} month(s)\nNext Official Due: ${format(new Date(agreement.nextPaymentDueDate), 'PP')}\n${agreement.additionalTerms ? 'Additional Terms: ' + agreement.additionalTerms : ''}`,
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
                    {/* Placeholder for Edit/Delete Bill. For now, they do nothing. */}
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


