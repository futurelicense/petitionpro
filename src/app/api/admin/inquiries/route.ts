import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-access";
import { listInquiries } from "@/lib/inquiries";

export const runtime = "nodejs";
export async function GET(request: Request) {
  const denied = requireAdmin(request); if (denied) return denied;
  try {
    const inquiries = await listInquiries();
    const body = new URL(request.url).searchParams.has("summary")
      ? { newCount: inquiries.filter((item) => item.status === "new").length } : { inquiries };
    return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
  }
  catch { return NextResponse.json({ error: "Could not load inquiries." }, { status: 503 }); }
}
