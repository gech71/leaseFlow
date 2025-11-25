
"use client";

import { useSearchParams, redirect } from 'next/navigation';
import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { BillingClientPage } from './client-page';

function BillingPageContent() {
  const searchParams = useSearchParams();
  const phone = searchParams.get('phone');

  if (!phone) {
    // Redirect or show an error if phone is missing
    redirect('/portal/connect/error?message=phone_missing');
    return null;
  }

  return <BillingClientPage initialPhone={phone} />;
}

export default function BillingPage() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary"/></div>}>
      <BillingPageContent />
    </Suspense>
  );
}
