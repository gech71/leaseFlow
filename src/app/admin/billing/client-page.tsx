
"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { PageHeader } from '@/components/custom/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, FileText, User, AlertTriangle, CheckCircle, Loader2, Edit, Trash2, Zap, CreditCard, CalendarIcon as CalendarLucideIcon, InfoIcon, Building as BuildingIconLucide, UploadCloud, MessageSquare, ShieldCheck, ShieldX, Paperclip, EyeOff, Eye, Search } from 'lucide-react';
import type { Agreement as AgreementPrisma, Bill as BillPrismaOriginal, Space as SpacePrisma, Building as BuildingPrisma, BuildingMonthlyUtilities as BuildingMonthlyUtilitiesPrisma, PenaltyTier as PenaltyTierPrisma, UtilityBreakdownItem as UtilityBreakdownItemPrismaOriginal, Prisma, Tenant as TenantPrismaOriginal } from '@prisma/client';
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
import { Textarea } from '@/components/ui/textarea';
import { getBillingPageDataAction, generateBillAndUpdateAgreementAction, recordPaymentOrVerificationAction, deleteBillAction, updateBillAdminDetailsAction } from './actions';
import type { SerializedBillingPageData, ClientBill, ClientAgreement, ClientBuilding } from './page'; 
import { usePermissions } from '@/contexts/PermissionContext';
import { PaginationControls } from '@/components/custom/PaginationControls';


const paymentFormSchema = z.object({
  paymentDate: z.date({ required_error: "Payment date is required." }),
  paymentMethod: z.string().min(1, { message: "Payment method is required." }),
  paymentReference: z.string().optional(),
  bankOrWalletName: z.string().optional(),
  adminVerificationNotes: z.string().optional(),
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

const editFormSchema = z.object({
  paymentReference: z.string().optional(),
  adminVerificationNotes: z.string().optional(),
});
type EditFormValues = z.infer<typeof editFormSchema>;

interface BillingClientPageProps {
  initialData: SerializedBillingPageData;
}

export function BillingClientPage({ initialData }: BillingClientPageProps) {
  const [agreements, setAgreements] = useState<ClientAgreement[]>(initialData.agreements);
  const [bills, setBills] = useState<ClientBill[]>(initialData.bills);
  const [allBuildings, setAllBuildings] = useState<ClientBuilding[]>(initialData.buildings); 
  
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [billForPayment, setBillForPayment] = useState<ClientBill | null>(null);
  const [isVerificationDialogOpen, setIsVerificationDialogOpen] = useState(false);
  const [billForVerification, setBillForVerification] = useState<ClientBill | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [billForEdit, setBillForEdit] = useState<ClientBill | null>(null);

  const [adminSelectedProofFile, setAdminSelectedProofFile] = useState<File | null>(null);
  const adminProofFileInputRef = useRef<HTMLInputElement>(null);

  const [isMounted, setIsMounted] = useState(false);
  const { toast } = useToast();
  const [today, setToday] = useState(startOfDay(new Date()));
  const [isLoading, setIsLoading] = useState(false);
  const [billFilterTerm, setBillFilterTerm] = useState('');

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const { hasPermission, isSuperAdmin } = usePermissions();
  const canGenerateBills = isSuperAdmin || hasPermission('billing:generate');
  const canManagePayments = isSuperAdmin || hasPermission('billing:manage_payments');
  const canDeleteBills = isSuperAdmin || hasPermission('billing:delete');
  const canViewBilling = isSuperAdmin || hasPermission('billing:view') || canGenerateBills || canManagePayments || canDeleteBills;

  const paymentForm = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: { paymentDate: new Date(), paymentMethod: "", paymentReference: "", bankOrWalletName: "", adminVerificationNotes: "" }
  });
  const paymentMethodWatcher = paymentForm.watch("paymentMethod");

  const editForm = useForm<EditFormValues>({
    resolver: zodResolver(editFormSchema),
    defaultValues: { paymentReference: "", adminVerificationNotes: "" }
  });
  
  const isReadOnly = billForPayment?.status === 'Paid';

  const handleItemsPerPageChange = (newSize: number) => {
    setItemsPerPage(newSize);
    setCurrentPage(1);
  };

  useEffect(() => {
    setIsMounted(true);
    setAgreements(initialData.agreements);
    setBills(initialData.bills);
    setAllBuildings(initialData.buildings);
    setToday(startOfDay(new Date()));
  }, [initialData]);
  
  useEffect(() => {
    setCurrentPage(1);
  }, [billFilterTerm]);

  const refreshBillingData = useCallback(async () => {
    setIsLoading(true);
    try {
      const serializedNewData = await getBillingPageDataAction();
      setAgreements(serializedNewData.agreements);
      setBills(serializedNewData.bills);
      setAllBuildings(serializedNewData.buildings);
    } catch (error) {
      toast({ title: "Error Refreshing Data", description: (error as Error).message, variant: "destructive" });
    }
    setIsLoading(false);
  }, [toast]);


  const calculatePenalty = useCallback((bill: ClientBill, currentStatus: ClientBill['status']): number => {
    const agreementForBill = agreements.find(ag => ag.id === bill.agreementId);
    if (!agreementForBill || !agreementForBill.space || !agreementForBill.space.building) return 0;
    
    const space = agreementForBill.space;
    const building = allBuildings.find(b => b.id === space.buildingId); 
    if (!building || !building.penaltyPolicyTiers || building.penaltyPolicyTiers.length === 0) return 0;

    const dueDate = parseISO(bill.dueDate);
    if (currentStatus !== 'Overdue') return 0;

    const daysOverdue = differenceInDays(today, dueDate);
    if (daysOverdue <= 0) return 0;

    let applicableTiers = [];
    const spaceSpecificTiers = building.penaltyPolicyTiers.filter(
      t => t.scope === 'SpecificSpaces' && t.applicableSpaceIdNames?.includes(space.spaceIdName)
    );
    if (spaceSpecificTiers.length > 0) applicableTiers = spaceSpecificTiers;
    else {
      const floorSpecificTiers = building.penaltyPolicyTiers.filter(
        t => t.scope === 'Floor' && t.applicableFloor === space.floor
      );
      if (floorSpecificTiers.length > 0) applicableTiers = floorSpecificTiers;
      else applicableTiers = building.penaltyPolicyTiers.filter(t => t.scope === 'Building');
    }
    
    if (applicableTiers.length === 0) return 0;
    const sortedTiers = [...applicableTiers].sort((a, b) => a.fromDay - b.fromDay);
    let calculatedPenalty = 0;
    for (const tier of sortedTiers) {
      if (daysOverdue >= tier.fromDay && (tier.toDay === null || tier.toDay === undefined || daysOverdue <= tier.toDay)) {
        if (tier.feeType === 'Fixed') calculatedPenalty = tier.feeValue;
        else if (tier.feeType === 'Percentage') calculatedPenalty = bill.rentAmount * (tier.feeValue / 100);
        break;
      }
    }
    return parseFloat(calculatedPenalty.toFixed(2));
  }, [agreements, allBuildings, today]);

  const processedClientBills = useMemo(() => {
    return bills.map(bill => {
      let currentStatus = bill.status as BillPrismaOriginal['status']; 
      if (bill.status === 'Pending' && isBefore(parseISO(bill.dueDate), today)) {
        currentStatus = 'Overdue';
      }
      
      const penalty = (currentStatus === 'Overdue' && bill.status !== 'Paid' && bill.status !== 'PendingVerification') 
                      ? calculatePenalty(bill, currentStatus) 
                      : (bill.penaltyAmount || 0);
                      
      const baseAmount = bill.rentAmount + bill.utilityBreakdown.reduce((sum, util) => sum + util.amount, 0);
      const newTotalAmount = baseAmount + (penalty || 0);
      
      return {
        ...bill,
        currentStatus: currentStatus, 
        penaltyAmount: penalty > 0 ? penalty : undefined,
        totalAmount: parseFloat(newTotalAmount.toFixed(2)),
        tenantName: bill.agreement?.tenant?.name || 'N/A',
      };
    }).filter(bill => {
        if (!billFilterTerm) return true;
        const searchTermLower = billFilterTerm.toLowerCase();
        const tenantName = bill.tenantName.toLowerCase();
        const spaceIdName = bill.agreement?.space?.spaceIdName.toLowerCase() || '';
        const buildingName = bill.agreement?.space?.building?.name.toLowerCase() || '';
        return tenantName.includes(searchTermLower) || spaceIdName.includes(searchTermLower) || buildingName.includes(searchTermLower);
    }).sort((a,b) => parseISO(b.billDate).getTime() - parseISO(a.billDate).getTime());
  }, [bills, calculatePenalty, today, billFilterTerm]);

  const totalPages = Math.ceil(processedClientBills.length / itemsPerPage);
  const paginatedBills = processedClientBills.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

 useEffect(() => {
    if (isPaymentDialogOpen && billForPayment) {
      const processedBill = processedClientBills.find(pb => pb.id === billForPayment.id);
      paymentForm.reset({
        paymentDate: processedBill?.paymentDate ? parseISO(processedBill.paymentDate) : new Date(),
        paymentMethod: processedBill?.paymentMethod || "",
        paymentReference: processedBill?.paymentReference || "",
        bankOrWalletName: processedBill?.bankOrWalletName || "",
        adminVerificationNotes: processedBill?.adminVerificationNotes || "",
      });
      setAdminSelectedProofFile(null); if(adminProofFileInputRef.current) adminProofFileInputRef.current.value = "";
    }
    if (isVerificationDialogOpen && billForVerification) {
        const processedBill = processedClientBills.find(pb => pb.id === billForVerification.id);
        paymentForm.reset({
            paymentDate: processedBill?.paymentDate ? parseISO(processedBill.paymentDate) : new Date(),
            paymentMethod: processedBill?.paymentMethod || "",
            paymentReference: processedBill?.paymentReference || "",
            bankOrWalletName: processedBill?.bankOrWalletName || "",
            adminVerificationNotes: processedBill?.adminVerificationNotes || "",
        });
        setAdminSelectedProofFile(null); if(adminProofFileInputRef.current) adminProofFileInputRef.current.value = "";
    }
    if (isEditDialogOpen && billForEdit) {
      editForm.reset({
        paymentReference: billForEdit.paymentReference || "",
        adminVerificationNotes: billForEdit.adminVerificationNotes || ""
      });
      setAdminSelectedProofFile(null); if(adminProofFileInputRef.current) adminProofFileInputRef.current.value = "";
    }
  }, [isPaymentDialogOpen, billForPayment, isVerificationDialogOpen, billForVerification, isEditDialogOpen, billForEdit, paymentForm, editForm, processedClientBills]); 

  const handleGenerateSingleBill = async (agreementId: string) => {
    if (!canGenerateBills) {
      toast({ title: "Permission Denied", description: "You do not have permission to generate bills.", variant: "destructive" });
      return;
    }
    const agreement = agreements.find(ag => ag.id === agreementId);
    if (!agreement) { toast({ title: "Error", description: "Agreement not found.", variant: "destructive" }); return; }
    
    const nextDueDateString = agreement.nextPaymentDueDate.substring(0, 10);
    
    setIsLoading(true);
    const result = await generateBillAndUpdateAgreementAction(agreementId, nextDueDateString);
    setIsLoading(false);

    if (result.success && result.bill) {
      toast({ title: "Bill Generated", description: `New bill for ${agreement.tenant?.name} (Due: ${format(parseISO(result.bill.dueDate as string), 'PP')}) created. Total: ${result.bill.totalAmount.toFixed(2)} Birr` });
      await refreshBillingData();
    } else {
      toast({ title: "Bill Generation Failed", description: result.error || "An unknown error occurred.", variant: "destructive" });
    }
  };

  const handleGenerateAllDueBills = async () => {
    if (!canGenerateBills) {
      toast({ title: "Permission Denied", description: "You do not have permission to generate bills.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    let totalGenerated = 0;
    let totalSkipped = 0;
    let totalErrors = 0;
    const errorMessages: string[] = [];

    const todayUtcDateString = new Date().toISOString().substring(0, 10);

    for (const agreement of agreements) {
      let currentNextDueDate = agreement.nextPaymentDueDate;
      let generatedForThisAgreement = false;
      let stopProcessing = false;

      while (!stopProcessing) {
        const agreementStartDate = parseISO(agreement.startDate);
        const agreementEndDate = addMonths(agreementStartDate, agreement.paymentTermMonths);

        if (isBefore(today, agreementStartDate) || isAfter(today, agreementEndDate)) {
          stopProcessing = true;
          continue;
        }

        const nextDueDateString = currentNextDueDate.substring(0, 10);
        if (nextDueDateString > todayUtcDateString) {
          stopProcessing = true;
          continue;
        }

        const result = await generateBillAndUpdateAgreementAction(agreement.id, nextDueDateString);
        
        if (result.success && result.bill) {
          totalGenerated++;
          generatedForThisAgreement = true;
          currentNextDueDate = addMonths(parseISO(result.bill.dueDate as string), 1).toISOString();
        } else {
          if (result.error && !result.error.includes("already exists")) {
            totalErrors++;
            errorMessages.push(result.error || `Failed for ${agreement.tenant?.name}`);
          }
          stopProcessing = true;
        }
      }

      if (!generatedForThisAgreement) {
        totalSkipped++;
      }
    }

    setIsLoading(false);
    let summaryMessage = `${totalGenerated} bills generated. ${totalSkipped} agreements skipped.`;
    if (totalErrors > 0) summaryMessage += ` ${totalErrors} failed.`;

    toast({ title: "Bulk Bill Generation Complete", description: summaryMessage });

    if (errorMessages.length > 0) {
      toast({ title: "Bulk Generation Errors", description: errorMessages.slice(0, 3).join('; '), variant: "destructive", duration: 10000 });
    }
    await refreshBillingData();
  };

  const handleOpenPaymentDialog = (bill: ClientBill) => { setBillForPayment(bill); setIsPaymentDialogOpen(true); };
  const handleOpenVerificationDialog = (bill: ClientBill) => { setBillForVerification(bill); setIsVerificationDialogOpen(true); };
  const handleOpenEditDialog = (bill: ClientBill) => { setBillForEdit(bill); setIsEditDialogOpen(true); };
  
  const handleRecordPaymentSubmit = async (values: PaymentFormValues) => {
    if (!billForPayment || !billForPayment.agreement) return;
    if (!canManagePayments) {
      toast({ title: "Permission Denied", description: "You do not have permission to manage payments.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    const adminProofUrl = adminSelectedProofFile ? `admin_simulated_slip_${adminSelectedProofFile.name}` : billForPayment.paymentProofUrl;

    const result = await recordPaymentOrVerificationAction(billForPayment.id, {
      ...values,
      paymentDate: values.paymentDate.toISOString(),
      adminProofUrl: adminProofUrl,
    }, 'recordPayment');
    setIsLoading(false);

    if (result.success) {
      toast({ title: "Payment Recorded", description: `Payment for bill ${billForPayment.id} recorded.` });
      setIsPaymentDialogOpen(false); setBillForPayment(null); paymentForm.reset(); setAdminSelectedProofFile(null);
      if(adminProofFileInputRef.current) adminProofFileInputRef.current.value = "";
      await refreshBillingData();
    } else {
      toast({ title: "Error Recording Payment", description: result.error, variant: "destructive" });
    }
  };
  
  const handleVerificationSubmit = async (values: PaymentFormValues, action: 'confirmVerification' | 'rejectVerification') => {
    if (!billForVerification || !billForVerification.agreement) return;
    if (!canManagePayments) {
      toast({ title: "Permission Denied", description: "You do not have permission to manage payments.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    const adminProofUrl = adminSelectedProofFile ? `admin_sim_replaced_slip_${adminSelectedProofFile.name}` : billForVerification.paymentProofUrl;

    const result = await recordPaymentOrVerificationAction(billForVerification.id, {
      ...values,
      paymentDate: values.paymentDate.toISOString(),
      adminProofUrl: adminProofUrl,
    }, action);
    setIsLoading(false);

    if (result.success) {
      toast({ title: `Payment ${action === 'confirmVerification' ? 'Verified' : 'Rejected'}`, description: `Action for bill ${billForVerification.id} processed.` });
      setIsVerificationDialogOpen(false); setBillForVerification(null); paymentForm.reset(); setAdminSelectedProofFile(null);
      if(adminProofFileInputRef.current) adminProofFileInputRef.current.value = "";
      await refreshBillingData();
    } else {
      toast({ title: `Error ${action === 'confirmVerification' ? 'Verifying' : 'Rejecting'} Payment`, description: result.error, variant: "destructive" });
    }
  };

  const handleEditSubmit = async (values: EditFormValues) => {
    if (!billForEdit) return;
     if (!canManagePayments) {
      toast({ title: "Permission Denied", description: "You do not have permission to edit bills.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    const adminProofUrl = adminSelectedProofFile ? `admin_simulated_slip_${adminSelectedProofFile.name}` : billForEdit.paymentProofUrl;

    const result = await updateBillAdminDetailsAction(billForEdit.id, {
      paymentReference: values.paymentReference,
      adminVerificationNotes: values.adminVerificationNotes,
      adminProofUrl: adminProofUrl,
    });
    setIsLoading(false);

    if (result.success) {
      toast({ title: "Bill Updated", description: "The bill details have been saved." });
      setIsEditDialogOpen(false);
      setBillForEdit(null);
      editForm.reset();
      setAdminSelectedProofFile(null);
      if(adminProofFileInputRef.current) adminProofFileInputRef.current.value = "";
      await refreshBillingData();
    } else {
      toast({ title: "Update Failed", description: result.error, variant: "destructive" });
    }
  };

  const getStatusBadgeVariant = (status: ClientBill['status'] | BillPrismaOriginal['status']): "default" | "destructive" | "secondary" | "outline" => {
    switch (status) {
      case 'Paid': return 'secondary';
      case 'Pending': return 'default';
      case 'Overdue': return 'destructive';
      case 'PendingVerification': return 'outline';
      default: return 'default';
    }
  };

  const getStatusIcon = (status: ClientBill['status'] | BillPrismaOriginal['status']) => {
    switch (status) {
      case 'Paid': return <CheckCircle className="mr-1 h-3 w-3 text-green-600" />;
      case 'Pending': return <InfoIcon className="mr-1 h-3 w-3 text-yellow-600" />;
      case 'Overdue': return <AlertTriangle className="mr-1 h-3 w-3 text-red-600" />;
      case 'PendingVerification': return <UploadCloud className="mr-1 h-3 w-3 text-blue-600" />;
      default: return <InfoIcon className="mr-1 h-3 w-3" />;
    }
  };
  
  const handleDeleteBillWithConfirmation = async (billId: string) => {
    if (!canDeleteBills) {
      toast({ title: "Permission Denied", description: "You do not have permission to delete bills.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    const result = await deleteBillAction(billId);
    setIsLoading(false);
    if (result.success) {
      toast({ title: "Bill Deleted", description: "The bill has been removed." });
      await refreshBillingData();
    } else {
      toast({ title: "Error Deleting Bill", description: result.error, variant: "destructive" });
    }
  };

  const handleAdminFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) setAdminSelectedProofFile(event.target.files[0]);
    else setAdminSelectedProofFile(null);
  };
  
  const todayUtcDateString = new Date().toISOString().substring(0, 10);

  if (!isMounted && agreements.length === 0 && !canViewBilling) { 
    return <div className="flex justify-center items-center h-screen"><Loader2 className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"/></div>;
  }
  
  if (!canViewBilling && isMounted) {
     return (
      <Card className="shadow-lg text-center py-12">
        <CardHeader><CardTitle className="text-destructive flex items-center justify-center"><EyeOff className="mr-2"/>Access Denied</CardTitle></CardHeader>
        <CardContent><p>You do not have permission to view billing information.</p></CardContent>
      </Card>
    );
  }

  return (
    <div className="animate-fadeIn">
      <PageHeader title="Billing Management" icon={DollarSign} description="Generate and manage bills. Verify tenant-submitted payments." />

      {canGenerateBills && (
        <Card className="mb-6 shadow-sm">
          <CardHeader> <CardTitle className="font-headline">Generate Bills</CardTitle> <CardDescription>Generate bills for individual agreements or all due agreements. Utility costs must be entered on 'Building Utilities'. Late fees apply based on building policies.</CardDescription> </CardHeader>
          <CardContent> <Button onClick={handleGenerateAllDueBills} className="w-full md:w-auto bg-accent text-accent-foreground hover:bg-accent/90" disabled={isLoading || agreements.length === 0}> {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin"/> : <Zap className="mr-2 h-5 w-5" />} Generate All Due Bills </Button> </CardContent>
          <CardHeader className="pt-4"> <CardTitle className="font-headline text-lg">Individual Bill Generation</CardTitle> <CardDescription>Select an active agreement to generate its next due bill.</CardDescription> </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {agreements.map(agreement => {
              if (!agreement.tenant || !agreement.space) return null; 
              
              const agreementStartDate = startOfDay(parseISO(agreement.startDate));
              const agreementEndDate = addMonths(agreementStartDate, agreement.paymentTermMonths);
              const isAgreementActive = !isBefore(today, agreementStartDate) && !isAfter(today, agreementEndDate);
              const nextDueDateString = agreement.nextPaymentDueDate.substring(0, 10);
              const isDueForGeneration = isAgreementActive && nextDueDateString <= todayUtcDateString;
              
              return (
                <Card key={agreement.id} className="flex flex-col bg-secondary/30 shadow-sm hover:shadow-md transition-shadow">
                  <CardHeader className="flex-grow pb-2 pt-3">
                    <CardTitle className="text-base font-semibold">{agreement.tenant.name}</CardTitle>
                    <CardDescription className="text-xs">{agreement.space.spaceIdName}, {agreement.space.buildingName}</CardDescription>
                    <CardDescription className="text-xs pt-1"> Next Due: {format(parseISO(agreement.nextPaymentDueDate), 'PP')}
                      {!isAgreementActive && <span className="text-red-500 ml-1">(Inactive)</span>}
                      {isAgreementActive && isDueForGeneration && <Badge variant="default" className="ml-1 text-xs bg-green-100 text-green-700">Due for Gen</Badge>}
                      {isAgreementActive && !isDueForGeneration && <Badge variant="outline" className="ml-1 text-xs">Upcoming</Badge>}
                    </CardDescription>
                  </CardHeader>
                  <CardFooter className="pt-2 pb-3"> <Button size="sm" onClick={() => handleGenerateSingleBill(agreement.id)} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground text-xs" disabled={!isAgreementActive || isLoading}>Generate Bill</Button> </CardFooter>
                </Card>
              );
            })}
          </CardContent>
        </Card>
      )}
      
      <Dialog open={isPaymentDialogOpen} onOpenChange={(isOpen) => { setIsPaymentDialogOpen(isOpen); if (!isOpen) { setBillForPayment(null); paymentForm.reset(); setAdminSelectedProofFile(null); if(adminProofFileInputRef.current) adminProofFileInputRef.current.value = ""; }}}>
          <DialogContent className="sm:max-w-md">
              <DialogHeader>
                  <DialogTitle className="font-headline text-xl">{isReadOnly ? 'View Payment Details' : 'Record Payment'}</DialogTitle>
                  {billForPayment && billForPayment.agreement && billForPayment.agreement.space && <DialogDescription>For {billForPayment.agreement.space.spaceIdName} - Total: {processedClientBills.find(pb => pb.id === billForPayment.id)?.totalAmount.toFixed(2)} Birr</DialogDescription>}
              </DialogHeader>
              <Form {...paymentForm}>
                  <form onSubmit={paymentForm.handleSubmit(handleRecordPaymentSubmit)} className="space-y-4 py-2">
                      <FormField control={paymentForm.control} name="paymentDate" render={({ field }) => ( <FormItem className="flex flex-col"><FormLabel>Payment Date</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant="outline" className={`w-full pl-3 text-left font-normal ${!field.value && "text-muted-foreground"}`} disabled={isReadOnly || isLoading || !canManagePayments}>{field.value ? format(field.value, "PPP") : <span>Pick a date</span>}<CalendarLucideIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} disabled={(date) => date > new Date() || date < new Date("1900-01-01")} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem>)} />
                      <FormField control={paymentForm.control} name="paymentMethod" render={({ field }) => ( <FormItem><FormLabel>Payment Method</FormLabel><Select onValueChange={field.onChange} value={field.value} disabled={isReadOnly || isLoading || !canManagePayments}><FormControl><SelectTrigger><SelectValue placeholder="Select method" /></SelectTrigger></FormControl><SelectContent><SelectItem value="Card">Card</SelectItem><SelectItem value="Cash">Cash</SelectItem><SelectItem value="Bank Transfer">Bank Transfer</SelectItem><SelectItem value="Wallet">Wallet</SelectItem><SelectItem value="Check">Check</SelectItem><SelectItem value="Other">Other</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                      {(paymentMethodWatcher === "Bank Transfer" || paymentMethodWatcher === "Wallet") && ( <FormField control={paymentForm.control} name="bankOrWalletName" render={({ field }) => ( <FormItem><FormLabel>{paymentMethodWatcher === "Bank Transfer" ? "Bank Name" : "Wallet Name"}</FormLabel><FormControl><Input placeholder={`Enter Name`} {...field} disabled={isReadOnly || isLoading || !canManagePayments}/></FormControl><FormMessage /></FormItem>)} /> )}
                      <FormField control={paymentForm.control} name="paymentReference" render={({ field }) => ( <FormItem><FormLabel>Reference (Optional)</FormLabel><FormControl><Input placeholder="e.g., TXN ID" {...field} disabled={isReadOnly || isLoading || !canManagePayments}/></FormControl><FormMessage /></FormItem>)} />
                      {canManagePayments && <div> <Label htmlFor="adminPaymentProofFile" className="flex items-center mb-1 text-sm font-medium"> <Paperclip className="mr-2 h-4 w-4 text-primary" /> Attach Payment Slip (Simulated) </Label> <Input id="adminPaymentProofFile" type="file" ref={adminProofFileInputRef} onChange={handleAdminFileSelect} className="text-sm file:mr-2 file:py-1.5 file:px-2 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20" disabled={isReadOnly || isLoading}/> {adminSelectedProofFile && <p className="text-xs text-muted-foreground mt-1">Selected: {adminSelectedProofFile.name}</p>} </div>}
                      <FormField control={paymentForm.control} name="adminVerificationNotes" render={({ field }) => ( <FormItem><FormLabel>Admin Notes (Optional)</FormLabel><FormControl><Textarea placeholder="e.g., Confirmed via bank statement." rows={2} {...field} disabled={isReadOnly || isLoading || !canManagePayments}/></FormControl><FormMessage /></FormItem>)} />
                      <DialogFooter className="pt-4">
                        <DialogClose asChild><Button type="button" variant="outline" disabled={isLoading}>Cancel</Button></DialogClose>
                        {!isReadOnly && canManagePayments && <Button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isLoading}>{isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}{'Record as Paid'}</Button>}
                      </DialogFooter>
                  </form>
              </Form>
          </DialogContent>
      </Dialog>

      <Dialog open={isVerificationDialogOpen} onOpenChange={(isOpen) => { setIsVerificationDialogOpen(isOpen); if (!isOpen) { setBillForVerification(null); paymentForm.reset(); setAdminSelectedProofFile(null); if(adminProofFileInputRef.current) adminProofFileInputRef.current.value = ""; }}}>
          <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                  <DialogTitle className="font-headline text-xl">Verify Tenant Payment</DialogTitle>
                  {billForVerification && <DialogDescription>Bill for {processedClientBills.find(pb => pb.id === billForVerification.id)?.tenantName} - Amount: {processedClientBills.find(pb => pb.id === billForVerification.id)?.totalAmount?.toFixed(2)} Birr</DialogDescription>}
              </DialogHeader>
              {billForVerification && ( <div className="text-sm space-y-2 py-2"> <p><strong>Tenant Notes:</strong> {billForVerification.tenantPaymentNotes || <span className="italic text-muted-foreground">No notes provided.</span>}</p> <p><strong>Submitted Proof:</strong> {billForVerification.paymentProofUrl ? <Button variant="link" size="sm" className="p-0 h-auto" onClick={() => toast({title:"View Proof (Simulated)", description:`Displaying ${billForVerification.paymentProofUrl}`})}> {billForVerification.paymentProofUrl} (Click to view - simulated) </Button> : <span className="italic text-muted-foreground">No proof URL found.</span>} </p> </div> )}
              <Form {...paymentForm}>
                  <form className="space-y-4 py-1"> 
                      <FormField control={paymentForm.control} name="paymentDate" render={({ field }) => ( <FormItem className="flex flex-col"><FormLabel>Actual Payment Date</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant="outline" className={`w-full pl-3 text-left font-normal ${!field.value && "text-muted-foreground"}`} disabled={isLoading || !canManagePayments}>{field.value ? format(field.value, "PPP") : <span>Pick a date</span>}<CalendarLucideIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} disabled={(date) => date > new Date() || date < new Date("1900-01-01")} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem>)} />
                      <FormField control={paymentForm.control} name="paymentMethod" render={({ field }) => ( <FormItem><FormLabel>Actual Payment Method</FormLabel><Select onValueChange={field.onChange} value={field.value} disabled={isLoading || !canManagePayments}><FormControl><SelectTrigger><SelectValue placeholder="Select method" /></SelectTrigger></FormControl><SelectContent><SelectItem value="Card">Card</SelectItem><SelectItem value="Cash">Cash</SelectItem><SelectItem value="Bank Transfer">Bank Transfer</SelectItem><SelectItem value="Wallet">Wallet</SelectItem><SelectItem value="Check">Check</SelectItem><SelectItem value="Other">Other</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                      {(paymentMethodWatcher === "Bank Transfer" || paymentMethodWatcher === "Wallet") && ( <FormField control={paymentForm.control} name="bankOrWalletName" render={({ field }) => ( <FormItem><FormLabel>{paymentMethodWatcher === "Bank Transfer" ? "Bank Name" : "Wallet Name"}</FormLabel><FormControl><Input placeholder={`Enter Name`} {...field} disabled={isLoading || !canManagePayments}/></FormControl><FormMessage /></FormItem>)} /> )}
                      <FormField control={paymentForm.control} name="paymentReference" render={({ field }) => ( <FormItem><FormLabel>Actual Reference</FormLabel><FormControl><Input placeholder="e.g., TXN ID" {...field} disabled={isLoading || !canManagePayments}/></FormControl><FormMessage /></FormItem>)} />
                      {canManagePayments && <div> <Label htmlFor="adminVerificationProofFile" className="flex items-center mb-1 text-sm font-medium"> <Paperclip className="mr-2 h-4 w-4 text-primary" /> Replace/Add Payment Slip (Simulated) </Label> <Input id="adminVerificationProofFile" type="file" ref={adminProofFileInputRef} onChange={handleAdminFileSelect} className="text-sm file:mr-2 file:py-1.5 file:px-2 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20" disabled={isLoading}/> {adminSelectedProofFile && <p className="text-xs text-muted-foreground mt-1">New file selected: {adminSelectedProofFile.name}</p>} </div>}
                      <FormField control={paymentForm.control} name="adminVerificationNotes" render={({ field }) => ( <FormItem><FormLabel>Admin Notes (Optional)</FormLabel><FormControl><Textarea placeholder="Verification notes..." {...field} rows={2} disabled={isLoading || !canManagePayments}/></FormControl><FormMessage /></FormItem>)} />
                      <DialogFooter className="pt-4 flex-col sm:flex-row gap-2">
                          {canManagePayments && <Button type="button" variant="destructive" className="w-full sm:w-auto" onClick={() => paymentForm.handleSubmit((data) => handleVerificationSubmit(data, 'rejectVerification'))()} disabled={isLoading}>{isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <ShieldX className="mr-2 h-4 w-4"/>}Reject Payment</Button>}
                          <div className="flex-grow"></div>
                          <DialogClose asChild><Button type="button" variant="outline" disabled={isLoading}>Cancel</Button></DialogClose>
                          {canManagePayments && <Button type="button" onClick={() => paymentForm.handleSubmit((data) => handleVerificationSubmit(data, 'confirmVerification'))()} className="bg-green-600 hover:bg-green-700 text-white w-full sm:w-auto" disabled={isLoading}>{isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <ShieldCheck className="mr-2 h-4 w-4"/>}Confirm Payment</Button>}
                      </DialogFooter>
                  </form>
              </Form>
          </DialogContent>
      </Dialog>
      
      <Dialog open={isEditDialogOpen} onOpenChange={(isOpen) => { setIsEditDialogOpen(isOpen); if (!isOpen) { setBillForEdit(null); editForm.reset(); setAdminSelectedProofFile(null); if(adminProofFileInputRef.current) adminProofFileInputRef.current.value = ""; }}}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-headline text-xl">Edit Bill Details</DialogTitle>
            <DialogDescription>For bill ID: {billForEdit?.id}</DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(handleEditSubmit)} className="space-y-4 py-2">
              <FormField control={editForm.control} name="paymentReference" render={({ field }) => ( <FormItem><FormLabel>Payment Reference</FormLabel><FormControl><Input placeholder="e.g., TXN ID, Check No." {...field} value={field.value ?? ""} disabled={isLoading || !canManagePayments}/></FormControl><FormMessage /></FormItem>)} />
              <div>
                  <Label htmlFor="adminEditProofFile" className="flex items-center mb-1 text-sm font-medium"> <Paperclip className="mr-2 h-4 w-4 text-primary" /> Attach/Replace Payment Slip (Simulated) </Label>
                  <Input id="adminEditProofFile" type="file" ref={adminProofFileInputRef} onChange={handleAdminFileSelect} className="text-sm file:mr-2 file:py-1.5 file:px-2 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20" disabled={isLoading || !canManagePayments}/>
                  {adminSelectedProofFile && <p className="text-xs text-muted-foreground mt-1">New file selected: {adminSelectedProofFile.name}</p>}
                  {!adminSelectedProofFile && billForEdit?.paymentProofUrl && <p className="text-xs text-muted-foreground mt-1">Current file: {billForEdit.paymentProofUrl}</p>}
              </div>
              <FormField control={editForm.control} name="adminVerificationNotes" render={({ field }) => ( <FormItem><FormLabel>Admin Notes</FormLabel><FormControl><Textarea placeholder="e.g., Initial details added." {...field} value={field.value ?? ""} disabled={isLoading || !canManagePayments}/></FormControl><FormMessage /></FormItem>)} />
              <DialogFooter className="pt-4">
                  <DialogClose asChild><Button type="button" variant="outline" disabled={isLoading}>Cancel</Button></DialogClose>
                  <Button type="submit" disabled={isLoading || !canManagePayments} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                      {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                      Save Changes
                  </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <div className="space-y-4 mt-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h2 className="text-2xl font-headline font-semibold">Generated Bills</h2>
           <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                placeholder="Filter by tenant, space..."
                className="pl-10"
                value={billFilterTerm}
                onChange={(e) => setBillFilterTerm(e.target.value)}
              />
            </div>
        </div>

        {isLoading && bills.length > 0 && <div className="flex justify-center py-4"><Loader2 className="animate-spin h-6 w-6 text-primary"/></div>}
        
        {paginatedBills.length === 0 && !isLoading ? (
            <Card className="text-center py-12 shadow-sm">
                <CardContent>
                    <DollarSign className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
                    <h3 className="text-xl font-semibold mb-2 font-headline">{billFilterTerm ? 'No Bills Match Filter' : 'No Bills Yet'}</h3>
                    <p className="text-muted-foreground">{billFilterTerm ? 'Try a different search term.' : 'Generate bills to see them here.'}</p>
                </CardContent>
            </Card>
        ) : (
          <>
            <Card className="shadow-md">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>Tenant</TableHead>
                      <TableHead className="hidden md:table-cell">Space</TableHead>
                      <TableHead>Bill Date</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead className="hidden lg:table-cell text-right">Rent</TableHead>
                      <TableHead className="hidden lg:table-cell text-right">Utilities</TableHead>
                      <TableHead className="hidden xl:table-cell text-right">Penalty</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead className="text-right pr-2 sm:pr-4">Actions</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {paginatedBills.map((bill) => (
                        <TableRow key={bill.id} className={`${bill.currentStatus === 'Overdue' ? 'bg-destructive/5 hover:bg-destructive/10' : ''} ${bill.currentStatus === 'PendingVerification' ? 'bg-blue-500/5 hover:bg-blue-500/10' : ''}`}>
                          <TableCell className="font-medium">{bill.tenantName}</TableCell>
                          <TableCell className="hidden md:table-cell text-xs">{bill.agreement?.space?.spaceIdName}, {bill.agreement?.space?.buildingName}</TableCell>
                          <TableCell>{format(parseISO(bill.billDate), 'PP')}</TableCell>
                          <TableCell className={bill.currentStatus === 'Overdue' ? 'text-destructive font-semibold' : ''}>{format(parseISO(bill.dueDate), 'PP')}</TableCell>
                          <TableCell className="hidden lg:table-cell text-right whitespace-nowrap">{bill.rentAmount.toFixed(2)} Birr</TableCell>
                          <TableCell className="hidden lg:table-cell text-right whitespace-nowrap">
                            {bill.utilityBreakdown?.length > 0 ? (<Popover><PopoverTrigger asChild><Button variant="link" size="sm" className="p-0 h-auto font-normal text-primary hover:underline">{bill.utilityBreakdown.reduce((s, u) => s + u.amount, 0).toFixed(2)} Birr</Button></PopoverTrigger><PopoverContent className="w-auto text-xs p-2" side="top"><ul className="space-y-0.5">{bill.utilityBreakdown.map(u => (<li key={u.id || u.name} className="flex justify-between"><span>{u.name}:</span><span className="font-medium ml-2">{u.amount.toFixed(2)} Birr</span></li>))}</ul></PopoverContent></Popover>) : ('0.00 Birr')}
                          </TableCell>
                          <TableCell className="hidden xl:table-cell text-right text-destructive whitespace-nowrap">{bill.penaltyAmount ? `${bill.penaltyAmount.toFixed(2)} Birr` : '0.00 Birr'}</TableCell>
                          <TableCell className="text-right font-semibold text-primary whitespace-nowrap">{bill.totalAmount.toFixed(2)} Birr</TableCell>
                          <TableCell className="text-center"><Badge variant={getStatusBadgeVariant(bill.currentStatus || bill.status)} className={`capitalize text-xs ${bill.currentStatus === 'PendingVerification' ? 'border-blue-400 text-blue-700 bg-blue-100' : ''}`}>{getStatusIcon(bill.currentStatus || bill.status)}<span className="ml-1">{(bill.currentStatus || bill.status).replace('Verification', ' Ver.')}</span></Badge></TableCell>
                          <TableCell className="text-right pr-2 sm:pr-4">
                            <div className="flex flex-col sm:flex-row gap-1 justify-end items-stretch sm:items-center">
                              {bill.currentStatus === 'PendingVerification' && canManagePayments && ( <Button variant="default" size="sm" onClick={() => handleOpenVerificationDialog(bill)} className="bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto" disabled={isLoading}><ShieldCheck className="mr-1 h-3.5 w-3.5"/><span className="hidden sm:inline">Verify</span><span className="sm:hidden">Verify</span></Button> )}
                              {(bill.currentStatus === 'Pending' || bill.currentStatus === 'Overdue') && canManagePayments && ( <Button variant="default" size="sm" onClick={() => handleOpenPaymentDialog(bill)} className="bg-green-600 hover:bg-green-700 text-white w-full sm:w-auto" disabled={isLoading}><CreditCard className="mr-1 h-3.5 w-3.5" /><span className="hidden sm:inline">Record Pymt</span><span className="sm:hidden">Pay</span></Button> )}
                              {bill.status !== 'Paid' && canManagePayments && (<Button variant="outline" size="sm" onClick={() => handleOpenEditDialog(bill)} className="w-full sm:w-auto" disabled={isLoading}><Edit className="mr-1 h-3.5 w-3.5"/><span className="hidden sm:inline">Edit</span><span className="sm:hidden">Edit</span></Button>)}
                              {bill.currentStatus === 'Paid' && canManagePayments && ( <Button variant="outline" size="sm" onClick={() => handleOpenPaymentDialog(bill)} className="w-full sm:w-auto" disabled={isLoading}><Eye className="mr-1 h-3.5 w-3.5"/><span className="hidden sm:inline">View Details</span><span className="sm:hidden">View</span></Button> )}
                              {canDeleteBills && <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive/10 self-center sm:self-auto" onClick={() => handleDeleteBillWithConfirmation(bill.id)} disabled={isLoading || bill.status === 'Paid'}><Trash2 className="h-4 w-4"/></Button>}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
            <PaginationControls
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              itemsPerPage={itemsPerPage}
              onItemsPerPageChange={handleItemsPerPageChange}
              className="mt-4"
            />
          </>
        )}
      </div>
    </div>
  );
}
