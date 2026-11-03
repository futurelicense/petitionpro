import "server-only";

export class SupabaseError extends Error {
  constructor(public status: number, public code = "") {
    super(`Supabase request failed (${status}). Check server configuration and the database migration.`);
  }
}

export function supabaseRequested() {
  return Boolean(process.env.SUPABASE_URL || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function supabaseConfig() {
  const value = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SECRET_KEY?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!value || !key) throw new Error("Set SUPABASE_URL and the server-only SUPABASE_SECRET_KEY.");
  const url = new URL(value);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && ["127.0.0.1", "localhost"].includes(url.hostname))) {
    throw new Error("Supabase must use HTTPS, or a local development address.");
  }
  if (url.username || url.password || url.search || url.hash || url.pathname !== "/") throw new Error("Use the Supabase project origin as SUPABASE_URL.");
  let legacy = false;
  if (key.startsWith("eyJ")) {
    try { legacy = JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString()).role === "service_role"; }
    catch { /* Reject malformed or non-service keys. */ }
  }
  if (!key.startsWith("sb_secret_") && !legacy) throw new Error("Use a server secret key, not a publishable or anon key.");
  return { url: url.origin, key, legacy };
}

export async function supabaseFetch(path: string, init: RequestInit = {}) {
  const { url, key, legacy } = supabaseConfig();
  if (!path.startsWith("/") || path.startsWith("//")) throw new Error("Invalid Supabase API path.");
  const headers = new Headers(init.headers);
  headers.set("apikey", key);
  if (legacy) headers.set("Authorization", `Bearer ${key}`);
  else headers.delete("Authorization");
  const response = await fetch(`${url}${path}`, { ...init, headers, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(30_000) });
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { code?: string; error?: string };
    throw new SupabaseError(response.status, body.code || body.error || "");
  }
  return response;
}
