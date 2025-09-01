
import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { databaseService } from '@/lib/services/databaseService';

// --- Normalization Helper ---
const toCamelCase = (s: string) => {
  if (typeof s !== 'string' || s.length === 0) {
    return s;
  }
  // This handles PascalCase, camelCase, snake_case, and kebab-case
  const camel = s.replace(/([-_][a-z])/ig, ($1) => {
    return $1.toUpperCase()
      .replace('-', '')
      .replace('_', '');
  });
  return camel.charAt(0).toLowerCase() + camel.slice(1);
};

const isObject = function (o: any) {
  return o === Object(o) && !Array.isArray(o) && typeof o !== 'function';
};

const normalizeKeys = (obj: any): any => {
  if (isObject(obj)) {
    const n: { [key: string]: any } = {};
    Object.keys(obj)
      .forEach((k) => {
        n[toCamelCase(k)] = normalizeKeys(obj[k]);
      });
    return n;
  } else if (Array.isArray(obj)) {
    return obj.map((i) => {
      return normalizeKeys(i);
    });
  }
  return obj;
};
// --- End Normalization Helper ---


// This is a simplified handler. Production environments might add more checks.
export async function POST(request: NextRequest) {
  const ARIFPAY_API_KEY = process.env.ARIFPAY_API_KEY;
  const NOTIFY_TOKEN = process.env.ARIFPAY_NOTIFY_TOKEN; // Your custom verification token

  // 1. Verify the API key from ArifPay
  const apiKey = request.headers.get('x-arifpay-key');
  if (apiKey !== ARIFPAY_API_KEY) {
    console.warn("ArifPay Callback: Received request with invalid API key.");
    return NextResponse.json({ message: "Unauthorized: Invalid API key." }, { status: 401 });
  }

  // 2. Verify a custom token for an extra layer of security
  const notifyToken = request.headers.get('x-notify-token');
  if (notifyToken !== NOTIFY_TOKEN) {
    console.warn("ArifPay Callback: Received request with invalid notification token.");
    return NextResponse.json({ message: "Unauthorized: Invalid token." }, { status: 401 });
  }

  try {
    const rawPayload = await request.json();
    const payload = normalizeKeys(rawPayload); // Normalize the incoming payload
    console.log("Received and normalized ArifPay callback payload:", payload);

    const { sessionId, transaction } = payload;
    const { transactionId, transactionStatus, paymentMethod } = transaction || {};

    if (!sessionId || !transactionId || !transactionStatus) {
      console.error("ArifPay Callback: Missing required fields in payload (sessionId, transactionId, transactionStatus).");
      return NextResponse.json({ message: "Invalid payload: missing required fields." }, { status: 400 });
    }
    
    // Find the ArifPayment record using the session ID
    const arifPayment = await databaseService.getArifPaymentBySessionId(sessionId);

    if (!arifPayment) {
      console.warn(`ArifPay Callback: ArifPayment record with Session ID ${sessionId} not found.`);
      return NextResponse.json({ message: "Payment record not found, but callback acknowledged." }, { status: 200 });
    }

    // Process based on status
    if (transactionStatus === 'SUCCESS') {
      await prisma.$transaction(async (tx) => {
        // Update the ArifPayment record
        await tx.arifPayment.update({
          where: { id: arifPayment.id },
          data: {
            status: 'Success',
            transactionId: transactionId,
            paymentMethod: paymentMethod || 'ArifPay',
          }
        });
        
        // Update the associated Bill record
        await tx.bill.update({
          where: { id: arifPayment.billId },
          data: {
            status: 'Paid',
            paymentDate: new Date(),
            paymentMethod: paymentMethod || 'ArifPay',
            paymentReference: transactionId,
            adminVerifiedPayment: true,
            adminVerificationNotes: `Payment confirmed via ArifPay callback. Session ID: ${sessionId}.`,
          }
        });
      });
      console.log(`Updated bill ${arifPayment.billId} to 'Paid' based on ArifPay callback.`);
    } else {
      // Handle other statuses like FAILED, CANCELED, EXPIRED
       await prisma.$transaction(async (tx) => {
         await tx.arifPayment.update({
          where: { id: arifPayment.id },
          data: {
            status: 'Failed', // or transactionStatus
            transactionId: transactionId,
            paymentMethod: paymentMethod,
          }
        });
        await tx.bill.update({
          where: { id: arifPayment.billId },
          data: {
            status: 'Pending', // Revert to Pending
            tenantPaymentNotes: `ArifPay payment attempt failed or was cancelled. Status: ${transactionStatus}.`
          }
        });
      });
      console.log(`Payment for bill ${arifPayment.billId} was not successful. Status: ${transactionStatus}.`);
    }

    // Acknowledge receipt to ArifPay
    return NextResponse.json({ message: "Callback processed successfully." }, { status: 200 });

  } catch (error) {
    console.error("Error processing ArifPay callback:", error);
    return NextResponse.json({ message: "Internal server error." }, { status: 500 });
  }
}
