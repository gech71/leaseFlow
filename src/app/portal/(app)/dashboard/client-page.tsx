
"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/custom/PageHeader";
import {
  FileSignature,
  Banknote,
  AlertTriangle,
  CheckCircle,
  Info,
  UploadCloud,
  Download,
  User,
  Clock,
  Home,
  CreditCard,
  Landmark,
  Wallet,
  HelpCircle,
  FileText,
  Paperclip,
  MessageSquare,
  Mail,
  ChevronsUpDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  format,
  parseISO,
  isBefore,
  startOfDay,
  differenceInDays,
  addMonths,
} from "date-fns";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type {
  ClientAgreement,
  ClientBill,
  SerializedTenantPortalData,
  ClientPenaltyTier,
} from "./page";
import type { BillStatus } from "@prisma/client";
import { jsPDF } from "jspdf";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  submitPaymentProofAction,
  sendContactEmailAction,
} from "./actions";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";


const sanitizeFilename = (name: string) => {
  return name.replace(/[^a-z0-9_.-]/gi, "_").replace(/_{2,}/g, "_");
};

const contactFormSchema = z.object({
  subject: z
    .string()
    .min(3, { message: "Subject must be at least 3 characters." })
    .max(100, { message: "Subject cannot exceed 100 characters." }),
  body: z
    .string()
    .min(10, { message: "Message body must be at least 10 characters." })
    .max(2000, { message: "Message body cannot exceed 2000 characters." }),
});
type ContactFormValues = z.infer<typeof contactFormSchema>;

const proofFormSchema = z.object({
  notes: z.string().optional(),
  proofFile: z.any()
    .refine(files => files?.length === 1, "Payment proof file is required.")
    .refine(files => files?.[0]?.type === 'application/pdf', "Only PDF files are allowed.")
    .refine(files => files?.[0]?.size <= 2 * 1024 * 1024, "File size must be less than 2MB."),
});
type ProofFormValues = z.infer<typeof proofFormSchema>;

const fileToDataUri = (file: File): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result as string);
  reader.onerror = reject;
  reader.readAsDataURL(file);
});


export function CustomerDashboardClientPage({
  initialData,
}: {
  initialData: SerializedTenantPortalData | null;
}) {
  const { toast } = useToast();
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  const [today, setToday] = useState(startOfDay(new Date()));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isContactFormOpen, setIsContactFormOpen] = useState(false);
  const [payingBill, setPayingBill] = useState<ClientBill | null>(null);

  const proofFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setIsMounted(true);
    setToday(startOfDay(new Date()));
    if (initialData?.error) {
      toast({
        title: "Error Loading Data",
        description: initialData.error,
        variant: "destructive",
      });
    }
  }, [initialData, toast]);

  const agreement = initialData?.selectedAgreement;
  const allAgreements = initialData?.agreements || [];

  const contactForm = useForm<ContactFormValues>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: { subject: "", body: "" },
  });

  const proofForm = useForm<ProofFormValues>({
      resolver: zodResolver(proofFormSchema)
  });

  const handleOpenProofDialog = (bill: ClientBill) => {
    setPayingBill(bill);
  };
  
  const handleProofSubmit = async (values: ProofFormValues) => {
    if (!payingBill) return;
    
    setIsSubmitting(true);
    
    try {
      const file = values.proofFile[0];
      const paymentProofDataUri = await fileToDataUri(file);

      const result = await submitPaymentProofAction({
        billId: payingBill.id,
        paymentProofDataUri: paymentProofDataUri,
        notes: values.notes
      });
      setIsSubmitting(false);

      if (result.success) {
        toast({ title: "Proof Submitted", description: "Your payment proof has been submitted for verification." });
        setPayingBill(null);
        proofForm.reset();
        router.refresh();
      } else {
        toast({ title: "Submission Failed", description: result.error, variant: "destructive" });
      }
    } catch (error) {
      setIsSubmitting(false);
      toast({ title: "Error", description: "Failed to process the file. Please try again.", variant: "destructive" });
    }
  };


  const handleContactFormSubmit = async (values: ContactFormValues) => {
    setIsSubmitting(true);
    const result = await sendContactEmailAction(values);
    setIsSubmitting(false);
    if (result.success) {
      toast({
        title: "Message Sent",
        description: "Your message has been sent to the building manager.",
      });
      setIsContactFormOpen(false);
      contactForm.reset();
    } else {
      toast({
        title: "Failed to Send",
        description: result.error,
        variant: "destructive",
      });
    }
  };

  const handleDownloadAgreement = () => {
    if (!agreement || !agreement.agreementText) {
      toast({
        title: "Cannot Download",
        description: "Agreement text is not available.",
        variant: "destructive",
      });
      return;
    }

    const doc = new jsPDF();

    doc.html(agreement.agreementText, {
      callback: function (doc) {
        const tenantName = agreement.tenant?.name || "UnknownTenant";
        const safeTenantName = sanitizeFilename(tenantName);
        doc.save(`Agreement-${safeTenantName}-${agreement.id}.pdf`);
        toast({
          title: "Download Started",
          description: "Your agreement PDF is downloading.",
        });
      },
      x: 15,
      y: 15,
      width: 170, // A4 width in mm minus margins
      windowWidth: 650, // An arbitrary number that works well for scaling
    });
  };

  const calculatePenaltyForTenant = useCallback(
    (bill: ClientBill, penaltyTiers: ClientPenaltyTier[]): number => {
        if (!agreement || !agreement.space || !penaltyTiers || penaltyTiers.length === 0) {
            return 0;
        }

        const space = agreement.space;
        const dueDate = parseISO(bill.dueDate);
        const daysOverdue = differenceInDays(today, dueDate);

        if (daysOverdue <= 0) return 0;
        
        let applicableTiersForScope: ClientPenaltyTier[] = [];
        const spaceSpecificTiers = penaltyTiers.filter(
            t => t.scope === 'SpecificSpaces' && t.applicableSpaceIdNames?.includes(space.spaceIdName)
        );

        if (spaceSpecificTiers.length > 0) {
            applicableTiersForScope = spaceSpecificTiers;
        } else {
            const floorSpecificTiers = penaltyTiers.filter(
                t => t.scope === 'Floor' && t.applicableFloor === space.floor
            );
            if (floorSpecificTiers.length > 0) {
                applicableTiersForScope = floorSpecificTiers;
            } else {
                applicableTiersForScope = penaltyTiers.filter(t => t.scope === 'Building');
            }
        }
        
        if (applicableTiersForScope.length === 0) return 0;

        const sortedTiers = [...applicableTiersForScope].sort((a, b) => a.fromDay - b.fromDay);
        
        let totalPenalty = 0;
        const oneTimeFeesApplied = new Set<string>();

        for (let day = 1; day <= daysOverdue; day++) {
            const tierForDay = sortedTiers.find(tier => 
                day >= tier.fromDay && (tier.toDay === null || tier.toDay === undefined || day <= tier.toDay)
            );

            if (tierForDay) {
                const feeValue = Number(tierForDay.feeValue);
                let dailyFee = 0;

                if (tierForDay.penaltyType === 'Fixed') {
                    dailyFee = feeValue;
                } else if (tierForDay.penaltyType === 'Percentage') {
                    dailyFee = bill.rentAmount * (feeValue / 100);
                }

                if (tierForDay.frequency === 'Daily') {
                    totalPenalty += dailyFee;
                } else if (tierForDay.frequency === 'OneTime') {
                    if (!oneTimeFeesApplied.has(tierForDay.id!)) {
                        totalPenalty += dailyFee;
                        oneTimeFeesApplied.add(tierForDay.id!);
                    }
                }
            }
        }

        return parseFloat(totalPenalty.toFixed(2));
    },
    [agreement, today]
  );

  const processedBills = useMemo(() => {
    if (!agreement) return [];
    return agreement.bills
      .map((bill) => {
        let currentStatus = bill.status;
        if (
          currentStatus === "Pending" &&
          isBefore(parseISO(bill.dueDate), today)
        ) {
          currentStatus = "Overdue";
        }

        const penalty =
          currentStatus === "Overdue" &&
          bill.status !== "Paid"
            ? calculatePenaltyForTenant(
                bill,
                agreement.space.building.penaltyPolicyTiers,
              )
            : bill.penaltyAmount || 0;

        const baseAmount =
          bill.rentAmount +
          bill.utilityBreakdown.reduce((sum, util) => sum + util.amount, 0);
        const totalAmount = parseFloat((baseAmount + penalty).toFixed(2));

        return {
          ...bill,
          currentStatus: currentStatus,
          calculatedPenalty: penalty > 0 ? penalty : null,
          calculatedTotal: totalAmount,
        };
      })
      .sort(
        (a, b) =>
          parseISO(b.billDate).getTime() - parseISO(a.billDate).getTime(),
      );
  }, [agreement, calculatePenaltyForTenant, today]);

  const getStatusBadgeVariant = (
    status: BillStatus,
  ): "default" | "destructive" | "secondary" | "outline" => {
    switch (status) {
      case "Paid":
        return "secondary";
      case "Pending":
        return "default";
      case "Overdue":
        return "destructive";
      case 'PendingVerification':
        return 'outline';
      default:
        return "default";
    }
  };
  const getStatusIcon = (status: BillStatus) => {
    switch (status) {
      case "Paid":
        return <CheckCircle className="mr-1 h-3 w-3 text-green-600" />;
      case "Pending":
        return <Info className="mr-1 h-3 w-3" />;
      case "Overdue":
        return <AlertTriangle className="mr-1 h-3 w-3 text-red-600" />;
      case 'PendingVerification':
        return <Clock className="mr-1 h-3 w-3 text-blue-600" />;
      default:
        return <User className="mr-1 h-3 w-3" />;
    }
  };

  if (!isMounted) {
    return <div className="flex justify-center items-center h-screen"></div>;
  }

  if (initialData?.error && !agreement) {
    return (
      <Card className="mt-8 text-center">
        <CardHeader>
          <CardTitle className="text-destructive">
            Error Loading Portal Data
          </CardTitle>
        </CardHeader>
        <CardContent>
          <AlertTriangle className="mx-auto h-12 w-12 text-destructive mb-4" />
          <p>{initialData.error}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Please try again later or contact support.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!agreement) {
    return (
      <Card className="mt-8 text-center">
        <CardHeader>
          <CardTitle>No Active Agreement</CardTitle>
        </CardHeader>
        <CardContent>
          <Info className="mx-auto h-12 w-12 text-primary mb-4" />
          <p>
            There is no active rental agreement associated with your account at
            this time.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            If you believe this is an error, please contact property management.
          </p>
        </CardContent>
      </Card>
    );
  }

  const agreementEndDate = addMonths(
    parseISO(agreement.startDate),
    agreement.paymentTermMonths,
  );

  return (
    <>
      <div className="animate-fadeIn">
        <div className="mb-6 md:mb-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                <User className="h-8 w-8 text-primary" />
                <div>
                    <h1 className="text-3xl font-headline font-bold text-foreground">{`Welcome, ${agreement.tenant.name}!`}</h1>
                    <p className="text-muted-foreground mt-1">View your lease details and billing history.</p>
                </div>
                </div>
                <div className="flex items-center gap-2">
                    {allAgreements.length > 1 && (
                        <Select 
                            value={agreement.id} 
                            onValueChange={(id) => router.push(`/portal/dashboard?agreementId=${id}`)}
                        >
                            <SelectTrigger className="w-full sm:w-[250px]">
                                <SelectValue placeholder="Select a property..." />
                            </SelectTrigger>
                            <SelectContent>
                                {allAgreements.map(ag => (
                                    <SelectItem key={ag.id} value={ag.id}>
                                        {ag.space.spaceIdName}, {ag.space.building.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                    <Button onClick={() => setIsContactFormOpen(true)}>
                        <Mail className="mr-2 h-4 w-4" /> Contact Manager
                    </Button>
                </div>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-3 space-y-6">
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="font-headline text-xl flex items-center">
                  <FileSignature className="mr-2 text-primary" />
                  Current Lease Agreement
                </CardTitle>
                <CardDescription>
                  Details of your rental agreement.
                </CardDescription>
              </CardHeader>
              <CardContent className="text-sm">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-2">
                  <p>
                    <strong>Property:</strong> {agreement.space.spaceIdName},{" "}
                    {agreement.space.building.name}
                  </p>
                  <p>
                    <strong>Address:</strong>{" "}
                    {agreement.space.building.address || "N/A"}
                  </p>
                  <p>
                    <strong>Floor:</strong> {agreement.space.floor}
                  </p>
                  <p>
                    <strong>Area:</strong> {agreement.space.area} m²
                  </p>
                  <p>
                    <strong>Monthly Rent:</strong>{" "}
                    {agreement.monthlyRentalPrice.toLocaleString()} Birr
                  </p>
                  <p>
                    <strong>Lease Start Date:</strong>{" "}
                    {format(parseISO(agreement.startDate), "PP")}
                  </p>
                  <p>
                    <strong>Lease End Date:</strong>{" "}
                    {format(agreementEndDate, "PP")}
                  </p>
                  <p>
                    <strong>Payment Term:</strong> {agreement.paymentTermMonths}{" "}
                    months
                  </p>
                  <p>
                    <strong>Next Lease Payment Due:</strong>{" "}
                    {format(parseISO(agreement.nextPaymentDueDate), "PP")}
                  </p>
                </div>
              </CardContent>
              <CardFooter>
                <Button
                  onClick={handleDownloadAgreement}
                  variant="outline"
                  className="w-full sm:w-auto"
                >
                  <Download className="mr-2 h-4 w-4" /> Download Full Agreement
                  PDF
                </Button>
              </CardFooter>
            </Card>

            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="font-headline text-xl flex items-center">
                  <Banknote className="mr-2 text-primary" />
                  Billing History
                </CardTitle>
                <CardDescription>
                  Your payment obligations and history.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {processedBills.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No bills found for this agreement yet.
                  </p>
                ) : (
                  <div className="w-full overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Due Date</TableHead>
                          <TableHead>Rent</TableHead>
                          <TableHead>Utilities</TableHead>
                          <TableHead>Penalty</TableHead>
                          <TableHead>Total Due</TableHead>
                          <TableHead className="text-center">Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {processedBills.map((bill) => (
                          <TableRow
                            key={bill.id}
                            className={`${
                              bill.currentStatus === "Overdue"
                                ? "bg-destructive/5 hover:bg-destructive/10"
                                : ""
                            }`}
                          >
                            <TableCell
                              className={`p-2 ${
                                bill.currentStatus === "Overdue"
                                  ? "font-semibold text-destructive"
                                  : ""
                              }`}
                            >
                              {format(parseISO(bill.dueDate), "PP")}
                            </TableCell>
                            <TableCell className="p-2 whitespace-nowrap">
                              {bill.rentAmount.toFixed(2)} Birr
                            </TableCell>
                            <TableCell className="p-2 whitespace-nowrap">
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button
                                    variant="link"
                                    className="p-0 h-auto text-primary"
                                  >
                                    {bill.utilityBreakdown
                                      .reduce((sum, u) => sum + u.amount, 0)
                                      .toFixed(2)}{" "}
                                    Birr
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-60">
                                  <div className="grid gap-2">
                                    <h4 className="font-medium leading-none">
                                      Utility Details
                                    </h4>
                                    <div className="text-sm space-y-1">
                                      {bill.utilityBreakdown.length > 0 ? (
                                        bill.utilityBreakdown.map((u) => (
                                          <div
                                            key={u.id || u.name}
                                            className="flex justify-between"
                                          >
                                            <span>{u.name}:</span>{" "}
                                            <span>{u.amount.toFixed(2)}</span>
                                          </div>
                                        ))
                                      ) : (
                                        <p className="text-muted-foreground">
                                          No utility items.
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                </PopoverContent>
                              </Popover>
                            </TableCell>
                            <TableCell className="p-2 whitespace-nowrap text-destructive">
                              {bill.calculatedPenalty
                                ? `${bill.calculatedPenalty.toFixed(2)} Birr`
                                : "-"}
                            </TableCell>
                            <TableCell className="p-2 text-base font-semibold text-primary whitespace-nowrap">
                              {bill.calculatedTotal?.toFixed(2)} Birr
                            </TableCell>
                            <TableCell className="p-2 text-center">
                              <Badge
                                variant={getStatusBadgeVariant(
                                  bill.currentStatus || bill.status,
                                )}
                                className="capitalize text-xs"
                              >
                                {getStatusIcon(
                                  bill.currentStatus || bill.status,
                                )}
                                <span className="ml-1">
                                  {(bill.currentStatus || bill.status).replace('PendingVerification', 'Verifying')}
                                </span>
                              </Badge>
                            </TableCell>
                            <TableCell className="p-2 text-right">
                              {(bill.currentStatus === "Pending" ||
                                bill.currentStatus === "Overdue") && (
                                <Button
                                  size="sm"
                                  onClick={() => handleOpenProofDialog(bill)}
                                >
                                  Pay Now
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <Dialog open={!!payingBill} onOpenChange={(isOpen) => { if (!isOpen) { setPayingBill(null); proofForm.reset(); } }}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle className="font-headline">Submit Payment Proof</DialogTitle>
                <DialogDescription>
                    For bill due on {payingBill ? format(parseISO(payingBill.dueDate), 'PP') : ''}. 
                    Total amount: {payingBill?.calculatedTotal?.toFixed(2)} Birr.
                </DialogDescription>
            </DialogHeader>
            <Form {...proofForm}>
                <form onSubmit={proofForm.handleSubmit(handleProofSubmit)} className="space-y-4 py-2">
                    <FormField
                        control={proofForm.control}
                        name="proofFile"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="flex items-center"><Paperclip className="mr-2 h-4 w-4"/>Payment Proof (PDF only)</FormLabel>
                                <FormControl>
                                    <Input 
                                      type="file" 
                                      accept="application/pdf"
                                      {...proofForm.register('proofFile')}
                                      disabled={isSubmitting}
                                    />
                                </FormControl>
                                <FormMessage/>
                            </FormItem>
                        )}
                    />
                     <FormField
                        control={proofForm.control}
                        name="notes"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Notes (e.g., Transaction ID)</FormLabel>
                                <FormControl>
                                    <Textarea
                                        placeholder="Add any relevant notes for the administrator..."
                                        {...field}
                                        disabled={isSubmitting}
                                    />
                                </FormControl>
                                <FormMessage/>
                            </FormItem>
                        )}
                    />
                    <DialogFooter className="pt-4">
                        <DialogClose asChild>
                            <Button type="button" variant="outline" disabled={isSubmitting}>Cancel</Button>
                        </DialogClose>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <UploadCloud className="mr-2 h-4 w-4"/>}
                            Submit for Verification
                        </Button>
                    </DialogFooter>
                </form>
            </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={isContactFormOpen} onOpenChange={setIsContactFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-headline text-xl">
              Contact Manager
            </DialogTitle>
            <DialogDescription>
              Send a message directly to the manager(s) of your building.
            </DialogDescription>
          </DialogHeader>
          <Form {...contactForm}>
            <form
              onSubmit={contactForm.handleSubmit(handleContactFormSubmit)}
              className="space-y-4 py-2"
            >
              <FormField
                control={contactForm.control}
                name="subject"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Subject</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Message subject"
                        {...field}
                        disabled={isSubmitting}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={contactForm.control}
                name="body"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Message</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Your message..."
                        {...field}
                        disabled={isSubmitting}
                        rows={6}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter className="pt-4">
                <DialogClose asChild>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                </DialogClose>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Send Message
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
