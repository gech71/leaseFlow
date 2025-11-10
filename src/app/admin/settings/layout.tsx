
import React from 'react';
import { PageHeader } from '@/components/custom/PageHeader';
import { Settings as SettingsIcon, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Building Management Solution',
  description: 'A comprehensive building management solution.',
  icons: {
    icon: 'https://i.imgur.com/JTzGpIH.png',
  },
};

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
      
      <div className="mt-6">
        {children}
      </div>
    </div>
  );
}
