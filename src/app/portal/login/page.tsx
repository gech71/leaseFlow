
"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function DeprecatedPortalLoginPage() {
    const router = useRouter();

    useEffect(() => {
        // Redirect any traffic from the old portal login to the new unified login page.
        router.replace('/auth/login');
    }, [router]);

    return (
        <div className="flex items-center justify-center min-h-screen">
            <Loader2 className="h-8 w-8 animate-spin" />
        </div>
    );
}
