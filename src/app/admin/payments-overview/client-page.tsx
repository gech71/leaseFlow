
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { PageHeader } from '@/components/custom/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ClipboardList, DollarSign, CalendarDays, CheckCircle, AlertTriangle, Info, User, HomeIcon, Landmark, Download, Building as BuildingIconLucide, UploadCloud, Loader2, EyeOff } from 'lucide-react';
import type { PenaltyTier as PenaltyTierPrisma, Space as SpacePrismaOriginal, Bill as BillPrismaOriginal, Agreement as AgreementPrismaOriginal, Tenant as TenantPrismaOriginal, Building as BuildingPrismaTypeOriginal, UtilityBreakdownItem as UtilityBreakdownItemPrismaOriginal } from '@prisma/client';
import { Badge } from '@/components/ui/badge';
import { format, parseISO, isBefore, startOfDay, getYear, getMonth, differenceInDays } from 'date-fns';
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
import { Button } from '@/components/ui/button';
import * as XLSX from 'xlsx';
import { usePermissions } from '@/contexts/PermissionContext';
import { PaginationControls } from '@/components/custom/PaginationControls';

// Client-side representation types, ensuring dates are strings (ISO format)
export interface ClientPenaltyTier extends Omit<PenaltyTierPrisma, 'id'> { id?: string; } 

export interface ClientBuilding extends Omit<BuildingPrismaTypeOriginal, 'createdAt' | 'updatedAt' | 'penaltyPolicyTiers'> {
  createdAt: string;
  updatedAt: string;
  penaltyPolicyTiers: ClientPenaltyTier[];
}

export interface ClientSpaceForAgreement extends Omit<SpacePrismaOriginal, 'createdAt' | 'updatedAt' | 'building' | 'tenantId' | 'buildingId' | 'agreements' | 'tenant'> {
  createdAt: string;
  updatedAt: string;
  building: ClientBuilding;
  tenantId?: string | null;
  buildingId: string;
}
export interface ClientSpaceForPotentialRevenue extends Omit<SpacePrismaOriginal, 'createdAt' | 'updatedAt' | 'buildingId' | 'tenantId' | 'agreements' | 'tenant' | 'building' > {
  createdAt: string;
  updatedAt: string;
  buildingId: string;
  tenantId?: string | null;
}


export interface ClientTenant extends Omit<TenantPrismaOriginal, 'createdAt' | 'updatedAt' | 'rentedSpaceId' | 'agreements' | 'bills'> {
  createdAt: string;
  updatedAt: string;
  rentedSpaceId?: string | null;
}

export interface ClientAgreementForBill extends Omit<AgreementPrismaOriginal, 'createdAt' | 'updatedAt' | 'startDate' | 'nextPaymentDueDate' | 'initialPaymentDate' | 'endDate' | 'tenant' | 'space'| 'bills' | 'tenantId' | 'spaceId'> {
  createdAt: string;
  updatedAt: string;
  startDate: string;
  nextPaymentDueDate: string;
  initialPaymentDate?: string | null;
  endDate?: string | null;
  tenant: ClientTenant;
  space: ClientSpaceForAgreement;
  tenantId: string;
  spaceId: string;
}

export interface ClientUtilityBreakdownItem extends Omit<UtilityBreakdownItemPrismaOriginal, 'id' | 'billId'> { id?: string; billId?: string;}

export interface ClientBill extends Omit<BillPrismaOriginal, 'createdAt' | 'updatedAt' | 'billDate' | 'dueDate' | 'paymentDate' | 'agreement' | 'utilityBreakdown' | 'tenantId' | 'agreementId'> {
  createdAt: string;
  updatedAt: string;
  billDate: string;
  dueDate: string;
  paymentDate?: string | null;
  agreement: ClientAgreementForBill; 
  utilityBreakdown: ClientUtilityBreakdownItem[];
  tenantId: string;
  agreementId: string;
  status: BillPrismaOriginal['status']; 
}


interface PaymentsOverviewClientPageProps {
  initialBills: ClientBill[];
  initialSpaces: ClientSpaceForPotentialRevenue[];
}

export function PaymentsOverviewClientPage({ initialBills, initialSpaces }: PaymentsOverviewClientPageProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [today, setToday] = useState(startOfDay(new Date()));

  const [selectedMonth, setSelectedMonth] = useState<number>(today.getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(today.getFullYear());
  
  const [bills, setBills] = useState<ClientBill[]>(initialBills);

  const { hasPermission, isSuperAdmin } = usePermissions();
  const canViewPage = isSuperAdmin || hasPermission('payment_overview:view');

  const [upcomingCurrentPage, setUpcomingCurrentPage] = useState(1);
  const [paidCurrentPage, setPaidCurrentPage] = useState(1);
  const [upcomingItemsPerPage, setUpcomingItemsPerPage] = useState(10);
  const [paidItemsPerPage, setPaidItemsPerPage] = useState(10);

  const handleUpcomingItemsPerPageChange = (newSize: number) => {
    setUpcomingItemsPerPage(newSize);
    setUpcomingCurrentPage(1);
  };

  const handlePaidItemsPerPageChange = (newSize: number) => {
    setPaidItemsPerPage(newSize);
    setPaidCurrentPage(1);
  };

  useEffect(() => {
    setIsMounted(true);
    setToday(startOfDay(new Date())); 
    setBills(initialBills); 
  }, [initialBills]);
  
  useEffect(() => {
    setPaidCurrentPage(1);
  }, [selectedMonth, selectedYear]);

  const calculatePenalty = useCallback((bill: ClientBill, currentStatus: ClientBill['status']): number => {
    const building = bill.agreement?.space?.building;
    if (!building || !building.penaltyPolicyTiers || building.penaltyPolicyTiers.length === 0) {
      return 0;
    }
    
    const space = bill.agreement.space;
    const dueDate = parseISO(bill.dueDate);

    if (currentStatus !== 'Overdue') return 0; 

    const daysOverdue = differenceInDays(today, dueDate);
    if (daysOverdue <= 0) return 0;
    
    let applicableTiersForScope: ClientPenaltyTier[] = [];
    const spaceSpecificTiers = building.penaltyPolicyTiers.filter(
      t => t.scope === 'SpecificSpaces' && t.applicableSpaceIdNames?.includes(space.spaceIdName)
    );

    if (spaceSpecificTiers.length > 0) {
      applicableTiersForScope = spaceSpecificTiers;
    } else {
      const floorSpecificTiers = building.penaltyPolicyTiers.filter(
        t => t.scope === 'Floor' && t.applicableFloor === space.floor
      );
      if (floorSpecificTiers.length > 0) {
        applicableTiersForScope = floorSpecificTiers;
      } else {
        applicableTiersForScope = building.penaltyPolicyTiers.filter(t => t.scope === 'Building');
      }
    }
    
    if (applicableTiersForScope.length === 0) return 0;

    const sortedTiers = [...applicableTiersForScope].sort((a, b) => a.fromDay - b.fromDay);
    let calculatedPenalty = 0;
    for (const tier of sortedTiers) {
      if (daysOverdue >= tier.fromDay && (tier.toDay === null || tier.toDay === undefined || daysOverdue <= tier.toDay)) {
        if (tier.feeType === 'Fixed') {
          calculatedPenalty = tier.feeValue;
        } else if (tier.feeType === 'Percentage') {
          calculatedPenalty = bill.rentAmount * (tier.feeValue / 100);
        }
        break; 
      }
    }
    return parseFloat(calculatedPenalty.toFixed(2));
  }, [today]);

  const processedBills = useMemo(() => {
    return bills.map(bill => { 
      let currentStatus = bill.status;
      if (bill.status === 'Pending' && isBefore(parseISO(bill.dueDate), today)) {
        currentStatus = 'Overdue';
      }
      
      const penalty = (currentStatus === 'Overdue' && bill.status !== 'Paid' && bill.status !== 'PendingVerification') 
                      ? calculatePenalty(bill, currentStatus) 
                      : (bill.penaltyAmount || 0);

      const baseAmount = bill.rentAmount + bill.utilityBreakdown.reduce((sum, util) => sum + util.amount, 0);
      const newTotalAmount = baseAmount + penalty;

      return {
        ...bill,
        status: currentStatus,
        penaltyAmount: penalty > 0 ? penalty : undefined, 
        totalAmount: parseFloat(newTotalAmount.toFixed(2)),
        tenantName: bill.agreement?.tenant?.name || 'N/A',
        spaceDescription: bill.agreement?.space ? `${bill.agreement.space.spaceIdName}, ${bill.agreement.space.building?.name || 'N/A'}` : 'N/A'
      };
    }).sort((a, b) => parseISO(b.billDate).getTime() - parseISO(a.billDate).getTime());
  }, [bills, today, calculatePenalty]); 
  
  const upcomingAndPendingBills = useMemo(() => processedBills.filter(b => b.status === 'Pending' || b.status === 'Overdue' || b.status === 'PendingVerification'), [processedBills]);
  
  const paidBillsInSelectedPeriod = useMemo(() => {
    return processedBills.filter(bill => {
      if (bill.status !== 'Paid' || !bill.paymentDate) return false;
      const paymentDateObj = parseISO(bill.paymentDate);
      return getMonth(paymentDateObj) === selectedMonth && getYear(paymentDateObj) === selectedYear;
    })
  }, [processedBills, selectedMonth, selectedYear]);

  // Pagination for upcoming bills
  const upcomingTotalPages = Math.ceil(upcomingAndPendingBills.length / upcomingItemsPerPage);
  const paginatedUpcomingBills = upcomingAndPendingBills.slice(
    (upcomingCurrentPage - 1) * upcomingItemsPerPage,
    upcomingCurrentPage * upcomingItemsPerPage
  );
  
  // Pagination for paid bills
  const paidTotalPages = Math.ceil(paidBillsInSelectedPeriod.length / paidItemsPerPage);
  const paginatedPaidBills = paidBillsInSelectedPeriod.slice(
    (paidCurrentPage - 1) * paidItemsPerPage,
    paidCurrentPage * paidItemsPerPage
  );

  const totalUpcomingAmount = useMemo(() => upcomingAndPendingBills.reduce((sum, bill) => sum + bill.totalAmount, 0), [upcomingAndPendingBills]);
  const totalPaidSelectedPeriod = useMemo(() => paidBillsInSelectedPeriod.reduce((sum, bill) => sum + bill.totalAmount, 0), [paidBillsInSelectedPeriod]);
  const totalPotentialRevenue = useMemo(() => initialSpaces.reduce((sum, space) => sum + space.monthlyRentalPrice, 0), [initialSpaces]);

  const yearsForFilter = useMemo(() => Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i), []);
  const monthsForFilter = useMemo(() => Array.from({ length: 12 }, (_, i) => ({
    value: i,
    label: format(new Date(0, i), 'MMMM'),
  })), []);

  const getStatusBadgeVariant = (status: ClientBill['status']): "default" | "destructive" | "secondary" | "outline" => {
    switch (status) {
      case 'Paid': return 'secondary';
      case 'Pending': return 'default';
      case 'Overdue': return 'destructive';
      case 'PendingVerification': return 'outline';
      default: return 'default';
    }
  };

  const getStatusIcon = (status: ClientBill['status']) => {
    switch (status) {
      case 'Paid': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'Pending': return <Info className="h-4 w-4 text-yellow-600" />;
      case 'Overdue': return <AlertTriangle className="h-4 w-4 text-red-600" />;
      case 'PendingVerification': return <UploadCloud className="h-4 w-4 text-blue-600" />;
      default: return <Info className="h-4 w-4 text-gray-500" />;
    }
  };

  const exportToExcel = (data: typeof processedBills, fileNamePrefix: string) => {
    if (!canViewPage) { // Double check permission before export
      // toast({ title: "Permission Denied", description: "You do not have permission to export data.", variant: "destructive" });
      return;
    }
    const worksheetData = data.map(bill => ({
      'Tenant Name': bill.tenantName, 
      'Space Description': bill.spaceDescription,
      'Bill Date': format(parseISO(bill.billDate), 'PP'),
      'Due Date': format(parseISO(bill.dueDate), 'PP'),
      'Rent Amount': bill.rentAmount,
      'Utilities Amount': bill.utilityBreakdown.reduce((sum, util) => sum + util.amount, 0),
      'Penalty Amount': bill.penaltyAmount || 0,
      'Total Amount': bill.totalAmount,
      'Status': bill.status,
      'Payment Date': bill.paymentDate ? format(parseISO(bill.paymentDate), 'PP') : 'N/A',
      'Payment Method': bill.paymentMethod || 'N/A',
      'Bank/Wallet': bill.bankOrWalletName || 'N/A',
      'Reference': bill.paymentReference || 'N/A',
      'Tenant Notes': bill.tenantPaymentNotes || 'N/A',
      'Admin Notes': bill.adminVerificationNotes || 'N/A',
      'Proof URL': bill.paymentProofUrl || 'N/A',
    }));

    const worksheet = XLSX.utils.json_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Payments");
    XLSX.writeFile(workbook, `${fileNamePrefix}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  if (!isMounted) {
    return (
        <div className="flex justify-center items-center h-screen">
            <Loader2 className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"/>
        </div>
    );
  }
  
  if (!canViewPage && isMounted) {
    return (
      <Card className="shadow-lg text-center py-12">
        <CardHeader><CardTitle className="text-destructive flex items-center justify-center"><EyeOff className="mr-2"/>Access Denied</CardTitle></CardHeader>
        <CardContent><p>You do not have permission to view payments overview.</p></CardContent>
      </Card>
    );
  }


  return (
    <div className="animate-fadeIn">
      <PageHeader
        title="Payments Overview"
        icon={ClipboardList}
        description="View upcoming, pending, and paid transactions. Analyze potential and collected revenue. Penalties are applied based on building policies."
      />
      
      <div className="grid gap-4 md:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 mb-8">
        <Card className="shadow-sm bg-secondary/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Upcoming/Awaiting</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{totalUpcomingAmount.toFixed(2)} Birr</div>
            <p className="text-xs text-muted-foreground">{upcomingAndPendingBills.length} transactions (incl. Overdue & Verification)</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm bg-secondary/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Paid ({format(new Date(selectedYear, selectedMonth), 'MMMM yyyy')})</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{totalPaidSelectedPeriod.toFixed(2)} Birr</div>
            <p className="text-xs text-muted-foreground">{paidBillsInSelectedPeriod.length} transactions</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm bg-secondary/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Potential Monthly Revenue</CardTitle>
            <Landmark className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{totalPotentialRevenue.toFixed(2)} Birr</div>
            <p className="text-xs text-muted-foreground">Based on {initialSpaces.length} total spaces</p>
          </CardContent>
        </Card>
      </div>

      <section className="mb-10">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-2">
          <h2 className="text-2xl font-headline font-semibold text-foreground">Upcoming, Overdue & Pending Verification</h2>
          {upcomingAndPendingBills.length > 0 && canViewPage && (
            <Button variant="outline" size="sm" onClick={() => exportToExcel(upcomingAndPendingBills, 'Upcoming_Overdue_Verification_Payments')}>
              <Download className="mr-2 h-4 w-4" /> Export
            </Button>
          )}
        </div>
        {upcomingAndPendingBills.length === 0 ? (
          <Card className="text-center py-10 shadow-sm">
            <CardContent>
              <CheckCircle className="mx-auto h-12 w-12 text-green-500 mb-3" />
              <h3 className="text-lg font-semibold font-headline">All Clear!</h3>
              <p className="text-muted-foreground">No upcoming, overdue, or pending verification payments.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="shadow-md">
              <CardContent className="p-0">
                <div className="w-full overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tenant</TableHead>
                        <TableHead className="hidden md:table-cell">Space</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead className="hidden xl:table-cell text-right">Penalty</TableHead>
                        <TableHead className="text-right">Amount Due</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedUpcomingBills.map(bill => (
                        <TableRow key={bill.id} className={`${bill.status === 'PendingVerification' ? 'bg-blue-500/5 hover:bg-blue-500/10' : ''}`}>
                          <TableCell className="font-medium">{bill.tenantName || 'N/A'}</TableCell>
                          <TableCell className="hidden md:table-cell text-xs">{bill.spaceDescription}</TableCell>
                          <TableCell className={bill.status === 'Overdue' ? 'text-destructive font-semibold' : ''}>
                            {format(parseISO(bill.dueDate), 'PP')}
                          </TableCell>
                          <TableCell className="hidden xl:table-cell text-xs text-destructive text-right whitespace-nowrap">
                            {bill.penaltyAmount ? `${bill.penaltyAmount.toFixed(2)} Birr` : ''}
                          </TableCell>
                          <TableCell className="text-right font-semibold text-primary whitespace-nowrap">{bill.totalAmount.toFixed(2)} Birr</TableCell>
                          <TableCell className="text-center">
                            <Badge variant={getStatusBadgeVariant(bill.status)} className={`capitalize ${bill.status === 'PendingVerification' ? 'border-blue-400 text-blue-700 bg-blue-100' : ''}`}>
                              {getStatusIcon(bill.status)}<span className="ml-1">{bill.status.replace(' Verification',' Ver.')}</span>
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
            <PaginationControls
              currentPage={upcomingCurrentPage}
              totalPages={upcomingTotalPages}
              onPageChange={setUpcomingCurrentPage}
              itemsPerPage={upcomingItemsPerPage}
              onItemsPerPageChange={handleUpcomingItemsPerPageChange}
              className="mt-4"
            />
          </>
        )}
      </section>

      <section>
        <div className="flex flex-col md:flex-row justify-between md:items-center mb-4 gap-4">
            <h2 className="text-2xl font-headline font-semibold text-foreground">Payment History (Paid & Verified)</h2>
            <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-end w-full sm:w-auto">
                <div className="flex-grow sm:flex-grow-0">
                    <Label htmlFor="month-select" className="text-xs text-muted-foreground">Month</Label>
                    <Select value={String(selectedMonth)} onValueChange={(value) => setSelectedMonth(Number(value))}>
                        <SelectTrigger id="month-select" className="w-full sm:w-[150px] h-9 mt-1">
                            <SelectValue placeholder="Select Month" />
                        </SelectTrigger>
                        <SelectContent>
                        {monthsForFilter.map(month => (
                            <SelectItem key={month.value} value={String(month.value)}>{month.label}</SelectItem>
                        ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="flex-grow sm:flex-grow-0">
                    <Label htmlFor="year-select" className="text-xs text-muted-foreground">Year</Label>
                    <Select value={String(selectedYear)} onValueChange={(value) => setSelectedYear(Number(value))}>
                        <SelectTrigger id="year-select" className="w-full sm:w-[120px] h-9 mt-1">
                        <SelectValue placeholder="Select Year" />
                        </SelectTrigger>
                        <SelectContent>
                        {yearsForFilter.map(year => (
                            <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                        ))}
                        </SelectContent>
                    </Select>
                </div>
                {paidBillsInSelectedPeriod.length > 0 && canViewPage && (
                  <Button variant="outline" size="sm" onClick={() => exportToExcel(paidBillsInSelectedPeriod, `Payment_History_${monthsForFilter.find(m=>m.value===selectedMonth)?.label}_${selectedYear}`)} className="self-stretch sm:self-end h-9 w-full sm:w-auto">
                    <Download className="mr-2 h-4 w-4" /> Export
                  </Button>
                )}
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
          <>
            <Card className="shadow-md">
              <CardContent className="p-0">
                <div className="w-full overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tenant</TableHead>
                        <TableHead className="hidden md:table-cell">Space</TableHead>
                        <TableHead>Payment Date</TableHead>
                        <TableHead className="hidden lg:table-cell">Method</TableHead>
                        <TableHead className="text-right">Amount Paid</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedPaidBills.map(bill => (
                        <TableRow key={bill.id}>
                          <TableCell className="font-medium">{bill.tenantName || 'N/A'}</TableCell>
                          <TableCell className="hidden md:table-cell text-xs">{bill.spaceDescription}</TableCell>
                          <TableCell>{bill.paymentDate ? format(parseISO(bill.paymentDate), 'PP') : 'N/A'}</TableCell>
                          <TableCell className="hidden lg:table-cell text-xs">
                            {bill.paymentMethod || 'N/A'}
                            {bill.paymentMethod === 'Bank Transfer' && bill.bankOrWalletName && ` (${bill.bankOrWalletName})`}
                            {bill.paymentMethod === 'Wallet' && bill.bankOrWalletName && ` (${bill.bankOrWalletName})`}
                          </TableCell>
                          <TableCell className="text-right font-semibold text-green-600 whitespace-nowrap">{bill.totalAmount.toFixed(2)} Birr</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
            <PaginationControls
              currentPage={paidCurrentPage}
              totalPages={paidTotalPages}
              onPageChange={setPaidCurrentPage}
              itemsPerPage={paidItemsPerPage}
              onItemsPerPageChange={handlePaidItemsPerPageChange}
              className="mt-4"
            />
          </>
        )}
      </section>
    </div>
  );
}
