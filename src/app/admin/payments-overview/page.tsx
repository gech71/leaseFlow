
"use client";

import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/custom/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ClipboardList, DollarSign, CalendarDays, CheckCircle, AlertTriangle, Info, User, HomeIcon, Landmark } from 'lucide-react';
import type { Bill, Space } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { format, parseISO, isBefore, startOfDay, getYear, getMonth } from 'date-fns';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button'; // Added for potential future actions

// Enhanced Mock data for demonstration
const mockSpacesData: Space[] = [
  { id: 'space1', buildingName: 'Sunrise Tower', spaceIdName: 'Unit 101', area: 1200, floor: '10th', utilityProrationShare: 0.4, monthlyRentalPrice: 2500, isOccupied: true, tenantId: 'tenant1', createdAt: new Date().toISOString() },
  { id: 'space2', buildingName: 'Ocean View Plaza', spaceIdName: 'Suite 20A', area: 800, floor: '2nd', utilityProrationShare: 0.25, monthlyRentalPrice: 1800, isOccupied: false, createdAt: new Date().toISOString() },
  { id: 'space3', buildingName: 'Downtown Hub', spaceIdName: 'Office 5B', area: 1500, floor: '5th', utilityProrationShare: 0.35, monthlyRentalPrice: 3200, isOccupied: true, tenantId: 'tenant2', createdAt: new Date().toISOString() },
  { id: 'space4', buildingName: 'Tech Park One', spaceIdName: 'Lab 3', area: 2000, floor: '1st', utilityProrationShare: 0.5, monthlyRentalPrice: 4500, isOccupied: false, createdAt: new Date().toISOString() },
];

const currentYear = new Date().getFullYear();
const lastMonth = new Date().getMonth() -1 < 0 ? 11 : new Date().getMonth() -1;
const lastMonthYear = new Date().getMonth() -1 < 0 ? currentYear -1 : currentYear;


const mockBillsData: Bill[] = [
  { id: 'bill1', agreementId: 'agreement1', tenantId: 'tenant1', tenantName: 'Alice Wonderland', spaceDescription: 'Unit 101, Sunrise Tower', billDate: new Date(currentYear, 5, 1).toISOString(), dueDate: new Date(currentYear, 5, 15).toISOString(), rentAmount: 2500, utilityBreakdown: [{name: "Electricity", amount: 80}, {name: "Water", amount: 20}], totalAmount: 2600, status: 'Paid', paymentDate: new Date(currentYear, 5, 10).toISOString(), paymentMethod: "Card", paymentReference: "TXN12345" },
  { id: 'bill2', agreementId: 'agreement2', tenantId: 'tenant2', tenantName: 'Bob The Builder', spaceDescription: 'Office 5B, Downtown Hub', billDate: new Date(currentYear, new Date().getMonth(), 1).toISOString(), dueDate: new Date(currentYear, new Date().getMonth(), 15).toISOString(), rentAmount: 3200, utilityBreakdown: [{name: "General Utility", amount: 175}], totalAmount: 3375, status: 'Pending' },
  { id: 'bill3', agreementId: 'agreement1', tenantId: 'tenant1', tenantName: 'Alice Wonderland', spaceDescription: 'Unit 101, Sunrise Tower', billDate: new Date(currentYear, new Date().getMonth(), 1).toISOString(), dueDate: new Date(currentYear, new Date().getMonth(), 15).toISOString(), rentAmount: 2500, utilityBreakdown: [{name: "Electricity", amount: 70}, {name: "Water", amount: 15}], totalAmount: 2585, status: 'Pending' },
  { id: 'bill4', agreementId: 'agreement3', tenantId: 'tenant3', tenantName: 'Carol Danvers', spaceDescription: 'Penthouse, Galaxy Tower', billDate: new Date(currentYear, new Date().getMonth()-1, 20).toISOString(), dueDate: new Date(currentYear, new Date().getMonth(), 5).toISOString(), rentAmount: 5000, utilityBreakdown: [{name: "Premium Utilities", amount: 300}], totalAmount: 5300, status: 'Overdue' },
  { id: 'bill5', agreementId: 'agreement2', tenantId: 'tenant2', tenantName: 'Bob The Builder', spaceDescription: 'Office 5B, Downtown Hub', billDate: new Date(lastMonthYear, lastMonth, 1).toISOString(), dueDate: new Date(lastMonthYear, lastMonth, 15).toISOString(), rentAmount: 3200, utilityBreakdown: [], totalAmount: 3200, status: 'Paid', paymentDate: new Date(lastMonthYear, lastMonth, 12).toISOString(), paymentMethod: "Bank Transfer", bankOrWalletName: "First National", paymentReference: "BNKREF001" },
  { id: 'bill6', agreementId: 'agreement4', tenantId: 'tenant4', tenantName: 'David Copperfield', spaceDescription: 'Studio X, Creative Block', billDate: new Date(lastMonthYear, lastMonth, 5).toISOString(), dueDate: new Date(lastMonthYear, lastMonth, 20).toISOString(), rentAmount: 1200, utilityBreakdown: [{name: "Internet", amount: 50}], totalAmount: 1250, status: 'Paid', paymentDate: new Date(lastMonthYear, lastMonth, 18).toISOString(), paymentMethod: "Wallet", bankOrWalletName: "PayZap", paymentReference: "WLTREF789" },
   { id: 'bill7', agreementId: 'agreement1', tenantId: 'tenant1', tenantName: 'Alice Wonderland', spaceDescription: 'Unit 101, Sunrise Tower', billDate: new Date(lastMonthYear, lastMonth, 1).toISOString(), dueDate: new Date(lastMonthYear, lastMonth, 15).toISOString(), rentAmount: 2500, utilityBreakdown: [{name: "Electricity", amount: 75}, {name: "Water", amount: 22}], totalAmount: 2597, status: 'Paid', paymentDate: new Date(lastMonthYear, lastMonth, 10).toISOString(), paymentMethod: "Card", paymentReference: "TXN67890" },
];


export default function PaymentsOverviewPage() {
  const [allBills, setAllBills] = useState<Bill[]>([]);
  const [spaces, setSpaces] = useState<Space[]>(mockSpacesData);
  const [isMounted, setIsMounted] = useState(false);
  const [today, setToday] = useState(startOfDay(new Date()));

  const [selectedMonth, setSelectedMonth] = useState<number>(today.getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(today.getFullYear());

  useEffect(() => {
    setIsMounted(true);
    // In a real app, fetch bills from an API
    const updatedMockBills = mockBillsData.map(bill => {
      if (bill.status === 'Pending' && isBefore(parseISO(bill.dueDate), today)) {
        return { ...bill, status: 'Overdue' as Bill['status'] };
      }
      return bill;
    });
    setAllBills(updatedMockBills.sort((a, b) => parseISO(b.billDate).getTime() - parseISO(a.billDate).getTime()));
    // setSpaces from mock or API
  }, [today]);
  
  const upcomingAndPendingBills = allBills.filter(b => b.status === 'Pending' || b.status === 'Overdue');
  
  const paidBillsInSelectedPeriod = allBills.filter(bill => {
    if (bill.status !== 'Paid' || !bill.paymentDate) return false;
    const paymentDateObj = parseISO(bill.paymentDate);
    return getMonth(paymentDateObj) === selectedMonth && getYear(paymentDateObj) === selectedYear;
  });

  const totalUpcomingAmount = upcomingAndPendingBills.reduce((sum, bill) => sum + bill.totalAmount, 0);
  const totalPaidSelectedPeriod = paidBillsInSelectedPeriod.reduce((sum, bill) => sum + bill.totalAmount, 0);
  const totalPotentialRevenue = spaces.reduce((sum, space) => sum + space.monthlyRentalPrice, 0);

  const yearsForFilter = Array.from({ length: 5 }, (_, i) => today.getFullYear() - 2 + i);
  const monthsForFilter = Array.from({ length: 12 }, (_, i) => ({
    value: i,
    label: format(new Date(0, i), 'MMMM'),
  }));

  const getStatusBadgeVariant = (status: Bill['status']): "default" | "destructive" | "secondary" => {
    switch (status) {
      case 'Paid': return 'secondary';
      case 'Pending': return 'default';
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

  return (
    <div className="animate-fadeIn">
      <PageHeader
        title="Payments Overview"
        icon={ClipboardList}
        description="View upcoming, pending, and paid transactions. Analyze potential and collected revenue."
      />
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8">
        <Card className="shadow-sm bg-secondary/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Upcoming/Overdue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">${totalUpcomingAmount.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">{upcomingAndPendingBills.length} transactions</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm bg-secondary/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Paid ({format(new Date(selectedYear, selectedMonth), 'MMMM yyyy')})</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">${totalPaidSelectedPeriod.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">{paidBillsInSelectedPeriod.length} transactions</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm bg-secondary/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Potential Monthly Revenue</CardTitle>
            <Landmark className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">${totalPotentialRevenue.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">if all {spaces.length} spaces rented</p>
          </CardContent>
        </Card>
      </div>

      <section className="mb-10">
        <h2 className="text-2xl font-headline font-semibold mb-4 text-foreground">Upcoming & Overdue Payments</h2>
        {upcomingAndPendingBills.length === 0 ? (
          <Card className="text-center py-10 shadow-sm">
            <CardContent>
              <CheckCircle className="mx-auto h-12 w-12 text-green-500 mb-3" />
              <h3 className="text-lg font-semibold font-headline">All Clear!</h3>
              <p className="text-muted-foreground">No upcoming or overdue payments at the moment.</p>
            </CardContent>
          </Card>
        ) : (
          <Card className="shadow-md">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tenant</TableHead>
                    <TableHead className="hidden md:table-cell">Space</TableHead>
                    <TableHead>Bill Date</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {upcomingAndPendingBills.map(bill => (
                    <TableRow key={bill.id}>
                      <TableCell className="font-medium">{bill.tenantName || 'N/A'}</TableCell>
                      <TableCell className="hidden md:table-cell text-xs">{bill.spaceDescription}</TableCell>
                      <TableCell>{format(parseISO(bill.billDate), 'PP')}</TableCell>
                      <TableCell className={bill.status === 'Overdue' ? 'text-destructive font-semibold' : ''}>
                        {format(parseISO(bill.dueDate), 'PP')}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-primary">${bill.totalAmount.toFixed(2)}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={getStatusBadgeVariant(bill.status)} className="capitalize">
                          {getStatusIcon(bill.status)}<span className="ml-1">{bill.status}</span>
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </section>

      <section>
        <div className="flex flex-col md:flex-row justify-between md:items-center mb-4 gap-4">
            <h2 className="text-2xl font-headline font-semibold text-foreground">Payment History</h2>
            <div className="flex gap-2 items-end">
                <div>
                    <Label htmlFor="month-select" className="text-xs text-muted-foreground">Month</Label>
                    <Select value={String(selectedMonth)} onValueChange={(value) => setSelectedMonth(Number(value))}>
                        <SelectTrigger id="month-select" className="w-full md:w-[150px] h-9">
                            <SelectValue placeholder="Select Month" />
                        </SelectTrigger>
                        <SelectContent>
                        {monthsForFilter.map(month => (
                            <SelectItem key={month.value} value={String(month.value)}>{month.label}</SelectItem>
                        ))}
                        </SelectContent>
                    </Select>
                </div>
                <div>
                    <Label htmlFor="year-select" className="text-xs text-muted-foreground">Year</Label>
                    <Select value={String(selectedYear)} onValueChange={(value) => setSelectedYear(Number(value))}>
                        <SelectTrigger id="year-select" className="w-full md:w-[120px] h-9">
                        <SelectValue placeholder="Select Year" />
                        </SelectTrigger>
                        <SelectContent>
                        {yearsForFilter.map(year => (
                            <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                        ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>
        </div>

        {paidBillsInSelectedPeriod.length === 0 ? (
          <Card className="text-center py-10 shadow-sm">
            <CardContent>
              <DollarSign className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
              <h3 className="text-lg font-semibold font-headline">No Payments Found</h3>
              <p className="text-muted-foreground">No payments recorded for {format(new Date(selectedYear, selectedMonth), 'MMMM yyyy')}.</p>
            </CardContent>
          </Card>
        ) : (
          <Card className="shadow-md">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tenant</TableHead>
                    <TableHead className="hidden md:table-cell">Space</TableHead>
                    <TableHead>Payment Date</TableHead>
                    <TableHead className="hidden sm:table-cell">Method</TableHead>
                    <TableHead className="text-right">Amount Paid</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paidBillsInSelectedPeriod.map(bill => (
                    <TableRow key={bill.id}>
                      <TableCell className="font-medium">{bill.tenantName || 'N/A'}</TableCell>
                      <TableCell className="hidden md:table-cell text-xs">{bill.spaceDescription}</TableCell>
                      <TableCell>{bill.paymentDate ? format(parseISO(bill.paymentDate), 'PP') : 'N/A'}</TableCell>
                      <TableCell className="hidden sm:table-cell text-xs">
                        {bill.paymentMethod || 'N/A'}
                        {bill.paymentMethod === 'Bank Transfer' && bill.bankOrWalletName && ` (${bill.bankOrWalletName})`}
                        {bill.paymentMethod === 'Wallet' && bill.bankOrWalletName && ` (${bill.bankOrWalletName})`}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-green-600">${bill.totalAmount.toFixed(2)}</TableCell>
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
