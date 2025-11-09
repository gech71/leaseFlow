import type { Metadata } from 'next';
import { headers } from 'next/headers';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { SessionProvider } from 'next-auth/react'; // Required for client components using useSession
import { auth } from '@/auth'; // Import the auth function from your new auth.ts

export const metadata: Metadata = {
  title: 'LeaseFlow',
  description: 'A comprehensive building management solution.',
  icons: { icon: 'https://i.imgur.com/JTzGpIH.png' },
};

export default async function RootLayout({
  children,
}: { children: React.ReactNode }) {
  const nonce = (await headers()).get('x-nonce') || undefined;
  const session = await auth(); // Get the session on the server

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
        {/* Pass the server-side session to the SessionProvider */}
        <SessionProvider session={session}>
          {children}
          <Toaster />
        </SessionProvider>
      </body>
    </html>
  );
}
