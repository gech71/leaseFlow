
import React from 'react';
import { PageHeader } from '@/components/custom/PageHeader';
import { Settings as SettingsIcon, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="animate-fadeIn">
      <PageHeader
        title="Application Settings"
        icon={SettingsIcon}
        description="Manage users and other application configurations."
      />
      {/* Add navigation for sub-settings pages if needed in the future */}
      {/* e.g., a Tabs component or a simple list of links */}
      {/* 
      <nav className="mb-6">
        <Link href="/admin/settings/user-registration" className="mr-4 hover:underline">User Registration</Link>
        // Other settings links
      </nav>
      */}
      <div className="mt-6">
        {children}
      </div>
    </div>
  );
}
