
import { NextResponse, type NextRequest } from 'next/server';
import { databaseService } from '@/lib/services/databaseService';
import bcrypt from 'bcryptjs';
import { createSession, createUserPayload } from '@/lib/auth/jwt';
import { rateLimiter } from '@/lib/auth/rate-limiter';
import type { User, Role } from '@prisma/client';

async function checkRateLimit(identifier: string) {
    const { success, limit, remaining, reset } = await rateLimiter(identifier);
    return { success, limit, remaining, reset };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone, password } = body;

    if (!phone || !password) {
      return NextResponse.json({ message: "Phone number and password are required." }, { status: 400 });
    }

    const ip = request.ip ?? request.headers.get('x-forwarded-for') ?? '127.0.0.1';

    // Rate limit by both IP and phone number
    const [ipLimit, phoneLimit] = await Promise.all([
      checkRateLimit(ip),
      checkRateLimit(phone),
    ]);

    if (!ipLimit.success || !phoneLimit.success) {
      const retryAfter = Math.ceil((Math.max(ipLimit.reset, phoneLimit.reset) - Date.now()) / 1000);
      return NextResponse.json({ message: `Too many requests. Try again in ${retryAfter} seconds.` }, { status: 429 });
    }
    
    const remainingAttempts = Math.min(ipLimit.remaining, phoneLimit.remaining);

    const user = await databaseService.findUserByPhoneNumber(phone, { roles: true });
    
    if (!user) {
      return NextResponse.json({ message: `Invalid credentials. ${remainingAttempts} attempts remaining.` }, { status: 401 });
    }

    let isValidPassword = false;
    let forceChangePass = false;

    if (user.tempPassword) {
      // Check against temporary password first
      isValidPassword = password === user.tempPassword;
      if (isValidPassword) {
        forceChangePass = true;
      }
    } 
    
    if (!isValidPassword && user.password) {
      // If temp password didn't match (or didn't exist), check main password
      isValidPassword = await bcrypt.compare(password, user.password);
    }
    
    if (!isValidPassword) {
      return NextResponse.json({ message: `Invalid credentials. ${remainingAttempts} attempts remaining.` }, { status: 401 });
    }

    // On successful login, create the session (both access and refresh tokens)
    const payload = createUserPayload(user);
    payload.forceChangePass = forceChangePass; // Ensure flag is set correctly
    await createSession(payload);

    return NextResponse.json({ message: "Login successful" }, { status: 200 });

  } catch (error) {
    console.error("Login API Error:", error);
    return NextResponse.json({ message: "An internal server error occurred." }, { status: 500 });
  }
}
