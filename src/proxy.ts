import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { publicLimit } from "@/lib/public-limit";
import { ADMIN_COOKIE, safeNext, sessionValid } from "@/lib/admin-session";

export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (path === "/login" || path === "/api/admin/login") return NextResponse.next();
  const admin = sessionValid(request.cookies.get(ADMIN_COOKIE)?.value);
  const publicPages = ["/", "/diy"];
  const freeApis = ["/api/endeavor", "/api/parse-cv", "/api/fit", "/api/skeletons", "/api/inquiries"];
  if (publicPages.includes(path)) return NextResponse.next();
  if (freeApis.includes(path) && request.method === "POST") {
    if (!admin) {
      const limited = publicLimit(request, path === "/api/inquiries" ? "inquiry" : "assessment");
      if (limited) return limited;
    }
    return NextResponse.next();
  }
  if (admin) return NextResponse.next();
  if (path.startsWith("/api/")) return NextResponse.json({ error: "Admin sign-in required." }, { status: 401 });

  const login = new URL("/login", request.url);
  login.searchParams.set("next", safeNext(`${path}${request.nextUrl.search}`));
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
