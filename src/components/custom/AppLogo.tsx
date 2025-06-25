"use client";

import Image from 'next/image';
import Link from 'next/link';
import { useSidebar } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';

export function AppLogo() {
  const { isMobile, state: sidebarState } = useSidebar();

  return (
    <Link href="/admin/dashboard" className="flex items-center gap-2 text-sidebar-foreground hover:text-sidebar-accent-foreground transition-colors">
      <Image src="https://findvectorlogo.com/wp-content/uploads/2020/09/nib-international-bank-vector-logo.png" alt="LeaseFlow Logo" width={28} height={28} />
      <h1 
        className={cn(
            "text-xl font-headline font-semibold whitespace-nowrap",
            (!isMobile && sidebarState === 'collapsed') && 'hidden'
        )}
      >
        LeaseFlow
      </h1>
    </Link>
  );
}
