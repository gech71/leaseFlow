
"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { PageHeader } from '@/components/custom/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, FileText, User, AlertTriangle, CheckCircle, Loader2, Edit, Trash2, Zap, CreditCard, CalendarIcon, InfoIcon, Building as BuildingIcon } from 'lucide-react';
import type { Bill, Agreement, Space, Building, BuildingMonthlyUtilities, PenaltyTier } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { addMonths, format, isBefore, startOfDay, isAfter, isSameDay, getYear, getMonth, parseISO, differenceInDays } from 'date-fns';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';


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

// IMPORTANT: Ensure spaceIdName and floor are accurate for testing scoped utilities
const initialMockSpaces: Space[] = [
 { id: 'space1', buildingName: 'Sunrise Tower', spaceIdName: 'Unit 101', area: 1200, floor: '10th', utilityProrationShare: 0.40, monthlyRentalPrice: 2500, isOccupied: true, tenantId: 'tenant1', createdAt: new Date().toISOString() },
 { id: 'space1b', buildingName: 'Sunrise Tower', spaceIdName: 'Unit 102', area: 1000, floor: '10th', utilityProrationShare: 0.30, monthlyRentalPrice: 2200, isOccupied: false, tenantId: undefined, createdAt: new Date().toISOString()},
 { id: 'space3', buildingName: 'Downtown Hub', spaceIdName: 'Office 5B', area: 1500, floor: '5th', utilityProrationShare: 0.35, monthlyRentalPrice: 3200, isOccupied: true, tenantId: 'tenant2', createdAt: new Date().toISOString() },
 { id: 'space4', buildingName: 'Galaxy Tower', spaceIdName: 'Penthouse Suite', area: 3000, floor: 'Top', utilityProrationShare: 0.60, monthlyRentalPrice: 5000, isOccupied: true, tenantId: 'tenant3', createdAt: new Date().toISOString() },
];

const initialMockBuildings: Building[] = [
  { id: 'building1', name: 'Sunrise Tower', address: '123 Sunrise Ave', penaltyPolicyTiers: [{ fromDay: 6, feeType: 'Fixed', feeValue: 50 }], createdAt: new Date().toISOString() },
  { id: 'building2', name: 'Downtown Hub', address: '456 Main St', penaltyPolicyTiers: [{ fromDay: 4, feeType: 'Percentage', feeValue: 2 }], createdAt: new Date().toISOString() },
  { id: 'building3', name: 'Galaxy Tower', address: '789 Star Rd', createdAt: new Date().toISOString() },
];


const initialBills: Bill[] = [
  { id: 'bill1', agreementId: 'agreement1', tenantId: 'tenant1', spaceDescription: 'Unit 101, Sunrise Tower', billDate: new Date(2024,5,1).toISOString(), dueDate: new Date(2024,5,15).toISOString(), rentAmount: 2500, utilityBreakdown: [{name: "Electricity", amount: 80}, {name: "Water", amount: 20}], totalAmount: 2600, status: 'Paid', paymentDate: new Date(2024,5,10).toISOString(), paymentMethod: "Card", paymentReference: "TXN12345" },
  { id: 'bill2', agreementId: 'agreement2', tenantId: 'tenant2', spaceDescription: 'Office 5B, Downtown Hub', billDate: new Date(2024,5,1).toISOString(), dueDate: new Date(2024,5,15).toISOString(), rentAmount: 3200, utilityBreakdown: [{name: "General Utility", amount: 175}], totalAmount: 3375, status: 'Pending' },
  { id: 'bill3', agreementId: 'agreement1', tenantId: 'tenant1', spaceDescription: 'Unit 101, Sunrise Tower', billDate: new Date(2024,4,1).toISOString(), dueDate: new Date(2024,4,15).toISOString(), rentAmount: 2500, utilityBreakdown: [{name: "Electricity", amount: 70}, {name: "Water", amount: 15}], totalAmount: 2585, status: 'Paid', paymentDate: new Date(2024,4,10).toISOString(), paymentMethod: "Bank Transfer", paymentReference: "REF9876", bankOrWalletName: "City Bank" },

];

const getStoredBuildingUtilities = (): BuildingMonthlyUtilities[] => {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('buildingMonthlyUtilities');
    if (stored) {
        try {
            const parsed = JSON.parse(stored) as BuildingMonthlyUtilities[];
            return parsed.map(entry => ({
                ...entry,
                utilities: entry.utilities.map(util => ({
                    ...util,
                    appliesToScope: util.appliesToScope || 'Building',
                }))
            }));
        } catch(e) { return []; }
    }
  }
  return [];
};

const getStoredBuildings = (): Building[] => {
  if (typeof window !== 'undefined') {
    const storedBuildings = localStorage.getItem('buildings');
    if (storedBuildings) {
      try {
        const parsed = JSON.parse(storedBuildings) as Building[];
        return parsed.map(b => ({
          ...b,
          penaltyPolicyTiers: b.penaltyPolicyTiers || [], 
        }));
      } catch (e) {
        console.error("Error parsing buildings from localStorage on billing page", e);
        return initialMockBuildings;
      }
    }
    return initialMockBuildings;
  }
  return initialMockBuildings;
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
  const [spaces, setSpaces] = useState<Space[]>(initialMockSpaces); // Using initialMockSpaces as fallback
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [allBuildingUtilities, setAllBuildingUtilities] = useState<BuildingMonthlyUtilities[]>([]);
  
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [billForPayment, setBillForPayment] = useState<Bill | null>(null);

  const [isMounted, setIsMounted] = useState(false);
  const { toast } = useToast();
  const [today, setToday] = useState(startOfDay(new Date()));

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
    // In a real app, spaces would be fetched or come from a central store
    const storedSpaces = localStorage.getItem('spaces');
    if (storedSpaces) {
      try {
        setSpaces(JSON.parse(storedSpaces));
      } catch (e) {
        console.error("Error parsing spaces from localStorage", e);
        setSpaces(initialMockSpaces); // Fallback
      }
    } else {
      setSpaces(initialMockSpaces); // Fallback
    }
    setAllBuildingUtilities(getStoredBuildingUtilities());
    setBuildings(getStoredBuildings());
    setToday(startOfDay(new Date())); 
  }, []);

  const calculatePenalty = useCallback((bill: Bill): number => {
    const agreement = agreements.find(ag => ag.id === bill.agreementId);
    if (!agreement) return 0;
    const space = spaces.find(sp => sp.id === agreement.spaceId);
    if (!space) return 0;
    const building = buildings.find(b => b.name === space.buildingName);
    
    if (!building || !building.penaltyPolicyTiers || building.penaltyPolicyTiers.length === 0) return 0;

    const dueDate = parseISO(bill.dueDate);
    if (isAfter(dueDate, today) || bill.status === 'Paid') return 0; 

    const daysOverdue = differenceInDays(today, dueDate);
    if (daysOverdue <= 0) return 0;

    const sortedTiers = [...building.penaltyPolicyTiers].sort((a, b) => a.fromDay - b.fromDay);
    let calculatedPenalty = 0;
    for (const tier of sortedTiers) {
      if (daysOverdue >= tier.fromDay && (tier.toDay === null || tier.toDay === undefined || daysOverdue <= tier.toDay)) {
        if (tier.feeType === 'Fixed') {
          calculatedPenalty = tier.feeValue;
        } else if (tier.feeType === 'Percentage') {
          calculatedPenalty = bill.rentAmount * (tier.feeValue / 100);
        }
        break; 
      }
    }
    return parseFloat(calculatedPenalty.toFixed(2));
  }, [agreements, spaces, buildings, today]);

  const processedBills = useMemo(() => {
    return bills.map(bill => {
      let currentStatus = bill.status;
      if (bill.status === 'Pending' && isBefore(parseISO(bill.dueDate), today)) {
        currentStatus = 'Overdue';
      }
      
      const penalty = calculatePenalty({ ...bill, status: currentStatus }); 
      const newTotalAmount = bill.rentAmount + bill.utilityBreakdown.reduce((sum, util) => sum + util.amount, 0) + penalty;
      const agreement = agreements.find(ag => ag.id === bill.agreementId);
      const tenantName = agreement ? agreement.tenantName : 'N/A';

      return {
        ...bill,
        status: currentStatus,
        penaltyAmount: penalty > 0 ? penalty : undefined,
        totalAmount: parseFloat(newTotalAmount.toFixed(2)),
        tenantName: tenantName,
      };
    }).sort((a,b) => new Date(b.billDate).getTime() - new Date(a.billDate).getTime());
  }, [bills, calculatePenalty, today, agreements]);


  useEffect(() => {
    if (billForPayment) {
      const processedBillForPayment = processedBills.find(pb => pb.id === billForPayment.id);
      paymentForm.reset({
        paymentDate: processedBillForPayment?.paymentDate ? parseISO(processedBillForPayment.paymentDate) : new Date(),
        paymentMethod: processedBillForPayment?.paymentMethod || "",
        paymentReference: processedBillForPayment?.paymentReference || "",
        bankOrWalletName: processedBillForPayment?.bankOrWalletName || "",
      });
    }
  }, [billForPayment, paymentForm, processedBills]);

 const createBillForAgreement = (agreement: Agreement, targetDueDate: Date): Bill | null => {
    const space = spaces.find(sp => sp.id === agreement.spaceId);
    if (!space) {
      console.error(`Space not found for agreement ${agreement.id}`);
      toast({ title: "Error", description: `Space details for ${agreement.spaceDescription} not found. Cannot generate bill.`, variant: "destructive" });
      return null;
    }

    const rentAmount = agreement.monthlyRentalPrice;
    const utilityBreakdownItems: Array<{ name: string; amount: number }> = [];
    let totalUtilityCostForBill = 0;

    const billYear = getYear(targetDueDate);
    const billMonth = getMonth(targetDueDate);

    const monthlyBuildingUtilityData = allBuildingUtilities.find(
      entry => entry.buildingName === space.buildingName && entry.year === billYear && entry.month === billMonth
    );

    if (monthlyBuildingUtilityData && monthlyBuildingUtilityData.utilities.length > 0) {
      monthlyBuildingUtilityData.utilities.forEach(utilItem => {
        let costForThisUtility = 0;
        switch (utilItem.appliesToScope) {
          case 'Building':
            costForThisUtility = utilItem.totalCost * space.utilityProrationShare;
            break;
          case 'Floor':
            if (utilItem.applicableFloor && space.floor === utilItem.applicableFloor) {
              const spacesOnFloor = spaces.filter(s => s.buildingName === space.buildingName && s.floor === utilItem.applicableFloor);
              if (spacesOnFloor.length > 0) {
                costForThisUtility = utilItem.totalCost / spacesOnFloor.length;
              }
            }
            break;
          case 'SpecificSpaces':
            if (utilItem.applicableSpaceIdNames && utilItem.applicableSpaceIdNames.includes(space.spaceIdName)) {
              if (utilItem.applicableSpaceIdNames.length > 0) {
                costForThisUtility = utilItem.totalCost / utilItem.applicableSpaceIdNames.length;
              }
            }
            break;
          default: // Should not happen if data is clean
            costForThisUtility = utilItem.totalCost * space.utilityProrationShare;
        }
        if (costForThisUtility > 0) {
            utilityBreakdownItems.push({ name: utilItem.name, amount: parseFloat(costForThisUtility.toFixed(2)) });
            totalUtilityCostForBill += costForThisUtility;
        }
      });
    } else if (spaces.some(s => s.buildingName === space.buildingName && s.utilityProrationShare > 0)) { // Only warn if some spaces in building expect utilities
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
      spaceDescription: agreement.spaceDescription,
      billDate: targetDueDate.toISOString(),
      dueDate: targetDueDate.toISOString(),
      rentAmount,
      utilityBreakdown: utilityBreakdownItems,
      penaltyAmount: 0,
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

    setBills(prev => [newBill, ...prev]);
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
      setBills(prev => [...newBillsBuffer, ...prev]);
    }
    setAgreements(updatedAgreementsData);
    toast({ title: "Bulk Bill Generation Complete", description: `${generatedCount} bills generated. ${skippedCount} agreements skipped (not due, expired, or pending bill exists).` });
  };


  const handleOpenPaymentDialog = (bill: Bill) => {
    setBillForPayment(bill);
    setIsPaymentDialogOpen(true);
  };
  
  const handleRecordPaymentSubmit = (values: PaymentFormValues) => {
    if (!billForPayment) return;
    const processedBill = processedBills.find(pb => pb.id === billForPayment.id);
    if (!processedBill) return;

    setBills(prevBills => 
      prevBills.map(b => 
        b.id === billForPayment.id 
        ? { 
            ...processedBill, 
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
  
  const getStatusBadgeVariant = (status: Bill['status']): "default" | "destructive" | "secondary" => {
    switch (status) {
      case 'Paid': return 'secondary';
      case 'Pending': return 'default';
      case 'Overdue': return 'destructive';
      default: return 'default';
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
        description="Generate and manage rental and utility bills. Penalties apply based on building policies."
      />

      <Card className="mb-6 shadow-sm">
        <CardHeader>
          <CardTitle className="font-headline">Generate Bills</CardTitle>
          <CardDescription>Generate bills for individual agreements or all due agreements. Monthly utility costs must be entered on the 'Building Utilities' page. Late fees are applied automatically if applicable.</CardDescription>
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
                  {billForPayment && (
                    <DialogDescription>
                        For {processedBills.find(pb => pb.id === billForPayment.id)?.spaceDescription.split(',')[0]} - Total: ${processedBills.find(pb => pb.id === billForPayment.id)?.totalAmount.toFixed(2)} (Due: {billForPayment?.dueDate ? format(parseISO(billForPayment.dueDate), 'PP') : 'N/A'})
                    </DialogDescription>
                  )}
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


      {processedBills.length === 0 ? (
        <Card className="text-center py-12 shadow-sm">
          <CardContent>
            <DollarSign className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2 font-headline">No Bills Yet</h3>
            <p className="text-muted-foreground">Generate bills from active agreements to see them here.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4 mt-8">
        <h2 className="text-2xl font-headline font-semibold">Generated Bills</h2>
        <Card className="shadow-md">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tenant</TableHead>
                  <TableHead className="hidden md:table-cell">Space</TableHead>
                  <TableHead>Bill Date</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead className="hidden sm:table-cell text-right">Rent</TableHead>
                  <TableHead className="hidden sm:table-cell text-right">Utilities</TableHead>
                  <TableHead className="hidden sm:table-cell text-right">Penalty</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {processedBills.map((bill) => (
                  <TableRow key={bill.id} className={bill.status === 'Overdue' ? 'bg-destructive/5 hover:bg-destructive/10' : ''}>
                    <TableCell className="font-medium">{bill.tenantName}</TableCell>
                    <TableCell className="hidden md:table-cell text-xs">{bill.spaceDescription}</TableCell>
                    <TableCell>{format(parseISO(bill.billDate), 'PP')}</TableCell>
                    <TableCell className={bill.status === 'Overdue' ? 'text-destructive font-semibold' : ''}>{format(parseISO(bill.dueDate), 'PP')}</TableCell>
                    <TableCell className="hidden sm:table-cell text-right">${bill.rentAmount.toFixed(2)}</TableCell>
                    <TableCell className="hidden sm:table-cell text-right">
                      {bill.utilityBreakdown && bill.utilityBreakdown.length > 0 ? (
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="link" size="sm" className="p-0 h-auto font-normal text-primary hover:underline">
                                ${bill.utilityBreakdown.reduce((sum, util) => sum + util.amount, 0).toFixed(2)}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto text-xs p-2" side="top">
                              <ul className="space-y-0.5">
                                {bill.utilityBreakdown.map(util => (
                                  <li key={util.name} className="flex justify-between">
                                    <span>{util.name}:</span>
                                    <span className="font-medium ml-2">${util.amount.toFixed(2)}</span>
                                  </li>
                                ))}
                              </ul>
                            </PopoverContent>
                          </Popover>
                        ) : (
                            '$0.00'
                        )}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-right text-destructive">{bill.penaltyAmount ? `$${bill.penaltyAmount.toFixed(2)}` : '$0.00'}</TableCell>
                    <TableCell className="text-right font-semibold text-primary">${bill.totalAmount.toFixed(2)}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={getStatusBadgeVariant(bill.status)} className="capitalize text-xs">
                         {bill.status === 'Paid' && <CheckCircle className="mr-1 h-3 w-3" />}
                         {bill.status === 'Pending' && <InfoIcon className="mr-1 h-3 w-3" />}
                         {bill.status === 'Overdue' && <AlertTriangle className="mr-1 h-3 w-3" />}
                         {bill.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        {bill.status !== 'Paid' && (
                          <Button 
                              variant="default"
                              size="sm" 
                              onClick={() => handleOpenPaymentDialog(bill)}
                              className="bg-green-600 hover:bg-green-700 text-white"
                          >
                            <CreditCard className="mr-1 h-3.5 w-3.5" /> Record Payment
                          </Button>
                        )}
                         {bill.status === 'Paid' && (
                           <Button variant="outline" size="sm" onClick={() => handleOpenPaymentDialog(bill)}>
                             <Edit className="mr-1 h-3.5 w-3.5"/> View/Edit
                           </Button>
                         )}
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => toast({title: "Delete Bill", description:"Functionality coming soon.", variant: "destructive"})}><Trash2 className="h-4 w-4"/></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        </div>
      )}
    </div>
  );
}
