
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { UserPlus, Users, ShieldCheck, Mail, KeyRound, FileText } from 'lucide-react'; // Added FileText
import Link from 'next/link';

// This page will act as a hub for different settings.
export default function SettingsPage() {
  return (
    <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
      <Card className="flex flex-col">
        <CardHeader>
          <CardTitle className="font-headline">User Registration</CardTitle>
          <CardDescription>
            Register new users for the application.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-grow">
          <p className="text-sm text-muted-foreground mb-4">
            Create new accounts. New users are created without any roles by default.
          </p>
        </CardContent>
        <CardFooter>
          <Link href="/admin/settings/user-registration" passHref>
            <Button>
              <UserPlus className="mr-2 h-4 w-4" /> Go to User Registration
            </Button>
          </Link>
        </CardFooter>
      </Card>

      <Card className="flex flex-col">
        <CardHeader>
          <CardTitle className="font-headline">User Management</CardTitle>
          <CardDescription>
            Manage user roles and the buildings they are assigned to.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-grow">
          <p className="text-sm text-muted-foreground mb-4">
            Assign roles and buildings to users to control access and responsibilities.
          </p>
        </CardContent>
        <CardFooter>
          <Link href="/admin/settings/user-management" passHref>
            <Button>
              <Users className="mr-2 h-4 w-4" /> Go to User Management
            </Button>
          </Link>
        </CardFooter>
      </Card>

      <Card className="flex flex-col">
        <CardHeader>
          <CardTitle className="font-headline">Role Management</CardTitle>
          <CardDescription>
            Define roles and their permissions within the application.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-grow">
          <p className="text-sm text-muted-foreground mb-4">
            Create new roles, or edit existing ones to specify what actions users with that role can perform.
          </p>
        </CardContent>
        <CardFooter>
          <Link href="/admin/settings/role-management" passHref>
            <Button>
              <ShieldCheck className="mr-2 h-4 w-4" /> Go to Role Management
            </Button>
          </Link>
        </CardFooter>
      </Card>

      <Card className="flex flex-col">
        <CardHeader>
          <CardTitle className="font-headline">Email Configuration</CardTitle>
          <CardDescription>
            View current Email setup settings used for sending system emails.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-grow">
          <p className="text-sm text-muted-foreground mb-4">
            check which email account is used for system notifications
          </p>
        </CardContent>
        <CardFooter>
          <Link href="/admin/settings/email-configuration" passHref>
            <Button>
              <Mail className="mr-2 h-4 w-4" /> View Configuration
            </Button>
          </Link>
        </CardFooter>
      </Card>

      <Card className="flex flex-col">
        <CardHeader>
          <CardTitle className="font-headline">Agreement Template</CardTitle>
          <CardDescription>
            Define the standard rental agreement template for generating new leases.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-grow">
          <p className="text-sm text-muted-foreground mb-4">
            Use placeholders like {'{{tenantName}}'} to automatically insert details. This template will be used on the agreement generation page.
          </p>
        </CardContent>
        <CardFooter>
          <Link href="/admin/settings/agreement-template" passHref>
            <Button>
              <FileText className="mr-2 h-4 w-4" /> Manage Template
            </Button>
          </Link>
        </CardFooter>
      </Card>

       <Card className="flex flex-col">
        <CardHeader>
          <CardTitle className="font-headline">Forgot Password</CardTitle>
          <CardDescription>
            Initiate the password reset process for an account.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-grow">
          <p className="text-sm text-muted-foreground mb-4">
            Use this if you need to recover access to your account via the standard password reset flow.
          </p>
        </CardContent>
        <CardFooter>
          <Link href="/auth/forgot-password" passHref>
            <Button>
              <KeyRound className="mr-2 h-4 w-4" /> Reset Password
            </Button>
          </Link>
        </CardFooter>
      </Card>

      {/* Future settings cards can be added here */}
    </div>
  );
}
