
import { headers } from 'next/headers';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CheckCircle, AlertTriangle } from 'lucide-react';

interface ConnectionResult {
  status: 'success' | 'error';
  message: string;
  token?: string | null;
}

/**
 * Extracts and validates the Bearer token from the Authorization header.
 * @returns {ConnectionResult} An object containing the status, a message, and the token if found.
 */
function getTokenFromHeader(): ConnectionResult {
  const headerList = headers();
  const authHeader = headerList.get('Authorization');

  if (!authHeader) {
    return {
      status: 'error',
      message: 'Authorization header is missing from the request.',
    };
  }

  if (!authHeader.startsWith('Bearer ')) {
    return {
      status: 'error',
      message: 'Authorization header is malformed. It must start with "Bearer ".',
    };
  }

  // Extracts the token part from "Bearer <token>"
  const token = authHeader.substring(7);

  if (!token) {
    return {
      status: 'error',
      message: 'Token is missing from the Authorization header after "Bearer ".',
    };
  }

  return {
    status: 'success',
    message: 'Token successfully extracted from the header.',
    token: token,
  };
}

/**
 * A server component page to test the Mini App connection by validating the Authorization header.
 */
export default async function MiniAppConnectionPage() {
    let result: ConnectionResult;

    try {
        result = getTokenFromHeader();
    } catch (error) {
        console.error("Unexpected error on Mini App connection test page:", error);
        result = {
            status: 'error',
            message: 'An unexpected server error occurred while processing the request.',
        };
    }

    const isSuccess = result.status === 'success';

    return (
        <div className="flex items-center justify-center min-h-[80vh] bg-background p-4">
            <Card className={`w-full max-w-2xl shadow-lg animate-fadeIn ${isSuccess ? 'border-green-500/50' : 'border-destructive/50'}`}>
                <CardHeader>
                    <CardTitle className="flex items-center gap-3 text-2xl font-headline">
                        {isSuccess ? <CheckCircle className="h-7 w-7 text-green-500" /> : <AlertTriangle className="h-7 w-7 text-destructive" />}
                        Mini App Connection Status
                    </CardTitle>
                    <CardDescription>
                        This page tests the connection from your main application by reading the Authorization header.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className={`p-4 rounded-md ${isSuccess ? 'bg-green-50 dark:bg-green-900/30 text-green-800 dark:text-green-200' : 'bg-destructive/10 text-destructive'}`}>
                        <h3 className="font-semibold">Result: {isSuccess ? 'Success' : 'Error'}</h3>
                        <p className="text-sm mt-1">{result.message}</p>
                    </div>
                    {isSuccess && result.token && (
                        <div>
                            <h4 className="font-semibold text-foreground mb-2">Received Token:</h4>
                            <p className="p-4 bg-muted rounded-md text-sm break-all font-mono text-muted-foreground">
                                {result.token}
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
