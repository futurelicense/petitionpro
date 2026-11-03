import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Inquiry } from "./inquiry-types";

export type StoredInquiry = Inquiry & { fingerprint: string };
export class InquiryError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export function inquiryDirectory() {
  return process.env.INQUIRY_STORAGE_DIR || join(/* turbopackIgnore: true */ process.cwd(), ".data", "inquiries");
}

export function validInquiryId(id: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

function location(id: string) {
  if (!validInquiryId(id)) throw new InquiryError("Inquiry not found.", 404);
  return join(/* turbopackIgnore: true */ inquiryDirectory(), id);
}

export function readInquiry(id: string): StoredInquiry {
  try {
    return JSON.parse(readFileSync(/* turbopackIgnore: true */ join(/* turbopackIgnore: true */ location(id), "inquiry.json"), "utf8")) as StoredInquiry;
  } catch (error) {
    if (error instanceof InquiryError) throw error;
    if ((error as NodeJS.ErrnoException).code === "ENOENT") throw new InquiryError("Inquiry not found.", 404);
    throw error;
  }
}

export function publicInquiry(inquiry: StoredInquiry): Inquiry {
  const { fingerprint: _fingerprint, ...details } = inquiry;
  void _fingerprint;
  return details;
}

export function listInquiries(): Inquiry[] {
  let entries: string[];
  try { entries = readdirSync(/* turbopackIgnore: true */ inquiryDirectory()); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  return entries.filter(validInquiryId).map((id) => publicInquiry(readInquiry(id)))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function inquiryCv(id: string): Buffer {
  return readFileSync(/* turbopackIgnore: true */ join(/* turbopackIgnore: true */ location(id), "cv"));
}

export function createInquiry(input: Omit<Inquiry, "createdAt" | "consentAt" | "status" | "emailStatus" | "emailId">, cv: Buffer) {
  const fingerprint = createHash("sha256").update(JSON.stringify(input)).update(cv).digest("hex");
  const now = new Date().toISOString();
  const inquiry: StoredInquiry = { ...input, fingerprint, createdAt: now, consentAt: now,
    status: "new", emailStatus: "pending", emailId: "" };
  const root = inquiryDirectory();
  const target = location(input.id);
  mkdirSync(root, { recursive: true, mode: 0o700 });
  try {
    const existing = readInquiry(input.id);
    if (existing.fingerprint !== fingerprint) throw new InquiryError("This submission reference has already been used. Reload the form to submit different details.", 409);
    return existing;
  } catch (error) {
    if (!(error instanceof InquiryError) || error.status !== 404) throw error;
  }
  const temporary = mkdtempSync(join(/* turbopackIgnore: true */ root, ".pending-"));
  try {
    writeFileSync(join(/* turbopackIgnore: true */ temporary, "cv"), cv, { mode: 0o600 });
    writeFileSync(join(/* turbopackIgnore: true */ temporary, "inquiry.json"), JSON.stringify(inquiry), { mode: 0o600 });
    renameSync(temporary, target);
  } catch (error) {
    rmSync(temporary, { recursive: true, force: true });
    if (["EEXIST", "ENOTEMPTY"].includes((error as NodeJS.ErrnoException).code || "")) {
      const existing = readInquiry(input.id);
      if (existing.fingerprint === fingerprint) return existing;
      throw new InquiryError("Submission reference already used.", 409);
    }
    throw error;
  }
  return inquiry;
}

export function updateInquiry(id: string, change: Partial<Pick<Inquiry, "status" | "emailStatus" | "emailId">>) {
  const next = { ...readInquiry(id), ...change };
  const temporary = join(/* turbopackIgnore: true */ location(id), `${randomUUID()}.tmp`);
  writeFileSync(temporary, JSON.stringify(next), { mode: 0o600 });
  renameSync(temporary, join(/* turbopackIgnore: true */ location(id), "inquiry.json"));
  return next;
}
