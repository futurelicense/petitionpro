import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { NextResponse } from "next/server";

/** File-backed admission limits persist across workers and server restarts. */
export function publicLimit(request: Request, kind: "assessment" | "inquiry") {
  const hour = Math.floor(Date.now() / 3_600_000);
  const identity = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || request.headers.get("x-real-ip") || "local";
  const key = createHash("sha256").update(identity).digest("hex");
  const root = join(/* turbopackIgnore: true */ process.env.PUBLIC_LIMIT_DIR || join(/* turbopackIgnore: true */ process.cwd(), ".data", "public-limits"), `${hour}`, kind);
  const client = join(/* turbopackIgnore: true */ root, key);
  const global = join(/* turbopackIgnore: true */ root, "all");
  const clientLimit = kind === "inquiry" ? 5 : 40;
  const totalLimit = kind === "inquiry" ? 100 : 500;
  try {
    mkdirSync(client, { recursive: true, mode: 0o700 });
    mkdirSync(global, { recursive: true, mode: 0o700 });
    if (readdirSync(/* turbopackIgnore: true */ client).length >= clientLimit ||
        readdirSync(/* turbopackIgnore: true */ global).length >= totalLimit) {
      return NextResponse.json({ error: "The free request limit has been reached. Please try again after the hour changes." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((hour + 1) * 3600 - Date.now() / 1000)) } });
    }
    const requestId = randomUUID();
    writeFileSync(join(/* turbopackIgnore: true */ global, requestId), "", { mode: 0o600, flag: "wx" });
    writeFileSync(join(/* turbopackIgnore: true */ client, requestId), "", { mode: 0o600, flag: "wx" });
    return null;
  } catch {
    return NextResponse.json({ error: "Free assessments are temporarily unavailable. Please try again shortly." }, { status: 503 });
  }
}
