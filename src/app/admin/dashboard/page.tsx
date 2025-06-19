import { PageHeader } from '@/components/custom/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, FileText, DollarSign, LayoutDashboard, AlertCircle } from 'lucide-react';
import { BuildingFinancialCard } from '@/components/custom/BuildingFinancialCard';
import type { Building, Space, Agreement, Bill, BuildingMonthlyUtilities } from '@prisma/client';
import { databaseService } from '@/lib/services/databaseService';
import { getMonth, getYear, parseISO, format, isWithinInterval, endOfMonth, startOfMonth, addMonths, isAfter } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend } from 'recharts';


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

export default async function AdminDashboardPage() {
  const today = new Date();
  const currentMonth = getMonth(today); // 0-11
  const currentYear = getYear(today);
  const periodDescription = format(today, "MMMM yyyy");

  const buildingsPromise = databaseService.getAllBuildings();
  const spacesPromise = databaseService.getAllSpaces();
  const agreementsPromise = databaseService.getAllAgreements({ include: { space: true } });
  const billsPromise = databaseService.getAllBills();
  const buildingUtilitiesPromise = databaseService.getAllBuildingMonthlyUtilities({
    where: { month: currentMonth, year: currentYear },
    include: { utilities: true },
  });

  const [
    buildings,
    spaces,
    allAgreements,
    allBills,
    currentMonthBuildingUtilities,
  ] = await Promise.all([
    buildingsPromise,
    spacesPromise,
    agreementsPromise,
    billsPromise,
    buildingUtilitiesPromise,
  ]);

  const occupiedSpacesCount = spaces.filter(s => s.isOccupied).length;
  const occupancyRateValue = spaces.length > 0 ? (occupiedSpacesCount / spaces.length) * 100 : 0;
  
  const activeAgreements = allAgreements.filter(ag => {
      const agreementEndDate = addMonths(new Date(ag.startDate), ag.paymentTermMonths);
      return isAfter(agreementEndDate, today);
  });
  const uniqueActiveTenantIds = new Set(activeAgreements.map(ag => ag.tenantId));

  const billsInCurrentMonthPeriod = allBills.filter(bill => {
    const billDate = parseISO(bill.billDate.toISOString()); // Ensure billDate is Date object
    return getYear(billDate) === currentYear && getMonth(billDate) === currentMonth;
  });
  
  const paidBillsInCurrentMonth = billsInCurrentMonthPeriod.filter(bill => 
    bill.status === 'Paid' && bill.paymentDate &&
    getYear(parseISO(bill.paymentDate.toISOString())) === currentYear &&
    getMonth(parseISO(bill.paymentDate.toISOString())) === currentMonth
  );
  const totalRevenueMTDValue = paidBillsInCurrentMonth.reduce((sum, bill) => sum + bill.totalAmount, 0);

  const stats = {
    totalSpaces: spaces.length,
    occupiedSpaces: occupiedSpacesCount,
    totalTenants: uniqueActiveTenantIds.size,
    occupancyRate: `${occupancyRateValue.toFixed(1)}%`,
    totalRevenueMTD: `$${totalRevenueMTDValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    activeAgreements: activeAgreements.length,
  };

  const financials: BuildingFinancialSummary[] = buildings.map(building => {
    const buildingUtil = currentMonthBuildingUtilities.find(bu => bu.buildingId === building.id);
    const expenses = buildingUtil ? buildingUtil.utilities.reduce((sum, util) => sum + util.totalCost, 0) : 0;

    const spacesInThisBuilding = spaces.filter(s => s.buildingId === building.id);
    const agreementIdsInBuilding = allAgreements
      .filter(ag => spacesInThisBuilding.some(s => s.id === ag.spaceId))
      .map(ag => ag.id);
    
    const billsForBuildingCurrentMonth = billsInCurrentMonthPeriod.filter(bill => 
      agreementIdsInBuilding.includes(bill.agreementId)
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

  // Mock data for chart, as it's complex to derive historical data without more context
   const overviewData = [
    { name: 'Jan', revenue: Math.random() * 5000 + 1000, expenses: Math.random() * 3000 },
    { name: 'Feb', revenue: Math.random() * 5000 + 1000, expenses: Math.random() * 3000 },
    { name: 'Mar', revenue: Math.random() * 5000 + 1000, expenses: Math.random() * 3000 },
    { name: 'Apr', revenue: Math.random() * 5000 + 1000, expenses: Math.random() * 3000 },
    { name: 'May', revenue: Math.random() * 5000 + 1000, expenses: Math.random() * 3000 },
    { name: 'Jun', revenue: Math.random() * 5000 + 1000, expenses: Math.random() * 3000 },
  ];

  return (
    <div className="animate-fadeIn">
      <PageHeader title="Admin Dashboard" icon={LayoutDashboard} description="Overview of your rental properties and finances." />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 mb-8">
        <StatCard title="Occupied Spaces" value={`${stats.occupiedSpaces} / ${stats.totalSpaces}`} icon={Building2} description={`${stats.occupancyRate} occupancy rate.`} />
        <StatCard title="Active Agreements" value={String(stats.activeAgreements)} icon={FileText} description="Currently active leases." />
        <StatCard title="Revenue (This Month)" value={stats.totalRevenueMTD} icon={DollarSign} description={`Collected in ${periodDescription}.`} />
      </div>
      
      <div className="mb-10">
        <h2 className="text-2xl font-headline font-semibold mb-4 text-foreground">Building Financials ({periodDescription})</h2>
        {financials.length === 0 && buildings.length > 0 && (
            <Card>
                <CardContent className="pt-6 text-center text-muted-foreground">
                    <AlertCircle className="mx-auto h-10 w-10 mb-2" />
                    No building financial data to display for {periodDescription}. Ensure utilities for this period are entered and bills are generated.
                </CardContent>
            </Card>
        )}
         {buildings.length === 0 && (
            <Card>
                <CardContent className="pt-6 text-center text-muted-foreground">
                    <AlertCircle className="mx-auto h-10 w-10 mb-2" />
                   No buildings found. Please add buildings to see financial summaries.
                </CardContent>
            </Card>
        )}
        {financials.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {financials.map(summary => (
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
                    <AvatarImage src={`https://placehold.co/40x40.png?text=${activity.avatar}`} alt={activity.user} data-ai-hint="user initial" />
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