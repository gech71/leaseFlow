
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
import { useRouter, useSearchParams } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from '@/lib/utils';
import type { ClientAgreement } from '../dashboard/page';

interface PortalLayoutProps {
  children: React.ReactNode;
  agreements: ClientAgreement[];
}


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
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  
  // This would come from a context or props in a real app
  // For this example, we'll assume it's passed down or fetched.
  const agreements: ClientAgreement[] = (children as any)?.props?.childToRender?.props?.initialData?.agreements || [];
  const selectedAgreementId = searchParams.get('agreementId') || agreements[0]?.id;
  const selectedAgreement = agreements.find(ag => ag.id === selectedAgreementId);


  const handleLogout = async () => {
      setIsLoggingOut(true);
      try {
          const response = await fetch('/api/Auth/logout', { method: 'POST' });
          const data = await response.json();

          if (response.ok && data.isSuccess) {
              toast({ title: "Logged Out", description: "You have been successfully logged out." });
          } else {
              toast({ title: "Logout Issue", description: data.errors?.join(', ') || "Could not fully complete server logout.", variant: "default" });
          }
      } catch (error) {
          toast({ title: "Logout Error", description: "Could not connect to the logout service.", variant: "default" });
      } finally {
          router.push('/login');
          setIsLoggingOut(false);
      }
  };
  
  const handleAgreementChange = (agreementId: string) => {
    router.push(`/portal/dashboard?agreementId=${agreementId}`);
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
                {agreements.length > 1 && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="flex items-center gap-2 text-primary-foreground hover:bg-primary/80">
                                <Building size={18} />
                                <span className="truncate max-w-[200px]">
                                    {selectedAgreement?.space?.spaceIdName || 'Select Space'}
                                </span>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                            {agreements.map(ag => (
                                <DropdownMenuItem key={ag.id} onSelect={() => handleAgreementChange(ag.id)}>
                                    {ag.space?.spaceIdName} ({ag.space?.building.name})
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
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
                             {agreements.length > 1 && (
                                <div className="space-y-2">
                                    <h3 className="font-semibold px-2">Your Spaces</h3>
                                    {agreements.map(ag => (
                                        <SheetClose key={ag.id} asChild>
                                            <Button 
                                                variant="ghost" 
                                                onClick={() => handleAgreementChange(ag.id)}
                                                className={cn(
                                                    "w-full justify-start text-left",
                                                    ag.id === selectedAgreementId && "bg-primary/80"
                                                )}
                                            >
                                                {ag.space?.spaceIdName}
                                            </Button>
                                        </SheetClose>
                                    ))}
                                </div>
                             )}
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
