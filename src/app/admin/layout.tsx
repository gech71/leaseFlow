
import type React from 'react';
import AdminClientLayoutWrapper from './admin-client-layout-wrapper';

// This AdminLayout is now a Server Component by default (no "use client")
// It simply delegates to the client component that will handle providers and layout
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminClientLayoutWrapper>{children}</AdminClientLayoutWrapper>
  );
}
