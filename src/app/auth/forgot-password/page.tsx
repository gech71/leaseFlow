
"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KeyRound, Phone, Loader2, Send } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber }),
      });

      const data = await response.json();

      if (response.ok && data.isSuccess) {
        toast({
          title: "Reset Code Sent",
          description: "A password reset code has been sent to your phone. Please use it to reset your password.",
        });
        // Redirect to the reset password page, passing the phone number along
        router.push(`/auth/reset-password?phone=${encodeURIComponent(phoneNumber)}`);
      } else {
        const errorMessages = data.errors?.join(', ') || "Failed to initiate password reset. Please check the phone number.";
        toast({
          title: "Request Failed",
          description: errorMessages,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Forgot password API call error:", error);
      toast({
        title: "Request Error",
        description: "Could not connect to the authentication service.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-background to-secondary/30 p-4">
      <Card className="w-full max-w-md shadow-2xl animate-fadeIn border-primary/20">
        <CardHeader className="text-center space-y-4 pt-6 sm:pt-8">
            <KeyRound className="mx-auto h-12 w-12 text-primary" />
            <div className="space-y-1 px-2">
                <CardTitle className="text-xl sm:text-2xl font-bold font-headline text-primary">Forgot Password?</CardTitle>
                <CardDescription>Enter your phone number to receive a reset code.</CardDescription>
            </div>
        </CardHeader>
        <CardContent className="px-4 sm:px-6 pb-6">
          <form onSubmit={handleForgotPassword} className="space-y-4 sm:space-y-6">
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
            <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-3 text-base" disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <Send className="mr-2 h-5 w-5" />
              )}
              Send Reset Code
            </Button>
            <div className="text-center">
                <Link href="/auth/login" className="text-sm text-primary hover:underline">
                    Back to Login
                </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
