"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import type { Intake } from "@/lib/types";

export function AssessmentNextSteps({ endeavor, report, cvText, cvFile, originalFileName, intake, nationalImportance }: {
  endeavor: string; report: string; cvText: string; cvFile: File | null; originalFileName: string; intake: Intake; nationalImportance: string;
}) {
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState("");
  const submissionId = useRef("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || receipt) return;
    const form = new FormData(event.currentTarget);
    if (!submissionId.current) submissionId.current = crypto.randomUUID();
    form.set("submissionId", submissionId.current);
    form.set("endeavor", endeavor); form.set("report", report); form.set("cvText", cvText);
    form.set("nationalImportance", nationalImportance);
    form.set("mechanism", intake.mechanism); form.set("beneficiaries", intake.beneficiaries);
    form.set("originalFileRequired", originalFileName ? "yes" : "no");
    if (cvFile) form.set("cv", cvFile);
    setBusy(true); setError(null);
    try {
      const response = await fetch("/api/inquiries", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not submit your inquiry.");
      setReceipt(data.id);
    } catch (error) { setError(error instanceof Error ? error.message : "Could not submit your inquiry."); }
    finally { setBusy(false); }
  }

  return <section className="panel assessment-next">
    <p className="kicker ink">Your next step</p><h2>Continue your way</h2>
    <div className="row2">
      <article className="next-step-card"><b>Do it yourself</b><h3>Build your evidence plan</h3><p>Keep your results and work through a guided checklist at your own pace. Your DIY workspace stays in this browser.</p><Link className="btn ghost" href="/diy">Continue with DIY</Link></article>
      <article className="next-step-card"><b>Consultant support</b><h3>Ask the team to review</h3><p>Share your proposed endeavor, assessment, and CV so a consultant can follow up and help you start a case.</p><button className="btn" type="button" onClick={() => setShowForm(true)}>Engage a consultant</button></article>
    </div>
    {receipt ? <div className="inquiry-success" role="status"><h3>Inquiry received</h3><p>Your assessment and CV are in the team’s review inbox. They can contact you using the details you provided.</p><p className="small">Reference: {receipt}</p></div> : showForm && <form className="consultant-form" onSubmit={submit}>
      <h3>Send your assessment for review</h3>
      <fieldset disabled={busy}>
        <div className="row2">
          <label className="field">Full name<input name="name" autoComplete="name" minLength={2} maxLength={120} required /></label>
          <label className="field">Email address<input name="email" type="email" autoComplete="email" maxLength={254} required /></label>
        </div>
        <label className="field">Phone (optional)<input name="phone" type="tel" autoComplete="tel" maxLength={80} /></label>
        <label className="field">What would you like help with?<textarea name="message" maxLength={3000} /></label>
        {cvFile ? <p className="small">CV to share: {cvFile.name}</p> : originalFileName ? <label className="field">Reattach your CV ({originalFileName})<input name="cv" type="file" accept=".pdf,.docx,.txt,.md" required /><span className="small">The original file is needed after a page reload. Your generated results are already included.</span></label> : <p className="small">A text copy of the CV you pasted will be included.</p>}
        <label className="tick"><input name="consent" value="yes" type="checkbox" required /><span>I agree to share my contact details, proposed endeavor, generated assessment, and CV with the PetitionPro team for consultant review and follow-up.</span></label>
        {error && <p className="err" role="alert">{error}</p>}
        <div className="actions"><button className="btn" type="submit">{busy ? "Sending…" : "Send inquiry and CV"}</button><button className="btn ghost" type="button" onClick={() => setShowForm(false)}>Cancel</button></div>
      </fieldset>
    </form>}
  </section>;
}
