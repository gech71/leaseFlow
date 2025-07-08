import { headers } from 'next/headers';
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

interface ConnectionResult {
  status: 'success' | 'error';
  message: string;
  token?: string | null;
  phone?: string | null;
}

/**
 * Extracts the Bearer token from the Authorization header and validates it
 * by calling the EXTERNAL validation service directly.
 * @returns {Promise<ConnectionResult>} An object containing the status, a message, and relevant data.
 */
async function validateConnection(): Promise<ConnectionResult> {
  // Note: headers() is a dynamic function. Using it opts the page into dynamic rendering.
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

    // Handle cases where the response might not have a body
    if (externalResponse.status === 204 || !externalResponse.headers.get('content-length') || externalResponse.headers.get('content-length') === '0') {
      return {
        status: 'error',
        message: 'Token validation failed: empty response from server.',
        token,
      };
    }
    
    const responseData = await externalResponse.json();

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
        message: 'Token successfully validated. Redirecting...',
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

/**
 * A server component page to test the Mini App connection by validating the Authorization header.
 * On success, it redirects to the billing page.
 */
export default async function MiniAppConnectionPage() {
  const result = await validateConnection();

  // If validation is successful, redirect to the billing page.
  if (result.status === 'success' && result.phone) {
    redirect(`/portal/billing?phone=${encodeURIComponent(result.phone)}`);
  }
  
  // This UI will only be shown if the validation fails, as a success will trigger the redirect.
  return (
    <div className="flex items-center justify-center min-h-[80vh] bg-background p-4">
      <Card
        className={`w-full max-w-2xl shadow-lg animate-fadeIn border-destructive/50`}
      >
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-2xl font-headline">
            <AlertTriangle className="h-7 w-7 text-destructive" />
            Connection Failed
          </CardTitle>
          <CardDescription>
            Could not establish a secure connection. Please see the error below.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            className={`p-4 rounded-md bg-destructive/10 text-destructive`}
          >
            <h3 className="font-semibold">
              Error
            </h3>
            <p className="text-sm mt-1">{result.message}</p>
          </div>

          {result.token && (
            <div>
              <h4 className="font-semibold text-foreground mb-2">
                Received Token (for debugging):
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
