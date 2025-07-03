
"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogIn, Phone, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';

export default function AdminLoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Call the Next.js API route for login
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phoneNumber, password }),
      });

      const data = await response.json();

      if (response.ok && data.isSuccess) {
        toast({
          title: "Login Successful",
          description: "Welcome!",
        });
        router.push(data.redirectPath || '/admin/dashboard');
      } else {
        const errorMessages = data.errors?.join(', ') || "Invalid phone number or password. Please try again.";
        toast({
          title: "Login Failed",
          description: errorMessages,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Login API call error:", error);
      toast({
        title: "Login Error",
        description: "Could not connect to the authentication service. Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-background to-secondary/30 p-4">
      <Card className="w-full max-w-md shadow-2xl animate-fadeIn border-primary/20">
        <CardHeader className="text-center space-y-3 pt-8">
          <div className="mx-auto">
            <Link href="/" className="flex items-center justify-center gap-3 text-foreground hover:text-primary transition-colors">
               <Image src="https://upload.wikimedia.org/wikipedia/commons/d/df/Nib_International_Bank.png" alt="Nib International Bank Logo" width={160} height={44} className="h-11 w-auto object-contain" />
               <span className="text-2xl font-bold font-headline text-primary">Building Management</span>
            </Link>
          </div>
          <CardTitle className="text-2xl font-semibold">Admin & Staff Login</CardTitle>
          <CardDescription>Enter your phone number and password</CardDescription>
        </CardHeader>
        <CardContent className="pb-8">
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="phoneNumber" className="flex items-center">
                <Phone className="mr-2 h-4 w-4 text-primary" /> Phone Number
              </Label>
              <Input 
                id="phoneNumber" 
                type="tel" 
                placeholder="e.g., 0912345678" 
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                required 
                className="text-base"
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input 
                id="password" 
                type="password" 
                placeholder="••••••••" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required 
                className="text-base"
                disabled={isLoading}
              />
            </div>
            <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-3 text-base" disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <LogIn className="mr-2 h-5 w-5" />
              )}
              Sign In
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col items-center space-y-3 text-sm pb-8">
          <Link href="#" className="text-primary hover:underline">
            Forgot password?
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
