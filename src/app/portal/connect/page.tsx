
import { headers } from 'next/headers';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CheckCircle, AlertTriangle } from 'lucide-react';

const VALIDATE_TOKEN_URL = process.env.NIB_VALIDATE_TOKEN_URL;

interface ConnectionResult {
  status: 'success' | 'error';
  message: string;
  token?: string | null;
  phone?: string | null; // Add phone number to result
}

/**
 * Extracts the Bearer token from the Authorization header and validates it
 * by calling the EXTERNAL validation service directly.
 * @returns {Promise<ConnectionResult>} An object containing the status, a message, and relevant data.
 */
async function validateConnection(): Promise<ConnectionResult> {
  const headerList = headers();
  const authHeader = headerList.get('Authorization');

  if (!authHeader) {
    return { status: 'error', message: 'Authorization header is missing from the request.' };
  }
  if (!authHeader.startsWith('Bearer ')) {
    return { status: 'error', message: 'Authorization header is malformed. It must start with "Bearer ".' };
  }
  const token = authHeader.substring(7);
  if (!token) {
    return { status: 'error', message: 'Token is missing from the Authorization header after "Bearer ".', token };
  }

  // --- Direct External Validation ---
  if (!VALIDATE_TOKEN_URL) {
    console.error("Token validation service URL (NIB_VALIDATE_TOKEN_URL) is not configured.");
    return { status: 'error', message: "Token validation service is not configured on the server.", token };
  }

  try {
    const externalResponse = await fetch(VALIDATE_TOKEN_URL, {
      method: 'GET',
      headers: {
        'Authorization': authHeader, // Forward the entire header
        'Accept': 'application/json',
      },
      cache: 'no-store',
    });

    // Handle cases where the response might not have a body
    if (externalResponse.status === 204 || !externalResponse.headers.get('content-length') || externalResponse.headers.get('content-length') === '0') {
      console.error(`External token validation returned status ${externalResponse.status} with an empty body.`);
      return { status: 'error', message: 'Token validation failed with an empty response from the server.', token };
    }

    const responseData = await externalResponse.json();

    if (!externalResponse.ok) {
        console.error(`External token validation failed with status ${externalResponse.status}:`, responseData);
        return {
            status: 'error',
            message: `Token validation failed: ${responseData.errors?.join(', ') || 'The provided token is invalid or expired.'}`,
            token,
        };
    }
    
    if (responseData.phone) {
      return {
        status: 'success',
        message: 'Token successfully extracted and validated.',
        token,
        phone: responseData.phone,
      };
    } else {
      console.error("External validation success, but 'phone' field is missing in the response:", responseData);
      return {
        status: 'error',
        message: 'Token was validated, but the response did not include a phone number.',
        token,
      };
    }
  } catch (error: any) {
    console.error("Error during direct external validation fetch:", error.message);
    return {
      status: 'error',
      message: 'An internal server error occurred while trying to validate the token.',
      token,
    };
  }
}

/**
 * A server component page to test the Mini App connection by validating the Authorization header.
 */
export default async function MiniAppConnectionPage() {
    let result: ConnectionResult;

    try {
        result = await validateConnection();
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
                        This page tests the connection by reading the Authorization header and validating the token.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className={`p-4 rounded-md ${isSuccess ? 'bg-green-50 dark:bg-green-900/30 text-green-800 dark:text-green-200' : 'bg-destructive/10 text-destructive'}`}>
                        <h3 className="font-semibold">Result: {isSuccess ? 'Success' : 'Error'}</h3>
                        <p className="text-sm mt-1">{result.message}</p>
                    </div>
                    
                    {result.token && (
                        <div>
                            <h4 className="font-semibold text-foreground mb-2">Received Token:</h4>
                            <p className="p-4 bg-muted rounded-md text-sm break-all font-mono text-muted-foreground">
                                {result.token}
                            </p>
                        </div>
                    )}

                    {isSuccess && result.phone && (
                        <div>
                            <h4 className="font-semibold text-foreground mb-2">Validated Phone Number:</h4>
                             <p className="p-4 bg-muted rounded-md text-sm font-mono text-foreground">
                                {result.phone}
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
