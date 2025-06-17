import { Home } from 'lucide-react';
import Link from 'next/link';

export function AppLogo() {
  return (
    <Link href="/admin/dashboard" className="flex items-center gap-2 text-sidebar-foreground hover:text-sidebar-accent-foreground transition-colors">
      <Home className="h-7 w-7 text-sidebar-primary" />
      <h1 className="text-xl font-headline font-semibold">LeaseFlow</h1>
    </Link>
  );
}
