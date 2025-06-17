
"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/custom/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, User, Home, Loader2, AlertTriangle, CheckCircle, Eye, CalendarClock, Sigma } from 'lucide-react';
import type { Space, Agreement } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { generateAgreementAction } from '@/app/actions';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ScrollArea } from '@/components/ui/scroll-area';
import Link from 'next/link';
import { addMonths, format } from 'date-fns';
import { getMockAgreements } from '../page'; // Import helper

// Mock available spaces (in a real app, fetch this)
const mockAvailableSpaces: Space[] = [
  { id: 'space2', buildingName: 'Ocean View Plaza', spaceIdName: 'Suite 20A', area: 800, floor: '2nd', utilityRate: 1.0, monthlyRentalPrice: 1800, isOccupied: false, createdAt: new Date().toISOString() },
  { id: 'space4', buildingName: 'Tech Park One', spaceIdName: 'Lab 3', area: 2000, floor: '1st', utilityRate: 1.0, monthlyRentalPrice: 4500, isOccupied: false, createdAt: new Date().toISOString() },
];

const agreementFormSchema = z.object({
  tenantName: z.string().min(2, { message: "Tenant name must be at least 2 characters." }),
  selectedSpaceId: z.string().min(1, { message: "Please select a space." }),
  paymentTermMonths: z.coerce.number().int().positive({ message: "Payment term must be a positive number of months." }).min(1, {message: "Term must be at least 1 month."}),
  initialPaymentMonths: z.coerce.number().int().positive({ message: "Initial payment must be a positive number of months." }).min(1, {message: "Initial payment must be at least 1 month."}),
  additionalTerms: z.string().optional(),
}).refine(data => data.initialPaymentMonths <= data.paymentTermMonths, {
  message: "Initial payment months cannot exceed total payment term months.",
  path: ["initialPaymentMonths"],
});

type AgreementFormValues = z.infer<typeof agreementFormSchema>;

export default function GenerateAgreementPage() {
  const [availableSpaces, setAvailableSpaces] = useState<Space[]>([]);
  const [isMounted, setIsMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [generatedAgreement, setGeneratedAgreement] = useState<Agreement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const router = useRouter();

  const form = useForm<AgreementFormValues>({
    resolver: zodResolver(agreementFormSchema),
    defaultValues: {
      tenantName: "",
      selectedSpaceId: "",
      paymentTermMonths: 12,
      initialPaymentMonths: 1,
      additionalTerms: "",
    },
  });

  useEffect(() => {
    setIsMounted(true);
    // In a real app, you would fetch spaces and filter out occupied ones
    // For now, we use mock data and assume they are already filtered if needed
    // or update their isOccupied status if one is selected for an agreement.
    setAvailableSpaces(mockAvailableSpaces.filter(s => !s.isOccupied));
  }, []);

  const onSubmit = async (data: AgreementFormValues) => {
    setIsLoading(true);
    setError(null);
    setGeneratedAgreement(null);

    const selectedSpace = mockAvailableSpaces.find(s => s.id === data.selectedSpaceId);
    if (!selectedSpace) {
      toast({ title: "Error", description: "Selected space not found.", variant: "destructive" });
      setIsLoading(false);
      return;
    }

    const agreementInput = {
      tenantName: data.tenantName,
      building: selectedSpace.buildingName,
      spaceId: selectedSpace.spaceIdName,
      spaceArea: selectedSpace.area,
      floor: selectedSpace.floor,
      utilityRate: selectedSpace.utilityRate,
      monthlyRentalPrice: selectedSpace.monthlyRentalPrice,
      paymentTermMonths: data.paymentTermMonths,
      initialPaymentMonths: data.initialPaymentMonths,
      additionalTerms: data.additionalTerms || "",
    };

    const result = await generateAgreementAction(agreementInput);

    if ('error' in result) {
      setError(result.error);
      toast({ title: "Agreement Generation Failed", description: result.error, variant: "destructive" });
    } else if (result.agreementText) {
      const startDate = new Date();
      const nextPaymentDueDateObj = addMonths(startDate, data.initialPaymentMonths);

      const newAgreement: Agreement = {
        id: `agreement-${Date.now()}`,
        tenantId: `tenant-${Date.now()}`, // Mock tenant ID
        tenantName: data.tenantName,
        spaceId: selectedSpace.id,
        spaceDescription: `${selectedSpace.spaceIdName}, ${selectedSpace.buildingName}`,
        agreementText: result.agreementText,
        startDate: startDate.toISOString(),
        monthlyRentalPrice: selectedSpace.monthlyRentalPrice,
        utilityRate: selectedSpace.utilityRate,
        paymentTermMonths: data.paymentTermMonths,
        initialPaymentMonths: data.initialPaymentMonths,
        nextPaymentDueDate: nextPaymentDueDateObj.toISOString(),
        additionalTerms: data.additionalTerms,
        createdAt: new Date().toISOString(),
      };
      setGeneratedAgreement(newAgreement);
      toast({ title: "Agreement Generated Successfully!", description: "Review the agreement below. Saving it will make it active." });
      
      // Here you would typically save the newAgreement to your backend/localStorage
      // For this demo, let's update localStorage if used on the agreements list page
      if (typeof window !== 'undefined') {
        const existingAgreements = getMockAgreements();
        const updatedAgreements = [...existingAgreements, newAgreement];
        localStorage.setItem('mockAgreements', JSON.stringify(updatedAgreements));

        // Also mark the space as occupied in mock data (if this page managed that state)
        // This part is tricky if mockAvailableSpaces is not the same source of truth as the one on the Spaces page
        // For simplicity, this example focuses on agreement generation. Space occupancy update would be handled
        // more robustly with a shared state management or API.
      }

    } else {
        setError("Received an empty or invalid response from the AI.");
        toast({ title: "Agreement Generation Failed", description: "Received an empty or invalid response from the AI.", variant: "destructive" });
    }
    setIsLoading(false);
  };

  const handleFinalizeAndSave = () => {
    if (!generatedAgreement) return;
    // In a real app, this would involve a final save to the database
    // and potentially navigating away or resetting the form.
    // For now, just a toast.
    toast({ title: "Agreement Saved (Simulated)", description: "The agreement has been notionally saved."});
    // Potentially redirect or clear form
    // router.push("/admin/agreements");
    setGeneratedAgreement(null);
    form.reset();
  }

  if (!isMounted) {
    return <div className="flex justify-center items-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;
  }

  return (
    <div className="animate-fadeIn">
      <PageHeader
        title="Generate Rental Agreement"
        icon={FileText}
        description="Enter tenant and space details to generate a new agreement."
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="font-headline text-xl">Agreement Details</CardTitle>
            <CardDescription>Fill out the form to create a new rental agreement.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="tenantName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center"><User className="mr-2 h-4 w-4 text-primary" />Tenant Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., John Doe" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="selectedSpaceId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center"><Home className="mr-2 h-4 w-4 text-primary" />Select Space</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Choose an available space" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {availableSpaces.length > 0 ? availableSpaces.map(space => (
                            <SelectItem key={space.id} value={space.id}>
                              {space.spaceIdName} ({space.buildingName}) - ${space.monthlyRentalPrice}/month
                            </SelectItem>
                          )) : (
                            <SelectItem value="no-spaces" disabled>No available spaces</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                    control={form.control}
                    name="paymentTermMonths"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel className="flex items-center"><CalendarClock className="mr-2 h-4 w-4 text-primary" />Payment Term (Months)</FormLabel>
                        <FormControl>
                            <Input type="number" placeholder="e.g., 12" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                    <FormField
                    control={form.control}
                    name="initialPaymentMonths"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel className="flex items-center"><Sigma className="mr-2 h-4 w-4 text-primary" />Initial Payment (Months)</FormLabel>
                        <FormControl>
                            <Input type="number" placeholder="e.g., 1" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                </div>
                
                <FormField
                  control={form.control}
                  name="additionalTerms"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Additional Terms (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Enter any specific clauses or terms to be included..."
                          className="resize-none"
                          rows={4}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        These terms will be appended to the standard agreement clauses.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <Button type="submit" disabled={isLoading || availableSpaces.length === 0 || !form.formState.isValid} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating...
                    </>
                  ) : (
                    "Generate Agreement"
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="font-headline text-xl">Generated Agreement Preview</CardTitle>
            <CardDescription>The AI-generated agreement will appear here.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading && (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                <p className="font-semibold">Generating agreement...</p>
                <p className="text-sm">This may take a few moments.</p>
              </div>
            )}
            {error && !isLoading && (
              <div className="flex flex-col items-center justify-center h-64 text-destructive-foreground bg-destructive/80 p-6 rounded-md">
                <AlertTriangle className="h-12 w-12 mb-4" />
                <p className="font-semibold text-lg">Error Generating Agreement</p>
                <p className="text-sm text-center">{error}</p>
              </div>
            )}
            {generatedAgreement && !isLoading && !error && (
              <div className="space-y-4">
                <div className="flex items-center text-green-600 bg-green-50 p-3 rounded-md">
                  <CheckCircle className="h-5 w-5 mr-2" />
                  <p className="font-medium">Agreement generated successfully!</p>
                </div>
                <h3 className="text-lg font-semibold font-headline">Lease Agreement for {generatedAgreement.tenantName}</h3>
                <p className="text-sm text-muted-foreground">Space: {generatedAgreement.spaceDescription}</p>
                <div className="text-sm space-y-1">
                    <p><strong>Start Date:</strong> {format(new Date(generatedAgreement.startDate), 'PP')}</p>
                    <p><strong>Payment Term:</strong> {generatedAgreement.paymentTermMonths} months</p>
                    <p><strong>Initial Payment:</strong> {generatedAgreement.initialPaymentMonths} month(s) rent</p>
                    <p><strong>Next Payment Due:</strong> {format(new Date(generatedAgreement.nextPaymentDueDate), 'PP')}</p>
                </div>
                <ScrollArea className="h-[300px] w-full rounded-md border p-4 bg-secondary/30">
                  <pre className="whitespace-pre-wrap text-sm font-mono leading-relaxed">
                    {generatedAgreement.agreementText}
                  </pre>
                </ScrollArea>
                <div className="flex justify-end gap-2 pt-2">
                    <Link href="/admin/agreements" passHref>
                        <Button variant="outline"><Eye className="mr-2 h-4 w-4" /> View All Agreements</Button>
                    </Link>
                    <Button onClick={handleFinalizeAndSave}>Finalize & Save Agreement</Button>
                </div>
              </div>
            )}
            {!generatedAgreement && !isLoading && !error && (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground border-2 border-dashed border-border rounded-md p-6">
                <FileText className="h-12 w-12 mb-4" />
                <p className="font-semibold">Agreement preview will appear here.</p>
                <p className="text-sm text-center">Fill out the form and click "Generate Agreement".</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
