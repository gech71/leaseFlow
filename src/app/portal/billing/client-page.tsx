
"use client";

import { useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { CheckCircle, Phone, Loader2, DollarSign, AlertCircle, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getBillingAmountForPhoneNumberAction, initiatePaymentAction } from './actions';

interface BillingInfo {
  amount: number | null;
  message: string | null;
  billId: string | null;
}

// Add this interface to support the NIB Super App communication channel
interface MyJsChannel {
  postMessage(message: any): void;
}

declare global {
  interface Window {
    myJsChannel?: MyJsChannel;
  }
}


export function BillingClientPage({ initialPhone }: { initialPhone: string }) {
  const [phone, setPhone] = useState(initialPhone);
  const [isLoading, setIsLoading] = useState(false);
  const [billingInfo, setBillingInfo] = useState<BillingInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paymentResponseToken, setPaymentResponseToken] = useState<string | null>(null);
  const { toast } = useToast();

  const handleGetBillingAmount = async () => {
    setIsLoading(true);
    setBillingInfo(null);
    setError(null);
    setPaymentResponseToken(null);

    const result = await getBillingAmountForPhoneNumberAction(phone);

    if (result.success) {
      setBillingInfo({ amount: result.amount ?? null, message: result.message ?? null, billId: result.billId ?? null });
    } else {
      setError(result.error || 'An unknown error occurred.');
    }

    setIsLoading(false);
  };
  
  const handlePayNow = async () => {
      if (!billingInfo?.billId || billingInfo.amount === null) {
          toast({ title: "Error", description: "No bill selected for payment.", variant: "destructive" });
          return;
      }
      setIsLoading(true);
      const result = await initiatePaymentAction(billingInfo.billId, billingInfo.amount);
      setIsLoading(false);
      
      if (result.success) {
          toast({ title: "Payment Initiated", description: result.message });
          
          if (result.data?.token) {
            setPaymentResponseToken(result.data.token);
            // Step 4: Send the received token back to the Super App.
            if (typeof window !== 'undefined' && window.myJsChannel?.postMessage) {
              window.myJsChannel.postMessage({
                token: result.data.token
              });
              console.log("Successfully posted token to NIB Super App channel.");
            } else {
              console.error("NIB Super App channel (window.myJsChannel) not found.");
            }
          }

          if (result.redirectUrl) {
              window.location.href = result.redirectUrl;
          } else {
              handleGetBillingAmount();
          }
      } else {
          toast({ title: "Payment Failed", description: result.error, variant: "destructive" });
      }
  };

  return (
    <div className="flex justify-center items-start min-h-[80vh] bg-background pt-8 sm:pt-16">
      <Card
        className="w-full max-w-lg shadow-2xl animate-fadeIn border-t-4"
        style={{ borderColor: '#fdb913' }}
      >
        <CardHeader className="text-center">
          <div className="flex items-center justify-center gap-2 text-green-600">
            <CheckCircle className="h-5 w-5" />
            <p className="text-sm font-medium">Connection Verified</p>
          </div>
          <CardTitle className="font-headline text-2xl mt-2">Retrieve Your Billing Information</CardTitle>
          <CardDescription className="px-4">
            Confirm your phone number to fetch the billing amount. It has been pre-filled from the validation process.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 p-6">
          <div className="space-y-2">
            <Label htmlFor="phone" className="flex items-center text-muted-foreground">
              <Phone className="mr-2 h-4 w-4" />
              Enter your phone number
            </Label>
            <div className="flex gap-2">
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g., 251912345678"
                className="text-lg h-12 flex-grow"
                disabled={isLoading}
              />
              <Button
                onClick={handleGetBillingAmount}
                disabled={isLoading || !phone}
                className="h-12 text-base px-6 text-white"
                style={{ backgroundColor: '#fdb913' }}
              >
                {isLoading && !billingInfo ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Get Bill'}
              </Button>
            </div>
          </div>
          
          {error && (
            <div className="mt-4 flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                <AlertCircle className="h-5 w-5 shrink-0"/>
                <p>{error}</p>
            </div>
          )}

          {billingInfo && (
            <div className="mt-6 p-4 bg-secondary/40 border rounded-lg animate-fadeIn space-y-4">
              {billingInfo.amount !== null && billingInfo.amount > 0 ? (
                <>
                  <div>
                    <p className="text-sm text-muted-foreground">Outstanding Amount Due</p>
                    <p className="text-4xl font-bold font-headline text-primary flex items-baseline gap-2">
                      <DollarSign className="h-8 w-8" />
                      {billingInfo.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      <span className="text-2xl text-muted-foreground font-medium">Birr</span>
                    </p>
                  </div>
                  <Button
                    onClick={handlePayNow}
                    className="w-full h-12 text-lg text-white"
                    disabled={isLoading}
                    style={{ backgroundColor: '#fdb913' }}
                  >
                    {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                    Pay Now
                  </Button>
                </>
              ) : (
                <div className="flex items-center gap-3 text-green-700">
                    <Info className="h-5 w-5 shrink-0"/>
                    <p className="font-medium">{billingInfo.message || 'No outstanding amount found.'}</p>
                </div>
              )}
            </div>
          )}

          {paymentResponseToken && (
            <div className="mt-4 space-y-2">
              <Label className="font-semibold text-foreground">Payment Response Token</Label>
              <p className="mt-2 p-3 bg-muted rounded-md text-sm break-all font-mono text-muted-foreground">
                {paymentResponseToken}
              </p>
            </div>
          )}

        </CardContent>
      </Card>
    </div>
  );
}
