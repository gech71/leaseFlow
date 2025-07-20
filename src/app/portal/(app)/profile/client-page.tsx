
"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader2, User, Mail, Phone, Lock, Eye, EyeOff } from 'lucide-react';
import type { Tenant as TenantPrisma } from '@prisma/client';
import { AlertTriangle } from 'lucide-react';


const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, { message: "Current password is required." }),
  newPassword: z.string().min(6, { message: "New password must be at least 6 characters." }),
  confirmPassword: z.string()
}).refine(data => data.newPassword === data.confirmPassword, {
  message: "New passwords do not match.",
  path: ["confirmPassword"]
});

type ChangePasswordValues = z.infer<typeof changePasswordSchema>;

interface TenantProfileClientPageProps {
  initialTenant: (Omit<TenantPrisma, 'createdAt' | 'updatedAt'> & { createdAt: string; updatedAt?: string | null }) | null;
  error?: string;
}

export function TenantProfileClientPage({ initialTenant, error }: TenantProfileClientPageProps) {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const form = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" }
  });

  const handleChangePasswordSubmit = async (values: ChangePasswordValues) => {
    setIsSaving(true);
    try {
        // The API only needs the current and new passwords.
        const { currentPassword, newPassword } = values;
        const response = await fetch('/api/auth/change-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ currentPassword, newPassword }),
        });

        const data = await response.json();

        if (response.ok && data.isSuccess) {
            toast({ title: "Success", description: "Your password has been changed successfully. Please log in again." });
            form.reset();
            // Optional: force logout after password change for better security
            await fetch('/api/auth/portal/logout', { method: 'POST' });
            window.location.href = '/portal/login';
        } else {
            toast({ title: "Error", description: data.errors?.join(', ') || "Failed to change password.", variant: "destructive" });
        }
    } catch (error) {
        toast({ title: "Error", description: "An unexpected error occurred while changing your password.", variant: "destructive" });
    } finally {
        setIsSaving(false);
    }
  };

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-destructive flex items-center gap-2"><AlertTriangle/> Error</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Could not load your profile data: {error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!initialTenant) {
     return (
      <Card>
        <CardHeader>
          <CardTitle className="text-destructive flex items-center gap-2"><AlertTriangle/> Error</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Could not load user profile. Please try logging in again.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="font-headline text-xl">Your Information</CardTitle>
          <CardDescription>This is the information associated with your tenant profile.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="name" className="flex items-center"><User className="mr-2 h-4 w-4 text-primary" /> Name</Label>
            <Input id="name" value={initialTenant.name} readOnly disabled />
          </div>
          <div className="space-y-1">
            <Label htmlFor="email" className="flex items-center"><Mail className="mr-2 h-4 w-4 text-primary" /> Email</Label>
            <Input id="email" value={initialTenant.email} readOnly disabled />
          </div>
           <div className="space-y-1">
            <Label htmlFor="phone" className="flex items-center"><Phone className="mr-2 h-4 w-4 text-primary" /> Phone Number</Label>
            <Input id="phone" value={initialTenant.phone || 'N/A'} readOnly disabled />
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="font-headline text-xl">Change Password</CardTitle>
          <CardDescription>Update your password for security.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleChangePasswordSubmit)} className="space-y-4">
               <FormField
                    control={form.control}
                    name="currentPassword"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel className="flex items-center"><Lock className="mr-2 h-4 w-4 text-primary" />Current Password</FormLabel>
                            <div className="relative">
                                <FormControl>
                                    <Input type={showCurrentPassword ? 'text' : 'password'} placeholder="••••••••" {...field} />
                                </FormControl>
                                <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 text-muted-foreground" onClick={() => setShowCurrentPassword(!showCurrentPassword)}>
                                  {showCurrentPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                </Button>
                            </div>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="newPassword"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel className="flex items-center"><Lock className="mr-2 h-4 w-4 text-primary" />New Password</FormLabel>
                            <div className="relative">
                                <FormControl>
                                    <Input type={showNewPassword ? 'text' : 'password'} placeholder="••••••••" {...field} />
                                </FormControl>
                                <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 text-muted-foreground" onClick={() => setShowNewPassword(!showNewPassword)}>
                                  {showNewPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                </Button>
                            </div>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="confirmPassword"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel className="flex items-center"><Lock className="mr-2 h-4 w-4 text-primary" />Confirm New Password</FormLabel>
                            <div className="relative">
                                <FormControl>
                                    <Input type={showConfirmPassword ? 'text' : 'password'} placeholder="••••••••" {...field} />
                                </FormControl>
                                <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 text-muted-foreground" onClick={() => setShowConfirmPassword(!showConfirmPassword)}>
                                  {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                </Button>
                            </div>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                 <Button type="submit" disabled={isSaving} className="w-full">
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Update Password
                </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
