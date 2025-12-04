"use client";

import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
import { PageHeader } from "@/components/custom/PageHeader";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Banknote,
  FileText,
  User,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Edit,
  Trash2,
  Zap,
  CreditCard,
  CalendarIcon as CalendarLucideIcon,
  InfoIcon,
  Building as BuildingIconLucide,
  UploadCloud,
  MessageSquare,
  ShieldCheck,
  ShieldX,
  Paperclip,
  Eye,
  EyeOff,
  Search,
  Clock,
} from "lucide-react";
import type {
  Agreement as AgreementPrisma,
  Bill as BillPrismaOriginal,
  Space as SpacePrisma,
  Building as BuildingPrisma,
  BuildingMonthlyUtilities as BuildingMonthlyUtilitiesPrisma,
  PenaltyTier as PenaltyTierPrisma,
  UtilityBreakdownItem as UtilityBreakdownItemPrismaOriginal,
  Prisma,
  Tenant as TenantPrismaOriginal,
} from "@prisma/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  addMonths,
  format,
  isBefore,
  startOfDay,
  isAfter,
  isSameDay,
  getYear,
  getMonth,
  parseISO,
  differenceInDays,
} from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  getBillingPageDataAction,
  generateBillAndUpdateAgreementAction,
  recordPaymentOrVerificationAction,
  updateBillAdminDetailsAction,
} from "./actions";
import type {
  SerializedBillingPageData,
  ClientBill,
  ClientAgreement,
  ClientBuilding,
} from "./page";
import { usePermissions } from "@/contexts/PermissionContext";
import { PaginationControls } from "@/components/custom/PaginationControls";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const paymentFormSchema = z.object({
  paymentDate: z.date({ required_error: "Payment date is required." }),
  paymentReference: z.string().optional(),
});
type PaymentFormValues = z.infer<typeof paymentFormSchema>;

const verificationFormSchema = z.object({
  adminVerificationNotes: z.string().optional(),
});
type VerificationFormValues = z.infer<typeof verificationFormSchema>;

interface BillingClientPageProps {
  initialData: SerializedBillingPageData;
}

export function BillingClientPage({ initialData }: BillingClientPageProps) {
  const [agreements, setAgreements] = useState<ClientAgreement[]>(
    initialData.agreements,
  );
  const [bills, setBills] = useState<ClientBill[]>(initialData.bills);
  const [allBuildings, setAllBuildings] = useState<ClientBuilding[]>(
    initialData.buildings,
  );

  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [billForPayment, setBillForPayment] = useState<ClientBill | null>(null);

  const [isMounted, setIsMounted] = useState(false);
  const { toast } = useToast();
  const [today, setToday] = useState(startOfDay(new Date()));
  const [isLoading, setIsLoading] = useState(false);
  const [billFilterTerm, setBillFilterTerm] = useState("");
  const [filterYear, setFilterYear] = useState<number | "all">("all");
  const [filterMonth, setFilterMonth] = useState<number | "all">("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const [individualBillFilter, setIndividualBillFilter] = useState("");
  const [generationFilterStatus, setGenerationFilterStatus] = useState<
    "all" | "ready" | "upcoming"
  >("all");
  const [generationCurrentPage, setGenerationCurrentPage] = useState(1);
  const [generationItemsPerPage, setGenerationItemsPerPage] = useState(3);

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(3);

  const { hasPermission, isSuperAdmin } = usePermissions();
  const canGenerateBills = isSuperAdmin || hasPermission("billing:generate");
  const canManagePayments =
    isSuperAdmin || hasPermission("billing:manage_payments");
  const canViewBilling =
    isSuperAdmin ||
    hasPermission("billing:view") ||
    canGenerateBills ||
    canManagePayments;

  const paymentForm = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: {
      paymentDate: new Date(),
      paymentReference: "",
    },
  });

  const verificationForm = useForm<VerificationFormValues>({
    resolver: zodResolver(verificationFormSchema),
    defaultValues: { adminVerificationNotes: "" },
  });

  const isReadOnly = billForPayment?.status === "Paid";

  const handleItemsPerPageChange = (newSize: number) => {
    setItemsPerPage(newSize);
    setCurrentPage(1);
  };

  const handleGenerationItemsPerPageChange = (newSize: number) => {
    setGenerationItemsPerPage(newSize);
    setGenerationCurrentPage(1);
  };

  useEffect(() => {
    setIsMounted(true);
    setAgreements(initialData.agreements);
    setBills(initialData.bills);
    setAllBuildings(initialData.buildings);
    setToday(startOfDay(new Date()));
  }, [initialData]);

  useEffect(() => {
    setCurrentPage(1);
  }, [billFilterTerm, filterYear, filterMonth, filterStatus]);

  useEffect(() => {
    setGenerationCurrentPage(1);
  }, [individualBillFilter, generationFilterStatus]);

  const refreshBillingData = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await getBillingPageDataAction();
      setAgreements(result.agreements);
      setBills(result.bills);
      setAllBuildings(result.buildings);
    } catch (e: any) {
      toast({
        title: "Error Refreshing Data",
        description: e.message || "An unknown error occurred.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const calculatePenalty = useCallback(
    (bill: ClientBill, currentStatus: ClientBill["status"]): number => {
      const agreementForBill = agreements.find(
        (ag) => ag.id === bill.agreementId,
      );
      if (
        !agreementForBill ||
        !agreementForBill.space ||
        !agreementForBill.space.building
      )
        return 0;

      const space = agreementForBill.space;
      const building = allBuildings.find((b) => b.id === space.buildingId);
      if (
        !building ||
        !building.penaltyPolicyTiers ||
        building.penaltyPolicyTiers.length === 0
      )
        return 0;

      const dueDate = parseISO(bill.dueDate);
      if (currentStatus !== "Overdue") return 0;

      const daysOverdue = differenceInDays(today, dueDate);
      if (daysOverdue <= 0) return 0;

      const allTiers = building.penaltyPolicyTiers;
      const spaceSpecificTiers = allTiers.filter(
        (t) =>
          t.scope === "SpecificSpaces" &&
          t.applicableSpaceIdNames?.includes(space.spaceIdName),
      );
      const floorSpecificTiers = allTiers.filter(
        (t) => t.scope === "Floor" && t.applicableFloor === space.floor,
      );
      const buildingWideTiers = allTiers.filter((t) => t.scope === "Building");

      let applicableTiers: typeof allTiers = [];
      if (spaceSpecificTiers.length > 0) {
        applicableTiers = spaceSpecificTiers;
      } else if (floorSpecificTiers.length > 0) {
        applicableTiers = floorSpecificTiers;
      } else {
        applicableTiers = buildingWideTiers;
      }

      if (applicableTiers.length === 0) return 0;

      const sortedTiers = [...applicableTiers].sort(
        (a, b) => a.fromDay - b.fromDay,
      );

      let totalPenalty = 0;
      let oneTimeFeesApplied = new Set<string>();

      for (let day = 1; day <= daysOverdue; day++) {
        const tierForDay = sortedTiers.find(
          (tier) =>
            day >= tier.fromDay &&
            (tier.toDay === null ||
              tier.toDay === undefined ||
              day <= tier.toDay),
        );

        if (tierForDay) {
          const feeValue = Number(tierForDay.feeValue);
          let dailyFee = 0;

          if (tierForDay.penaltyType === "Fixed") {
            dailyFee = feeValue;
          } else if (tierForDay.penaltyType === "Percentage") {
            dailyFee = bill.rentAmount * (feeValue / 100);
          }

          if (tierForDay.frequency === "Daily") {
            totalPenalty += dailyFee;
          } else if (tierForDay.frequency === "OneTime") {
            if (!oneTimeFeesApplied.has(tierForDay.id!)) {
              totalPenalty += dailyFee;
              oneTimeFeesApplied.add(tierForDay.id!);
            }
          }
        }
      }

      return parseFloat(totalPenalty.toFixed(2));
    },
    [agreements, allBuildings, today],
  );

  const processedClientBills = useMemo(() => {
    return bills
      .map((bill) => {
        let currentStatus = bill.status as BillPrismaOriginal["status"];
        if (
          bill.status === "Pending" &&
          isBefore(parseISO(bill.dueDate), today)
        ) {
          currentStatus = "Overdue";
        }

        const penalty =
          currentStatus === "Overdue" && bill.status !== "Paid"
            ? calculatePenalty(bill, currentStatus)
            : bill.penaltyAmount || 0;

        const baseAmount =
          bill.rentAmount +
          bill.utilityBreakdown.reduce((sum, util) => sum + util.amount, 0);
        const newTotalAmount = baseAmount + (penalty || 0);

        return {
          ...bill,
          currentStatus: currentStatus,
          penaltyAmount: penalty > 0 ? penalty : null,
          totalAmount: parseFloat(newTotalAmount.toFixed(2)),
          tenantName: bill.agreement?.tenant?.name || "N/A",
        };
      })
      .filter((bill) => {
        // Text search filter
        if (billFilterTerm) {
          const searchTermLower = billFilterTerm.toLowerCase();
          const tenantName = bill.tenantName.toLowerCase();
          const spaceIdName =
            bill.agreement?.space?.spaceIdName.toLowerCase() || "";
          const buildingName =
            bill.agreement?.space?.building?.name.toLowerCase() || "";
          if (
            !(
              tenantName.includes(searchTermLower) ||
              spaceIdName.includes(searchTermLower) ||
              buildingName.includes(searchTermLower)
            )
          ) {
            return false;
          }
        }

        // Date filter
        const billDate = parseISO(bill.billDate);
        if (filterYear !== "all") {
          if (getYear(billDate) !== filterYear) {
            return false;
          }
          if (filterMonth !== "all") {
            if (getMonth(billDate) !== filterMonth) {
              return false;
            }
          }
        }

        // Status filter
        if (filterStatus !== "all" && bill.currentStatus !== filterStatus) {
          return false;
        }

        return true;
      })
      .sort(
        (a, b) =>
          parseISO(b.createdAt).getTime() - parseISO(a.createdAt).getTime(),
      );
  }, [
    bills,
    calculatePenalty,
    today,
    billFilterTerm,
    filterYear,
    filterMonth,
    filterStatus,
  ]);

  const filteredAgreementsForGeneration = useMemo(() => {
    const todayUtcDateString = new Date().toISOString().substring(0, 10);
    return agreements.filter((agreement) => {
      if (!agreement.tenant || !agreement.space) return false;

      // Only include active agreements
      if (agreement.status !== "Active") return false;

      const agreementStartDate = startOfDay(parseISO(agreement.startDate));
      const agreementEndDate = addMonths(
        agreementStartDate,
        agreement.paymentTermMonths,
      );

      const isWithinDateRange =
        !isBefore(today, agreementStartDate) &&
        !isAfter(today, agreementEndDate);

      if (!isWithinDateRange) return false;

      const nextDueDateString = agreement.nextPaymentDueDate.substring(0, 10);
      const isDueForGeneration = nextDueDateString <= todayUtcDateString;
      if (generationFilterStatus === "ready" && !isDueForGeneration)
        return false;
      if (generationFilterStatus === "upcoming" && isDueForGeneration)
        return false;

      const searchTerm = individualBillFilter.toLowerCase();
      if (!searchTerm) return true;

      const tenantName = agreement.tenant.name.toLowerCase();
      const spaceName = agreement.space.spaceIdName.toLowerCase();
      const buildingName = agreement.space.buildingName.toLowerCase();

      return (
        tenantName.includes(searchTerm) ||
        spaceName.includes(searchTerm) ||
        buildingName.includes(searchTerm)
      );
    });
  }, [agreements, individualBillFilter, today, generationFilterStatus]);

  const generationTotalPages = Math.ceil(
    filteredAgreementsForGeneration.length / generationItemsPerPage,
  );
  const paginatedAgreementsForGeneration =
    filteredAgreementsForGeneration.slice(
      (generationCurrentPage - 1) * generationItemsPerPage,
      generationCurrentPage * generationItemsPerPage,
    );

  const totalPages = Math.ceil(processedClientBills.length / itemsPerPage);
  const paginatedBills = processedClientBills.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  useEffect(() => {
    if (isPaymentDialogOpen && billForPayment) {
      const processedBill = processedClientBills.find(
        (pb) => pb.id === billForPayment.id,
      );
      paymentForm.reset({
        paymentDate: processedBill?.paymentDate
          ? parseISO(processedBill.paymentDate)
          : new Date(),
        paymentReference: processedBill?.paymentReference || "",
      });
      verificationForm.reset({
        adminVerificationNotes: processedBill?.adminVerificationNotes || "",
      });
    }
  }, [
    isPaymentDialogOpen,
    billForPayment,
    paymentForm,
    verificationForm,
    processedClientBills,
  ]);

  const handleGenerateSingleBill = async (agreementId: string) => {
    if (!canGenerateBills) {
      toast({
        title: "Permission Denied",
        description: "Access Denied",
        variant: "destructive",
      });
      return;
    }
    const agreement = agreements.find((ag) => ag.id === agreementId);
    if (!agreement) {
      toast({
        title: "Error",
        description: "Agreement not found.",
        variant: "destructive",
      });
      return;
    }

    const nextDueDateString = agreement.nextPaymentDueDate.substring(0, 10);

    setIsLoading(true);
    const result = await generateBillAndUpdateAgreementAction(
      agreementId,
      nextDueDateString,
    );
    setIsLoading(false);

    if (result.success && result.bill) {
      toast({
        title: "Bill Generated",
        description: `New bill for ${agreement.tenant?.name} (Due: ${format(
          parseISO(result.bill.dueDate as string),
          "PP",
        )}) created. Total: ${result.bill.totalAmount.toFixed(2)} Birr`,
      });
      await refreshBillingData();
    } else {
      toast({
        title: "Bill Generation Failed",
        description: result.error || "An unknown error occurred.",
        variant: "destructive",
      });
    }
  };

  const handleGenerateAllDueBills = async () => {
    if (!canGenerateBills) {
      toast({
        title: "Permission Denied",
        description: "Access Denied",
        variant: "destructive",
      });
      return;
    }
    setIsLoading(true);
    let totalGenerated = 0;
    let totalSkipped = 0;
    let totalErrors = 0;
    const errorMessages: string[] = [];

    const todayUtcDateString = new Date().toISOString().substring(0, 10);

    for (const agreement of agreements) {
      // Only process active agreements
      if (agreement.status !== "Active") {
        totalSkipped++;
        continue;
      }

      let currentNextDueDate = agreement.nextPaymentDueDate;
      let generatedForThisAgreement = false;
      let stopProcessing = false;

      while (!stopProcessing) {
        const agreementStartDate = parseISO(agreement.startDate);
        const agreementEndDate = addMonths(
          agreementStartDate,
          agreement.paymentTermMonths,
        );

        if (
          isBefore(today, agreementStartDate) ||
          isAfter(today, agreementEndDate)
        ) {
          stopProcessing = true;
          continue;
        }

        const nextDueDateString = currentNextDueDate.substring(0, 10);
        if (nextDueDateString > todayUtcDateString) {
          stopProcessing = true;
          continue;
        }

        const result = await generateBillAndUpdateAgreementAction(
          agreement.id,
          nextDueDateString,
        );

        if (result.success && result.bill) {
          totalGenerated++;
          generatedForThisAgreement = true;
          currentNextDueDate = addMonths(
            parseISO(result.bill.dueDate as string),
            1,
          ).toISOString();
        } else {
          if (result.error && !result.error.includes("already exists")) {
            totalErrors++;
            errorMessages.push(
              result.error || `Failed for ${agreement.tenant?.name}`,
            );
          }
          stopProcessing = true;
        }
      }

      if (!generatedForThisAgreement) {
        totalSkipped++;
      }
    }

    setIsLoading(false);
    let summaryMessage = `${totalGenerated} bills generated. ${totalSkipped} agreements skipped.`;
    if (totalErrors > 0) summaryMessage += ` ${totalErrors} failed.`;

    toast({
      title: "Bulk Bill Generation Complete",
      description: summaryMessage,
    });

    if (errorMessages.length > 0) {
      toast({
        title: "Bulk Generation Errors",
        description: errorMessages.slice(0, 3).join("; "),
        variant: "destructive",
        duration: 10000,
      });
    }
    await refreshBillingData();
  };

  const handleOpenPaymentDialog = (bill: ClientBill) => {
    setBillForPayment(bill);
    setIsPaymentDialogOpen(true);
  };

  const handlePaymentAction = async (
    actionType: "confirmVerification" | "rejectVerification",
  ) => {
    if (!billForPayment) return;
    if (!canManagePayments) {
      toast({
        title: "Permission Denied",
        description: "Access Denied",
        variant: "destructive",
      });
      return;
    }
    setIsLoading(true);

    const verificationValues = verificationForm.getValues();
    const result = await recordPaymentOrVerificationAction(
      billForPayment.id,
      {
        paymentDate: billForPayment.paymentDate || new Date().toISOString(),
        adminVerificationNotes: verificationValues.adminVerificationNotes,
      },
      actionType,
    );
    setIsLoading(false);

    if (result.success) {
      toast({
        title: "Success",
        description: `Verification status updated for bill ${billForPayment.id}.`,
      });
      setIsPaymentDialogOpen(false);
      await refreshBillingData();
    } else {
      toast({
        title: "Error",
        description: result.error,
        variant: "destructive",
      });
    }
  };

  const handleRecordPaymentSubmit = async (values: PaymentFormValues) => {
    if (!billForPayment || !billForPayment.agreement) return;
    if (!canManagePayments) {
      toast({
        title: "Permission Denied",
        description: "Access Denied",
        variant: "destructive",
      });
      return;
    }
    setIsLoading(true);

    const result = await recordPaymentOrVerificationAction(
      billForPayment.id,
      {
        ...values,
        paymentDate: values.paymentDate.toISOString(),
      },
      "recordPayment",
    );
    setIsLoading(false);

    if (result.success) {
      toast({
        title: "Payment Recorded",
        description: `Payment for bill ${billForPayment.id} recorded.`,
      });
      setIsPaymentDialogOpen(false);
      paymentForm.reset();
      await refreshBillingData();
    } else {
      toast({
        title: "Error Recording Payment",
        description: result.error,
        variant: "destructive",
      });
    }
  };

  const getStatusBadgeVariant = (
    status: ClientBill["status"] | BillPrismaOriginal["status"],
  ): "default" | "destructive" | "secondary" | "outline" => {
    switch (status) {
      case "Paid":
        return "secondary";
      case "Pending":
        return "default";
      case "Overdue":
        return "destructive";
      case "PendingVerification":
        return "outline";
      default:
        return "default";
    }
  };

  const getStatusIcon = (
    status: ClientBill["status"] | BillPrismaOriginal["status"],
  ) => {
    switch (status) {
      case "Paid":
        return <CheckCircle className="mr-1 h-3 w-3 text-green-600" />;
      case "Pending":
        return <InfoIcon className="mr-1 h-3 w-3 text-yellow-600" />;
      case "Overdue":
        return <AlertTriangle className="mr-1 h-3 w-3 text-red-600" />;
      case "PendingVerification":
        return <Clock className="mr-1 h-3 w-3 text-blue-600" />;
      default:
        return <InfoIcon className="mr-1 h-3 w-3" />;
    }
  };

  const todayUtcDateString = new Date().toISOString().substring(0, 10);

  const yearsForFilter = useMemo(() => {
    if (!bills) return [];
    const years = new Set(bills.map((r) => getYear(parseISO(r.billDate))));
    return Array.from(years).sort((a, b) => b - a);
  }, [bills]);

  const monthsForFilter = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => ({
      value: i,
      label: format(new Date(0, i), "MMMM"),
    }));
  }, []);

  if (!isMounted && agreements.length === 0 && !canViewBilling) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  if (!canViewBilling && isMounted) {
    return (
      <Card className="shadow-lg text-center py-12">
        <CardHeader>
          <CardTitle className="text-destructive flex items-center justify-center">
            <EyeOff className="mr-2" />
            Access Denied
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p>Access Denied</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="animate-fadeIn">
      <PageHeader
        title="Billing Management"
        icon={Banknote}
        description="Generate and manage bills. Verify tenant-submitted payments."
      />

      {canGenerateBills && (
        <Card className="mb-6 shadow-sm">
          <CardHeader>
            <CardTitle className="font-headline">
              Bulk Bill Generation
            </CardTitle>
            <CardDescription>
              Generate bills for all agreements that are due for payment.
              Utility costs must be entered on 'Building Utilities'. Late fees
              apply based on building policies.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={handleGenerateAllDueBills}
              className="w-full md:w-auto bg-accent text-accent-foreground hover:bg-accent/90"
              disabled={isLoading || agreements.length === 0}
            >
              {isLoading ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <Zap className="mr-2 h-5 w-5" />
              )}
              Generate All Due Bills
            </Button>
          </CardContent>

          <div className="px-6 pb-6 pt-4">
            <div className="pt-4 border-t">
              <h3 className="text-xl font-bold tracking-tight font-headline">
                Individual Bill Generation
              </h3>
              <p className="text-muted-foreground mt-1 text-sm">
                Find an active agreement to generate its next due bill.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 mt-4 mb-6">
              <div className="relative flex-grow">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  placeholder="Filter by tenant, space, or building..."
                  className="pl-10 h-9"
                  value={individualBillFilter}
                  onChange={(e) => setIndividualBillFilter(e.target.value)}
                />
              </div>
              <Select
                value={generationFilterStatus}
                onValueChange={(value) =>
                  setGenerationFilterStatus(value as any)
                }
              >
                <SelectTrigger className="w-full sm:w-[200px] h-9">
                  <SelectValue placeholder="Filter by generation status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Active Agreements</SelectItem>
                  <SelectItem value="ready">Ready for Generation</SelectItem>
                  <SelectItem value="upcoming">Upcoming</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {paginatedAgreementsForGeneration.length > 0 ? (
              <>
                <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {paginatedAgreementsForGeneration.map((agreement) => {
                    if (!agreement.tenant || !agreement.space) return null;

                    const nextDueDateString =
                      agreement.nextPaymentDueDate.substring(0, 10);
                    const isDueForGeneration =
                      nextDueDateString <= todayUtcDateString;

                    return (
                      <Card
                        key={agreement.id}
                        className="flex flex-col h-full shadow-md border"
                      >
                        <CardContent className="pt-5 pb-4 flex-grow flex flex-col">
                          <p className="font-semibold text-base leading-tight">
                            {agreement.tenant.name}
                          </p>
                          <p className="text-sm text-muted-foreground mt-1">
                            {agreement.space.spaceIdName},{" "}
                            {agreement.space.buildingName}
                          </p>
                          <div className="flex-grow" />
                          <div className="mt-4 space-y-2">
                            <p className="text-sm text-muted-foreground">
                              Next Due:{" "}
                              {format(
                                parseISO(agreement.nextPaymentDueDate),
                                "PP",
                              )}
                            </p>
                            <div>
                              {isDueForGeneration ? (
                                <Badge className="font-medium text-xs bg-green-100 text-green-800 border-transparent hover:bg-green-200">
                                  Ready for Generation
                                </Badge>
                              ) : (
                                <Badge
                                  variant="secondary"
                                  className="font-normal text-xs"
                                >
                                  Upcoming
                                </Badge>
                              )}
                            </div>
                          </div>
                        </CardContent>
                        <CardFooter className="pb-4">
                          <Button
                            className="w-full"
                            onClick={() =>
                              handleGenerateSingleBill(agreement.id)
                            }
                            disabled={isLoading}
                          >
                            Generate Bill
                          </Button>
                        </CardFooter>
                      </Card>
                    );
                  })}
                </div>
                <PaginationControls
                  currentPage={generationCurrentPage}
                  totalPages={generationTotalPages}
                  onPageChange={setGenerationCurrentPage}
                  itemsPerPage={generationItemsPerPage}
                  onItemsPerPageChange={handleGenerationItemsPerPageChange}
                  className="mt-6"
                />
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground border rounded-md mt-4">
                <p>No active agreements match your filter.</p>
              </div>
            )}
          </div>
        </Card>
      )}

      <Dialog
        open={isPaymentDialogOpen}
        onOpenChange={(isOpen) => {
          setIsPaymentDialogOpen(isOpen);
          if (!isOpen) {
            setBillForPayment(null);
            paymentForm.reset();
            verificationForm.reset();
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-headline text-xl">
              {billForPayment?.status === "PendingVerification"
                ? "Verify Payment"
                : isReadOnly
                ? "View Payment Details"
                : "Record Payment"}
            </DialogTitle>
            <DialogDescription>
              For bill ID: {billForPayment?.id}
            </DialogDescription>
          </DialogHeader>
          {billForPayment?.status === "PendingVerification" ? (
            <div className="space-y-4 py-2">
              <div className="text-sm">
                <p className="font-medium text-foreground">Tenant Notes:</p>
                <p className="text-muted-foreground p-2 bg-secondary/50 rounded-md">
                  {billForPayment.tenantPaymentNotes || "No notes provided."}
                </p>
              </div>
              {billForPayment.paymentProofDataUri && (
                <Button asChild variant="outline" className="w-full">
                  <a
                    href={billForPayment.paymentProofDataUri}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Paperclip className="mr-2 h-4 w-4" /> View Proof of Payment
                  </a>
                </Button>
              )}
              <Form {...verificationForm}>
                <form
                  className="space-y-4"
                  onSubmit={(e) => e.preventDefault()}
                >
                  <FormField
                    control={verificationForm.control}
                    name="adminVerificationNotes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Verification Notes</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Verification Notes"
                            {...field}
                            disabled={isLoading}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </form>
              </Form>
              <DialogFooter className="pt-4">
                <Button
                  variant="destructive"
                  onClick={() => handlePaymentAction("rejectVerification")}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <ShieldX className="mr-2 h-4 w-4" />
                  )}
                  Reject
                </Button>
                <Button
                  variant="default"
                  onClick={() => handlePaymentAction("confirmVerification")}
                  disabled={isLoading}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {isLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <ShieldCheck className="mr-2 h-4 w-4" />
                  )}
                  Confirm
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <Form {...paymentForm}>
              <form
                onSubmit={paymentForm.handleSubmit(handleRecordPaymentSubmit)}
                className="space-y-4 py-2"
              >
                <FormField
                  control={paymentForm.control}
                  name="paymentDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>
                        Payment Date
                        <span className="text-destructive ml-1">*</span>
                      </FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={`w-full pl-3 text-left font-normal ${
                                !field.value && "text-muted-foreground"
                              }`}
                              disabled={
                                isReadOnly || isLoading || !canManagePayments
                              }
                            >
                              {field.value ? (
                                format(field.value, "PPP")
                              ) : (
                                <span>Pick payment date</span>
                              )}
                              <CalendarLucideIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) =>
                              date > new Date() || date < new Date("1900-01-01")
                            }
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={paymentForm.control}
                  name="paymentReference"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payment Reference (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Transaction ID, Check No., etc."
                          {...field}
                          disabled={
                            isReadOnly || isLoading || !canManagePayments
                          }
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
                      disabled={isLoading}
                    >
                      Cancel
                    </Button>
                  </DialogClose>
                  {!isReadOnly && canManagePayments && (
                    <Button
                      type="submit"
                      className="bg-primary hover:bg-primary/90 text-primary-foreground"
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : null}
                      {"Record as Paid"}
                    </Button>
                  )}
                </DialogFooter>
              </form>
            </Form>
          )}
        </DialogContent>
      </Dialog>

      <div className="space-y-4 mt-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h2 className="text-2xl font-headline font-semibold">
            Generated Bills
          </h2>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <div className="relative flex-grow">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                placeholder="Filter by tenant, space..."
                className="pl-10 h-9"
                value={billFilterTerm}
                onChange={(e) => setBillFilterTerm(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-full sm:w-[180px] h-9">
                  <SelectValue placeholder="Filter by bill status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="Paid">Paid</SelectItem>
                  <SelectItem value="Overdue">Overdue</SelectItem>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="PendingVerification">
                    Pending Verification
                  </SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={String(filterYear)}
                onValueChange={(val) => {
                  setFilterYear(val === "all" ? "all" : Number(val));
                  if (val === "all") setFilterMonth("all");
                }}
              >
                <SelectTrigger className="w-full sm:w-[120px] h-9">
                  <SelectValue placeholder="Filter by year" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Years</SelectItem>
                  {yearsForFilter.map((year) => (
                    <SelectItem key={year} value={String(year)}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={String(filterMonth)}
                onValueChange={(val) =>
                  setFilterMonth(val === "all" ? "all" : Number(val))
                }
                disabled={filterYear === "all"}
              >
                <SelectTrigger className="w-full sm:w-[150px] h-9">
                  <SelectValue placeholder="Filter by month" />
                </SelectTrigger>
                <SelectContent>
                  {monthsForFilter.map((month) => (
                    <SelectItem key={month.value} value={String(month.value)}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {isLoading && bills.length > 0 && (
          <div className="flex justify-center py-4">
            <Loader2 className="animate-spin h-6 w-6 text-primary" />
          </div>
        )}

        {paginatedBills.length === 0 && !isLoading ? (
          <Card className="text-center py-12 shadow-sm">
            <CardContent>
              <Banknote className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2 font-headline">
                {billFilterTerm ||
                filterYear !== "all" ||
                filterStatus !== "all"
                  ? "No Bills Match Filter"
                  : "No Bills Yet"}
              </h3>
              <p className="text-muted-foreground">
                {billFilterTerm ||
                filterYear !== "all" ||
                filterStatus !== "all"
                  ? "Try different filter options."
                  : "Generate bills to see them here."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="shadow-md">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[20%]">
                          Tenant / Space
                        </TableHead>
                        <TableHead className="w-[15%] hidden md:table-cell">
                          Dates
                        </TableHead>
                        <TableHead className="w-[25%] text-right">
                          Amount (Birr)
                        </TableHead>
                        <TableHead className="w-[15%] text-center">
                          Status
                        </TableHead>
                        <TableHead className="w-[10%] text-right">
                          Actions
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedBills.map((bill) => (
                        <TableRow
                          key={bill.id}
                          className={`${
                            bill.currentStatus === "Overdue"
                              ? "bg-destructive/5 hover:bg-destructive/10"
                              : ""
                          }`}
                        >
                          <TableCell className="font-medium">
                            <div>{bill.tenantName}</div>
                            <div className="text-xs text-muted-foreground">
                              {bill.agreement?.space?.spaceIdName}
                            </div>
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-sm">
                            <div>
                              Bill:{" "}
                              {format(parseISO(bill.billDate), "dd-MMM-yy")}
                            </div>
                            <div
                              className={`text-xs ${
                                bill.currentStatus === "Overdue"
                                  ? "text-destructive font-semibold"
                                  : "text-muted-foreground"
                              }`}
                            >
                              Due: {format(parseISO(bill.dueDate), "dd-MMM-yy")}
                            </div>
                          </TableCell>
                          <TableCell className="text-right text-xs">
                            <div className="font-semibold text-sm text-foreground">
                              {bill.totalAmount.toFixed(2)} Birr
                            </div>
                            <div className="text-muted-foreground">
                              Rent: {bill.rentAmount.toFixed(2)} Birr
                            </div>
                            <div className="text-muted-foreground">
                              Utility:{" "}
                              {bill.utilityBreakdown
                                .reduce((s, u) => s + u.amount, 0)
                                .toFixed(2)}{" "}
                              Birr
                            </div>
                            {bill.penaltyAmount ? (
                              <div className="text-destructive font-medium">
                                Penalty: {bill.penaltyAmount.toFixed(2)} Birr
                              </div>
                            ) : null}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge
                              variant={getStatusBadgeVariant(
                                bill.currentStatus || bill.status,
                              )}
                              className="capitalize text-xs w-auto justify-center"
                            >
                              {getStatusIcon(bill.currentStatus || bill.status)}
                              <span className="ml-1">
                                {(bill.currentStatus || bill.status).replace(
                                  "PendingVerification",
                                  "Verifying",
                                )}
                              </span>
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {canManagePayments && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() =>
                                      handleOpenPaymentDialog(bill)
                                    }
                                  >
                                    <CreditCard className="h-4 w-4" />
                                    <span className="sr-only">
                                      Record/Verify Payment
                                    </span>
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Record/Verify Payment</p>
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
            <PaginationControls
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              itemsPerPage={itemsPerPage}
              onItemsPerPageChange={handleItemsPerPageChange}
              className="mt-4"
            />
          </>
        )}
      </div>
    </div>
  );
}
