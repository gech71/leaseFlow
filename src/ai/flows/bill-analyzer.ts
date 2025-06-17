
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
      'Bill data, including details such as charges, dates, and tenant information. Includes Rent, Calculated Utility Amount, and Total.'
    ),
  agreementDetails: z
    .string()
    .describe('Details of the rental agreement, including rent amount, term, space, and proration share for utilities if applicable.'),
  previousBills: z.string().describe('Details from the previous bills, including rent and utility amounts.'),
});
export type AnalyzeBillInput = z.infer<typeof AnalyzeBillInputSchema>;

const AnalyzeBillOutputSchema = z.object({
  analysisResult: z
    .string()
    .describe(
      'Analysis of the bill, highlighting any discrepancies, anomalies, or potential issues regarding rent and utility charges.'
    ),
  isAnomalous: z
    .boolean()
    .describe('Whether the bill is anomalous based on historical data and agreement terms.'),
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
  prompt: `You are an expert in property management and financial analysis. Your task is to analyze a bill, considering the agreement details and historical billing data, to identify any discrepancies or anomalies in rent or utility charges. Provide a detailed analysis result and recommendations.

Bill Data:
{{{billData}}}

Agreement Details (includes rent, terms, space info, and utility proration share):
{{{agreementDetails}}}

Previous Bills (includes previous rent and utility amounts):
{{{previousBills}}}

Based on this information, determine if the current bill (rent and utility amounts separately and combined) is anomalous compared to the historical data and agreement terms (especially the agreed rent and how utilities are structured). Provide recommendations for addressing any identified issues.
Focus on whether the utility amount seems reasonable given the previous bills and if the rent matches the agreement.
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
