import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-access";
import { notifyInquiry } from "@/lib/inquiry-mail";
import { InquiryError, publicInquiry } from "@/lib/inquiries";

export const runtime = "nodejs";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireAdmin(request); if (denied) return denied;
  try { return NextResponse.json({ inquiry: publicInquiry(await notifyInquiry((await params).id)) }); }
  catch (error) { return NextResponse.json({ error: "Could not retry notification." }, { status: error instanceof InquiryError ? error.status : 503 }); }
}
