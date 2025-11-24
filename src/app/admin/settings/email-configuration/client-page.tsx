
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
    toast({
        title: "Manual Update Required",
        description: "For security, the SMTP password must be updated directly in the server's .env file.",
        variant: "default",
        duration: 8000,
    });
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
            These are the settings the application is currently using. They are set in the server's environment file.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="smtpUser">Email Address (SMTP_USER)</Label>
            <Input id="smtpUser" value={initialSmtpUser || 'Not Set'} readOnly disabled />
          </div>
          <div className="space-y-1">
            <Label htmlFor="smtpPass">App Password Status (SMTP_PASS)</Label>
            <Input id="smtpPass" value={isSmtpPassSet ? 'Set in Environment' : 'Not Set'} readOnly disabled />
          </div>
          <div className="p-4 bg-yellow-50 border-l-4 border-yellow-400 text-yellow-800">
            <h4 className="font-bold">Manual Update Required</h4>
            <p className="text-sm">For security reasons, email credentials can only be changed by editing the `.env` file on the server and restarting the application.</p>
          </div>
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
              <h4 className="font-semibold mb-1">Step 2: Update Server Environment</h4>
              <p className="text-muted-foreground">
                Open the `.env` file on the application server and replace the value of `SMTP_PASS` with your new 16-character password. Then, restart the application for the change to take effect.
              </p>
            </div>
          </CardContent>
        </Card>
    </div>
  );
}
