"use client";

import { PageHeader } from '@/components/custom/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, Users, FileText, DollarSign, LayoutDashboard } from 'lucide-react';
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const StatCard = ({ title, value, icon: Icon, description, trend }: { title: string, value: string, icon: React.ElementType, description?: string, trend?: string }) => (
  <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      <Icon className="h-5 w-5 text-primary" />
    </CardHeader>
    <CardContent>
      <div className="text-3xl font-bold font-headline text-foreground">{value}</div>
      {description && <p className="text-xs text-muted-foreground pt-1">{description}</p>}
      {trend && <p className="text-xs text-green-500 pt-1">{trend}</p>}
    </CardContent>
  </Card>
);

const overviewData = [
  { name: 'Jan', revenue: 4000, expenses: 2400 },
  { name: 'Feb', revenue: 3000, expenses: 1398 },
  { name: 'Mar', revenue: 5000, expenses: 6800 },
  { name: 'Apr', revenue: 2780, expenses: 3908 },
  { name: 'May', revenue: 1890, expenses: 4800 },
  { name: 'Jun', revenue: 2390, expenses: 3800 },
];


export default function AdminDashboardPage() {
  // Mock data
  const stats = {
    totalSpaces: 120,
    occupiedSpaces: 85,
    totalTenants: 85,
    upcomingPayments: 15,
    occupancyRate: ((85 / 120) * 100).toFixed(1) + '%',
    totalRevenueMTD: '$45,231.89',
  };

  return (
    <div className="animate-fadeIn">
      <PageHeader title="Admin Dashboard" icon={LayoutDashboard} description="Overview of your rental properties and finances." />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 mb-8">
        <StatCard title="Total Spaces" value={String(stats.totalSpaces)} icon={Building2} description="All manageable spaces." />
        <StatCard title="Occupied Spaces" value={String(stats.occupiedSpaces)} icon={Users} description={`${stats.occupancyRate} occupancy rate.`} />
        <StatCard title="Active Tenants" value={String(stats.totalTenants)} icon={FileText} description="Currently active leases." />
        <StatCard title="Total Revenue (MTD)" value={stats.totalRevenueMTD} icon={DollarSign} trend="+20.1% from last month" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="font-headline text-xl">Revenue Overview</CardTitle>
          </CardHeader>
          <CardContent className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={overviewData}>
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} />
                <Tooltip
                  contentStyle={{ backgroundColor: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: "var(--radius)"}}
                  labelStyle={{ color: "hsl(var(--foreground))", fontWeight: "bold" }}
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
            <CardTitle className="font-headline text-xl">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {[
                {user: "John Doe", action: "signed a new lease for Unit 10A.", time: "2 hours ago"},
                {user: "Maintenance Bot", action: "marked payment received for Unit 5B.", time: "5 hours ago"},
                {user: "Jane Smith", action: "agreement generated for Unit 22C.", time: "1 day ago"},
                {user: "Property Bot", action: "sent late payment reminder for Unit 18D.", time: "2 days ago"},
              ].map((activity, index) => (
                <li key={index} className="flex items-start gap-3 p-3 rounded-md hover:bg-secondary transition-colors">
                   <Avatar className="h-9 w-9 mt-0.5">
                    <AvatarImage src={`https://placehold.co/40x40.png?text=${activity.user.substring(0,1)}`} data-ai-hint="user initial" />
                    <AvatarFallback>{activity.user.substring(0,1)}</AvatarFallback>
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

// Add basic fade-in animation to globals.css or here as a style
// For globals.css:
// @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
// .animate-fadeIn { animation: fadeIn 0.5s ease-out forwards; }
// For simplicity, using inline style here if globals.css is not modified for this.
// However, it's better practice to put animations in CSS files.
// For this exercise, assuming a CSS class like 'animate-fadeIn' exists or we rely on Tailwind for transitions.
// The above 'animate-fadeIn' class is a suggestion for smooth page load.
