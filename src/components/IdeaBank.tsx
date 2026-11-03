"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Brand } from "@/components/Brand";
import { DISCLAIMER } from "@/lib/disclaimer";
import { loadCases, type ClientCase } from "@/lib/cases";
import {
  caseBrief,
  createIdea,
  loadIdeas,
  saveIdeas,
  type Idea,
  type IdeaAction,
} from "@/lib/ideas";

export function IdeaBank() {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [cases, setCases] = useState<ClientCase[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [title, setTitle] = useState("");
  const [source, setSource] = useState("");
  const [note, setNote] = useState("");
  const [caseByIdea, setCaseByIdea] = useState<Record<string, string>>({});
  const [busyIds, setBusyIds] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setIdeas(loadIdeas());
      setCases(loadCases());
      setHydrated(true);
    });
    return () => { cancelled = true; };
  }, []);

  function persist(change: (current: Idea[]) => Idea[]): boolean {
    try {
      const next = change(loadIdeas());
      saveIdeas(next);
      setIdeas(next);
      return true;
    } catch {
      setError("This browser could not store the update.");
      return false;
    }
  }

  function addIdea() {
    if (title.trim().length < 3 || note.trim().length < 12) {
      setError("Add a title and a note of at least a sentence.");
      return;
    }
    if (!persist((current) => [createIdea({ title, source, note }), ...current])) return;
    setTitle("");
    setSource("");
    setNote("");
    setError(null);
  }

  async function readOnCase(idea: Idea) {
    const caseId = caseByIdea[idea.id] || "";
    const matter = cases.find((item) => item.id === caseId);
    if (!matter) {
      setError("Choose the case this note should be read against.");
      return;
    }
    setBusyIds((current) => ({ ...current, [idea.id]: true }));
    setError(null);
    try {
      const response = await fetch("/api/idea-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: `${idea.title}\n${idea.note}`, brief: caseBrief(matter) }),
      });
      const data = (await response.json().catch(() => null)) as
        | { insight?: string; recommendation?: string; suggestion?: string; error?: string }
        | null;
      if (!response.ok || !data?.insight || !data.recommendation || !data.suggestion) {
        setError(data?.error || "The reading did not come back.");
        return;
      }
      const action: IdeaAction = {
        id: crypto.randomUUID(),
        caseId: matter.id,
        caseName: matter.name,
        createdAt: new Date().toISOString(),
        insight: data.insight,
        recommendation: data.recommendation,
        suggestion: data.suggestion,
      };
      persist((current) => current.map((item) => (item.id === idea.id ? { ...item, actions: [action, ...item.actions] } : item)));
    } catch {
      setError("The reading did not come back.");
    } finally {
      setBusyIds((current) => ({ ...current, [idea.id]: false }));
    }
  }

  return (
    <main className="shell wide">
      <Brand lede="Keep USCIS updates, research, and ideas here. Use a note on a case when you want an insight, a recommendation, and a suggestion for that file." />
      <section className="panel">
        <h2>Add to the bank</h2>
        <p className="note">A note is research you may want later. It is not applied to a client until you use it on a case.</p>
        <label className="field">
          Title
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="What the update or idea is about" />
        </label>
        <label className="field">
          Source
          <input value={source} onChange={(event) => setSource(event.target.value)} placeholder="Policy manual page, article, or memo" />
        </label>
        <label className="field">
          Note
          <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="The research, in your own words" />
        </label>
        {error && <p className="err">{error}</p>}
        <div className="actions">
          <button className="btn" type="button" disabled={!hydrated} onClick={addIdea}>
            Save note
          </button>
        </div>
      </section>

      <section className="stack">
        <h2 className="section-title">Notes</h2>
        {hydrated && ideas.length === 0 && <p className="empty">Nothing in the bank yet.</p>}
        {ideas.map((idea) => (
          <article className="card" key={idea.id}>
            <b>{idea.createdAt.slice(0, 10)}</b>
            <h3>{idea.title}</h3>
            {idea.source && <p className="small">{idea.source}</p>}
            <p>{idea.note}</p>
            <div className="row2" style={{ marginTop: "0.8rem" }}>
              <label className="field">
                Use on a case
                <select
                  value={caseByIdea[idea.id] || ""}
                  onChange={(event) => setCaseByIdea((current) => ({ ...current, [idea.id]: event.target.value }))}
                >
                  <option value="">Choose a case</option>
                  {cases.map((matter) => (
                    <option key={matter.id} value={matter.id}>
                      {matter.name}
                      {matter.matterRef ? ` · ${matter.matterRef}` : ""}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="actions">
              <button className="btn" type="button" disabled={busyIds[idea.id]} onClick={() => void readOnCase(idea)}>
                {busyIds[idea.id] ? "Reading the file…" : "Use on this case"}
              </button>
              <button className="btn danger" type="button" onClick={() => persist((current) => current.filter((item) => item.id !== idea.id))}>
                Remove note
              </button>
            </div>
            {idea.actions.map((action) => (
              <div className="reading" key={action.id}>
                <p className="small">
                  <Link href={`/cases/${action.caseId}`}>{action.caseName}</Link>
                  {` · ${action.createdAt.slice(0, 10)}`}
                </p>
                <article>
                  <b>Insight</b>
                  <p>{action.insight}</p>
                </article>
                <article>
                  <b>Recommendation</b>
                  <p>{action.recommendation}</p>
                </article>
                <article>
                  <b>Suggestion</b>
                  <p>{action.suggestion}</p>
                </article>
                <p className="small">Drafting aid. Not a finding that the client qualifies or that USCIS will approve.</p>
              </div>
            ))}
          </article>
        ))}
      </section>
      <footer className="disclaimer">{DISCLAIMER}</footer>
    </main>
  );
}
