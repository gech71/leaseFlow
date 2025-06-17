
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
  // utilityRate removed as it's now handled by Space.utilityProrationShare and building total
  monthlyRentalPrice: z.number().describe('The monthly rental price of the space.'),
  paymentTermMonths: z.number().int().positive().describe('The total term of the agreement in months.'),
  initialPaymentMonths: z.number().int().positive().describe('The number of months for which rent is paid upfront.'),
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
  Monthly Rental Price: {{{monthlyRentalPrice}}}
  Payment Term: {{{paymentTermMonths}}} months
  Initial Payment: Rent for {{{initialPaymentMonths}}} month(s) paid upfront.

  Utility terms will be based on the building's policies and the space's prorated share, to be detailed separately or as an addendum.

  {{#if additionalTerms}}
  Additional Terms: {{{additionalTerms}}}
  {{/if}}

  The rental agreement should include standard clauses, the payment terms specified, and any provided additional terms.
  Ensure the agreement is legally sound and protects the interests of both the landlord and tenant.
  The agreement should clearly state the monthly rent, the total term, and how many months are paid initially.
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
