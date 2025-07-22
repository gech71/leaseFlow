
"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogIn, Phone, Loader2, Eye, EyeOff, Lock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';

const changePasswordSchema = z.object({
    currentPassword: z.string().min(1, { message: "Current password is required." }),
    newPassword: z.string().min(6, { message: "New password must be at least 6 characters." }),
    confirmPassword: z.string()
}).refine(data => data.newPassword === data.confirmPassword, {
    message: "New passwords do not match.",
    path: ["confirmPassword"]
});

type ChangePasswordValues = z.infer<typeof changePasswordSchema>;


export default function TenantLoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const [isChangePasswordLoading, setIsChangePasswordLoading] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [showChangePasswordDialog, setShowChangePasswordDialog] = useState(false);
  const [changePasswordToken, setChangePasswordToken] = useState<string | null>(null);

  const changePasswordForm = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" }
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch('/api/Auth/portal/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber, password }),
      });

      const data = await response.json();

      if (response.ok && data.isSuccess) {
        if (data.requiresPasswordChange) {
            toast({
                title: "Password Change Required",
                description: "For your security, you must change your temporary password.",
                variant: "default",
                duration: 5000,
            });
            setChangePasswordToken(data.accessToken);
            changePasswordForm.setValue("currentPassword", password);
            setShowChangePasswordDialog(true);
        } else {
            toast({
              title: "Login Successful",
              description: "Welcome to your portal!",
            });
            router.push(data.redirectPath || '/portal/dashboard');
        }
      } else {
        const errorMessages = data.errors?.join(', ') || "Invalid phone number or password.";
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
        description: "Could not connect to the authentication service.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleChangePasswordSubmit = async (values: ChangePasswordValues) => {
    setIsChangePasswordLoading(true);
    try {
        const { currentPassword, newPassword } = values;

        const response = await fetch('/api/Auth/change-password', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${changePasswordToken}`
             },
            body: JSON.stringify({
                phoneNumber: phoneNumber, // Pass the phone number
                currentPassword,
                newPassword,
            }),
        });

        const data = await response.json();

        if (response.ok && data.isSuccess) {
            toast({ title: "Password Changed", description: "Your password has been updated successfully. Logging you in..." });
            setShowChangePasswordDialog(false);
            await handleLoginWithNewPassword(values.newPassword);
        } else {
            toast({ title: "Error", description: data.errors?.join(', ') || "Failed to change password.", variant: "destructive" });
        }
    } catch (error) {
        toast({ title: "Error", description: "An unexpected error occurred.", variant: "destructive" });
    } finally {
        setIsChangePasswordLoading(false);
    }
  }

  const handleLoginWithNewPassword = async (newPassword: string) => {
      setIsLoading(true);
      const response = await fetch('/api/Auth/portal/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phoneNumber, password: newPassword }),
      });
      const data = await response.json();
      if(response.ok && data.isSuccess) {
          router.push(data.redirectPath || '/portal/dashboard');
      } else {
          toast({ title: "Auto Login Failed", description: "Please log in manually with your new password.", variant: "destructive"});
          setPassword('');
          setChangePasswordToken(null);
          changePasswordForm.reset();
      }
      setIsLoading(false);
  }

  return (
    <>
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-background to-secondary/30 p-4">
        <Card className="w-full max-w-md shadow-2xl animate-fadeIn border-primary/20">
          <CardHeader className="text-center space-y-4 pt-6 sm:pt-8">
            <Image src="https://i.imgur.com/JTzGpIH.png" alt="Building Management Solution Logo" width={200} height={50} className="mx-auto h-auto object-contain" data-ai-hint="logo" />
            <div className="space-y-1 px-2">
              <CardTitle className="text-xl sm:text-2xl font-bold font-headline text-primary">Tenant Portal</CardTitle>
              <CardDescription>Sign in to view your lease and billing information.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="px-4 sm:px-6 pb-6">
            <form onSubmit={handleLogin} className="space-y-4 sm:space-y-6">
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
                 <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="flex items-center">
                      <Lock className="mr-2 h-4 w-4 text-primary" /> Password
                    </Label>
                    <Link href="/auth/forgot-password" className="text-xs text-primary hover:underline">
                      Forgot Password?
                    </Link>
                  </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
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

       <Dialog open={showChangePasswordDialog} onOpenChange={setShowChangePasswordDialog}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle className="font-headline text-xl">Change Your Password</DialogTitle>
                    <DialogDescription>
                        For your security, please change your temporary password to a new one.
                    </DialogDescription>
                </DialogHeader>
                <Form {...changePasswordForm}>
                    <form onSubmit={changePasswordForm.handleSubmit(handleChangePasswordSubmit)} className="space-y-4 py-2">
                         <FormField
                            control={changePasswordForm.control}
                            name="currentPassword"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Temporary Password</FormLabel>
                                     <div className="relative">
                                        <FormControl>
                                            <Input type="password" {...field} disabled />
                                        </FormControl>
                                    </div>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={changePasswordForm.control}
                            name="newPassword"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>New Password</FormLabel>
                                    <div className="relative">
                                        <FormControl>
                                            <Input type={showNewPassword ? "text" : "password"} {...field} placeholder="Enter your new password" />
                                        </FormControl>
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon"
                                          className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 text-muted-foreground hover:bg-transparent"
                                          onClick={() => setShowNewPassword(!showNewPassword)}
                                        >
                                          {showNewPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                        </Button>
                                    </div>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                         <FormField
                            control={changePasswordForm.control}
                            name="confirmPassword"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Confirm New Password</FormLabel>
                                     <div className="relative">
                                        <FormControl>
                                            <Input type={showConfirmPassword ? "text" : "password"} {...field} placeholder="Confirm your new password" />
                                        </FormControl>
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon"
                                          className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 text-muted-foreground hover:bg-transparent"
                                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        >
                                          {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                        </Button>
                                    </div>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <DialogFooter className="pt-4">
                            <Button type="submit" disabled={isChangePasswordLoading}>
                                {isChangePasswordLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                Save and Continue
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    </>
  );
}
