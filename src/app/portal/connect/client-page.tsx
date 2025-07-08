
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { setPortalSessionAction } from '../actions';
import { Loader2 } from 'lucide-react';

interface Props {
  token: string;
  phone: string;
}

export function ConnectionSuccessPage({ token, phone }: Props) {
  const router = useRouter();

  useEffect(() => {
    async function establishSessionAndRedirect() {
      const result = await setPortalSessionAction(token);
      if (result.success) {
        router.push(`/portal/billing?phone=${encodeURIComponent(phone)}`);
      } else {
        router.push(`/portal/connect/error?message=session_failed`);
      }
    }
    establishSessionAndRedirect();
  }, [token, phone, router]);

  return (
    <div className="flex flex-col justify-center items-center h-screen w-screen text-center p-4">
      <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
      <h1 className="text-xl font-semibold text-foreground">Connection successful</h1>
      <p className="text-muted-foreground">Redirecting to your billing portal...</p>
    </div>
  );
}
