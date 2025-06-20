
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { UserPlus, Users } from 'lucide-react'; // Added Users icon
import Link from 'next/link';

// This page will act as a hub for different settings.
export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="font-headline">User Registration</CardTitle>
          <CardDescription>
            Register new users for the application. This function is typically restricted to administrators.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Use the user registration tool to create new accounts. New users will be created without any roles assigned by default.
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

      <Card>
        <CardHeader>
          <CardTitle className="font-headline">User Management</CardTitle>
          <CardDescription>
            Manage user roles and the buildings they are assigned to.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Assign roles to users to control their access permissions. Assign buildings to property managers or relevant staff.
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

      {/* Future settings cards can be added here */}
    </div>
  );
}
