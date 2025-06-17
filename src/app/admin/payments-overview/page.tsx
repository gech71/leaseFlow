
"use client";

import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/custom/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ClipboardList, DollarSign, CalendarDays, CheckCircle, AlertTriangle, Info, User, HomeIcon } from 'lucide-react';
import type { Bill } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { format, parseISO, isBefore, startOfDay, addMonths } from 'date-fns';

// Mock data for demonstration (similar to what's in billing page)
const mockBillsData: Bill[] = [
  { id: 'bill1', agreementId: 'agreement1', tenantId: 'tenant1', tenantName: 'Alice Wonderland', spaceDescription: 'Unit 101, Sunrise Tower', billDate: new Date(2024,5,1).toISOString(), dueDate: new Date(2024,5,15).toISOString(), rentAmount: 2500, utilityBreakdown: [{name: "Electricity", amount: 80}, {name: "Water", amount: 20}], totalAmount: 2600, status: 'Paid', paymentDate: new Date(2024,5,10).toISOString(), paymentMethod: "Card", paymentReference: "TXN12345" },
  { id: 'bill2', agreementId: 'agreement2', tenantId: 'tenant2', tenantName: 'Bob The Builder', spaceDescription: 'Office 5B, Downtown Hub', billDate: new Date(2024,6,1).toISOString(), dueDate: new Date(2024,6,15).toISOString(), rentAmount: 3200, utilityBreakdown: [{name: "General Utility", amount: 175}], totalAmount: 3375, status: 'Pending' },
  { id: 'bill3', agreementId: 'agreement1', tenantId: 'tenant1', tenantName: 'Alice Wonderland', spaceDescription: 'Unit 101, Sunrise Tower', billDate: new Date(2024,6,1).toISOString(), dueDate: new Date(2024,6,15).toISOString(), rentAmount: 2500, utilityBreakdown: [{name: "Electricity", amount: 70}, {name: "Water", amount: 15}], totalAmount: 2585, status: 'Pending' },
  { id: 'bill4', agreementId: 'agreement3', tenantId: 'tenant3', tenantName: 'Carol Danvers', spaceDescription: 'Penthouse, Galaxy Tower', billDate: new Date(2024,5,20).toISOString(), dueDate: new Date(2024,6,5).toISOString(), rentAmount: 5000, utilityBreakdown: [{name: "Premium Utilities", amount: 300}], totalAmount: 5300, status: 'Overdue' },
   { id: 'bill5', agreementId: 'agreement2', tenantId: 'tenant2', tenantName: 'Bob The Builder', spaceDescription: 'Office 5B, Downtown Hub', billDate: new Date(2024,5,1).toISOString(), dueDate: new Date(2024,5,15).toISOString(), rentAmount: 3200, utilityBreakdown: [], totalAmount: 3200, status: 'Paid', paymentDate: new Date(2024,5,12).toISOString(), paymentMethod: "Bank Transfer", bankOrWalletName: "First National", paymentReference: "BNKREF001" },
];


export default function PaymentsOverviewPage() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [isMounted, setIsMounted] = useState(false);
  const [today, setToday] = useState(startOfDay(new Date()));

  useEffect(() => {
    setIsMounted(true);
    // In a real app, fetch bills from an API
    // For now, we'll use mock data and update statuses based on current date
    const updatedMockBills = mockBillsData.map(bill => {
      if (bill.status === 'Pending' && isBefore(parseISO(bill.dueDate), today)) {
        return { ...bill, status: 'Overdue' as Bill['status'] };
      }
      return bill;
    });
    setBills(updatedMockBills.sort((a, b) => parseISO(b.billDate).getTime() - parseISO(a.billDate).getTime()));
    setToday(startOfDay(new Date()));
  }, []);
  
  const upcomingAndPendingBills = bills.filter(b => b.status === 'Pending' || b.status === 'Overdue');
  const paidBills = bills.filter(b => b.status === 'Paid');

  const totalUpcomingAmount = upcomingAndPendingBills.reduce((sum, bill) => sum + bill.totalAmount, 0);
  const totalPaidThisMonth = paidBills
    .filter(bill => bill.paymentDate && parseISO(bill.paymentDate).getMonth() === today.getMonth() && parseISO(bill.paymentDate).getFullYear() === today.getFullYear())
    .reduce((sum, bill) => sum + bill.totalAmount, 0);


  const getStatusBadgeVariant = (status: Bill['status']): "default" | "destructive" | "secondary" => {
    switch (status) {
      case 'Paid': return 'secondary'; // Using secondary for paid as green is not a direct variant
      case 'Pending': return 'default'; // Default (primary) for pending
      case 'Overdue': return 'destructive';
      default: return 'default';
    }
  };
   const getStatusIcon = (status: Bill['status']) => {
    switch (status) {
      case 'Paid': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'Pending': return <Info className="h-4 w-4 text-yellow-600" />;
      case 'Overdue': return <AlertTriangle className="h-4 w-4 text-red-600" />;
      default: return <Info className="h-4 w-4 text-gray-500" />;
    }
  };


  if (!isMounted) {
    return <div className="flex justify-center items-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;
  }

  const BillCard = ({ bill }: { bill: Bill }) => (
    <Card className="shadow-md hover:shadow-lg transition-shadow duration-300">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="font-headline text-lg">{bill.tenantName}</CardTitle>
            <CardDescription className="text-xs flex items-center"><HomeIcon className="mr-1 h-3 w-3 text-muted-foreground" />{bill.spaceDescription}</CardDescription>
          </div>
           <Badge variant={getStatusBadgeVariant(bill.status)} className="capitalize">
            {getStatusIcon(bill.status)}<span className="ml-1">{bill.status}</span>
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Total Amount:</span>
            <span className="font-semibold text-lg text-primary">${bill.totalAmount.toFixed(2)}</span>
        </div>
         <div className="text-xs space-y-1 pt-1"> {/* Adjusted spacing here */}
            <p><span className="text-muted-foreground">Rent:</span> ${bill.rentAmount.toFixed(2)}</p>
            {bill.utilityBreakdown && bill.utilityBreakdown.length > 0 && (
                <div className="mt-0.5"> {/* Added small margin-top for the utilities block */}
                    <span className="text-muted-foreground">Utilities:</span>
                    <ul className="list-disc list-inside ml-3">
                    {bill.utilityBreakdown.map(util => (
                        <li key={util.name} className="text-xs">{util.name}: ${util.amount.toFixed(2)}</li>
                    ))}
                    </ul>
                </div>
            )}
        </div>
        <div className="border-t pt-2 mt-2">
            <p className="flex items-center"><CalendarDays className="mr-2 h-4 w-4 text-muted-foreground" /> Bill Date: {format(parseISO(bill.billDate), 'PP')}</p>
            <p className="flex items-center"><CalendarDays className="mr-2 h-4 w-4 text-muted-foreground" /> Due Date: <span className={bill.status === 'Overdue' ? 'text-destructive font-semibold' : ''}>{format(parseISO(bill.dueDate), 'PP')}</span></p>
            {bill.status === 'Paid' && bill.paymentDate && (
              <>
                <p className="flex items-center text-green-600"><CheckCircle className="mr-2 h-4 w-4" /> Paid Date: {format(parseISO(bill.paymentDate), 'PP')}</p>
                {bill.paymentMethod && <p className="text-xs text-muted-foreground">Method: {bill.paymentMethod}{bill.bankOrWalletName ? ` (${bill.bankOrWalletName})` : ''}</p>}
                {bill.paymentReference && <p className="text-xs text-muted-foreground">Ref: {bill.paymentReference}</p>}
              </>
            )}
        </div>
      </CardContent>
    </Card>
  );


  return (
    <div className="animate-fadeIn">
      <PageHeader
        title="Payments Overview"
        icon={ClipboardList}
        description="View upcoming, pending, and paid transactions."
      />
      
      <div className="grid gap-6 md:grid-cols-2 mb-8">
        <Card className="shadow-sm bg-secondary/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Upcoming/Pending Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">${totalUpcomingAmount.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">{upcomingAndPendingBills.length} transactions</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm bg-secondary/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Paid (This Month)</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">${totalPaidThisMonth.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">from {paidBills.filter(bill => bill.paymentDate && parseISO(bill.paymentDate).getMonth() === today.getMonth()).length} transactions</p>
          </CardContent>
        </Card>
      </div>

      <section className="mb-10">
        <h2 className="text-2xl font-headline font-semibold mb-4 text-foreground">Upcoming & Pending Payments</h2>
        {upcomingAndPendingBills.length === 0 ? (
          <Card className="text-center py-10 shadow-sm">
            <CardContent>
              <CheckCircle className="mx-auto h-12 w-12 text-green-500 mb-3" />
              <h3 className="text-lg font-semibold font-headline">All Clear!</h3>
              <p className="text-muted-foreground">No upcoming or pending payments at the moment.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {upcomingAndPendingBills.map(bill => <BillCard key={bill.id} bill={bill} />)}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-2xl font-headline font-semibold mb-4 text-foreground">Payment History (Paid)</h2>
        {paidBills.length === 0 ? (
          <Card className="text-center py-10 shadow-sm">
            <CardContent>
              <DollarSign className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
              <h3 className="text-lg font-semibold font-headline">No Payment History</h3>
              <p className="text-muted-foreground">No bills have been marked as paid yet.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {paidBills.map(bill => <BillCard key={bill.id} bill={bill} />)}
          </div>
        )}
      </section>
    </div>
  );
}

