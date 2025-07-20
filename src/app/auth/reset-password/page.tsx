
"use client";

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KeyRound, Lock, Loader2, Eye, EyeOff, MessageSquareText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';

const resetPasswordSchema = z.object({
  phoneNumber: z.string().min(1, { message: "Phone number is required." }),
  token: z.string().min(1, { message: "Reset code is required." }),
  newPassword: z.string().min(6, { message: "New password must be at least 6 characters." }),
  confirmPassword: z.string(),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: "New passwords do not match.",
  path: ["confirmPassword"]
});

type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const form = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      phoneNumber: searchParams.get('phone') || "",
      token: "",
      newPassword: "",
      confirmPassword: ""
    }
  });

  useEffect(() => {
    form.setValue("phoneNumber", searchParams.get('phone') || "");
  }, [searchParams, form]);

  const handleResetPassword = async (values: ResetPasswordValues) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

      const data = await response.json();

      if (response.ok && data.isSuccess) {
        toast({
          title: "Password Reset Successful",
          description: "Your password has been changed. You can now log in.",
        });
        router.push('/auth/login');
      } else {
        const errorMessages = data.errors?.join(', ') || "Failed to reset password. Please check your details.";
        toast({
          title: "Reset Failed",
          description: errorMessages,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Reset password API call error:", error);
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
            <CardTitle className="text-xl sm:text-2xl font-bold font-headline text-primary">Reset Your Password</CardTitle>
            <CardDescription>Enter the code from your SMS and your new password.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="px-4 sm:px-6 pb-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleResetPassword)} className="space-y-4">
              <FormField control={form.control} name="phoneNumber" render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone Number</FormLabel>
                  <FormControl><Input {...field} disabled /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="token" render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center"><MessageSquareText className="mr-2 h-4 w-4" /> Reset Code</FormLabel>
                  <FormControl><Input placeholder="Enter code from SMS" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="newPassword" render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center"><Lock className="mr-2 h-4 w-4" /> New Password</FormLabel>
                   <div className="relative">
                      <FormControl><Input type={showNewPassword ? 'text' : 'password'} placeholder="••••••••" {...field} /></FormControl>
                      <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2" onClick={() => setShowNewPassword(!showNewPassword)}>
                        {showNewPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </Button>
                    </div>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="confirmPassword" render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center"><Lock className="mr-2 h-4 w-4" /> Confirm New Password</FormLabel>
                   <div className="relative">
                      <FormControl><Input type={showConfirmPassword ? 'text' : 'password'} placeholder="••••••••" {...field} /></FormControl>
                       <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2" onClick={() => setShowConfirmPassword(!showConfirmPassword)}>
                        {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </Button>
                    </div>
                  <FormMessage />
                </FormItem>
              )} />
              <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-3 text-base" disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : "Reset Password"}
              </Button>
               <div className="text-center">
                <Link href="/auth/login" className="text-sm text-primary hover:underline">
                    Back to Login
                </Link>
            </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
