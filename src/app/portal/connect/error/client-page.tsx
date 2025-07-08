
'use client';

import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';

export function ConnectionErrorClientPage() {
    const searchParams = useSearchParams();
    const message = searchParams.get('message');
    
    let displayMessage = "An unknown error occurred during session creation.";
    if (message === 'session_failed') {
        displayMessage = "Your connection was validated, but we couldn't create a secure session. Please try entering the Mini App again."
    }

    return (
        <div className="flex items-center justify-center min-h-[80vh] bg-background p-4">
          <Card className="w-full max-w-lg shadow-lg animate-fadeIn border-destructive/50">
            <CardHeader>
                <CardTitle className="flex items-center gap-3 text-xl font-headline text-destructive">
                    <AlertTriangle className="h-6 w-6" />
                    Session Error
                </CardTitle>
            </CardHeader>
            <CardContent>
              <p>{displayMessage}</p>
            </CardContent>
          </Card>
        </div>
    )
}
