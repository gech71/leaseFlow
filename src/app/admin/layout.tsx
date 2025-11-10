import type React from 'react';
import AdminClientLayout from './admin-client-layout';
import type { Metadata } from 'next';
import { auth } from '@/auth';
import { SessionProvider } from 'next-auth/react';
import { PermissionProvider } from '@/contexts/PermissionContext';


export const metadata: Metadata = {
  title: 'LeaseFlow',
  description: 'A comprehensive building management solution.',
  icons: {
    icon: 'https://i.imgur.com/JTzGpIH.png',
  },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  return (
    <SessionProvider session={session}>
      <PermissionProvider>
        <AdminClientLayout>{children}</AdminClientLayout>
      </PermissionProvider>
    </SessionProvider>
  );
}
