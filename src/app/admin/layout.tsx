
import type React from 'react';
import AdminClientLayoutWrapper from './admin-client-layout-wrapper';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'nibrental',
  description: 'A comprehensive building management solution.',
  icons: {
    icon: 'https://i.imgur.com/JTzGpIH.png',
  },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminClientLayoutWrapper>{children}</AdminClientLayoutWrapper>
  );
}
