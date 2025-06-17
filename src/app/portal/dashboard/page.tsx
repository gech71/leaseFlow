
"use client";

import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/custom/PageHeader';
import { DollarSign, CalendarDays, CheckCircle, AlertTriangle, Info, FileText, Home, Clock, FileSignature } from 'lucide-react';
import type { Bill, Agreement } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { format, parseISO, addMonths } from 'date-fns';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

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
  nextPaymentDueDate: addMonths(new Date(2024, 0, 15), 7).toISOString(), // Approx. Aug 15, 2024 (assuming current date is around July)
  additionalTerms: 'No smoking. Small pets allowed with an additional deposit.',
  createdAt: new Date(2024, 0, 10).toISOString(),
};

const mockTenantBills: Bill[] = [
  {
    id: 'bill-portal-1',
    agreementId: 'agree-tenant1-current',
    tenantId: 'tenant-portal-user',
    tenantName: 'Portal User Tenant',
    spaceDescription: 'Unit P1, Portal View Residences',
    billDate: new Date(2024, 6, 1).toISOString(), // July 1, 2024
    dueDate: new Date(2024, 6, 15).toISOString(), // July 15, 2024
    rentAmount: 1500,
    utilityBreakdown: [{ name: "Water", amount: 25 }, { name: "Trash Collection", amount: 15 }],
    totalAmount: 1540,
    status: 'Pending'
  },
  {
    id: 'bill-portal-2',
    agreementId: 'agree-tenant1-current',
    tenantId: 'tenant-portal-user',
    tenantName: 'Portal User Tenant',
    spaceDescription: 'Unit P1, Portal View Residences',
    billDate: new Date(2024, 5, 1).toISOString(), // June 1, 2024
    dueDate: new Date(2024, 5, 15).toISOString(), // June 15, 2024
    rentAmount: 1500,
    utilityBreakdown: [{ name: "Water", amount: 22 }, { name: "Trash Collection", amount: 15 }],
    totalAmount: 1537,
    status: 'Paid',
    paymentDate: new Date(2024, 5, 10).toISOString(),
    paymentMethod: "Online Portal",
    paymentReference: "PORTALPAY-JUNE"
  },
  {
    id: 'bill-portal-3',
    agreementId: 'agree-tenant1-current',
    tenantId: 'tenant-portal-user',
    tenantName: 'Portal User Tenant',
    spaceDescription: 'Unit P1, Portal View Residences',
    billDate: new Date(2024, 4, 1).toISOString(), // May 1, 2024
    dueDate: new Date(2024, 4, 15).toISOString(), // May 15, 2024
    rentAmount: 1500,
    utilityBreakdown: [{ name: "Water", amount: 28 }, { name: "Trash Collection", amount: 15 }],
    totalAmount: 1543,
    status: 'Paid',
    paymentDate: new Date(2024, 4, 12).toISOString(),
    paymentMethod: "Credit Card",
    paymentReference: "CCPAY-MAY"
  },
];
// --- End Mock Data ---

const getStatusInfo = (status: Bill['status']) => {
  switch (status) {
    case 'Paid': return { icon: CheckCircle, color: 'text-green-600', badgeVariant: 'secondary' as const, label: 'Paid' };
    case 'Pending': return { icon: Info, color: 'text-yellow-600', badgeVariant: 'default' as const, label: 'Pending' };
    case 'Overdue': return { icon: AlertTriangle, color: 'text-red-600', badgeVariant: 'destructive' as const, label: 'Overdue' };
    default: return { icon: Info, color: 'text-gray-500', badgeVariant: 'outline' as const, label: 'Unknown' };
  }
};


export default function CustomerDashboardPage() {
  const [agreement, setAgreement] = useState<Agreement | null>(null);
  const [bills, setBills] = useState<Bill[]>([]);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    // In a real app, fetch data for the logged-in tenant
    setAgreement(mockTenantAgreement);
    setBills(mockTenantBills.sort((a,b) => parseISO(b.billDate).getTime() - parseISO(a.billDate).getTime()));
  }, []);

  const upcomingPayment = bills.find(b => b.status === 'Pending' || b.status === 'Overdue');
  const paymentHistory = bills.filter(b => b.status === 'Paid');

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
        description="Here's an overview of your lease and payments."
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

      {upcomingPayment && (
        <Card className="mb-8 shadow-lg">
          <CardHeader>
            <CardTitle className="font-headline text-xl flex items-center"><DollarSign className="mr-2 h-6 w-6 text-primary"/>Upcoming Payment</CardTitle>
            <CardDescription>Details for your next upcoming bill.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-center mb-3">
              <p className="text-2xl font-semibold text-primary">${upcomingPayment.totalAmount.toLocaleString()}</p>
              <Badge variant={getStatusInfo(upcomingPayment.status).badgeVariant} className="capitalize text-sm">
                <upcomingPayment.icon className={`mr-1.5 h-4 w-4 ${getStatusInfo(upcomingPayment.status).color}`} />
                {getStatusInfo(upcomingPayment.status).label}
              </Badge>
            </div>
            <div className="space-y-1 text-sm">
              <p><strong className="text-muted-foreground">Due Date:</strong> {format(parseISO(upcomingPayment.dueDate), 'PP')}</p>
              <p><strong className="text-muted-foreground">Bill Date:</strong> {format(parseISO(upcomingPayment.billDate), 'PP')}</p>
              <p><strong className="text-muted-foreground">Rent:</strong> ${upcomingPayment.rentAmount.toLocaleString()}</p>
              {upcomingPayment.utilityBreakdown.length > 0 && (
                <div>
                  <strong className="text-muted-foreground">Utilities:</strong>
                  <ul className="list-disc list-inside ml-4 text-xs">
                    {upcomingPayment.utilityBreakdown.map(util => (
                      <li key={util.name}>{util.name}: ${util.amount.toLocaleString()}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </CardContent>
          <CardFooter>
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
              <DollarSign className="mr-2 h-4 w-4" /> Make Payment
            </Button>
          </CardFooter>
        </Card>
      )}
      
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline text-xl flex items-center"><Clock className="mr-2 h-6 w-6 text-primary"/>Payment History</CardTitle>
          <CardDescription>Your past paid bills.</CardDescription>
        </CardHeader>
        <CardContent>
          {paymentHistory.length > 0 ? (
            <ScrollArea className="h-[300px] pr-3">
              <ul className="space-y-4">
                {paymentHistory.map(bill => {
                  const status = getStatusInfo(bill.status);
                  return (
                    <li key={bill.id} className={`p-4 rounded-md border ${status.badgeVariant === 'secondary' ? 'bg-green-50 border-green-200' : 'bg-card'}`}>
                      <div className="flex justify-between items-center mb-2">
                        <p className="font-semibold">Total: ${bill.totalAmount.toLocaleString()}</p>
                        <Badge variant={status.badgeVariant} className="capitalize">
                          <status.icon className={`mr-1.5 h-3 w-3 ${status.color}`} /> {status.label}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground space-y-0.5">
                        <p>Paid on: {bill.paymentDate ? format(parseISO(bill.paymentDate), 'PP') : 'N/A'}</p>
                        <p>Bill Date: {format(parseISO(bill.billDate), 'PP')}</p>
                        <p>Method: {bill.paymentMethod || 'N/A'}</p>
                        {bill.paymentReference && <p>Reference: {bill.paymentReference}</p>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </ScrollArea>
          ) : (
            <p className="text-muted-foreground">No payment history found.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

    