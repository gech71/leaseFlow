
import { NextResponse, type NextRequest } from 'next/server';
import { databaseService } from '@/lib/services/databaseService';
import crypto from 'crypto';
import { Prisma } from '@prisma/client';

const NIB_PAYMENT_KEY = process.env.NIB_PAYMENT_KEY;

export async function POST(request: NextRequest) {
    if (!NIB_PAYMENT_KEY) {
        console.error("NIB payment key (NIB_PAYMENT_KEY) is not configured.");
        return NextResponse.json({ success: false, message: "Payment confirmation service is not configured." }, { status: 500 });
    }
    
    let requestBody;
    try {
        requestBody = await request.json();
    } catch (e) {
        console.error("Callback Error: Invalid JSON in request body.", e);
        return NextResponse.json({ success: false, message: "Invalid request format." }, { status: 400 });
    }

    const {
        transactionId,
        companyName,
        accountNo,
        amount,
        transactionTime,
        signature: receivedSignature
    } = requestBody;

    if (!transactionId || !companyName || !accountNo || !amount || !transactionTime || !receivedSignature) {
        console.error("Callback Error: Missing required fields in callback data.", requestBody);
        return NextResponse.json({ success: false, message: "Missing required fields." }, { status: 400 });
    }

    // --- Signature Verification ---
    // The signature string must be reconstructed in the exact same fixed order as payment initiation.
    const signatureString = [
        `accountNo=${accountNo}`,
        `amount=${amount}`,
        `companyName=${companyName}`,
        `Key=${NIB_PAYMENT_KEY}`,
        `transactionId=${transactionId}`,
        `transactionTime=${transactionTime}`
    ].join('&');

    const expectedSignature = crypto.createHash('sha256').update(signatureString).digest('hex');

    if (expectedSignature !== receivedSignature) {
        console.warn(`Callback Signature Mismatch. Received: ${receivedSignature}, Expected: ${expectedSignature}`);
        return NextResponse.json({ success: false, message: "Invalid signature." }, { status: 400 });
    }
    
    // --- Database Update ---
    try {
        // Find the bill that was marked for verification with this transaction ID
        const bill = await databaseService.getAllBills({
            where: {
                status: 'PendingVerification',
                tenantPaymentNotes: {
                    contains: `Transaction ID: ${transactionId}`
                }
            }
        });

        if (!bill || bill.length === 0) {
            console.warn(`Callback Success: Received valid callback for transaction ${transactionId}, but no matching bill was found in 'PendingVerification' state.`);
            // This can happen if the callback is delayed and an admin already verified it.
            // It's still a success from NIB's perspective, so we return 200 OK.
            return NextResponse.json({ success: true, message: "Callback received, no action needed." });
        }
        
        if (bill.length > 1) {
             console.warn(`Callback Warning: Multiple bills found for transaction ID ${transactionId}. Updating the first one.`);
        }

        const billToUpdate = bill[0];
        
        // Update the bill to 'Paid'
        await databaseService.updateBill(billToUpdate.id, {
            status: 'Paid',
            paymentDate: new Date(), // Mark payment as of now
            paymentReference: `NIB-${transactionId}`, // Store NIB's transaction ID as the reference
            adminVerifiedPayment: true, // Auto-verified by callback
            adminVerificationNotes: `Payment confirmed via NIB callback on ${new Date().toISOString()}.`,
        });

        console.log(`Successfully updated bill ${billToUpdate.id} to 'Paid' via NIB callback.`);
        
        // Respond with success
        return NextResponse.json({ success: true, message: "Payment confirmed and updated." });

    } catch (dbError: any) {
        console.error("Callback DB Error: Failed to update bill status after successful validation.", dbError);
        // Even if our DB fails, we must return a 200 OK to NIB to prevent them from retrying.
        // We will need to handle this reconciliation separately (e.g., via logging/monitoring).
        return NextResponse.json({ success: true, message: "Callback acknowledged, internal processing error." });
    }
}
