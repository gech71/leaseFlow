
"use client"; // For the client part of the page

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/custom/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, PlusCircle, Eye, Download, Search, AlertTriangle, RefreshCw, Trash2, Loader2 } from 'lucide-react';
import type { Agreement as AgreementPrisma, Tenant, Space } from '@prisma/client';
import { Input } from '@/components/ui/input';
import { addMonths, format, isBefore, startOfDay, subDays, isAfter, parseISO } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { databaseService } from '@/lib/services/databaseService';
import { deleteAgreementAction } from './actions';
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

// Enhanced Agreement type for client-side use, including populated relations
interface AgreementWithRelations extends AgreementPrisma {
  tenant: Tenant | null;
  space: Space | null;
}

interface AgreementsListClientPageProps {
  initialAgreements: AgreementWithRelations[];
}

function AgreementsListClientPage({ initialAgreements }: AgreementsListClientPageProps) {
  const [agreements, setAgreements] = useState<AgreementWithRelations[]>(initialAgreements);
  const [searchTerm, setSearchTerm] = useState('');
  const [isMounted, setIsMounted] = useState(false);
  const [today, setToday] = useState(startOfDay(new Date()));
  const { toast } = useToast();
  const router = useRouter();
  const renewalWindowDays = 30;

  const [agreementToDelete, setAgreementToDelete] = useState<AgreementWithRelations | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    setAgreements(initialAgreements.map(ag => ({
        ...ag,
        createdAt: ag.createdAt ? parseISO(ag.createdAt as unknown as string).toISOString() : new Date().toISOString(),
        startDate: ag.startDate ? parseISO(ag.startDate as unknown as string).toISOString() : new Date().toISOString(),
        nextPaymentDueDate: ag.nextPaymentDueDate ? parseISO(ag.nextPaymentDueDate as unknown as string).toISOString() : new Date().toISOString(),
        initialPaymentDate: ag.initialPaymentDate ? parseISO(ag.initialPaymentDate as unknown as string).toISOString() : undefined,
    })));
    setToday(startOfDay(new Date())); 
  }, [initialAgreements]);
  
  const filteredAgreements = agreements.filter(agreement =>
    agreement.tenant?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    agreement.space?.spaceIdName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    agreement.space?.buildingName.toLowerCase().includes(searchTerm.toLowerCase())
  ).sort((a,b) => parseISO(b.createdAt).getTime() - parseISO(a.createdAt).getTime());

  const isPaymentOverdue = (agreement: AgreementWithRelations): boolean => {
    if (!agreement.nextPaymentDueDate) return false;
    const nextPaymentDate = startOfDay(parseISO(agreement.nextPaymentDueDate));
    const leaseEndDate = addMonths(parseISO(agreement.startDate), agreement.paymentTermMonths);
    return isBefore(nextPaymentDate, today) && isBefore(today, leaseEndDate);
  };
  
  const isEligibleForRenewal = (agreement: AgreementWithRelations): boolean => {
    const agreementStartDate = startOfDay(parseISO(agreement.startDate));
    const agreementEndDate = addMonths(agreementStartDate, agreement.paymentTermMonths);
    if (isBefore(agreementEndDate, today)) return false;
    const renewalEligibilityStartDate = subDays(agreementEndDate, renewalWindowDays);
    return !isBefore(today, renewalEligibilityStartDate) && !isAfter(today, agreementEndDate);
  };

  const handleDownloadPdf = (agreementId: string) => {
    toast({ title: "Download PDF", description: "PDF download functionality is coming soon!" });
  };

  const handleRenewAgreement = (agreement: AgreementWithRelations) => {
    toast({ title: "Renew Agreement", description: `Initiating renewal for ${agreement.tenant?.name}'s agreement. (This is a placeholder action)`});
    // In future, could navigate to generate page with pre-filled data:
    // router.push(`/admin/agreements/generate?renewFrom=${agreement.id}&tenantId=${agreement.tenantId}&spaceId=${agreement.spaceId}`);
  };
  
  const handleDeleteAgreement = async () => {
    if (!agreementToDelete) return;
    setIsDeleting(true);
    const result = await deleteAgreementAction(agreementToDelete.id);
    setIsDeleting(false);
    if (result.success) {
        toast({title: "Agreement Deleted", description: "The agreement has been removed."});
        setAgreements(prev => prev.filter(ag => ag.id !== agreementToDelete.id));
    } else {
        toast({title: "Error Deleting Agreement", description: result.error, variant: "destructive"});
    }
    setAgreementToDelete(null);
  };

  if (!isMounted) {
    return <div className="flex justify-center items-center h-screen"><Loader2 className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"/></div>;
  }

  return (
    <div className="animate-fadeIn">
      <PageHeader
        title="Rental Agreements"
        icon={FileText}
        description="Browse and manage all rental agreements from the database."
        actions={ <Link href="/admin/agreements/generate" passHref> <Button className="bg-primary hover:bg-primary/90 text-primary-foreground"> <PlusCircle className="mr-2 h-5 w-5" /> Create New Agreement </Button> </Link> }
      />
      <AlertDialog open={!!agreementToDelete} onOpenChange={(open) => { if(!open) setAgreementToDelete(null); }}>
        <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle className="flex items-center"><AlertTriangle className="text-destructive mr-2 h-5 w-5"/>Confirm Deletion</AlertDialogTitle>
            <AlertDialogDescription>
                Are you sure you want to delete the agreement for {agreementToDelete?.tenant?.name} at {agreementToDelete?.space?.spaceIdName}? This action cannot be undone. Associated bills might prevent deletion.
            </AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter> <AlertDialogCancel onClick={() => setAgreementToDelete(null)} disabled={isDeleting}>Cancel</AlertDialogCancel> <AlertDialogAction onClick={handleDeleteAgreement} className="bg-destructive hover:bg-destructive/90" disabled={isDeleting}> {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Delete Agreement </AlertDialogAction> </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Card className="mb-6 shadow-sm">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input placeholder="Search by tenant, space, or building..." className="pl-10" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
        </CardContent>
      </Card>
      {filteredAgreements.length === 0 ? (
        <Card className="text-center py-12 shadow-sm">
          <CardContent> <FileText className="mx-auto h-16 w-16 text-muted-foreground mb-4" /> <h3 className="text-xl font-semibold mb-2 font-headline">No Agreements Found</h3> <p className="text-muted-foreground mb-4"> {searchTerm ? "No agreements match your search." : "No agreements have been created yet."} </p> {!searchTerm && (<Link href="/admin/agreements/generate" passHref><Button><PlusCircle className="mr-2 h-5 w-5" /> Create Agreement</Button></Link>)} </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {filteredAgreements.map((agreement) => {
            const overdue = isPaymentOverdue(agreement);
            const eligibleForRenewal = isEligibleForRenewal(agreement);
            const agreementEndDate = addMonths(parseISO(agreement.startDate), agreement.paymentTermMonths);
            const spaceDesc = agreement.space ? `${agreement.space.spaceIdName}, ${agreement.space.buildingName}` : "N/A";
            return (
              <Card key={agreement.id} className={`flex flex-col justify-between shadow-lg hover:shadow-xl transition-shadow duration-300 transform hover:-translate-y-1 ${overdue ? 'border-destructive border-2' : ''}`}>
                <CardHeader>
                  <div className="flex justify-between items-start"> <CardTitle className="font-headline text-lg">{agreement.tenant?.name || "N/A"}</CardTitle>
                    <div className="flex flex-col items-end space-y-1"> {overdue && (<Badge variant="destructive" className="flex items-center"><AlertTriangle className="mr-1 h-3 w-3" /> Payment Overdue</Badge>)} {eligibleForRenewal && (<Badge variant="default" className="bg-accent text-accent-foreground">Renew Soon</Badge>)} </div>
                  </div> <CardDescription>{spaceDesc}</CardDescription>
                </CardHeader>
                <CardContent className="text-sm space-y-1.5">
                  <p><strong>Start Date:</strong> {format(parseISO(agreement.startDate), 'PP')}</p>
                  <p><strong>End Date:</strong> {format(agreementEndDate, 'PP')}</p>
                  <p><strong>Rent:</strong> ${agreement.monthlyRentalPrice.toLocaleString()}/month</p>
                  <p><strong>Term:</strong> {agreement.paymentTermMonths} months</p>
                  <p className={`${overdue ? 'text-destructive font-semibold' : ''}`}> <strong>Next Lease Payment:</strong> {agreement.nextPaymentDueDate ? format(parseISO(agreement.nextPaymentDueDate), 'PP') : 'N/A'} </p>
                  <p className="text-xs text-muted-foreground pt-1">Generated: {format(parseISO(agreement.createdAt), 'PP')}</p>
                </CardContent>
                <CardFooter className="border-t pt-4 flex flex-col sm:flex-row justify-end gap-2">
                    <div className="flex-grow flex gap-2">
                        {eligibleForRenewal && ( <Button size="sm" onClick={() => handleRenewAgreement(agreement)} className="bg-accent hover:bg-accent/90 text-accent-foreground w-full sm:w-auto"> <RefreshCw className="mr-1 h-4 w-4" /> Renew </Button> )}
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                        <Link href={`/admin/agreements/${agreement.id}`} passHref className="w-full sm:w-auto"> <Button variant="outline" size="sm" className="w-full"> <Eye className="mr-1 h-4 w-4" /> View </Button> </Link>
                        <Button variant="outline" size="sm" onClick={() => handleDownloadPdf(agreement.id)} className="w-full sm:w-auto"> <Download className="mr-1 h-4 w-4" /> PDF </Button>
                        <Button variant="destructive" size="sm" onClick={() => setAgreementToDelete(agreement)} className="w-full sm:w-auto"><Trash2 className="mr-1 h-4 w-4"/>Del</Button>
                    </div>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Server Component to fetch initial data
export default function AgreementsListPage() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center h-screen"><Loader2 className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"/></div>}>
      <AgreementsDataFetcher />
    </Suspense>
  );
}

async function AgreementsDataFetcher() {
  const agreementsData = await databaseService.getAllAgreements({
    include: { tenant: true, space: true, bills: { select: { id: true } } }, // Include related data
    orderBy: { createdAt: 'desc' }
  });

  // Serialize Date objects to strings for client component
  const serializableAgreements = agreementsData.map(ag => ({
    ...ag,
    startDate: ag.startDate.toISOString(),
    nextPaymentDueDate: ag.nextPaymentDueDate.toISOString(),
    createdAt: ag.createdAt.toISOString(),
    updatedAt: ag.updatedAt.toISOString(),
    initialPaymentDate: ag.initialPaymentDate?.toISOString() || undefined,
    tenant: ag.tenant ? { ...ag.tenant, createdAt: ag.tenant.createdAt.toISOString(), updatedAt: ag.tenant.updatedAt.toISOString() } : null,
    space: ag.space ? { ...ag.space, createdAt: ag.space.createdAt.toISOString(), updatedAt: ag.space.updatedAt.toISOString() } : null,
    // bills relation is just for count/existence check, no dates to serialize here
  })) as AgreementWithRelations[]; // Cast to ensure type compatibility

  return <AgreementsListClientPage initialAgreements={serializableAgreements} />;
}
