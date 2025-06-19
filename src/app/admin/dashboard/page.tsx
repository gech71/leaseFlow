
"use client";

import { useState, useEffect, useMemo } from 'react';
import { PageHeader } from '@/components/custom/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, Users, FileText, DollarSign, LayoutDashboard, TrendingDown, TrendingUp, AlertCircle } from 'lucide-react';
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend, PieChart, Pie, Cell } from 'recharts';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { BuildingFinancialCard } from '@/components/custom/BuildingFinancialCard';
import type { Building, Space, Agreement, Bill, BuildingMonthlyUtilities } from '@/lib/types';
import { getMonth, getYear, parseISO, format } from 'date-fns';

// Mock data retrieval functions (assuming these exist or are adapted from other pages)
const getStoredBuildings = (): Building[] => {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('buildings');
    return stored ? JSON.parse(stored) : [];
  }
  return [];
};

const getStoredSpaces = (): Space[] => {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('spaces');
    return stored ? JSON.parse(stored) : [];
  }
  return [];
};

const getStoredAgreements = (): Agreement[] => {
  if (typeof window !== 'undefined') {
    const storedAgreements = localStorage.getItem('mockAgreements');
    return storedAgreements ? JSON.parse(storedAgreements) : [];
  }
  return [];
};

const getStoredBills = (): Bill[] => {
  if (typeof window !== 'undefined') {
    // Using 'initialBills' structure from billing page for consistency.
    // In a real app, this would be a direct fetch.
    // This example uses a simplified structure. A more robust app would fetch from a unified source.
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth();
    return [ // Sample bills, replace with actual localStorage fetching if available elsewhere
        { id: 'bill1', agreementId: 'agreement1', tenantId: 'tenant1', spaceDescription: 'Unit 101, Sunrise Tower', billDate: new Date(currentYear, 5, 1).toISOString(), dueDate: new Date(currentYear, 5, 15).toISOString(), rentAmount: 2500, utilityBreakdown: [{name: "Electricity", amount: 80}, {name: "Water", amount: 20}], totalAmount: 2600, status: 'Paid', paymentDate: new Date(currentYear, 5, 10).toISOString()},
        { id: 'bill2', agreementId: 'agreement2', tenantId: 'tenant2', spaceDescription: 'Office 5B, Downtown Hub', billDate: new Date(currentYear, currentMonth, 1).toISOString(), dueDate: new Date(currentYear, currentMonth, 15).toISOString(), rentAmount: 3200, utilityBreakdown: [{name: "General Utility", amount: 175}], totalAmount: 3375, status: 'Pending' },
        { id: 'bill-st1', agreementId: 'agreement-st1', tenantId: 'tenant-st1', spaceDescription: 'Suite 1A, Sunrise Tower', billDate: new Date(currentYear, currentMonth, 1).toISOString(), dueDate: new Date(currentYear, currentMonth, 15).toISOString(), rentAmount: 1800, utilityBreakdown: [], totalAmount: 1800, status: 'Paid', paymentDate: new Date(currentYear, currentMonth, 10).toISOString()},
        { id: 'bill-dt1', agreementId: 'agreement-dt1', tenantId: 'tenant-dt1', spaceDescription: 'Office 2C, Downtown Hub', billDate: new Date(currentYear, currentMonth, 5).toISOString(), dueDate: new Date(currentYear, currentMonth, 20).toISOString(), rentAmount: 2200, utilityBreakdown: [], totalAmount: 2200, status: 'Pending Verification'},
        { id: 'bill-st2-overdue', agreementId: 'agreement-st2', tenantId: 'tenant-st2', spaceDescription: 'Unit 102, Sunrise Tower', billDate: new Date(currentYear, currentMonth-1, 1).toISOString(), dueDate: new Date(currentYear, currentMonth-1, 15).toISOString(), rentAmount: 2000, utilityBreakdown: [], totalAmount: 2000, status: 'Overdue'},
    ];
  }
  return [];
};

const getStoredBuildingUtilities = (): BuildingMonthlyUtilities[] => {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('buildingMonthlyUtilities');
     if (stored) {
        try {
            const parsed = JSON.parse(stored) as BuildingMonthlyUtilities[];
            return parsed.map(entry => ({
                ...entry,
                utilities: entry.utilities.map(util => ({
                    ...util,
                    appliesToScope: util.appliesToScope || 'Building',
                }))
            }));
        } catch(e) { return []; }
    }
  }
  return [];
};


const StatCard = ({ title, value, icon: Icon, description, trend, trendColor }: { title: string, value: string, icon: React.ElementType, description?: string, trend?: string, trendColor?: string }) => (
  <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      <Icon className="h-5 w-5 text-primary" />
    </CardHeader>
    <CardContent>
      <div className="text-3xl font-bold font-headline text-foreground">{value}</div>
      {description && <p className="text-xs text-muted-foreground pt-1">{description}</p>}
      {trend && <p className={`text-xs pt-1 ${trendColor || 'text-green-500'}`}>{trend}</p>}
    </CardContent>
  </Card>
);

interface BuildingFinancialSummary {
  buildingId: string;
  buildingName: string;
  currentMonthExpenses: number;
  currentMonthIncomeCollected: number;
  currentMonthIncomePendingConfirmation: number;
  currentMonthIncomeToBeCollected: number;
}

export default function AdminDashboardPage() {
  const [isMounted, setIsMounted] = useState(false);
  const [stats, setStats] = useState({
    totalSpaces: 0,
    occupiedSpaces: 0,
    totalTenants: 0,
    occupancyRate: '0%',
    totalRevenueMTD: '$0.00',
    activeAgreements: 0,
  });
  const [buildingFinancials, setBuildingFinancials] = useState<BuildingFinancialSummary[]>([]);
  
  const currentMonth = getMonth(new Date());
  const currentYear = getYear(new Date());
  const periodDescription = format(new Date(currentYear, currentMonth), "MMMM yyyy");

  useEffect(() => {
    setIsMounted(true);
    const buildings = getStoredBuildings();
    const spaces = getStoredSpaces();
    const agreements = getStoredAgreements();
    const bills = getStoredBills();
    const buildingUtilities = getStoredBuildingUtilities();

    // Calculate general stats
    const occupiedSpacesCount = spaces.filter(s => s.isOccupied).length;
    const occupancyRateValue = spaces.length > 0 ? (occupiedSpacesCount / spaces.length) * 100 : 0;
    
    const activeAgreementsList = agreements.filter(ag => {
        // Basic active check, can be refined
        const endDate = new Date(parseISO(ag.startDate));
        endDate.setMonth(endDate.getMonth() + ag.paymentTermMonths);
        return endDate >= new Date();
    });

    const mtdBills = bills.filter(b => b.status === 'Paid' && b.paymentDate && getMonth(parseISO(b.paymentDate)) === currentMonth && getYear(parseISO(b.paymentDate)) === currentYear);
    const totalRevenueMTDValue = mtdBills.reduce((sum, bill) => sum + bill.totalAmount, 0);

    setStats({
      totalSpaces: spaces.length,
      occupiedSpaces: occupiedSpacesCount,
      totalTenants: activeAgreementsList.map(ag => ag.tenantId).filter((v, i, a) => a.indexOf(v) === i).length, // Unique tenants
      occupancyRate: `${occupancyRateValue.toFixed(1)}%`,
      totalRevenueMTD: `$${totalRevenueMTDValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      activeAgreements: activeAgreementsList.length,
    });

    // Calculate building financials
    const financials: BuildingFinancialSummary[] = buildings.map(building => {
      const currentMonthUtil = buildingUtilities.find(bu => 
        bu.buildingName === building.name && bu.month === currentMonth && bu.year === currentYear
      );
      const expenses = currentMonthUtil ? currentMonthUtil.utilities.reduce((sum, util) => sum + util.totalCost, 0) : 0;

      const spacesInBuilding = spaces.filter(s => s.buildingName === building.name);
      const agreementIdsInBuilding = agreements
        .filter(ag => spacesInBuilding.some(s => s.id === ag.spaceId))
        .map(ag => ag.id);
      
      const billsForBuildingCurrentMonth = bills.filter(bill => 
        agreementIdsInBuilding.includes(bill.agreementId) &&
        getMonth(parseISO(bill.billDate)) === currentMonth &&
        getYear(parseISO(bill.billDate)) === currentYear
      );
      
      const incomeCollected = billsForBuildingCurrentMonth
        .filter(b => b.status === 'Paid')
        .reduce((sum, b) => sum + b.totalAmount, 0);
      const incomePendingConfirmation = billsForBuildingCurrentMonth
        .filter(b => b.status === 'Pending Verification')
        .reduce((sum, b) => sum + b.totalAmount, 0);
      const incomeToBeCollected = billsForBuildingCurrentMonth
        .filter(b => b.status === 'Pending' || b.status === 'Overdue')
        .reduce((sum, b) => sum + b.totalAmount, 0);

      return {
        buildingId: building.id,
        buildingName: building.name,
        currentMonthExpenses: expenses,
        currentMonthIncomeCollected: incomeCollected,
        currentMonthIncomePendingConfirmation: incomePendingConfirmation,
        currentMonthIncomeToBeCollected: incomeToBeCollected,
      };
    });
    setBuildingFinancials(financials);

  }, [currentMonth, currentYear]);

  const overviewData = useMemo(() => [
    { name: 'Jan', revenue: Math.random() * 5000 + 1000, expenses: Math.random() * 3000 },
    { name: 'Feb', revenue: Math.random() * 5000 + 1000, expenses: Math.random() * 3000 },
    { name: 'Mar', revenue: Math.random() * 5000 + 1000, expenses: Math.random() * 3000 },
    { name: 'Apr', revenue: Math.random() * 5000 + 1000, expenses: Math.random() * 3000 },
    { name: 'May', revenue: Math.random() * 5000 + 1000, expenses: Math.random() * 3000 },
    { name: 'Jun', revenue: Math.random() * 5000 + 1000, expenses: Math.random() * 3000 },
  ], []);


  if (!isMounted) {
    return <div className="flex justify-center items-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;
  }

  return (
    <div className="animate-fadeIn">
      <PageHeader title="Admin Dashboard" icon={LayoutDashboard} description="Overview of your rental properties and finances." />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 mb-8"> {/* Adjusted for 3 cards */}
        <StatCard title="Occupied Spaces" value={`${stats.occupiedSpaces} / ${stats.totalSpaces}`} icon={Building2} description={`${stats.occupancyRate} occupancy rate.`} />
        <StatCard title="Active Agreements" value={String(stats.activeAgreements)} icon={FileText} description="Currently active leases." />
        <StatCard title="Revenue (This Month)" value={stats.totalRevenueMTD} icon={DollarSign} description="Collected from 'Paid' bills." />
      </div>
      
      <div className="mb-10">
        <h2 className="text-2xl font-headline font-semibold mb-4 text-foreground">Building Financials ({periodDescription})</h2>
        {buildingFinancials.length === 0 ? (
            <Card>
                <CardContent className="pt-6 text-center text-muted-foreground">
                    <AlertCircle className="mx-auto h-10 w-10 mb-2" />
                    No building financial data to display for the current period. Ensure buildings, utilities, and bills are set up.
                </CardContent>
            </Card>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {buildingFinancials.map(summary => (
                <BuildingFinancialCard
                key={summary.buildingId}
                buildingName={summary.buildingName}
                currentMonthExpenses={summary.currentMonthExpenses}
                currentMonthIncomeCollected={summary.currentMonthIncomeCollected}
                currentMonthIncomePendingConfirmation={summary.currentMonthIncomePendingConfirmation}
                currentMonthIncomeToBeCollected={summary.currentMonthIncomeToBeCollected}
                periodDescription={periodDescription}
                />
            ))}
            </div>
        )}
      </div>


      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="font-headline text-xl">Monthly Revenue Overview (Sample)</CardTitle>
          </CardHeader>
          <CardContent className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={overviewData}>
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value/1000}k`} />
                <Tooltip
                  contentStyle={{ backgroundColor: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: "var(--radius)"}}
                  labelStyle={{ color: "hsl(var(--foreground))", fontWeight: "bold" }}
                  formatter={(value: number) => `$${value.toLocaleString()}`}
                />
                <Legend wrapperStyle={{fontSize: "12px"}} />
                <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Revenue" />
                <Bar dataKey="expenses" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} name="Expenses (Projected)" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="font-headline text-xl">Recent Activity (Sample)</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {[
                {user: "John Doe", action: "signed a new lease for Unit 10A.", time: "2 hours ago", avatar: "JD"},
                {user: "System", action: "marked payment received for Unit 5B.", time: "5 hours ago", avatar: "S"},
                {user: "Jane Smith", action: "agreement generated for Unit 22C.", time: "1 day ago", avatar: "JS"},
                {user: "System", action: "sent late payment reminder for Unit 18D.", time: "2 days ago", avatar: "S"},
              ].map((activity, index) => (
                <li key={index} className="flex items-start gap-3 p-3 rounded-md hover:bg-secondary/50 transition-colors">
                   <Avatar className="h-9 w-9 mt-0.5">
                    <AvatarImage src={`https://placehold.co/40x40.png?text=${activity.avatar}`} data-ai-hint="user initial" />
                    <AvatarFallback>{activity.avatar}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm text-foreground">
                      <span className="font-semibold">{activity.user}</span> {activity.action}
                    </p>
                    <p className="text-xs text-muted-foreground">{activity.time}</p>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
