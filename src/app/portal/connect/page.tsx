"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle, Phone, Loader2, Wallet, CircleDollarSign, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { validateTokenFromHeaderAction, type ConnectionResult } from '../dashboard/actions';
import { getBillingInfoByPhoneAction } from './actions';

export default function MiniAppConnectionPage() {
  const [validationResult, setValidationResult] = useState<ConnectionResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isFetchingBilling, setIsFetchingBilling] = useState(false);
  const [billingAmount, setBillingAmount] = useState<number | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const validate = async () => {
      setIsLoading(true);
      const result = await validateTokenFromHeaderAction();
      setValidationResult(result);
      if (result.status === 'success' && result.phone) {
        setPhoneNumber(result.phone);
      }
      setIsLoading(false);
    };
    validate();
  }, []);

  const handleGetBilling = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber) {
      toast({
        title: "Phone Number Required",
        description: "Please enter a phone number to fetch billing information.",
        variant: "destructive",
      });
      return;
    }
    setIsFetchingBilling(true);
    setBillingAmount(null);

    const result = await getBillingInfoByPhoneAction(phoneNumber);

    if (result.success) {
      setBillingAmount(result.amount);
      const message = result.amount > 0 
        ? `The amount due for phone number ${phoneNumber} is ${result.amount.toFixed(2)} Birr.`
        : "No outstanding payment found for this number.";
      toast({
        title: "Billing Information Fetched",
        description: message,
      });
    } else {
      toast({
        title: "Could Not Fetch Billing Info",
        description: result.error || "An unknown error occurred.",
        variant: "destructive",
      });
    }
    setIsFetchingBilling(false);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] bg-background p-4 text-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg text-muted-foreground">Verifying connection...</p>
      </div>
    );
  }

  if (validationResult?.status === 'error') {
    return (
        <div className="flex items-center justify-center min-h-[80vh] bg-background p-4">
        <Card className="w-full max-w-2xl shadow-lg animate-fadeIn border-destructive/50">
            <CardHeader>
            <CardTitle className="flex items-center gap-3 text-2xl font-headline text-destructive">
                <AlertTriangle className="h-7 w-7" />
                Connection Error
            </CardTitle>
            <CardDescription>
                There was a problem validating your connection.
            </CardDescription>
            </CardHeader>
            <CardContent>
            <div className="p-4 rounded-md bg-destructive/10 text-destructive">
                <h3 className="font-semibold">Error Details:</h3>
                <p className="text-sm mt-1">{validationResult.message}</p>
            </div>
            {validationResult.token && (
                <div className="mt-4">
                <h4 className="font-semibold text-foreground mb-2">Received Token (for debugging):</h4>
                <p className="p-4 bg-muted rounded-md text-sm break-all font-mono text-muted-foreground">{validationResult.token}</p>
                </div>
            )}
            </CardContent>
        </Card>
        </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-[80vh] bg-background p-4">
        <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-4 text-green-600 animate-fadeIn">
            <CheckCircle className="h-5 w-5" />
            <span className="text-sm font-medium">Connection Verified</span>
        </div>
        <Card className="shadow-2xl animate-fadeIn border-primary/20">
            <CardHeader>
            <CardTitle className="font-headline text-2xl">Confirm Your Number</CardTitle>
            <CardDescription>
                We've successfully verified the connection. To proceed, please confirm your phone number below to retrieve the billing amount associated with it.
            </CardDescription>
            </CardHeader>
            <form onSubmit={handleGetBilling}>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                <Label htmlFor="phoneNumber" className="flex items-center">
                    <Phone className="mr-2 h-4 w-4 text-primary" />
                    Your phone number
                </Label>
                <Input
                    id="phoneNumber"
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="e.g., 0912345678"
                    required
                    disabled={isFetchingBilling}
                />
                </div>

                {billingAmount === null && (
                <Button type="submit" className="w-full" disabled={isFetchingBilling}>
                    {isFetchingBilling ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                    <CircleDollarSign className="mr-2 h-4 w-4" />
                    )}
                    Get Billing Amount
                </Button>
                )}
            </CardContent>
            </form>

            {billingAmount !== null && (
            <CardContent className="space-y-4 border-t pt-6">
                <h3 className="font-semibold text-lg text-center">Amount Due</h3>
                <div className="p-4 bg-secondary/50 rounded-lg text-center">
                <p className="text-4xl font-bold text-primary font-headline">
                    {billingAmount.toFixed(2)}
                </p>
                <p className="text-sm text-muted-foreground">Birr</p>
                </div>
                <p className="text-xs text-center text-muted-foreground pt-2">
                  Once the billing amount is fetched, you’ll be able to review it and click the Pay button to proceed. (Note: The Pay button is currently not functional.)
                </p>
                <Button className="w-full bg-green-600 hover:bg-green-700" disabled>
                  <Wallet className="mr-2 h-4 w-4" />
                  Pay Now (Not Functional)
                </Button>
            </CardContent>
            )}
        </Card>
        </div>
    </div>
  );
}