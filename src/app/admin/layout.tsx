import type React from 'react';
import AdminClientLayout from './admin-client-layout';
import type { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import AuthProvider from '@/contexts/AuthProvider';

export const metadata: Metadata = {
  title: 'LeaseFlow',
  description: 'A comprehensive building management solution.',
  icons: {
    icon: 'https://i.imgur.com/JTzGpIH.png',
  },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  return (
    <AuthProvider session={session}>
        <AdminClientLayout>{children}</AdminClientLayout>
    </AuthProvider>
  );
}
