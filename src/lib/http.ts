import { InquiryError } from "./inquiries";
import { NextResponse } from "next/server";
import { GroqError } from "@/lib/groq";

export const runtime = "nodejs";
export const maxDuration = 60;

export function fail(error: unknown) {
  if (error instanceof InquiryError || error instanceof GroqError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  const message = error instanceof Error ? error.message : "Request failed.";
  return NextResponse.json({ error: message }, { status: 400 });
}

export function asString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => asString(x)).filter(Boolean);
}

export function asBool(v: unknown): boolean {
  return v === true;
}
