// This layout file ensures that the /portal/billing route
// does not inherit the main portal layout, effectively removing the header and footer.
export default function BillingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
