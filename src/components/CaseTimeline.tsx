"use client";

import { useEffect, useState } from "react";
import { periodTimeline } from "@/lib/case-visuals";
import { nextReviewDate, openPeriod, stageLabel, todayISO, type ClientCase } from "@/lib/cases";

export function CaseTimeline({ matter }: { matter: ClientCase }) {
  const [today, setToday] = useState(() => todayISO());
  useEffect(() => {
    const timer = setInterval(() => setToday(todayISO()), 60_000);
    return () => clearInterval(timer);
  }, []);
  const timeline = periodTimeline(matter.periods, today);
  if (!timeline) return null;
  const active = openPeriod(matter);
  const nextReview = nextReviewDate(matter);
  return (
    <section className="case-timeline" aria-label="Case review timeline">
      <div className="timeline-heading">
        <div><p className="kicker ink">Review timeline</p><h2>{active ? `Period ${active.number} in progress` : "Between review periods"}</h2></div>
        <span className={`tag${active ? " ok" : nextReview && nextReview <= today ? " no" : ""}`}>
          {active ? "Active" : nextReview ? `${nextReview <= today ? "Review due" : "Next review"} ${nextReview}` : "No review scheduled"}
        </span>
      </div>
      <div className="period-axis"><span>{timeline.start}</span><span>{timeline.end}</span></div>
      <div className="period-chart">
        {timeline.rows.map(({ period, days, left, width, reviewPosition }) => (
          <details className="period-row" key={period.id}>
            <summary>
              <span className="period-row-label">Period {period.number}<small>{period.closedAt ? "Completed" : "Open"} · {days} {days === 1 ? "day" : "days"}</small></span>
              <span className="period-lane">
                <span className="period-duration" data-open={!period.closedAt} style={{ left: `${left}%`, width: `${width}%` }} />
                <span className="period-today" style={{ left: `${timeline.todayPosition}%` }} />
                {reviewPosition !== null && <span className="period-review" style={{ left: `${reviewPosition}%` }} title={`Review ${period.nextReview}`} />}
              </span>
              <span className="period-row-date">{period.openedAt.slice(0, 10)} → {period.closedAt?.slice(0, 10) || "Today"}</span>
            </summary>
            <div className="period-detail">
              <p className="small">Opened {period.openedAt.slice(0, 10)} at {stageLabel(period.stageAtOpen)} · {period.closedAt ? `Closed ${period.closedAt.slice(0, 10)}` : "Currently open"}{period.nextReview ? ` · Next review ${period.nextReview}` : ""}</p>
              {period.summary && <p className="small">{period.summary}</p>}
              {period.note && <p>{period.note}</p>}
              {!period.closedAt && <p className="small">This period is open for updates. Its summary is recorded when the period is closed.</p>}
            </div>
          </details>
        ))}
      </div>
      <p className="small timeline-key"><span className="today-key" /> Today <span className="review-key" /> Review date <span>Bar length shows calendar days. Select a period for details.</span></p>
    </section>
  );
}
