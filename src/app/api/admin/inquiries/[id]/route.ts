import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-access";
import { InquiryError, publicInquiry, updateInquiry } from "@/lib/inquiries";

export const runtime = "nodejs";
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireAdmin(request); if (denied) return denied;
  try {
    const body = await request.json();
    if (!["new", "reviewed", "converted"].includes(body.status)) return NextResponse.json({ error: "Invalid inquiry status." }, { status: 400 });
    return NextResponse.json({ inquiry: publicInquiry(await updateInquiry((await params).id, { status: body.status })) });
  } catch (error) { return NextResponse.json({ error: "Could not update inquiry." }, { status: error instanceof InquiryError ? error.status : 503 }); }
}
