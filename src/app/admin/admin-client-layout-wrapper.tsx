
"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
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
  Banknote,
  LogOut,
  Settings,
  UserCircle,
  Wrench,
  ClipboardList,
  Building,
  ExternalLink,
  Loader2,
  EyeOff,
  Eye,
  LayoutGrid,
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
import { PermissionProvider, usePermissions } from '@/contexts/PermissionContext';
import type { PermissionId } from '@/lib/types';

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  isPortal?: boolean;
  requiredPermissions?: PermissionId[]; 
}

const allNavItems: NavItem[] = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutGrid, requiredPermissions: ['dashboard:view'] },
  { href: '/admin/buildings', label: 'Buildings', icon: Building, requiredPermissions: ['building:view', 'building:create', 'building:edit', 'building:delete'] },
  { href: '/admin/spaces', label: 'Spaces', icon: Building2, requiredPermissions: ['space:view', 'space:create', 'space:edit', 'space:delete'] },
  { href: '/admin/tenants', label: 'Tenants', icon: Users, requiredPermissions: ['tenant:view', 'tenant:create', 'tenant:edit', 'tenant:delete'] },
  { href: '/admin/agreements', label: 'Agreements', icon: FileText, requiredPermissions: ['agreement:view', 'agreement:create', 'agreement:edit', 'agreement:delete'] },
  { href: '/admin/building-utilities', label: 'Building Utilities', icon: Wrench, requiredPermissions: ['building_utility:view', 'building_utility:save'] },
  { href: '/admin/billing', label: 'Billing', icon: Banknote, requiredPermissions: ['billing:view', 'billing:generate', 'billing:manage_payments', 'billing:delete'] },
  { href: '/admin/payments-overview', label: 'Payments Overview', icon: ClipboardList, requiredPermissions: ['payment_overview:view'] },
  { 
    href: '/admin/settings', 
    label: 'Settings', 
    icon: Settings, 
    requiredPermissions: [ 
      'settings:user_registration:manage', 
      'settings:user_management:view', 
      'settings:user_management:assign',
      'settings:role_management:view',
      'settings:role_management:manage',
    ] 
  },
  { href: '/portal/dashboard', label: 'Tenant Portal (View)', icon: ExternalLink, isPortal: true, requiredPermissions: ['portal:view'] }, 
];

function ActualAdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();
  const { isMobile, state: sidebarState } = useSidebar();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  
  const { currentUser, hasAnyPermission, isLoading: permissionsLoading, isSuperAdmin, error: permissionError } = usePermissions();

  useEffect(() => {
    // This effect handles redirection for unauthenticated or unauthorized users.
    if (!permissionsLoading && !currentUser) {
      // Determine the error message. If a specific error was captured (like 404 Not Found), use it.
      // Otherwise, fall back to a generic session expiration message.
      const title = permissionError ? "Access Denied" : "Session Expired";
      const description = permissionError || "Please log in again to continue.";

      toast({
        title: title,
        description: description,
        variant: "destructive", // Use destructive to highlight the error
      });
      router.push('/login');
    }
  }, [permissionsLoading, currentUser, router, toast, permissionError]);

  useEffect(() => {
    if (!permissionsLoading && currentUser?.effectivePermissions) {
      const permissions = currentUser.effectivePermissions;
      if (permissions.length === 1 && permissions[0] === 'portal:view') {
        router.push('/portal/dashboard');
      }
    }
  }, [permissionsLoading, currentUser, router]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      const response = await fetch('/api/Auth/logout', {
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
      router.push('/login');
      setIsLoggingOut(false);
    }
  };
  
  const navItems = React.useMemo(() => {
    if (permissionsLoading || !currentUser) return [];
    
    return allNavItems.filter(item => {
      if (isSuperAdmin) return true; 
      if (!item.requiredPermissions || item.requiredPermissions.length === 0) return true;
      
      return hasAnyPermission(item.requiredPermissions); 
    });
  }, [currentUser, permissionsLoading, hasAnyPermission, isSuperAdmin]);


  // Show a loader while permissions are loading OR if there's no user (as we are about to redirect).
  // This prevents a flash of a broken/unauthorized UI.
  if (permissionsLoading || !currentUser) {
     return (
      <div className="flex justify-center items-center h-screen w-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }


  return (
    <>
      <Sidebar collapsible="icon" side="left" variant="sidebar">
        <SidebarHeader className="p-4 border-b border-sidebar-border">
          <div className="flex items-center justify-between">
            <AppLogo />
            {/* This trigger is for mobile, and for desktop when expanded */}
            <SidebarTrigger className="md:group-data-[state=collapsed]/sidebar-wrapper:hidden" />
          </div>
        </SidebarHeader>
        <SidebarContent className="p-2">
          <SidebarMenu>
            {navItems.map((item) => {
              const isActive = pathname === item.href || (item.href !== '/admin/dashboard' && !item.isPortal && pathname.startsWith(item.href));
              
              const sidebarButtonContent = (
                <>
                  <item.icon className="h-5 w-5 shrink-0" />
                  <span
                    className={cn(
                      "flex-1 min-w-0 text-base",
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
                  "h-10",
                  item.isPortal && 'mt-auto border-t border-sidebar-border pt-2'
                ),
                size: 'default' as const,
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
              <Button variant="ghost" className="flex items-center group-data-[state=expanded]/sidebar-wrapper:justify-start group-data-[state=collapsed]/sidebar-wrapper:justify-center gap-2 w-full p-2 h-auto text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
                <Avatar className="h-8 w-8">
                  <AvatarImage src="https://placehold.co/100x100.png" alt={currentUser?.name || "User"} data-ai-hint="user avatar"/>
                  <AvatarFallback>{currentUser?.name?.substring(0,2).toUpperCase() || 'AU'}</AvatarFallback>
                </Avatar>
                <div className={cn("text-left", "group-data-[state=collapsed]/sidebar-wrapper:hidden")}>
                  <p className="text-sm font-medium">{currentUser?.name || "User"}</p>
                  <p className="text-xs text-sidebar-foreground/70">{currentUser?.email || "user@example.com"}</p>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-56">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => router.push('/admin/profile')}>
                <UserCircle className="mr-2 h-4 w-4" />
                <span>Profile</span>
              </DropdownMenuItem>
              {hasAnyPermission(['settings:user_registration:manage', 'settings:user_management:view', 'settings:user_management:assign', 'settings:role_management:view', 'settings:role_management:manage']) && ( 
                <DropdownMenuItem onSelect={() => router.push('/admin/settings')}>
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Settings</span>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={handleLogout} disabled={isLoggingOut}>
                {isLoggingOut ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogOut className="mr-2 h-4 w-4" />}
                <span>{isLoggingOut ? 'Logging out...' : 'Log out'}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarFooter>
      </Sidebar>
      <main className="flex flex-1 flex-col transition-[margin-left] duration-300 ease-in-out md:ml-[var(--sidebar-width-icon)] group-data-[state=expanded]:md:ml-[var(--sidebar-width)]">
        <header className="flex h-[3.7rem] shrink-0 items-center border-b bg-background px-4 sm:px-6 lg:px-8">
          {/* This trigger is for mobile view */}
          <SidebarTrigger className="md:hidden" />
          {/* This trigger is for desktop only, and only when collapsed */}
          <SidebarTrigger className="hidden md:group-data-[state=collapsed]/sidebar-wrapper:flex" />
        </header>
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
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
    return (
      <div className="flex justify-center items-center h-screen w-screen">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <PermissionProvider>
      <SidebarProvider defaultOpen>
        <TooltipProvider>
          <ActualAdminLayout>{children}</ActualAdminLayout>
        </TooltipProvider>
      </SidebarProvider>
    </PermissionProvider>
  );
}
