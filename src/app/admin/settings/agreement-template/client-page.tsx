

"use client";

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/contexts/PermissionContext';
import { Loader2, Save, Info, PlusCircle, Edit, Trash2, AlertTriangle, EyeOff, Clipboard } from 'lucide-react';
import { upsertAgreementTemplateAction, deleteAgreementTemplateAction } from './actions';
import type { AgreementTemplate } from '@prisma/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
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
import { useRouter } from 'next/navigation';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';

const templateFormSchema = z.object({
    name: z.string().min(3, "Template name must be at least 3 characters."),
    content: z.string().min(50, "Template content must be at least 50 characters."),
});

type TemplateFormValues = z.infer<typeof templateFormSchema>;

interface AgreementTemplateClientPageProps {
  initialTemplates: AgreementTemplate[];
  error?: string;
}

export function AgreementTemplateClientPage({ initialTemplates, error }: AgreementTemplateClientPageProps) {
  const { toast } = useToast();
  const router = useRouter();
  const { isSuperAdmin } = usePermissions();
  const [templates, setTemplates] = useState(initialTemplates);
  const [isSaving, setIsSaving] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'add' | 'edit'>('add');
  const [currentTemplate, setCurrentTemplate] = useState<AgreementTemplate | null>(null);
  const [templateToDelete, setTemplateToDelete] = useState<AgreementTemplate | null>(null);

  const form = useForm<TemplateFormValues>({
    resolver: zodResolver(templateFormSchema),
    defaultValues: { name: "", content: "" },
  });

  const placeholders = [
    { label: 'Tenant Name', value: '{{tenantName}}', description: 'The full name of the tenant.' },
    { label: 'Building Name', value: '{{buildingName}}', description: 'The name of the building.' },
    { label: 'Space ID/Name', value: '{{spaceIdName}}', description: 'The identifier for the rented space (e.g., "Unit 101").' },
    { label: 'Floor', value: '{{floor}}', description: 'The floor where the space is located.' },
    { label: 'Area (sqm)', value: '{{area}}', description: 'The total area of the space in square meters.' },
    { label: 'Start Date', value: '{{startDate}}', description: 'The official start date of the lease agreement.' },
    { label: 'Term (Months)', value: '{{paymentTermMonths}}', description: 'The total duration of the lease in months.' },
    { label: 'Monthly Rent', value: '{{monthlyRent}}', description: 'The amount of rent due each month.' },
    { label: 'Initial Payment (Months)', value: '{{initialPaymentMonths}}', description: 'The number of months paid upfront.' },
    { label: 'Initial Payment Amount', value: '{{initialPaymentAmount}}', description: 'The total upfront payment amount.' },
    { label: 'Next Payment Due', value: '{{nextPaymentDueDate}}', description: 'The date the next lease payment is due.' },
    { label: 'Additional Terms', value: '{{additionalTerms}}', description: 'Any extra clauses or terms added to the agreement.' },
  ];

  const handleOpenAddForm = () => {
    setFormMode('add');
    setCurrentTemplate(null);
    form.reset({ name: "", content: "" });
    setIsFormOpen(true);
  };
  
  const handleOpenEditForm = (template: AgreementTemplate) => {
    setFormMode('edit');
    setCurrentTemplate(template);
    form.reset({ name: template.name, content: template.content });
    setIsFormOpen(true);
  };

  const handleFormSubmit = async (values: TemplateFormValues) => {
    setIsSaving(true);
    const result = await upsertAgreementTemplateAction({
      id: currentTemplate?.id,
      ...values,
    });
    setIsSaving(false);
    if (result.success) {
      toast({ title: "Success", description: `Template "${values.name}" has been saved.` });
      setIsFormOpen(false);
      router.refresh();
    } else {
      toast({ title: "Error", description: result.error, variant: "destructive" });
    }
  };
  
  const handleDeleteTemplate = async () => {
    if (!templateToDelete) return;
    setIsSaving(true);
    const result = await deleteAgreementTemplateAction(templateToDelete.id);
    setIsSaving(false);
    if(result.success) {
        toast({ title: "Deleted", description: `Template "${templateToDelete.name}" has been deleted.` });
        setTemplateToDelete(null);
        router.refresh();
    } else {
        toast({ title: "Error", description: result.error, variant: "destructive" });
    }
  };


  if (error) {
    return (
        <Card className="shadow-lg">
            <CardHeader><CardTitle className="text-destructive">Error Loading Templates</CardTitle></CardHeader>
            <CardContent><p>{error}</p></CardContent>
        </Card>
    );
  }
  
  if (!isSuperAdmin) {
    return (
      <Card className="shadow-lg">
        <CardHeader><CardTitle className="text-destructive flex items-center gap-2"><EyeOff /> Access Denied</CardTitle></CardHeader>
        <CardContent><p>You do not have permission to manage agreement templates.</p></CardContent>
      </Card>
    );
  }

  return (
    <>
    <Card className="shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Manage Agreement Templates</CardTitle>
              <CardDescription>Create, edit, or delete reusable agreement templates.</CardDescription>
            </div>
            <Button onClick={handleOpenAddForm}>
                <PlusCircle className="mr-2 h-4 w-4" /> Add New Template
            </Button>
        </CardHeader>
        <CardContent>
            {templates.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                    <p>No agreement templates found.</p>
                </div>
            ) : (
                 <div className="border rounded-md">
                     <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead className="hidden sm:table-cell">Last Updated</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {templates.map(template => (
                                <TableRow key={template.id}>
                                    <TableCell className="font-medium">{template.name}</TableCell>
                                    <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">{format(new Date(template.updatedAt), 'PPp')}</TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenEditForm(template)}>
                                            <Edit className="h-4 w-4 text-blue-600"/>
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setTemplateToDelete(template)}>
                                            <Trash2 className="h-4 w-4 text-destructive"/>
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                     </Table>
                 </div>
            )}
        </CardContent>
    </Card>

    <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl font-headline">{formMode === 'add' ? 'Add New' : 'Edit'} Agreement Template</DialogTitle>
          <DialogDescription>
            {formMode === 'add' ? 'Create a new reusable template.' : `Editing the "${currentTemplate?.name}" template.`}
          </DialogDescription>
        </DialogHeader>
        <div className="flex-grow grid md:grid-cols-3 gap-6 overflow-hidden">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleFormSubmit)} className="md:col-span-2 flex flex-col space-y-4">
              <div className="flex-grow space-y-4 overflow-y-auto pr-4">
                <FormField control={form.control} name="name" render={({ field }) => ( <FormItem> <FormLabel>Template Name</FormLabel> <FormControl><Input placeholder="e.g., Standard 12-Month Commercial Lease" {...field} /></FormControl> <FormMessage /> </FormItem> )}/>
                <FormField
                  control={form.control}
                  name="content"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Template Content (HTML supported)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Enter your agreement text here. You can use placeholders from the list on the right."
                          className="min-h-[300px] flex-grow resize-y font-mono text-xs"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <DialogFooter className="pt-4 border-t flex-shrink-0">
                <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                <Button type="submit" disabled={isSaving}> {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Save Template </Button>
              </DialogFooter>
            </form>
          </Form>
          <div className="hidden md:block">
            <Card className="h-full flex flex-col">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-md"><Info className="h-5 w-5 text-primary" />Available Placeholders</CardTitle>
                <CardDescription className="text-xs">Click to copy to clipboard.</CardDescription>
              </CardHeader>
              <CardContent className="flex-grow overflow-y-auto">
                  <div className="space-y-2">
                    {placeholders.map(p => (
                      <div key={p.value} className="p-2 bg-secondary/30 rounded-md flex items-center justify-between gap-2">
                          <div>
                            <p className="font-semibold text-sm text-primary">{p.label}</p>
                            <p className="text-xs text-muted-foreground">{p.description}</p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0"
                            onClick={() => {
                              navigator.clipboard.writeText(p.value);
                              toast({ title: "Copied!", description: `Placeholder ${p.value} copied.` });
                            }}
                          >
                            <Clipboard className="h-4 w-4" />
                          </Button>
                      </div>
                    ))}
                  </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    <AlertDialog open={!!templateToDelete} onOpenChange={setTemplateToDelete}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2"><AlertTriangle className="text-destructive"/>Confirm Deletion</AlertDialogTitle>
                <AlertDialogDescription>
                    Are you sure you want to delete the template "{templateToDelete?.name}"? This action cannot be undone.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setTemplateToDelete(null)}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteTemplate} className="bg-destructive hover:bg-destructive/90">
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : 'Delete'}
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
