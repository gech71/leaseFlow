
import { NextResponse, type NextRequest } from 'next/server';
import { deleteSession } from '@/lib/auth/jwt';

export async function POST(request: NextRequest) {
  await deleteSession();
  return NextResponse.json({ message: "Logout successful" }, { status: 200 });
}
