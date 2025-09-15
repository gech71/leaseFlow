
import type React from 'react';
import AdminClientLayout from './admin-client-layout';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'NIB Building Management Solution',
  description: 'A comprehensive building management solution.',
  icons: {
    icon: 'https://i.imgur.com/JTzGpIH.png',
  },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminClientLayout>{children}</AdminClientLayout>
  );
}

    