
// This page is no longer needed as the functionality has been merged
// into the forgot-password page for a better user experience.
// It can be deleted. Redirecting to the new flow.
"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DeprecatedResetPasswordPage() {
    const router = useRouter();
    useEffect(() => {
        router.replace('/auth/forgot-password');
    }, [router]);

    return null; // Render nothing while redirecting
}
