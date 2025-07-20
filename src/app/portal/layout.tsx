// This file is now empty as the layout has been moved to /portal/(app)/layout.tsx
// to avoid applying it to the /portal/connect route.
export default function PortalRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
