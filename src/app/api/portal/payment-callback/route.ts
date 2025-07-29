
import { NextResponse, type NextRequest } from 'next/server';
import { databaseService } from '@/lib/services/databaseService';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';
import { Prisma } from '@prisma/client';

const NIB_VALIDATE_TOKEN_URL = process.env.NIB_VALIDATE_TOKEN_URL;

// Helper to validate the Authorization token from NIB
async function validateNibToken(authHeader: string | undefined): Promise<boolean> {
    if (!NIB_VALIDATE_TOKEN_URL) {
        console.error("Callback Error: Token validation URL is not configured.");
        return false;
    }
    if (!authHeader) {
        console.error("Callback Error: Authorization header missing from NIB callback.");
        return false;
    }

    try {
        const externalResponse = await fetch(NIB_VALIDATE_TOKEN_URL, {
            method: 'GET',
            headers: { 'Authorization': authHeader, 'Accept': 'application/json' },
            cache: 'no-store',
        });
        return externalResponse.ok;
    } catch (error) {
        console.error("Callback Error: Network error during NIB token validation:", error);
        return false;
    }
}

export async function POST(request: NextRequest) {
    // --- Step 1: Token Validation ---
    const authHeader = request.headers.get('Authorization');
    const tokenFromHeader = authHeader?.substring(7);
    const isTokenValid = await validateNibToken(tokenFromHeader);
    if (!isTokenValid) {
        return NextResponse.json({ message: "Invalid or missing authorization token." }, { status: 401 });
    }

    let requestBody;
    try {
        requestBody = await request.json();
    } catch (e) {
        console.error("Callback Error: Invalid JSON in request body.", e);
        return NextResponse.json({ message: "Invalid request format." }, { status: 400 });
    }

    const {
        paidAmount,
        paidByNumber,
        txnRef,
        transactionId,
        transactionTime,
        accountNo,
        token,
        signature: receivedSignature
    } = requestBody;

    if (!transactionId || !receivedSignature) {
        console.error("Callback Error: Missing required fields (transactionId, signature) in callback data.", requestBody);
        return NextResponse.json({ message: "Missing required fields." }, { status: 400 });
    }

    // --- Step 2 & 3: Find the Bill and Compare Signatures ---
    try {
        const bill = await prisma.bill.findFirst({
            where: {
                tenantPaymentNotes: {
                    contains: `Transaction ID: ${transactionId}`
                }
            }
        });

        if (!bill) {
            console.warn(`Callback Success: Received valid callback for transaction ${transactionId}, but no matching bill was found.`);
            // Acknowledge to NIB that we received it, even if we can't find the bill, to prevent retries.
            return NextResponse.json({ message: "Callback acknowledged, no action taken." }, { status: 200 });
        }

        // The original signature was stored in the `paymentReference` field during initiation.
        const originalSignature = bill.paymentReference;

        if (!originalSignature) {
            console.error(`Callback Error: Bill ${bill.id} is missing the original signature for validation.`);
            // Acknowledge to prevent retries, but log as a critical error.
            return NextResponse.json({ message: "Callback acknowledged, internal error occurred (missing signature)." }, { status: 200 });
        }

        if (originalSignature !== receivedSignature) {
            console.warn(`Callback Signature Mismatch for transaction ${transactionId}. Received: ${receivedSignature}, Expected: ${originalSignature}.`);
            // The signature is invalid, so we reject the callback.
            return NextResponse.json({ message: "Invalid signature." }, { status: 400 });
        }
        
        // --- Step 4: Update Database ---
        // If we reach here, the signature is valid.
        await databaseService.updateBill(bill.id, {
            status: 'Paid',
            paymentDate: new Date(), 
            paymentReference: txnRef, // Overwrite the stored signature with the final NIB transaction reference.
            adminVerifiedPayment: true, 
            adminVerificationNotes: `Payment confirmed via NIB callback. Paid by: ${paidByNumber}. NIB Ref: ${txnRef}.`,
            totalAmount: paidAmount ? parseFloat(paidAmount) : bill.totalAmount,
            // Reset tenant notes to clean up the stored transaction ID.
            tenantPaymentNotes: `Paid via NIB. Original Transaction ID: ${transactionId}.`,
        });

        console.log(`Successfully updated bill ${bill.id} to 'Paid' via NIB callback for transaction ${transactionId}.`);
        
        // --- Step 5: Respond with 200 OK ---
        return NextResponse.json({ message: "Payment confirmed and updated." }, { status: 200 });

    } catch (dbError: any) {
        console.error("Callback DB Error: Failed to process bill after successful validation.", dbError);
        // Important: Still return 200 OK to NIB to prevent them from retrying.
        // We will need to handle this reconciliation separately (e.g., via logging/monitoring).
        return NextResponse.json({ message: "Callback acknowledged, but an internal processing error occurred." }, { status: 200 });
    }
}
