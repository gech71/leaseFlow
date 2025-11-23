
import { Suspense } from 'react';
import { PageHeader } from '@/components/custom/PageHeader';
import { Mail, ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { EmailConfigurationClientPage } from './client-page';
import { getSmtpConfigurationAction } from './actions';


export const dynamic = 'force-dynamic';

async function EmailConfigDataFetcher() {
    const { success, smtpUser, isSmtpPassSet, error } = await getSmtpConfigurationAction();
    return <EmailConfigurationClientPage initialSmtpUser={smtpUser} initialIsSmtpPassSet={isSmtpPassSet} error={error} />;
}

export default function EmailConfigurationPage() {
  return (
    <div className="animate-fadeIn">
      <PageHeader
        title="Email Configuration"
        icon={Mail}
        description="See the current email settings for sending messages, check which email account is used for system notifications"
        actions={
          <Link href="/admin/settings" passHref>
            <Button variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Settings
            </Button>
          </Link>
        }
      />
      <Suspense fallback={<div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
        <EmailConfigDataFetcher />
      </Suspense>
    </div>
  );
}
