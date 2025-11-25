
"use client";

import React, { useState } from 'react';
import { usePermissions } from '@/contexts/PermissionContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader2, KeyRound, Lock, Eye, EyeOff } from 'lucide-react';
import { changePassword } from './actions';

const changePasswordSchema = z.object({
  newPassword: z.string().min(6, { message: "New password must be at least 6 characters." }),
  confirmPassword: z.string()
}).refine(data => data.newPassword === data.confirmPassword, {
  message: "New passwords do not match.",
  path: ["confirmPassword"]
});

type ChangePasswordValues = z.infer<typeof changePasswordSchema>;

interface ChangePasswordClientPageProps {
  isForcedChange: boolean;
}

export function ChangePasswordClientPage({ isForcedChange }: ChangePasswordClientPageProps) {
  const { logout } = usePermissions();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const form = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { newPassword: "", confirmPassword: "" }
  });

  const handleChangePasswordSubmit = async (values: ChangePasswordValues) => {
    setIsSaving(true);
    try {
      const result = await changePassword({ newPassword: values.newPassword });
      if (result.success) {
        toast({ title: "Success", description: "Your password has been changed. Please log in with your new password." });
        await logout();
      } else {
        toast({ title: "Error", description: result.error, variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "An unexpected error occurred.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="shadow-lg">
      <CardHeader className="text-center">
        <KeyRound className="mx-auto h-12 w-12 text-primary" />
        <CardTitle className="mt-4 font-headline text-2xl">
            Set Your New Password
        </CardTitle>
        <CardDescription>
          For your security, you must set a new password.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleChangePasswordSubmit)} className="space-y-4">
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
              Set New Password & Log In
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
