
"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { KeyRound, Phone, Loader2, Send } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { usePermissions } from '@/contexts/PermissionContext';
import { PageHeader } from '@/components/custom/PageHeader';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { resetUserPasswordAction } from '../user-management/actions';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const forgotPasswordSchema = z.object({
  phoneNumber: z.string().regex(/^(09|07)\d{8}$/, { message: "Phone number must start with 09 or 07 and be 10 digits long (e.g., 0912345678)."}),
});

type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;

export default function AdminForgotPasswordPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  const { hasPermission, isSuperAdmin } = usePermissions();
  const canSendReset = isSuperAdmin || hasPermission('settings:forgot_password:send_reset');

  const form = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { phoneNumber: "" }
  });

  const handleSendReset = async (values: ForgotPasswordValues) => {
    toast({ title: "Functionality Removed", description: "This external password reset flow has been removed. Please use the password reset functionality in User Management.", variant: "destructive" });
  };

  return (
    <div className="animate-fadeIn">
        <PageHeader
            title="Password Reset"
            icon={KeyRound}
            description="This page is no longer in use. Please go to User Management to reset a user's password."
            actions={
            <Link href="/admin/settings/user-management" passHref>
                <Button variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" /> Go to User Management
                </Button>
            </Link>
            }
        />
        <Card className="w-full max-w-lg mx-auto shadow-lg opacity-50 pointer-events-none">
            <CardHeader>
                <CardTitle>Password Reset</CardTitle>
                <CardDescription>Enter the user's phone number.</CardDescription>
            </CardHeader>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSendReset)}>
                    <CardContent>
                        <FormField
                            control={form.control}
                            name="phoneNumber"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel className="flex items-center">
                                <Phone className="mr-2 h-4 w-4 text-primary" /> User's Phone Number
                                </FormLabel>
                                <FormControl>
                                <Input {...field} placeholder="Enter user's phone number" className="text-base" disabled={true} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                    </CardContent>
                    <CardFooter>
                         <Button type="submit" className="w-full" disabled={true}>
                            <Send className="mr-2 h-5 w-5" />
                            Next
                        </Button>
                    </CardFooter>
                </form>
            </Form>
        </Card>

    </div>
  );
}
