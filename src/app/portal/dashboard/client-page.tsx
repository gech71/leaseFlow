
"use client";

import React, { useState } from 'react';
import type { TenantPortalData, PortalAgreementWithRelations } from './actions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertCircle, CheckCircle, Clock, Info, Home, FileText, Banknote, Calendar, MessageSquare, Upload, Loader2, Paperclip, Eye, EyeOff } from 'lucide-react';
import { format, parseISO, isBefore, startOfDay, addMonths, isAfter } from 'date-fns';
import { usePermissions } from '@/contexts/PermissionContext';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { submitPaymentProofAction, sendContactEmailAction } from './actions';
import { useDropzone } from 'react-dropzone';
import Link from 'next/link';
import { Input } from '@/components/ui/input';

interface TenantDashboardClientPageProps {
  initialData: TenantPortalData;
}

const StatCard = ({ title, value, icon: Icon, description }: { title: string, value: string | number, icon: React.ElementType, description: string }) => (
    <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            <Icon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
            <div className="text-2xl font-bold">{value}</div>
            <p className="text-xs text-muted-foreground">{description}</p>
        </CardContent>
    </Card>
);

export function TenantDashboardClientPage({ initialData }: TenantDashboardClientPageProps) {
  const { currentUser } = usePermissions();
  const router = useRouter();
  const { toast } = useToast();

  const [agreements, setAgreements] = useState(initialData.agreements || []);
  const [error, setError] = useState(initialData.error || null);

  const [isProofDialogOpen, setIsProofDialogOpen] = useState(false);
  const [isContactDialogOpen, setIsContactDialogOpen] = useState(false);
  const [selectedBillForProof, setSelectedBillForProof] = useState<any | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [paymentNotes, setPaymentNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [contactSubject, setContactSubject] = useState('');
  const [contactBody, setContactBody] = useState('');

  const onDrop = (acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      if (acceptedFiles[0].size > 2 * 1024 * 1024) { // 2MB limit
        toast({
          title: "File too large",
          description: "Please upload a PDF file smaller than 2MB.",
          variant: "destructive"
        });
        return;
      }
      setProofFile(acceptedFiles[0]);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
  });

  const handleSubmitProof = async () => {
    if (!selectedBillForProof || !proofFile) return;

    setIsSubmitting(true);
    
    const reader = new FileReader();
    reader.readAsDataURL(proofFile);
    reader.onload = async () => {
        const base64DataUri = reader.result as string;

        const result = await submitPaymentProofAction({
            billId: selectedBillForProof.id,
            paymentProofDataUri: base64DataUri,
            notes: paymentNotes
        });

        setIsSubmitting(false);

        if (result.success) {
            toast({ title: "Success", description: "Your payment proof has been submitted for verification." });
            setIsProofDialogOpen(false);
            setProofFile(null);
            setPaymentNotes('');
            router.refresh();
        } else {
            toast({ title: "Submission Failed", description: result.error, variant: "destructive" });
        }
    };
    reader.onerror = (error) => {
        console.error("Error reading file:", error);
        toast({ title: "Error", description: "Could not process the uploaded file.", variant: "destructive"});
        setIsSubmitting(false);
    };
  };
  
  const handleSubmitContact = async () => {
    if (!contactSubject || !contactBody) {
      toast({ title: "Missing Information", description: "Please provide both a subject and a message.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    const result = await sendContactEmailAction({ subject: contactSubject, body: contactBody });
    setIsSubmitting(false);
    if(result.success) {
        toast({ title: "Message Sent", description: "Your message has been sent to the property manager."});
        setIsContactDialogOpen(false);
        setContactSubject('');
        setContactBody('');
    } else {
        toast({ title: "Error", description: result.error, variant: "destructive"});
    }
  }


  if (error) {
    return (
      <Card className="w-full text-center py-10 border-destructive">
        <CardHeader>
          <AlertCircle className="mx-auto h-12 w-12 text-destructive" />
          <CardTitle className="mt-4">An Error Occurred</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-destructive-foreground">{error}</p>
        </CardContent>
      </Card>
    );
  }

  const allBills = agreements.flatMap(ag => ag.bills.map(b => ({ ...b, agreement: ag })));
  const pendingBills = allBills.filter(b => b.status === 'Pending' && !isBefore(parseISO(b.dueDate), startOfDay(new Date())));
  const overdueBills = allBills.filter(b => b.status === 'Overdue' || (b.status === 'Pending' && isBefore(parseISO(b.dueDate), startOfDay(new Date()))));
  const totalDue = [...pendingBills, ...overdueBills].reduce((sum, bill) => sum + Number(bill.totalAmount), 0);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Paid': return <Badge variant="secondary"><CheckCircle className="mr-1 h-3 w-3 text-green-600"/>Paid</Badge>;
      case 'Pending': return <Badge variant="default"><Clock className="mr-1 h-3 w-3"/>Pending</Badge>;
      case 'Overdue': return <Badge variant="destructive"><AlertCircle className="mr-1 h-3 w-3"/>Overdue</Badge>;
      case 'PendingVerification': return <Badge variant="outline" className="text-blue-600 border-blue-600"><Loader2 className="mr-1 h-3 w-3 animate-spin"/>Verifying</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-8">
      
      {agreements.length === 0 && !error && (
         <Card className="text-center py-10 shadow-sm">
          <CardContent>
            <Info className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
            <h3 className="text-lg font-semibold font-headline">No Active Agreements</h3>
            <p className="text-muted-foreground">There are no active agreements to display for your account.</p>
          </CardContent>
        </Card>
      )}

      {agreements.map(agreement => (
          <Card key={agreement.id} className="shadow-lg">
            <CardHeader>
              <CardTitle className="font-headline text-xl flex items-center gap-3">
                <Home className="text-primary"/>
                Agreement for {agreement.space.spaceIdName}
              </CardTitle>
              <CardDescription>
                Building: {agreement.space.building.name} | 
                Start Date: {format(parseISO(agreement.startDate), 'PP')} | 
                Term: {agreement.paymentTermMonths} months
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 mb-6">
                <StatCard title="Total Due" value={`${totalDue.toLocaleString()} Birr`} icon={Banknote} description="Pending and overdue bills" />
                <StatCard title="Overdue Bills" value={overdueBills.length} icon={AlertCircle} description="Require immediate attention" />
                <StatCard title="Upcoming Bills" value={pendingBills.length} icon={Clock} description="Not yet overdue" />
                <StatCard title="Total Agreements" value={agreements.length} icon={FileText} description="Active agreements" />
              </div>
              
              <h3 className="font-semibold mb-2">Billing History</h3>
              {agreement.bills.length > 0 ? (
                <div className="border rounded-lg overflow-hidden">
                    <Table>
                    <TableHeader>
                        <TableRow>
                        <TableHead>Bill Period</TableHead>
                        <TableHead className="hidden sm:table-cell">Due Date</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                        <TableHead className="text-right">Amount (Birr)</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {agreement.bills.map(bill => {
                           const utilityTotal = bill.utilityBreakdown?.reduce((sum, item) => sum + item.amount, 0) || 0;
                           return (
                            <TableRow key={bill.id}>
                                <TableCell className="font-medium">{format(parseISO(bill.billDate), 'MMMM yyyy')}</TableCell>
                                <TableCell className="hidden sm:table-cell">{format(parseISO(bill.dueDate), 'PP')}</TableCell>
                                <TableCell className="text-center">{getStatusBadge(bill.status)}</TableCell>
                                <TableCell className="text-right text-xs">
                                  <div className="font-semibold text-sm text-foreground">{Number(bill.totalAmount).toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                                  <div className="text-muted-foreground">Rent: {Number(bill.rentAmount).toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                                  {utilityTotal > 0 && <div className="text-muted-foreground">Utility: {utilityTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>}
                                  {bill.penaltyAmount && bill.penaltyAmount > 0 && <div className="text-destructive font-medium">Penalty: {Number(bill.penaltyAmount).toLocaleString(undefined, {minimumFractionDigits: 2})}</div>}
                                </TableCell>
                                <TableCell className="text-right">
                                    {(bill.status === 'Pending' || bill.status === 'Overdue') && (
                                        <Button size="sm" variant="outline" onClick={() => { setSelectedBillForProof(bill); setIsProofDialogOpen(true); }}>
                                        <Upload className="mr-2 h-4 w-4"/> Submit Proof
                                        </Button>
                                    )}
                                </TableCell>
                            </TableRow>
                           )
                        })}
                    </TableBody>
                    </Table>
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">No bills have been generated for this agreement yet.</p>
              )}
            </CardContent>
            <CardFooter>
                 <Button variant="secondary" onClick={() => setIsContactDialogOpen(true)}>
                    <MessageSquare className="mr-2 h-4 w-4"/> Contact Manager
                 </Button>
            </CardFooter>
          </Card>
      ))}

      {/* Submit Proof Dialog */}
      <Dialog open={isProofDialogOpen} onOpenChange={setIsProofDialogOpen}>
          <DialogContent>
              <DialogHeader>
                  <DialogTitle>Submit Payment Proof</DialogTitle>
                  <DialogDescription>
                      Upload a PDF of your payment receipt for bill from {selectedBillForProof && format(parseISO(selectedBillForProof.billDate), 'MMMM yyyy')}.
                  </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                  <div {...getRootProps()} className={`p-6 border-2 border-dashed rounded-lg cursor-pointer text-center ${isDragActive ? 'border-primary bg-primary/10' : 'border-border'}`}>
                      <input {...getInputProps()} />
                      <Upload className="mx-auto h-10 w-10 text-muted-foreground mb-2"/>
                      {proofFile ? (
                          <p className="text-sm font-medium">{proofFile.name}</p>
                      ) : (
                          <p className="text-sm text-muted-foreground">{isDragActive ? 'Drop the file here' : 'Drag & drop a PDF file here, or click to select'}</p>
                      )}
                  </div>
                  <Textarea placeholder="Add any notes for the administrator (optional)..." value={paymentNotes} onChange={(e) => setPaymentNotes(e.target.value)} />
              </div>
              <DialogFooter>
                  <DialogClose asChild><Button variant="outline" disabled={isSubmitting}>Cancel</Button></DialogClose>
                  <Button onClick={handleSubmitProof} disabled={!proofFile || isSubmitting}>
                      {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Submit for Verification
                  </Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>
      
      {/* Contact Manager Dialog */}
      <Dialog open={isContactDialogOpen} onOpenChange={setIsContactDialogOpen}>
          <DialogContent>
              <DialogHeader>
                  <DialogTitle>Contact Property Manager</DialogTitle>
                  <DialogDescription>
                      Send a message directly to your building manager.
                  </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                  <Input placeholder="Subject" value={contactSubject} onChange={e => setContactSubject(e.target.value)} disabled={isSubmitting}/>
                  <Textarea placeholder="Your message..." rows={6} value={contactBody} onChange={e => setContactBody(e.target.value)} disabled={isSubmitting}/>
              </div>
              <DialogFooter>
                  <DialogClose asChild><Button variant="outline" disabled={isSubmitting}>Cancel</Button></DialogClose>
                  <Button onClick={handleSubmitContact} disabled={isSubmitting || !contactSubject || !contactBody}>
                      {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Send Message
                  </Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>
    </div>
  );
}
