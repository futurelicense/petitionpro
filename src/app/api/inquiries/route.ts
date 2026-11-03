import { NextResponse } from "next/server";
import { createInquiry, InquiryError, validInquiryId } from "@/lib/inquiries";
import { notifyInquiry } from "@/lib/inquiry-mail";
import { limitedFormData } from "@/lib/request-body";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const form = await limitedFormData(request);
    const text = (name: string, maximum: number) => {
      const value = form.get(name);
      const result = typeof value === "string" ? value.replace(/\r\n?/g, "\n").trim() : "";
      if (result.length > maximum) throw new InquiryError(`${name} is too long.`);
      return result;
    };
    if (form.get("consent") !== "yes") throw new InquiryError("Please consent to sharing your assessment and CV for consultant review.");
    const id = text("submissionId", 36);
    const name = text("name", 120).replace(/[\r\n]/g, " ");
    const email = text("email", 254);
    const endeavor = text("endeavor", 6000);
    const cvText = text("cvText", 20000);
    const report = text("report", 60000);
    if (!validInquiryId(id) || name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new InquiryError("Enter your name and a valid email address.");
    }
    if (endeavor.length < 40 || cvText.replace(/\s/g, "").length < 80 || report.length < 80) {
      throw new InquiryError("Generate your endeavor and CV-based assessment before submitting.");
    }
    const file = form.get("cv");
    let cv: Buffer, cvFileName: string, cvType: string;
    const types: Record<string, string> = { pdf: "application/pdf", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", txt: "text/plain", md: "text/markdown" };
    if (file instanceof File && file.size > 0) {
      if (file.size > 6 * 1024 * 1024) throw new InquiryError("CV must be 6 MB or smaller.", 413);
      const extension = file.name.split(".").pop()?.toLowerCase() || "";
      if (!types[extension]) throw new InquiryError("Attach a PDF, DOCX, or text CV.");
      cv = Buffer.from(await file.arrayBuffer());
      cvFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120);
      cvType = types[extension];
    } else {
      if (form.get("originalFileRequired") === "yes") throw new InquiryError("Reattach your original CV before submitting.");
      cv = Buffer.from(cvText);
      cvFileName = "cv.txt";
      cvType = "text/plain";
    }
    const inquiry = await createInquiry({ id, name, email, endeavor, cvText, report, cvFileName, cvType,
      phone: text("phone", 80), message: text("message", 3000), mechanism: text("mechanism", 2000),
      beneficiaries: text("beneficiaries", 2000), nationalImportance: text("nationalImportance", 4000),
    }, cv);
    // Saving the inquiry is independent of mail availability or delivery.
    try { await notifyInquiry(inquiry.id); } catch { /* The inbox still holds the submission. */ }
    return NextResponse.json({ id: inquiry.id, message: "Your inquiry and CV have been received. The team can now review your assessment." }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof InquiryError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Could not save your inquiry. Please try again." }, { status: 503 });
  }
}
