
"use client";

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/contexts/PermissionContext';
import { Loader2, Save, Info } from 'lucide-react';
import { saveAgreementTemplateAction } from './actions';

interface AgreementTemplateClientPageProps {
  initialTemplate?: string | null;
  error?: string;
}

export function AgreementTemplateClientPage({ initialTemplate, error }: AgreementTemplateClientPageProps) {
  const { toast } = useToast();
  const { isSuperAdmin } = usePermissions();
  const [template, setTemplate] = useState(initialTemplate || '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveTemplate = async () => {
    setIsSaving(true);
    const result = await saveAgreementTemplateAction(template);
    setIsSaving(false);
    if (result.success) {
      toast({ title: "Success", description: "Agreement template has been updated." });
    } else {
      toast({ title: "Error", description: result.error, variant: "destructive" });
    }
  };

  const placeholders = [
    { value: '{{tenantName}}', description: "The full name of the tenant." },
    { value: '{{buildingName}}', description: "The name of the building." },
    { value: '{{spaceIdName}}', description: "The specific ID or name of the rented space (e.g., 'Unit 101')." },
    { value: '{{floor}}', description: "The floor the space is on." },
    { value: '{{area}}', description: "The area of the space in square meters." },
    { value: '{{startDate}}', description: "The start date of the agreement (e.g., 'January 1, 2024')." },
    { value: '{{paymentTermMonths}}', description: "The total length of the lease in months." },
    { value: '{{monthlyRent}}', description: "The monthly rental price (e.g., '5,000.00')." },
    { value: '{{initialPaymentMonths}}', description: "The number of months paid upfront." },
    { value: '{{initialPaymentAmount}}', description: "The total initial payment amount (e.g., '10,000.00')." },
    { value: '{{nextPaymentDueDate}}', description: "The calculated due date for the next regular payment." },
    { value: '{{additionalTerms}}', description: "Any additional terms entered in the form." },
  ];

  if (error) {
    return (
        <Card className="shadow-lg">
            <CardHeader><CardTitle className="text-destructive">Error Loading Template</CardTitle></CardHeader>
            <CardContent><p>{error}</p></CardContent>
        </Card>
    );
  }

  return (
    <div className="grid gap-8 md:grid-cols-3">
      <Card className="shadow-lg md:col-span-2">
        <CardHeader>
          <CardTitle>Template Editor</CardTitle>
          <CardDescription>
            Modify the agreement text below. Use the available placeholders to automatically insert data when generating an agreement.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            placeholder="Enter your rental agreement template text here..."
            className="min-h-[500px] font-mono text-sm"
            disabled={!isSuperAdmin || isSaving}
          />
        </CardContent>
        <CardFooter>
          <Button onClick={handleSaveTemplate} disabled={!isSuperAdmin || isSaving}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Template
          </Button>
        </CardFooter>
      </Card>

      <Card className="shadow-lg h-fit">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Info className="h-5 w-5 text-primary" />Available Placeholders</CardTitle>
          <CardDescription>
            Click to copy a placeholder.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {placeholders.map(p => (
            <div key={p.value} className="p-2 bg-secondary/30 rounded-md">
              <code
                className="font-semibold text-primary cursor-pointer"
                onClick={() => {
                  navigator.clipboard.writeText(p.value);
                  toast({ title: "Copied!", description: `${p.value} copied to clipboard.` });
                }}
              >
                {p.value}
              </code>
              <p className="text-xs text-muted-foreground mt-1">{p.description}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
