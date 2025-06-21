
import type React from 'react';
import AdminClientLayoutWrapper from './admin-client-layout-wrapper';
// No direct PermissionProvider here; it's inside AdminClientLayoutWrapper

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminClientLayoutWrapper>{children}</AdminClientLayoutWrapper>
  );
}

