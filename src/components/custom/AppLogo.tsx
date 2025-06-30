"use client";

import Image from 'next/image';
import Link from 'next/link';
import { useSidebar } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';

export function AppLogo() {
  const { isMobile, state: sidebarState } = useSidebar();
  const isCollapsed = !isMobile && sidebarState === 'collapsed';

  return (
    <Link href="/admin/dashboard" className="flex items-center justify-center gap-2 text-sidebar-foreground hover:text-sidebar-accent-foreground transition-colors w-full">
      <Image 
        src="https://upload.wikimedia.org/wikipedia/commons/d/df/Nib_International_Bank.png"
        alt="Nib Bank Logo" 
        width={150}
        height={40}
        className={cn(
          "h-8 w-auto object-contain transition-all duration-300",
          isCollapsed && "w-8"
        )}
      />
      <span className={cn(
        "font-headline text-lg font-bold text-sidebar-primary transition-all duration-300 whitespace-nowrap",
        isCollapsed ? "opacity-0 w-0" : "opacity-100"
      )}>
        NIB Rental
      </span>
    </Link>
  );
}
