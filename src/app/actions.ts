
// src/app/actions.ts
"use server";

import { generateAgreement as genAgreementFlow, type AgreementInput, type AgreementOutput } from '@/ai/flows/agreement-generator';
import { analyzeBill as analyzeBillFlow, type AnalyzeBillInput, type AnalyzeBillOutput } from '@/ai/flows/bill-analyzer';

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

export async function analyzeBillAction(input: AnalyzeBillInput): Promise<AnalyzeBillOutput | { error: string }> {
  try {
    const result = await analyzeBillFlow(input);
     if (!result || !result.analysisResult) {
        return { error: 'Failed to analyze bill: AI returned no content.' };
    }
    return result;
  } catch (e: any) {
    console.error("Error in analyzeBillAction:", e);
    return { error: e.message || 'An unknown error occurred while analyzing the bill.' };
  }
}
