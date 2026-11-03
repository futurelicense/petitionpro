import * as local from "./inquiries-local";
import * as cloud from "./inquiries-supabase";
import { supabaseRequested } from "./supabase";
import type { Inquiry } from "./inquiry-types";

export { InquiryError, validInquiryId, publicInquiry, inquiryDirectory } from "./inquiries-local";
export type { StoredInquiry } from "./inquiries-local";

// Once Supabase is configured, failures are surfaced rather than silently
// writing to a different store and making submissions disappear from the inbox.
export async function readInquiry(id: string) {
  return supabaseRequested() ? cloud.readInquiry(id) : local.readInquiry(id);
}
export async function listInquiries() {
  return supabaseRequested() ? cloud.listInquiries() : local.listInquiries();
}
export async function inquiryCv(id: string) {
  return supabaseRequested() ? cloud.inquiryCv(id) : local.inquiryCv(id);
}
export async function createInquiry(input: Omit<Inquiry, "createdAt" | "consentAt" | "status" | "emailStatus" | "emailId">, cv: Buffer) {
  return supabaseRequested() ? cloud.createInquiry(input, cv) : local.createInquiry(input, cv);
}
export async function updateInquiry(id: string, change: Partial<Pick<Inquiry, "status" | "emailStatus" | "emailId">>) {
  return supabaseRequested() ? cloud.updateInquiry(id, change) : local.updateInquiry(id, change);
}
