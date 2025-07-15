
"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { PageHeader } from '@/components/custom/PageHeader';
import { FileText, Home as HomeIcon, FileSignature, DollarSign, CreditCard, AlertTriangle, CheckCircle, Info, UploadCloud, MessageSquare, Loader2, Download, User, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format, parseISO, isBefore, startOfDay, differenceInDays, addMonths, formatDistanceToNow } from 'date-fns';
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
import type { ClientAgreement, ClientBill, SerializedTenantPortalData, ClientPenaltyTier } from '../(app)/dashboard/page'; 
import type { BillStatus } from '@prisma/client';
import { jsPDF } from 'jspdf';

// Helper to create a safe filename
const sanitizeFilename = (name: string) => {
  return name.replace(/[^a-z0-9_.-]/gi, '_').replace(/_{2,}/g, '_');
};


// This component handles the client-side rendering and interactivity
export function CustomerDashboardClientPage({ initialData }: { initialData: SerializedTenantPortalData | null }) {
  const { toast } = useToast();
  const [isMounted, setIsMounted] = useState(false);
  const [today, setToday] = useState(startOfDay(new Date()));

  useEffect(() => {
    setIsMounted(true);
    setToday(startOfDay(new Date()));
    if (initialData?.error) {
        toast({
          title: "Error",
          description: initialData.error,
          variant: "destructive",
        });
    }
  }, [initialData, toast]);

  const agreement = initialData?.agreement;

  const handleDownloadAgreement = () => {
    if (!agreement || !agreement.agreementText) {
      toast({ title: "Cannot Download", description: "Agreement text is not available.", variant: "destructive"});
      return;
    }

    const doc = new jsPDF();
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    
    const textLines = doc.splitTextToSize(agreement.agreementText, 180);
    doc.text(textLines, 15, 15);

    const tenantName = agreement.tenant?.name || 'UnknownTenant';
    const safeTenantName = sanitizeFilename(tenantName);

    doc.save(`Agreement-${safeTenantName}-${agreement.id}.pdf`);
    
    toast({ title: "Download Started", description: "Your agreement PDF is downloading." });
  };

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
    return (agreement.bills || []).map(bill => {
      let currentStatus = bill.status; 
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
  }, [agreement, calculatePenaltyForTenant, today]);

  const getStatusBadgeVariant = (status: BillStatus): "default" | "destructive" | "secondary" | "outline" => {
    switch (status) {
      case 'Paid': return 'secondary';
      case 'Pending': return 'default';
      case 'Overdue': return 'destructive';
      case 'PendingVerification': return 'outline';
      default: return 'default';
    }
  };
  const getStatusIcon = (status: BillStatus) => {
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
            <CardContent className="text-sm">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                    <p><strong>Property:</strong> {agreement.space.spaceIdName}, {agreement.space.building.name}</p>
                    <p><strong>Address:</strong> {agreement.space.building.address || 'N/A'}</p>
                    <p><strong>Floor:</strong> {agreement.space.floor}, <strong>Area:</strong> {agreement.space.area} m²</p>
                    <p><strong>Monthly Rent:</strong> {agreement.monthlyRentalPrice.toLocaleString()} Birr</p>
                    <p><strong>Lease Start Date:</strong> {format(parseISO(agreement.startDate), 'PP')}</p>
                    <p><strong>Lease End Date:</strong> {format(agreementEndDate, 'PP')}</p>
                    <p><strong>Payment Term:</strong> {agreement.paymentTermMonths} months</p>
                    <p><strong>Next Lease Payment Due:</strong> {format(parseISO(agreement.nextPaymentDueDate), 'PP')}</p>
                </div>
                {agreement.initialPaymentAmount && <p className="mt-2 pt-2 border-t"><strong>Initial Payment Made:</strong> {agreement.initialPaymentAmount.toLocaleString()} Birr for {agreement.initialPaymentMonths} month(s) on {agreement.initialPaymentDate ? format(parseISO(agreement.initialPaymentDate), 'PP') : 'N/A'}</p>}
            </CardContent>
             <CardFooter>
                <Button onClick={handleDownloadAgreement} variant="outline" className="w-full sm:w-auto">
                    <Download className="mr-2 h-4 w-4"/> Download Full Agreement PDF
                </Button>
            </CardFooter>
          </Card>
        </div>

        <div className="lg:col-span-1 space-y-6">
          <Card className="shadow-lg">
            <CardHeader><CardTitle className="font-headline text-xl flex items-center"><DollarSign className="mr-2 text-primary"/>My Bills</CardTitle><CardDescription>Overview of your payment obligations.</CardDescription></CardHeader>
            <CardContent>
              {processedBills.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No bills found for this agreement yet.</p>
              ) : (
                <div className="md:block">
                  <Table>
                    <TableHeader><TableRow><TableHead>Due Date</TableHead><TableHead>Total</TableHead><TableHead className="text-center">Status</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {processedBills.map(bill => (
                        <TableRow key={bill.id} className={`${bill.currentStatus === 'Overdue' ? 'bg-destructive/5 hover:bg-destructive/10' : bill.currentStatus === 'PendingVerification' ? 'bg-blue-500/5 hover:bg-blue-500/10' : ''}`}>
                          <TableCell className={`p-2 ${bill.currentStatus === 'Overdue' ? 'font-semibold text-destructive' : ''}`}>
                            {format(parseISO(bill.dueDate), 'PP')}
                          </TableCell>
                          <TableCell className="p-2 text-base font-semibold text-primary whitespace-nowrap">{bill.calculatedTotal?.toFixed(2)} Birr</TableCell>
                          <TableCell className="p-2 text-center">
                            <Badge variant={getStatusBadgeVariant(bill.currentStatus || bill.status)} className={`capitalize text-xs ${bill.currentStatus === 'PendingVerification' ? 'border-blue-400 text-blue-700 bg-blue-100' : ''}`}>{getStatusIcon(bill.currentStatus || bill.status)}<span className="ml-1">{(bill.currentStatus || bill.status).replace('Verification',' Ver.')}</span></Badge>
                            {bill.calculatedPenalty && bill.calculatedPenalty > 0 && (<Popover><PopoverTrigger asChild><AlertTriangle className="h-3.5 w-3.5 text-destructive inline-block ml-1 cursor-help"/></PopoverTrigger><PopoverContent className="text-xs w-auto p-2" side="top">Penalty: {bill.calculatedPenalty.toFixed(2)} Birr</PopoverContent></Popover>)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
