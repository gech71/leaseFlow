// src/app/api/auth/session/route.ts
import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth();
  if (session) {
    return NextResponse.json({ authenticated: true, user: session.user });
  } else {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
}
