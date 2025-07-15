"use client";

import Link from 'next/link';
import { UserCircle, LogOut, Menu, Loader2 } from 'lucide-react';
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

// This layout applies to pages inside the (app) route group, like the dashboard.

export default function PortalAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
      setIsLoggingOut(true);
      try {
          // Call the dedicated portal logout endpoint
          const response = await fetch('/api/auth/portal/logout', {
              method: 'POST',
          });
          const data = await response.json();

          if (response.ok && data.isSuccess) {
              toast({
                  title: "Logged Out",
                  description: "You have been successfully logged out from the portal.",
              });
          } else {
              toast({
                  title: "Logout Issue",
                  description: data.errors?.join(', ') || "Could not fully complete server logout. Local session cleared.",
                  variant: "default",
              });
          }
      } catch (error) {
          console.error("Portal logout API call error:", error);
          toast({
              title: "Logout Error",
              description: "Could not connect to the logout service. Cleared local session.",
              variant: "default"
          });
      } finally {
          // Redirect to the portal login page
          router.push('/portal/login');
          setIsLoggingOut(false);
      }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="bg-primary text-primary-foreground shadow-md sticky top-0 z-50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/portal/dashboard" className="flex items-center gap-3">
            <Image src="https://i.imgur.com/JTzGpIH.png" alt="Building Management Solution Logo" width={100} height={28} className="h-7 w-auto object-contain" />
            <span className="hidden sm:inline text-lg font-headline font-semibold">Building Management Solution</span>
          </Link>
          
          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-4">
            <Link href="#" className="text-sm font-medium hover:underline flex items-center gap-1">
              <UserCircle size={18} /> My Account
            </Link>
            <Button variant="ghost" size="sm" onClick={handleLogout} disabled={isLoggingOut} className="text-sm font-medium hover:underline flex items-center gap-1 p-2 h-auto text-primary-foreground">
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
              <SheetContent side="right" className="w-[240px] bg-primary text-primary-foreground p-4">
                <nav className="flex flex-col space-y-4 mt-8">
                  <SheetClose asChild>
                    <Link href="#" className="text-base font-medium hover:underline flex items-center gap-2 p-2 rounded-md hover:bg-primary/80">
                      <UserCircle size={20} /> My Account
                    </Link>
                  </SheetClose>
                  <SheetClose asChild>
                    <Button variant="ghost" onClick={handleLogout} disabled={isLoggingOut} className="text-base font-medium hover:underline flex items-center justify-start gap-2 p-2 rounded-md hover:bg-primary/80 w-full">
                      {isLoggingOut ? <Loader2 size={20} className="animate-spin" /> : <LogOut size={20} />}
                      <span className="ml-1">{isLoggingOut ? 'Logging out...' : 'Logout'}</span>
                    </Button>
                  </SheetClose>
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
        © {new Date().getFullYear()} Building Management Solution. All rights reserved.
      </footer>
    </div>
  );
}