
"use client"; 

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileText, User, HomeIcon, CalendarDays, Sigma, Printer, Download, Banknote as BanknoteIcon } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { jsPDF } from 'jspdf';
import type { PortalAgreementWithRelations } from '../../actions';

// Helper to create a safe filename
const sanitizeFilename = (name: string) => {
  return name.replace(/[^a-z0-9_.-]/gi, '_').replace(/_{2,}/g, '_');
};

export type AgreementWithRelations = PortalAgreementWithRelations;

interface ViewAgreementClientPageProps {
  agreement: AgreementWithRelations | null;
}

export function ViewAgreementClientPage({ agreement: initialAgreement }: ViewAgreementClientPageProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [agreement, setAgreement] = useState<AgreementWithRelations | null>(null);

  useEffect(() => {
    if (initialAgreement) {
        setAgreement(initialAgreement);
    } else { 
      toast({ title: "Error", description: "Agreement not found or failed to load.", variant: "destructive" });
      router.push('/portal/dashboard');
    }
  }, [initialAgreement, router, toast]);

  const handleDownloadAgreement = () => {
    if (!agreement || !agreement.agreementText) {
      toast({ title: "Cannot Download", description: "Agreement text is empty or not available.", variant: "destructive"});
      return;
    }
    
    const doc = new jsPDF();
    doc.html(agreement.agreementText, {
      callback: function (doc) {
        const tenantName = agreement.tenant?.name || 'UnknownTenant';
        const safeTenantName = sanitizeFilename(tenantName);
        doc.save(`Agreement-${safeTenantName}-${agreement.id}.pdf`);
        toast({ title: "Download Started", description: "Your agreement PDF is downloading." });
      },
      x: 15,
      y: 15,
      width: 170, // A4 width in mm minus margins
      windowWidth: 650 // An arbitrary number that works well for scaling
    });
  };
  
  if (!agreement) {
    return null;
  }

  const tenantName = agreement.tenant?.name || "N/A";
  const spaceDescription = agreement.space ? `${agreement.space.spaceIdName}, ${agreement.space.buildingName}` : "N/A";

  return (
    <div className="animate-fadeIn">
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex justify-between items-start">
            <CardTitle className="font-headline text-xl">Agreement Details</CardTitle>
            <Button onClick={handleDownloadAgreement} className="w-full sm:w-auto">
                <Download className="mr-2 h-4 w-4" /> Download Agreement
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 sm:gap-x-6 gap-y-3 mt-2 text-sm">
            <div className="flex items-center"><User className="mr-2 h-4 w-4 text-primary" /> <strong>Tenant:</strong> <span className="ml-2">{tenantName}</span></div>
            <div className="flex items-center"><HomeIcon className="mr-2 h-4 w-4 text-primary" /> <strong>Space:</strong> <span className="ml-2">{spaceDescription}</span></div>
            <div className="flex items-center"><CalendarDays className="mr-2 h-4 w-4 text-primary" /> <strong>Start Date:</strong> <span className="ml-2">{format(parseISO(agreement.startDate), 'PP')}</span></div>
            <div className="flex items-center"><CalendarDays className="mr-2 h-4 w-4 text-primary" /> <strong>Term:</strong> <span className="ml-2">{agreement.paymentTermMonths} months</span></div>
            <div className="flex items-center"><BanknoteIcon className="mr-2 h-4 w-4 text-primary" /><strong>Monthly Rent:</strong> <span className="ml-2">{Number(agreement.monthlyRentalPrice).toLocaleString()} Birr</span></div>
            <div className="flex items-center"><Sigma className="mr-2 h-4 w-4 text-primary" /> <strong>Initial Payment:</strong> <span className="ml-2">{agreement.initialPaymentMonths} month(s) upfront</span></div>
            <div className="flex items-center"><CalendarDays className="mr-2 h-4 w-4 text-primary" /> <strong>Next Lease Payment:</strong> <span className="ml-2">{format(parseISO(agreement.nextPaymentDueDate), 'PP')}</span></div>
            <div className="flex items-center"><Printer className="mr-2 h-4 w-4 text-primary" /><strong>Generated:</strong> <span className="ml-2">{format(parseISO(agreement.createdAt), 'PPp')}</span></div>
          </div>
        </CardHeader>
        <CardContent>
          <h3 className="text-lg font-semibold mb-2 font-headline mt-4 border-t pt-4">Full Agreement Text</h3>
          <ScrollArea className="h-[300px] sm:h-[400px] w-full rounded-md border p-4 bg-secondary/30"> 
            <div 
                className="prose prose-sm dark:prose-invert max-w-none" 
                dangerouslySetInnerHTML={{ __html: agreement.agreementText }} 
            />
          </ScrollArea>
          {agreement.additionalTerms && ( <> <h3 className="text-lg font-semibold mb-2 font-headline mt-4">Additional Terms</h3> <p className="text-sm text-muted-foreground p-4 border rounded-md bg-secondary/30">{agreement.additionalTerms}</p> </> )}
        </CardContent>
      </Card>
    </div>
  );
}
