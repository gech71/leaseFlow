
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { SessionProvider } from 'next-auth/react';
import AdminClientLayout from './admin/admin-client-layout';
import { auth } from './lib/auth';
import { redirect } from 'next/navigation';


export const metadata: Metadata = {
  title: 'NIB Building Management Solution',
  description: 'A comprehensive building management solution.',
  icons: { icon: 'https://i.imgur.com/JTzGpIH.png' },
};

export default async function RootLayout({
  children,
}: { children: React.ReactNode }) {
  const nonce = (await headers()).get('x-nonce') || undefined;
  const session = await auth();

  // If there's a session, we wrap with the AdminClientLayout
  // This logic correctly separates the public view (no session) from the admin view.
  const childrenWithLayout = session ? (
    <AdminClientLayout>{children}</AdminClientLayout>
  ) : (
    children
  );

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="https://i.imgur.com/JTzGpIH.png" type="image/png" sizes="any" />
        <link rel="preconnect" href="https://fonts.googleapis.com" nonce={nonce} />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
          nonce={nonce}
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
          nonce={nonce}
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&display=swap"
          rel="stylesheet"
          nonce={nonce}
        />
      </head>
      <body className="font-body antialiased">
        <SessionProvider session={session}>
          {childrenWithLayout}
          <Toaster />
        </SessionProvider>
      </body>
    </html>
  );
}
