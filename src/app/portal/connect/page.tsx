import { headers, cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { CheckCircle, AlertTriangle } from 'lucide-react';

const VALIDATE_TOKEN_URL = process.env.NIB_VALIDATE_TOKEN_URL;
const PORTAL_ACCESS_TOKEN_KEY = 'leaseflow_portal_access_token';
const PORTAL_ACCESS_TOKEN_MAX_AGE = 60 * 60; // 1 hour

interface ConnectionResult {
  status: 'success' | 'error';
  message: string;
  token?: string | null;
  phone?: string | null;
}

/**
 * Extracts the Bearer token, validates it, and sets a secure cookie on success.
 * @returns {Promise<ConnectionResult>} An object containing the status and a message.
 */
async function validateConnectionAndSetCookie(): Promise<ConnectionResult> {
  const headerList = await headers();
  const authHeader = headerList.get('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      status: 'error',
      message: 'Authorization header is missing or malformed.',
    };
  }

  const token = authHeader.substring(7);
  if (!token) {
    return { status: 'error', message: 'Token is missing.', token };
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
      headers: { Authorization: authHeader, Accept: 'application/json' },
      cache: 'no-store',
    });

    const raw = await externalResponse.text();
    if (!raw) {
      return { status: 'error', message: 'Token validation failed: empty response from server.', token };
    }

    const responseData = JSON.parse(raw);

    if (!externalResponse.ok || !responseData.phone) {
      return {
        status: 'error',
        message: responseData?.message || 'The provided token is invalid, expired, or did not return a phone number.',
        token,
      };
    }

    // On success, set the secure cookie
    cookies().set(PORTAL_ACCESS_TOKEN_KEY, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      sameSite: 'lax',
      maxAge: PORTAL_ACCESS_TOKEN_MAX_AGE,
    });
    
    // Return success with phone number for redirection
    return {
      status: 'success',
      message: 'Token successfully validated.',
      token,
      phone: responseData.phone,
    };

  } catch (error: any) {
    console.error('❌ Error during token validation:', error.message);
    return { status: 'error', message: 'An internal error occurred while validating the token.', token };
  }
}

/**
 * A server component page that acts as the entry point for the Mini App.
 * It validates the token and redirects on success or shows an error.
 */
export default async function MiniAppConnectionPage() {
  const result = await validateConnectionAndSetCookie();
  
  // If validation is successful and we have a phone number, redirect.
  if (result.status === 'success' && result.phone) {
    redirect(`/portal/billing?phone=${encodeURIComponent(result.phone)}`);
  }

  // This part of the component will only render if the validation fails.
  return (
    <div className="flex items-center justify-center min-h-[80vh] bg-background p-4">
      <Card className="w-full max-w-2xl shadow-lg animate-fadeIn border-destructive/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-2xl font-headline">
            <AlertTriangle className="h-7 w-7 text-destructive" />
            Mini App Connection Failed
          </CardTitle>
          <CardDescription>
            This page tests the connection by reading the Authorization header from the Mini App.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 rounded-md bg-destructive/10 text-destructive">
            <h3 className="font-semibold">Error Details:</h3>
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
