
import Link from 'next/link';
import { Home, UserCircle, LogOut, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
import Image from 'next/image';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'NIB Rental',
  description: 'Building rental management solution by Firebase Studio',
  icons: {
    icon: 'https://play-lh.googleusercontent.com/bXqMt9ROsGd0H9vPhib5hG-0NB-EJcAwZy6UUDhvlP-ykE595IMQtzr14R6IRWtJiGTh',
  },
};

const navLinks = [
  { href: "/portal/dashboard", label: "Dashboard", icon: Home },
  { href: "#", label: "My Account", icon: UserCircle },
  { href: "/portal/login", label: "Logout", icon: LogOut },
];

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="bg-primary text-primary-foreground shadow-md sticky top-0 z-50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/portal/dashboard" className="flex items-center gap-3">
            <Image src="https://upload.wikimedia.org/wikipedia/commons/d/df/Nib_International_Bank.png" alt="Nib International Bank Logo" width={100} height={28} className="h-7 w-auto object-contain" />
            <span className="text-xl font-headline font-semibold">NIB Rental</span>
          </Link>
          
          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-4">
            {navLinks.map(link => (
              <Link key={link.label} href={link.href} className="text-sm font-medium hover:underline flex items-center gap-1">
                <link.icon size={18} /> {link.label}
              </Link>
            ))}
          </nav>

          {/* Mobile Navigation Trigger */}
          <div className="md:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-6 w-6" />
                  <span className="sr-only">Open menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[240px] bg-primary text-primary-foreground p-4">
                <nav className="flex flex-col space-y-4 mt-8">
                  {navLinks.map(link => (
                    <SheetClose asChild key={link.label}>
                      <Link href={link.href} className="text-base font-medium hover:underline flex items-center gap-2 p-2 rounded-md hover:bg-primary/80">
                        <link.icon size={20} /> {link.label}
                      </Link>
                    </SheetClose>
                  ))}
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>
      <main className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {children}
      </main>
      <footer className="bg-muted text-muted-foreground py-4 text-center text-sm">
        © {new Date().getFullYear()} NIB Rental. All rights reserved.
      </footer>
    </div>
  );
}
