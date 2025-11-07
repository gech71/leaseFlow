
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

// This is a lightweight API route that can be safely called from middleware
// because it runs in the Node.js runtime, not the Edge runtime.
export async function GET() {
  const session = await auth();
  if (session) {
    return NextResponse.json({ isLoggedIn: true });
  }
  return NextResponse.json({ isLoggedIn: false });
}
