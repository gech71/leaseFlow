
import { NextResponse, type NextRequest } from 'next/server';
import { databaseService } from '@/lib/services/databaseService';
import crypto from 'crypto';
import { Prisma } from '@prisma/client';

const NIB_PAYMENT_KEY = process.env.NIB_PAYMENT_KEY;
const NIB_VALIDATE_TOKEN_URL = process.env.NIB_VALIDATE_TOKEN_URL;


// Helper to validate the Authorization token from NIB
async function validateNibToken(authHeader: string | null): Promise<boolean> {
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
    if (!NIB_PAYMENT_KEY) {
        console.error("Callback Error: NIB payment key (NIB_PAYMENT_KEY) is not configured.");
        return NextResponse.json({ message: "Payment confirmation service is not configured." }, { status: 500 });
    }
    
    // --- Token Validation (as per documentation) ---
    const authHeader = request.headers.get('Authorization');
    const isTokenValid = await validateNibToken(authHeader);
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

    // --- Signature Verification ---
    // Reconstruct the signature data from the received payload.
    const signatureData: Record<string, any> = {
        paidAmount,
        paidByNumber,
        txnRef,
        transactionId,
        transactionTime,
        accountNo,
        token,
    };
    
    // Filter out any null or undefined values to avoid "key=undefined" in the string
    const validSignatureData: Record<string, string> = Object.entries(signatureData)
        .filter(([, value]) => value !== null && value !== undefined)
        .reduce((obj, [key, value]) => {
            obj[key] = String(value); // Ensure all values are strings
            return obj;
        }, {} as Record<string, string>);

    // Sort keys alphabetically
    const sortedKeys = Object.keys(validSignatureData).sort();

    // Construct the signature string by joining key-value pairs
    const signatureBaseString = sortedKeys
        .map(key => `${key}=${validSignatureData[key]}`)
        .join('&');
    
    // Append the secret Key at the end
    const finalStringToHash = `${signatureBaseString}&Key=${NIB_PAYMENT_KEY}`;

    const expectedSignature = crypto
        .createHash('sha256')
        .update(finalStringToHash, 'utf8')
        .digest('hex');

    if (expectedSignature !== receivedSignature) {
        console.warn(`Callback Signature Mismatch. Received: ${receivedSignature}, Expected: ${expectedSignature}. String: "${finalStringToHash}"`);
        return NextResponse.json({ message: "Invalid signature." }, { status: 400 });
    }
    
    // --- Database Update ---
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
            // Acknowledge receipt to NIB even if we can't find the bill to prevent retries.
            return NextResponse.json({ message: "Callback acknowledged, no action taken." }, { status: 200 });
        }
        
        // Update the bill to 'Paid'
        await databaseService.updateBill(bill.id, {
            status: 'Paid',
            paymentDate: new Date(), 
            paymentReference: txnRef, // Store NIB's main transaction reference
            adminVerifiedPayment: true, 
            adminVerificationNotes: `Payment confirmed via NIB callback on ${new Date().toISOString()}. Paid by: ${paidByNumber}.`,
            totalAmount: paidAmount ? parseFloat(paidAmount) : bill.totalAmount, // Update amount if provided
        });

        console.log(`Successfully updated bill ${bill.id} to 'Paid' via NIB callback for transaction ${transactionId}.`);
        
        return NextResponse.json({ message: "Payment confirmed and updated." }, { status: 200 });

    } catch (dbError: any) {
        console.error("Callback DB Error: Failed to update bill status after successful validation.", dbError);
        // Important: Still return 200 OK to NIB to prevent them from retrying.
        // We will need to handle this reconciliation separately (e.g., via logging/monitoring).
        return NextResponse.json({ message: "Callback acknowledged, but an internal processing error occurred." }, { status: 200 });
    }
}
