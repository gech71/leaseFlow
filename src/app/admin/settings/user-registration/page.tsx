
"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserPlus, Loader2, AlertTriangle, EyeOff, Eye } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { usePermissions } from '@/contexts/PermissionContext';

const registrationFormSchema = z.object({
  firstName: z.string().min(1, { message: "First name is required." }),
  lastName: z.string().min(1, { message: "Last name is required." }),
  phoneNumber: z.string().min(1, { message: "Phone number is required." })
                 .regex(/^(09|07)\d{8}$/, { message: "Phone number must start with 09 or 07 and be 10 digits long (e.g., 0912345678)."}),
  email: z.string().email({ message: "Invalid email address." }),
});

type RegistrationFormValues = z.infer<typeof registrationFormSchema>;

export default function UserRegistrationPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const { hasPermission, isSuperAdmin } = usePermissions();
  const canManageUsersRegistration = isSuperAdmin || hasPermission('settings:user_registration:manage');

  const form = useForm<RegistrationFormValues>({
    resolver: zodResolver(registrationFormSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      phoneNumber: "",
      email: "",
    },
  });

  const handleRegisterUser = async (values: RegistrationFormValues) => {
    if (!canManageUsersRegistration) {
      toast({ title: "Permission Denied", description: "You do not have permission to register users.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    setApiError(null);

    try {
      const response = await fetch('/api/Auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

      const data = await response.json();

      if (response.ok && data.isSuccess) {
        toast({
          title: "User Registered Successfully",
          description: `User ${values.firstName} ${values.lastName} has been created and an email with credentials has been sent. You can now assign them a role in User Management.`,
        });
        form.reset(); 
      } else {
        const errorMessages = data.errors?.join(', ') || "Failed to register user.";
        setApiError(errorMessages);
        toast({
          title: "Registration Failed",
          description: errorMessages,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Registration API call error:", error);
      const errMsg = (error as Error).message || "An unexpected error occurred. Please try again.";
      setApiError(errMsg);
      toast({
        title: "Registration Error",
        description: errMsg,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  if (!canManageUsersRegistration) {
    return (
      <Card className="w-full max-w-2xl mx-auto shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline text-xl flex items-center text-destructive">
            <EyeOff className="mr-2 h-6 w-6" /> Access Denied
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p>You do not have permission to register new users.</p>
        </CardContent>
      </Card>
    );
  }


  return (
    <Card className="w-full max-w-2xl mx-auto shadow-lg">
      <CardHeader>
        <CardTitle className="font-headline text-xl flex items-center">
          <UserPlus className="mr-2 h-6 w-6 text-primary" /> Register New User
        </CardTitle>
        <CardDescription>
          Enter the details for the new user. An account will be created and an email with a temporary password will be sent. New users are created without any roles by default.
        </CardDescription>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleRegisterUser)}>
          <CardContent className="space-y-4">
            {apiError && (
              <div className="p-3 bg-destructive/10 border border-destructive text-destructive text-sm rounded-md flex items-start">
                <AlertTriangle className="h-5 w-5 mr-2 shrink-0" />
                <p>{apiError}</p>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField control={form.control} name="firstName" render={({ field }) => ( <FormItem> <FormLabel>First Name<span className="text-destructive ml-1">*</span></FormLabel> <FormControl><Input placeholder="First Name" {...field} disabled={isLoading || !canManageUsersRegistration} /></FormControl> <FormMessage /> </FormItem> )}/>
              <FormField control={form.control} name="lastName" render={({ field }) => ( <FormItem> <FormLabel>Last Name<span className="text-destructive ml-1">*</span></FormLabel> <FormControl><Input placeholder="Last Name" {...field} disabled={isLoading || !canManageUsersRegistration} /></FormControl> <FormMessage /> </FormItem> )}/>
            </div>
            <FormField control={form.control} name="email" render={({ field }) => ( <FormItem> <FormLabel>Email Address<span className="text-destructive ml-1">*</span></FormLabel> <FormControl><Input type="email" placeholder="Email Address" {...field} disabled={isLoading || !canManageUsersRegistration} /></FormControl> <FormMessage /> </FormItem> )}/>
            <FormField control={form.control} name="phoneNumber" render={({ field }) => ( <FormItem> <FormLabel>Phone Number<span className="text-destructive ml-1">*</span></FormLabel> <FormControl><Input type="tel" placeholder="Phone Number" {...field} disabled={isLoading || !canManageUsersRegistration} /></FormControl> <FormMessage /> </FormItem> )}/>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full md:w-auto bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isLoading || !canManageUsersRegistration}>
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="mr-2 h-4 w-4" />
              )}
              Register User
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
