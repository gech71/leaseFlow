// This file is no longer needed as login is handled by /api/Auth/login.
// It can be deleted, but returning an informative error is good practice.

import { NextResponse, type NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  return NextResponse.json(
    { isSuccess: false, errors: ["This login endpoint is deprecated. Please use /api/Auth/login."] },
    { status: 410 } // 410 Gone
  );
}
