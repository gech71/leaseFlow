
"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { PageHeader } from '@/components/custom/PageHeader';
import { FileText, Home, FileSignature, DollarSign, CreditCard, AlertTriangle, CheckCircle, Info, UploadCloud, MessageSquare, Loader2, Download } from 'lucide-react';
import type { Agreement, Bill, Building as BuildingType, PenaltyTier, AgreementInput } from '@/lib/types'; 
import { Button } from '@/components/ui/button';
import { format, parseISO, isBefore, startOfDay, differenceInDays } from 'date-fns';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { generateAgreementAction } from '@/app/actions'; 

const initialMockTenantAgreement: Omit<Agreement, 'agreementText'> & { agreementText?: string } = { 
  id: 'agree-tenant1-current',
  tenantId: 'tenant-portal-user',
  tenantName: 'Portal User Tenant',
  spaceId: 'space-portal-unit',
  spaceDescription: 'Unit P1, Portal View Residences',
  startDate: new Date(2024, 0, 15).toISOString(), 
  monthlyRentalPrice: 1500,
  paymentTermMonths: 12,
  initialPaymentMonths: 1,
  nextPaymentDueDate: new Date(new Date().getFullYear(), new Date().getMonth() + 2, 15).toISOString(), 
  additionalTerms: 'No smoking. Small pets allowed with an additional deposit.',
  createdAt: new Date(2024, 0, 10).toISOString(),
};

const mockPortalBuilding: BuildingType = {
  id: 'building-portal',
  name: 'Portal View Residences',
  address: '1 Portal Drive',
  penaltyPolicyTiers: [
    { scope: 'Building', fromDay: 1, toDay: 5, feeType: 'Fixed', feeValue: 25 },
    { scope: 'Building', fromDay: 6, toDay: 10, feeType: 'Fixed', feeValue: 50 },
    { scope: 'SpecificSpaces', applicableSpaceIdNames: ['Unit P1'], fromDay: 11, toDay: null, feeType: 'Percentage', feeValue: 1.5 } 
  ],
  createdAt: new Date().toISOString(),
};


const initialMockTenantBills: Bill[] = [
  {
    id: 'bill-tp-1',
    agreementId: 'agree-tenant1-current',
    tenantId: 'tenant-portal-user',
    spaceDescription: 'Unit P1, Portal View Residences',
    billDate: new Date(new Date().getFullYear(), new Date().getMonth() - 2, 1).toISOString(), 
    dueDate: new Date(new Date().getFullYear(), new Date().getMonth() - 2, 15).toISOString(), 
    rentAmount: 1500,
    utilityBreakdown: [{ name: 'Common Area Maintenance', amount: 75 }],
    totalAmount: 1575, 
    status: 'Paid',
    paymentDate: new Date(new Date().getFullYear(), new Date().getMonth() - 2, 10).toISOString(),
    paymentMethod: 'Online Portal',
    paymentReference: 'PAY-PORTAL-PREV',
  },
  {
    id: 'bill-tp-2', 
    agreementId: 'agree-tenant1-current',
    tenantId: 'tenant-portal-user',
    spaceDescription: 'Unit P1, Portal View Residences',
    billDate: new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toISOString(), 
    dueDate: new Date(new Date().getFullYear(), new Date().getMonth() - 1, 5).toISOString(), 
    rentAmount: 1500,
    utilityBreakdown: [{ name: 'Common Area Maintenance', amount: 75 }, {name: 'Water Service', amount: 30}],
    totalAmount: 1605,
    status: 'Pending', 
  },
  {
    id: 'bill-tp-3',
    agreementId: 'agree-tenant1-current',
    tenantId: 'tenant-portal-user',
    spaceDescription: 'Unit P1, Portal View Residences',
    billDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(), 
    dueDate: new Date(new Date().getFullYear(), new Date().getMonth(), 10).toISOString(), 
    rentAmount: 1500,
    utilityBreakdown: [{ name: 'Common Area Maintenance', amount: 75 }, { name: 'Trash Removal', amount: 25}],
    totalAmount: 1600,
    status: 'Pending',
  },
  {
    id: 'bill-tp-4',
    agreementId: 'agree-tenant1-current',
    tenantId: 'tenant-portal-user',
    spaceDescription: 'Unit P1, Portal View Residences',
    billDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString(), 
    dueDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 15).toISOString(), 
    rentAmount: 1500,
    utilityBreakdown: [{ name: 'Internet Fee', amount: 50 }],
    totalAmount: 1550,
    status: 'Pending',
  },
];


export default function CustomerDashboardPage() {
  const [agreement, setAgreement] = useState<Agreement | null>(null);
  const [bills, setBills] = useState<Bill[]>(initialMockTenantBills);
  const [isMounted, setIsMounted] = useState(false);
  const [isGeneratingAgreement, setIsGeneratingAgreement] = useState(false);
  const [agreementGenerationError, setAgreementGenerationError] = useState<string | null>(null);
  const { toast } = useToast();
  const [today, setToday] = useState(startOfDay(new Date()));

  const [isProofDialogOpen, setIsProofDialogOpen] = useState(false);
  const [billForProof, setBillForProof] = useState<Bill | null>(null);
  const [proofNotes, setProofNotes] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);


  useEffect(() => {
    setIsMounted(true);
    setToday(startOfDay(new Date()));

    const fetchAgreement = async () => {
      setIsGeneratingAgreement(true);
      setAgreementGenerationError(null);
      setAgreement(null); 
      
      const buildingNameFromMock = initialMockTenantAgreement.spaceDescription.split(', ')[1] || 'Unknown Building';
      const spaceIdNameFromMock = initialMockTenantAgreement.spaceDescription.split(', ')[0] || 'Unknown Space';
      const placeholderArea = 1000; 
      const placeholderFloor = "N/A";

      const agreementInput: AgreementInput = {
        tenantName: initialMockTenantAgreement.tenantName,
        building: buildingNameFromMock,
        spaceId: spaceIdNameFromMock,
        spaceArea: placeholderArea,
        floor: placeholderFloor,
        monthlyRentalPrice: initialMockTenantAgreement.monthlyRentalPrice,
        paymentTermMonths: initialMockTenantAgreement.paymentTermMonths,
        initialPaymentMonths: initialMockTenantAgreement.initialPaymentMonths,
        additionalTerms: initialMockTenantAgreement.additionalTerms || "",
      };

      try {
        const result = await generateAgreementAction(agreementInput);

        if ('error' in result) {
          setAgreementGenerationError(result.error);
          toast({ title: "Agreement Generation Failed", description: result.error, variant: "destructive" });
          setAgreement({ ...initialMockTenantAgreement, agreementText: `Error generating agreement text: ${result.error}` });
        } else if (result.agreementText) {
          setAgreement({ ...initialMockTenantAgreement, agreementText: result.agreementText });
        } else {
          const noContentError = "AI returned no content for the agreement.";
          setAgreementGenerationError(noContentError);
          setAgreement({ ...initialMockTenantAgreement, agreementText: `Could not generate agreement text: ${noContentError}` });
        }
      } catch (e: any) {
        const genericError = "An unexpected error occurred while generating the agreement.";
        setAgreementGenerationError(genericError);
        toast({ title: "Agreement Generation Error", description: e.message || genericError, variant: "destructive" });
        setAgreement({ ...initialMockTenantAgreement, agreementText: `Error: ${e.message || genericError}` });
      }
      setIsGeneratingAgreement(false);
    };

    fetchAgreement();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 


  const calculatePenaltyForTenant = useCallback((bill: Bill, currentStatus: Bill['status']): number => {
    if (!mockPortalBuilding.penaltyPolicyTiers || mockPortalBuilding.penaltyPolicyTiers.length === 0) return 0;
    const dueDate = parseISO(bill.dueDate);
    if (currentStatus !== 'Overdue') return 0;

    const daysOverdue = differenceInDays(today, dueDate);
    if (daysOverdue <= 0) return 0;

    let applicableTiersForScope: PenaltyTier[] = [];
    const spaceIdNameFromAgreement = agreement?.spaceDescription.split(',')[0].trim();
    const floorFromAgreement = agreement?.spaceDescription.includes(',') && agreement?.spaceDescription.split(',')[1] ? agreement?.spaceDescription.split(',')[1].trim().split(' ')[0] : undefined;


    const spaceSpecificTiers = mockPortalBuilding.penaltyPolicyTiers.filter(
      t => t.scope === 'SpecificSpaces' && t.applicableSpaceIdNames?.includes(spaceIdNameFromAgreement || '')
    );
    if (spaceSpecificTiers.length > 0) {
      applicableTiersForScope = spaceSpecificTiers;
    } else {
      const floorSpecificTiers = mockPortalBuilding.penaltyPolicyTiers.filter(
        t => t.scope === 'Floor' && floorFromAgreement && t.applicableFloor === floorFromAgreement
      );
      if (floorSpecificTiers.length > 0) {
        applicableTiersForScope = floorSpecificTiers;
      } else {
        applicableTiersForScope = mockPortalBuilding.penaltyPolicyTiers.filter(t => t.scope === 'Building');
      }
    }

    if (applicableTiersForScope.length === 0) return 0;

    const sortedTiers = [...applicableTiersForScope].sort((a, b) => a.fromDay - b.fromDay);
    let calculatedPenalty = 0;

    for (const tier of sortedTiers) {
      if (daysOverdue >= tier.fromDay && (tier.toDay === null || tier.toDay === undefined || daysOverdue <= tier.toDay)) {
        if (tier.feeType === 'Fixed') {
          calculatedPenalty = tier.feeValue;
        } else if (tier.feeType === 'Percentage') {
          calculatedPenalty = bill.rentAmount * (tier.feeValue / 100);
        }
        break;
      }
    }
    return parseFloat(calculatedPenalty.toFixed(2));
  }, [today, agreement]);


  const processedBills = useMemo(() => {
    return bills.map(bill => {
      let currentStatus = bill.status;
      const dueDate = parseISO(bill.dueDate);

      if (bill.status === 'Pending' && isBefore(dueDate, today)) {
        currentStatus = 'Overdue';
      }
      
      const penalty = (currentStatus === 'Overdue' && bill.status !== 'Paid' && bill.status !== 'Pending Verification')
                      ? calculatePenaltyForTenant(bill, currentStatus)
                      : (bill.penaltyAmount || 0);
      
      const baseAmount = bill.rentAmount + bill.utilityBreakdown.reduce((sum, util) => sum + util.amount, 0);
      const newTotalAmount = baseAmount + penalty;

      return {
        ...bill,
        status: currentStatus,
        penaltyAmount: penalty > 0 ? penalty : undefined,
        totalAmount: parseFloat(newTotalAmount.toFixed(2)),
      };
    }).sort((a, b) => parseISO(b.billDate).getTime() - parseISO(a.billDate).getTime());
  }, [bills, today, calculatePenaltyForTenant]);
  
  useEffect(() => {
    if (bills === initialMockTenantBills && processedBills.length > 0) { 
        setBills(processedBills);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processedBills]); 

  const handlePayBill = (billId: string) => {
    const billToPay = bills.find(b => b.id === billId);
    if (!billToPay) return;

    const processedBillToPay = processedBills.find(pb => pb.id === billId);
    const finalAmount = processedBillToPay ? processedBillToPay.totalAmount : billToPay.totalAmount;


    toast({
      title: "Processing Payment...",
      description: `Payment for bill ${billId} (Total: $${finalAmount.toFixed(2)}) is being processed. This is a demo.`,
    });
    setTimeout(() => {
        setBills(prevBills => prevBills.map(b => b.id === billId ? {...b, status: 'Paid', paymentDate: new Date().toISOString(), paymentMethod: "Simulated Portal Payment", penaltyAmount: processedBillToPay?.penaltyAmount } : b));
        toast({
            title: "Payment Successful (Simulated)",
            description: `Bill ${billId} has been marked as paid.`,
        });
    }, 1500);
  };

  const handleOpenProofDialog = (bill: Bill) => {
    const currentProcessedBill = processedBills.find(pb => pb.id === bill.id) || bill;
    setBillForProof(currentProcessedBill);
    setProofNotes('');
    setSelectedFile(null);
    if (fileInputRef.current) {
        fileInputRef.current.value = "";
    }
    setIsProofDialogOpen(true);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setSelectedFile(event.target.files[0]);
    } else {
      setSelectedFile(null);
    }
  };
  
  const handleSubmitProof = () => {
    if (!billForProof) return;
    if (!selectedFile) {
      toast({ title: "No File Selected", description: "Please select a payment proof document.", variant: "destructive"});
      return;
    }

    toast({ title: "Submitting Proof...", description: `Uploading ${selectedFile.name} for bill ${billForProof.id}.`});
    setTimeout(() => {
      setBills(prevBills => 
        prevBills.map(b => 
          b.id === billForProof.id 
          ? { 
              ...b, 
              status: 'Pending Verification', 
              paymentProofUrl: `simulated_proof_${selectedFile.name}`, 
              tenantPaymentNotes: proofNotes,
              penaltyAmount: billForProof.penaltyAmount, 
            } 
          : b
        )
      );
      toast({ title: "Proof Submitted", description: "Your payment proof has been submitted for verification."});
      setIsProofDialogOpen(false);
      setBillForProof(null);
    }, 1500);
  };


  const getStatusBadge = (status: Bill['status']) => {
    switch (status) {
      case 'Paid':
        return <Badge variant="secondary" className="bg-green-100 text-green-700"><CheckCircle className="mr-1 h-3.5 w-3.5" />Paid</Badge>;
      case 'Pending':
        return <Badge variant="default" className="bg-yellow-100 text-yellow-700"><Info className="mr-1 h-3.5 w-3.5" />Pending</Badge>;
      case 'Overdue':
        return <Badge variant="destructive"><AlertTriangle className="mr-1 h-3.5 w-3.5" />Overdue</Badge>;
      case 'Pending Verification':
        return <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-300"><UploadCloud className="mr-1 h-3.5 w-3.5" />Awaiting Verification</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleDownloadAgreement = () => {
    toast({
      title: "Download Agreement",
      description: "PDF download functionality is coming soon!",
    });
  };

  if (!isMounted) {
     return (
        <div className="flex justify-center items-center min-h-[calc(100vh-8rem)]">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
     );
  }
  
  const isAgreementTextValid = agreement?.agreementText && !agreement.agreementText.toLowerCase().startsWith("error") && !agreement.agreementText.toLowerCase().startsWith("could not generate");


  return (
    <div className="animate-fadeIn">
      <PageHeader
        title="Welcome to Your Dashboard!"
        icon={Home}
        description="Overview of your lease agreement and billing information."
      />

      {agreement && (
        <Card className="mb-8 shadow-lg">
          <CardHeader>
            <CardTitle className="font-headline text-xl flex items-center"><FileSignature className="mr-2 h-6 w-6 text-primary" />Lease Details</CardTitle>
            <CardDescription>Your current rental agreement information.</CardDescription>
          </CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-x-6 gap-y-4 text-sm">
            <div><strong className="text-muted-foreground">Property:</strong> {agreement.spaceDescription}</div>
            <div><strong className="text-muted-foreground">Lease Start Date:</strong> {format(parseISO(agreement.startDate), 'PP')}</div>
            <div><strong className="text-muted-foreground">Lease Term:</strong> {agreement.paymentTermMonths} months</div>
            <div><strong className="text-muted-foreground">Monthly Rent:</strong> ${agreement.monthlyRentalPrice.toLocaleString()}</div>
            <div className="md:col-span-2"><strong className="text-muted-foreground">Next Payment Due (Lease):</strong> <span className="font-semibold text-primary">{format(parseISO(agreement.nextPaymentDueDate), 'PP')}</span></div>
            {agreement.additionalTerms && (
                 <div className="md:col-span-2">
                    <strong className="text-muted-foreground">Additional Terms:</strong>
                    <p className="text-xs mt-1 p-2 bg-secondary/50 rounded-md">{agreement.additionalTerms}</p>
                </div>
            )}
          </CardContent>
          <CardFooter>
            {isGeneratingAgreement ? (
              <Button variant="outline" size="sm" disabled>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating Agreement...
              </Button>
            ) : agreementGenerationError || !isAgreementTextValid ? (
              <p className="text-sm text-muted-foreground">No agreement available at this time.</p>
            ) : (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleDownloadAgreement}
              >
                <Download className="mr-2 h-4 w-4" /> Download Agreement (PDF)
              </Button>
            )}
          </CardFooter>
        </Card>
      )}

      <Dialog open={isProofDialogOpen} onOpenChange={(isOpen) => {
        if (!isOpen) setBillForProof(null);
        setIsProofDialogOpen(isOpen);
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-headline text-xl">Submit Payment Proof</DialogTitle>
            <DialogDescription>
              For bill due {billForProof ? format(parseISO(billForProof.dueDate), 'PP') : ''} (Total: ${billForProof?.totalAmount.toFixed(2)})
              {billForProof?.penaltyAmount && billForProof.penaltyAmount > 0 && <span className="text-destructive block text-xs"> (Includes late fee of ${billForProof.penaltyAmount.toFixed(2)})</span>}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="paymentProofFile" className="flex items-center mb-1">
                <UploadCloud className="mr-2 h-4 w-4 text-primary" /> Upload Document (Simulated)
              </Label>
              <Input 
                id="paymentProofFile" 
                type="file" 
                ref={fileInputRef}
                onChange={handleFileSelect} 
                className="text-sm file:mr-2 file:py-1.5 file:px-2 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
              />
              {selectedFile && <p className="text-xs text-muted-foreground mt-1">Selected: {selectedFile.name}</p>}
            </div>
            <div>
              <Label htmlFor="proofNotes" className="flex items-center mb-1">
                <MessageSquare className="mr-2 h-4 w-4 text-primary" /> Notes (Optional)
              </Label>
              <Textarea 
                id="proofNotes"
                value={proofNotes}
                onChange={(e) => setProofNotes(e.target.value)}
                placeholder="e.g., Paid via bank transfer, ref: XYZ123"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter className="pt-4">
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={handleSubmitProof} disabled={!selectedFile} className="bg-primary hover:bg-primary/90 text-primary-foreground">
              Submit Proof
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      <section className="mb-8">
        <h2 className="text-2xl font-headline font-semibold mb-4 flex items-center"><DollarSign className="mr-2 h-7 w-7 text-primary"/>Billing & Payments</h2>
        {processedBills.length === 0 && !agreement && (
            <Card className="text-center py-12 shadow-sm">
            <CardContent>
                <FileSignature className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold mb-2 font-headline">No Information Found</h3>
                <p className="text-muted-foreground">We could not find your active lease or billing information. Please contact support.</p>
            </CardContent>
            </Card>
        )}
        {processedBills.length === 0 && agreement && (
            <Card className="text-center py-10 shadow-sm">
            <CardContent>
                <DollarSign className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
                <h3 className="text-lg font-semibold font-headline">No Bills Generated Yet</h3>
                <p className="text-muted-foreground">There are no outstanding or past bills for your account currently.</p>
            </CardContent>
            </Card>
        )}
        {processedBills.length > 0 && (
          <Card className="shadow-lg">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bill Date</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead className="hidden sm:table-cell text-right">Rent</TableHead>
                    <TableHead className="hidden md:table-cell text-right">Utilities</TableHead>
                    <TableHead className="hidden lg:table-cell text-right">Penalty</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-center px-1 sm:px-2">Status</TableHead>
                    <TableHead className="text-right px-1 sm:px-2">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {processedBills.map(bill => (
                    <TableRow key={bill.id}>
                      <TableCell className="text-xs sm:text-sm">{format(parseISO(bill.billDate), 'PP')}</TableCell>
                      <TableCell className="text-xs sm:text-sm">
                        <span className={bill.status === 'Overdue' ? 'text-destructive font-semibold' : ''}>
                          {format(parseISO(bill.dueDate), 'PP')}
                        </span>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-right text-xs sm:text-sm">${bill.rentAmount.toFixed(2)}</TableCell>
                      <TableCell className="hidden md:table-cell text-right text-xs sm:text-sm">
                        {bill.utilityBreakdown && bill.utilityBreakdown.length > 0 ? (
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="link" className="p-0 h-auto font-normal text-primary hover:underline text-xs sm:text-sm">
                                ${bill.utilityBreakdown.reduce((sum, util) => sum + util.amount, 0).toFixed(2)}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto text-xs p-2">
                              <ul className="space-y-1">
                                {bill.utilityBreakdown.map(util => (
                                  <li key={util.name} className="flex justify-between">
                                    <span>{util.name}:</span>
                                    <span className="font-medium ml-2">${util.amount.toFixed(2)}</span>
                                  </li>
                                ))}
                              </ul>
                            </PopoverContent>
                          </Popover>
                        ) : (
                            '$0.00'
                        )}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-right text-destructive text-xs sm:text-sm">
                        {bill.penaltyAmount ? `$${bill.penaltyAmount.toFixed(2)}` : '$0.00'}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-xs sm:text-sm">${bill.totalAmount.toFixed(2)}</TableCell>
                      <TableCell className="text-center px-1 sm:px-2">{getStatusBadge(bill.status)}</TableCell>
                      <TableCell className="text-right px-1 sm:px-2">
                        <div className="flex flex-col sm:flex-row gap-1 justify-end items-stretch sm:items-center">
                            {(bill.status === 'Pending' || bill.status === 'Overdue') && (
                            <>
                                <Button onClick={() => handlePayBill(bill.id)} size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground w-full sm:w-auto text-xs sm:text-sm">
                                    <CreditCard className="mr-1 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4"/><span className="hidden sm:inline">Pay Now</span><span className="sm:hidden">Pay</span>
                                </Button>
                                <Button onClick={() => handleOpenProofDialog(bill)} variant="outline" size="sm" className="w-full sm:w-auto text-xs sm:text-sm">
                                    <UploadCloud className="mr-1 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4"/><span className="hidden sm:inline">Submit Proof</span><span className="sm:hidden">Proof</span>
                                </Button>
                            </>
                            )}
                            {bill.status === 'Pending Verification' && (
                                <span className="text-xs text-blue-600 whitespace-nowrap">Verification Pending</span>
                            )}
                            {bill.status === 'Paid' && bill.paymentDate && (
                                <div className="text-xs text-muted-foreground whitespace-nowrap text-right sm:text-left">
                                    Paid: {format(parseISO(bill.paymentDate), 'PP')}
                                </div>
                            )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}

