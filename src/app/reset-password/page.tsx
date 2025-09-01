
import { Suspense } from 'react';
import { ResetPasswordClientPage } from './client-page';
import { Loader2 } from 'lucide-react';

export default function ResetPasswordPage() {
    return (
        <Suspense fallback={<div className="flex justify-center items-center h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>}>
            <ResetPasswordClientPage />
        </Suspense>
    )
}
