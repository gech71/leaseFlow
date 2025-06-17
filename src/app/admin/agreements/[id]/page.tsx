
"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { PageHeader } from '@/components/custom/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileText, ArrowLeft, User, HomeIcon, CalendarDays, Sigma, Printer, Download } from 'lucide-react';
import type { Agreement } from '@/lib/types';
import { getMockAgreementById } from '../page'; // Assuming mock data access from list page
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

export default function ViewAgreementPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const [agreement, setAgreement] = useState<Agreement | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  const agreementId = typeof params.id === 'string' ? params.id : undefined;

  useEffect(() => {
    setIsMounted(true);
    if (agreementId) {
      const foundAgreement = getMockAgreementById(agreementId);
      if (foundAgreement) {
        setAgreement(foundAgreement);
      } else {
        // Handle not found, maybe redirect or show error
        toast({ title: "Error", description: "Agreement not found.", variant: "destructive" });
        router.push('/admin/agreements');
      }
    }
  }, [agreementId, router, toast]);

  const handleDownloadPdf = () => {
    toast({
      title: "Download PDF",
      description: "PDF download functionality is coming soon!",
    });
  };
  
  if (!isMounted || !agreementId) {
    return <div className="flex justify-center items-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;
  }

  if (!agreement) {
    // This case should ideally be handled by the redirect in useEffect, but as a fallback:
    return (
      <div className="animate-fadeIn">
        <PageHeader title="Agreement Not Found" icon={FileText} />
        <Card>
          <CardContent className="p-6 text-center">
            <p className="mb-4">The requested agreement could not be found.</p>
            <Link href="/admin/agreements" passHref>
              <Button variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Agreements
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="animate-fadeIn">
      <PageHeader
        title={`Agreement: ${agreement.tenantName}`}
        icon={FileText}
        description={`Details for agreement ID: ${agreement.id}`}
        actions={
          <Link href="/admin/agreements" passHref>
            <Button variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to All Agreements
            </Button>
          </Link>
        }
      />

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline text-xl">Agreement Details</CardTitle>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 mt-2 text-sm">
            <div className="flex items-center">
              <User className="mr-2 h-4 w-4 text-primary" /> 
              <strong>Tenant:</strong> <span className="ml-2">{agreement.tenantName}</span>
            </div>
            <div className="flex items-center">
              <HomeIcon className="mr-2 h-4 w-4 text-primary" /> 
              <strong>Space:</strong> <span className="ml-2">{agreement.spaceDescription}</span>
            </div>
            <div className="flex items-center">
              <CalendarDays className="mr-2 h-4 w-4 text-primary" /> 
              <strong>Start Date:</strong> <span className="ml-2">{format(new Date(agreement.startDate), 'PP')}</span>
            </div>
            <div className="flex items-center">
              <CalendarDays className="mr-2 h-4 w-4 text-primary" /> 
              <strong>Term:</strong> <span className="ml-2">{agreement.paymentTermMonths} months</span>
            </div>
            <div className="flex items-center">
              <Sigma className="mr-2 h-4 w-4 text-primary" /> 
              <strong>Initial Payment:</strong> <span className="ml-2">{agreement.initialPaymentMonths} month(s)</span>
            </div>
            <div className="flex items-center">
              <CalendarDays className="mr-2 h-4 w-4 text-primary" /> 
              <strong>Next Payment Due:</strong> <span className="ml-2">{format(new Date(agreement.nextPaymentDueDate), 'PP')}</span>
            </div>
            <div className="flex items-center">
               <DollarSign className="mr-2 h-4 w-4 text-primary" />
               <strong>Monthly Rent:</strong> <span className="ml-2">${agreement.monthlyRentalPrice.toLocaleString()}</span>
            </div>
             <div className="flex items-center">
               <Printer className="mr-2 h-4 w-4 text-primary" />
               <strong>Generated:</strong> <span className="ml-2">{format(new Date(agreement.createdAt), 'PPp')}</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <h3 className="text-lg font-semibold mb-2 font-headline mt-4 border-t pt-4">Full Agreement Text</h3>
          <ScrollArea className="h-[400px] w-full rounded-md border p-4 bg-secondary/30">
            <pre className="whitespace-pre-wrap text-sm font-mono leading-relaxed">
              {agreement.agreementText}
            </pre>
          </ScrollArea>
          {agreement.additionalTerms && (
            <>
              <h3 className="text-lg font-semibold mb-2 font-headline mt-4">Additional Terms</h3>
              <p className="text-sm text-muted-foreground p-4 border rounded-md bg-secondary/30">{agreement.additionalTerms}</p>
            </>
          )}
        </CardContent>
        <CardFooter className="border-t pt-4 flex justify-end">
           <Button onClick={handleDownloadPdf}>
            <Download className="mr-2 h-4 w-4" /> Download PDF
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

// Helper icon, assuming lucide-react is used consistently
const DollarSign = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <line x1="12" y1="1" x2="12" y2="23"></line>
    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
  </svg>
);

