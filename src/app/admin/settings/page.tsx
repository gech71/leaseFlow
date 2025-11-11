
"use client";

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { UserPlus, Users, ShieldCheck, Mail, KeyRound, FileText, UploadCloud } from 'lucide-react';
import Link from 'next/link';
import { usePermissions } from '@/contexts/PermissionContext';

// This page will act as a hub for different settings.
export default function SettingsPage() {
  const { hasAnyPermission, isSuperAdmin } = usePermissions();

  const canManageUserRegistration = isSuperAdmin || hasAnyPermission(['settings:user_registration:manage']);
  const canManageUserManagement = isSuperAdmin || hasAnyPermission(['settings:user_management:view', 'settings:user_management:assign']);
  const canManageRoleManagement = isSuperAdmin || hasAnyPermission(['settings:role_management:view', 'settings:role_management:manage']);
  const canManageAgreementTemplates = isSuperAdmin || hasAnyPermission(['settings:agreement_templates:manage']);
  const canManageEmailConfig = isSuperAdmin || hasAnyPermission(['settings:email_configuration:view', 'settings:email_configuration:manage']);
  const canManageImport = isSuperAdmin || hasAnyPermission(['import:manage']);

  return (
    <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
      {canManageUserRegistration && (
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
      )}

      {canManageUserManagement && (
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
      )}

      {canManageRoleManagement && (
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
      )}
      
      {canManageAgreementTemplates && (
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle className="font-headline">Agreement Templates</CardTitle>
            <CardDescription>
              Manage reusable templates for generating new lease agreements.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-grow">
            <p className="text-sm text-muted-foreground mb-4">
              Create and edit standard agreement text. Use placeholders to automatically insert details during generation.
            </p>
          </CardContent>
          <CardFooter>
            <Link href="/admin/settings/agreement-template" passHref>
              <Button>
                <FileText className="mr-2 h-4 w-4" /> Manage Templates
              </Button>
            </Link>
          </CardFooter>
        </Card>
      )}

      {canManageEmailConfig && (
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
      )}
      
      {canManageImport && (
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle className="font-headline">Import Data</CardTitle>
            <CardDescription>
              Bulk import spaces, tenants, and agreements.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-grow">
            <p className="text-sm text-muted-foreground mb-4">
              Use an Excel template to quickly upload multiple records into the system at once.
            </p>
          </CardContent>
          <CardFooter>
            <Link href="/admin/import" passHref>
              <Button>
                <UploadCloud className="mr-2 h-4 w-4" /> Go to Import Tool
              </Button>
            </Link>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
