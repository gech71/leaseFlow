
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { signIn } from 'next-auth/react';

interface Props {
  phone: string;
}

export function ConnectionSuccessPage({ phone }: Props) {
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    async function establishSessionAndRedirect() {
      // For the mini-app flow, we are not checking passwords.
      // The trust is based on the validated NIB token. We use a dummy password.
      const result = await signIn("credentials", {
        redirect: false,
        phoneNumber: phone,
        password: `mini-app-login-placeholder`, // Dummy password
        isFromMiniApp: "true",
      });

      if (result?.ok) {
        // Redirect to the portal dashboard on successful session creation.
        router.push(`/portal/dashboard`);
      } else {
        toast({
          title: "Session Error",
          description: "Failed to create a secure session.",
          variant: "destructive",
        });
        // Redirect to a user-friendly error page within the portal.
        router.push(`/portal/connect/error?message=session_failed`);
      }
    }
    establishSessionAndRedirect();
  }, [phone, router, toast]);

  return (
    <div className="flex flex-col justify-center items-center h-screen w-screen text-center p-4">
      <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
      <h1 className="text-xl font-semibold text-foreground">Connection successful</h1>
      <p className="text-muted-foreground">Creating a secure session and redirecting...</p>
    </div>
  );
}
