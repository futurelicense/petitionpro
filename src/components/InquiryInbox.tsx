"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Brand } from "@/components/Brand";
import { caseFromInquiry } from "@/lib/inquiry-case";
import { loadCases, upsertCase } from "@/lib/cases";
import type { Inquiry, InquiryStatus } from "@/lib/inquiry-types";

const emailLabels = { pending: "Email pending", "not-configured": "Email setup needed", failed: "Email needs retry", accepted: "Email accepted by provider" };

export function InquiryInbox() {
  const router = useRouter();
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [filter, setFilter] = useState<"all" | InquiryStatus>("all");
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/inquiries", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load inquiries.");
      setInquiries(data.inquiries); setError(null); setLoaded(true);
    } catch (error) { setError(error instanceof Error ? error.message : "Could not load inquiries."); }
  }, []);
  useEffect(() => {
    queueMicrotask(() => void refresh());
    const timer = setInterval(() => void refresh(), 60_000);
    const focus = () => void refresh();
    window.addEventListener("focus", focus);
    return () => { clearInterval(timer); window.removeEventListener("focus", focus); };
  }, [refresh]);

  async function update(inquiry: Inquiry, action: "reviewed" | "case" | "notify") {
    setBusyId(inquiry.id); setError(null);
    try {
      if (action === "case") {
        const matter = caseFromInquiry(inquiry, loadCases());
        upsertCase(matter);
      }
      const response = await fetch(`/api/admin/inquiries/${inquiry.id}${action === "notify" ? "/notify" : ""}`, {
        method: action === "notify" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        ...(action !== "notify" ? { body: JSON.stringify({ status: action === "case" ? "converted" : "reviewed" }) } : {}),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not update inquiry.");
      setInquiries((current) => current.map((item) => item.id === inquiry.id ? data.inquiry : item));
      if (action === "case") router.push(`/cases/${inquiry.id}`);
    } catch (error) { setError(error instanceof Error ? error.message : "Could not update inquiry."); }
    finally { setBusyId(""); }
  }

  return <main className="shell wide">
    <Brand lede="Consultant inquiries — generated endeavors, CVs, and assessment results shared by prospective clients." />
    <section className="panel"><div className="board-heading"><div><p className="kicker ink">Admin inbox</p><h2>{inquiries.filter((item) => item.status === "new").length} new inquiries</h2></div><button className="btn ghost" type="button" onClick={() => void refresh()}>Refresh</button></div>
      <p className="note">These submissions are stored on the server. Starting a case imports the materials into this browser’s case workflow.</p>
      <div className="views" role="group" aria-label="Inquiry status">
        {(["all", "new", "reviewed", "converted"] as const).map((value) => <button key={value} type="button" data-on={filter === value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{value}</button>)}
      </div>
      {error && <p className="err" role="alert">{error}</p>}
      {!loaded && !error && <p className="small">Loading inquiries…</p>}
      {loaded && inquiries.filter((item) => filter === "all" || item.status === filter).length === 0 && <p className="empty">No inquiries in this view.</p>}
      {inquiries.filter((item) => filter === "all" || item.status === filter).map((inquiry) => <article className="card inquiry-card" key={inquiry.id} id={inquiry.id}>
        <div className="board-heading"><div><span className={inquiry.status === "new" ? "tag ok" : "tag"}>{inquiry.status}</span><h3>{inquiry.name}</h3></div><span className={inquiry.emailStatus === "accepted" ? "tag ok" : "tag no"}>{emailLabels[inquiry.emailStatus]}</span></div>
        <p className="small"><a href={`mailto:${inquiry.email}`}>{inquiry.email}</a>{inquiry.phone ? ` · ${inquiry.phone}` : ""} · {new Date(inquiry.createdAt).toLocaleString()}</p>
        <p className="draft">{inquiry.endeavor}</p>
        {inquiry.message && <p>{inquiry.message}</p>}
        <details><summary>Generated assessment and CV text</summary><pre className="assessment-report">{inquiry.report}</pre><h4>CV text</h4><pre className="assessment-report">{inquiry.cvText}</pre></details>
        <p className="small">Consent to share recorded {new Date(inquiry.consentAt).toLocaleString()}.</p>
        <div className="actions">
          <a className="btn ghost" href={`/api/admin/inquiries/${inquiry.id}/cv`}>Download CV · {inquiry.cvFileName}</a>
          <button className="btn" type="button" disabled={Boolean(busyId)} onClick={() => void update(inquiry, "case")}>{inquiry.status === "converted" ? "Open or import case" : "Start client case"}</button>
          {inquiry.status === "new" && <button className="btn ghost" type="button" disabled={Boolean(busyId)} onClick={() => void update(inquiry, "reviewed")}>Mark reviewed</button>}
          {inquiry.emailStatus !== "accepted" && <button className="btn ghost" type="button" disabled={Boolean(busyId)} onClick={() => void update(inquiry, "notify")}>{busyId === inquiry.id ? "Updating…" : "Retry email notification"}</button>}
        </div>
      </article>)}
    </section>
  </main>;
}
