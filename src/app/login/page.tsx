
"use client";

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogIn, Phone, Loader2, Eye, EyeOff, Lock, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';
import { signIn } from "next-auth/react";

export default function AdminLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const errorFromUrl = searchParams.get('error');
  // NextAuth.js will add this query param if the credentials are wrong
  const credentialsError = errorFromUrl === "CredentialsSignin";


  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // Use the standard signIn flow. It will redirect automatically.
    // The middleware will handle routing to the correct dashboard or change password page.
    const result = await signIn("credentials", {
      // No 'redirect: false'. Let NextAuth handle it.
      phoneNumber: phoneNumber,
      password: password,
      callbackUrl: '/admin/dashboard', // Default destination for non-tenants
    });

    // The code below will only run if there's an error and the redirect doesn't happen.
    // This is a fallback for displaying errors.
    if (result?.error) {
       toast({
          title: "Login Failed",
          description: "Invalid credentials. Please check your phone number and password.",
          variant: "destructive",
        });
    }

    setIsLoading(false);
  };

  return (
    <>
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-background to-secondary/30 p-4">
      <Card className="w-full max-w-md shadow-2xl animate-fadeIn border-primary/20">
        <CardHeader className="text-center space-y-4 pt-6 sm:pt-8">
          <Image src="https://i.imgur.com/JTzGpIH.png" alt="LeaseFlow Logo" width={200} height={50} className="mx-auto h-auto object-contain" data-ai-hint="logo" />
          <div className="space-y-1 px-2">
              <CardTitle className="text-xl sm:text-2xl font-bold font-headline text-primary">LeaseFlow</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="px-4 sm:px-6 pb-6">
          <form onSubmit={handleLogin} className="space-y-4 sm:space-y-6">
             {credentialsError && (
              <div className="p-3 bg-destructive/10 border border-destructive text-destructive text-sm rounded-md flex items-start">
                <AlertTriangle className="h-5 w-5 mr-2 shrink-0" />
                <p>Invalid credentials. Please try again.</p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="phoneNumber" className="flex items-center">
                <Phone className="mr-2 h-4 w-4 text-primary" /> Phone Number
              </Label>
              <Input 
                id="phoneNumber" 
                type="tel" 
                placeholder="Enter your phone number" 
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                required 
                className="text-base"
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="flex items-center">
                  <Lock className="mr-2 h-4 w-4 text-primary" /> Password
                </Label>
              </div>
              <div className="relative">
                <Input 
                  id="password" 
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required 
                  className="text-base pr-10"
                  disabled={isLoading}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 text-muted-foreground hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isLoading}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </Button>
              </div>
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
      </Card>
    </div>
    </>
  );
}

