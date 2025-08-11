
import { PageHeader } from '@/components/custom/PageHeader';
import { Mail, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export const dynamic = 'force-dynamic';

// This is a Server Component, so we can safely read environment variables.
export default function EmailConfigurationPage() {
  const smtpUser = process.env.SMTP_USER || 'Not Set';
  const isSmtpPassSet = !!process.env.SMTP_PASS;

  return (
    <div className="animate-fadeIn">
      <PageHeader
        title="Email Configuration"
        icon={Mail}
        description="View current SMTP settings used for sending system emails."
        actions={
          <Link href="/admin/settings" passHref>
            <Button variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Settings
            </Button>
          </Link>
        }
      />
      <div className="grid gap-8 md:grid-cols-2">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Current SMTP Settings</CardTitle>
            <CardDescription>
              These are the settings the application is currently using. They are read from the server's environment variables.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="smtpUser">Email Address</Label>
              <Input id="smtpUser" value={smtpUser} readOnly disabled />
            </div>
            <div className="space-y-1">
              <Label htmlFor="smtpPass">App Password</Label>
              <Input id="smtpPass" value={isSmtpPassSet ? '********' : 'Not Set'} readOnly disabled />
              <p className="text-xs text-muted-foreground">For security, the password cannot be displayed.</p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-lg bg-secondary/30 border-primary/20">
          <CardHeader>
            <CardTitle>How to Update Credentials</CardTitle>
            <CardDescription>
              To change these settings, you must directly edit the `.env` file on the server and restart the application.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <h4 className="font-semibold mb-1">Step 1: Generate a Gmail App Password</h4>
              <p className="text-muted-foreground">
                For security, you cannot use your regular Gmail password. You must generate a special "App Password".
              </p>
              <ol className="list-decimal list-inside mt-2 space-y-1 text-muted-foreground">
                <li>Go to your Google Account settings at <a href="https://myaccount.google.com/" target="_blank" rel="noopener noreferrer" className="text-primary underline">myaccount.google.com</a>.</li>
                <li>Navigate to the "Security" section.</li>
                <li>Under "How you sign in to Google", find and click on "2-Step Verification". You must have this enabled.</li>
                <li>At the bottom of the 2-Step Verification page, click on "App passwords".</li>
                <li>Generate a new password. For the app name, you can enter "LeaseFlow" or something similar.</li>
                <li>Copy the 16-character password that is generated. This is your new `SMTP_PASS`.</li>
              </ol>
            </div>
             <div>
              <h4 className="font-semibold mb-1">Step 2: Update `.env` File</h4>
              <p className="text-muted-foreground">
                Connect to your server and find the `.env` file in the root of the project directory. Update the following lines:
              </p>
              <pre className="mt-2 p-3 bg-background rounded-md text-xs font-mono">
                <code>
                  SMTP_HOST="smtp.gmail.com"<br/>
                  SMTP_PORT=587<br/>
                  SMTP_USER="your-email@gmail.com"<br/>
                  SMTP_PASS="YOUR_16_CHARACTER_APP_PASSWORD"<br/>
                  SMTP_FROM="Your Company Name &lt;your-email@gmail.com&gt;"
                </code>
              </pre>
            </div>
             <div>
              <h4 className="font-semibold mb-1">Step 3: Restart Application</h4>
              <p className="text-muted-foreground">
                For the changes to take effect, you must restart the application server.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
