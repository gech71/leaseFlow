
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { ConnectionSuccessPage } from './client-page';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

const NIB_VALIDATE_TOKEN_URL = process.env.NIB_VALIDATE_TOKEN_URL;

async function validateTokenAndGetPhone(
  authHeader: string | null
): Promise<{ success: boolean; phone?: string; error?: string }> {
  if (!NIB_VALIDATE_TOKEN_URL) {
    console.error("NIB_VALIDATE_TOKEN_URL is not set.");
    return { success: false, error: 'validation_url_missing' };
  }
  if (!authHeader) {
    return { success: false, error: 'auth_header_missing' };
  }

  try {
    const response = await fetch(NIB_VALIDATE_TOKEN_URL, {
      method: 'GET',
      headers: {
        Authorization: authHeader,
        Accept: 'application/json',
      },
      cache: 'no-store', // Ensure fresh validation
    });

    if (!response.ok) {
      console.error(`Token validation failed with status: ${response.status}`);
      return { success: false, error: 'token_invalid' };
    }

    const data = await response.json();
    if (data && data.phone) {
      return { success: true, phone: data.phone };
    } else {
      console.error("Token validation response did not contain a phone number.");
      return { success: false, error: 'phone_missing_from_response' };
    }
  } catch (error) {
    console.error("Error during token validation fetch:", error);
    return { success: false, error: 'fetch_failed' };
  }
}

function ConnectionErrorDisplay({ message }: { message: string }) {
  return (
      <div className="flex items-center justify-center min-h-screen bg-background">
      <Card className="w-full max-w-md text-center p-6 shadow-lg animate-fadeIn border-t-4 border-destructive">
        <CardHeader>
          <AlertTriangle className="mx-auto h-16 w-16 text-destructive" />
          <CardTitle className="mt-4 text-2xl font-bold font-headline">Connection Failed</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            {message}
          </p>
           <Button asChild className="mt-6 w-full">
            <Link href="https://www.nibbank.com.et">Return to NIB Bank</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}


export default async function PortalConnectPage() {
  const authorizationHeader = headers().get('Authorization');

  const { success, phone, error } = await validateTokenAndGetPhone(
    authorizationHeader
  );

  if (!success) {
    let errorMessage = "An unknown error occurred during validation.";
    if (error === 'token_invalid') {
        errorMessage = "The connection token is invalid or has expired. Please try launching from the NIB Super App again.";
    } else if (error === 'auth_header_missing') {
        errorMessage = "The authentication token is missing. Please access this page through the NIB Super App.";
    }
    
    return <ConnectionErrorDisplay message={errorMessage} />;
  }

  // On success, render the client component that will handle session creation and redirection.
  // We pass the validated token and phone number to it.
  return (
    <ConnectionSuccessPage
      token={authorizationHeader!.replace('Bearer ', '')}
      phone={phone!}
    />
  );
}
