
'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Eye, EyeOff, Lock, CheckCircle, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useRouter } from 'next/navigation';

const resetPasswordSchema = z.object({
  newPassword: z.string().min(6, { message: "New password must be at least 6 characters." }),
  confirmPassword: z.string()
}).refine(data => data.newPassword === data.confirmPassword, {
  message: "Passwords do not match.",
  path: ["confirmPassword"]
});

type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  
  const [isLoading, setIsLoading] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const phone = searchParams.get('phone');
  const token = searchParams.get('token');

  const form = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { newPassword: "", confirmPassword: "" }
  });

  const handleResetPassword = async (values: ResetPasswordValues) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/Auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: phone,
          token: token,
          newPassword: values.newPassword
        }),
      });

      const data = await response.json();

      if (response.ok && data.isSuccess) {
        toast({
          title: "Success",
          description: "Password has been reset successfully. The user can now log in with their new password.",
        });
        router.push('/admin/settings/user-management');
      } else {
        toast({ title: "Reset Failed", description: data.errors?.join(', ') || "Failed to reset password. The link may have expired.", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Request Error", description: "Could not connect to the authentication service.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  if (!phone || !token) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="text-center">
          <AlertTriangle className="mx-auto h-12 w-12 text-destructive" />
          <CardTitle className="mt-4">Invalid Link</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground">The password reset link is incomplete or has expired. Please try the process again.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <CardTitle>Reset Password</CardTitle>
        <CardDescription>Enter a new password for the user with phone number: {phone}.</CardDescription>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleResetPassword)}>
          <CardContent className="space-y-4">
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
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
              Set New Password
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}

export default function AdminResetPasswordPage() {
    return (
        <Suspense fallback={<div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
            <ResetPasswordForm />
        </Suspense>
    )
}
