import { createHmac, timingSafeEqual } from "node:crypto";

export const ADMIN_COOKIE = "petitionpro-admin";

const FALLBACK_USER = "admin";
const FALLBACK_PASSWORD = "admin30";
const FALLBACK_SECRET = "petitionpro-local-admin-session";

function adminUser() {
  return process.env.ADMIN_USER?.trim() || FALLBACK_USER;
}

function adminPassword() {
  return process.env.ADMIN_PASSWORD || FALLBACK_PASSWORD;
}

function sessionSecret() {
  return process.env.ADMIN_SESSION_SECRET || FALLBACK_SECRET;
}

function digest(value: string) {
  return createHmac("sha256", sessionSecret()).update(value).digest();
}

function sameSecret(left: string, right: string) {
  return timingSafeEqual(digest(left), digest(right));
}

export function credentialsMatch(username: string, password: string) {
  return sameSecret(username, adminUser()) && sameSecret(password, adminPassword());
}

export function sessionValue() {
  return createHmac("sha256", sessionSecret()).update(`petitionpro-admin:${adminUser()}`).digest("hex");
}

export function sessionValid(value: string | undefined) {
  if (!value) return false;
  const expected = Buffer.from(sessionValue());
  const actual = Buffer.from(value);
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

export function safeNext(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/cases";
  try {
    const url = new URL(value, "http://petitionpro.local");
    if (url.origin !== "http://petitionpro.local") return "/cases";
    if (url.pathname === "/login" || url.pathname.startsWith("/login/")) return "/cases";
    return `${url.pathname}${url.search}`;
  } catch {
    return "/cases";
  }
}

export function adminCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  };
}
