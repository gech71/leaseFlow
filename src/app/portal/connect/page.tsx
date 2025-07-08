
import { headers } from 'next/headers';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';
import { ConnectionSuccessPage } from './client-page';

export const dynamic = 'force-dynamic';

const VALIDATE_TOKEN_URL = process.env.NIB_VALIDATE_TOKEN_URL;

interface ConnectionResult {
  status: 'success' | 'error';
  message: string;
  token?: string | null;
  phone?: string | null;
}

async function validateConnection(): Promise<ConnectionResult> {
  const headerList = await headers();
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
      message:
        'Authorization header is malformed. It must start with "Bearer ".',
    };
  }

  const token = authHeader.substring(7);
  if (!token) {
    return {
      status: 'error',
      message:
        'Token is missing from the Authorization header after "Bearer ".',
      token,
    };
  }
  
  if (!VALIDATE_TOKEN_URL) {
    console.error('❌ VALIDATE_TOKEN_URL is not configured.');
    return {
      status: 'error',
      message: 'Token validation service is not configured on the server.',
      token,
    };
  }
  
  try {
    const externalResponse = await fetch(VALIDATE_TOKEN_URL, {
      method: 'GET',
      headers: {
        Authorization: authHeader,
        Accept: 'application/json',
      },
      cache: 'no-store',
    });

    const raw = await externalResponse.text();

    if (!raw) {
      return {
        status: 'error',
        message: 'Token validation failed: empty response from server.',
        token,
      };
    }

    let responseData: any;
    try {
      responseData = JSON.parse(raw);
    } catch (err) {
      return {
        status: 'error',
        message:
          'Token validation failed: backend response was not valid JSON.',
        token,
      };
    }

    if (!externalResponse.ok) {
      return {
        status: 'error',
        message:
          responseData?.message ||
          'The provided token is invalid or expired.',
        token,
      };
    }

    if (responseData.phone) {
      return {
        status: 'success',
        message: 'Token successfully validated.',
        token,
        phone: responseData.phone,
      };
    } else {
      return {
        status: 'error',
        message: "Token validated but 'phone' was missing from the response.",
        token,
      };
    }
  } catch (error: any) {
    console.error('❌ Error during token validation:', error.message);
    return {
      status: 'error',
      message: 'An internal error occurred while validating the token.',
      token,
    };
  }
}

export default async function MiniAppConnectionPage() {
  const result = await validateConnection();

  if (result.status === 'success' && result.token && result.phone) {
    // On success, render the client component which will handle setting the cookie and redirecting.
    return <ConnectionSuccessPage token={result.token} phone={result.phone} />;
  }

  // If validation fails, render the error page.
  return (
    <div className="flex items-center justify-center min-h-[80vh] bg-background p-4">
      <Card
        className="w-full max-w-2xl shadow-lg animate-fadeIn border-destructive/50"
      >
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-2xl font-headline">
            <AlertTriangle className="h-7 w-7 text-destructive" />
            Mini App Connection Failed
          </CardTitle>
          <CardDescription>
            This page tests the connection by reading the Authorization header
            and validating the token.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            className="p-4 rounded-md bg-destructive/10 text-destructive"
          >
            <h3 className="font-semibold">
              Result: Error
            </h3>
            <p className="text-sm mt-1">{result.message}</p>
          </div>

          {result.token && (
            <div>
              <h4 className="font-semibold text-foreground mb-2">
                Received Token:
              </h4>
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
