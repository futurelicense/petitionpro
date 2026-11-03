import { NextResponse } from "next/server";
import { ADMIN_COOKIE, sessionValid } from "./admin-session";

export function requireAdmin(request: Request) {
  const value = request.headers.get("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${ADMIN_COOKIE}=`))?.slice(ADMIN_COOKIE.length + 1);
  return sessionValid(value) ? null : NextResponse.json({ error: "Admin sign-in required." }, { status: 401 });
}
