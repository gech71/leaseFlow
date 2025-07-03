
import type React from 'react';
import AdminClientLayoutWrapper from './admin-client-layout-wrapper';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Building Management Solution',
  description: 'A comprehensive building management solution.',
  icons: {
    icon: 'https://play-lh.googleusercontent.com/bXqMt9ROsGd0H9vPhib5hG-0NB-EJcAwZy6UUDhvlP-ykE595IMQtzr14R6IRWtJiGTh',
  },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminClientLayoutWrapper>{children}</AdminClientLayoutWrapper>
  );
}
