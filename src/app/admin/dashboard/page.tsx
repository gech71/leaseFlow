
"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { PageHeader } from '@/components/custom/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Building, Building2, FileText, Banknote, LayoutGrid, AlertCircle, User, Loader2 } from 'lucide-react';
import { BuildingFinancialCard } from '@/components/custom/BuildingFinancialCard';
import { DashboardChart } from '@/components/custom/DashboardChart';
import { getMonth, getYear, format, isAfter, addMonths, subMonths, isValid, parseISO } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { OccupancyCard } from '@/components/custom/OccupancyCard';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { getDashboardDataAction, type DashboardData, type ClientAgreement, type ClientBill, type ClientUtility, type ClientBuilding, type ClientSpace } from './actions';
import { usePermissions } from '@/contexts/PermissionContext';
import { useRouter } from 'next/navigation';
import Image from 'next/image';


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


export default function AdminDashboardPage() {
    const { currentUser, isLoading: isUserLoading } = usePermissions();
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [today, setToday] = useState(new Date());

    // State for all fetched data
    const [allData, setAllData] = useState<Omit<DashboardData, 'error'>>({
        buildings: [],
        spaces: [],
        agreements: [],
        allBills: [],
        allUtilities: [],
    });

    // State for filters
    const [selectedYear, setSelectedYear] = useState(getYear(today));
    const [selectedMonth, setSelectedMonth] = useState(getMonth(today));

    useEffect(() => {
        if (!isUserLoading && currentUser && currentUser.roles) {
            const isTenantOnly = currentUser.roles.length === 1 && currentUser.roles[0].name === 'TENANT';
            if (isTenantOnly) {
                router.replace('/portal/dashboard');
                return;
            }
        }

        const fetchData = async () => {
            setIsLoading(true);
            try {
                const data = await getDashboardDataAction();
                if (data.error) {
                    setError(data.error);
                } else {
                    setAllData({
                        buildings: data.buildings,
                        spaces: data.spaces,
                        agreements: data.agreements,
                        allBills: data.allBills,
                        allUtilities: data.allUtilities,
                    });
                }
            } catch (e) {
                setError((e as Error).message);
            }
            setIsLoading(false);
        };

        if (!isUserLoading) {
            fetchData();
        }
    }, [isUserLoading, currentUser, router]);

    const periodDescription = format(new Date(selectedYear, selectedMonth), "MMMM yyyy");

    const filteredData = useMemo(() => {
        const activeAgreements = allData.agreements.filter(ag => {
            const agreementEndDate = addMonths(parseISO(ag.startDate), ag.paymentTermMonths);
            return isAfter(agreementEndDate, today);
        });
        const uniqueActiveTenantIds = new Set(activeAgreements.map(ag => ag.tenantId));

        const paidBillsThisPeriod = allData.allBills.filter(bill =>
            bill.status === 'Paid' && bill.paymentDate &&
            getYear(parseISO(bill.paymentDate)) === selectedYear &&
            getMonth(parseISO(bill.paymentDate)) === selectedMonth
        );
        const totalRevenueThisPeriod = paidBillsThisPeriod.reduce((sum, bill) => sum + bill.totalAmount, 0);

        const stats = {
            totalBuildings: allData.buildings.length,
            totalSpaces: allData.spaces.length,
            totalTenants: uniqueActiveTenantIds.size,
            totalRevenueThisPeriod: `${totalRevenueThisPeriod.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Birr`,
            activeAgreements: activeAgreements.length,
        };

        const financials: BuildingFinancialSummary[] = allData.buildings.map(building => {
            const buildingUtil = allData.allUtilities.find(u => u.buildingId === building.id && u.year === selectedYear && u.month === selectedMonth);
            const expenses = buildingUtil ? buildingUtil.totalCost : 0;
            
            const spacesInThisBuildingIds = allData.spaces.filter(s => s.buildingId === building.id).map(s => s.id);
            const agreementIdsInBuilding = allData.agreements.filter(ag => ag.spaceId && spacesInThisBuildingIds.includes(ag.spaceId)).map(ag => ag.id);

            const billsForBuildingThisPeriod = allData.allBills.filter(bill =>
                agreementIdsInBuilding.includes(bill.agreementId) &&
                getYear(parseISO(bill.billDate)) === selectedYear &&
                getMonth(parseISO(bill.billDate)) === selectedMonth
            );

            const incomeCollected = billsForBuildingThisPeriod.filter(b => b.status === 'Paid').reduce((sum, b) => sum + b.totalAmount, 0);
            const incomePendingConfirmation = billsForBuildingThisPeriod.filter(b => b.status === 'PendingVerification').reduce((sum, b) => sum + b.totalAmount, 0);
            const incomeToBeCollected = billsForBuildingThisPeriod.filter(b => b.status === 'Pending' || b.status === 'Overdue').reduce((sum, b) => sum + b.totalAmount, 0);

            return {
                buildingId: building.id,
                buildingName: building.name,
                currentMonthExpenses: expenses,
                currentMonthIncomeCollected: incomeCollected,
                currentMonthIncomePendingConfirmation: incomePendingConfirmation,
                currentMonthIncomeToBeCollected: incomeToBeCollected,
            };
        });

        return { stats, financials };

    }, [allData, selectedYear, selectedMonth, today]);

    const chartData = useMemo(() => {
        const data = [];
        const allPaidBills = allData.allBills.filter(bill => bill.status === 'Paid');

        for (let i = 5; i >= 0; i--) {
            const date = subMonths(new Date(selectedYear, selectedMonth), i);
            const monthName = format(date, 'MMM');
            const year = getYear(date);
            const month = getMonth(date);

            const monthlyRevenue = allPaidBills.filter(bill => {
                if (!bill.paymentDate) return false;
                const paymentDate = parseISO(bill.paymentDate);
                return getYear(paymentDate) === year && getMonth(paymentDate) === month;
            }).reduce((sum, bill) => sum + bill.totalAmount, 0);

            const monthlyExpenses = allData.allUtilities.filter(util => util.year === year && util.month === month)
                                   .reduce((sum, util) => sum + util.totalCost, 0);

            data.push({
                name: monthName,
                revenue: parseFloat(monthlyRevenue.toFixed(2)),
                expenses: parseFloat(monthlyExpenses.toFixed(2)),
            });
        }
        return data;
    }, [allData, selectedYear, selectedMonth]);

    const recentActivities = useMemo(() => {
        return [...allData.allBills] // Create a mutable copy
            .sort((a, b) => parseISO(b.billDate).getTime() - parseISO(a.billDate).getTime())
            .slice(0, 5)
            .map(bill => {
                const agreement = allData.agreements.find(ag => ag.id === bill.agreementId);
                const tenantName = agreement?.tenant?.name || "A tenant";
                const spaceName = agreement?.space?.spaceIdName || "a space";
                let actionText = "";
                let billDueDateFormatted = format(parseISO(bill.billDate), 'PP');

                switch(bill.status) {
                    case "Paid": actionText = `paid bill for ${spaceName}.`; break;
                    case "Pending": actionText = `Bill generated for ${tenantName} for ${spaceName}, due ${billDueDateFormatted}.`; break;
                    case "Overdue": actionText = `Bill for ${tenantName} (${spaceName}) is overdue since ${billDueDateFormatted}.`; break;
                    case "PendingVerification": actionText = `${tenantName} submitted payment proof for ${spaceName}.`; break;
                    default: actionText = `Activity related to bill ID ${bill.agreementId} for ${tenantName}.`;
                }

                return {
                    user: bill.status === "PendingVerification" ? tenantName : "System",
                    action: actionText,
                    time: format(parseISO(bill.billDate), 'PPp'),
                    avatar: tenantName.substring(0,2).toUpperCase()
                }
            });
    }, [allData]);
    
    const availableYears = useMemo(() => {
        const years = new Set(allData.allBills.map(b => getYear(parseISO(b.billDate))));
        if (years.size === 0) return [getYear(new Date())];
        return Array.from(years).sort((a,b) => b - a);
    }, [allData.allBills]);

    if (isLoading || isUserLoading) {
      return (
        <div className="flex justify-center items-center h-screen">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      );
    }
    
    if (error) {
      return (
        <div className="animate-fadeIn">
          <PageHeader title="Admin Dashboard" icon={LayoutGrid} description="Overview of your rental properties and finances." />
          <Card>
            <CardHeader><CardTitle className="text-destructive flex items-center gap-2"><AlertCircle /> Error Loading Dashboard</CardTitle></CardHeader>
            <CardContent>
                <p>{error}</p>
                <p className="mt-2 text-sm text-muted-foreground">Please try refreshing the page or contact support if the issue persists.</p>
            </CardContent>
          </Card>
        </div>
      )
    }

  return (
    <div className="animate-fadeIn">
      <PageHeader title="Admin Dashboard" icon={LayoutGrid} description="Overview of your rental properties and finances." />

      <div className="grid gap-4 md:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 mb-8">
        <StatCard title="Total Buildings" value={String(filteredData.stats.totalBuildings)} icon={Building} description="Number of managed buildings." />
        <OccupancyCard 
          spaces={allData.spaces} 
          buildings={allData.buildings}
        />
        <StatCard title="Active Tenants" value={String(filteredData.stats.totalTenants)} icon={User} description="Currently active tenants." />
        <StatCard title="Active Agreements" value={String(filteredData.stats.activeAgreements)} icon={FileText} description="Currently active leases." />
        <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300 flex flex-col min-h-[140px] sm:col-span-2 lg:col-span-full xl:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Revenue</CardTitle>
            <Banknote className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent className="flex flex-col flex-grow justify-center">
            <div className="text-3xl lg:text-4xl font-bold font-headline text-foreground">{filteredData.stats.totalRevenueThisPeriod}</div>
            <p className="text-xs text-muted-foreground pt-1">{`Collected in ${periodDescription}.`}</p>
            </CardContent>
        </Card>
      </div>
      
       <Card className="mb-10 shadow-sm">
        <CardHeader>
            <CardTitle className="font-headline text-xl">Financial Snapshot</CardTitle>
            <CardDescription>Select a period to view financial summaries and charts for that month.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
                <Label htmlFor="month-select">Month</Label>
                <Select value={String(selectedMonth)} onValueChange={(val) => setSelectedMonth(Number(val))}>
                    <SelectTrigger id="month-select" className="w-full sm:w-[180px]">
                        <SelectValue placeholder="Select Month" />
                    </SelectTrigger>
                    <SelectContent>
                        {Array.from({length: 12}, (_, i) => (
                            <SelectItem key={i} value={String(i)}>{format(new Date(0, i), 'MMMM')}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div className="flex-1">
                <Label htmlFor="year-select">Year</Label>
                <Select value={String(selectedYear)} onValueChange={(val) => setSelectedYear(Number(val))}>
                    <SelectTrigger id="year-select" className="w-full sm:w-[120px]">
                        <SelectValue placeholder="Select Year" />
                    </SelectTrigger>
                    <SelectContent>
                        {availableYears.map(year => (
                            <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        </CardContent>
       </Card>

      <div className="mb-10">
        <h2 className="text-2xl font-headline font-semibold mb-4 text-foreground">Building Financials ({periodDescription})</h2>
        {filteredData.financials.length === 0 ? (
            <Card>
                <CardContent className="pt-6 text-center text-muted-foreground">
                    <AlertCircle className="mx-auto h-10 w-10 mb-2" />
                    No financial data to display for {periodDescription}. 
                    Ensure utilities for this period are entered and bills are generated.
                </CardContent>
            </Card>
        ) : (
          <Carousel opts={{ align: "start" }} className="w-full">
            <CarouselContent className="-ml-1 py-4">
              {filteredData.financials.map(summary => (
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
            <CardTitle className="font-headline text-xl">Monthly Overview (Last 6 Months)</CardTitle>
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
                        <Image src={`https://picsum.photos/seed/${activity.user}/40/40`} alt={activity.user} width={40} height={40} data-ai-hint="user initial" unoptimized />
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
