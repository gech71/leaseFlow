
"use client";

import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/custom/PageHeader';
import { DollarSign, CalendarDays, CheckCircle, AlertTriangle, Info, FileText } from 'lucide-react';
import type { Bill } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { format, parseISO } from 'date-fns';
// Added Card components
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';

// Moved getStatusInfo to be a top-level helper function
const getStatusInfo = (status: Bill['status']) => {
  switch (status) {
    case 'Paid': return { icon: CheckCircle, color: 'text-green-500', bgColor: 'bg-green-50' };
    case 'Pending': return { icon: Info, color: 'text-yellow-500', bgColor: 'bg-yellow-50' };
    case 'Overdue': return { icon: AlertTriangle, color: 'text-red-500', bgColor: 'bg-red-50' };
    default: return { icon: Info, color: 'text-gray-500', bgColor: 'bg-gray-50' };
  }
};

// Mock data for a logged-in tenant's bills
const mockTenantBills: Bill[] = [
  {
    id: 'bill1',
    agreementId: 'agreement1',
    tenantId: 'tenant1',
    // tenantName: 'Alice Wonderland', // Removed as per type
    spaceDescription: 'Unit 101, Sunrise Tower',
    billDate: new Date(2024, 5, 1).toISOString(),
    dueDate: new Date(2024, 5, 15).toISOString(),
    rentAmount: 2500,
    utilityBreakdown: [{ name: "Electricity", amount: 100 }, { name: "Water", amount: 25 }],
    totalAmount: 2625,
    status: 'Paid',
    paymentDate: new Date(2024, 5, 10).toISOString()
  },
  {
    id: 'bill3',
    agreementId: 'agreement1',
    tenantId: 'tenant1',
    // tenantName: 'Alice Wonderland', // Removed as per type
    spaceDescription: 'Unit 101, Sunrise Tower',
    billDate: new Date(2024, 6, 1).toISOString(),
    dueDate: new Date(2024, 6, 15).toISOString(),
    rentAmount: 2500,
    utilityBreakdown: [{ name: "Electricity", amount: 105 }, { name: "Water", amount: 20 }],
    totalAmount: 2625,
    status: 'Pending'
  },
  {
    id: 'bill4',
    agreementId: 'agreement1',
    tenantId: 'tenant1',
    // tenantName: 'Alice Wonderland', // Removed as per type
    spaceDescription: 'Unit 101, Sunrise Tower',
    billDate: new Date(2024, 4, 1).toISOString(),
    dueDate: new Date(2024, 4, 15).toISOString(),
    rentAmount: 2500,
    utilityBreakdown: [{ name: "Electricity", amount: 95 }, {name: "Trash", amount: 25}],
    totalAmount: 2620,
    status: 'Paid',
    paymentDate: new Date(2024, 4, 12).toISOString()
  }
];


export default function CustomerDashboardPage() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    // In a real app, fetch bills for the logged-in tenant
    setBills(mockTenantBills.sort((a,b) => parseISO(b.billDate).getTime() - parseISO(a.billDate).getTime()));
  }, []);

  const upcomingPayment = bills.find(b => b.status === 'Pending' || b.status === 'Overdue');
  const paymentHistory = bills.filter(b => b.status === 'Paid');

  if (!isMounted) {
     return <div className="flex justify-center items-center h-[calc(100vh-10rem)]"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;
  }

  return (
    <div className="animate-fadeIn">
      <PageHeader
        title="Welcome to Your Dashboard!"
        icon={DollarSign}
        description="Here's an overview of your payments and lease details."
      />

      {upcomingPayment && (
        <Card className="mb-8 shadow-lg bg-primary/10 border-primary/30 transform hover:scale-[1.01] transition-transform duration-300">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="font-headline text-xl text-primary-foreground">Upcoming Payment</CardTitle>
              <span className={`px-3 py-1.5 text-sm font-semibold rounded-full ${getStatusInfo(upcomingPayment.status).color} ${getStatusInfo(upcomingPayment.status).bgColor}`}>
                <getStatusInfo(upcomingPayment.status).icon className="inline-block mr-1.5 h-5 w-5" />
                {upcomingPayment.status}
              </span>
            </div>
            <CardDescription className="text-primary-foreground/80">
              Your next bill for {upcomingPayment.spaceDescription} is due soon.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-primary-foreground/90">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <p className="text-sm font-medium">Total Due</p>
                    <p className="text-3xl font-bold">${upcomingPayment.totalAmount.toFixed(2)}</p>
                    <p className="text-sm font-medium mt-1">Due Date: {format(parseISO(upcomingPayment.dueDate), 'PP')}</p>
                </div>
                <div className="space-y-1">
                    <p className="text-sm font-medium">Rent: <span className="font-semibold">${upcomingPayment.rentAmount.toFixed(2)}</span></p>
                    <p className="text-sm font-medium">Utilities:</p>
                    {upcomingPayment.utilityBreakdown && upcomingPayment.utilityBreakdown.length > 0 ? (
                        <ul className="list-disc list-inside ml-4 text-sm">
                        {upcomingPayment.utilityBreakdown.map(util => (
                            <li key={util.name}>{util.name}: <span className="font-semibold">${util.amount.toFixed(2)}</span></li>
                        ))}
                        </ul>
                    ) : (
                        <p className="ml-4 text-sm font-semibold">$0.00</p>
                    )}
                </div>
            </div>
          </CardContent>
          <CardFooter className="pt-4 border-t border-primary/20">
            <Button className="w-full md:w-auto bg-accent text-accent-foreground hover:bg-accent/90">Make Payment</Button>
          </CardFooter>
        </Card>
      )}

      <div className="mt-8">
        <h2 className="text-2xl font-headline font-semibold mb-4 text-foreground">Payment History</h2>
        {paymentHistory.length === 0 && !upcomingPayment ? (
            <Card className="text-center py-12 shadow-sm">
                <CardContent>
                    <FileText className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
                    <h3 className="text-xl font-semibold mb-2 font-headline">No Payment History</h3>
                    <p className="text-muted-foreground">Your past payments will appear here.</p>
                </CardContent>
            </Card>
        ) : paymentHistory.length === 0 && upcomingPayment ? (
            <Card className="text-center py-12 shadow-sm">
                <CardContent>
                    <Info className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
                    <h3 className="text-xl font-semibold mb-2 font-headline">No Paid Bills Yet</h3>
                    <p className="text-muted-foreground">Once you make payments, they will appear here.</p>
                </CardContent>
            </Card>
        ) : (
          <div className="space-y-4">
            {paymentHistory.map((bill) => {
              const statusInfo = getStatusInfo(bill.status);
              return (
                <Card key={bill.id} className="shadow-md hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-3">
                     <div className="flex justify-between items-start">
                        <div>
                            <CardTitle className="font-headline text-md">Bill for {format(parseISO(bill.billDate), 'PP')}</CardTitle>
                            <CardDescription className="text-xs">{bill.spaceDescription}</CardDescription>
                        </div>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusInfo.color} ${statusInfo.bgColor}`}>
                            <statusInfo.icon className="inline-block mr-1 h-3.5 w-3.5" />
                            {bill.status}
                        </span>
                    </div>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 text-sm items-center">
                    <div>
                      <p className="text-xs text-muted-foreground">Total Amount</p>
                      <p className="font-semibold text-foreground">${bill.totalAmount.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Bill Date</p>
                      <p className="text-foreground">{format(parseISO(bill.billDate), 'PP')}</p>
                    </div>
                     <div>
                      <p className="text-xs text-muted-foreground">Payment Date</p>
                      <p className="text-foreground">{bill.paymentDate ? format(parseISO(bill.paymentDate), 'PP') : 'N/A'}</p>
                    </div>
                     <div className="col-span-2 sm:col-span-3 md:col-span-1">
                      <p className="text-xs text-muted-foreground">Utilities</p>
                       {bill.utilityBreakdown && bill.utilityBreakdown.length > 0 ? (
                        <ul className="text-xs">
                        {bill.utilityBreakdown.map(util => (
                            <li key={util.name}>{util.name}: ${util.amount.toFixed(2)}</li>
                        ))}
                        </ul>
                        ) : (
                           <p className="text-foreground text-xs">$0.00</p>
                        )}
                    </div>
                     <div className="col-span-2 sm:col-span-3 md:col-span-1 md:text-right">
                        <Button variant="outline" size="sm">View Details</Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
