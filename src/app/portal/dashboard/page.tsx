"use client";

import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/custom/PageHeader';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, CalendarDays, CheckCircle, AlertTriangle, Info, FileText } from 'lucide-react';
import type { Bill } from '@/lib/types';
import { Button } from '@/components/ui/button';

// Mock data for a logged-in tenant's bills
const mockTenantBills: Bill[] = [
  { 
    id: 'bill1', 
    agreementId: 'agreement1', 
    tenantId: 'tenant1', 
    tenantName: 'Alice Wonderland', // This would be the logged-in user
    spaceDescription: 'Unit 101, Sunrise Tower', 
    billDate: new Date(2024, 5, 1).toISOString(), // June 1, 2024
    dueDate: new Date(2024, 5, 15).toISOString(), // June 15, 2024
    rentAmount: 2500, 
    utilityAmount: 125, 
    totalAmount: 2625, 
    status: 'Paid', 
    paymentDate: new Date(2024, 5, 10).toISOString() 
  },
  { 
    id: 'bill3', 
    agreementId: 'agreement1', 
    tenantId: 'tenant1', 
    tenantName: 'Alice Wonderland',
    spaceDescription: 'Unit 101, Sunrise Tower', 
    billDate: new Date(2024, 6, 1).toISOString(), // July 1, 2024
    dueDate: new Date(2024, 6, 15).toISOString(), // July 15, 2024
    rentAmount: 2500, 
    utilityAmount: 125, 
    totalAmount: 2625, 
    status: 'Pending' 
  },
   { 
    id: 'bill4', 
    agreementId: 'agreement1', 
    tenantId: 'tenant1', 
    tenantName: 'Alice Wonderland',
    spaceDescription: 'Unit 101, Sunrise Tower', 
    billDate: new Date(2024, 4, 1).toISOString(), // May 1, 2024
    dueDate: new Date(2024, 4, 15).toISOString(), // May 15, 2024
    rentAmount: 2500, 
    utilityAmount: 120, // Slight variation for demo
    totalAmount: 2620, 
    status: 'Paid',
    paymentDate: new Date(2024, 4, 12).toISOString()
  },
];


export default function CustomerDashboardPage() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [isMounted, setIsMounted] = useState(false);
  const tenantName = "Alice Wonderland"; // Mock logged-in tenant

  useEffect(() => {
    setIsMounted(true);
    // In a real app, fetch bills for the logged-in tenant
    setBills(mockTenantBills.sort((a,b) => new Date(b.billDate).getTime() - new Date(a.billDate).getTime()));
  }, []);
  
  const upcomingPayment = bills.find(b => b.status === 'Pending' || b.status === 'Overdue');
  const paymentHistory = bills.filter(b => b.status === 'Paid');

  const getStatusInfo = (status: Bill['status']) => {
    switch (status) {
      case 'Paid': return { icon: CheckCircle, color: 'text-green-500', bgColor: 'bg-green-50' };
      case 'Pending': return { icon: Info, color: 'text-yellow-500', bgColor: 'bg-yellow-50' };
      case 'Overdue': return { icon: AlertTriangle, color: 'text-red-500', bgColor: 'bg-red-50' };
      default: return { icon: Info, color: 'text-gray-500', bgColor: 'bg-gray-50' };
    }
  };


  if (!isMounted) {
     return <div className="flex justify-center items-center h-[calc(100vh-10rem)]"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;
  }

  return (
    <div className="animate-fadeIn">
      <PageHeader
        title={`Welcome, ${tenantName}!`}
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
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-sm font-medium">Total Due</p>
                <p className="text-2xl font-bold">${upcomingPayment.totalAmount.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm font-medium">Due Date</p>
                <p className="text-lg font-semibold">{new Date(upcomingPayment.dueDate).toLocaleDateString()}</p>
              </div>
               <div>
                <p className="text-sm font-medium">Rent</p>
                <p className="text-lg">${upcomingPayment.rentAmount.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm font-medium">Utilities</p>
                <p className="text-lg">${upcomingPayment.utilityAmount.toFixed(2)}</p>
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
                            <CardTitle className="font-headline text-md">Bill for {new Date(bill.billDate).toLocaleDateString()}</CardTitle>
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
                      <p className="text-foreground">{new Date(bill.billDate).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Due Date</p>
                      <p className="text-foreground">{new Date(bill.dueDate).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Payment Date</p>
                      <p className="text-foreground">{bill.paymentDate ? new Date(bill.paymentDate).toLocaleDateString() : 'N/A'}</p>
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
