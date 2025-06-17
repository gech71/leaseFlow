"use client";

import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/custom/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, FileText, User, AlertTriangle, CheckCircle, Loader2, Edit, Trash2, Microscope } from 'lucide-react';
import type { Bill, Agreement, Space } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { analyzeBillAction } from '@/app/actions';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { ScrollArea } from '@/components/ui/scroll-area';

// Mock data (in a real app, fetch from API)
const mockAgreements: Agreement[] = [
  { id: 'agreement1', tenantId: 'tenant1', tenantName: 'Alice Wonderland', spaceId: 'space1', spaceDescription: 'Unit 101, Sunrise Tower', agreementText: '...', startDate: new Date(2023,0,15).toISOString(), monthlyRentalPrice: 2500, utilityRate: 1.0, createdAt: new Date().toISOString() },
  { id: 'agreement2', tenantId: 'tenant2', tenantName: 'Bob The Builder', spaceId: 'space3', spaceDescription: 'Office 5B, Downtown Hub', agreementText: '...', startDate: new Date(2023,2,1).toISOString(), monthlyRentalPrice: 3200, utilityRate: 1.0, createdAt: new Date().toISOString() },
];

const mockSpaces: Space[] = [
 { id: 'space1', buildingName: 'Sunrise Tower', spaceIdName: 'Unit 101', area: 1200, floor: '10th', utilityRate: 1.0, monthlyRentalPrice: 2500, isOccupied: true, tenantId: 'tenant1', createdAt: new Date().toISOString() },
 { id: 'space3', buildingName: 'Downtown Hub', spaceIdName: 'Office 5B', area: 1500, floor: '5th', utilityRate: 1.0, monthlyRentalPrice: 3200, isOccupied: true, tenantId: 'tenant2', createdAt: new Date().toISOString() },
];

const initialBills: Bill[] = [
  { id: 'bill1', agreementId: 'agreement1', tenantId: 'tenant1', tenantName: 'Alice Wonderland', spaceDescription: 'Unit 101, Sunrise Tower', billDate: new Date(2024,5,1).toISOString(), dueDate: new Date(2024,5,15).toISOString(), rentAmount: 2500, utilityAmount: 2500 * 0.05, totalAmount: 2500 * 1.05, status: 'Paid', paymentDate: new Date(2024,5,10).toISOString() },
  { id: 'bill2', agreementId: 'agreement2', tenantId: 'tenant2', tenantName: 'Bob The Builder', spaceDescription: 'Office 5B, Downtown Hub', billDate: new Date(2024,5,1).toISOString(), dueDate: new Date(2024,5,15).toISOString(), rentAmount: 3200, utilityAmount: 3200 * 0.05, totalAmount: 3200 * 1.05, status: 'Pending' },
];

export default function BillingPage() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [selectedBillForAnalysis, setSelectedBillForAnalysis] = useState<Bill | null>(null);
  const [analysisResult, setAnalysisResult] = useState<{ result: string; isAnomalous?: boolean; recommendations?: string } | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setIsMounted(true);
    setBills(initialBills);
  }, []);

  const generateBillForAgreement = (agreementId: string) => {
    const agreement = mockAgreements.find(ag => ag.id === agreementId);
    const space = mockSpaces.find(sp => sp.id === agreement?.spaceId);

    if (!agreement || !space) {
      toast({ title: "Error", description: "Agreement or Space not found.", variant: "destructive" });
      return;
    }

    const rentAmount = agreement.monthlyRentalPrice;
    // Assuming utility rate in agreement is the percentage of rent for utilities.
    // The prompt says utility rate 100% which seems like it means 100% of actual utility cost.
    // For simplicity, let's assume utilityRate in Space is a percentage of rent, e.g. 0.05 for 5% of rent for utilities
    // If utilityRate from space definition means 100% of something, that implies another input for actual utility cost.
    // The problem description says "Utility rate (100%)" for space definition.
    // And "utility payment as per agreement" for bill generation.
    // This is ambiguous. I'll assume a fixed utility charge for now or a % of rent.
    // Let's use a placeholder 5% of rent for utility for demonstration purposes.
    const utilityAmount = rentAmount * (space.utilityRate === 1.0 ? 0.05 : space.utilityRate); // If 100%, then 5% of rent.

    const newBill: Bill = {
      id: `bill-${Date.now()}`,
      agreementId: agreement.id,
      tenantId: agreement.tenantId,
      tenantName: agreement.tenantName,
      spaceDescription: agreement.spaceDescription,
      billDate: new Date().toISOString(),
      dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(), // Due in 15 days
      rentAmount,
      utilityAmount,
      totalAmount: rentAmount + utilityAmount,
      status: 'Pending',
    };
    setBills(prev => [newBill, ...prev]);
    toast({ title: "Bill Generated", description: `New bill for ${agreement.tenantName} created.` });
  };

  const handleAnalyzeBill = async (bill: Bill) => {
    setSelectedBillForAnalysis(bill);
    setIsAnalyzing(true);
    setAnalysisResult(null);
    setAnalysisError(null);

    const agreement = mockAgreements.find(ag => ag.id === bill.agreementId);
    if (!agreement) {
      setAnalysisError("Associated agreement not found for this bill.");
      setIsAnalyzing(false);
      return;
    }

    // For 'previousBills', we'd typically fetch actual previous bills. Here, we'll mock it.
    const previousBillsData = bills
      .filter(b => b.tenantId === bill.tenantId && new Date(b.billDate) < new Date(bill.billDate))
      .slice(0, 3) // Take last 3 previous bills
      .map(b => `Date: ${new Date(b.billDate).toLocaleDateString()}, Total: $${b.totalAmount.toFixed(2)}, Status: ${b.status}`)
      .join('\n');

    const input = {
      billData: `Current Bill for ${bill.tenantName} (${bill.spaceDescription}):\nDate: ${new Date(bill.billDate).toLocaleDateString()}\nDue Date: ${new Date(bill.dueDate).toLocaleDateString()}\nRent: $${bill.rentAmount.toFixed(2)}\nUtilities: $${bill.utilityAmount.toFixed(2)}\nTotal: $${bill.totalAmount.toFixed(2)}\nStatus: ${bill.status}`,
      agreementDetails: `Agreement for ${agreement.tenantName}:\nRent: $${agreement.monthlyRentalPrice.toFixed(2)}\nUtility Rate: ${agreement.utilityRate * 100}%\nStart Date: ${new Date(agreement.startDate).toLocaleDateString()}\n${agreement.additionalTerms ? 'Additional Terms: ' + agreement.additionalTerms : ''}`,
      previousBills: previousBillsData || "No previous bills available for comparison.",
    };

    const result = await analyzeBillAction(input);
    if ('error' in result) {
      setAnalysisError(result.error);
      toast({ title: "Bill Analysis Failed", description: result.error, variant: "destructive" });
    } else {
      setAnalysisResult({ result: result.analysisResult, isAnomalous: result.isAnomalous, recommendations: result.recommendations });
      // Update bill with analysis results (locally for now)
      setBills(prevBills => prevBills.map(b => b.id === bill.id ? {...b, analysisResult: result.analysisResult, isAnomalous: result.isAnomalous, recommendations: result.recommendations } : b));
      toast({ title: "Bill Analysis Complete", description: "Check the analysis details." });
    }
    setIsAnalyzing(false);
  };
  
  const getStatusColor = (status: Bill['status']) => {
    switch (status) {
      case 'Paid': return 'text-green-600 bg-green-100';
      case 'Pending': return 'text-yellow-600 bg-yellow-100';
      case 'Overdue': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };


  if (!isMounted) {
    return <div className="flex justify-center items-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;
  }

  return (
    <div className="animate-fadeIn">
      <PageHeader
        title="Billing Management"
        icon={DollarSign}
        description="Generate and analyze rental and utility bills."
      />

      <Card className="mb-6 shadow-sm">
        <CardHeader>
          <CardTitle className="font-headline">Generate New Bills</CardTitle>
          <CardDescription>Select an active agreement to generate a new bill.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {mockAgreements.map(agreement => (
            <Card key={agreement.id} className="bg-secondary/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">{agreement.tenantName}</CardTitle>
                <CardDescription className="text-xs">{agreement.spaceDescription}</CardDescription>
              </CardHeader>
              <CardFooter>
                <Button size="sm" onClick={() => generateBillForAgreement(agreement.id)} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
                  Generate Bill
                </Button>
              </CardFooter>
            </Card>
          ))}
        </CardContent>
      </Card>
      
      <Dialog open={!!selectedBillForAnalysis && !!analysisResult} onOpenChange={() => {setSelectedBillForAnalysis(null); setAnalysisResult(null)}}>
        <DialogContent className="sm:max-w-lg">
            <DialogHeader>
                <DialogTitle className="font-headline text-xl">Bill Analysis Result</DialogTitle>
                <DialogDescription>
                    AI-powered analysis for bill of {selectedBillForAnalysis?.tenantName} ({selectedBillForAnalysis?.spaceDescription}).
                </DialogDescription>
            </DialogHeader>
            {analysisResult && (
                <ScrollArea className="max-h-[60vh] p-1 pr-3">
                    <div className="space-y-4 text-sm py-4">
                        {analysisResult.isAnomalous && (
                             <div className="p-3 rounded-md bg-red-50 border border-red-200 text-red-700">
                                <div className="flex items-center font-semibold">
                                    <AlertTriangle className="h-5 w-5 mr-2"/> Anomaly Detected!
                                </div>
                            </div>
                        )}
                        {!analysisResult.isAnomalous && (
                             <div className="p-3 rounded-md bg-green-50 border border-green-200 text-green-700">
                                <div className="flex items-center font-semibold">
                                    <CheckCircle className="h-5 w-5 mr-2"/> No Anomalies Detected.
                                </div>
                            </div>
                        )}
                        <div>
                            <h4 className="font-semibold text-foreground mb-1">Analysis Details:</h4>
                            <p className="text-muted-foreground whitespace-pre-wrap">{analysisResult.result}</p>
                        </div>
                         {analysisResult.recommendations && (
                            <div>
                                <h4 className="font-semibold text-foreground mb-1">Recommendations:</h4>
                                <p className="text-muted-foreground whitespace-pre-wrap">{analysisResult.recommendations}</p>
                            </div>
                        )}
                    </div>
                </ScrollArea>
            )}
             {isAnalyzing && (
                <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="ml-2">Analyzing bill...</p>
                </div>
            )}
            {analysisError && (
                 <div className="p-3 rounded-md bg-destructive text-destructive-foreground">
                    <div className="flex items-center font-semibold">
                        <AlertTriangle className="h-5 w-5 mr-2"/> Analysis Error
                    </div>
                    <p className="text-sm">{analysisError}</p>
                </div>
            )}
            <DialogFooter>
                <DialogClose asChild>
                    <Button type="button" variant="outline">Close</Button>
                </DialogClose>
            </DialogFooter>
        </DialogContent>
      </Dialog>


      {bills.length === 0 ? (
        <Card className="text-center py-12 shadow-sm">
          <CardContent>
            <DollarSign className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2 font-headline">No Bills Yet</h3>
            <p className="text-muted-foreground">Generate bills from active agreements to see them here.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
        <h2 className="text-2xl font-headline font-semibold">Generated Bills</h2>
        <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {bills.map((bill) => (
            <Card key={bill.id} className="flex flex-col shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardHeader>
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle className="font-headline text-lg">{bill.tenantName}</CardTitle>
                        <CardDescription className="text-xs">{bill.spaceDescription}</CardDescription>
                    </div>
                    <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${getStatusColor(bill.status)}`}>
                        {bill.status}
                    </span>
                </div>
              </CardHeader>
              <CardContent className="text-sm space-y-2 flex-grow">
                <p><strong>Bill Date:</strong> {new Date(bill.billDate).toLocaleDateString()}</p>
                <p><strong>Due Date:</strong> {new Date(bill.dueDate).toLocaleDateString()}</p>
                <p><strong>Rent:</strong> ${bill.rentAmount.toFixed(2)}</p>
                <p><strong>Utilities:</strong> ${bill.utilityAmount.toFixed(2)}</p>
                <p className="font-semibold text-base text-primary"><strong>Total:</strong> ${bill.totalAmount.toFixed(2)}</p>
                {bill.analysisResult && (
                    <p className={`text-xs italic mt-2 p-2 rounded-md ${bill.isAnomalous ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                        {bill.isAnomalous ? <AlertTriangle className="inline h-4 w-4 mr-1"/> : <CheckCircle className="inline h-4 w-4 mr-1"/>}
                        AI Analysis: {bill.analysisResult.substring(0,50)}...
                    </p>
                )}
              </CardContent>
              <CardFooter className="border-t pt-4 flex justify-between items-center">
                 <Button variant="outline" size="sm" onClick={() => handleAnalyzeBill(bill)} disabled={isAnalyzing && selectedBillForAnalysis?.id === bill.id}>
                  {isAnalyzing && selectedBillForAnalysis?.id === bill.id ? <Loader2 className="mr-1 h-4 w-4 animate-spin"/> : <Microscope className="mr-1 h-4 w-4" />}
                  Analyze
                </Button>
                <div className="flex gap-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8"><Edit className="h-4 w-4"/></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4"/></Button>
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
        </div>
      )}
    </div>
  );
}
