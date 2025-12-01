
import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

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
    // --- Step 1: Token Validation ---
    const authHeader = request.headers.get('Authorization');
  

    // Extract the token from the string like: Bearer {token: YOUR_TOKEN}
    const tokenMatch = authHeader?.match(/token:\s*(.+)\s*}/);
    const rawToken = tokenMatch?.[1];

    // Reconstruct the standard Bearer token format
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
        paidByNumber,
        txnRef,
        transactionId,
       
    } = requestBody;

    if (!transactionId) {
        console.error("Callback Error: Missing required fields (transactionId) in callback data.", requestBody);
        return NextResponse.json({ message: "Missing required fields." }, { status: 400 });
    }

    // --- Step 2 & 3: Find Bills and Compare Signatures ---
    try {
        const bills = await prisma.bill.findMany({
            where: {
                tenantPaymentNotes: {
                    contains: `Group Transaction Ref: ${transactionId}`
                }
            },
            include: {
                agreement: {
                    include: {
                        tenant: true,
                        space: {
                            include: {
                                building: true
                            }
                        }
                    }
                }
            }
        });

        if (bills.length === 0) {
            console.warn(`Callback Success: Received valid callback for transaction ${transactionId}, but no matching bills were found.`);
            // Acknowledge to NIB that we received it, even if we can't find the bill, to prevent retries.
            return NextResponse.json({ message: "Callback acknowledged, no matching bills found." }, { status: 200 });
        }

        
        // --- Step 4: Update Database ---
        const paymentDate = new Date();
        await prisma.bill.updateMany({
            where: { id: { in: bills.map(b => b.id) } },
            data: {
                status: 'Paid',
                paymentDate: paymentDate, 
                paymentReference: transactionId, 
                paymentMethod: 'NIB_SuperApp',
                adminVerifiedPayment: true, 
                adminVerificationNotes: `Payment confirmed via NIB callback. Paid by: ${paidByNumber}. NIB Transaction ID: ${transactionId}.`,
            }
        });

        // --- Step 5: Create Audit Log Entries ---
        for (const bill of bills) {
            if (bill.agreement?.space) {
                let utilityAmount = 0;
                if (typeof bill.utilityBreakdown === 'string') {
                    try {
                        const items = JSON.parse(bill.utilityBreakdown);
                        if (Array.isArray(items)) {
                            utilityAmount = items.reduce((sum, item) => sum + (item.amount || 0), 0);
                        }
                    } catch {}
                }

                await prisma.auditLog.create({
                    data: {
                        action: 'payment',
                        actorName: 'NIB SuperApp Callback',
                        tenantId: bill.tenantId,
                        tenantName: bill.agreement.tenant?.name || 'N/A',
                        buildingId: bill.agreement.space.buildingId,
                        buildingName: bill.agreement.space.buildingName,
                        spaceName: bill.agreement.space.spaceIdName,
                        paymentDate: paymentDate,
                        rentAmount: bill.rentAmount,
                        utilityAmount: utilityAmount,
                        penaltyAmount: bill.penaltyAmount || 0,
                        totalAmount: bill.totalAmount,
                        transactionId: transactionId,
                        toAccountNumber: bill.agreement.space.building.accountNumber,
                    }
                });
            }
        }
        
        // --- Step 6: Respond with 200 OK ---
        return NextResponse.json({ message: "Payment confirmed and all associated bills updated." }, { status: 200 });

    } catch (dbError: any) {
        console.error("Callback DB Error: Failed to process bills after successful validation.", dbError);
      
        return NextResponse.json({ message: "Callback acknowledged, but an internal processing error occurred." }, { status: 200 });
    }
}
