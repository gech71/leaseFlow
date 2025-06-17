'use server';

/**
 * @fileOverview Agreement generation flow for LeaseFlow.
 *
 * - generateAgreement - A function that generates a rental agreement.
 * - AgreementInput - The input type for the generateAgreement function.
 * - AgreementOutput - The return type for the generateAgreement function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AgreementInputSchema = z.object({
  tenantName: z.string().describe('The name of the tenant.'),
  building: z.string().describe('The name of the building.'),
  spaceId: z.string().describe('The ID or name of the rented space.'),
  spaceArea: z.number().describe('The area of the rented space in square feet.'),
  floor: z.string().describe('The floor where the space is located.'),
  utilityRate: z
    .number()
    .describe(
      'The utility rate, as a percentage, charged to the tenant (e.g., 1.0 for 100%).'
    ),
  monthlyRentalPrice: z.number().describe('The monthly rental price of the space.'),
  additionalTerms: z.string().optional().describe('Any additional terms to include in the agreement.'),
});
export type AgreementInput = z.infer<typeof AgreementInputSchema>;

const AgreementOutputSchema = z.object({
  agreementText: z.string().describe('The generated rental agreement text.'),
});
export type AgreementOutput = z.infer<typeof AgreementOutputSchema>;

export async function generateAgreement(input: AgreementInput): Promise<AgreementOutput> {
  return agreementGeneratorFlow(input);
}

const agreementPrompt = ai.definePrompt({
  name: 'agreementPrompt',
  input: {schema: AgreementInputSchema},
  output: {schema: AgreementOutputSchema},
  prompt: `You are a legal expert specializing in rental agreements.

  Based on the provided details, generate a comprehensive rental agreement.

  Tenant Name: {{{tenantName}}}
  Building: {{{building}}}
  Space ID: {{{spaceId}}}
  Space Area: {{{spaceArea}}} sq ft
  Floor: {{{floor}}}
  Utility Rate: {{{utilityRate}}}
  Monthly Rental Price: {{{monthlyRentalPrice}}}
  {{#if additionalTerms}}
  Additional Terms: {{{additionalTerms}}}
  {{/if}}

  The rental agreement should include standard clauses and any provided additional terms.
  Ensure the agreement is legally sound and protects the interests of both the landlord and tenant.
  `,
});

const agreementGeneratorFlow = ai.defineFlow(
  {
    name: 'agreementGeneratorFlow',
    inputSchema: AgreementInputSchema,
    outputSchema: AgreementOutputSchema,
  },
  async input => {
    const {output} = await agreementPrompt(input);
    return output!;
  }
);
