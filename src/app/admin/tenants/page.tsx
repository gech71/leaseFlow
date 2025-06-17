"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/custom/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, PlusCircle, FileText, Mail, Phone, BedDouble, Trash2, Edit3 } from 'lucide-react';
import type { Tenant, Space } from '@/lib/types'; // Assuming Space might be needed for context
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';

// Mock data for spaces - needed to show what space a tenant occupies
const mockSpaces: Space[] = [
  { id: 'space1', buildingName: 'Sunrise Tower', spaceIdName: 'Unit 101', area: 1200, floor: '10th', utilityRate: 1.0, monthlyRentalPrice: 2500, isOccupied: true, tenantId: 'tenant1', createdAt: new Date().toISOString() },
  { id: 'space3', buildingName: 'Downtown Hub', spaceIdName: 'Office 5B', area: 1500, floor: '5th', utilityRate: 1.0, monthlyRentalPrice: 3200, isOccupied: true, tenantId: 'tenant2', createdAt: new Date().toISOString() },
  { id: 'space2', buildingName: 'Ocean View Plaza', spaceIdName: 'Suite 20A', area: 800, floor: '2nd', utilityRate: 1.0, monthlyRentalPrice: 1800, isOccupied: false, createdAt: new Date().toISOString() },
];


const initialTenants: Tenant[] = [
  { id: 'tenant1', name: 'Alice Wonderland', email: 'alice@example.com', rentedSpaceId: 'space1', createdAt: new Date().toISOString() },
  { id: 'tenant2', name: 'Bob The Builder', email: 'bob@example.com', rentedSpaceId: 'space3', createdAt: new Date().toISOString() },
  { id: 'tenant3', name: 'Charlie Brown', email: 'charlie@example.com', rentedSpaceId: null, createdAt: new Date().toISOString() }, // Prospective tenant
];


export default function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [isMounted, setIsMounted] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setIsMounted(true);
    // In a real app, fetch tenants
    setTenants(initialTenants);
  }, []);

  const getSpaceDetails = (spaceId: string | null) => {
    if (!spaceId) return "No space assigned";
    const space = mockSpaces.find(s => s.id === spaceId);
    return space ? `${space.spaceIdName}, ${space.buildingName}` : "Unknown Space";
  };
  
  const handleDeleteTenant = (tenantId: string) => {
    // Add logic to check for active leases before deleting
    setTenants(prev => prev.filter(t => t.id !== tenantId));
    toast({ title: "Tenant Removed", description: "Tenant data has been removed.", variant: "destructive" });
  };


  if (!isMounted) {
     return <div className="flex justify-center items-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;
  }

  return (
    <div className="animate-fadeIn">
      <PageHeader
        title="Manage Tenants"
        icon={Users}
        description="View tenant information and manage lease agreements."
        actions={
          <Link href="/admin/agreements/generate" passHref>
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
              <PlusCircle className="mr-2 h-5 w-5" /> Add Tenant & Agreement
            </Button>
          </Link>
        }
      />

      {tenants.length === 0 ? (
         <Card className="text-center py-12 shadow-sm">
          <CardContent>
            <Users className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2 font-headline">No Tenants Yet</h3>
            <p className="text-muted-foreground mb-4">Add tenants and generate agreements to get started.</p>
             <Link href="/admin/agreements/generate" passHref>
                <Button>
                  <PlusCircle className="mr-2 h-5 w-5" /> Add Tenant & Agreement
                </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {tenants.map((tenant) => (
            <Card key={tenant.id} className="flex flex-col justify-between shadow-lg hover:shadow-xl transition-shadow duration-300 transform hover:-translate-y-1">
              <CardHeader>
                <div className="flex items-center gap-4">
                  <Image src={`https://placehold.co/60x60.png?text=${tenant.name.charAt(0)}`} alt={tenant.name} width={60} height={60} className="rounded-full" data-ai-hint="person avatar"/>
                  <div>
                    <CardTitle className="font-headline text-xl">{tenant.name}</CardTitle>
                    <CardDescription className="text-sm flex items-center"><Mail className="mr-1.5 h-3.5 w-3.5 text-muted-foreground"/>{tenant.email}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center">
                  <BedDouble className="mr-2 h-4 w-4 text-primary" /> 
                  Rented Space: {getSpaceDetails(tenant.rentedSpaceId)}
                </div>
                {/* Add more tenant details here if available e.g. phone */}
                <div className="flex items-center text-muted-foreground">
                  <Phone className="mr-2 h-4 w-4 text-primary" /> Phone: (555) 123-4567 {/* Mock phone */}
                </div>
              </CardContent>
              <CardFooter className="border-t pt-4 flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => toast({title: "Edit Tenant", description: "Edit functionality coming soon!"})}>
                  <Edit3 className="mr-1 h-4 w-4" /> Edit
                </Button>
                 <Button variant="outline" size="sm" onClick={() => toast({title: "View Agreement", description: "Agreement viewing coming soon!"})}>
                  <FileText className="mr-1 h-4 w-4" /> Agreement
                </Button>
                {/* Add AlertDialog for delete confirmation if needed */}
                {/* <Button variant="destructive" size="sm" onClick={() => handleDeleteTenant(tenant.id)}>
                  <Trash2 className="mr-1 h-4 w-4" /> Delete
                </Button> */}
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
