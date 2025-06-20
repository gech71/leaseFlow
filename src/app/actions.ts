
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
    // Log the full error object for better server-side debugging
    console.error("Error in generateAgreementAction. Raw error:", e);
    // Attempt to get a more detailed string representation for logging
    let detailedErrorString;
    try {
      detailedErrorString = JSON.stringify(e, Object.getOwnPropertyNames(e), 2);
    } catch (stringifyError) {
      detailedErrorString = "Could not stringify error object. Error keys: " + Object.keys(e || {}).join(', ');
    }
    console.error("Error in generateAgreementAction. Stringified error:", detailedErrorString);

    let errorMessage = 'An unknown error occurred while generating the agreement.';
    if (e instanceof Error && e.message) {
      errorMessage = e.message;
    } else if (typeof e === 'string' && e) {
      errorMessage = e;
    } else if (e && typeof e.toString === 'function' && e.toString() !== '[object Object]' && e.toString() !== '{}') {
      errorMessage = e.toString();
    } else if (e && e.error && typeof e.error === 'string') { // Check for a nested error string
      errorMessage = e.error;
    } else if (e && e.details && typeof e.details === 'string') { // Check for Genkit-like error details
      errorMessage = e.details;
    } else if (typeof e === 'object' && e !== null) {
      const keys = Object.keys(e);
      if (keys.length > 0) {
        errorMessage = `An error object was caught with keys: ${keys.join(', ')}. Check server logs for details.`;
      }
    }
    
    return { error: errorMessage };
  }
}

// analyzeBillAction removed

