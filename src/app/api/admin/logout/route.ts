import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, adminCookieOptions, revokeSession } from "@/lib/admin-session";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    revokeSession(request.cookies.get(ADMIN_COOKIE)?.value);
  } catch {
    return NextResponse.json({ error: "Could not revoke the admin session. Try signing out again." }, { status: 503 });
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE, "", { ...adminCookieOptions(), maxAge: 0 });
  return response;
}
