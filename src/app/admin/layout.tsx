import type React from 'react';
import AdminClientLayout from './admin-client-layout';
import type { Metadata } from 'next';
import { auth } from '@/auth'; // Use the new auth function
import { SessionProvider } from 'next-auth/react'; // SessionProvider is still needed for client components

export const metadata: Metadata = {
  title: 'LeaseFlow',
  description: 'A comprehensive building management solution.',
  icons: {
    icon: 'https://i.imgur.com/JTzGpIH.png',
  },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth(); // Get session on the server
  return (
    <SessionProvider session={session}>
        <AdminClientLayout>{children}</AdminClientLayout>
    </SessionProvider>
  );
}
