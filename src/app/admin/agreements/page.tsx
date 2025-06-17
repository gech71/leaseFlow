
"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/custom/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, PlusCircle, Eye, Download, Search, AlertTriangle } from 'lucide-react';
import type { Agreement } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { addMonths, format, isBefore, startOfDay } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

// Mock data for agreements
const initialAgreements: Agreement[] = [
  {
    id: 'agreement1',
    tenantId: 'tenant1',
    tenantName: 'Alice Wonderland',
    spaceId: 'space1',
    spaceDescription: 'Unit 101, Sunrise Tower',
    agreementText: 'RENTAL AGREEMENT\n\nThis agreement is made between Landlord and Alice Wonderland (Tenant) for the lease of Unit 101, Sunrise Tower.\n\nTerm: 12 months\nRent: $2500/month\nInitial Payment: 1 month\n\nAdditional Clauses:\n- No pets allowed.\n- Quiet hours after 10 PM.\n\nSigned:____________________',
    startDate: new Date(2023, 0, 15).toISOString(),
    monthlyRentalPrice: 2500,
    // utilityRate: 1.0, // Removed
    createdAt: new Date(2023,0,10).toISOString(),
    paymentTermMonths: 12,
    initialPaymentMonths: 1,
    nextPaymentDueDate: addMonths(new Date(2023, 0, 15), 1).toISOString(),
  },
  {
    id: 'agreement2',
    tenantId: 'tenant2',
    tenantName: 'Bob The Builder',
    spaceId: 'space3',
    spaceDescription: 'Office 5B, Downtown Hub',
    agreementText: 'RENTAL AGREEMENT\n\nThis agreement is made between Landlord and Bob The Builder (Tenant) for the lease of Office 5B, Downtown Hub.\n\nTerm: 6 months\nRent: $3200/month\nInitial Payment: 1 month\n\nAdditional Clauses:\n- Parking spot #12 included.\n\nSigned:____________________',
    startDate: new Date(2024, 4, 1).toISOString(), 
    monthlyRentalPrice: 3200,
    // utilityRate: 1.0, // Removed
    createdAt: new Date(2024,4,1).toISOString(),
    paymentTermMonths: 6,
    initialPaymentMonths: 1,
    nextPaymentDueDate: addMonths(new Date(2024, 4, 1), 1).toISOString(), 
  },
  {
    id: 'agreement3',
    tenantId: 'tenant3',
    tenantName: 'Carol Danvers',
    spaceId: 'space4',
    spaceDescription: 'Penthouse Suite, Galaxy Tower',
    agreementText: 'PREMIUM RENTAL AGREEMENT\n\nThis agreement is made between Landlord and Carol Danvers (Tenant) for the lease of Penthouse Suite, Galaxy Tower.\n\nTerm: 24 months\nRent: $5000/month\nInitial Payment: 3 months\n\nAdditional Clauses:\n- Access to rooftop pool included.\n- Weekly cleaning service provided.\n\nSigned:____________________',
    startDate: new Date(2024, 6, 1).toISOString(), 
    monthlyRentalPrice: 5000,
    // utilityRate: 1.0, // Removed
    createdAt: new Date(2024,6,1).toISOString(),
    paymentTermMonths: 24,
    initialPaymentMonths: 3,
    nextPaymentDueDate: addMonths(new Date(2024, 6, 1), 3).toISOString(), 
  },
];

export const getMockAgreements = (): Agreement[] => {
  if (typeof window !== 'undefined') {
    const storedAgreements = localStorage.getItem('mockAgreements');
    if (storedAgreements) {
      return JSON.parse(storedAgreements);
    }
    localStorage.setItem('mockAgreements', JSON.stringify(initialAgreements));
  }
  return initialAgreements;
};

export const getMockAgreementById = (id: string): Agreement | undefined => {
  const agreements = getMockAgreements();
  return agreements.find(agreement => agreement.id === id);
};


export default function AgreementsListPage() {
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isMounted, setIsMounted] = useState(false);
  const [today, setToday] = useState(startOfDay(new Date()));
  const { toast } = useToast();

  useEffect(() => {
    setIsMounted(true);
    setAgreements(getMockAgreements());
    setToday(startOfDay(new Date())); 
  }, []);
  
  const filteredAgreements = agreements.filter(agreement =>
    agreement.tenantName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    agreement.spaceDescription.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const isPaymentOverdue = (agreement: Agreement): boolean => {
    const nextPaymentDate = startOfDay(new Date(agreement.nextPaymentDueDate));
    const leaseEndDate = addMonths(new Date(agreement.startDate), agreement.paymentTermMonths);
    return isBefore(nextPaymentDate, today) && isBefore(today, leaseEndDate);
  };

  const handleDownloadPdf = (agreementId: string) => {
    toast({
      title: "Download PDF",
      description: "PDF download functionality is coming soon!",
    });
  };

  if (!isMounted) {
    return <div className="flex justify-center items-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;
  }

  return (
    <div className="animate-fadeIn">
      <PageHeader
        title="Rental Agreements"
        icon={FileText}
        description="Browse and manage all generated rental agreements."
        actions={
          <Link href="/admin/agreements/generate" passHref>
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
              <PlusCircle className="mr-2 h-5 w-5" /> Create New Agreement
            </Button>
          </Link>
        }
      />

      <Card className="mb-6 shadow-sm">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input 
              placeholder="Search by tenant or space..." 
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {filteredAgreements.length === 0 ? (
        <Card className="text-center py-12 shadow-sm">
          <CardContent>
            <FileText className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2 font-headline">No Agreements Found</h3>
            <p className="text-muted-foreground mb-4">
              {searchTerm ? "No agreements match your search." : "No agreements have been generated yet."}
            </p>
            {!searchTerm && (
                <Link href="/admin/agreements/generate" passHref>
                    <Button>
                    <PlusCircle className="mr-2 h-5 w-5" /> Create Agreement
                    </Button>
                </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {filteredAgreements.map((agreement) => {
            const overdue = isPaymentOverdue(agreement);
            return (
              <Card key={agreement.id} className={`flex flex-col justify-between shadow-lg hover:shadow-xl transition-shadow duration-300 transform hover:-translate-y-1 ${overdue ? 'border-destructive border-2' : ''}`}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <CardTitle className="font-headline text-lg">{agreement.tenantName}</CardTitle>
                    {overdue && (
                      <Badge variant="destructive" className="flex items-center">
                        <AlertTriangle className="mr-1 h-3 w-3" /> Overdue
                      </Badge>
                    )}
                  </div>
                  <CardDescription>{agreement.spaceDescription}</CardDescription>
                </CardHeader>
                <CardContent className="text-sm space-y-1.5">
                  <p><strong>Start Date:</strong> {format(new Date(agreement.startDate), 'PP')}</p>
                  <p><strong>Rent:</strong> ${agreement.monthlyRentalPrice.toLocaleString()}/month</p>
                  <p><strong>Term:</strong> {agreement.paymentTermMonths} months</p>
                  <p><strong>Initial Pmt:</strong> {agreement.initialPaymentMonths} month(s)</p>
                  <p className={`${overdue ? 'text-destructive font-semibold' : ''}`}>
                    <strong>Next Payment:</strong> {format(new Date(agreement.nextPaymentDueDate), 'PP')}
                  </p>
                  <p className="text-xs text-muted-foreground pt-1">Generated: {format(new Date(agreement.createdAt), 'PP')}</p>
                </CardContent>
                <CardFooter className="border-t pt-4 flex justify-end gap-2">
                  <Link href={`/admin/agreements/${agreement.id}`} passHref>
                    <Button variant="outline" size="sm">
                      <Eye className="mr-1 h-4 w-4" /> View
                    </Button>
                  </Link>
                  <Button variant="outline" size="sm" onClick={() => handleDownloadPdf(agreement.id)}>
                    <Download className="mr-1 h-4 w-4" /> Download PDF
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
