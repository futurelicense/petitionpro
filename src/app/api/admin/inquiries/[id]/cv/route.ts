import { requireAdmin } from "@/lib/admin-access";
import { InquiryError, inquiryCv, readInquiry } from "@/lib/inquiries";

export const runtime = "nodejs";
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireAdmin(request); if (denied) return denied;
  try {
    const { id } = await params;
    const inquiry = await readInquiry(id);
    return new Response(new Uint8Array(await inquiryCv(id)), { headers: {
      "Content-Type": inquiry.cvType, "Content-Disposition": `attachment; filename="${inquiry.cvFileName}"`,
      "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff",
    } });
  } catch (error) { return Response.json({ error: "CV not available." }, { status: error instanceof InquiryError ? error.status : 503 }); }
}
