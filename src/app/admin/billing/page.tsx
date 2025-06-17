
"use client";

import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/custom/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, FileText, User, AlertTriangle, CheckCircle, Loader2, Edit, Trash2, Microscope, Zap, CreditCard, CalendarIcon, InfoIcon } from 'lucide-react';
import type { Bill, Agreement, Space, BuildingMonthlyUtilities } from '@/lib/types';
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { addMonths, format, isBefore, startOfDay, isAfter, isSameDay, getYear, getMonth, parseISO } from 'date-fns';

// Mock data (ensure consistency with types.ts)
const initialMockAgreements: Agreement[] = [
  {
    id: 'agreement1', tenantId: 'tenant1', tenantName: 'Alice Wonderland', spaceId: 'space1', spaceDescription: 'Unit 101, Sunrise Tower', agreementText: 'RENTAL AGREEMENT...', startDate: new Date(2023, 0, 15).toISOString(), monthlyRentalPrice: 2500, createdAt: new Date(2023, 0, 10).toISOString(), paymentTermMonths: 12, initialPaymentMonths: 1, nextPaymentDueDate: addMonths(new Date(2023, 0, 15), 11).toISOString(),
  },
  {
    id: 'agreement2', tenantId: 'tenant2', tenantName: 'Bob The Builder', spaceId: 'space3', spaceDescription: 'Office 5B, Downtown Hub', agreementText: 'RENTAL AGREEMENT...', startDate: new Date(2024, 4, 1).toISOString(), monthlyRentalPrice: 3200, createdAt: new Date(2024, 4, 1).toISOString(), paymentTermMonths: 6, initialPaymentMonths: 1, nextPaymentDueDate: addMonths(new Date(2024, 4, 1), 1).toISOString(),
  },
  {
    id: 'agreement3', tenantId: 'tenant3', tenantName: 'Carol Danvers', spaceId: 'space4', spaceDescription: 'Penthouse Suite, Galaxy Tower', agreementText: 'PREMIUM RENTAL AGREEMENT...', startDate: new Date(2024, 6, 1).toISOString(), monthlyRentalPrice: 5000, createdAt: new Date(2024, 6, 1).toISOString(), paymentTermMonths: 24, initialPaymentMonths: 3, nextPaymentDueDate: addMonths(new Date(2024, 6, 1), 3).toISOString(),
  },
];

const initialMockSpaces: Space[] = [
 { id: 'space1', buildingName: 'Sunrise Tower', spaceIdName: 'Unit 101', area: 1200, floor: '10th', utilityProrationShare: 0.40, monthlyRentalPrice: 2500, isOccupied: true, tenantId: 'tenant1', createdAt: new Date().toISOString() },
 { id: 'space3', buildingName: 'Downtown Hub', spaceIdName: 'Office 5B', area: 1500, floor: '5th', utilityProrationShare: 0.35, monthlyRentalPrice: 3200, isOccupied: true, tenantId: 'tenant2', createdAt: new Date().toISOString() },
 { id: 'space4', buildingName: 'Galaxy Tower', spaceIdName: 'Penthouse Suite', area: 3000, floor: 'Top', utilityProrationShare: 0.60, monthlyRentalPrice: 5000, isOccupied: true, tenantId: 'tenant3', createdAt: new Date().toISOString() },
 { id: 'space5', buildingName: 'Sunrise Tower', spaceIdName: 'Unit 102', area: 1000, floor: '10th', utilityProrationShare: 0.30, monthlyRentalPrice: 2200, isOccupied: false, tenantId: undefined, createdAt: new Date().toISOString()},
];

const initialBills: Bill[] = [
  { id: 'bill1', agreementId: 'agreement1', tenantId: 'tenant1', tenantName: 'Alice Wonderland', spaceDescription: 'Unit 101, Sunrise Tower', billDate: new Date(2024,5,1).toISOString(), dueDate: new Date(2024,5,15).toISOString(), rentAmount: 2500, utilityBreakdown: [{name: "Electricity", amount: 80}, {name: "Water", amount: 20}], totalAmount: 2600, status: 'Paid', paymentDate: new Date(2024,5,10).toISOString(), paymentMethod: "Card", paymentReference: "TXN12345" },
  { id: 'bill2', agreementId: 'agreement2', tenantId: 'tenant2', tenantName: 'Bob The Builder', spaceDescription: 'Office 5B, Downtown Hub', billDate: new Date(2024,5,1).toISOString(), dueDate: new Date(2024,5,15).toISOString(), rentAmount: 3200, utilityBreakdown: [{name: "General Utility", amount: 175}], totalAmount: 3375, status: 'Pending' },
  { id: 'bill3', agreementId: 'agreement1', tenantId: 'tenant1', tenantName: 'Alice Wonderland', spaceDescription: 'Unit 101, Sunrise Tower', billDate: new Date(2024,4,1).toISOString(), dueDate: new Date(2024,4,15).toISOString(), rentAmount: 2500, utilityBreakdown: [{name: "Electricity", amount: 70}, {name: "Water", amount: 15}], totalAmount: 2585, status: 'Paid', paymentDate: new Date(2024,4,10).toISOString(), paymentMethod: "Bank Transfer", paymentReference: "REF9876", bankOrWalletName: "City Bank" },

];

const getStoredBuildingUtilities = (): BuildingMonthlyUtilities[] => {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('buildingMonthlyUtilities');
    return stored ? JSON.parse(stored) : [];
  }
  return [];
};

const paymentFormSchema = z.object({
  paymentDate: z.date({ required_error: "Payment date is required." }),
  paymentMethod: z.string().min(1, { message: "Payment method is required." }),
  paymentReference: z.string().optional(),
  bankOrWalletName: z.string().optional(),
}).refine(data => {
  if ((data.paymentMethod === "Bank Transfer" || data.paymentMethod === "Wallet") && (!data.bankOrWalletName || data.bankOrWalletName.trim() === "")) {
    return false;
  }
  return true;
}, {
  message: "Bank/Wallet name is required for this payment method.",
  path: ["bankOrWalletName"],
});

type PaymentFormValues = z.infer<typeof paymentFormSchema>;


export default function BillingPage() {
  const [bills, setBills] = useState<Bill[]>(initialBills);
  const [agreements, setAgreements] = useState<Agreement[]>(initialMockAgreements);
  const [spaces, setSpaces] = useState<Space[]>(initialMockSpaces);
  const [allBuildingUtilities, setAllBuildingUtilities] = useState<BuildingMonthlyUtilities[]>([]);
  
  const [selectedBillForAnalysis, setSelectedBillForAnalysis] = useState<Bill | null>(null);
  const [analysisResult, setAnalysisResult] = useState<{ result: string; isAnomalous?: boolean; recommendations?: string } | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [billForPayment, setBillForPayment] = useState<Bill | null>(null);

  const [isMounted, setIsMounted] = useState(false);
  const { toast } = useToast();

  const paymentForm = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: {
      paymentDate: new Date(),
      paymentMethod: "",
      paymentReference: "",
      bankOrWalletName: "",
    }
  });
  const paymentMethodWatcher = paymentForm.watch("paymentMethod");


  useEffect(() => {
    setIsMounted(true);
    setAllBuildingUtilities(getStoredBuildingUtilities());
  }, []);

  useEffect(() => {
    if (billForPayment) {
      paymentForm.reset({
        paymentDate: billForPayment.paymentDate ? parseISO(billForPayment.paymentDate) : new Date(),
        paymentMethod: billForPayment.paymentMethod || "",
        paymentReference: billForPayment.paymentReference || "",
        bankOrWalletName: billForPayment.bankOrWalletName || "",
      });
    }
  }, [billForPayment, paymentForm]);

  const createBillForAgreement = (agreement: Agreement, targetDueDate: Date): Bill | null => {
    const space = spaces.find(sp => sp.id === agreement.spaceId);
    if (!space) {
      console.error(`Space not found for agreement ${agreement.id}`);
      toast({ title: "Error", description: `Space details for ${agreement.spaceDescription} not found. Cannot generate bill.`, variant: "destructive" });
      return null;
    }

    const rentAmount = agreement.monthlyRentalPrice;
    const utilityBreakdown: Array<{ name: string; amount: number }> = [];
    let totalUtilityCostForBill = 0;

    const billYear = getYear(targetDueDate);
    const billMonth = getMonth(targetDueDate); 

    const monthlyBuildingUtilityData = allBuildingUtilities.find(
      entry => entry.buildingName === space.buildingName && entry.year === billYear && entry.month === billMonth
    );

    if (monthlyBuildingUtilityData && monthlyBuildingUtilityData.utilities.length > 0) {
      monthlyBuildingUtilityData.utilities.forEach(utilItem => {
        const proratedAmount = utilItem.totalCost * space.utilityProrationShare;
        utilityBreakdown.push({ name: utilItem.name, amount: parseFloat(proratedAmount.toFixed(2)) });
        totalUtilityCostForBill += proratedAmount;
      });
    } else if (space.utilityProrationShare > 0) {
       toast({
        title: "Warning: Missing Utility Data",
        description: `No utility costs found for ${space.buildingName} for ${format(targetDueDate, 'MMMM yyyy')}. Utility charges will be $0 for ${agreement.tenantName}. Visit 'Building Utilities' to add them.`,
        variant: "default",
        duration: 7000,
      });
    }
    
    const totalAmount = rentAmount + totalUtilityCostForBill;

    return {
      id: `bill-${Date.now()}-${agreement.id}`,
      agreementId: agreement.id,
      tenantId: agreement.tenantId,
      tenantName: agreement.tenantName,
      spaceDescription: agreement.spaceDescription,
      billDate: targetDueDate.toISOString(),
      dueDate: targetDueDate.toISOString(),
      rentAmount,
      utilityBreakdown,
      totalAmount: parseFloat(totalAmount.toFixed(2)),
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
    if (!newBill) return; 

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
    toast({ title: "Bulk Bill Generation Complete", description: `${generatedCount} bills generated. ${skippedCount} agreements skipped (not due, expired, or pending bill exists).` });
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
      .map(b => {
        const utilityDetail = b.utilityBreakdown.map(ub => `${ub.name}: $${ub.amount.toFixed(2)}`).join(', ');
        return `Date: ${format(new Date(b.billDate), 'PP')}, Total: $${b.totalAmount.toFixed(2)}, Rent: $${b.rentAmount.toFixed(2)}, Utilities: (${utilityDetail || 'N/A'}), Status: ${b.status}`;
      })
      .join('\n');

    const agreementDetailsString = `Agreement for ${agreement.tenantName}:\nRent: $${agreement.monthlyRentalPrice.toFixed(2)}\nStart Date: ${format(new Date(agreement.startDate), 'PP')}\nTerm: ${agreement.paymentTermMonths} months\nInitial Pmt: ${agreement.initialPaymentMonths} month(s)\nNext Official Due: ${format(new Date(agreement.nextPaymentDueDate), 'PP')}\nSpace: ${space?.spaceIdName}, ${space?.buildingName}\nProration Share: ${space ? (space.utilityProrationShare * 100).toFixed(2) + '%' : 'N/A'}\n${agreement.additionalTerms ? 'Additional Terms: ' + agreement.additionalTerms : ''}`;
    
    const currentBillUtilityDetail = bill.utilityBreakdown.map(ub => `  - ${ub.name}: $${ub.amount.toFixed(2)}`).join('\n');
    const billDataString = `Current Bill for ${bill.tenantName} (${bill.spaceDescription}):\nDate: ${format(new Date(bill.billDate), 'PP')}\nDue Date: ${format(new Date(bill.dueDate), 'PP')}\nRent: $${bill.rentAmount.toFixed(2)}\nUtilities:\n${currentBillUtilityDetail || '  - (No utility charges)'}\nTotal: $${bill.totalAmount.toFixed(2)}\nStatus: ${bill.status}`;

    const input = {
      billData: billDataString,
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

  const handleOpenPaymentDialog = (bill: Bill) => {
    setBillForPayment(bill);
    paymentForm.reset({
        paymentDate: bill.paymentDate ? parseISO(bill.paymentDate) : new Date(),
        paymentMethod: bill.paymentMethod || "",
        paymentReference: bill.paymentReference || "",
        bankOrWalletName: bill.bankOrWalletName || "",
      });
    setIsPaymentDialogOpen(true);
  };
  
  const handleRecordPaymentSubmit = (values: PaymentFormValues) => {
    if (!billForPayment) return;

    setBills(prevBills => 
      prevBills.map(b => 
        b.id === billForPayment.id 
        ? { 
            ...b, 
            status: 'Paid', 
            paymentDate: values.paymentDate.toISOString(),
            paymentMethod: values.paymentMethod,
            paymentReference: values.paymentReference,
            bankOrWalletName: (values.paymentMethod === "Bank Transfer" || values.paymentMethod === "Wallet") ? values.bankOrWalletName : undefined,
          } 
        : b
      )
    );
    toast({ title: "Payment Recorded", description: `Payment for bill ${billForPayment.id} has been successfully recorded.` });
    setIsPaymentDialogOpen(false);
    setBillForPayment(null);
    paymentForm.reset({
      paymentDate: new Date(),
      paymentMethod: "",
      paymentReference: "",
      bankOrWalletName: "",
    });
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
        description="Generate and analyze rental and utility bills. Ensure building utility costs are entered via 'Building Utilities' page before generation."
      />

      <Card className="mb-6 shadow-sm">
        <CardHeader>
          <CardTitle className="font-headline">Generate Bills</CardTitle>
          <CardDescription>Generate bills for individual agreements or all due agreements. Monthly utility costs must be entered on the 'Building Utilities' page for the respective month/year.</CardDescription>
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
            const isDueForGeneration = isAgreementActive && !isAfter(nextDueDate, startOfDay(new Date()));
            
            return (
              <Card key={agreement.id} className={`bg-secondary/30 ${!isAgreementActive ? 'opacity-60' : ''}`}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold">{agreement.tenantName}</CardTitle>
                  <CardDescription className="text-xs">{agreement.spaceDescription}</CardDescription>
                   <CardDescription className="text-xs pt-1">
                    Next Due: {format(nextDueDate, 'PP')}
                    {!isAgreementActive && <span className="text-red-500 ml-1">(Inactive/Expired)</span>}
                    {isAgreementActive && isDueForGeneration && <span className="text-green-600 ml-1">(Due for Generation)</span>}
                    {isAgreementActive && !isDueForGeneration && <span className="text-blue-500 ml-1">(Upcoming)</span>}
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

      <Dialog open={isPaymentDialogOpen} onOpenChange={(isOpen) => {
          setIsPaymentDialogOpen(isOpen);
          if (!isOpen) {
            setBillForPayment(null);
            paymentForm.reset({
              paymentDate: new Date(),
              paymentMethod: "",
              paymentReference: "",
              bankOrWalletName: "",
            });
          }
      }}>
          <DialogContent className="sm:max-w-md">
              <DialogHeader>
                  <DialogTitle className="font-headline text-xl">
                      {billForPayment?.status === 'Paid' ? 'Update Payment Details' : 'Record Payment'} for Bill
                  </DialogTitle>
                  <DialogDescription>
                      For {billForPayment?.tenantName} - Total: ${billForPayment?.totalAmount.toFixed(2)} (Due: {billForPayment?.dueDate ? format(parseISO(billForPayment.dueDate), 'PP') : 'N/A'})
                  </DialogDescription>
              </DialogHeader>
              <Form {...paymentForm}>
                  <form onSubmit={paymentForm.handleSubmit(handleRecordPaymentSubmit)} className="space-y-4 py-2">
                      <FormField
                          control={paymentForm.control}
                          name="paymentDate"
                          render={({ field }) => (
                              <FormItem className="flex flex-col">
                                  <FormLabel>Payment Date</FormLabel>
                                  <Popover>
                                      <PopoverTrigger asChild>
                                          <FormControl>
                                              <Button
                                                  variant={"outline"}
                                                  className={`w-full pl-3 text-left font-normal ${!field.value && "text-muted-foreground"}`}
                                              >
                                                  {field.value ? (
                                                      format(field.value, "PPP")
                                                  ) : (
                                                      <span>Pick a date</span>
                                                  )}
                                                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                              </Button>
                                          </FormControl>
                                      </PopoverTrigger>
                                      <PopoverContent className="w-auto p-0" align="start">
                                          <Calendar
                                              mode="single"
                                              selected={field.value}
                                              onSelect={field.onChange}
                                              disabled={(date) =>
                                                  date > new Date() || date < new Date("1900-01-01")
                                              }
                                              initialFocus
                                          />
                                      </PopoverContent>
                                  </Popover>
                                  <FormMessage />
                              </FormItem>
                          )}
                      />
                      <FormField
                          control={paymentForm.control}
                          name="paymentMethod"
                          render={({ field }) => (
                              <FormItem>
                                  <FormLabel>Payment Method</FormLabel>
                                  <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                                      <FormControl>
                                          <SelectTrigger>
                                              <SelectValue placeholder="Select payment method" />
                                          </SelectTrigger>
                                      </FormControl>
                                      <SelectContent>
                                          <SelectItem value="Card">Card</SelectItem>
                                          <SelectItem value="Cash">Cash</SelectItem>
                                          <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                                          <SelectItem value="Wallet">Wallet</SelectItem>
                                          <SelectItem value="Check">Check</SelectItem>
                                          <SelectItem value="Other">Other</SelectItem>
                                      </SelectContent>
                                  </Select>
                                  <FormMessage />
                              </FormItem>
                          )}
                      />
                      {(paymentMethodWatcher === "Bank Transfer" || paymentMethodWatcher === "Wallet") && (
                        <FormField
                          control={paymentForm.control}
                          name="bankOrWalletName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{paymentMethodWatcher === "Bank Transfer" ? "Bank Name" : "Wallet Name"}</FormLabel>
                              <FormControl>
                                <Input placeholder={`Enter ${paymentMethodWatcher === "Bank Transfer" ? "Bank" : "Wallet"} Name`} {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                      <FormField
                          control={paymentForm.control}
                          name="paymentReference"
                          render={({ field }) => (
                              <FormItem>
                                  <FormLabel>Payment Reference (Optional)</FormLabel>
                                  <FormControl>
                                      <Input placeholder="e.g., TXN ID, Check No." {...field} />
                                  </FormControl>
                                  <FormMessage />
                              </FormItem>
                          )}
                      />
                      <DialogFooter className="pt-4">
                          <DialogClose asChild>
                              <Button type="button" variant="outline">Cancel</Button>
                          </DialogClose>
                          <Button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground">
                            {billForPayment?.status === 'Paid' ? 'Update Payment' : 'Record as Paid'}
                          </Button>
                      </DialogFooter>
                  </form>
              </Form>
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
                <p><strong>Bill Date:</strong> {format(parseISO(bill.billDate), 'PP')}</p>
                <p><strong>Due Date:</strong> {format(parseISO(bill.dueDate), 'PP')}</p>
                <p><strong>Rent:</strong> ${bill.rentAmount.toFixed(2)}</p>
                <div>
                  <strong>Utilities:</strong>
                  {bill.utilityBreakdown && bill.utilityBreakdown.length > 0 ? (
                    <ul className="list-disc list-inside ml-4">
                      {bill.utilityBreakdown.map(util => (
                        <li key={util.name}>{util.name}: ${util.amount.toFixed(2)}</li>
                      ))}
                    </ul>
                  ) : (
                    <span> $0.00</span>
                  )}
                </div>
                <p className="font-semibold text-base text-primary"><strong>Total:</strong> ${bill.totalAmount.toFixed(2)}</p>
                
                {bill.status === 'Paid' && bill.paymentDate && (
                    <div className="mt-3 pt-2 border-t border-border/50 text-xs">
                        <p className="font-medium text-foreground">Payment Details:</p>
                        <p>Paid on: {format(parseISO(bill.paymentDate), 'PP')}</p>
                        {bill.paymentMethod && <p>Method: {bill.paymentMethod}</p>}
                        {bill.bankOrWalletName && <p>{bill.paymentMethod === "Bank Transfer" ? "Bank" : "Wallet"}: {bill.bankOrWalletName}</p>}
                        {bill.paymentReference && <p>Reference: {bill.paymentReference}</p>}
                    </div>
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
                <div className="flex gap-2 items-center">
                    <Button 
                        variant={bill.status === 'Paid' ? "secondary" : "default"} 
                        size="sm" 
                        onClick={() => handleOpenPaymentDialog(bill)}
                        className={bill.status === 'Paid' ? "" : "bg-green-600 hover:bg-green-700 text-white"}
                    >
                      <CreditCard className="mr-1 h-4 w-4" /> 
                      {bill.status === 'Paid' ? 'Update Payment' : 'Record Payment'}
                    </Button>
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
