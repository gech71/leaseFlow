
"use client";

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, User, Home, Loader2, AlertTriangle, CheckCircle, Eye, CalendarClock, Sigma, CreditCard, Landmark, Wallet, Coins, HelpCircle, Info, CalendarDays, EyeOff, Download } from 'lucide-react';
import type { Space as SpacePrismaType, Tenant as TenantPrismaType, Agreement as AgreementPrismaType } from '@prisma/client';
import { useToast } from '@/hooks/use-toast';
import { createFullAgreementAction, type CreateFullAgreementData } from '../actions';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ScrollArea } from '@/components/ui/scroll-area';
import Link from 'next/link';
import { addMonths, format, parseISO, isValid } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { usePermissions } from '@/contexts/PermissionContext';
import { jsPDF } from 'jspdf';

// Helper to create a safe filename
const sanitizeFilename = (name: string) => {
  return name.replace(/[^a-z0-9_.-]/gi, '_').replace(/_{2,}/g, '_');
};

// Client-side representation of Tenant and Space with serialized dates
interface ClientTenant extends Omit<TenantPrismaType, 'createdAt' | 'updatedAt'> {
  createdAt: string;
  updatedAt: string;
}
interface ClientSpace extends Omit<SpacePrismaType, 'createdAt' | 'updatedAt'> {
  createdAt: string;
  updatedAt: string;
}

const agreementFormSchema = z.object({
  tenantId: z.string().min(1, { message: "Please select a tenant." }),
  selectedSpaceId: z.string().min(1, { message: "Please select a space." }),
  startDate: z.date({ required_error: "Agreement start date is required."}),
  paymentTermMonths: z.coerce.number().int().positive({ message: "Payment term must be a positive number of months." }).min(1, {message: "Term must be at least 1 month."}),
  initialPaymentMonths: z.coerce.number().int().positive({ message: "Initial payment must be a positive number of months." }).min(1, {message: "Initial payment must be at least 1 month."}),
  additionalTerms: z.string().optional(),
  paymentMethod: z.string().min(1, { message: "Please select a payment method."}),
  paymentReference: z.string().optional(),
  bankOrWalletName: z.string().optional(),
}).refine(data => data.initialPaymentMonths <= data.paymentTermMonths, {
  message: "Initial payment months cannot exceed total payment term months.",
  path: ["initialPaymentMonths"],
}).refine(data => {
  if ((data.paymentMethod === "Bank Transfer" || data.paymentMethod === "Wallet") && (!data.bankOrWalletName || data.bankOrWalletName.trim() === "")) {
    return false;
  }
  return true;
}, {
  message: "Bank/Wallet name is required for Bank Transfer or Wallet payment methods.",
  path: ["bankOrWalletName"],
});

type AgreementFormValues = z.infer<typeof agreementFormSchema>;

interface GenerateAgreementClientPageProps {
  tenants: ClientTenant[];
  availableSpaces: ClientSpace[];
}

export function GenerateAgreementClientPage({ tenants, availableSpaces }: GenerateAgreementClientPageProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isSavingToDb, setIsSavingToDb] = useState(false);
  const [generatedAgreementText, setGeneratedAgreementText] = useState<string | null>(null);
  const [finalizedAgreement, setFinalizedAgreement] = useState<AgreementPrismaType | null>(null);
  const [validatedData, setValidatedData] = useState<AgreementFormValues | null>(null);
  const [finalizedSpace, setFinalizedSpace] = useState<ClientSpace | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const router = useRouter();

  const { hasPermission, isSuperAdmin } = usePermissions();
  const canCreateAgreements = isSuperAdmin || hasPermission('agreement:create');

  const form = useForm<AgreementFormValues>({
    resolver: zodResolver(agreementFormSchema),
    defaultValues: {
      tenantId: "",
      selectedSpaceId: "",
      startDate: new Date(),
      paymentTermMonths: 12,
      initialPaymentMonths: 1,
      additionalTerms: "",
      paymentMethod: "",
      paymentReference: "",
      bankOrWalletName: "",
    },
  });

  const selectedSpaceId = form.watch("selectedSpaceId");
  const initialPaymentMonths = form.watch("initialPaymentMonths");
  const paymentMethod = form.watch("paymentMethod");

  const selectedSpaceDetails = useMemo(() => {
    return availableSpaces.find(s => s.id === selectedSpaceId);
  }, [selectedSpaceId, availableSpaces]);

  const calculatedInitialPaymentAmount = useMemo(() => {
    if (selectedSpaceDetails && initialPaymentMonths >= 0) {
      return selectedSpaceDetails.monthlyRentalPrice * initialPaymentMonths;
    }
    return 0;
  }, [selectedSpaceDetails, initialPaymentMonths]);

  useEffect(() => setIsMounted(true), []);

  const handlePreviewAgreement = (data: AgreementFormValues) => {
    if (!canCreateAgreements) {
      toast({ title: "Permission Denied", description: "You do not have permission to generate agreement text.", variant: "destructive" });
      return;
    }
    setIsPreviewing(true);
    setError(null);
    setGeneratedAgreementText(null);
    setFinalizedAgreement(null);
    setValidatedData(data);

    const selectedTenant = tenants.find(t => t.id === data.tenantId);
    const selectedSpace = availableSpaces.find(s => s.id === data.selectedSpaceId);

    if (!selectedTenant || !selectedSpace) {
      toast({ title: "Error", description: "Selected tenant or space not found.", variant: "destructive" });
      setIsPreviewing(false);
      return;
    }

    const agreementTemplate = `
RENTAL AGREEMENT

This Rental Agreement ("Agreement") is made and entered into on ${format(data.startDate, 'PPP')}, by and between the Landlord and the Tenant.

1.  PARTIES
    -   Tenant: ${selectedTenant.name}
    -   Landlord: [Landlord Name/Company]

2.  PROPERTY
    -   Building: ${selectedSpace.buildingName}
    -   Space: ${selectedSpace.spaceIdName}
    -   Floor: ${selectedSpace.floor}
    -   Area: ${selectedSpace.area} m²

3.  TERM
    This Agreement shall commence on ${format(data.startDate, 'PPP')} and continue for a term of ${data.paymentTermMonths} month(s).

4.  RENT
    -   Monthly Rent: ${selectedSpace.monthlyRentalPrice.toLocaleString()} Birr
    -   Initial Payment: An amount equivalent to ${data.initialPaymentMonths} month(s) rent, totaling ${(selectedSpace.monthlyRentalPrice * data.initialPaymentMonths).toLocaleString()} Birr, has been paid upfront.
    -   Next Payment Due: ${format(addMonths(data.startDate, data.initialPaymentMonths), 'PPP')}

5.  UTILITIES
    Tenant shall be responsible for a pro-rated share of building utilities as determined by the Landlord's policies and the space's assigned proration share of ${selectedSpace.utilityProrationShare * 100}%.

6.  ADDITIONAL TERMS
    ${data.additionalTerms || "No additional terms specified."}

7.  GOVERNING LAW
    This Agreement shall be governed by and construed in accordance with the laws of the applicable jurisdiction.

IN WITNESS WHEREOF, the parties have executed this Agreement as of the date first above written.

_________________________
Tenant: ${selectedTenant.name}

_________________________
Landlord/Authorized Representative
    `;
    
    setGeneratedAgreementText(agreementTemplate.trim());
    toast({ title: "Agreement Preview Generated!", description: "Review the text and proceed to save." });
    setIsPreviewing(false);
  };
  
  const handleDownloadAgreement = () => {
    if (!generatedAgreementText) {
      toast({ title: "Cannot Download", description: "No agreement text has been generated.", variant: "destructive"});
      return;
    }
    
    const doc = new jsPDF();
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);

    const textLines = doc.splitTextToSize(generatedAgreementText, 180);
    doc.text(textLines, 15, 15);

    const tenantName = tenants.find(t => t.id === form.getValues().tenantId)?.name || 'Tenant';
    const safeTenantName = sanitizeFilename(tenantName);

    doc.save(`Draft-Agreement-${safeTenantName}.pdf`);
    
    toast({ title: "Download Started", description: "Your draft agreement PDF is downloading." });
  };

  const handleSaveFullAgreement = async () => {
    if (!canCreateAgreements) {
      toast({ title: "Permission Denied", description: "You do not have permission to save agreements.", variant: "destructive" });
      return;
    }
    if (!generatedAgreementText) {
        toast({ title: "Error", description: "No agreement text generated to save.", variant: "destructive" });
        return;
    }
    if (!validatedData) {
      toast({ title: "Error", description: "Form data is not validated. Please preview the agreement again.", variant: "destructive" });
      return;
    }
    const formValues = validatedData; 
    const selectedTenant = tenants.find(t => t.id === formValues.tenantId);
    const selectedSpace = availableSpaces.find(s => s.id === formValues.selectedSpaceId);

    if (!selectedTenant || !selectedSpace || !formValues.startDate) {
      toast({ title: "Error", description: "Missing required details (tenant, space, or start date) to save agreement.", variant: "destructive" });
      return;
    }
    
    setIsSavingToDb(true);
    setError(null);

    const agreementDataForDb: CreateFullAgreementData = {
      tenantId: selectedTenant.id,
      spaceId: selectedSpace.id,
      agreementText: generatedAgreementText,
      startDate: formValues.startDate.toISOString(),
      monthlyRentalPrice: selectedSpace.monthlyRentalPrice,
      paymentTermMonths: formValues.paymentTermMonths,
      initialPaymentMonths: formValues.initialPaymentMonths,
      additionalTerms: formValues.additionalTerms,
      initialPaymentMethod: formValues.paymentMethod,
      initialPaymentReference: formValues.paymentReference,
      initialPaymentBankOrWalletName: formValues.bankOrWalletName,
    };
    
    const result = await createFullAgreementAction(agreementDataForDb);
    setIsSavingToDb(false);

    if (result.success && result.agreement) {
      setFinalizedAgreement(result.agreement as AgreementPrismaType);
      setFinalizedSpace(selectedSpace);
      toast({ title: "Agreement Saved Successfully!", description: "The agreement is now active." });
      setGeneratedAgreementText(null);
    } else {
      setError(result.error || "Failed to save agreement.");
      toast({ title: "Save Failed", description: result.error || "An unknown error occurred.", variant: "destructive" });
    }
  };

  if (!isMounted) {
    return <div className="flex justify-center items-center h-screen"><Loader2 className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"/></div>;
  }

  if (!canCreateAgreements && isMounted) {
    return (
      <Card className="shadow-lg text-center py-12">
        <CardHeader><CardTitle className="text-destructive flex items-center justify-center"><EyeOff className="mr-2"/>Access Denied</CardTitle></CardHeader>
        <CardContent><p>You do not have permission to create agreements.</p></CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline text-xl">Agreement & Payment Details</CardTitle>
          <CardDescription>Fill form to create a new agreement and record initial payment.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handlePreviewAgreement)} className="space-y-6">
              <FormField
                control={form.control}
                name="tenantId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center"><User className="mr-2 h-4 w-4 text-primary" />Select Tenant<span className="text-destructive ml-1">*</span></FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value} disabled={!canCreateAgreements}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Choose an existing tenant" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {tenants.length > 0 ? tenants.map(tenant => (
                          <SelectItem key={tenant.id} value={tenant.id}>{tenant.name} ({tenant.email})</SelectItem>
                        )) : (<SelectItem value="no-tenants" disabled>No tenants found</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="selectedSpaceId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center"><Home className="mr-2 h-4 w-4 text-primary" />Select Space<span className="text-destructive ml-1">*</span></FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value} disabled={!canCreateAgreements}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Choose an available space" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {availableSpaces.length > 0 ? availableSpaces.map(space => (
                          <SelectItem key={space.id} value={space.id}>
                            {space.spaceIdName} ({space.buildingName}) - {space.monthlyRentalPrice.toLocaleString()} Birr
                          </SelectItem>
                        )) : (<SelectItem value="no-spaces" disabled>No available spaces</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel className="flex items-center"><CalendarDays className="mr-2 h-4 w-4 text-primary"/>Agreement Start Date<span className="text-destructive ml-1">*</span></FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
                            disabled={!canCreateAgreements}
                          >
                            {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                            <CalendarDays className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField control={form.control} name="paymentTermMonths" render={({ field }) => (<FormItem><FormLabel className="flex items-center"><CalendarClock className="mr-2 h-4 w-4 text-primary" />Total Term (Months)<span className="text-destructive ml-1">*</span></FormLabel><FormControl><Input type="number" placeholder="e.g., 12" {...field} disabled={!canCreateAgreements}/></FormControl><FormMessage /></FormItem>)}/>
                  <FormField control={form.control} name="initialPaymentMonths" render={({ field }) => (<FormItem><FormLabel className="flex items-center"><Sigma className="mr-2 h-4 w-4 text-primary" />Initial Payment (Months)<span className="text-destructive ml-1">*</span></FormLabel><FormControl><Input type="number" placeholder="e.g., 1" {...field} disabled={!canCreateAgreements}/></FormControl><FormMessage /></FormItem>)}/>
              </div>
              {calculatedInitialPaymentAmount > 0 && (
                <div className="p-3 bg-secondary/50 rounded-md border border-border">
                  <Label className="font-semibold flex items-center text-foreground"><Info className="mr-2 h-4 w-4 text-primary"/>Calculated Initial Payment Amount</Label>
                  <p className="text-2xl font-bold text-primary mt-1">{calculatedInitialPaymentAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Birr</p>
                  <p className="text-xs text-muted-foreground">({initialPaymentMonths} month(s) upfront based on selected space)</p>
                </div>
              )}
              <FormField control={form.control} name="paymentMethod" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center"><CreditCard className="mr-2 h-4 w-4 text-primary" />Initial Payment Method<span className="text-destructive ml-1">*</span></FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value} disabled={!canCreateAgreements}><FormControl><SelectTrigger><SelectValue placeholder="Select payment method" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="Card"><CreditCard className="mr-2 h-4 w-4 inline-block"/>Card</SelectItem>
                        <SelectItem value="Cash"><Coins className="mr-2 h-4 w-4 inline-block"/>Cash</SelectItem>
                        <SelectItem value="Bank Transfer"><Landmark className="mr-2 h-4 w-4 inline-block"/>Bank Transfer</SelectItem>
                        <SelectItem value="Wallet"><Wallet className="mr-2 h-4 w-4 inline-block"/>Digital Wallet</SelectItem>
                        <SelectItem value="Other"><HelpCircle className="mr-2 h-4 w-4 inline-block"/>Other</SelectItem>
                      </SelectContent>
                    </Select><FormMessage />
                  </FormItem>
              )}/>
              {(paymentMethod === "Bank Transfer" || paymentMethod === "Wallet") && (
                 <FormField control={form.control} name="bankOrWalletName" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center"> {paymentMethod === "Bank Transfer" ? <Landmark className="mr-2 h-4 w-4 text-primary"/> : <Wallet className="mr-2 h-4 w-4 text-primary"/>} {paymentMethod === "Bank Transfer" ? "Bank Name" : "Wallet Provider"} <span className="text-destructive ml-1">*</span></FormLabel>
                      <FormControl><Input placeholder={`Enter ${paymentMethod === "Bank Transfer" ? "Bank Name" : "Wallet Provider"}`} {...field} disabled={!canCreateAgreements}/></FormControl><FormMessage />
                    </FormItem>
                  )}/>
              )}
              <FormField control={form.control} name="paymentReference" render={({ field }) => (<FormItem><FormLabel>Payment Reference (Optional)</FormLabel><FormControl><Input placeholder="e.g., Transaction ID, Check No." {...field} disabled={!canCreateAgreements}/></FormControl><FormMessage /></FormItem>)}/>
              <FormField control={form.control} name="additionalTerms" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Additional Terms for Agreement (Optional)</FormLabel>
                    <FormControl><Textarea placeholder="Enter any specific clauses..." className="resize-none" rows={3} {...field} disabled={!canCreateAgreements}/></FormControl>
                    <FormDescription>These terms will be appended to the standard agreement clauses.</FormDescription><FormMessage />
                  </FormItem>
              )}/>
              <Button type="submit" disabled={isPreviewing || isSavingToDb || availableSpaces.length === 0 || tenants.length === 0 || !form.formState.isValid || !canCreateAgreements} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
                {isPreviewing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating...</> : "Preview Agreement"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline text-xl">Generated Agreement & Finalize</CardTitle>
          <CardDescription>Review the generated text. If satisfied, save the agreement.</CardDescription>
        </CardHeader>
        <CardContent>
          {isPreviewing && ( <div className="flex flex-col items-center justify-center h-64 text-muted-foreground"> <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" /> <p>Generating text...</p> </div> )}
          {error && !isPreviewing && ( <div className="flex flex-col items-center justify-center h-64 text-destructive-foreground bg-destructive/80 p-6 rounded-md"> <AlertTriangle className="h-12 w-12 mb-4" /> <p className="font-semibold text-lg">Error</p> <p className="text-sm text-center">{error}</p> </div> )}
          
          {generatedAgreementText && !finalizedAgreement && !isPreviewing && !error && (
            <div className="space-y-4">
              <div className="flex items-center text-green-600 bg-green-50 p-3 rounded-md"><CheckCircle className="h-5 w-5 mr-2" /><p className="font-medium">Agreement text generated!</p></div>
              <ScrollArea className="h-[300px] w-full rounded-md border p-4 bg-secondary/30"><pre className="whitespace-pre-wrap text-sm font-mono leading-relaxed">{generatedAgreementText}</pre></ScrollArea>
               <div className="flex flex-col sm:flex-row gap-2">
                <Button onClick={handleSaveFullAgreement} disabled={isSavingToDb || isPreviewing || !canCreateAgreements} className="w-full">
                  {isSavingToDb ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : "Finalize & Save Agreement"}
                </Button>
                <Button onClick={handleDownloadAgreement} variant="outline" className="w-full sm:w-auto" disabled={isSavingToDb}>
                  <Download className="mr-2 h-4 w-4"/> Download
                </Button>
              </div>
            </div>
          )}

          {finalizedAgreement && !error && (
              <div className="space-y-4">
                  <div className="flex items-center text-green-600 bg-green-50 p-3 rounded-md border border-green-200"><CheckCircle className="h-5 w-5 mr-2" /><p className="font-medium">Agreement successfully saved!</p></div>
                  <h3 className="text-lg font-semibold font-headline">Agreement ID: {finalizedAgreement.id}</h3>
                  <p className="text-sm font-medium">Tenant: <span className="font-normal">{tenants.find(t => t.id === finalizedAgreement.tenantId)?.name || 'N/A'}</span></p>
                  <p className="text-sm font-medium">Space: <span className="font-normal">{finalizedSpace ? `${finalizedSpace.spaceIdName} (${finalizedSpace.buildingName})` : 'N/A'}</span></p>
                  <div className="flex justify-end gap-2 pt-4 mt-4 border-t">
                      <Button onClick={() => { setFinalizedAgreement(null); setValidatedData(null); setFinalizedSpace(null); form.reset(); }} variant="outline">Create Another Agreement</Button>
                      <Link href={`/admin/agreements/${finalizedAgreement.id}`} passHref>
                          <Button><Eye className="mr-2 h-4 w-4" /> View Saved Agreement</Button>
                      </Link>
                  </div>
              </div>
          )}

          {!generatedAgreementText && !finalizedAgreement && !isPreviewing && !error && (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground border-2 border-dashed border-border rounded-md p-6">
              <FileText className="h-12 w-12 mb-4" />
              <p className="font-semibold">Agreement text preview will appear here.</p>
              <p className="text-sm text-center">Fill form and click "Preview Agreement".</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
