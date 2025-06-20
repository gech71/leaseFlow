
"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation'; // Added useRouter
import React, { useState, useEffect } from 'react';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import { AppLogo } from '@/components/custom/AppLogo';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard,
  Building2,
  Users,
  FileText,
  DollarSign,
  LogOut,
  Settings,
  UserCircle,
  Wrench,
  ClipboardList,
  Building,
  ExternalLink,
  Loader2, 
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

const navItems = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/buildings', label: 'Buildings', icon: Building },
  { href: '/admin/spaces', label: 'Spaces', icon: Building2 },
  { href: '/admin/tenants', label: 'Tenants', icon: Users },
  { href: '/admin/agreements', label: 'Agreements', icon: FileText },
  { href: '/admin/building-utilities', label: 'Building Utilities', icon: Wrench },
  { href: '/admin/billing', label: 'Billing', icon: DollarSign },
  { href: '/admin/payments-overview', label: 'Payments Overview', icon: ClipboardList },
  { href: '/admin/settings', label: 'Settings', icon: Settings }, // New Settings Link
  { href: '/portal/dashboard', label: 'Tenant Portal (View)', icon: ExternalLink, isPortal: true },
];

function ActualAdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();
  const { isMobile, state: sidebarState } = useSidebar();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  // Client-side role check could be added here if token was accessible and decodable client-side
  // For HttpOnly, this state would likely come from a context populated after login/session check
  const [userRole, setUserRole] = useState<string | null>(null); // Example: 'Admin', 'SUPPORT_STAFF'

  useEffect(() => {
    // In a real app, fetch user role from a secure endpoint or decode from a context
    // For prototype, we can simulate or leave it as null (meaning all items visible)
    // e.g., fetch('/api/user/me').then(res => res.json()).then(data => setUserRole(data.role));
    // For now, all links are visible and security is at API/page level.
  }, []);


  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
      });
      const data = await response.json();

      if (response.ok && data.isSuccess) {
        toast({
            title: "Logged Out",
            description: "You have been successfully logged out.",
        });
      } else {
        toast({
            title: "Logout Issue",
            description: data.errors?.join(', ') || "Could not fully complete server logout. Local session cleared.",
            variant: "default", 
        });
      }
    } catch (error) {
      console.error("Logout API call error:", error);
      toast({
          title: "Logout Error",
          description: "Could not connect to the logout service. Cleared local session.",
          variant: "default"
      });
    } finally {
      router.push('/auth/login');
      setIsLoggingOut(false);
    }
  };
  
  const displayedNavItems = navItems.filter(item => {
    // Example of role-based link visibility if userRole was available
    // if (item.href === '/admin/settings' && userRole !== 'Admin') { // Assuming "Admin" is SUPER_ADMIN role
    //   return false;
    // }
    return true;
  });


  return (
    <>
      <Sidebar collapsible="icon" side="left" variant="sidebar">
        <SidebarHeader className="p-4 border-b border-sidebar-border">
          <div className="flex items-center justify-between">
            <AppLogo />
            <div className="md:hidden">
              <SidebarTrigger />
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent className="p-2">
          <SidebarMenu>
            {displayedNavItems.map((item) => {
              const isActive = pathname === item.href || (item.href !== '/admin/dashboard' && !item.isPortal && pathname.startsWith(item.href));
              
              const sidebarButtonContent = (
                <>
                  <item.icon />
                  <span
                    className={cn(
                      "flex-1 min-w-0",
                      (!isMobile && sidebarState === "collapsed") ? "hidden" : "truncate"
                    )}
                  >
                    {item.label}
                  </span>
                </>
              );

              const commonLinkProps = {
                href: item.href,
                target: item.isPortal ? '_blank' : undefined,
                rel: item.isPortal ? 'noopener noreferrer' : undefined,
              };
              
              const sidebarMenuButtonProps = {
                isActive: isActive,
                className: cn(
                  item.isPortal && 'mt-auto border-t border-sidebar-border pt-2'
                ),
              };

              if (!isMobile && sidebarState === "collapsed") {
                return (
                  <SidebarMenuItem key={item.href}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Link {...commonLinkProps}>
                           <SidebarMenuButton {...sidebarMenuButtonProps}>
                            {sidebarButtonContent}
                           </SidebarMenuButton>
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="font-headline">
                        {item.label}
                      </TooltipContent>
                    </Tooltip>
                  </SidebarMenuItem>
                );
              }
              return (
                <SidebarMenuItem key={item.href}>
                  <Link {...commonLinkProps}>
                     <SidebarMenuButton {...sidebarMenuButtonProps}>
                       {sidebarButtonContent}
                     </SidebarMenuButton>
                  </Link>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter className="p-4 border-t border-sidebar-border">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center justify-start gap-2 w-full p-2 h-auto text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
                <Avatar className="h-8 w-8">
                  <AvatarImage src="https://placehold.co/100x100.png" alt="Admin User" data-ai-hint="user avatar"/>
                  <AvatarFallback>AU</AvatarFallback>
                </Avatar>
                <div className={cn("text-left", (!isMobile && sidebarState === "collapsed") ? "hidden" : "")}>
                  <p className="text-sm font-medium">Admin User</p> {/* Replace with dynamic user name */}
                  <p className="text-xs text-sidebar-foreground/70">admin@leaseflow.com</p> {/* Replace with dynamic user email */}
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-56">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <UserCircle className="mr-2 h-4 w-4" />
                <span>Profile</span>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => router.push('/admin/settings')}>
                <Settings className="mr-2 h-4 w-4" />
                <span>Settings</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={handleLogout} disabled={isLoggingOut}>
                {isLoggingOut ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogOut className="mr-2 h-4 w-4" />}
                <span>{isLoggingOut ? 'Logging out...' : 'Log out'}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarFooter>
      </Sidebar>
      <main className="flex-1 md:ml-[var(--sidebar-width-icon)] group-data-[state=expanded]:md:ml-[var(--sidebar-width)] transition-[margin-left] duration-200 ease-linear">
        <div className="p-4 sm:p-6 lg:p-8">
          <div className="md:flex items-center justify-start mb-6 h-[3.7rem]">
            <SidebarTrigger /> 
          </div>
          {children}
        </div>
      </main>
    </>
  );
}

export default function AdminClientLayoutWrapper({ children }: { children: React.ReactNode }) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    // Optional: render a basic skeleton or loader if full layout flash is an issue
    return null; 
  }

  return (
    <SidebarProvider defaultOpen> {/* `defaultOpen` controls initial state on desktop */}
      <TooltipProvider>
        <ActualAdminLayout>{children}</ActualAdminLayout>
      </TooltipProvider>
    </SidebarProvider>
  );
}
