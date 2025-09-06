

"use client";

import { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { UploadCloud, File, Download, Loader2, CheckCircle, AlertCircle, ListChecks, FileText, EyeOff } from 'lucide-react';
import * as XLSX from 'xlsx';
import { processImportAction } from './actions';
import { ScrollArea } from '@/components/ui/scroll-area';
import { usePermissions } from '@/contexts/PermissionContext';

interface ImportClientPageProps {
  agreementTemplates: { id: string; name: string }[];
}

interface ImportSummary {
    createdCount: { buildings: number; spaces: number; tenants: number; agreements: number; };
    skippedCount: { buildings: number; spaces: number; tenants: number; agreements: number; };
    errors: string[];
}

export function ImportClientPage({ agreementTemplates }: ImportClientPageProps) {
  const [file, setFile] = useState<File | null>(null);
  const [agreementTemplateId, setAgreementTemplateId] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const { toast } = useToast();
  const { hasPermission, isSuperAdmin } = usePermissions();
  const canManageImport = isSuperAdmin || hasPermission('import:manage');
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
    },
    maxFiles: 1,
  });

  const handleDownloadTemplate = () => {
    const spacesData = [
        ['buildingName', 'spaceIdName', 'floor', 'area', 'monthlyRentalPrice', 'prorationShare'],
        ['Bole Towers', 'Office 101', '1st Floor', 150, 50000, 5],
        ['Kazanchis Grand Mall', 'Shop G-05', 'Ground Floor', 80, 75000, 3.5]
    ];
    const tenantsData = [
        ['name', 'email', 'phone', 'alternativePhone (Optional)', 'nationalId', 'representativeName (Optional)', 'representativePhone (Optional)'],
        ['Abebe Kebede', 'abebe.k@example.com', '0911223344', '0911998877', '123456789012', '', ''],
        ['Selamawit Tadesse', 'selamawit.t@example.com', '0922334455', '', '987654321098', 'Dawit Assefa', '0912121212']
    ];
    const agreementsData = [
        ['tenantEmail', 'buildingName', 'spaceIdName', 'startDate', 'termMonths', 'initialPaymentMonths', 'additionalTerms (Optional)'],
        ['abebe.k@example.com', 'Bole Towers', 'Office 101', '2023-01-15', 12, 1, 'Standard terms apply.'],
        ['selamawit.t@example.com', 'Kazanchis Grand Mall', 'Shop G-05', '2023-02-01', 24, 2, 'Includes marketing fee.']
    ];

    const wb = XLSX.utils.book_new();
    const wsSpaces = XLSX.utils.aoa_to_sheet(spacesData);
    const wsTenants = XLSX.utils.aoa_to_sheet(tenantsData);
    const wsAgreements = XLSX.utils.aoa_to_sheet(agreementsData);

    XLSX.utils.book_append_sheet(wb, wsSpaces, 'Spaces');
    XLSX.utils.book_append_sheet(wb, wsTenants, 'Tenants');
    XLSX.utils.book_append_sheet(wb, wsAgreements, 'Agreements');

    XLSX.writeFile(wb, 'nibrental_Import_Template.xlsx');
  };

  const handleImport = async () => {
    if (!canManageImport) {
        toast({ title: 'Permission Denied', description: 'You do not have permission to import data.', variant: 'destructive' });
        return;
    }
    if (!file) {
      toast({ title: 'No file selected', description: 'Please select an Excel file to import.', variant: 'destructive' });
      return;
    }
    if (!agreementTemplateId) {
        toast({ title: 'No template selected', description: 'Please select an agreement template to use for generating agreements.', variant: 'destructive' });
        return;
    }

    setIsProcessing(true);
    setImportSummary(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });

        const spaces = XLSX.utils.sheet_to_json(workbook.Sheets['Spaces']);
        const tenants = XLSX.utils.sheet_to_json(workbook.Sheets['Tenants']);
        const agreements = XLSX.utils.sheet_to_json(workbook.Sheets['Agreements'], { raw: false, dateNF:'yyyy-mm-dd' });

        const result = await processImportAction({ buildings: [], spaces, tenants, agreements, agreementTemplateId });
        setImportSummary(result);
        
        if (result.success) {
            toast({ title: "Import Successful", description: "Your data has been imported." });
        } else {
             toast({ title: "Import Completed with Errors", description: "Some records could not be imported. See summary for details.", variant: 'destructive' });
        }

      } catch (error: any) {
        setImportSummary({ createdCount: { buildings: 0, spaces: 0, tenants: 0, agreements: 0 }, skippedCount: { buildings: 0, spaces: 0, tenants: 0, agreements: 0 }, errors: ['Failed to read or process the Excel file. Ensure it is not corrupted and matches the template format.'] });
      } finally {
        setIsProcessing(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };
  
  if (!isMounted) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  
  if (!canManageImport) {
     return (
        <Card className="shadow-lg text-center py-12">
            <CardHeader><CardTitle className="text-destructive flex items-center justify-center"><EyeOff className="mr-2"/>Access Denied</CardTitle></CardHeader>
            <CardContent><p>You do not have permission to import data.</p></CardContent>
        </Card>
     );
  }

  if (agreementTemplates.length === 0) {
    return (
       <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-destructive flex items-center gap-2"><AlertCircle /> Prerequisite Missing</CardTitle>
          <CardDescription>
            You must have at least one Agreement Template before you can import data that includes agreements.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p>Please go to Settings &gt; Agreement Templates to create your first template.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid md:grid-cols-2 gap-8">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>1. Download & Prepare</CardTitle>
          <CardDescription>Download the Excel template and fill it with your data.</CardDescription>
        </CardHeader>
        <CardContent className="text-center">
            <Button onClick={handleDownloadTemplate} variant="outline" className="w-full">
                <Download className="mr-2 h-4 w-4" /> Download Template with Examples
            </Button>
            <p className="text-xs text-muted-foreground mt-4">The template has three sheets: Spaces, Tenants, and Agreements. Please ensure buildings exist before importing spaces.</p>
        </CardContent>
        <CardHeader>
            <CardTitle>2. Select Agreement Template</CardTitle>
            <CardDescription>Choose the template to use for generating imported agreements.</CardDescription>
        </CardHeader>
        <CardContent>
            <Label htmlFor="agreementTemplate">Agreement Template</Label>
            <Select onValueChange={setAgreementTemplateId} value={agreementTemplateId}>
                <SelectTrigger id="agreementTemplate">
                    <SelectValue placeholder="Select a template..." />
                </SelectTrigger>
                <SelectContent>
                    {agreementTemplates.map(template => (
                        <SelectItem key={template.id} value={template.id}>{template.name}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </CardContent>
        <CardHeader>
          <CardTitle>3. Upload & Import</CardTitle>
          <CardDescription>Upload your completed Excel file to import the data.</CardDescription>
        </CardHeader>
        <CardContent>
          <div {...getRootProps()} className={`p-8 border-2 border-dashed rounded-lg text-center cursor-pointer transition-colors ${isDragActive ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'}`}>
            <input {...getInputProps()} />
            <UploadCloud className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            {isDragActive ? (
              <p>Drop the file here ...</p>
            ) : (
              <p>Drag & drop your file here, or click to select</p>
            )}
          </div>
          {file && (
            <div className="mt-4 p-3 border rounded-md flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                <span className="text-sm font-medium">{file.name}</span>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setFile(null)}>Remove</Button>
            </div>
          )}
        </CardContent>
        <CardFooter>
          <Button onClick={handleImport} disabled={!file || !agreementTemplateId || isProcessing} className="w-full">
            {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
            {isProcessing ? 'Processing...' : 'Import Data'}
          </Button>
        </CardFooter>
      </Card>
      
      <Card className="shadow-lg">
        <CardHeader>
            <CardTitle>Import Summary</CardTitle>
            <CardDescription>Results of the last import process will appear here.</CardDescription>
        </CardHeader>
        <CardContent>
            {!importSummary && (
                <div className="text-center py-10 text-muted-foreground">
                    <ListChecks className="mx-auto h-12 w-12 mb-4" />
                    <p>Ready to import.</p>
                </div>
            )}
            {importSummary && (
                <div className="space-y-4">
                    {importSummary.errors.length === 0 ? (
                        <Alert variant="default" className="bg-green-50 border-green-200 text-green-800">
                           <CheckCircle className="h-4 w-4 !text-green-800" />
                           <AlertTitle>Import Successful</AlertTitle>
                           <AlertDescription>
                              All records were processed without errors.
                           </AlertDescription>
                        </Alert>
                    ) : (
                         <Alert variant="destructive">
                           <AlertCircle className="h-4 w-4" />
                           <AlertTitle>Import Completed with Errors</AlertTitle>
                         </Alert>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                         <Card className="bg-secondary/50">
                             <CardHeader className="p-3"><CardTitle className="text-sm">Created</CardTitle></CardHeader>
                             <CardContent className="p-3 text-sm space-y-1">
                                <p>Spaces: {importSummary.createdCount.spaces}</p>
                                <p>Tenants: {importSummary.createdCount.tenants}</p>
                                <p>Agreements: {importSummary.createdCount.agreements}</p>
                             </CardContent>
                         </Card>
                         <Card className="bg-secondary/50">
                             <CardHeader className="p-3"><CardTitle className="text-sm">Skipped (Already Exist)</CardTitle></CardHeader>
                             <CardContent className="p-3 text-sm space-y-1">
                                <p>Spaces: {importSummary.skippedCount.spaces}</p>
                                <p>Tenants: {importSummary.skippedCount.tenants}</p>
                                <p>Agreements: {importSummary.skippedCount.agreements}</p>
                             </CardContent>
                         </Card>
                    </div>

                    {importSummary.errors.length > 0 && (
                        <div>
                            <h4 className="font-semibold text-destructive mb-2">Errors:</h4>
                            <ScrollArea className="h-48 w-full rounded-md border p-4 bg-destructive/10">
                                <ul className="space-y-2 text-xs text-destructive">
                                    {importSummary.errors.map((error, index) => (
                                        <li key={index}>- {error}</li>
                                    ))}
                                </ul>
                            </ScrollArea>
                        </div>
                    )}
                </div>
            )}
        </CardContent>
      </Card>
    </div>
  );
}
