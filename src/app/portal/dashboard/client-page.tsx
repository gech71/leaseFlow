
"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { PageHeader } from '@/components/custom/PageHeader';
import { FileText, Home as HomeIcon, FileSignature, DollarSign, CreditCard, AlertTriangle, CheckCircle, Info, UploadCloud, MessageSquare, Loader2, Download, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format, parseISO, isBefore, startOfDay, differenceInDays, addMonths } from 'date-fns';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { submitPaymentProofAction } from './actions';
import type { ClientAgreement, ClientBill, SerializedTenantPortalData, ClientPenaltyTier } from './page'; 
import type { BillStatus } from '@prisma/client';


// This component handles the client-side rendering and interactivity
export function CustomerDashboardClientPage({ initialData }: { initialData: SerializedTenantPortalData | null }) {
  const { toast } = useToast();
  const [isMounted, setIsMounted] = useState(false);
  const [today, setToday] = useState(startOfDay(new Date()));

  const [displayBills, setDisplayBills] = useState<ClientBill[]>([]);
  
  const [payBillDialogOpen, setPayBillDialogOpen] = useState(false);
  const [proofDialogOpen, setProofDialogOpen] = useState(false);
  const [selectedBillForDialog, setSelectedBillForDialog] = useState<ClientBill | null>(null);
  
  const [paymentMethod, setPaymentMethod] = useState("Card");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [paymentProofFile, setPaymentProofFile] = useState<File | null>(null);
  const paymentProofFileInputRef = useRef<HTMLInputElement>(null);

  const [isLoadingAction, setIsLoadingAction] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    setToday(startOfDay(new Date()));
    if (initialData?.agreement?.bills) {
      setDisplayBills(initialData.agreement.bills.map(bill => ({
        ...bill,
        currentStatus: bill.status, 
      })));
    }
  }, [initialData]);

  const agreement = initialData?.agreement;
  const aiGeneratedAgreementText = initialData?.aiGeneratedAgreementText;

  const calculatePenaltyForTenant = useCallback((bill: ClientBill, penaltyTiers: ClientPenaltyTier[]): number => {
    if (!agreement || !agreement.space || !agreement.space.building || !penaltyTiers || penaltyTiers.length === 0) {
      return 0;
    }
    const space = agreement.space;
    const dueDate = parseISO(bill.dueDate);

    if (bill.currentStatus !== 'Overdue') return 0;

    const daysOverdue = differenceInDays(today, dueDate);
    if (daysOverdue <= 0) return 0;

    let applicableTiersForScope: ClientPenaltyTier[] = [];
    const spaceSpecificTiers = penaltyTiers.filter(
      t => t.scope === 'SpecificSpaces' && t.applicableSpaceIdNames?.includes(space.spaceIdName)
    );
    if (spaceSpecificTiers.length > 0) {
      applicableTiersForScope = spaceSpecificTiers;
    } else {
      const floorSpecificTiers = penaltyTiers.filter(
        t => t.scope === 'Floor' && t.applicableFloor === space.floor
      );
      if (floorSpecificTiers.length > 0) {
        applicableTiersForScope = floorSpecificTiers;
      } else {
        applicableTiersForScope = penaltyTiers.filter(t => t.scope === 'Building');
      }
    }
    if (applicableTiersForScope.length === 0) return 0;

    const sortedTiers = [...applicableTiersForScope].sort((a, b) => a.fromDay - b.fromDay);
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
  }, [agreement, today]);


  const processedBills = useMemo(() => {
    if (!agreement) return [];
    return displayBills.map(bill => {
      let currentStatus = bill.currentStatus || bill.status; 
      if (currentStatus === 'Pending' && isBefore(parseISO(bill.dueDate), today)) {
        currentStatus = 'Overdue';
      }
      
      const penalty = (currentStatus === 'Overdue' && bill.status !== 'Paid' && bill.status !== 'PendingVerification')
                      ? calculatePenaltyForTenant(bill, agreement.space.building.penaltyPolicyTiers)
                      : (bill.penaltyAmount || 0);
                      
      const baseAmount = bill.rentAmount + bill.utilityBreakdown.reduce((sum, util) => sum + util.amount, 0);
      const totalAmount = parseFloat((baseAmount + penalty).toFixed(2));
      
      return {
        ...bill,
        currentStatus: currentStatus,
        calculatedPenalty: penalty > 0 ? penalty : null,
        calculatedTotal: totalAmount,
      };
    }).sort((a, b) => parseISO(b.billDate).getTime() - parseISO(a.billDate).getTime());
  }, [displayBills, agreement, calculatePenaltyForTenant, today]);


  const handleOpenPayDialog = (bill: ClientBill) => { setSelectedBillForDialog(bill); setPayBillDialogOpen(true); };
  const handleOpenProofDialog = (bill: ClientBill) => { setSelectedBillForDialog(bill); setProofDialogOpen(true); };

  const handleSimulatedPayment = () => {
    if (!selectedBillForDialog) return;
    setIsLoadingAction(true);
    setTimeout(() => {
      setDisplayBills(prevBills => prevBills.map(b => 
        b.id === selectedBillForDialog.id ? { ...b, currentStatus: 'Paid', paymentDate: new Date().toISOString(), paymentMethod: paymentMethod } : b
      ));
      toast({ title: "Payment Successful (Simulated)", description: `Bill ${selectedBillForDialog.id} marked as paid with ${paymentMethod}.` });
      setPayBillDialogOpen(false);
      setSelectedBillForDialog(null);
      setPaymentMethod("Card"); 
      setIsLoadingAction(false);
    }, 1000);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setPaymentProofFile(event.target.files[0]);
    } else {
      setPaymentProofFile(null);
    }
  };

  const handleSubmitProof = async () => {
    if (!selectedBillForDialog || !paymentProofFile) {
      toast({ title: "Error", description: "Please select a bill and a proof file.", variant: "destructive" });
      return;
    }
    setIsLoadingAction(true);
    const simulatedProofUrl = `simulated_proofs/${selectedBillForDialog.id}/${paymentProofFile.name}`;
    
    const result = await submitPaymentProofAction({
      billId: selectedBillForDialog.id,
      paymentProofUrl: simulatedProofUrl,
      tenantPaymentNotes: paymentNotes,
    });
    setIsLoadingAction(false);

    if (result.success && result.bill) {
      setDisplayBills(prevBills => prevBills.map(b => 
        b.id === selectedBillForDialog.id ? { ...b, currentStatus: 'PendingVerification', paymentProofUrl: simulatedProofUrl, tenantPaymentNotes: paymentNotes } : b
      ));
      toast({ title: "Proof Submitted", description: `Payment proof for bill ${selectedBillForDialog.id} submitted for verification.` });
      setProofDialogOpen(false);
      setSelectedBillForDialog(null);
      setPaymentNotes("");
      setPaymentProofFile(null);
      if (paymentProofFileInputRef.current) paymentProofFileInputRef.current.value = "";
    } else {
      toast({ title: "Proof Submission Failed", description: result.error || "An unknown error occurred.", variant: "destructive" });
    }
  };

  const getStatusBadgeVariant = (status: ClientBill['status']): "default" | "destructive" | "secondary" | "outline" => {
    switch (status) {
      case 'Paid': return 'secondary';
      case 'Pending': return 'default';
      case 'Overdue': return 'destructive';
      case 'PendingVerification': return 'outline';
      default: return 'default';
    }
  };
  const getStatusIcon = (status: ClientBill['status']) => {
    switch (status) {
      case 'Paid': return <CheckCircle className="mr-1 h-3 w-3 text-green-600" />;
      case 'Pending': return <Info className="mr-1 h-3 w-3" />;
      case 'Overdue': return <AlertTriangle className="mr-1 h-3 w-3 text-red-600" />;
      case 'PendingVerification': return <UploadCloud className="mr-1 h-3 w-3 text-blue-600" />;
      default: return <User className="mr-1 h-3 w-3" />;
    }
  };

  if (!isMounted) {
    return <div className="flex justify-center items-center h-screen"><Loader2 className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"/></div>;
  }
  
  if (initialData?.error && !agreement) {
     return (
      <Card className="mt-8 text-center">
        <CardHeader><CardTitle className="text-destructive">Error Loading Portal Data</CardTitle></CardHeader>
        <CardContent>
          <AlertTriangle className="mx-auto h-12 w-12 text-destructive mb-4" />
          <p>{initialData.error}</p>
          <p className="mt-2 text-sm text-muted-foreground">Please try again later or contact support.</p>
        </CardContent>
      </Card>
    );
  }

  if (!agreement) {
    return (
      <Card className="mt-8 text-center">
        <CardHeader><CardTitle>No Active Agreement</CardTitle></CardHeader>
        <CardContent>
          <Info className="mx-auto h-12 w-12 text-primary mb-4" />
          <p>There is no active rental agreement associated with your account at this time.</p>
          <p className="mt-2 text-sm text-muted-foreground">If you believe this is an error, please contact property management.</p>
        </CardContent>
      </Card>
    );
  }
  
  const agreementEndDate = addMonths(parseISO(agreement.startDate), agreement.paymentTermMonths);

  return (
    <div className="animate-fadeIn">
      <PageHeader title={`Welcome, ${agreement.tenant.name}!`} icon={User} description="View your lease details and manage payments." />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="font-headline text-xl flex items-center"><FileSignature className="mr-2 text-primary"/>Current Lease Agreement</CardTitle>
              <CardDescription>Details of your active rental agreement.</CardDescription>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <p><strong>Property:</strong> {agreement.space.spaceIdName}, {agreement.space.building.name}</p>
              <p><strong>Address:</strong> {agreement.space.building.address || 'N/A'}</p>
              <p><strong>Floor:</strong> {agreement.space.floor}, <strong>Area:</strong> {agreement.space.area} m²</p>
              <p><strong>Monthly Rent:</strong> {agreement.monthlyRentalPrice.toLocaleString()} Birr</p>
              <p><strong>Lease Start Date:</strong> {format(parseISO(agreement.startDate), 'PP')}</p>
              <p><strong>Lease End Date:</strong> {format(agreementEndDate, 'PP')}</p>
              <p><strong>Payment Term:</strong> {agreement.paymentTermMonths} months</p>
              <p><strong>Next Lease Payment Due:</strong> {format(parseISO(agreement.nextPaymentDueDate), 'PP')}</p>
              {agreement.initialPaymentAmount && <p><strong>Initial Payment Made:</strong> {agreement.initialPaymentAmount.toLocaleString()} Birr for {agreement.initialPaymentMonths} month(s) on {agreement.initialPaymentDate ? format(parseISO(agreement.initialPaymentDate), 'PP') : 'N/A'}</p>}
            </CardContent>
             <CardFooter>
                <Button onClick={() => toast({ title: "Download Agreement", description: "PDF download simulated."})} variant="outline">
                    <Download className="mr-2 h-4 w-4"/> Download Full Agreement PDF
                </Button>
            </CardFooter>
          </Card>

          {aiGeneratedAgreementText && (
            <Card className="shadow-lg">
              <CardHeader><CardTitle className="font-headline text-xl flex items-center"><FileText className="mr-2 text-primary"/>Agreement Summary (AI Generated)</CardTitle></CardHeader>
              <CardContent>
                <ScrollArea className="h-[200px] w-full rounded-md border p-3 bg-secondary/30">
                  <pre className="whitespace-pre-wrap text-xs font-mono leading-relaxed">{aiGeneratedAgreementText}</pre>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
          {initialData?.error && !aiGeneratedAgreementText && (
             <Card className="shadow-sm bg-destructive/10">
                <CardHeader><CardTitle className="text-sm text-destructive-foreground">AI Agreement Summary Error</CardTitle></CardHeader>
                <CardContent><p className="text-xs text-destructive-foreground">{initialData.error}</p></CardContent>
            </Card>
          )}
        </div>

        <div className="lg:col-span-1 space-y-6">
          <Card className="shadow-lg">
            <CardHeader><CardTitle className="font-headline text-xl flex items-center"><DollarSign className="mr-2 text-primary"/>My Bills</CardTitle><CardDescription>Overview of your payment obligations.</CardDescription></CardHeader>
            <CardContent>
              {processedBills.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No bills found for this agreement yet.</p>
              ) : (
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader><TableRow><TableHead className="p-1 sm:p-2">Due Date</TableHead><TableHead className="hidden sm:table-cell p-1 sm:p-2">Total</TableHead><TableHead className="p-1 sm:p-2 text-center">Status</TableHead><TableHead className="hidden sm:table-cell p-1 sm:p-2 text-right">Action</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {processedBills.map(bill => (
                        <TableRow key={bill.id} className={`${bill.currentStatus === 'Overdue' ? 'bg-destructive/5 hover:bg-destructive/10' : bill.currentStatus === 'PendingVerification' ? 'bg-blue-500/5 hover:bg-blue-500/10' : ''}`}>
                          <TableCell className={`p-1 sm:p-2 ${bill.currentStatus === 'Overdue' ? 'font-semibold text-destructive' : ''}`}>
                             <div className="flex flex-col text-xs sm:text-sm leading-tight">
                                <span>{format(parseISO(bill.dueDate), 'MMM')}</span>
                                <span>{format(parseISO(bill.dueDate), 'dd,')}</span>
                                <span className="text-xs text-muted-foreground">{format(parseISO(bill.dueDate), 'yyyy')}</span>
                              </div>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell p-1 sm:p-2 text-sm sm:text-base font-semibold text-primary whitespace-nowrap">{bill.calculatedTotal?.toFixed(2)} Birr</TableCell>
                          <TableCell className="p-1 sm:p-2 text-center">
                            <Badge variant={getStatusBadgeVariant(bill.currentStatus || bill.status)} className={`capitalize text-xs ${bill.currentStatus === 'PendingVerification' ? 'border-blue-400 text-blue-700 bg-blue-100' : ''}`}>{getStatusIcon(bill.currentStatus || bill.status)}<span className="ml-1">{(bill.currentStatus || bill.status).replace('Verification',' Ver.')}</span></Badge>
                            {bill.calculatedPenalty && bill.calculatedPenalty > 0 && (<Popover><PopoverTrigger asChild><AlertTriangle className="h-3.5 w-3.5 text-destructive inline-block ml-1 cursor-help"/></PopoverTrigger><PopoverContent className="text-xs w-auto p-2" side="top">Penalty: {bill.calculatedPenalty.toFixed(2)} Birr</PopoverContent></Popover>)}
                          </TableCell>
                          <TableCell className="hidden sm:table-cell p-1 sm:p-2 text-right">
                            {(bill.currentStatus === 'Pending' || bill.currentStatus === 'Overdue') && (
                              <Button size="sm" variant="default" onClick={() => handleOpenPayDialog(bill)} className="text-xs h-7 px-2 bg-green-600 hover:bg-green-700" disabled={isLoadingAction}>Pay</Button>
                            )}
                            {bill.currentStatus === 'Paid' && (
                              <span className="text-xs text-muted-foreground">Paid</span>
                            )}
                             {bill.currentStatus === 'PendingVerification' && (
                              <Button size="sm" variant="outline" className="text-xs h-7 px-2" disabled>Verifying</Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      
      <Dialog open={payBillDialogOpen} onOpenChange={(isOpen) => { setPayBillDialogOpen(isOpen); if(!isOpen) setSelectedBillForDialog(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-headline">Pay Bill (Simulated)</DialogTitle>
            <DialogDescription>
              Bill ID: {selectedBillForDialog?.id} <br/>
              Amount Due: {processedBills.find(b=>b.id === selectedBillForDialog?.id)?.calculatedTotal?.toFixed(2)} Birr
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="paymentMethodDialog">Payment Method</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger id="paymentMethodDialog"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Card">Credit/Debit Card</SelectItem>
                  <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                  <SelectItem value="Wallet">Digital Wallet</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(paymentMethod === "Bank Transfer" || paymentMethod === "Wallet") && (
              <div className="text-sm p-3 bg-secondary/50 rounded-md border border-border">
                <p className="font-semibold">Instructions for {paymentMethod}:</p>
                {paymentMethod === "Bank Transfer" && (
                  <>
                    <p>Bank: LeaseFlow Central Bank</p>
                    <p>Account: 123-456-7890</p>
                    <p>Reference: Bill ID {selectedBillForDialog?.id}</p>
                  </>
                )}
                {paymentMethod === "Wallet" && (
                  <>
                    <p>Wallet Provider: LFPay</p>
                    <p>Recipient ID: tenant_payments@leaseflow.com</p>
                    <p>Reference: Bill ID {selectedBillForDialog?.id}</p>
                  </>
                )}
                <p className="mt-2">After payment, please click <strong>"Submit Proof"</strong> on the dashboard to upload your transaction receipt.</p>
              </div>
            )}
            {paymentMethod === "Card" && (
                 <p className="text-sm text-muted-foreground">This is a simulated payment. No actual transaction will occur.</p>
            )}

          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline" disabled={isLoadingAction}>Cancel</Button></DialogClose>
            {paymentMethod === "Card" && (
                <Button onClick={handleSimulatedPayment} disabled={isLoadingAction}>
                    {isLoadingAction && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Confirm Payment
                </Button>
            )}
             {(paymentMethod === "Bank Transfer" || paymentMethod === "Wallet") && (
                <Button onClick={() => { setPayBillDialogOpen(false); if(selectedBillForDialog) handleOpenProofDialog(selectedBillForDialog); }} disabled={isLoadingAction}>
                   Proceed to Submit Proof
                </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={proofDialogOpen} onOpenChange={(isOpen) => { setProofDialogOpen(isOpen); if(!isOpen) {setSelectedBillForDialog(null); setPaymentProofFile(null); if(paymentProofFileInputRef.current) paymentProofFileInputRef.current.value = ""; setPaymentNotes(""); }}}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-headline">Submit Payment Proof</DialogTitle>
            <DialogDescription>
              For Bill ID: {selectedBillForDialog?.id} - Amount: {processedBills.find(b=>b.id === selectedBillForDialog?.id)?.calculatedTotal?.toFixed(2)} Birr
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div><Label htmlFor="paymentProofFile" className="flex items-center mb-1"><UploadCloud className="mr-2 h-4 w-4 text-primary"/>Upload Proof (e.g., bank slip)</Label><Input id="paymentProofFile" type="file" onChange={handleFileSelect} ref={paymentProofFileInputRef} className="text-sm file:mr-2 file:py-1.5 file:px-2 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"/>{paymentProofFile && <p className="text-xs text-muted-foreground mt-1">Selected: {paymentProofFile.name}</p>}</div>
            <div><Label htmlFor="paymentNotes" className="flex items-center mb-1"><MessageSquare className="mr-2 h-4 w-4 text-primary"/>Notes (Optional)</Label><Textarea id="paymentNotes" placeholder="e.g., Paid via XYZ bank, ref #123" value={paymentNotes} onChange={(e) => setPaymentNotes(e.target.value)} rows={2}/></div>
          </div>
          <DialogFooter><DialogClose asChild><Button variant="outline" disabled={isLoadingAction}>Cancel</Button></DialogClose><Button onClick={handleSubmitProof} disabled={!paymentProofFile || isLoadingAction}>{isLoadingAction && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Submit for Verification</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
