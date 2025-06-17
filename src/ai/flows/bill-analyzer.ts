
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
import {z}from 'genkit';

const AnalyzeBillInputSchema = z.object({
  billData: z
    .string()
    .describe(
      "Bill data, including details such as Rent, a breakdown of Utility Charges (e.g., Electricity: $X, Water: $Y), and Total Amount. Also includes dates and tenant information."
    ),
  agreementDetails: z
    .string()
    .describe('Details of the rental agreement, including rent amount, term, space, and proration share for utilities if applicable.'),
  previousBills: z.string().describe('Details from the previous bills, including rent and detailed utility amounts if available.'),
});
export type AnalyzeBillInput = z.infer<typeof AnalyzeBillInputSchema>;

const AnalyzeBillOutputSchema = z.object({
  analysisResult: z
    .string()
    .describe(
      'Analysis of the bill, highlighting any discrepancies, anomalies, or potential issues regarding rent and individual utility charges.'
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
  prompt: `You are an expert in property management and financial analysis. Your task is to analyze a bill, considering the agreement details and historical billing data, to identify any discrepancies or anomalies in rent or specific utility charges. Provide a detailed analysis result and recommendations.

Bill Data (includes Rent, a breakdown of named Utility Charges, and Total Amount):
{{{billData}}}

Agreement Details (includes rent, terms, space info, and overall utility proration share):
{{{agreementDetails}}}

Previous Bills (includes previous rent and utility breakdown if available):
{{{previousBills}}}

Based on this information, determine if the current bill (rent amount and each utility charge separately, then combined) is anomalous compared to the historical data and agreement terms (especially the agreed rent and how utilities are structured via proration share).
Focus on whether each utility amount in the breakdown seems reasonable given previous bills and the space's proration share (though direct total building costs are not provided to you, look for patterns). Also verify if the rent matches the agreement.
Provide recommendations for addressing any identified issues.
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
