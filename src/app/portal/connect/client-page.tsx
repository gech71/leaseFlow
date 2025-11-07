
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { setPortalSessionAction } from '../actions';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Props {
  token: string;
  phone: string;
}

export function ConnectionSuccessPage({ token, phone }: Props) {
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    async function establishSessionAndRedirect() {
      // This is a temporary solution for the portal.
      // We are essentially trusting the NIB token validation and auto-logging in the user.
      // A more robust solution might involve creating a custom NextAuth provider.
      const result = await setPortalSessionAction(token, phone);
      if (result.success) {
        router.push(`/portal/dashboard`);
      } else {
        toast({
          title: "Session Error",
          description: result.error || "Failed to create a secure session.",
          variant: "destructive",
        });
        router.push(`/portal/connect/error?message=session_failed`);
      }
    }
    establishSessionAndRedirect();
  }, [token, phone, router, toast]);

  return (
    <div className="flex flex-col justify-center items-center h-screen w-screen text-center p-4">
      <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
      <h1 className="text-xl font-semibold text-foreground">Connection successful</h1>
      <p className="text-muted-foreground">Redirecting to your dashboard...</p>
    </div>
  );
}
