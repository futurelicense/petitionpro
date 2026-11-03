import { inquiryCv, readInquiry, updateInquiry } from "./inquiries";

export async function notifyInquiry(id: string) {
  const inquiry = await readInquiry(id);
  if (inquiry.emailStatus === "accepted") return inquiry;
  const key = process.env.RESEND_API_KEY?.trim();
  const from = process.env.INQUIRY_EMAIL_FROM?.trim();
  const to = process.env.INQUIRY_EMAIL_TO?.trim();
  if (!key || !from || !to) return updateInquiry(id, { emailStatus: "not-configured" });
  try {
    const appUrl = process.env.APP_URL?.trim().replace(/\/$/, "");
    const text = ["New consultant inquiry", `Reference: ${inquiry.id}`, `Client: ${inquiry.name}`,
      `Email: ${inquiry.email}`, `Phone: ${inquiry.phone || "Not provided"}`,
      "", "Proposed endeavor", inquiry.endeavor, "", "Client message", inquiry.message || "None",
      "", "Generated assessment", inquiry.report, "",
      appUrl ? `Review in admin: ${appUrl}/inquiries#${inquiry.id}` : "Review the submission in the admin Inquiries inbox.",
      "", "The client consented to sharing this assessment and CV for consultant review."
    ].join("\n");
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "Idempotency-Key": `inquiry-${id}` },
      body: JSON.stringify({ from, to: [to], reply_to: inquiry.email, subject: `PetitionPro consultant inquiry: ${inquiry.name}`,
        text, attachments: [
          { filename: inquiry.cvFileName, content: (await inquiryCv(id)).toString("base64") },
          { filename: "generated-assessment.md", content: Buffer.from(inquiry.report).toString("base64") },
        ] }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) return updateInquiry(id, { emailStatus: "failed" });
    const body = await response.json() as { id?: unknown };
    if (typeof body.id !== "string" || !body.id) return updateInquiry(id, { emailStatus: "failed" });
    return updateInquiry(id, { emailStatus: "accepted", emailId: body.id });
  } catch {
    return updateInquiry(id, { emailStatus: "failed" });
  }
}
