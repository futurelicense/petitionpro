import { NextResponse } from "next/server";
import { adminCookieOptions, ADMIN_COOKIE, credentialsMatch, isAdminConfigured, sessionValue } from "@/lib/admin-session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isAdminConfigured()) {
    return NextResponse.json({ error: "Admin sign-in is not configured. Set ADMIN_USER, ADMIN_PASSWORD, and ADMIN_SESSION_SECRET (at least 32 characters)." }, { status: 503 });
  }
  const body = await request.json().catch(() => null);
  const username = typeof body?.username === "string" ? body.username.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!credentialsMatch(username, password)) {
    return NextResponse.json(
      { error: "That username or password is not recognized." },
      { status: 401 },
    );
  }
  const response = NextResponse.json({ ok: true });
  try {
    response.cookies.set(ADMIN_COOKIE, sessionValue(), adminCookieOptions());
  } catch {
    return NextResponse.json({ error: "Could not create an admin session." }, { status: 503 });
  }
  return response;
}
