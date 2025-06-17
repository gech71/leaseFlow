
// src/app/actions.ts
"use server";

import { generateAgreement as genAgreementFlow, type AgreementInput, type AgreementOutput } from '@/ai/flows/agreement-generator';
// Bill analyzer related imports removed

export async function generateAgreementAction(input: AgreementInput): Promise<AgreementOutput | { error: string }> {
  try {
    const result = await genAgreementFlow(input);
    if (!result || !result.agreementText) {
        return { error: 'Failed to generate agreement: AI returned no content.' };
    }
    return result;
  } catch (e: any) {
    console.error("Error in generateAgreementAction:", e);
    return { error: e.message || 'An unknown error occurred while generating the agreement.' };
  }
}

// analyzeBillAction removed

