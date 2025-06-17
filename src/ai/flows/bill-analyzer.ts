// src/ai/flows/bill-analyzer.ts
'use server';
/**
 * @fileOverview AI-powered bill analysis for discrepancy and anomaly detection.
 *
 * - analyzeBill - Analyzes bill generation patterns for anomalies.
 * - AnalyzeBillInput - Input type for analyzeBill.
 * - AnalyzeBillOutput - Output type for analyzeBill.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AnalyzeBillInputSchema = z.object({
  billData: z
    .string()
    .describe(
      'Bill data, including details such as charges, dates, and tenant information.'
    ),\n  agreementDetails: z
    .string()
    .describe('Details of the rental agreement, including rates and terms.'),
  previousBills: z.string().describe('Details from the previous bills.'),
});
export type AnalyzeBillInput = z.infer<typeof AnalyzeBillInputSchema>;

const AnalyzeBillOutputSchema = z.object({
  analysisResult: z
    .string()
    .describe(
      'Analysis of the bill, highlighting any discrepancies, anomalies, or potential issues.'
    ),
  isAnomalous: z
    .boolean()
    .describe('Whether the bill is anomalous based on historical data.'),
  recommendations: z
    .string()
    .describe('Recommendations for addressing any identified issues.'),
});
export type AnalyzeBillOutput = z.infer<typeof AnalyzeBillOutputSchema>;

export async function analyzeBill(input: AnalyzeBillInput): Promise<AnalyzeBillOutput> {
  return analyzeBillFlow(input);
}

const prompt = ai.definePrompt({
  name: 'analyzeBillPrompt',
  input: {schema: AnalyzeBillInputSchema},
  output: {schema: AnalyzeBillOutputSchema},
  prompt: `You are an expert in property management and financial analysis. Your task is to analyze a bill, considering the agreement details and historical billing data, to identify any discrepancies or anomalies. Provide a detailed analysis result and recommendations.

Bill Data: {{{billData}}}
Agreement Details: {{{agreementDetails}}}
Previous Bills: {{{previousBills}}}

Based on this information, determine if the current bill is anomalous compared to the historical data and agreement terms. Provide recommendations for addressing any identified issues.
`,
});

const analyzeBillFlow = ai.defineFlow(
  {
    name: 'analyzeBillFlow',
    inputSchema: AnalyzeBillInputSchema,
    outputSchema: AnalyzeBillOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
