import { createHash } from "node:crypto";
import { supabaseFetch, SupabaseError } from "./supabase";
import { InquiryError, validInquiryId, publicInquiry, type StoredInquiry } from "./inquiries-local";
import type { Inquiry } from "./inquiry-types";

const TABLE = "/rest/v1/petitionpro_inquiries";
const BUCKET = "petitionpro-cvs";
type Row = { id: string; created_at: string; payload: StoredInquiry; cv_path: string; fingerprint: string };

function validateId(id: string) {
  if (!validInquiryId(id)) throw new InquiryError("Inquiry not found.", 404);
}
function objectPath(value: string) {
  return value.split("/").map(encodeURIComponent).join("/");
}
async function findRow(id: string): Promise<Row | null> {
  validateId(id);
  const response = await supabaseFetch(`${TABLE}?id=eq.${encodeURIComponent(id)}&select=id,created_at,payload,cv_path,fingerprint&limit=1`);
  const rows = await response.json() as Row[];
  return rows[0] || null;
}
export async function readInquiry(id: string): Promise<StoredInquiry> {
  const row = await findRow(id);
  if (!row) throw new InquiryError("Inquiry not found.", 404);
  return row.payload;
}
export async function listInquiries(): Promise<Inquiry[]> {
  const results = new Map<string, Inquiry>();
  const size = 100;
  for (let offset = 0; ; offset += size) {
    const response = await supabaseFetch(`${TABLE}?select=id,payload&order=created_at.desc,id.desc&limit=${size}&offset=${offset}`);
    const rows = await response.json() as Pick<Row, "id" | "payload">[];
    for (const row of rows) results.set(row.id, publicInquiry(row.payload));
    if (rows.length < size) break;
  }
  return [...results.values()];
}
export async function inquiryCv(id: string): Promise<Buffer> {
  const row = await findRow(id);
  if (!row) throw new InquiryError("Inquiry not found.", 404);
  const response = await supabaseFetch(`/storage/v1/object/authenticated/${BUCKET}/${objectPath(row.cv_path)}`);
  return Buffer.from(await response.arrayBuffer());
}
export async function updateInquiry(id: string, change: Partial<Pick<Inquiry, "status" | "emailStatus" | "emailId">>): Promise<StoredInquiry> {
  validateId(id);
  const response = await supabaseFetch("/rest/v1/rpc/petitionpro_patch_inquiry", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ p_id: id, p_patch: change }),
  });
  const rows = await response.json() as Row[];
  if (!rows.length) throw new InquiryError("Inquiry not found.", 404);
  return rows[0].payload;
}

export async function createInquiry(input: Omit<Inquiry, "createdAt" | "consentAt" | "status" | "emailStatus" | "emailId">, cv: Buffer): Promise<StoredInquiry> {
  const fingerprint = createHash("sha256").update(JSON.stringify(input)).update(cv).digest("hex");
  const now = new Date().toISOString();
  return importInquiry({ ...input, fingerprint, createdAt: now, consentAt: now, status: "new", emailStatus: "pending", emailId: "" }, cv);
}

/** Migration preserves timestamps, consent, status, and the existing email delivery state. */
export async function importInquiry(inquiry: StoredInquiry, cv: Buffer): Promise<StoredInquiry> {
  validateId(inquiry.id);
  if (!/^[a-f0-9]{64}$/.test(inquiry.fingerprint)) throw new Error("Invalid inquiry fingerprint.");
  const existing = await findRow(inquiry.id);
  if (existing) {
    if (existing.fingerprint !== inquiry.fingerprint) throw new InquiryError("Submission reference already used.", 409);
    return existing.payload;
  }
  const cvPath = `${inquiry.id}/${inquiry.fingerprint}/cv`;
  let uploaded = false;
  try {
    await supabaseFetch(`/storage/v1/object/${BUCKET}/${objectPath(cvPath)}`, {
      method: "POST", headers: { "Content-Type": inquiry.cvType, "x-upsert": "false" }, body: new Uint8Array(cv),
    });
    uploaded = true;
  } catch (error) {
    if (!(error instanceof SupabaseError && [400, 409].includes(error.status) && ["Duplicate", "ResourceAlreadyExists"].includes(error.code))) throw error;
  }
  const row: Row = { id: inquiry.id, created_at: inquiry.createdAt, payload: inquiry, fingerprint: inquiry.fingerprint, cv_path: cvPath };
  try {
    const response = await supabaseFetch(TABLE, { method: "POST", headers: { "Content-Type": "application/json", Prefer: "return=representation" }, body: JSON.stringify(row) });
    const rows = await response.json() as Row[];
    if (!rows[0]) throw new Error("Supabase did not confirm the saved inquiry.");
    return rows[0].payload;
  } catch (error) {
    // A timed-out insert may have committed. Confirm before deciding whether to retry.
    const winner = await findRow(inquiry.id).catch(() => null);
    if (winner?.fingerprint === inquiry.fingerprint) return winner.payload;
    if (winner && winner.fingerprint !== inquiry.fingerprint) {
      if (uploaded) {
        // Only remove our unused, content-addressed upload after a confirmed conflict.
        await supabaseFetch(`/storage/v1/object/${BUCKET}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prefixes: [cvPath] }) }).catch(() => undefined);
      }
      throw new InquiryError("Submission reference already used.", 409);
    }
    // Keep the private upload after ambiguous failures so a retry can finish safely.
    throw error;
  }
}
