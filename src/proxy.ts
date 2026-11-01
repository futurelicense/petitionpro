import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ADMIN_COOKIE, safeNext, sessionValid } from "@/lib/admin-session";

export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (path === "/login" || path === "/api/admin/login") return NextResponse.next();
  if (sessionValid(request.cookies.get(ADMIN_COOKIE)?.value)) return NextResponse.next();

  const login = new URL("/login", request.url);
  login.searchParams.set("next", safeNext(`${path}${request.nextUrl.search}`));
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
