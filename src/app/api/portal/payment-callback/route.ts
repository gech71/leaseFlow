
import { NextResponse, type NextRequest } from 'next/server';
import { databaseService } from '@/lib/services/databaseService';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';
import { Prisma } from '@prisma/client';

const NIB_VALIDATE_TOKEN_URL = process.env.NIB_VALIDATE_TOKEN_URL;

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
    const authHeader = request.headers.get('Authorization');
  

    const tokenMatch = authHeader?.match(/token:\s*(.+)\s*}/);
    const rawToken = tokenMatch?.[1];

    const fixedAuthHeader = rawToken ? `Bearer ${rawToken}` : null;
    
    if (!fixedAuthHeader) {
      console.error('Invalid Authorization header format on callback.');
      return NextResponse.json({ message: "Invalid auth header." }, { status: 401 });
    }


    const isTokenValid = await validateNibToken(fixedAuthHeader);
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

    if (!transactionId) {
        console.error("Callback Error: Missing required fields (transactionId) in callback data.", requestBody);
        return NextResponse.json({ message: "Missing required fields." }, { status: 400 });
    }

    try {
        const bills = await prisma.bill.findMany({
            where: {
                tenantPaymentNotes: {
                    contains: `Group Transaction Ref: ${transactionId}`
                }
            }
        });

        if (bills.length === 0) {
            console.warn(`Callback Success: Received valid callback for transaction ${transactionId}, but no matching bills were found.`);
            return NextResponse.json({ message: "Callback acknowledged, no matching bills found." }, { status: 200 });
        }

        
        await prisma.bill.updateMany({
            where: {
                id: { in: bills.map(b => b.id) }
            },
            data: {
                status: 'Paid',
                paymentDate: new Date(), 
                paymentReference: txnRef,
                adminVerifiedPayment: true, 
                adminVerificationNotes: `Payment confirmed via NIB callback. Paid by: ${paidByNumber}. NIB Group Ref: ${transactionId}.`,
                tenantPaymentNotes: `Paid via NIB Super App. Group Transaction ID: ${transactionId}.`,
            }
        });

        
        return NextResponse.json({ message: "Payment confirmed and all associated bills updated." }, { status: 200 });

    } catch (dbError: any) {
        console.error("Callback DB Error: Failed to process bills after successful validation.", dbError);
        return NextResponse.json({ message: "Callback acknowledged, but an internal processing error occurred." }, { status: 200 });
    }
}
