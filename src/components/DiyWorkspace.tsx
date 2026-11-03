"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PublicBrand } from "@/components/PublicBrand";
import { DIY_STORAGE, FREE_STUDIO_STORAGE } from "@/lib/inquiry-types";
import type { FitResult, SkeletonsResult } from "@/lib/types";

type Snapshot = { skeletons?: SkeletonsResult; fit?: FitResult; cvText?: string };

export function DiyWorkspace() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [completed, setCompleted] = useState<Record<string, boolean>>({});
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [source, setSource] = useState("");
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      try {
        const assessment = JSON.parse(localStorage.getItem(FREE_STUDIO_STORAGE) || "null") as Snapshot | null;
        if (assessment?.skeletons) {
          const key = JSON.stringify([assessment.skeletons.chosenSentence, assessment.cvText]);
          const saved = JSON.parse(localStorage.getItem(DIY_STORAGE) || "null");
          setSnapshot(assessment); setSource(key);
          if (saved?.source === key) setCompleted(saved.completed || {});
        }
      } catch { setError("Could not restore this browser’s assessment."); }
      setLoaded(true);
    });
    return () => { cancelled = true; };
  }, []);
  const gaps = [...new Set([...(snapshot?.skeletons?.gaps || []), ...(snapshot?.fit?.missingExhibits || [])])];
  const items = ["Review your proposed endeavor for accuracy", "Check every draft claim against the original CV", "Collect independent sources for the endeavor’s prospective impact", ...gaps.map((gap) => `Address evidence gap: ${gap}`)];
  const done = items.filter((item) => completed[item]).length;
  function toggle(item: string, checked: boolean) {
    const next = { ...completed, [item]: checked };
    try { localStorage.setItem(DIY_STORAGE, JSON.stringify({ source, completed: next })); setCompleted(next); setError(""); }
    catch { setError("Could not save your checklist in this browser."); }
  }
  return <main className="shell"><PublicBrand lede="Your DIY workspace — turn your assessment into an evidence plan at your own pace." />
    <section className="panel"><h2>Your next steps</h2>{error && <p className="err">{error}</p>}
      {!loaded ? <p className="small">Loading your assessment…</p> : !snapshot?.skeletons ? <><p>Complete the free assessment first to build a checklist from your result.</p><Link className="btn" href="/">Start free assessment</Link></> : <>
        <p className="draft">{snapshot.skeletons.chosenSentence}</p><p className="note">{done} of {items.length} planning steps checked. Your checklist stays in this browser; it has not been sent to consultants.</p>
        {items.map((item) => <label className="tick" key={item}><input type="checkbox" checked={Boolean(completed[item])} onChange={(event) => toggle(item, event.target.checked)} /><span>{item}</span></label>)}
        <details><summary>Review your drafts</summary><h3>Well positioning</h3>{snapshot.skeletons.wellPositioning.paragraphs.map((text, index) => <p key={index}>{text}</p>)}<h3>National importance</h3>{snapshot.skeletons.nationalImportance.paragraphs.map((text, index) => <p key={index}>{text}</p>)}</details>
        <div className="actions"><Link className="btn ghost" href="/">Return to results or request a consultant</Link></div>
      </>}
    </section>
  </main>;
}
