import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const ADMIN_COOKIE = "petitionpro-admin";
const SESSION_SECONDS = 60 * 60 * 12;

function config() {
  const username = process.env.ADMIN_USER?.trim();
  const password = process.env.ADMIN_PASSWORD;
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!username || !password?.trim() || !secret || secret.length < 32) return null;
  return { username, password, secret };
}

export function isAdminConfigured() {
  return config() !== null;
}

function equal(left: string, right: string) {
  const a = createHash("sha256").update(left).digest();
  const b = createHash("sha256").update(right).digest();
  return timingSafeEqual(a, b);
}

export function credentialsMatch(username: string, password: string) {
  const settings = config();
  return Boolean(settings && equal(username, settings.username) && equal(password, settings.password));
}

function sessionPath(value: string) {
  const directory = process.env.ADMIN_SESSION_DIR || join(process.cwd(), ".data", "admin-sessions");
  const id = createHash("sha256").update(value).digest("hex");
  return { directory, file: join(directory, `${id}.json`) };
}

function credentialVersion(settings: NonNullable<ReturnType<typeof config>>) {
  return createHmac("sha256", settings.secret)
    .update(JSON.stringify([settings.username, settings.password]))
    .digest("hex");
}

export function sessionValue() {
  const settings = config();
  if (!settings) throw new Error("Admin sign-in is not configured.");
  const value = randomBytes(32).toString("hex");
  const { directory, file } = sessionPath(value);
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  writeFileSync(file, JSON.stringify({
    expiresAt: Date.now() + SESSION_SECONDS * 1000,
    credentialVersion: credentialVersion(settings),
  }), { mode: 0o600, flag: "wx" });
  return value;
}

export function revokeSession(value: string | undefined) {
  if (!value || !/^[a-f0-9]{64}$/.test(value)) return;
  try {
    unlinkSync(sessionPath(value).file);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

export function sessionValid(value: string | undefined) {
  const settings = config();
  if (!settings || !value || !/^[a-f0-9]{64}$/.test(value)) return false;
  try {
    // Session records are mutable runtime data, never deployment assets.
    const session = JSON.parse(readFileSync(/* turbopackIgnore: true */ sessionPath(value).file, "utf8")) as {
      expiresAt?: number;
      credentialVersion?: string;
    };
    if (typeof session.expiresAt !== "number" || session.expiresAt <= Date.now()) return false;
    return typeof session.credentialVersion === "string" &&
      equal(session.credentialVersion, credentialVersion(settings));
  } catch {
    return false;
  }
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
    maxAge: SESSION_SECONDS,
  };
}
