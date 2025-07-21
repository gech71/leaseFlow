
import { Suspense } from 'react';
import { ResetPasswordClientPage } from './client-page';
import { Loader2 } from 'lucide-react';

// This is now a Server Component
export default function ResetPasswordPage() {
  return (
    // The Suspense boundary is required by Next.js when a child component uses useSearchParams
    <Suspense fallback={
        <div className="flex justify-center items-center h-screen w-screen">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
    }>
      <ResetPasswordClientPage />
    </Suspense>
  );
}
