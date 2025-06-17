
"use client";

import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/custom/PageHeader';
import { DollarSign, CalendarDays, CheckCircle, AlertTriangle, Info, FileText } from 'lucide-react';
// import type { Bill } from '@/lib/types'; // Bill type not needed for this simplified version
import { Button } from '@/components/ui/button';
import { format, parseISO } from 'date-fns';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';

// Helper function moved outside and commented out for now
/*
const getStatusInfo = (status: Bill['status']) => {
  switch (status) {
    case 'Paid': return { icon: CheckCircle, color: 'text-green-500', bgColor: 'bg-green-50' };
    case 'Pending': return { icon: Info, color: 'text-yellow-500', bgColor: 'bg-yellow-50' };
    case 'Overdue': return { icon: AlertTriangle, color: 'text-red-500', bgColor: 'bg-red-50' };
    default: return { icon: Info, color: 'text-gray-500', bgColor: 'bg-gray-50' };
  }
};
*/

// Simplified Mock data - commented out for now
/*
const mockTenantBills: any[] = [ // Using any[] for now as Bill type might be removed
  {
    id: 'bill-minimal-1',
    agreementId: 'agreement-minimal-1',
    tenantId: 'tenant-minimal-1',
    spaceDescription: 'Minimal Space, Example Building',
    billDate: new Date(2024, 6, 1).toISOString(), // Example: July 1, 2024
    dueDate: new Date(2024, 6, 15).toISOString(), // Example: July 15, 2024
    rentAmount: 100,
    utilityBreakdown: [{ name: "Basic Utility", amount: 10 }],
    totalAmount: 110,
    status: 'Pending'
  }
];
*/


export default function CustomerDashboardPage() {
  // const [bills, setBills] = useState<Bill[]>([]); // Simplified: bills state removed
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    // In a real app, fetch bills for the logged-in tenant
    // setBills(mockTenantBills.sort((a,b) => parseISO(b.billDate).getTime() - parseISO(a.billDate).getTime())); // Simplified: bill setting removed
  }, []);

  // Simplified: derived constants removed
  // const upcomingPayment = bills.find(b => b.status === 'Pending' || b.status === 'Overdue');
  // const paymentHistory = bills.filter(b => b.status === 'Paid');

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
        icon={DollarSign}
        description="Here's an overview of your payments and lease details."
      />

      <Card className="my-8 shadow-lg">
        <CardHeader>
            <CardTitle className="font-headline">Billing Information</CardTitle>
        </CardHeader>
        <CardContent>
            <p>Your billing details will appear here once the issue is resolved.</p>
        </CardContent>
      </Card>

    </div>
  );
}
