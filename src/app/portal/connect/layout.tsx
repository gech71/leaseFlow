
// This layout file ensures that the /portal/connect route and its children
// do not inherit the main portal layout, effectively removing the header and footer.
export default function ConnectLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
