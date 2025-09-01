
import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { databaseService } from '@/lib/services/databaseService';

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
    const payload = await request.json();
    console.log("Received ArifPay callback payload:", payload);

    const { transactionId: arifTransactionId, status, sessionId } = payload;
    if (!arifTransactionId || !status || !sessionId) {
      console.error("ArifPay Callback: Missing required fields in payload.");
      return NextResponse.json({ message: "Invalid payload: missing required fields." }, { status: 400 });
    }
    
    // Extract the original billId from the transactionId
    // We expect the format to be "billId__nonce"
    const billId = arifTransactionId.split('__')[0];
    if (!billId) {
        console.error(`ArifPay Callback: Could not parse billId from transactionId: ${arifTransactionId}`);
        return NextResponse.json({ message: "Invalid transactionId format." }, { status: 400 });
    }

    const bill = await prisma.bill.findUnique({
      where: { id: billId }
    });

    if (!bill) {
      console.warn(`ArifPay Callback: Bill with ID ${billId} not found.`);
      // Return 200 to prevent ArifPay from retrying for a non-existent bill
      return NextResponse.json({ message: "Bill not found, but callback acknowledged." }, { status: 200 });
    }

    // Process based on status
    if (status === 'SUCCESS') {
      await databaseService.updateBill(billId, {
        status: 'Paid',
        paymentDate: new Date(),
        paymentMethod: 'ArifPay',
        paymentReference: sessionId,
        adminVerifiedPayment: true,
        adminVerificationNotes: `Payment confirmed via ArifPay callback. Transaction ID: ${arifTransactionId}.`
      });
      console.log(`Updated bill ${billId} to 'Paid' based on ArifPay callback.`);
    } else {
      // Handle other statuses like FAILED, CANCELED, EXPIRED
      await databaseService.updateBill(billId, {
        status: 'Pending', // Revert to Pending or keep as is
        tenantPaymentNotes: `ArifPay payment attempt failed or was cancelled. Status: ${status}.`
      });
      console.log(`Payment for bill ${billId} was not successful. Status: ${status}.`);
    }

    // Acknowledge receipt to ArifPay
    return NextResponse.json({ message: "Callback processed successfully." }, { status: 200 });

  } catch (error) {
    console.error("Error processing ArifPay callback:", error);
    return NextResponse.json({ message: "Internal server error." }, { status: 500 });
  }
}
