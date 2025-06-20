
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { UserPlus } from 'lucide-react';
import Link from 'next/link';

// This page will act as a hub for different settings.
// For now, it will primarily link to User Registration.
export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="font-headline">User Management</CardTitle>
          <CardDescription>
            Register new users for the application. This function is typically restricted to administrators.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Use the user registration tool to create new accounts. New users will be assigned a default role which can be managed later (if user role management is implemented).
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

      {/* Future settings cards can be added here */}
      {/*
      <Card>
        <CardHeader>
          <CardTitle>Other Settings Section</CardTitle>
          <CardDescription>Description for other settings.</CardDescription>
        </CardHeader>
        <CardContent>
          <p>Details and controls for other settings.</p>
        </CardContent>
      </Card>
      */}
    </div>
  );
}
