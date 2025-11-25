
export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { ViewAgreementClientPage, type AgreementWithRelations } from './client-page';
import { getAgreementDetailsForPortalAction } from '../../actions';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/custom/PageHeader';
import { FileText, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

// Server Component to fetch initial data
export default async function ViewAgreementPortalPage({ params }: { params: { id: string } }) {
  const { id } = params;
  
  const { agreement: agreementData, error } = await getAgreementDetailsForPortalAction(id);

  if (error || !agreementData) {
    const dashboardUrl = new URL("/portal/dashboard", process.env.NEXTAUTH_URL);
    dashboardUrl.searchParams.set("error", error || "Agreement not found or you do not have permission to view it.");
    redirect(dashboardUrl.toString());
  }
  
  return (
    <>
      <PageHeader
        title={`Agreement Details`}
        icon={FileText}
        description={`For tenant: ${agreementData.tenant?.name || 'N/A'}`}
        actions={
            <Link href="/portal/dashboard" passHref>
                <Button variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
                </Button>
            </Link>
        }
      />
      <Suspense fallback={<div className="flex justify-center items-center h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary"/></div>}>
        <ViewAgreementClientPage agreement={agreementData} />
      </Suspense>
    </>
  );
}

