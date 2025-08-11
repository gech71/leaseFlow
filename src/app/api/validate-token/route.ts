import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return NextResponse.json(
      { isSuccess: false, error: "Missing or invalid Authorization header." },
      { status: 401 }
    );
  }

  const token = authHeader.substring(7); // Extract token
  if (!token) {
    return NextResponse.json(
      { isSuccess: false, error: "Token is empty." },
      { status: 401 }
    );
  }

  return NextResponse.json({ isSuccess: true, message: "OK" }, { status: 200 });
}
