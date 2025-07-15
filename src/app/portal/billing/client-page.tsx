
"use client";

import { useState, useEffect, useRef } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { CheckCircle, Phone, Loader2, DollarSign, AlertCircle, Info, RefreshCw, AlertOctagon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getBillingAmountForPhoneNumberAction, initiatePaymentAction, getBillStatusAction } from './actions';

interface BillingInfo {
  amount: number | null;
  message: string | null;
  billId: string | null;
}

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
  const [isPolling, setIsPolling] = useState(false);
  const [billingInfo, setBillingInfo] = useState<BillingInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  
  // Use a ref to hold the interval ID to manage it across renders
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup interval on component unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  const handleGetBillingAmount = async () => {
    setIsLoading(true);
    setBillingInfo(null);
    setError(null);
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current); // Stop any previous polling
    setIsPolling(false);

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
      
      if (result.success && result.data?.token) {
          toast({ title: "Action Required", description: "Please complete the payment in the NIB app." });
          if (typeof window !== 'undefined' && window.myJsChannel?.postMessage) {
            window.myJsChannel.postMessage({ token: result.data.token });
            startPolling(billingInfo.billId);
          } else {
            console.error("NIB Super App channel (window.myJsChannel) not found.");
            setError("Could not communicate with the payment app. Please try again.");
          }
      } else {
          toast({ title: "Payment Failed", description: result.error, variant: "destructive" });
      }
      setIsLoading(false);
  };

  const startPolling = (billId: string) => {
    setIsPolling(true);
    let pollCount = 0;
    const maxPolls = 60; // Poll for 5 minutes (60 polls * 5 seconds)

    pollIntervalRef.current = setInterval(async () => {
      pollCount++;
      if (pollCount > maxPolls) {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        setIsPolling(false);
        setError("Payment status check timed out. Please check your transaction history later.");
        return;
      }

      const statusResult = await getBillStatusAction(billId);
      if (statusResult.status === 'Paid') {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        setIsPolling(false);
        setBillingInfo({ amount: 0, message: "Payment was successful!", billId: null });
      } else if (statusResult.status === 'Pending' || statusResult.status === 'Overdue') {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        setIsPolling(false);
        setError("Payment failed or was rejected. Please try again.");
      }
    }, 5000); // Check every 5 seconds
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
            Confirm your phone number to fetch your outstanding bill.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 p-6">
          {!isPolling && !billingInfo?.message && (
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
                  {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Get Bill'}
                </Button>
              </div>
            </div>
          )}
          
          {error && (
            <div className="mt-4 flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                <AlertOctagon className="h-5 w-5 shrink-0"/>
                <p>{error}</p>
            </div>
          )}

          {isPolling && (
            <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg animate-pulse space-y-3 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto"/>
              <p className="font-semibold text-primary">Awaiting Payment Confirmation...</p>
              <p className="text-sm text-muted-foreground">Please complete the transaction in the NIB app. This page will update automatically.</p>
            </div>
          )}

          {!isPolling && billingInfo && (
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
                <div className="flex flex-col items-center gap-3 text-green-700 py-4">
                    <CheckCircle className="h-10 w-10 shrink-0"/>
                    <p className="font-medium text-lg text-center">{billingInfo.message || 'No outstanding amount found.'}</p>
                     <Button variant="outline" size="sm" onClick={handleGetBillingAmount} disabled={isLoading}>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Check Again
                    </Button>
                </div>
              )}
            </div>
          )}

        </CardContent>
      </Card>
    </div>
  );
}
