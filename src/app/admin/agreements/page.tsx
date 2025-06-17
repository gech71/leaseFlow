"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/custom/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, PlusCircle, Eye, Download, Search } from 'lucide-react';
import type { Agreement } from '@/lib/types';
import { Input } from '@/components/ui/input';

// Mock data for agreements
const initialAgreements: Agreement[] = [
  {
    id: 'agreement1',
    tenantId: 'tenant1',
    tenantName: 'Alice Wonderland',
    spaceId: 'space1',
    spaceDescription: 'Unit 101, Sunrise Tower',
    agreementText: 'This is a sample agreement text for Alice Wonderland...',
    startDate: new Date(2023, 0, 15).toISOString(),
    monthlyRentalPrice: 2500,
    utilityRate: 1.0,
    createdAt: new Date(2023,0,10).toISOString(),
  },
  {
    id: 'agreement2',
    tenantId: 'tenant2',
    tenantName: 'Bob The Builder',
    spaceId: 'space3',
    spaceDescription: 'Office 5B, Downtown Hub',
    agreementText: 'This is another sample agreement text for Bob The Builder...',
    startDate: new Date(2023, 2, 1).toISOString(),
    monthlyRentalPrice: 3200,
    utilityRate: 1.0,
    createdAt: new Date(2023,2,1).toISOString(),
  },
];

export default function AgreementsListPage() {
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    // In a real app, fetch agreements
    setAgreements(initialAgreements);
  }, []);
  
  const filteredAgreements = agreements.filter(agreement =>
    agreement.tenantName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    agreement.spaceDescription.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isMounted) {
    return <div className="flex justify-center items-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;
  }

  return (
    <div className="animate-fadeIn">
      <PageHeader
        title="Rental Agreements"
        icon={FileText}
        description="Browse and manage all generated rental agreements."
        actions={
          <Link href="/admin/agreements/generate" passHref>
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
              <PlusCircle className="mr-2 h-5 w-5" /> Create New Agreement
            </Button>
          </Link>
        }
      />

      <Card className="mb-6 shadow-sm">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input 
              placeholder="Search by tenant or space..." 
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {filteredAgreements.length === 0 ? (
        <Card className="text-center py-12 shadow-sm">
          <CardContent>
            <FileText className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2 font-headline">No Agreements Found</h3>
            <p className="text-muted-foreground mb-4">
              {searchTerm ? "No agreements match your search." : "No agreements have been generated yet."}
            </p>
            {!searchTerm && (
                <Link href="/admin/agreements/generate" passHref>
                    <Button>
                    <PlusCircle className="mr-2 h-5 w-5" /> Create Agreement
                    </Button>
                </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {filteredAgreements.map((agreement) => (
            <Card key={agreement.id} className="flex flex-col justify-between shadow-lg hover:shadow-xl transition-shadow duration-300 transform hover:-translate-y-1">
              <CardHeader>
                <CardTitle className="font-headline text-lg">Agreement for {agreement.tenantName}</CardTitle>
                <CardDescription>{agreement.spaceDescription}</CardDescription>
              </CardHeader>
              <CardContent className="text-sm space-y-1">
                <p><strong>Start Date:</strong> {new Date(agreement.startDate).toLocaleDateString()}</p>
                <p><strong>Rent:</strong> ${agreement.monthlyRentalPrice.toLocaleString()}/month</p>
                <p><strong>Utility Rate:</strong> {(agreement.utilityRate * 100).toFixed(0)}%</p>
                <p className="text-xs text-muted-foreground">Generated: {new Date(agreement.createdAt).toLocaleDateString()}</p>
              </CardContent>
              <CardFooter className="border-t pt-4 flex justify-end gap-2">
                <Button variant="outline" size="sm">
                  <Eye className="mr-1 h-4 w-4" /> View
                </Button>
                <Button variant="outline" size="sm">
                  <Download className="mr-1 h-4 w-4" /> Download PDF
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
