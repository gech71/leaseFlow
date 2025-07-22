// This file is obsolete as the dashboard has been moved to /admin/dashboard.
// This page can be removed or redirected. For now, it will redirect.

"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DeprecatedDashboardRootPage() {
    const router = useRouter();

    useEffect(() => {
        router.replace('/admin/dashboard');
    }, [router]);

    return null; // Return null to render nothing while redirecting
}
