
"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { PageHeader } from '@/components/custom/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ClipboardList, DollarSign, CalendarDays, CheckCircle, AlertTriangle, Info, User, HomeIcon, Landmark, Download, Building as BuildingIconLucide, UploadCloud } from 'lucide-react';
import type { Bill, Space, Building as BuildingType, Agreement, PenaltyTier } from '@/lib/types'; 
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

// Enhanced Mock data for demonstration
const mockSpacesData: Space[] = [
  { id: 'space1', buildingName: 'Sunrise Tower', spaceIdName: 'Unit 101', area: 1200, floor: '10th', utilityProrationShare: 0.4, monthlyRentalPrice: 2500, isOccupied: true, tenantId: 'tenant1', createdAt: new Date().toISOString() },
  { id: 'space2', buildingName: 'Ocean View Plaza', spaceIdName: 'Suite 20A', area: 800, floor: '2nd', utilityProrationShare: 0.25, monthlyRentalPrice: 1800, isOccupied: false, createdAt: new Date().toISOString() },
  { id: 'space3', buildingName: 'Downtown Hub', spaceIdName: 'Office 5B', area: 1500, floor: '5th', utilityProrationShare: 0.35, monthlyRentalPrice: 3200, isOccupied: true, tenantId: 'tenant2', createdAt: new Date().toISOString() },
  { id: 'space4', buildingName: 'Tech Park One', spaceIdName: 'Lab 3', area: 2000, floor: '1st', utilityProrationShare: 0.5, monthlyRentalPrice: 4500, isOccupied: false, createdAt: new Date().toISOString() },
  { id: 'space-portal-unit', buildingName: 'Portal View Residences', spaceIdName: 'Unit P1', area: 1000, floor: '1st', utilityProrationShare: 0.1, monthlyRentalPrice: 1500, isOccupied: true, tenantId: 'tenant-portal-user', createdAt: new Date().toISOString() },
];

const mockBuildingsData: BuildingType[] = [
  { id: 'building1', name: 'Sunrise Tower', address: '123 Sunrise Ave', penaltyPolicyTiers: [
      { scope: 'Building', fromDay: 1, toDay: 5, feeType: 'Fixed', feeValue: 50 }, 
      { scope: 'Building', fromDay: 6, toDay: null, feeType: 'Fixed', feeValue: 100 }
    ], createdAt: new Date().toISOString() },
  { id: 'building2', name: 'Downtown Hub', address: '456 Main St', penaltyPolicyTiers: [
      { scope: 'Building', fromDay: 1, toDay: 3, feeType: 'Percentage', feeValue: 2 }, 
      { scope: 'Building', fromDay: 4, toDay: 7, feeType: 'Percentage', feeValue: 5},
      { scope: 'Building', fromDay: 8, toDay: null, feeType: 'Fixed', feeValue: 200}
    ], createdAt: new Date().toISOString() },
  { id: 'building3', name: 'Galaxy Tower', address: '789 Star Rd', createdAt: new Date().toISOString() }, 
  { id: 'building-portal', name: 'Portal View Residences', address: '1 Portal Drive', penaltyPolicyTiers: [
      { scope: 'Building', fromDay: 1, toDay: 2, feeType: 'Fixed', feeValue: 25 }, 
      { scope: 'SpecificSpaces', applicableSpaceIdNames: ['Unit P1'], fromDay: 3, toDay: null, feeType: 'Fixed', feeValue: 50 }
    ], createdAt: new Date().toISOString() },
];

const mockAgreementsData: Agreement[] = [
    { id: 'agreement1', tenantId: 'tenant1', tenantName: 'Alice Wonderland', spaceId: 'space1', spaceDescription: 'Unit 101, Sunrise Tower', agreementText: '...', startDate: new Date().toISOString(), monthlyRentalPrice: 2500, createdAt: new Date().toISOString(), paymentTermMonths:12, initialPaymentMonths:1, nextPaymentDueDate: new Date().toISOString()},
    { id: 'agreement2', tenantId: 'tenant2', tenantName: 'Bob The Builder', spaceId: 'space3', spaceDescription: 'Office 5B, Downtown Hub', agreementText: '...', startDate: new Date().toISOString(), monthlyRentalPrice: 3200, createdAt: new Date().toISOString(), paymentTermMonths:12, initialPaymentMonths:1, nextPaymentDueDate: new Date().toISOString()},
    { id: 'agreement3', tenantId: 'tenant3', tenantName: 'Carol Danvers', spaceId: 'space4', spaceDescription: 'Penthouse, Galaxy Tower', agreementText: '...', startDate: new Date().toISOString(), monthlyRentalPrice: 5000, createdAt: new Date().toISOString(), paymentTermMonths:12, initialPaymentMonths:1, nextPaymentDueDate: new Date().toISOString()},
    { id: 'agree-tenant1-current', tenantId: 'tenant-portal-user', tenantName: 'Portal User Tenant', spaceId: 'space-portal-unit', spaceDescription: 'Unit P1, Portal View Residences', agreementText: '...', startDate: new Date().toISOString(), monthlyRentalPrice: 1500, createdAt: new Date().toISOString(), paymentTermMonths:12, initialPaymentMonths:1, nextPaymentDueDate: new Date().toISOString()},
];


const currentYear = new Date().getFullYear();
const currentMonth = new Date().getMonth();
const lastMonth = currentMonth - 1 < 0 ? 11 : currentMonth - 1;
const lastMonthYear = currentMonth - 1 < 0 ? currentYear - 1 : currentYear;


const mockBillsData: Bill[] = [
  { id: 'bill1', agreementId: 'agreement1', tenantId: 'tenant1', spaceDescription: 'Unit 101, Sunrise Tower', billDate: new Date(currentYear, 5, 1).toISOString(), dueDate: new Date(currentYear, 5, 15).toISOString(), rentAmount: 2500, utilityBreakdown: [{name: "Electricity", amount: 80}, {name: "Water", amount: 20}], totalAmount: 2600, status: 'Paid', paymentDate: new Date(currentYear, 5, 10).toISOString(), paymentMethod: "Card", paymentReference: "TXN12345" },
  { id: 'bill2', agreementId: 'agreement2', tenantId: 'tenant2', spaceDescription: 'Office 5B, Downtown Hub', billDate: new Date(currentYear, currentMonth, 1).toISOString(), dueDate: new Date(currentYear, currentMonth, 15).toISOString(), rentAmount: 3200, utilityBreakdown: [{name: "General Utility", amount: 175}], totalAmount: 3375, status: 'Pending' },
  { id: 'bill3', agreementId: 'agreement1', tenantId: 'tenant1', spaceDescription: 'Unit 101, Sunrise Tower', billDate: new Date(currentYear, currentMonth, 1).toISOString(), dueDate: new Date(currentYear, currentMonth, 10).toISOString(), rentAmount: 2500, utilityBreakdown: [{name: "Electricity", amount: 70}, {name: "Water", amount: 15}], totalAmount: 2585, status: 'Pending' },
  { id: 'bill4', agreementId: 'agreement3', tenantId: 'tenant3', spaceDescription: 'Penthouse, Galaxy Tower', billDate: new Date(currentYear, currentMonth - 1, 20).toISOString(), dueDate: new Date(currentYear, currentMonth -1 , 25).toISOString(), rentAmount: 5000, utilityBreakdown: [{name: "Premium Utilities", amount: 300}], totalAmount: 5300, status: 'Overdue' }, 
  { id: 'bill5', agreementId: 'agreement2', tenantId: 'tenant2', spaceDescription: 'Office 5B, Downtown Hub', billDate: new Date(lastMonthYear, lastMonth, 1).toISOString(), dueDate: new Date(lastMonthYear, lastMonth, 15).toISOString(), rentAmount: 3200, utilityBreakdown: [], totalAmount: 3200, status: 'Paid', paymentDate: new Date(lastMonthYear, lastMonth, 12).toISOString(), paymentMethod: "Bank Transfer", bankOrWalletName: "First National", paymentReference: "BNKREF001" },
  { id: 'bill6', agreementId: 'agree-tenant1-current', tenantId: 'tenant-portal-user', spaceDescription: 'Unit P1, Portal View Residences', billDate: new Date(lastMonthYear, lastMonth, 5).toISOString(), dueDate: new Date(lastMonthYear, lastMonth, 20).toISOString(), rentAmount: 1200, utilityBreakdown: [{name: "Internet", amount: 50}], totalAmount: 1250, status: 'Paid', paymentDate: new Date(lastMonthYear, lastMonth, 18).toISOString(), paymentMethod: "Wallet", bankOrWalletName: "PayZap", paymentReference: "WLTREF789" },
  { id: 'bill7', agreementId: 'agreement1', tenantId: 'tenant1', spaceDescription: 'Unit 101, Sunrise Tower', billDate: new Date(lastMonthYear, lastMonth, 1).toISOString(), dueDate: new Date(lastMonthYear, lastMonth, 15).toISOString(), rentAmount: 2500, utilityBreakdown: [{name: "Electricity", amount: 75}, {name: "Water", amount: 22}], totalAmount: 2597, status: 'Paid', paymentDate: new Date(lastMonthYear, lastMonth, 10).toISOString(), paymentMethod: "Card", paymentReference: "TXN67890" },
  { id: 'bill8-verify', agreementId: 'agree-tenant1-current', tenantId: 'tenant-portal-user', spaceDescription: 'Unit P1, Portal View Residences', billDate: new Date(currentYear, currentMonth -1, 5).toISOString(), dueDate: new Date(currentYear, currentMonth -1, 20).toISOString(), rentAmount: 1200, utilityBreakdown: [{name: "Gas", amount: 30}], totalAmount: 1230, status: 'Pending Verification', paymentProofUrl: 'gas_bill_proof.jpg', tenantPaymentNotes: "Paid via app." },

];

const getStoredSpaces = (): Space[] => {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('spaces');
    return stored ? JSON.parse(stored) : mockSpacesData;
  }
  return mockSpacesData;
};

const getStoredBuildings = (): BuildingType[] => {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('buildings');
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as BuildingType[];
        return parsed.map(b => ({
          ...b,
          penaltyPolicyTiers: (b.penaltyPolicyTiers || []).map(tier => ({
            ...tier,
            scope: tier.scope || 'Building', 
          })),
        }));
      } catch (e) {
        return mockBuildingsData;
      }
    }
  }
  return mockBuildingsData;
};

const getStoredAgreements = (): Agreement[] => {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('mockAgreements'); // Assuming this is the key used elsewhere
    return stored ? JSON.parse(stored) : mockAgreementsData;
  }
  return mockAgreementsData;
}


export default function PaymentsOverviewPage() {
  const [spaces, setSpacesState] = useState<Space[]>([]); 
  const [buildingsData, setBuildingsDataState] = useState<BuildingType[]>([]); 
  const [agreementsData, setAgreementsDataState] = useState<Agreement[]>([]); 
  const [isMounted, setIsMounted] = useState(false);
  const [today, setToday] = useState(startOfDay(new Date()));

  const [selectedMonth, setSelectedMonth] = useState<number>(today.getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(today.getFullYear());

  useEffect(() => {
    setIsMounted(true);
    setSpacesState(getStoredSpaces());
    setBuildingsDataState(getStoredBuildings());
    setAgreementsDataState(getStoredAgreements());
    setToday(startOfDay(new Date())); 
  }, []);

  const calculatePenalty = useCallback((bill: Bill, currentStatus: Bill['status']): number => {
    const agreement = agreementsData.find(ag => ag.id === bill.agreementId);
    if (!agreement) return 0;
    const space = spaces.find(sp => sp.id === agreement.spaceId);
    if (!space) return 0;
    const building = buildingsData.find(b => b.name === space.buildingName);
    
    if (!building || !building.penaltyPolicyTiers || building.penaltyPolicyTiers.length === 0) return 0;

    const dueDate = parseISO(bill.dueDate);
    if (currentStatus !== 'Overdue') return 0; 

    const daysOverdue = differenceInDays(today, dueDate);
    if (daysOverdue <= 0) return 0;
    
    let applicableTiersForScope: PenaltyTier[] = [];
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
  }, [agreementsData, spaces, buildingsData, today]);

  const processedBills = useMemo(() => {
    return mockBillsData.map(bill => {
      let currentStatus = bill.status;
      if (bill.status === 'Pending' && isBefore(parseISO(bill.dueDate), today)) {
        currentStatus = 'Overdue';
      }
      
      const penalty = (currentStatus === 'Overdue' && bill.status !== 'Paid' && bill.status !== 'Pending Verification') 
                      ? calculatePenalty(bill, currentStatus) 
                      : (bill.penaltyAmount || 0);

      const baseAmount = bill.rentAmount + bill.utilityBreakdown.reduce((sum, util) => sum + util.amount, 0);
      const newTotalAmount = baseAmount + penalty;

      return {
        ...bill,
        status: currentStatus,
        penaltyAmount: penalty > 0 ? penalty : undefined,
        totalAmount: parseFloat(newTotalAmount.toFixed(2)),
        tenantName: agreementsData.find(a => a.id === bill.agreementId)?.tenantName || 'N/A' 
      };
    }).sort((a, b) => parseISO(b.billDate).getTime() - parseISO(a.billDate).getTime());
  }, [today, calculatePenalty, agreementsData]); 
  
  const upcomingAndPendingBills = useMemo(() => processedBills.filter(b => b.status === 'Pending' || b.status === 'Overdue' || b.status === 'Pending Verification'), [processedBills]);
  
  const paidBillsInSelectedPeriod = useMemo(() => processedBills.filter(bill => {
    if (bill.status !== 'Paid' || !bill.paymentDate) return false;
    const paymentDateObj = parseISO(bill.paymentDate);
    return getMonth(paymentDateObj) === selectedMonth && getYear(paymentDateObj) === selectedYear;
  }), [processedBills, selectedMonth, selectedYear]);

  const totalUpcomingAmount = useMemo(() => upcomingAndPendingBills.reduce((sum, bill) => sum + bill.totalAmount, 0), [upcomingAndPendingBills]);
  const totalPaidSelectedPeriod = useMemo(() => paidBillsInSelectedPeriod.reduce((sum, bill) => sum + bill.totalAmount, 0), [paidBillsInSelectedPeriod]);
  const totalPotentialRevenue = useMemo(() => spaces.reduce((sum, space) => sum + space.monthlyRentalPrice, 0), [spaces]);

  const yearsForFilter = useMemo(() => Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i), []);
  const monthsForFilter = useMemo(() => Array.from({ length: 12 }, (_, i) => ({
    value: i,
    label: format(new Date(0, i), 'MMMM'),
  })), []);

  const getStatusBadgeVariant = (status: Bill['status']): "default" | "destructive" | "secondary" | "outline" => {
    switch (status) {
      case 'Paid': return 'secondary';
      case 'Pending': return 'default';
      case 'Overdue': return 'destructive';
      case 'Pending Verification': return 'outline';
      default: return 'default';
    }
  };

  const getStatusIcon = (status: Bill['status']) => {
    switch (status) {
      case 'Paid': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'Pending': return <Info className="h-4 w-4 text-yellow-600" />;
      case 'Overdue': return <AlertTriangle className="h-4 w-4 text-red-600" />;
      case 'Pending Verification': return <UploadCloud className="h-4 w-4 text-blue-600" />;
      default: return <Info className="h-4 w-4 text-gray-500" />;
    }
  };

  const exportToExcel = (data: Bill[], fileNamePrefix: string) => {
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
    return <div className="flex justify-center items-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;
  }

  return (
    <div className="animate-fadeIn">
      <PageHeader
        title="Payments Overview"
        icon={ClipboardList}
        description="View upcoming, pending, and paid transactions. Analyze potential and collected revenue. Penalties are applied based on building policies."
      />
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8">
        <Card className="shadow-sm bg-secondary/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Upcoming/Awaiting</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">${totalUpcomingAmount.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">{upcomingAndPendingBills.length} transactions (incl. Overdue & Verification)</p>
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
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-headline font-semibold text-foreground">Upcoming, Overdue & Pending Verification</h2>
          {upcomingAndPendingBills.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => exportToExcel(upcomingAndPendingBills, 'Upcoming_Overdue_Verification_Payments')}>
              <Download className="mr-2 h-4 w-4" /> Export to Excel
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
          <Card className="shadow-md">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tenant</TableHead>
                    <TableHead className="hidden md:table-cell">Space</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead className="hidden sm:table-cell">Penalty</TableHead>
                    <TableHead className="text-right">Amount Due</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {upcomingAndPendingBills.map(bill => (
                    <TableRow key={bill.id} className={`${bill.status === 'Pending Verification' ? 'bg-blue-500/5 hover:bg-blue-500/10' : ''}`}>
                      <TableCell className="font-medium">{bill.tenantName || 'N/A'}</TableCell>
                      <TableCell className="hidden md:table-cell text-xs">{bill.spaceDescription}</TableCell>
                      <TableCell className={bill.status === 'Overdue' ? 'text-destructive font-semibold' : ''}>
                        {format(parseISO(bill.dueDate), 'PP')}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-xs text-destructive">
                        {bill.penaltyAmount ? `$${bill.penaltyAmount.toFixed(2)}` : ''}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-primary">${bill.totalAmount.toFixed(2)}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={getStatusBadgeVariant(bill.status)} className={`capitalize ${bill.status === 'Pending Verification' ? 'border-blue-400 text-blue-700 bg-blue-100' : ''}`}>
                          {getStatusIcon(bill.status)}<span className="ml-1">{bill.status.replace(' Verification',' Ver.')}</span>
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
            <h2 className="text-2xl font-headline font-semibold text-foreground">Payment History (Paid & Verified)</h2>
            <div className="flex gap-2 items-center flex-wrap">
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
                {paidBillsInSelectedPeriod.length > 0 && (
                  <Button variant="outline" size="sm" onClick={() => exportToExcel(paidBillsInSelectedPeriod, `Payment_History_${monthsForFilter.find(m=>m.value===selectedMonth)?.label}_${selectedYear}`)} className="self-end h-9">
                    <Download className="mr-2 h-4 w-4" /> Export to Excel
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


    