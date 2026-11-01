"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Brand } from "@/components/Brand";
import { DISCLAIMER } from "@/lib/disclaimer";
import {
  checklistCounts,
  createCase,
  loadCases,
  nextReviewDate,
  pathwayLabel,
  reviewStatus,
  saveCases,
  stageLabel,
  type ClientCase,
} from "@/lib/cases";

export function CaseBoard() {
  const router = useRouter();
  const [cases, setCases] = useState<ClientCase[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [matterRef, setMatterRef] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCases(loadCases());
    setHydrated(true);
  }, []);

  const ordered = useMemo(() => {
    const rank = { due: 0, open: 1, scheduled: 2, unset: 3 };
    return [...cases].sort((a, b) => {
      const byStatus = rank[reviewStatus(a)] - rank[reviewStatus(b)];
      if (byStatus !== 0) return byStatus;
      return nextReviewDate(a).localeCompare(nextReviewDate(b)) || a.name.localeCompare(b.name);
    });
  }, [cases]);

  function addClient() {
    if (name.trim().length < 2) {
      setError("Enter the client name.");
      return;
    }
    const matter = createCase({ name, email, phone, matterRef });
    const next = [matter, ...cases];
    try {
      saveCases(next);
    } catch {
      setError("This browser could not store the case.");
      return;
    }
    setCases(next);
    router.push(`/cases/${matter.id}`);
  }

  return (
    <main className="shell wide">
      <Brand lede="Add a client and open the same case for each review period. Profile evaluation leads to the endeavor, the pathway, the CV, and well positioning. A checklist item is complete when its lines are ticked." />

      <section className="panel">
        <h2>Add a client</h2>
        <p className="note">
          This opens Period 1 at profile evaluation. The documentary-evidence
          milestones load with the case. Patents, independent media, and judging
          start as optional.
        </p>
        <div className="row2">
          <label className="field">
            Client name
            <input value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label className="field">
            Matter reference
            <input value={matterRef} onChange={(event) => setMatterRef(event.target.value)} placeholder="Internal file number" />
          </label>
          <label className="field">
            Email
            <input value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label className="field">
            Phone
            <input value={phone} onChange={(event) => setPhone(event.target.value)} />
          </label>
        </div>
        {error && <p className="err">{error}</p>}
        <div className="actions">
          <button className="btn" type="button" disabled={!hydrated} onClick={addClient}>
            Open case
          </button>
        </div>
      </section>

      <section className="stack">
        <h2 className="section-title">Open cases</h2>
        {hydrated && ordered.length === 0 && (
          <p className="empty">No clients yet. A case appears here after you open one.</p>
        )}
        {ordered.map((matter) => {
          const counts = checklistCounts(matter);
          const status = reviewStatus(matter);
          const review = nextReviewDate(matter);
          return (
            <a key={matter.id} className="card" href={`/cases/${matter.id}`}>
              <h3>{matter.name}</h3>
              <p className="small">
                {matter.matterRef || "No matter reference"} · {stageLabel(matter.stage)} · {pathwayLabel(matter.pathway, matter.activePathway)}
              </p>
              <p style={{ margin: "0.55rem 0 0" }}>
                <span className={status === "due" ? "tag no" : status === "open" ? "tag ok" : "tag"}>
                  {status === "due" ? "Review due" : status === "open" ? "Period open" : status === "scheduled" ? "Scheduled" : "No review date"}
                </span>
                <span className="small">
                  {review ? `Next review ${review}` : "Set the next review when you close the period"}
                  {counts.requiredTotal > 0 ? ` · Required complete ${counts.requiredMet} of ${counts.requiredTotal}` : ""}
                  {matter.readyForDraft ? " · Ready for petition draft" : ""}
                </span>
              </p>
            </a>
          );
        })}
      </section>
      <footer className="disclaimer">{DISCLAIMER}</footer>
    </main>
  );
}
