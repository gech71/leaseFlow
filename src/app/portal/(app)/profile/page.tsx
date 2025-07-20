
import { Suspense } from 'react';
import { PageHeader } from '@/components/custom/PageHeader';
import { UserCircle, Loader2 } from 'lucide-react';
import { TenantProfileClientPage } from './client-page';
import { getTenantPortalDashboardDataAction } from '../../dashboard/actions'; // Assuming this action fetches the necessary data

export const dynamic = 'force-dynamic';

async function TenantProfileDataFetcher() {
  const portalData = await getTenantPortalDashboardDataAction();
  return <TenantProfileClientPage initialTenant={portalData.agreement?.tenant || null} error={portalData.error} />;
}


export default function TenantProfilePage() {
  return (
    <div className="animate-fadeIn">
      <PageHeader
        title="My Profile"
        icon={UserCircle}
        description="View your account details and manage your password."
      />
      <Suspense fallback={<div className="flex justify-center items-center h-[50vh]"><Loader2 className="h-12 w-12 animate-spin text-primary"/></div>}>
        <TenantProfileDataFetcher />
      </Suspense>
    </div>
  );
}
