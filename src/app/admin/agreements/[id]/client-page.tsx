
"use client"; 

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation'; // useParams can be used if needed, but id is passed via props
import Link from 'next/link';
import { PageHeader } from '@/components/custom/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileText, ArrowLeft, User, HomeIcon, CalendarDays, Sigma, Printer, Download, Banknote as BanknoteIcon, CreditCard, Landmark, Wallet, Coins, HelpCircle, Loader2 } from 'lucide-react';
import type { Agreement as AgreementPrisma, Tenant, Space } from '@prisma/client';
import { format, parseISO } from 'date-fns';
import React from 'react';
import { useToast } from '@/hooks/use-toast';
import { jsPDF } from 'jspdf';

// Helper to create a safe filename
const sanitizeFilename = (name: string) => {
  return name.replace(/[^a-z0-9_.-]/gi, '_').replace(/_{2,}/g, '_');
};

export interface AgreementWithRelations extends AgreementPrisma {
  tenant: Tenant | null;
  space: Space | null;
  // Dates are expected as strings from server props
  startDate: string;
  nextPaymentDueDate: string;
  createdAt: string;
  updatedAt: string;
  initialPaymentDate?: string;
}

interface ViewAgreementClientPageProps {
  agreement: AgreementWithRelations | null;
}

export function ViewAgreementClientPage({ agreement: initialAgreement }: ViewAgreementClientPageProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [agreement, setAgreement] = useState<AgreementWithRelations | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    if (initialAgreement) {
        setAgreement(initialAgreement);
    } else if (isMounted) { 
      toast({ title: "Error", description: "Agreement not found or failed to load.", variant: "destructive" });
      router.push('/admin/agreements');
    }
  }, [initialAgreement, router, isMounted, toast]);

  const handleDownloadAgreement = () => {
    if (!agreement || !agreement.agreementText) {
      toast({ title: "Cannot Download", description: "Agreement text is empty or not available.", variant: "destructive"});
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

  const getPaymentMethodIcon = (method?: string | null) => {
    if (!method) return HelpCircle;
    if (method.toLowerCase().includes('card')) return CreditCard;
    if (method.toLowerCase().includes('bank')) return Landmark;
    if (method.toLowerCase().includes('wallet')) return Wallet;
    if (method.toLowerCase().includes('cash')) return Coins;
    return HelpCircle;
  }
  
  if (!isMounted || !agreement) {
    return (
        <div className="flex justify-center items-center h-screen">
            <Loader2 className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"/>
        </div>
    );
  }

  const tenantName = agreement.tenant?.name || "N/A";
  const spaceDescription = agreement.space ? `${agreement.space.spaceIdName}, ${agreement.space.buildingName}` : "N/A";

  return (
    <div className="animate-fadeIn">
      <PageHeader
        title={`Agreement: ${tenantName}`}
        icon={FileText}
        description={`Details for agreement ID: ${agreement.id}`}
        actions={ <Link href="/admin/agreements" passHref> <Button variant="outline" className="w-full sm:w-auto"> <ArrowLeft className="mr-2 h-4 w-4" /> Back to All Agreements </Button> </Link> }
      />
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline text-xl">Agreement Details</CardTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 sm:gap-x-6 gap-y-3 mt-2 text-sm">
            <div className="flex items-center"><User className="mr-2 h-4 w-4 text-primary" /> <strong>Tenant:</strong> <span className="ml-2">{tenantName}</span></div>
            <div className="flex items-center"><HomeIcon className="mr-2 h-4 w-4 text-primary" /> <strong>Space:</strong> <span className="ml-2">{spaceDescription}</span></div>
            <div className="flex items-center"><CalendarDays className="mr-2 h-4 w-4 text-primary" /> <strong>Start Date:</strong> <span className="ml-2">{format(parseISO(agreement.startDate), 'PP')}</span></div>
            <div className="flex items-center"><CalendarDays className="mr-2 h-4 w-4 text-primary" /> <strong>Term:</strong> <span className="ml-2">{agreement.paymentTermMonths} months</span></div>
            <div className="flex items-center"><BanknoteIcon className="mr-2 h-4 w-4 text-primary" /><strong>Monthly Rent:</strong> <span className="ml-2">{agreement.monthlyRentalPrice.toLocaleString()} Birr</span></div>
            <div className="flex items-center"><Sigma className="mr-2 h-4 w-4 text-primary" /> <strong>Initial Payment:</strong> <span className="ml-2">{agreement.initialPaymentMonths} month(s) upfront</span></div>
            <div className="flex items-center"><CalendarDays className="mr-2 h-4 w-4 text-primary" /> <strong>Next Lease Payment:</strong> <span className="ml-2">{format(parseISO(agreement.nextPaymentDueDate), 'PP')}</span></div>
            <div className="flex items-center"><Printer className="mr-2 h-4 w-4 text-primary" /><strong>Generated:</strong> <span className="ml-2">{format(parseISO(agreement.createdAt), 'PPp')}</span></div>
          </div>
        </CardHeader>
        <CardContent>
          {agreement.initialPaymentAmount !== undefined && agreement.initialPaymentAmount !== null && (
            <>
              <h3 className="text-lg font-semibold mb-2 font-headline mt-4 border-t pt-4">Initial Payment Details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 sm:gap-x-6 gap-y-2 text-sm p-4 border rounded-md bg-secondary/30">
                <div className="flex items-center"><BanknoteIcon className="mr-2 h-4 w-4 text-primary" /> <strong>Amount Paid:</strong> <span className="ml-2">{agreement.initialPaymentAmount.toLocaleString()} Birr</span></div>
                {agreement.initialPaymentMethod && (<div className="flex items-center">{React.createElement(getPaymentMethodIcon(agreement.initialPaymentMethod), { className: "mr-2 h-4 w-4 text-primary" })}<strong>Method:</strong> <span className="ml-2">{agreement.initialPaymentMethod}</span></div>)}
                {agreement.initialPaymentBankOrWalletName && (<div className="flex items-center"><Landmark className="mr-2 h-4 w-4 text-primary" /> <strong>Bank/Wallet:</strong> <span className="ml-2">{agreement.initialPaymentBankOrWalletName}</span></div>)}
                {agreement.initialPaymentReference && (<div className="flex items-center"><Sigma className="mr-2 h-4 w-4 text-primary" /> <strong>Reference:</strong> <span className="ml-2">{agreement.initialPaymentReference}</span></div>)}
                {agreement.initialPaymentDate && (<div className="flex items-center"><CalendarDays className="mr-2 h-4 w-4 text-primary" /> <strong>Payment Date:</strong> <span className="ml-2">{format(parseISO(agreement.initialPaymentDate), 'PPp')}</span></div>)}
              </div>
            </>
          )}
          <h3 className="text-lg font-semibold mb-2 font-headline mt-4 border-t pt-4">Full Agreement Text</h3>
          <ScrollArea className="h-[300px] sm:h-[400px] w-full rounded-md border p-4 bg-secondary/30"> <pre className="whitespace-pre-wrap text-sm font-mono leading-relaxed"> {agreement.agreementText} </pre> </ScrollArea>
          {agreement.additionalTerms && ( <> <h3 className="text-lg font-semibold mb-2 font-headline mt-4">Additional Terms</h3> <p className="text-sm text-muted-foreground p-4 border rounded-md bg-secondary/30">{agreement.additionalTerms}</p> </> )}
        </CardContent>
        <CardFooter className="border-t pt-4 flex justify-end">
          <Button onClick={handleDownloadAgreement} className="w-full sm:w-auto">
            <Download className="mr-2 h-4 w-4" /> Download Agreement
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
