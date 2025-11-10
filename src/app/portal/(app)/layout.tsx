
"use client";

import Link from 'next/link';
import { UserCircle, LogOut, Menu, Loader2, Building } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
import { signOut } from 'next-auth/react'; // Import signOut from next-auth/react

// This is now a simple layout that delegates to a more complex client component
export default function PortalLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen flex flex-col bg-background">
            <PortalHeader />
            <main className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
                {children}
            </main>
            <footer className="bg-muted text-muted-foreground py-4 text-center text-sm">
                © {new Date().getFullYear()} NIB Building Management Solution. All rights reserved.
            </footer>
        </div>
    );
}

// The header is now its own component to manage its state
function PortalHeader() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
      setIsLoggingOut(true);
      await signOut({ redirect: true, callbackUrl: '/login' });
      toast({ title: "Logged Out", description: "You have been successfully logged out." });
      setIsLoggingOut(false);
  };


  return (
    <header className="bg-primary text-primary-foreground shadow-md sticky top-0 z-50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <Link href="/portal/dashboard" className="flex items-center gap-3">
                <Image src="https://i.imgur.com/JTzGpIH.png" alt="NIB Logo" width={100} height={28} className="h-7 w-auto object-contain" />
                <span className="hidden sm:inline text-lg font-headline font-semibold">NIB Building Management Solution</span>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-2">
                <Link href="/portal/dashboard" className="text-sm font-medium hover:underline flex items-center gap-1 p-2 rounded-md hover:bg-primary/80">
                    <Building size={18} /> Dashboard
                </Link>
                <Link href="/portal/profile" className="text-sm font-medium hover:underline flex items-center gap-1 p-2 rounded-md hover:bg-primary/80">
                    <UserCircle size={18} /> My Account
                </Link>
                <Button variant="ghost" size="sm" onClick={handleLogout} disabled={isLoggingOut} className="text-sm font-medium hover:underline flex items-center gap-1 p-2 h-auto text-primary-foreground hover:bg-primary/80">
                    {isLoggingOut ? <Loader2 size={18} className="animate-spin" /> : <LogOut size={18} />}
                    <span className="ml-1">{isLoggingOut ? 'Logging out...' : 'Logout'}</span>
                </Button>
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
                    <SheetContent side="right" className="w-[280px] bg-primary text-primary-foreground p-4 flex flex-col">
                        <nav className="flex flex-col space-y-2 mt-8 flex-grow">
                             <SheetClose asChild>
                                <Link href="/portal/dashboard" className="text-base font-medium hover:underline flex items-center gap-2 p-2 rounded-md hover:bg-primary/80">
                                    <Building size={20} /> Dashboard
                                </Link>
                            </SheetClose>
                            <SheetClose asChild>
                                <Link href="/portal/profile" className="text-base font-medium hover:underline flex items-center gap-2 p-2 rounded-md hover:bg-primary/80">
                                    <UserCircle size={20} /> My Account
                                </Link>
                            </SheetClose>
                        </nav>
                         <SheetClose asChild>
                            <Button variant="ghost" onClick={handleLogout} disabled={isLoggingOut} className="text-base font-medium hover:underline flex items-center justify-start gap-2 p-2 rounded-md hover:bg-primary/80 w-full mt-auto">
                                {isLoggingOut ? <Loader2 size={20} className="animate-spin" /> : <LogOut size={20} />}
                                <span className="ml-1">{isLoggingOut ? 'Logging out...' : 'Logout'}</span>
                            </Button>
                        </SheetClose>
                    </SheetContent>
                </Sheet>
            </div>
        </div>
    </header>
  )
}
