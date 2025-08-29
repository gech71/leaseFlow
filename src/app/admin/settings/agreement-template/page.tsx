import { Suspense } from 'react';
import { PageHeader } from '@/components/custom/PageHeader';
import { FileText, ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { AgreementTemplateClientPage } from './client-page';
import { getAgreementTemplateAction } from './actions';

export const dynamic = 'force-dynamic';

async function AgreementTemplateDataFetcher() {
    const { success, template, error } = await getAgreementTemplateAction();
    return <AgreementTemplateClientPage initialTemplate={template} error={error} />;
}

export default function AgreementTemplatePage() {
  return (
    <div className="animate-fadeIn">
      <PageHeader
        title="Agreement Template"
        icon={FileText}
        description="Edit the default rental agreement template used for all new leases."
        actions={
          <Link href="/admin/settings" passHref>
            <Button variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Settings
            </Button>
          </Link>
        }
      />
      <Suspense fallback={<div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
        <AgreementTemplateDataFetcher />
      </Suspense>
    </div>
  );
}
