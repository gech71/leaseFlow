
import type React from 'react';

// This layout is now a simple pass-through. 
// The main layout logic is handled by the root layout.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
