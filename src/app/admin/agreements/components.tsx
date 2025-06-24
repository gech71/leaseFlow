
"use client"; 

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/custom/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, PlusCircle, Eye, Download, Search, AlertTriangle, RefreshCw, Trash2, Loader2, EyeOff } from 'lucide-react';
import type { Agreement as AgreementPrisma, Tenant, Space } from '@prisma/client';
import { Input } from '@/components/ui/input';
import { addMonths, format, isBefore, startOfDay, subDays, isAfter, parseISO } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
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
import { usePermissions } from '@/contexts/PermissionContext';
import { PaginationControls } from '@/components/custom/PaginationControls';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export interface AgreementWithRelations extends AgreementPrisma {
  tenant: Tenant | null;
  space: Space | null;
  createdAt: string;
  startDate: string;
  nextPaymentDueDate: string;
  initialPaymentDate?: string;
}

interface AgreementsListClientPageProps {
  initialAgreements: AgreementWithRelations[];
}

export function AgreementsListClientPage({ initialAgreements }: AgreementsListClientPageProps) {
  const [agreements, setAgreements] = useState<AgreementWithRelations[]>(initialAgreements);
  const [searchTerm, setSearchTerm] = useState('');
  const [isMounted, setIsMounted] = useState(false);
  const [today, setToday] = useState(startOfDay(new Date()));
  const { toast } = useToast();
  const router = useRouter();
  const renewalWindowDays = 30;

  const [agreementToDelete, setAgreementToDelete] = useState<AgreementWithRelations | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(9);

  const { hasPermission, isSuperAdmin } = usePermissions();
  const canCreateAgreements = isSuperAdmin || hasPermission('agreement:create');
  const canEditAgreements = isSuperAdmin || hasPermission('agreement:edit'); // For Renew
  const canDeleteAgreements = isSuperAdmin || hasPermission('agreement:delete');
  const canViewAgreements = isSuperAdmin || hasPermission('agreement:view') || canCreateAgreements || canEditAgreements || canDeleteAgreements;

  const handleItemsPerPageChange = (newSize: number) => {
    setItemsPerPage(newSize);
    setCurrentPage(1);
  };

  useEffect(() => {
    setIsMounted(true);
    setAgreements(initialAgreements.map(ag => ({
        ...ag,
    })));
    setToday(startOfDay(new Date())); 
  }, [initialAgreements]);
  
  const filteredAgreements = agreements.filter(agreement =>
    agreement.tenant?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    agreement.space?.spaceIdName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    agreement.space?.buildingName.toLowerCase().includes(searchTerm.toLowerCase())
  ).sort((a,b) => parseISO(b.createdAt).getTime() - parseISO(a.createdAt).getTime());

  const totalPages = Math.ceil(filteredAgreements.length / itemsPerPage);
  const paginatedAgreements = filteredAgreements.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);
  
  useEffect(() => {
    const newTotalPages = Math.ceil(agreements.length / itemsPerPage);
    if (currentPage > newTotalPages && newTotalPages > 0) {
      setCurrentPage(newTotalPages);
    }
  }, [agreements.length, itemsPerPage, currentPage]);

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

  const handleDownloadTxt = (agreementId: string) => {
    const agreement = agreements.find(a => a.id === agreementId);
    if (!agreement) {
        toast({ title: "Error", description: "Could not find agreement to download.", variant: "destructive" });
        return;
    }

    if (!agreement.agreementText) {
        toast({ title: "Error", description: "Agreement text is empty and cannot be downloaded.", variant: "destructive" });
        return;
    }

    const blob = new Blob([agreement.agreementText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.download = `Agreement-${agreement.tenant?.name}-${agreement.id}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: "Download Started", description: "The agreement text file is downloading." });
  };

  const handleRenewAgreement = (agreement: AgreementWithRelations) => {
    if (!canEditAgreements) { // Assuming renew is an edit-like operation
      toast({ title: "Permission Denied", description: "You do not have permission to renew agreements.", variant: "destructive" });
      return;
    }
    toast({ title: "Renew Agreement", description: `Initiating renewal for ${agreement.tenant?.name}'s agreement. (This is a placeholder action)`});
  };
  
  const handleDeleteAgreement = async () => {
    if (!agreementToDelete) return;
    if (!canDeleteAgreements) {
       toast({ title: "Permission Denied", description: "You do not have permission to delete agreements.", variant: "destructive" });
       return;
    }
    setIsDeleting(true);
    const result = await deleteAgreementAction(agreementToDelete.id);
    setIsDeleting(false);
    if (result.success) {
        toast({title: "Agreement Deleted", description: "The agreement has been removed."});
        setAgreements(prev => prev.filter(ag => ag.id !== agreementToDelete.id)); 
        router.refresh(); 
    } else {
        toast({title: "Error Deleting Agreement", description: result.error, variant: "destructive"});
    }
    setAgreementToDelete(null);
  };

  if (!isMounted) {
    return <div className="flex justify-center items-center h-screen"><Loader2 className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"/></div>;
  }

  if (!canViewAgreements && isMounted) {
    return (
      <Card className="shadow-lg text-center py-12">
        <CardHeader><CardTitle className="text-destructive flex items-center justify-center"><EyeOff className="mr-2"/>Access Denied</CardTitle></CardHeader>
        <CardContent><p>You do not have permission to view agreements.</p></CardContent>
      </Card>
    );
  }

  return (
    <div className="animate-fadeIn">
      <PageHeader
        title="Rental Agreements"
        icon={FileText}
        description="Browse and manage all rental agreements from the database."
        actions={ 
          canCreateAgreements && (
            <Link href="/admin/agreements/generate" passHref> 
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground"> 
                <PlusCircle className="mr-2 h-5 w-5" /> Create New Agreement 
              </Button> 
            </Link>
          )
        }
      />
      <AlertDialog open={!!agreementToDelete} onOpenChange={(open) => { if(!open) setAgreementToDelete(null); }}>
        <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle className="flex items-center"><AlertTriangle className="text-destructive mr-2 h-5 w-5"/>Confirm Deletion</AlertDialogTitle>
            <AlertDialogDescription>
                Are you sure you want to delete the agreement for {agreementToDelete?.tenant?.name} at {agreementToDelete?.space?.spaceIdName}? This action cannot be undone. Associated bills might prevent deletion.
            </AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter> 
              <AlertDialogCancel onClick={() => setAgreementToDelete(null)} disabled={isDeleting}>Cancel</AlertDialogCancel> 
              <AlertDialogAction onClick={handleDeleteAgreement} className="bg-destructive hover:bg-destructive/90" disabled={isDeleting || !canDeleteAgreements}> 
                {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Delete Agreement 
              </AlertDialogAction> 
            </AlertDialogFooter>
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
          <CardContent> 
            <FileText className="mx-auto h-16 w-16 text-muted-foreground mb-4" /> 
            <h3 className="text-xl font-semibold mb-2 font-headline">No Agreements Found</h3> 
            <p className="text-muted-foreground mb-4"> {searchTerm ? "No agreements match your search." : "No agreements have been created yet."} </p> 
            {!searchTerm && canCreateAgreements && (<Link href="/admin/agreements/generate" passHref><Button><PlusCircle className="mr-2 h-5 w-5" /> Create Agreement</Button></Link>)} 
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {paginatedAgreements.map((agreement) => {
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
                    <p><strong>Rent:</strong> {agreement.monthlyRentalPrice.toLocaleString()} Birr/month</p>
                    <p><strong>Term:</strong> {agreement.paymentTermMonths} months</p>
                    <p className={`${overdue ? 'text-destructive font-semibold' : ''}`}> <strong>Next Lease Payment:</strong> {agreement.nextPaymentDueDate ? format(parseISO(agreement.nextPaymentDueDate), 'PP') : 'N/A'} </p>
                    <p className="text-xs text-muted-foreground pt-1">Generated: {format(parseISO(agreement.createdAt), 'PP')}</p>
                  </CardContent>
                  <CardFooter className="border-t pt-4">
                    <div className="flex w-full items-center justify-end gap-1">
                      {canViewAgreements && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Link href={`/admin/agreements/${agreement.id}`} passHref>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <Eye className="h-4 w-4 text-blue-600" />
                                <span className="sr-only">View Agreement</span>
                              </Button>
                            </Link>
                          </TooltipTrigger>
                          <TooltipContent><p>View Agreement</p></TooltipContent>
                        </Tooltip>
                      )}
                      {eligibleForRenewal && canEditAgreements && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleRenewAgreement(agreement)}>
                              <RefreshCw className="h-4 w-4 text-purple-600" />
                              <span className="sr-only">Renew Agreement</span>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent><p>Renew Agreement</p></TooltipContent>
                        </Tooltip>
                      )}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDownloadTxt(agreement.id)}>
                            <Download className="h-4 w-4 text-green-600" />
                            <span className="sr-only">Download Agreement</span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent><p>Download Agreement</p></TooltipContent>
                      </Tooltip>
                      {canDeleteAgreements && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setAgreementToDelete(agreement)}>
                              <Trash2 className="h-4 w-4" />
                              <span className="sr-only">Delete Agreement</span>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent><p>Delete Agreement</p></TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
          <PaginationControls
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            itemsPerPage={itemsPerPage}
            onItemsPerPageChange={handleItemsPerPageChange}
            className="mt-8"
          />
        </>
      )}
    </div>
  );
}
