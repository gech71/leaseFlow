
export const dynamic = 'force-dynamic';

import { PageHeader } from '@/components/custom/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building, Building2, FileText, Banknote, LayoutGrid, AlertCircle, User } from 'lucide-react';
import { BuildingFinancialCard } from '@/components/custom/BuildingFinancialCard';
import { DashboardChart } from '@/components/custom/DashboardChart';
import { databaseService } from '@/lib/services/databaseService';
import { getMonth, getYear, format, isAfter, addMonths, subMonths, isValid } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cookies } from 'next/headers';
import type { User as UserPrisma, Role, Prisma } from '@prisma/client';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { OccupancyCard } from '@/components/custom/OccupancyCard';

const StatCard = ({ title, value, icon: Icon, description, trend, trendColor }: { title: string, value: string, icon: React.ElementType, description?: string, trend?: string, trendColor?: string }) => (
  <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300 flex flex-col min-h-[140px]">
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      <Icon className="h-5 w-5 text-primary" />
    </CardHeader>
    <CardContent className="flex flex-col flex-grow justify-center">
      <div className="text-3xl lg:text-4xl font-bold font-headline text-foreground">{value}</div>
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
    const cookieStore = await cookies();
    const ACCESS_TOKEN_KEY = 'leaseflow_admin_access_token';
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
  const allBillsPromise = databaseService.getAllBills({ where: billWhere, include: { agreement: { include: { tenant: true, space: true } } } }); // Renamed to reflect all bills
  const currentMonthBuildingUtilitiesPromise = databaseService.getAllBuildingMonthlyUtilities({
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
    allBillsPromise,
    currentMonthBuildingUtilitiesPromise,
  ]);

  const totalBuildingsCount = buildings.length;
  
  const activeAgreements = allAgreements.filter(ag => {
      const agreementEndDate = addMonths(ag.startDate, ag.paymentTermMonths);
      return isAfter(agreementEndDate, today);
  });
  const uniqueActiveTenantIds = new Set(activeAgreements.map(ag => ag.tenantId));

  const paidBillsInCurrentMonth = allBills.filter(bill => 
    bill.status === 'Paid' && bill.paymentDate &&
    getYear(bill.paymentDate) === currentYear &&
    getMonth(bill.paymentDate) === currentMonth
  );
  const totalRevenueMTDValue = paidBillsInCurrentMonth.reduce((sum, bill) => sum + bill.totalAmount, 0);

  const stats = {
    totalBuildings: totalBuildingsCount,
    totalSpaces: spaces.length,
    totalTenants: uniqueActiveTenantIds.size,
    totalRevenueMTD: `${totalRevenueMTDValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Birr`,
    activeAgreements: activeAgreements.length,
  };

  const financials: BuildingFinancialSummary[] = buildings.map(building => {
    const buildingUtil = currentMonthBuildingUtilities.find(bu => bu.buildingId === building.id);
    const expenses = buildingUtil ? buildingUtil.utilities.reduce((sum, util) => sum + util.totalCost, 0) : 0;

    const spacesInThisBuildingIds = spaces.filter(s => s.buildingId === building.id).map(s => s.id);
    
    const agreementIdsInBuilding = allAgreements
      .filter(ag => ag.spaceId && spacesInThisBuildingIds.includes(ag.spaceId))
      .map(ag => ag.id);
    
    // Correctly filter for bills generated in the current month for this building
    const billsForBuildingCurrentMonth = allBills.filter(bill => 
      agreementIdsInBuilding.includes(bill.agreementId) &&
      getYear(bill.billDate) === currentYear &&
      getMonth(bill.billDate) === currentMonth
    );
    
    const incomeCollected = billsForBuildingCurrentMonth
      .filter(b => b.status === 'Paid')
      .reduce((sum, b) => sum + b.totalAmount, 0);
    const incomePendingConfirmation = billsForBuildingCurrentMonth
      .filter(b => b.status === 'PendingVerification')
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

  // --- Chart Data Calculation (Last 6 Months) ---
  const chartData = [];
  const allPaidBills = allBills.filter(bill => bill.status === 'Paid');
  const allUtilities = await databaseService.getAllBuildingMonthlyUtilities({
    where: managedBuildingIds ? { buildingId: { in: managedBuildingIds } } : {},
    include: { utilities: true }
  });

  for (let i = 5; i >= 0; i--) {
    const date = subMonths(today, i);
    const monthName = format(date, 'MMM'); // 'Jan', 'Feb', etc.
    const year = getYear(date);
    const month = getMonth(date);

    const monthlyRevenue = allPaidBills
      .filter(bill => {
        if (!bill.paymentDate) return false;
        const paymentDate = bill.paymentDate;
        return getYear(paymentDate) === year && getMonth(paymentDate) === month;
      })
      .reduce((sum, bill) => sum + bill.totalAmount, 0);

    const monthlyExpenses = allUtilities
      .filter(util => util.year === year && util.month === month)
      .reduce((sum, util) => sum + util.utilities.reduce((utilSum, item) => utilSum + item.totalCost, 0), 0);

    chartData.push({
      name: monthName,
      revenue: parseFloat(monthlyRevenue.toFixed(2)),
      expenses: parseFloat(monthlyExpenses.toFixed(2)),
    });
  }
  
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
                actionText = `paid bill for ${spaceName}.`;
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
      <PageHeader title="Admin Dashboard" icon={LayoutGrid} description="Overview of your rental properties and finances." />

      <div className="grid gap-4 md:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 mb-8">
        <StatCard title="Total Buildings" value={String(stats.totalBuildings)} icon={Building} description="Number of managed buildings." />
        <OccupancyCard 
          spaces={spaces.map(s => ({id: s.id, buildingId: s.buildingId, isOccupied: s.isOccupied, area: s.area}))} 
          buildings={buildings.map(b => ({id: b.id, name: b.name}))}
        />
        <StatCard title="Active Tenants" value={String(stats.totalTenants)} icon={User} description="Currently active tenants." />
        <StatCard title="Active Agreements" value={String(stats.activeAgreements)} icon={FileText} description="Currently active leases." />
        <StatCard title="Revenue (This Month)" value={stats.totalRevenueMTD} icon={Banknote} description={`Collected in ${periodDescription}.`} />
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
          <Carousel
            opts={{
              align: "start",
            }}
            className="w-full"
          >
            <CarouselContent className="-ml-1 py-4">
              {financials.map(summary => (
                <CarouselItem key={summary.buildingId} className="pl-4 md:basis-1/2 lg:basis-1/3">
                  <BuildingFinancialCard
                    buildingName={summary.buildingName}
                    currentMonthExpenses={summary.currentMonthExpenses}
                    currentMonthIncomeCollected={summary.currentMonthIncomeCollected}
                    currentMonthIncomePendingConfirmation={summary.currentMonthIncomePendingConfirmation}
                    currentMonthIncomeToBeCollected={summary.currentMonthIncomeToBeCollected}
                    periodDescription={periodDescription}
                  />
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious className="hidden sm:flex" />
            <CarouselNext className="hidden sm:flex" />
          </Carousel>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="font-headline text-xl">Monthly Overview</CardTitle>
          </CardHeader>
          <CardContent className="h-[350px] p-2 sm:p-6">
            <DashboardChart data={chartData} />
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
