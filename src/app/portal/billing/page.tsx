import { Suspense } from 'react';
import { BillingClientPage } from './client-page';
import { Loader2 } from 'lucide-react';

// This Server Component extracts the phone number from the URL
// and passes it to the Client Component.
export default function BillingPage({ searchParams }: { searchParams: { phone?: string } }) {
  const initialPhone = searchParams.phone || '';

  return (
    <Suspense fallback={<div className="flex justify-center items-center h-[80vh]"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>}>
      <BillingClientPage initialPhone={initialPhone} />
    </Suspense>
  );
}
