import Link from 'next/link';
import { Home, UserCircle, LogOut } from 'lucide-react';

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="bg-primary text-primary-foreground shadow-md">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/portal/dashboard" className="flex items-center gap-2">
            <Home className="h-7 w-7" />
            <h1 className="text-xl font-headline font-semibold">LeaseFlow Portal</h1>
          </Link>
          <nav className="flex items-center gap-4">
            <Link href="/portal/dashboard" className="text-sm font-medium hover:underline">
              Dashboard
            </Link>
             <Link href="#" className="text-sm font-medium hover:underline flex items-center gap-1">
              <UserCircle size={18} /> My Account
            </Link>
             <Link href="/portal/login" className="text-sm font-medium hover:underline flex items-center gap-1">
              <LogOut size={18} /> Logout
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
      <footer className="bg-muted text-muted-foreground py-4 text-center text-sm">
        © {new Date().getFullYear()} LeaseFlow. All rights reserved.
      </footer>
    </div>
  );
}
