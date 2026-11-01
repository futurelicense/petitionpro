"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Brand } from "@/components/Brand";
import { loadCases, todayISO, type ClientCase } from "@/lib/cases";
import { DISCLAIMER } from "@/lib/disclaimer";
import {
  advanceRequest,
  createRequest,
  loadRequests,
  requestOverdue,
  saveRequests,
  sortRequests,
  type CaseRequest,
  type RequestStatus,
} from "@/lib/requests";

export function RequestTank({ initialCaseId = "" }: { initialCaseId?: string }) {
  const [items, setItems] = useState<CaseRequest[]>([]);
  const [cases, setCases] = useState<ClientCase[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [caseId, setCaseId] = useState(initialCaseId);
  const [act, setAct] = useState("");
  const [detail, setDetail] = useState("");
  const [openedOn, setOpenedOn] = useState("");
  const [dueOn, setDueOn] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setItems(loadRequests());
    setCases(loadCases());
    setOpenedOn((current) => current || todayISO());
    setHydrated(true);
  }, []);

  const ordered = useMemo(() => sortRequests(items), [items]);

  function persist(next: CaseRequest[]) {
    setItems(next);
    saveRequests(next);
  }

  function addRequest() {
    const matter = cases.find((item) => item.id === caseId);
    if (!matter || act.trim().length < 3 || !openedOn || !dueOn) {
      setError("Choose a case, name the act, and set the opened and due dates.");
      return;
    }
    persist([
      createRequest({ caseId: matter.id, caseName: matter.name, act, detail, openedOn, dueOn }),
      ...items,
    ]);
    setAct("");
    setDetail("");
    setDueOn("");
    setError(null);
  }

  function setStatus(item: CaseRequest, status: RequestStatus) {
    persist(items.map((current) => (current.id === item.id ? advanceRequest(current, status) : current)));
  }

  return (
    <main className="shell wide">
      <Brand lede="Put an act for a case on a timeline. Move it from opened, to underway, to done." />
      <section className="panel">
        <h2>Add an act</h2>
        <p className="note">The timeline is the life of this act: when it opened, when it is due, and when it is done.</p>
        <label className="field">
          Case
          <select value={caseId} onChange={(event) => setCaseId(event.target.value)}>
            <option value="">Choose a case</option>
            {cases.map((matter) => (
              <option key={matter.id} value={matter.id}>
                {matter.name}
                {matter.matterRef ? ` · ${matter.matterRef}` : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          The act
          <input value={act} onChange={(event) => setAct(event.target.value)} placeholder="What has to get done" />
        </label>
        <label className="field">
          Note
          <textarea className="short" value={detail} onChange={(event) => setDetail(event.target.value)} placeholder="Who is doing it, or what done looks like" />
        </label>
        <div className="row2">
          <label className="field">
            Opened
            <input type="date" value={openedOn} onChange={(event) => setOpenedOn(event.target.value)} />
          </label>
          <label className="field">
            Due
            <input type="date" value={dueOn} onChange={(event) => setDueOn(event.target.value)} />
          </label>
        </div>
        {error && <p className="err">{error}</p>}
        <div className="actions">
          <button className="btn" type="button" disabled={!hydrated} onClick={addRequest}>
            Put on the timeline
          </button>
        </div>
      </section>

      <section className="stack">
        <h2 className="section-title">Timeline</h2>
        {hydrated && ordered.length === 0 && <p className="empty">No acts on the timeline yet.</p>}
        {ordered.map((item) => (
          <article className="card" key={item.id}>
            <b>
              <Link href={`/cases/${item.caseId}`}>{item.caseName}</Link>
            </b>
            <h3>{item.act}</h3>
            {item.detail && <p className="small">{item.detail}</p>}
            <p>
              <span className={item.status === "done" ? "tag ok" : requestOverdue(item) ? "tag no" : "tag"}>
                {item.status === "done" ? "Done" : requestOverdue(item) ? "Overdue" : item.status === "underway" ? "Underway" : "Open"}
              </span>
            </p>
            <ol className="timeline">
              <li data-on="true">
                <b>Opened</b>
                <span>{item.openedOn}</span>
              </li>
              <li data-on={item.dueOn <= todayISO() || item.status === "done" ? "true" : "false"}>
                <b>Due</b>
                <span>{item.dueOn}</span>
              </li>
              <li data-on={item.status === "done" ? "true" : "false"}>
                <b>Done</b>
                <span>{item.doneOn || "Not yet"}</span>
              </li>
            </ol>
            <div className="actions">
              {item.status === "open" && (
                <button className="btn ghost" type="button" onClick={() => setStatus(item, "underway")}>
                  Mark underway
                </button>
              )}
              {item.status !== "done" && (
                <button className="btn" type="button" onClick={() => setStatus(item, "done")}>
                  Mark done
                </button>
              )}
              {item.status !== "open" && (
                <button className="btn ghost" type="button" onClick={() => setStatus(item, "open")}>
                  Reopen
                </button>
              )}
              <button
                className="btn danger"
                type="button"
                onClick={() => persist(items.filter((current) => current.id !== item.id))}
              >
                Remove act
              </button>
            </div>
          </article>
        ))}
      </section>
      <footer className="disclaimer">{DISCLAIMER}</footer>
    </main>
  );
}
