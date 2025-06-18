
"use client";

import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/custom/PageHeader';
import { FileText, Home, FileSignature } from 'lucide-react';
import type { Agreement } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { format, parseISO } from 'date-fns';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';

// --- Mock Data ---
const mockTenantAgreement: Agreement = {
  id: 'agree-tenant1-current',
  tenantId: 'tenant-portal-user',
  tenantName: 'Portal User Tenant',
  spaceId: 'space-portal-unit',
  spaceDescription: 'Unit P1, Portal View Residences',
  agreementText: 'STANDARD LEASE AGREEMENT...\n\nThis agreement, made on [Start Date], between Landlord and Portal User Tenant for the premises located at Unit P1, Portal View Residences.\n\n1. Term: The term of this lease shall be for 12 months, commencing on [Start Date].\n2. Rent: Tenant shall pay Landlord monthly rent of $1500.00, due on the 1st day of each month.\n3. Security Deposit: A security deposit of $1500.00 has been paid.\n...',
  startDate: new Date(2024, 0, 15).toISOString(), // Jan 15, 2024
  monthlyRentalPrice: 1500,
  paymentTermMonths: 12,
  initialPaymentMonths: 1,
  nextPaymentDueDate: new Date(2024, 7, 15).toISOString(), // Aug 15, 2024
  additionalTerms: 'No smoking. Small pets allowed with an additional deposit.',
  createdAt: new Date(2024, 0, 10).toISOString(),
};
// --- End Mock Data ---


export default function CustomerDashboardPage() {
  const [agreement, setAgreement] = useState<Agreement | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    // In a real app, fetch data for the logged-in tenant
    setAgreement(mockTenantAgreement);
  }, []);


  if (!isMounted) {
     return (
        <div className="flex justify-center items-center h-[calc(100vh-10rem)]">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
     );
  }

  return (
    <div className="animate-fadeIn">
      <PageHeader
        title="Welcome to Your Dashboard!"
        icon={Home}
        description="Here's an overview of your lease agreement."
      />

      {agreement && (
        <Card className="mb-8 shadow-lg">
          <CardHeader>
            <CardTitle className="font-headline text-xl flex items-center"><FileSignature className="mr-2 h-6 w-6 text-primary" />Lease Details</CardTitle>
            <CardDescription>Your current rental agreement information.</CardDescription>
          </CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-4 text-sm">
            <div><strong className="text-muted-foreground">Property:</strong> {agreement.spaceDescription}</div>
            <div><strong className="text-muted-foreground">Lease Start Date:</strong> {format(parseISO(agreement.startDate), 'PP')}</div>
            <div><strong className="text-muted-foreground">Lease Term:</strong> {agreement.paymentTermMonths} months</div>
            <div><strong className="text-muted-foreground">Monthly Rent:</strong> ${agreement.monthlyRentalPrice.toLocaleString()}</div>
            <div className="md:col-span-2"><strong className="text-muted-foreground">Next Payment Due:</strong> <span className="font-semibold text-primary">{format(parseISO(agreement.nextPaymentDueDate), 'PP')}</span></div>
            {agreement.additionalTerms && (
                 <div className="md:col-span-2">
                    <strong className="text-muted-foreground">Additional Terms:</strong>
                    <p className="text-xs mt-1 p-2 bg-secondary/50 rounded-md">{agreement.additionalTerms}</p>
                </div>
            )}
          </CardContent>
          <CardFooter>
            <Button variant="outline" size="sm" onClick={() => alert(agreement.agreementText)}>
              <FileText className="mr-2 h-4 w-4" /> View Full Agreement (Text)
            </Button>
          </CardFooter>
        </Card>
      )}

      {!agreement && (
        <Card className="text-center py-12 shadow-sm">
          <CardContent>
            <FileSignature className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2 font-headline">No Agreement Found</h3>
            <p className="text-muted-foreground">We could not find your active lease agreement. Please contact support.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
