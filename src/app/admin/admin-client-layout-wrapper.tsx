
"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
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

const navItems = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/buildings', label: 'Buildings', icon: Building },
  { href: '/admin/spaces', label: 'Spaces', icon: Building2 },
  { href: '/admin/tenants', label: 'Tenants', icon: Users },
  { href: '/admin/agreements', label: 'Agreements', icon: FileText },
  { href: '/admin/building-utilities', label: 'Building Utilities', icon: Wrench },
  { href: '/admin/billing', label: 'Billing', icon: DollarSign },
  { href: '/admin/payments-overview', label: 'Payments Overview', icon: ClipboardList },
  { href: '/portal/dashboard', label: 'Tenant Portal (View)', icon: ExternalLink },
];

function ActualAdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isMobile, state: sidebarState } = useSidebar();

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
            {navItems.map((item) => {
              const isActive = pathname === item.href || (item.href !== '/admin/dashboard' && !item.href.startsWith('/portal') && pathname.startsWith(item.href));
              
              const menuItemContent = (
                <>
                  <item.icon />
                  <span
                    className={cn(
                      "flex-1 min-w-0", // Base layout for the span
                      // If not mobile AND sidebar is collapsed, hide the text.
                      // Otherwise (if mobile OR sidebar is expanded), truncate the text to match image.
                      (!isMobile && sidebarState === "collapsed") ? "hidden" : "truncate"
                    )}
                  >
                    {item.label}
                  </span>
                </>
              );

              const commonButtonProps = {
                isActive: isActive,
                className: cn(
                  item.label === 'Tenant Portal (View)' && 'mt-auto border-t border-sidebar-border pt-2'
                ),
                target: item.label === 'Tenant Portal (View)' ? '_blank' : undefined,
                rel: item.label === 'Tenant Portal (View)' ? 'noopener noreferrer' : undefined,
              };

              if (!isMobile && sidebarState === "collapsed") {
                return (
                  <SidebarMenuItem key={item.href}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Link href={item.href} asChild>
                           <SidebarMenuButton {...commonButtonProps}>
                            {menuItemContent}
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
                  <Link href={item.href} asChild>
                     <SidebarMenuButton {...commonButtonProps}>
                       {menuItemContent}
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
                  <p className="text-sm font-medium">Admin User</p>
                  <p className="text-xs text-sidebar-foreground/70">admin@leaseflow.com</p>
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
              <DropdownMenuItem>
                <Settings className="mr-2 h-4 w-4" />
                <span>Settings</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarFooter>
      </Sidebar>
      <main className="flex-1 md:ml-[var(--sidebar-width-icon)] group-data-[state=expanded]:md:ml-[var(--sidebar-width)] transition-[margin-left] duration-200 ease-linear">
        <div className="p-4 sm:p-6 lg:p-8">
          <div className="hidden md:flex items-center justify-start mb-6 h-[3.7rem]">
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
    // Return null or a basic loader to prevent flash of unstyled content or hydration errors
    // For this specific case, returning null ensures client-side logic dependent on window/document is safe
    return null; 
  }

  return (
    <SidebarProvider defaultOpen>
      <TooltipProvider>
        <ActualAdminLayout>{children}</ActualAdminLayout>
      </TooltipProvider>
    </SidebarProvider>
  );
}
