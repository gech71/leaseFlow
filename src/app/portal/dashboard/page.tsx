
"use client";

import { useState, useEffect, useMemo } from 'react';
import { PageHeader } from '@/components/custom/PageHeader';
import { FileText, Home, FileSignature, DollarSign, CreditCard, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import type { Agreement, Bill, Building, PenaltyTier } from '@/lib/types'; // Added Building, PenaltyTier
import { Button } from '@/components/ui/button';
import { format, parseISO, isBefore, startOfDay, differenceInDays } from 'date-fns';
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
  nextPaymentDueDate: new Date(2024, 7, 15).toISOString(), 
  additionalTerms: 'No smoking. Small pets allowed with an additional deposit.',
  createdAt: new Date(2024, 0, 10).toISOString(),
};

// Mock Building data for the portal tenant
const mockPortalBuilding: Building = {
  id: 'building-portal',
  name: 'Portal View Residences',
  address: '1 Portal Drive',
  penaltyPolicyTiers: [
    { fromDay: 3, toDay: 5, feeType: 'Fixed', feeValue: 25 },         // Penalty from day 3 to 5
    { fromDay: 6, toDay: null, feeType: 'Fixed', feeValue: 50 }       // Higher penalty from day 6 onwards
  ],
  createdAt: new Date().toISOString(),
};


const initialMockTenantBills: Bill[] = [
  {
    id: 'bill-tp-1',
    agreementId: 'agree-tenant1-current',
    tenantId: 'tenant-portal-user',
    spaceDescription: 'Unit P1, Portal View Residences',
    billDate: new Date(2024, 5, 1).toISOString(), // June 1, 2024
    dueDate: new Date(2024, 5, 15).toISOString(), // June 15, 2024
    rentAmount: 1500,
    utilityBreakdown: [{ name: 'Common Area Maintenance', amount: 75 }],
    totalAmount: 1575, 
    status: 'Paid',
    paymentDate: new Date(2024, 5, 10).toISOString(),
    paymentMethod: 'Online Portal',
    paymentReference: 'PAY-PORTAL-JUNE',
  },
  {
    id: 'bill-tp-2', 
    agreementId: 'agree-tenant1-current',
    tenantId: 'tenant-portal-user',
    spaceDescription: 'Unit P1, Portal View Residences',
    billDate: new Date(new Date().getFullYear(), new Date().getMonth() - 2, 1).toISOString(), 
    dueDate: new Date(new Date().getFullYear(), new Date().getMonth() - 2, 15).toISOString(), 
    rentAmount: 1500,
    utilityBreakdown: [{ name: 'Common Area Maintenance', amount: 75 }, {name: 'Water Service', amount: 30}],
    totalAmount: 1605, 
    status: 'Pending', 
  },
  {
    id: 'bill-tp-3',
    agreementId: 'agree-tenant1-current',
    tenantId: 'tenant-portal-user',
    spaceDescription: 'Unit P1, Portal View Residences',
    billDate: new Date(new Date().getFullYear(), new Date().getMonth() -1, 1).toISOString(), 
    dueDate: new Date(new Date().getFullYear(), new Date().getMonth() -1, 15).toISOString(), 
    rentAmount: 1500,
    utilityBreakdown: [{ name: 'Common Area Maintenance', amount: 75 }, { name: 'Trash Removal', amount: 25}],
    totalAmount: 1600, 
    status: 'Pending',
  },
];
// --- End Mock Data ---


export default function CustomerDashboardPage() {
  const [agreement, setAgreement] = useState<Agreement | null>(null);
  const [bills, setBills] = useState<Bill[]>([]);
  const [isMounted, setIsMounted] = useState(false);
  const { toast } = useToast();
  const [today, setToday] = useState(startOfDay(new Date()));

  useEffect(() => {
    setIsMounted(true);
    setToday(startOfDay(new Date()));
  }, []);

  const processedBills = useMemo(() => {
    return initialMockTenantBills.map(bill => {
      let currentStatus = bill.status;
      let calculatedPenalty = 0;
      const dueDate = parseISO(bill.dueDate);

      if (bill.status === 'Pending' && isBefore(dueDate, today)) {
        currentStatus = 'Overdue';
        const daysOverdue = differenceInDays(today, dueDate);
        if (daysOverdue > 0 && mockPortalBuilding.penaltyPolicyTiers) {
           const sortedTiers = [...mockPortalBuilding.penaltyPolicyTiers].sort((a,b) => a.fromDay - b.fromDay);
           for (const tier of sortedTiers) {
               if (daysOverdue >= tier.fromDay && (tier.toDay === null || tier.toDay === undefined || daysOverdue <= tier.toDay)) {
                   if (tier.feeType === 'Fixed') {
                       calculatedPenalty = tier.feeValue;
                   } else { // Percentage
                       calculatedPenalty = bill.rentAmount * (tier.feeValue / 100);
                   }
                   break; // Apply first matching tier
               }
           }
        }
      }
      
      const baseAmount = bill.rentAmount + bill.utilityBreakdown.reduce((sum, util) => sum + util.amount, 0);
      const newTotalAmount = baseAmount + calculatedPenalty;

      return {
        ...bill,
        status: currentStatus,
        penaltyAmount: calculatedPenalty > 0 ? calculatedPenalty : undefined,
        totalAmount: parseFloat(newTotalAmount.toFixed(2)),
      };
    }).sort((a, b) => parseISO(b.billDate).getTime() - parseISO(a.billDate).getTime());
  }, [today]);

  useEffect(() => {
    setAgreement(mockTenantAgreement);
    setBills(processedBills);
  }, [processedBills]);

  const handlePayBill = (billId: string) => {
    const billToPay = bills.find(b => b.id === billId);
    if (!billToPay) return;

    toast({
      title: "Processing Payment...",
      description: `Payment for bill ${billId} (Total: $${billToPay.totalAmount.toFixed(2)}) is being processed. This is a demo.`,
    });
    setTimeout(() => {
        setBills(prevBills => prevBills.map(b => b.id === billId ? {...b, status: 'Paid', paymentDate: new Date().toISOString(), paymentMethod: "Simulated Portal Payment", penaltyAmount: b.penaltyAmount} : b));
        toast({
            title: "Payment Successful (Simulated)",
            description: `Bill ${billId} has been marked as paid.`,
        });
    }, 2000);
  };

  const getStatusBadge = (status: Bill['status']) => {
    switch (status) {
      case 'Paid':
        return <Badge variant="secondary" className="bg-green-100 text-green-700"><CheckCircle className="mr-1 h-3.5 w-3.5" />Paid</Badge>;
      case 'Pending':
        return <Badge variant="default" className="bg-yellow-100 text-yellow-700"><Info className="mr-1 h-3.5 w-3.5" />Pending</Badge>;
      case 'Overdue':
        return <Badge variant="destructive"><AlertTriangle className="mr-1 h-3.5 w-3.5" />Overdue</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

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
        description="Overview of your lease agreement and billing information."
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
            <div className="md:col-span-2"><strong className="text-muted-foreground">Next Payment Due (Lease):</strong> <span className="font-semibold text-primary">{format(parseISO(agreement.nextPaymentDueDate), 'PP')}</span></div>
            {agreement.additionalTerms && (
                 <div className="md:col-span-2">
                    <strong className="text-muted-foreground">Additional Terms:</strong>
                    <p className="text-xs mt-1 p-2 bg-secondary/50 rounded-md">{agreement.additionalTerms}</p>
                </div>
            )}
          </CardContent>
          <CardFooter>
            <Button variant="outline" size="sm" onClick={() => toast({title: "Full Agreement", description: "This is a mock full agreement text: " + agreement.agreementText, duration: 10000})}>
              <FileText className="mr-2 h-4 w-4" /> View Full Agreement (Text)
            </Button>
          </CardFooter>
        </Card>
      )}

      <section className="mb-8">
        <h2 className="text-2xl font-headline font-semibold mb-4 flex items-center"><DollarSign className="mr-2 h-7 w-7 text-primary"/>Billing & Payments</h2>
        {bills.length === 0 && !agreement && (
            <Card className="text-center py-12 shadow-sm">
            <CardContent>
                <FileSignature className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold mb-2 font-headline">No Information Found</h3>
                <p className="text-muted-foreground">We could not find your active lease or billing information. Please contact support.</p>
            </CardContent>
            </Card>
        )}
        {bills.length === 0 && agreement && (
            <Card className="text-center py-10 shadow-sm">
            <CardContent>
                <DollarSign className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
                <h3 className="text-lg font-semibold font-headline">No Bills Generated Yet</h3>
                <p className="text-muted-foreground">There are no outstanding or past bills for your account currently.</p>
            </CardContent>
            </Card>
        )}
        {bills.length > 0 && (
          <Card className="shadow-lg">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bill Date</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead className="hidden md:table-cell">Rent</TableHead>
                    <TableHead className="hidden md:table-cell">Utilities</TableHead>
                    <TableHead className="hidden md:table-cell">Penalty</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bills.map(bill => (
                    <TableRow key={bill.id}>
                      <TableCell>{format(parseISO(bill.billDate), 'PP')}</TableCell>
                      <TableCell>
                        <span className={bill.status === 'Overdue' ? 'text-destructive font-semibold' : ''}>
                          {format(parseISO(bill.dueDate), 'PP')}
                        </span>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">${bill.rentAmount.toFixed(2)}</TableCell>
                      <TableCell className="hidden md:table-cell">
                        {bill.utilityBreakdown && bill.utilityBreakdown.length > 0 ? (
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="link" className="p-0 h-auto font-normal text-primary hover:underline">
                                ${bill.utilityBreakdown.reduce((sum, util) => sum + util.amount, 0).toFixed(2)}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto text-sm p-2">
                              <ul className="space-y-1">
                                {bill.utilityBreakdown.map(util => (
                                  <li key={util.name} className="flex justify-between">
                                    <span>{util.name}:</span>
                                    <span className="font-medium ml-2">${util.amount.toFixed(2)}</span>
                                  </li>
                                ))}
                              </ul>
                            </PopoverContent>
                          </Popover>
                        ) : (
                            '$0.00'
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-destructive">
                        {bill.penaltyAmount ? `$${bill.penaltyAmount.toFixed(2)}` : '$0.00'}
                      </TableCell>
                      <TableCell className="text-right font-semibold">${bill.totalAmount.toFixed(2)}</TableCell>
                      <TableCell className="text-center">{getStatusBadge(bill.status)}</TableCell>
                      <TableCell className="text-right">
                        {(bill.status === 'Pending' || bill.status === 'Overdue') && (
                          <Button onClick={() => handlePayBill(bill.id)} size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground">
                            <CreditCard className="mr-0 md:mr-2 h-4 w-4"/><span className="hidden md:inline">Pay Now</span>
                          </Button>
                        )}
                         {bill.status === 'Paid' && bill.paymentDate && (
                            <div className="text-xs text-muted-foreground whitespace-nowrap">
                                Paid: {format(parseISO(bill.paymentDate), 'PP')}
                            </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </section>

    </div>
  );
}
