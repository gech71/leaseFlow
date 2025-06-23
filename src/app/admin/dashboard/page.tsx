
import { PageHeader } from '@/components/custom/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, FileText, DollarSign, LayoutDashboard, AlertCircle, User } from 'lucide-react';
import { BuildingFinancialCard } from '@/components/custom/BuildingFinancialCard';
import { DashboardChart } from '@/components/custom/DashboardChart'; // Import the new chart component
import { databaseService } from '@/lib/services/databaseService';
import { getMonth, getYear, format, isAfter, addMonths, startOfMonth, endOfMonth, isValid } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cookies } from 'next/headers';
import type { User as UserPrisma, Role, Prisma } from '@prisma/client';

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

// Insecure JWT payload decoder
function decodeJwtPayload(token: string): any | null {
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(function (c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        })
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    console.error('Failed to decode JWT payload:', e);
    return null;
  }
}

// Gets current user from cookie
async function getCurrentUser(): Promise<(UserPrisma & { roles: Role[] }) | null> {
    const ACCESS_TOKEN_KEY = 'leaseflow_access_token';
    const cookieStore = cookies();
    const accessToken = cookieStore.get(ACCESS_TOKEN_KEY)?.value;
    if (!accessToken) return null;
    
    const tokenPayload = decodeJwtPayload(accessToken);
    if (!tokenPayload || !tokenPayload.sub) return null;

    return await databaseService.getUserByExternalId(tokenPayload.sub, { roles: true });
}

export default async function AdminDashboardPage() {
  const currentUser = await getCurrentUser();
  const isSuperAdmin = currentUser?.roles.some(role => role.name === 'SUPER_ADMIN') ?? false;
  let managedBuildingIds: string[] | undefined = undefined;

  if (!isSuperAdmin && currentUser) {
      const managedBuildings = await databaseService.getAllBuildings({ where: { managedByUserId: currentUser.userId } });
      managedBuildingIds = managedBuildings.map(b => b.id);
      if (managedBuildingIds.length === 0) {
          managedBuildingIds = ['-1']; // Use a non-existent ID to ensure no results are returned
      }
  }
  
  const buildingWhere = managedBuildingIds ? { id: { in: managedBuildingIds } } : {};
  const spaceWhere = managedBuildingIds ? { buildingId: { in: managedBuildingIds } } : {};
  const agreementWhere = managedBuildingIds ? { space: { buildingId: { in: managedBuildingIds } } } : {};
  const billWhere = managedBuildingIds ? { agreement: { space: { buildingId: { in: managedBuildingIds } } } } : {};

  const today = new Date();
  const currentMonth = getMonth(today);
  const currentYear = getYear(today);
  const periodDescription = format(today, "MMMM yyyy");

  const buildingUtilitiesWhere: Prisma.BuildingMonthlyUtilitiesWhereInput = { month: currentMonth, year: currentYear };
  if(managedBuildingIds) {
      buildingUtilitiesWhere.buildingId = { in: managedBuildingIds };
  }

  const buildingsPromise = databaseService.getAllBuildings({ where: buildingWhere });
  const spacesPromise = databaseService.getAllSpaces({ where: spaceWhere });
  const agreementsPromise = databaseService.getAllAgreements({ where: agreementWhere, include: { space: true, tenant: true } });
  const billsPromise = databaseService.getAllBills({ where: billWhere, include: { agreement: { include: { tenant: true, space: true } } } });
  const buildingUtilitiesPromise = databaseService.getAllBuildingMonthlyUtilities({
    where: buildingUtilitiesWhere,
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

  const totalBuildingsCount = buildings.length;
  const occupiedSpacesCount = spaces.filter(s => s.isOccupied).length;
  const occupancyRateValue = spaces.length > 0 ? (occupiedSpacesCount / spaces.length) * 100 : 0;
  
  const activeAgreements = allAgreements.filter(ag => {
      const agreementEndDate = addMonths(ag.startDate, ag.paymentTermMonths);
      return isAfter(agreementEndDate, today);
  });
  const uniqueActiveTenantIds = new Set(activeAgreements.map(ag => ag.tenantId));

  const billsInCurrentMonthPeriod = allBills.filter(bill => {
    const billDate = bill.billDate;
    return getYear(billDate) === currentYear && getMonth(billDate) === currentMonth;
  });
  
  const paidBillsInCurrentMonth = billsInCurrentMonthPeriod.filter(bill => 
    bill.status === 'Paid' && bill.paymentDate &&
    getYear(bill.paymentDate) === currentYear &&
    getMonth(bill.paymentDate) === currentMonth
  );
  const totalRevenueMTDValue = paidBillsInCurrentMonth.reduce((sum, bill) => sum + bill.totalAmount, 0);

  const stats = {
    totalBuildings: totalBuildingsCount,
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

    const spacesInThisBuildingIds = spaces.filter(s => s.buildingId === building.id).map(s => s.id);
    
    const agreementIdsInBuilding = allAgreements
      .filter(ag => spacesInThisBuildingIds.includes(ag.spaceId))
      .map(ag => ag.id);
    
    const billsForBuildingCurrentMonth = billsInCurrentMonthPeriod.filter(bill => 
      agreementIdsInBuilding.includes(bill.agreementId)
    );
    
    const incomeCollected = billsForBuildingCurrentMonth
      .filter(b => b.status === 'Paid')
      .reduce((sum, b) => sum + b.totalAmount, 0);
    const incomePendingConfirmation = billsForBuildingCurrentMonth
      .filter(b => b.status === 'PendingVerification') // Corrected status check
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

   const overviewData = [
    { name: 'Jan', revenue: Math.random() * 50000 + 10000, expenses: Math.random() * 30000 + 5000 },
    { name: 'Feb', revenue: Math.random() * 50000 + 10000, expenses: Math.random() * 30000 + 5000 },
    { name: 'Mar', revenue: Math.random() * 50000 + 10000, expenses: Math.random() * 30000 + 5000 },
    { name: 'Apr', revenue: Math.random() * 50000 + 10000, expenses: Math.random() * 30000 + 5000 },
    { name: 'May', revenue: Math.random() * 50000 + 10000, expenses: Math.random() * 30000 + 5000 },
    { name: 'Jun', revenue: Math.random() * 50000 + 10000, expenses: Math.random() * 30000 + 5000 },
  ];
  
  const recentActivities = allBills
    .sort((a, b) => {
        const dateA = a.createdAt;
        const dateB = b.createdAt;
        const timeA = dateA && isValid(dateA) ? dateA.getTime() : 0;
        const timeB = dateB && isValid(dateB) ? dateB.getTime() : 0;

        if (isNaN(timeA) && isNaN(timeB)) return 0;
        if (isNaN(timeA)) return 1;
        if (isNaN(timeB)) return -1;
        
        return timeB - timeA;
    })
    .slice(0, 5)
    .map(bill => {
        let actionText = "";
        const tenantName = bill.agreement?.tenant?.name || "A tenant";
        const spaceName = bill.agreement?.space?.spaceIdName || "a space";
        
        let billDueDateFormatted = 'N/A';
        if (bill.dueDate && isValid(bill.dueDate)) {
            billDueDateFormatted = format(bill.dueDate, 'PP');
        } else {
            console.warn(`Dashboard: Invalid dueDate for bill ID ${bill.id}:`, bill.dueDate);
        }

        switch(bill.status) {
            case "Paid":
                actionText = `${tenantName} paid bill for ${spaceName}.`;
                break;
            case "Pending":
                actionText = `Bill generated for ${tenantName} for ${spaceName}, due ${billDueDateFormatted}.`;
                break;
            case "Overdue":
                 actionText = `Bill for ${tenantName} (${spaceName}) is overdue since ${billDueDateFormatted}.`;
                break;
            case "PendingVerification":
                actionText = `${tenantName} submitted payment proof for ${spaceName}.`;
                break;
            default:
                actionText = `Activity related to bill ID ${bill.id} for ${tenantName}.`;
        }
        
        let formattedTime = 'Date N/A';
        if (bill.createdAt && isValid(bill.createdAt)) {
            formattedTime = format(bill.createdAt, 'PPp');
        } else {
            console.warn(`Dashboard: Invalid createdAt for bill ID ${bill.id}:`, bill.createdAt);
        }

        return {
            user: bill.status === "PendingVerification" ? tenantName : "System",
            action: actionText,
            time: formattedTime, 
            avatar: tenantName.substring(0,2).toUpperCase()
        }
    });


  return (
    <div className="animate-fadeIn">
      <PageHeader title="Admin Dashboard" icon={LayoutDashboard} description="Overview of your rental properties and finances." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-8">
        <StatCard title="Total Buildings" value={String(stats.totalBuildings)} icon={Building2} description="Number of managed buildings." />
        <StatCard title="Occupied Spaces" value={`${stats.occupiedSpaces} / ${stats.totalSpaces}`} icon={Building2} description={`${stats.occupancyRate} occupancy rate.`} />
        <StatCard title="Active Tenants" value={String(stats.totalTenants)} icon={User} description="Currently active tenants." />
        <StatCard title="Active Agreements" value={String(stats.activeAgreements)} icon={FileText} description="Currently active leases." />
        <StatCard title="Revenue (This Month)" value={stats.totalRevenueMTD} icon={DollarSign} description={`Collected in ${periodDescription}.`} />
      </div>
      
      <div className="mb-10">
        <h2 className="text-2xl font-headline font-semibold mb-4 text-foreground">Building Financials ({periodDescription})</h2>
        {financials.length === 0 && buildings.length > 0 && (
            <Card>
                <CardContent className="pt-6 text-center text-muted-foreground">
                    <AlertCircle className="mx-auto h-10 w-10 mb-2" />
                    No building financial data to display for {periodDescription}. 
                    Ensure utilities for this period are entered and bills are generated.
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
            <CardTitle className="font-headline text-xl">Monthly Overview (Sample Data)</CardTitle>
          </CardHeader>
          <CardContent className="h-[350px]">
            <DashboardChart data={overviewData} />
          </CardContent>
        </Card>
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="font-headline text-xl">Recent Activities</CardTitle>
          </CardHeader>
          <CardContent>
            {recentActivities.length === 0 ? (
                 <p className="text-sm text-muted-foreground">No recent activities to display.</p>
            ) : (
                <ul className="space-y-3">
                {recentActivities.map((activity, index) => (
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
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
