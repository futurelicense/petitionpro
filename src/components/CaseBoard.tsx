"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { caseDashboard, type CaseFilter } from "@/lib/case-visuals";
import { InquiryNotice } from "@/components/InquiryNotice";
import { RequiredProgress } from "@/components/RequiredProgress";
import { Brand } from "@/components/Brand";
import { DISCLAIMER } from "@/lib/disclaimer";
import {
  CASES_CHANGED_EVENT,
  CASES_STORAGE,
  createCase,
  loadCases,
  nextReviewDate,
  pathwayLabel,
  reviewStatus,
  upsertCase,
  openPeriod,
  todayISO,
  type ClientCase,
} from "@/lib/cases";

export function CaseBoard() {
  const router = useRouter();
  const boardRef = useRef<HTMLDivElement>(null);
  const [cases, setCases] = useState<ClientCase[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<CaseFilter>("all");
  const [today, setToday] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [matterRef, setMatterRef] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      if (cancelled) return;
      setCases(loadCases());
      setToday(todayISO());
      setHydrated(true);
    };
    const storageChanged = (event: StorageEvent) => {
      if (event.key === CASES_STORAGE || event.key === null) refresh();
    };
    const visibilityChanged = () => {
      if (document.visibilityState === "visible") refresh();
    };
    queueMicrotask(refresh);
    window.addEventListener(CASES_CHANGED_EVENT, refresh);
    window.addEventListener("storage", storageChanged);
    window.addEventListener("focus", refresh);
    window.addEventListener("pageshow", refresh);
    document.addEventListener("visibilitychange", visibilityChanged);
    const timer = setInterval(() => setToday(todayISO()), 60_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
      window.removeEventListener(CASES_CHANGED_EVENT, refresh);
      window.removeEventListener("storage", storageChanged);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("pageshow", refresh);
      document.removeEventListener("visibilitychange", visibilityChanged);
    };
  }, []);

  const dashboard = useMemo(() => caseDashboard(cases, query, filter, today || todayISO()), [cases, query, filter, today]);

  const firstOccupiedStage = dashboard.columns.find((column) => column.cases.length > 0)?.id;
  useEffect(() => {
    const board = boardRef.current;
    const column = board?.querySelector<HTMLElement>(`[data-stage="${firstOccupiedStage}"]`);
    if (board && column) {
      board.scrollLeft += column.getBoundingClientRect().left - board.getBoundingClientRect().left;
    }
  }, [firstOccupiedStage]);

  function showStage(stage: string) {
    const board = boardRef.current;
    const column = board?.querySelector<HTMLElement>(`[data-stage="${stage}"]`);
    if (board && column) {
      board.scrollLeft += column.getBoundingClientRect().left - board.getBoundingClientRect().left;
    }
  }

  function addClient() {
    if (name.trim().length < 2) {
      setError("Enter the client name.");
      return;
    }
    const matter = createCase({ name, email, phone, matterRef });
    try {
      upsertCase(matter);
    } catch {
      setError("This browser could not store the case.");
      return;
    }
    setCases(loadCases());
    router.push(`/cases/${matter.id}`);
  }

  return (
    <main className="shell wide dashboard-shell">
      <Brand lede="Case overview — follow every client from profile evaluation to well positioning, with review dates and evidence progress in one place." />

      <section className="dashboard-overview" aria-label="Case overview">
        <h2 className="section-title">Overview dashboard</h2>
        <InquiryNotice />
        <dl className="facts dashboard-stats">
          <div><dt>Total cases</dt><dd>{hydrated ? dashboard.total : "—"}</dd></div>
          <div data-attention={dashboard.due > 0}><dt>Reviews due</dt><dd>{hydrated ? dashboard.due : "—"}</dd></div>
          <div><dt>Active periods</dt><dd>{hydrated ? dashboard.active : "—"}</dd></div>
          <div><dt>Ready for draft</dt><dd>{hydrated ? dashboard.ready : "—"}</dd></div>
        </dl>
      </section>

      <details className="dashboard-add" open={hydrated && cases.length === 0}>
        <summary>Add a client</summary>
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
      </details>

      <section className="kanban-section">
        <div className="board-heading">
          <div><h2 className="section-title">Case workflow</h2><p className="small">{hydrated ? `${dashboard.visible} of ${dashboard.total} cases` : "Loading cases…"} · Open a card to continue its workflow.</p></div>
          <label className="field board-search">Find a client or matter
            <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, matter reference, or email" />
          </label>
        </div>
        <div className="views board-filters" role="group" aria-label="Filter cases">
          {([["all", "All cases"], ["due", "Reviews due"], ["ready", "Ready for draft"]] as const).map(([id, label]) => (
            <button key={id} type="button" aria-pressed={filter === id} data-on={filter === id} onClick={() => setFilter(id)}>{label}</button>
          ))}
        </div>
        <p className="small" role="status">{hydrated && dashboard.visible === 0 ? cases.length ? "No cases match these filters." : "No clients yet. Add a client to open the first case." : "Cases appear in their current workflow stage."}</p>
        {(query || filter !== "all") && <button className="btn ghost" type="button" onClick={() => { setQuery(""); setFilter("all"); }}>Clear search and filters</button>}
        <nav className="stage-jumps" aria-label="Jump to workflow stage">
          {dashboard.columns.map((column) => <button key={column.id} type="button" onClick={() => showStage(column.id)}>{column.label} <span>{column.cases.length}</span></button>)}
        </nav>
        <div ref={boardRef} className="kanban-scroll" tabIndex={0} role="region" aria-label="Case Kanban board, scroll horizontally to see all stages">
          <div className="kanban-board">
            {dashboard.columns.map((column, index) => (
              <section className="kanban-column" data-stage={column.id} key={column.id} aria-label={`${column.label}: ${column.cases.length} cases`}>
                <header className="kanban-column-head"><span className="column-step">{String(index + 1).padStart(2, "0")}</span><h3>{column.label}</h3><span className="column-count">{column.cases.length}</span></header>
                <div className="kanban-cards">
                  {column.cases.map((matter) => {
                    const status = reviewStatus(matter, today || todayISO());
                    const review = nextReviewDate(matter);
                    const period = openPeriod(matter);
                    return (
                      <a key={matter.id} className="card kanban-card" data-due={status === "due"} href={`/cases/${matter.id}`}>
                        <p className="small matter-reference">{matter.matterRef || "No matter reference"}</p>
                        <h4>{matter.name}</h4>
                        <p className="small">{pathwayLabel(matter.pathway, matter.activePathway)}</p>
                        <span className={status === "due" ? "tag no" : status === "open" ? "tag ok" : "tag"}>
                          {status === "due" ? "Review due" : status === "open" ? `Period ${period?.number} open` : status === "scheduled" ? "Review scheduled" : "No review date"}
                        </span>
                        <p className="small">{period ? `Opened ${period.openedAt.slice(0, 10)}` : review ? `Review ${review}` : "Set the next review in the case"}</p>
                        <RequiredProgress matter={matter} compact />
                        {matter.readyForDraft && <p className="draft-ready-label">Ready for petition draft</p>}
                      </a>
                    );
                  })}
                  {column.cases.length === 0 && <p className="column-empty">No cases in this stage</p>}
                </div>
              </section>
            ))}
          </div>
        </div>
      </section>
      <footer className="disclaimer">{DISCLAIMER}</footer>
    </main>
  );
}
