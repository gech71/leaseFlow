
"use client";

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { usePermissions } from '@/contexts/PermissionContext';
import { Loader2, KeyRound, Save, Eye, EyeOff, AlertTriangle } from 'lucide-react';
import { updateSmtpPasswordAction } from './actions';

const passwordFormSchema = z.object({
  newPassword: z.string().min(1, { message: "App Password cannot be empty." }),
});
type PasswordFormValues = z.infer<typeof passwordFormSchema>;

interface EmailConfigurationClientPageProps {
  initialSmtpUser: string;
  initialIsSmtpPassSet: boolean;
  error?: string;
}

export function EmailConfigurationClientPage({ initialSmtpUser, initialIsSmtpPassSet, error }: EmailConfigurationClientPageProps) {
  const { toast } = useToast();
  const { isSuperAdmin } = usePermissions();
  const [isSaving, setIsSaving] = useState(false);
  const [isSmtpPassSet, setIsSmtpPassSet] = useState(initialIsSmtpPassSet);
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: { newPassword: "" },
  });

  const handlePasswordSubmit = async (values: PasswordFormValues) => {
    setIsSaving(true);
    const result = await updateSmtpPasswordAction(values.newPassword);
    setIsSaving(false);
    if (result.success) {
      toast({ title: "Success", description: "SMTP App Password has been updated securely." });
      form.reset();
      setIsSmtpPassSet(true);
    } else {
      toast({ title: "Error", description: result.error, variant: "destructive" });
    }
  };

  if (error) {
    return (
        <Card className="shadow-lg">
            <CardHeader><CardTitle className="text-destructive">Error Loading Configuration</CardTitle></CardHeader>
            <CardContent><p>{error}</p></CardContent>
        </Card>
    );
  }

  return (
    <div className="grid gap-8 md:grid-cols-2">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Email Setup Used by Your System</CardTitle>
          <CardDescription>
            These are the settings the application is currently using. The user is from your environment variables, and the password is secure in the database.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="smtpUser">Email Address</Label>
            <Input id="smtpUser" value={initialSmtpUser || 'Not Set'} readOnly disabled />
          </div>
          <div className="space-y-1">
            <Label htmlFor="smtpPass">App Password Status</Label>
            <Input id="smtpPass" value={isSmtpPassSet ? 'Set & Encrypted' : 'Not Set'} readOnly disabled />
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handlePasswordSubmit)} className="space-y-4 pt-4 border-t">
              <FormField
                control={form.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center">
                      <KeyRound className="mr-2 h-4 w-4" /> New App Password
                    </FormLabel>
                    <div className="relative">
                      <FormControl>
                        <Input
                          type={showPassword ? 'text' : 'password'}
                          placeholder="Enter new 16-character App Password"
                          {...field}
                          disabled={!isSuperAdmin || isSaving}
                        />
                      </FormControl>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 text-muted-foreground"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </Button>
                    </div>
                    {!isSuperAdmin && <p className="text-xs text-muted-foreground">Only a Super Admin can change the password.</p>}
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={!isSuperAdmin || isSaving}>
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save New Password
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card className="shadow-lg bg-secondary/30 border-primary/20">
          <CardHeader>
            <CardTitle>How to Update Credentials</CardTitle>
            <CardDescription>
              To change these settings, you must first generate a new password from your email provider.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            
            <div>
              <h4 className="font-semibold mb-1">Step 1: Generate a Gmail App Password</h4>
              <p className="text-muted-foreground">
                For security, you cannot use your regular Gmail password. You must generate a special "App Password".
              </p>
              <ol className="list-decimal list-inside mt-2 space-y-1 text-muted-foreground">
                <li>Go to your Google Account settings at <a href="https://myaccount.google.com/" target="_blank" rel="noopener noreferrer" className="text-primary underline">myaccount.google.com</a>.</li>
                <li>Navigate to the "Security" section.</li>
                <li>Under "How you sign in to Google", find and click on "2-Step Verification". You must have this enabled.</li>
                <li>At the bottom of the 2-Step Verification page, click on "App passwords".</li>
                <li>Generate a new password.</li>
                <li>Copy the 16-character password that is generated.</li>
              </ol>
            </div>
             <div>
              <h4 className="font-semibold mb-1">Step 2: Update Password Above</h4>
              <p className="text-muted-foreground">
                Paste the 16-character password into the "New App Password" field on the left and click "Save".
              </p>
            </div>
          </CardContent>
        </Card>
    </div>
  );
}
