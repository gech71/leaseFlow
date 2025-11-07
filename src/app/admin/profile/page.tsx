import { Suspense } from 'react';
import { PageHeader } from '@/components/custom/PageHeader';
import { UserCircle, Loader2 } from 'lucide-react';
import { AdminProfileClientPage } from './client-page';

export const dynamic = 'force-dynamic';

export default function AdminProfilePage() {
  return (
    <div className="animate-fadeIn">
      <PageHeader
        title="My Profile"
        icon={UserCircle}
        description="View your account details and manage your password."
      />
      <Suspense fallback={<div className="flex justify-center items-center h-[50vh]"><Loader2 className="h-12 w-12 animate-spin text-primary"/></div>}>
        <AdminProfileClientPage />
      </Suspense>
    </div>
  );
}
