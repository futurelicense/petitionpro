import { NextResponse } from "next/server";
import { adminCookieOptions, ADMIN_COOKIE, credentialsMatch, sessionValue } from "@/lib/admin-session";

export const runtime = "nodejs";

export async function POST(request: Request) {
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
  response.cookies.set(ADMIN_COOKIE, sessionValue(), adminCookieOptions());
  return response;
}
