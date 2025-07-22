
"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KeyRound, Phone, Loader2, Lock, Eye, EyeOff, MessageSquareText, Send, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';
import Link from 'next/link';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

const getResetTokenSchema = z.object({
  phoneNumber: z.string().regex(/^(09|07)\d{8}$/, { message: "Phone number must start with 09 or 07 and be 10 digits long (e.g., 0912345678)."}),
});
type GetResetTokenValues = z.infer<typeof getResetTokenSchema>;

const resetPasswordSchema = z.object({
  token: z.string().min(1, { message: "Reset code is required." }),
  newPassword: z.string().min(6, { message: "New password must be at least 6 characters." }),
  confirmPassword: z.string(),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: "New passwords do not match.",
  path: ["confirmPassword"]
});
type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;

type FormStep = 'enter-phone' | 'enter-password' | 'success';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [step, setStep] = useState<FormStep>('enter-phone');
  const [isLoading, setIsLoading] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [phoneNumber, setPhoneNumber] = useState('');
  
  const getResetTokenForm = useForm<GetResetTokenValues>({
    resolver: zodResolver(getResetTokenSchema),
    defaultValues: { phoneNumber: "" }
  });

  const resetPasswordForm = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { token: "", newPassword: "", confirmPassword: "" }
  });

  const handleGetTokenSubmit = async (values: GetResetTokenValues) => {
    setIsLoading(true);
    setPhoneNumber(values.phoneNumber);
    try {
      const response = await fetch('/api/Auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: values.phoneNumber }),
      });
      const data = await response.json();
      if (response.ok && data.isSuccess && data.token) {
        toast({ title: "Verification Code Sent", description: "A reset code has been sent to you. Please enter it below.", });
        resetPasswordForm.setValue("token", data.token);
        setStep('enter-password');
      } else {
        toast({ title: "Request Failed", description: data.errors?.join(', ') || "Failed to initiate password reset.", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Request Error", description: "Could not connect to the authentication service.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPasswordSubmit = async (values: ResetPasswordValues) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/Auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: phoneNumber,
          token: values.token,
          newPassword: values.newPassword
        }),
      });
      const data = await response.json();
      if (response.ok && data.isSuccess) {
        toast({ title: "Password Reset Successful", description: "Your password has been changed." });
        setStep('success');
      } else {
        toast({ title: "Reset Failed", description: data.errors?.join(', ') || "Failed to reset password.", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Request Error", description: "Could not connect to the authentication service.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };


  const renderStepContent = () => {
    switch (step) {
      case 'enter-phone':
        return (
          <>
            <CardHeader className="text-center space-y-4 pt-6 sm:pt-8">
              <KeyRound className="mx-auto h-12 w-12 text-primary" />
              <div className="space-y-1 px-2">
                <CardTitle className="text-xl sm:text-2xl font-bold font-headline text-primary">Forgot Password?</CardTitle>
                <CardDescription>Enter your phone number to receive a reset code.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="px-4 sm:px-6 pb-6">
              <FormProvider {...getResetTokenForm}>
                <form onSubmit={getResetTokenForm.handleSubmit(handleGetTokenSubmit)} className="space-y-4 sm:space-y-6">
                  <FormField
                    control={getResetTokenForm.control}
                    name="phoneNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center">
                          <Phone className="mr-2 h-4 w-4 text-primary" /> Phone Number
                        </FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="e.g., 0912345678" className="text-base" disabled={isLoading} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-3 text-base" disabled={isLoading}>
                    {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Send className="mr-2 h-5 w-5" />}
                    Next
                  </Button>
                  <div className="text-center">
                    <Link href="/auth/login" className="text-sm text-primary hover:underline">
                        Back to Login
                    </Link>
                  </div>
                </form>
              </FormProvider>
            </CardContent>
          </>
        );

      case 'enter-password':
        return (
           <>
            <CardHeader className="text-center space-y-4 pt-6 sm:pt-8">
                <KeyRound className="mx-auto h-12 w-12 text-primary" />
                <div className="space-y-1 px-2">
                    <CardTitle className="text-xl sm:text-2xl font-bold font-headline text-primary">Reset Your Password</CardTitle>
                    <CardDescription>Enter the reset code sent to you and choose a new password.</CardDescription>
                </div>
            </CardHeader>
            <CardContent className="px-4 sm:px-6 pb-6">
              <FormProvider {...resetPasswordForm}>
                <form onSubmit={resetPasswordForm.handleSubmit(handleResetPasswordSubmit)} className="space-y-4">
                  <FormField control={resetPasswordForm.control} name="token" render={({ field }) => ( <FormItem> <FormLabel className="flex items-center"><MessageSquareText className="mr-2 h-4 w-4" /> Reset Code</FormLabel> <FormControl><Input placeholder="Enter reset code" {...field} /></FormControl> <FormMessage /> </FormItem> )} />
                  <FormField control={resetPasswordForm.control} name="newPassword" render={({ field }) => ( <FormItem> <FormLabel className="flex items-center"><Lock className="mr-2 h-4 w-4" /> New Password</FormLabel> <div className="relative"> <FormControl><Input type={showNewPassword ? 'text' : 'password'} placeholder="••••••••" {...field} /></FormControl> <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2" onClick={() => setShowNewPassword(!showNewPassword)}> {showNewPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />} </Button> </div> <FormMessage /> </FormItem> )} />
                  <FormField control={resetPasswordForm.control} name="confirmPassword" render={({ field }) => ( <FormItem> <FormLabel className="flex items-center"><Lock className="mr-2 h-4 w-4" /> Confirm New Password</FormLabel> <div className="relative"> <FormControl><Input type={showConfirmPassword ? 'text' : 'password'} placeholder="••••••••" {...field} /></FormControl> <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2" onClick={() => setShowConfirmPassword(!showConfirmPassword)}> {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />} </Button> </div> <FormMessage /> </FormItem> )} />
                  <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-3 text-base" disabled={isLoading}>
                    {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : "Reset Password"}
                  </Button>
                  <div className="text-center">
                    <Button variant="link" onClick={() => setStep('enter-phone')} className="text-sm">Back</Button>
                  </div>
                </form>
              </FormProvider>
            </CardContent>
          </>
        );
      
      case 'success':
        return (
          <>
            <CardHeader className="text-center space-y-4 pt-6 sm:pt-8">
                <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
                <div className="space-y-1 px-2">
                    <CardTitle className="text-xl sm:text-2xl font-bold font-headline text-primary">Password Reset!</CardTitle>
                    <CardDescription>Your password has been successfully changed.</CardDescription>
                </div>
            </CardHeader>
            <CardContent className="px-4 sm:px-6 pb-6 text-center">
                <Button onClick={() => router.push('/auth/login')} className="w-full">
                    Proceed to Login
                </Button>
            </CardContent>
          </>
        );
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-background to-secondary/30 p-4">
      <Card className="w-full max-w-md shadow-2xl animate-fadeIn border-primary/20">
        {renderStepContent()}
      </Card>
    </div>
  );
}
