
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/custom/PageHeader';
import { FileSignature, DollarSign, AlertTriangle, CheckCircle, Info, UploadCloud, Download, User, Clock, Home } from 'lucide-react';
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from '@/components/ui/scroll-area';
import type { ClientAgreement, ClientBill, SerializedTenantPortalData, ClientPenaltyTier } from './page'; 
import type { BillStatus } from '@prisma/client';
import { jsPDF } from 'jspdf';

// Helper to create a safe filename
const sanitizeFilename = (name: string) => {
  return name.replace(/[^a-z0-9_.-]/gi, '_').replace(/_{2,}/g, '_');
};

export function CustomerDashboardClientPage({ initialData }: { initialData: SerializedTenantPortalData | null }) {
  const { toast } = useToast();
  const [isMounted, setIsMounted] = useState(false);
  const [today, setToday] = useState(startOfDay(new Date()));

  useEffect(() => {
    setIsMounted(true);
    setToday(startOfDay(new Date()));
    if (initialData?.error) {
      toast({
        title: "Error Loading Data",
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

    if (bill.status !== 'Overdue') {
        const isCurrentlyOverdue = isBefore(dueDate, today);
        if(!isCurrentlyOverdue) return 0;
    }
    
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
    return agreement.bills.map(bill => {
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
    return <div className="flex justify-center items-center h-screen"></div>;
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
      <PageHeader
        title={`Welcome, ${agreement.tenant.name}!`}
        icon={User}
        description="View your lease details and billing history."
        actions={
          <Link href={`/portal/billing?phone=${agreement.tenant.phone}`} passHref>
            <Button>
              <DollarSign className="mr-2 h-4 w-4" />
              Pay Bill
            </Button>
          </Link>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-3 space-y-6">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="font-headline text-xl flex items-center"><FileSignature className="mr-2 text-primary"/>Current Lease Agreement</CardTitle>
              <CardDescription>Details of your rental agreement.</CardDescription>
            </CardHeader>
            <CardContent className="text-sm">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-2">
                    <p><strong>Property:</strong> {agreement.space.spaceIdName}, {agreement.space.building.name}</p>
                    <p><strong>Address:</strong> {agreement.space.building.address || 'N/A'}</p>
                    <p><strong>Floor:</strong> {agreement.space.floor}</p>
                    <p><strong>Area:</strong> {agreement.space.area} m²</p>
                    <p><strong>Monthly Rent:</strong> {agreement.monthlyRentalPrice.toLocaleString()} Birr</p>
                    <p><strong>Lease Start Date:</strong> {format(parseISO(agreement.startDate), 'PP')}</p>
                    <p><strong>Lease End Date:</strong> {format(agreementEndDate, 'PP')}</p>
                    <p><strong>Payment Term:</strong> {agreement.paymentTermMonths} months</p>
                    <p><strong>Next Lease Payment Due:</strong> {format(parseISO(agreement.nextPaymentDueDate), 'PP')}</p>
                </div>
            </CardContent>
             <CardFooter>
                <Button onClick={handleDownloadAgreement} variant="outline" className="w-full sm:w-auto">
                    <Download className="mr-2 h-4 w-4"/> Download Full Agreement PDF
                </Button>
            </CardFooter>
          </Card>

           <Card className="shadow-lg">
            <CardHeader><CardTitle className="font-headline text-xl flex items-center"><DollarSign className="mr-2 text-primary"/>Billing History</CardTitle><CardDescription>Your payment obligations and history.</CardDescription></CardHeader>
            <CardContent>
              {processedBills.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No bills found for this agreement yet.</p>
              ) : (
                <div className="w-full overflow-x-auto">
                  <Table>
                    <TableHeader><TableRow><TableHead>Due Date</TableHead><TableHead>Rent</TableHead><TableHead>Utilities</TableHead><TableHead>Penalty</TableHead><TableHead>Total Due</TableHead><TableHead className="text-center">Status</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {processedBills.map(bill => (
                        <TableRow key={bill.id} className={`${bill.currentStatus === 'Overdue' ? 'bg-destructive/5 hover:bg-destructive/10' : bill.currentStatus === 'PendingVerification' ? 'bg-blue-500/5 hover:bg-blue-500/10' : ''}`}>
                          <TableCell className={`p-2 ${bill.currentStatus === 'Overdue' ? 'font-semibold text-destructive' : ''}`}>
                            {format(parseISO(bill.dueDate), 'PP')}
                          </TableCell>
                          <TableCell className="p-2 whitespace-nowrap">{bill.rentAmount.toFixed(2)} Birr</TableCell>
                          <TableCell className="p-2 whitespace-nowrap">
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="link" className="p-0 h-auto text-primary">{bill.utilityBreakdown.reduce((sum, u) => sum + u.amount, 0).toFixed(2)} Birr</Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-60">
                                    <div className="grid gap-2">
                                    <h4 className="font-medium leading-none">Utility Details</h4>
                                    <div className="text-sm space-y-1">
                                        {bill.utilityBreakdown.length > 0 ? bill.utilityBreakdown.map(u => (
                                            <div key={u.id || u.name} className="flex justify-between"><span>{u.name}:</span> <span>{u.amount.toFixed(2)}</span></div>
                                        )) : <p className="text-muted-foreground">No utility items.</p>}
                                    </div>
                                    </div>
                                </PopoverContent>
                            </Popover>
                          </TableCell>
                           <TableCell className="p-2 whitespace-nowrap text-destructive">
                            {bill.calculatedPenalty ? `${bill.calculatedPenalty.toFixed(2)} Birr` : '-'}
                          </TableCell>
                           <TableCell className="p-2 text-base font-semibold text-primary whitespace-nowrap">{bill.calculatedTotal?.toFixed(2)} Birr</TableCell>
                          <TableCell className="p-2 text-center">
                            <Badge variant={getStatusBadgeVariant(bill.currentStatus || bill.status)} className={`capitalize text-xs ${bill.currentStatus === 'PendingVerification' ? 'border-blue-400 text-blue-700 bg-blue-100' : ''}`}>{getStatusIcon(bill.currentStatus || bill.status)}<span className="ml-1">{(bill.currentStatus || bill.status).replace('Verification',' Ver.')}</span></Badge>
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
