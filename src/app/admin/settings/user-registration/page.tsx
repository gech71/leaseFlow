
"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserPlus, Loader2, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const registrationFormSchema = z.object({
  firstName: z.string().min(1, { message: "First name is required." }),
  lastName: z.string().min(1, { message: "Last name is required." }),
  phoneNumber: z.string().min(1, { message: "Phone number is required." })
                 .regex(/^(09|07)\d{8}$/, { message: "Phone number must start with 09 or 07 and be 10 digits long (e.g., 0912345678)."}),
  email: z.string().email({ message: "Invalid email address." }),
  password: z.string().min(6, { message: "Password must be at least 6 characters." }),
});

type RegistrationFormValues = z.infer<typeof registrationFormSchema>;

export default function UserRegistrationPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const form = useForm<RegistrationFormValues>({
    resolver: zodResolver(registrationFormSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      phoneNumber: "",
      email: "",
      password: "",
    },
  });

  const handleRegisterUser = async (values: RegistrationFormValues) => {
    setIsLoading(true);
    setApiError(null);

    try {
      const response = await fetch('/api/admin/register-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

      const data = await response.json();

      if (response.ok && data.isSuccess) {
        toast({
          title: "User Registered Successfully",
          description: `User ${values.email} (ID: ${data.userId}) has been created.`,
        });
        form.reset(); // Reset form after successful registration
        // Optionally, redirect or refresh data
        // router.push('/admin/users'); // If you have a user list page
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

  return (
    <Card className="w-full max-w-2xl mx-auto shadow-lg">
      <CardHeader>
        <CardTitle className="font-headline text-xl flex items-center">
          <UserPlus className="mr-2 h-6 w-6 text-primary" /> Register New User
        </CardTitle>
        <CardDescription>
          Enter the details for the new user. They will be registered with the external identity provider and a local record will be created.
          New users are assigned the 'SUPPORT_STAFF' role by default.
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
              <FormField control={form.control} name="firstName" render={({ field }) => ( <FormItem> <FormLabel>First Name</FormLabel> <FormControl><Input placeholder="John" {...field} disabled={isLoading} /></FormControl> <FormMessage /> </FormItem> )}/>
              <FormField control={form.control} name="lastName" render={({ field }) => ( <FormItem> <FormLabel>Last Name</FormLabel> <FormControl><Input placeholder="Doe" {...field} disabled={isLoading} /></FormControl> <FormMessage /> </FormItem> )}/>
            </div>
            <FormField control={form.control} name="email" render={({ field }) => ( <FormItem> <FormLabel>Email Address</FormLabel> <FormControl><Input type="email" placeholder="user@example.com" {...field} disabled={isLoading} /></FormControl> <FormMessage /> </FormItem> )}/>
            <FormField control={form.control} name="phoneNumber" render={({ field }) => ( <FormItem> <FormLabel>Phone Number</FormLabel> <FormControl><Input type="tel" placeholder="0912345678" {...field} disabled={isLoading} /></FormControl> <FormMessage /> </FormItem> )}/>
            <FormField control={form.control} name="password" render={({ field }) => ( <FormItem> <FormLabel>Password</FormLabel> <FormControl><Input type="password" placeholder="••••••••" {...field} disabled={isLoading} /></FormControl> <FormMessage /> </FormItem> )}/>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full md:w-auto bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isLoading}>
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
