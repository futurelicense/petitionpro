"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { loadIdeas, type IdeaAction } from "@/lib/ideas";
import { requestsForCase, type CaseRequest } from "@/lib/requests";

export function CaseFileExtras({ caseId }: { caseId: string }) {
  const [requests, setRequests] = useState<CaseRequest[]>([]);
  const [readings, setReadings] = useState<Array<{ title: string; action: IdeaAction }>>([]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setRequests(requestsForCase(caseId));
      setReadings(
        loadIdeas().flatMap((idea) =>
          idea.actions.filter((action) => action.caseId === caseId).map((action) => ({ title: idea.title, action }))
        )
      );
    });
    return () => { cancelled = true; };
  }, [caseId]);

  return (
    <section className="panel">
      <h2>Idea bank and Request Tank</h2>
      <p className="note">Research used on this file, and acts sitting on this case’s timeline.</p>
      <h3 className="quiet">Readings</h3>
      {readings.length === 0 && (
        <p className="small">
          No note has been used on this case. <Link href="/ideas">Open the idea bank</Link>
        </p>
      )}
      {readings.map(({ title, action }) => (
        <article className="card" key={action.id}>
          <b>{title}</b>
          <p className="small">{action.createdAt.slice(0, 10)}</p>
          <p><strong>Insight. </strong>{action.insight}</p>
          <p><strong>Recommendation. </strong>{action.recommendation}</p>
          <p><strong>Suggestion. </strong>{action.suggestion}</p>
        </article>
      ))}
      <h3 className="quiet">Acts</h3>
      {requests.length === 0 && (
        <p className="small">
          No act is on the timeline. <Link href={`/requests?case=${caseId}`}>Open Request Tank</Link>
        </p>
      )}
      {requests.map((item) => (
        <article className="card" key={item.id}>
          <b>{item.status === "done" ? "Done" : item.status === "underway" ? "Underway" : "Open"}</b>
          <h3>{item.act}</h3>
          <p className="small">
            Opened {item.openedOn} · due {item.dueOn}
            {item.doneOn ? ` · done ${item.doneOn}` : ""}
          </p>
        </article>
      ))}
      <div className="actions">
        <Link className="btn ghost" href="/ideas">Idea bank</Link>
        <Link className="btn ghost" href={`/requests?case=${caseId}`}>Request Tank</Link>
      </div>
    </section>
  );
}
