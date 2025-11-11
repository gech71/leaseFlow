
'use client';

import { Suspense, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Eye, EyeOff, Lock, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { forceChangePasswordAction } from './actions';

const resetPasswordSchema = z.object({
  newPassword: z.string()
    .min(8, "Password must be at least 8 characters long.")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter.")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter.")
    .regex(/[0-9]/, "Password must contain at least one number.")
    .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character."),
  confirmPassword: z.string()
}).refine(data => data.newPassword === data.confirmPassword, {
  message: "Passwords do not match.",
  path: ["confirmPassword"]
});

type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;

function ChangePasswordForm() {
  const router = useRouter();
  const { toast } = useToast();
  
  const [isLoading, setIsLoading] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const form = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { newPassword: "", confirmPassword: "" }
  });

  const handleResetPassword = async (values: ResetPasswordValues) => {
    setIsLoading(true);
    const result = await forceChangePasswordAction({ newPassword: values.newPassword });

    if (result.success) {
      toast({
        title: "Password Updated",
        description: "Your password has been changed successfully. Please log in with your new credentials.",
      });
      router.push('/login');
    } else {
      toast({ title: "Update Failed", description: result.error, variant: "destructive" });
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-md mx-auto shadow-lg">
        <CardHeader className="text-center">
          <CardTitle>Create New Password</CardTitle>
          <CardDescription>For your security, you must create a new password to continue.</CardDescription>
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
                                  <Input type={showNewPassword ? 'text' : 'password'} placeholder="••••••••" {...field} disabled={isLoading} />
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
                                  <Input type={showConfirmPassword ? 'text' : 'password'} placeholder="••••••••" {...field} disabled={isLoading}/>
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
                Set New Password and Log In
              </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </div>
  );
}

export default function TenantChangePasswordPage() {
    return (
        <Suspense fallback={<div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
            <ChangePasswordForm />
        </Suspense>
    )
}
