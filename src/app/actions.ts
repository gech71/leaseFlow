
// src/app/actions.ts
"use server";

import { generateAgreement as genAgreementFlow, type AgreementInput, type AgreementOutput } from '@/ai/flows/agreement-generator';
// Bill analyzer related imports removed

export async function generateAgreementAction(input: AgreementInput): Promise<AgreementOutput | { error: string }> {
  try {
    const result = await genAgreementFlow(input);
    if (!result || !result.agreementText) {
        // This case handles if the flow runs successfully but returns no text.
        return { error: 'Failed to generate agreement: AI returned no content.' };
    }
    return result;
  } catch (e: any) {
    // Log the full error object for better server-side debugging
    console.error("Error in generateAgreementAction. Raw error:", e);
    
    // Attempt to get a more detailed string representation for logging
    let detailedErrorString = "Could not stringify error object.";
    try {
      // Using Object.getOwnPropertyNames can reveal non-enumerable properties if 'e' is an object
      detailedErrorString = JSON.stringify(e, Object.getOwnPropertyNames(e), 2);
    } catch (stringifyError) {
      // Fallback if stringification itself fails
      detailedErrorString = `Could not stringify error object (keys: ${Object.keys(e || {}).join(', ')}). Error during stringification: ${stringifyError}`;
    }
    console.error("Error in generateAgreementAction. Stringified error:", detailedErrorString);

    let errorMessage = 'An unknown error occurred while generating the agreement. Please check server logs for details.';
    
    // Check for GenkitError structure or standard Error properties
    if (e && typeof e.message === 'string' && e.message.trim() !== '') {
      errorMessage = e.message;
      if (e.status) { // GenkitError often includes a status
        errorMessage += ` (Status: ${e.status})`;
      }
    } else if (typeof e === 'string' && e.trim() !== '') {
      errorMessage = e;
    } else if (e && e.error && typeof e.error === 'string' && e.error.trim() !== '') { 
      errorMessage = e.error;
    } else if (e && e.details && typeof e.details === 'string' && e.details.trim() !== '') { // Check for Genkit-like error details
      errorMessage = e.details;
    } else if (e && typeof e.toString === 'function' && e.toString() !== '[object Object]' && e.toString() !== '{}' && e.toString().trim() !== '') {
      errorMessage = e.toString();
    } else if (typeof e === 'object' && e !== null) {
      const keys = Object.keys(e);
      if (keys.length > 0) {
        errorMessage = `An error object was caught. Keys: ${keys.join(', ')}. Please check server logs for details.`;
      } else if (detailedErrorString.length > 50 && detailedErrorString !== "Could not stringify error object.") { 
         errorMessage = `An error occurred: ${detailedErrorString.substring(0, 150)}${detailedErrorString.length > 150 ? '...' : ''}. Check server logs.`;
      } else {
        errorMessage = 'An unexpected error without a specific message occurred in the AI flow. Check server logs.';
      }
    }
    
    return { error: errorMessage };
  }
}

// analyzeBillAction removed

