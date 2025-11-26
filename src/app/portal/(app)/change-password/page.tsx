
import { Suspense } from 'react';
import { PageHeader } from '@/components/custom/PageHeader';
import { KeyRound, Loader2 } from 'lucide-react';
import { ChangePasswordClientPage } from './client-page';
import { verifySession } from '@/lib/auth/jwt';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

async function ChangePasswordPageDataFetcher() {
  const session = await verifySession();
  const isForcedChange = session?.forceChangePass || false;

  // This check is now secondary, as middleware handles the primary redirect.
  if (!isForcedChange) {
    redirect('/portal/dashboard');
  }

  return <ChangePasswordClientPage isForcedChange={isForcedChange} />;
}

export default function TenantChangePasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-100 dark:bg-gray-900 p-4">
      <div className="w-full max-w-md">
        <Suspense fallback={<div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
          <ChangePasswordPageDataFetcher />
        </Suspense>
      </div>
    </main>
  );
}
