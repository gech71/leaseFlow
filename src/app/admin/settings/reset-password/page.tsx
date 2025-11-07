
'use client';

import { Suspense } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

// This page is now deprecated.
function ResetPasswordRedirect() {
    const router = useRouter();
    useEffect(() => {
        router.replace('/admin/settings/user-management');
    }, [router]);
    
    return (
         <Card className="w-full max-w-md mx-auto">
            <CardHeader className="text-center">
                <AlertTriangle className="mx-auto h-12 w-12 text-destructive" />
                <CardTitle className="mt-4">Page Deprecated</CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-center text-muted-foreground">This password reset link is no longer used. Redirecting you to User Management...</p>
                <Button onClick={() => router.replace('/admin/settings/user-management')} className="mt-4 w-full">
                    Go to User Management Now
                </Button>
            </CardContent>
        </Card>
    )
}

export default function AdminResetPasswordPage() {
    return (
        <Suspense>
            <ResetPasswordRedirect />
        </Suspense>
    )
}
