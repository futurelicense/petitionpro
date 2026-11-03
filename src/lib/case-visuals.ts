import { caseStage, STAGES, nextReviewDate, openPeriod, reviewStatus, todayISO, applicableMilestones, milestoneState, type ClientCase, type Period } from "./cases";

export function requiredProgress(matter: ClientCase) {
  const items = applicableMilestones(matter).filter((item) => !item.optional);
  const complete = items.filter((item) => milestoneState(item) === "in-file").length;
  const partial = items.filter((item) => milestoneState(item) === "partial").length;
  return { items, complete, partial, missing: items.length - complete - partial,
    total: items.length, percent: items.length ? Math.round(complete / items.length * 100) : 0 };
}

const DAY = 86_400_000;
function day(value: string) {
  return Date.parse(`${value.slice(0, 10)}T00:00:00Z`);
}

/** Calendar-day widths, with a one-day minimum for periods opened and closed together. */
export function periodTimeline(periods: Period[], today: string) {
  const now = day(today);
  const valid = periods.filter((period) => Number.isFinite(day(period.openedAt)));
  if (!valid.length || !Number.isFinite(now)) return null;
  const start = Math.min(...valid.map((period) => day(period.openedAt)));
  const end = Math.max(now, ...valid.flatMap((period) => [
    day(period.openedAt), day(period.closedAt || today), day(period.nextReview || today),
  ]).filter(Number.isFinite));
  const span = Math.max(DAY, end - start + DAY);
  return {
    start: new Date(start).toISOString().slice(0, 10),
    end: new Date(end).toISOString().slice(0, 10),
    todayPosition: Math.max(0, Math.min(100, (now - start + DAY / 2) / span * 100)),
    rows: [...valid].sort((a, b) => day(a.openedAt) - day(b.openedAt)).map((period) => {
      const opened = day(period.openedAt);
      const closed = day(period.closedAt || today);
      const through = Number.isFinite(closed) ? Math.max(opened, closed) : opened;
      return {
        period,
        days: Math.round((through - opened) / DAY) + 1,
        left: (opened - start) / span * 100,
        width: Math.max(DAY, through - opened + DAY) / span * 100,
        reviewPosition: period.nextReview && Number.isFinite(day(period.nextReview))
          ? (day(period.nextReview) - start + DAY / 2) / span * 100 : null,
      };
    }),
  };
}

export type CaseFilter = "all" | "due" | "ready";

export function caseDashboard(cases: ClientCase[], query = "", filter: CaseFilter = "all", today = todayISO()) {
  const rank = { due: 0, open: 1, scheduled: 2, unset: 3 };
  const search = query.trim().toLowerCase();
  const visible = cases.filter((matter) => {
    const matchesSearch = !search || [matter.name, matter.matterRef, matter.email]
      .some((value) => (value || "").toLowerCase().includes(search));
    return matchesSearch && (filter === "all" || (filter === "due" ? reviewStatus(matter, today) === "due" : matter.readyForDraft));
  }).sort((a, b) => rank[reviewStatus(a, today)] - rank[reviewStatus(b, today)] ||
    nextReviewDate(a).localeCompare(nextReviewDate(b)) || a.name.localeCompare(b.name));
  return {
    total: cases.length,
    due: cases.filter((matter) => reviewStatus(matter, today) === "due").length,
    active: cases.filter((matter) => Boolean(openPeriod(matter))).length,
    ready: cases.filter((matter) => matter.readyForDraft).length,
    visible: visible.length,
    columns: STAGES.map((stage) => ({ ...stage, cases: visible.filter((matter) => caseStage(matter.stage) === stage.id) })),
  };
}
