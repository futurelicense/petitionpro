"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Brand } from "@/components/Brand";
import { CaseFileExtras } from "@/components/CaseFileExtras";
import { DISCLAIMER } from "@/lib/disclaimer";
import {
  GROUPS,
  STAGES,
  advanceStage,
  applicableMilestones,
  checkCvQuotes,
  checklistCounts,
  closePeriod,
  cvOnFile,
  endeavorReady,
  loadCases,
  lineDone,
  milestoneState,
  openPeriod,
  pathwayLabel,
  pathwayReady,
  positioningReady,
  profileReady,
  removeCase,
  stageLabel,
  stageReady,
  startPeriod,
  stateLabel,
  touch,
  upsertCase,
  workingPathway,
  type ClientCase,
  type Milestone,
  type Rating,
  type StageId,
} from "@/lib/cases";

export function CaseWorkspace({ id }: { id: string }) {
  const router = useRouter();
  const [matter, setMatter] = useState<ClientCase | null>(null);
  const [missing, setMissing] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [view, setView] = useState<StageId>("profile");
  const [note, setNote] = useState("");
  const [nextReview, setNextReview] = useState("");
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const found = loadCases().find((item) => item.id === id) ?? null;
    setMatter(found);
    setMissing(!found);
    if (found) setView(found.stage);
    setHydrated(true);
  }, [id]);

  useEffect(() => {
    if (!hydrated || !matter) return;
    try {
      upsertCase(matter);
    } catch {
      setError("This browser could not store the update.");
    }
  }, [hydrated, matter]);

  if (!hydrated) {
    return (
      <main className="shell wide">
        <h1 className="brand">
          Petition<span>Pro</span>
        </h1>
        <p className="lede">Loading case…</p>
      </main>
    );
  }

  if (missing || !matter) {
    return (
      <main className="shell wide">
        <Brand lede="This case is not stored in this browser." />
        <div className="actions">
          <Link className="btn" href="/cases">
            Back to cases
          </Link>
        </div>
      </main>
    );
  }

  const period = openPeriod(matter);
  const editable = Boolean(period);
  const currentIndex = STAGES.findIndex((stage) => stage.id === matter.stage);
  const counts = checklistCounts(matter);
  const pathway = workingPathway(matter);
  const quotes = pathway === "eb1a" ? matter.quotesEb1a : matter.quotesEb2;

  function update(patch: Partial<ClientCase>) {
    setMatter((current) => (current ? touch({ ...current, ...patch }) : current));
    setError(null);
  }

  function saveNoteAndClose() {
    if (!matter) return;
    const next = closePeriod(matter, note, nextReview);
    if (!next) {
      setError("Write a short note and set the next review date.");
      return;
    }
    setMatter(next);
    setNote("");
    setNextReview("");
  }

  function openNext() {
    if (!matter) return;
    const next = startPeriod(matter);
    if (next) setMatter(next);
  }

  function goForward() {
    if (!matter) return;
    const next = advanceStage(matter);
    if (!next) {
      setError("Finish this stage during an open period before continuing.");
      return;
    }
    setMatter(next);
    setView(next.stage);
  }

  return (
    <main className="shell wide">
      <Brand lede={matter.name} tone="name" />
      <div className="casebody">
      <header className="filehead">
        <p className="small crumb">
          <Link href="/cases">All cases</Link>
          {matter.matterRef ? ` · ${matter.matterRef}` : ""}
          {matter.email ? ` · ${matter.email}` : ""}
          {matter.phone ? ` · ${matter.phone}` : ""}
        </p>
        <dl className="facts">
          <div>
            <dt>Period</dt>
            <dd>{period ? `${period.number} open` : "Closed"}</dd>
          </div>
          <div>
            <dt>Stage</dt>
            <dd>{stageLabel(matter.stage)}</dd>
          </div>
          <div>
            <dt>Pathway</dt>
            <dd>{pathwayLabel(matter.pathway, matter.activePathway)}</dd>
          </div>
          <div>
            <dt>Required</dt>
            <dd>{counts.requiredTotal > 0 ? `${counts.requiredMet} of ${counts.requiredTotal}` : "Not open"}</dd>
          </div>
        </dl>
        {counts.requiredTotal > 0 && (
          <div
            className="meter"
            style={{ ["--fill" as string]: `${Math.round((counts.requiredMet / counts.requiredTotal) * 100)}%` }}
          >
            <span>Required complete</span>
            <span className="meter-track" />
          </div>
        )}
        <p className="fileflags">
          <span className={matter.readyForDraft ? "tag ok" : "tag"}>
            {matter.readyForDraft ? "Ready for petition draft" : "Draft not marked ready"}
          </span>
        </p>
        {period ? (
          <div className="periodstrip">
            <p className="small">
              Period {period.number} opened {period.openedAt.slice(0, 10)} at {stageLabel(period.stageAtOpen)}.
            </p>
            <details className="periodclose">
              <summary>Close period</summary>
              <label className="field">
                What changed this period
                <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Documents added, ratings changed, endeavor revised" />
              </label>
              <label className="field">
                Next review
                <input type="date" value={nextReview} onChange={(event) => setNextReview(event.target.value)} />
              </label>
              <div className="actions">
                <button className="btn" type="button" onClick={saveNoteAndClose}>
                  Close period
                </button>
              </div>
            </details>
          </div>
        ) : (
          <section className="panel">
            <h2>Between periods</h2>
            <p className="note">The last period is closed. Start the next period before changing the file.</p>
            <div className="actions">
              <button className="btn" type="button" onClick={openNext}>
                Start next period
              </button>
            </div>
          </section>
        )}
        {error && <p className="err">{error}</p>}
      </header>

      <div className="views stagebar" role="tablist" aria-label="Case stage">
        {STAGES.map((stage, index) => (
          <button
            key={stage.id}
            type="button"
            role="tab"
            aria-selected={view === stage.id}
            data-on={view === stage.id ? "true" : "false"}
            data-reached={index <= currentIndex ? "true" : "false"}
            disabled={index > currentIndex}
            onClick={() => setView(stage.id)}
          >
            {stage.label}
          </button>
        ))}
      </div>

      {view === "profile" && (
        <section className="panel">
          <h2>Profile evaluation</h2>
          <p className="note">
            Rate the evidence already in hand. Missing is a finished rating.
            Strong and weak can change in a later period when a document is added.
          </p>
          {matter.baseline.map((line) => (
            <div className="rate" key={line.id}>
              <b>{line.label}</b>
              <div className="choices" role="group" aria-label={line.label}>
                {(
                  [
                    ["strong", "Strong"],
                    ["weak", "Weak"],
                    ["missing", "Missing"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    data-rate={value}
                    data-on={line.rating === value ? "true" : "false"}
                    disabled={!editable}
                    onClick={() =>
                      update({
                        baseline: matter.baseline.map((item) =>
                          item.id === line.id ? { ...item, rating: value as Rating } : item
                        ),
                      })
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <Advance matter={matter} view={view} editable={editable} onAdvance={goForward} />
        </section>
      )}

      {view === "endeavor" && (
        <section className="panel">
          <h2>Proposed endeavor</h2>
          <p className="note">
            Save the endeavor for an EB-2 NIW draft, the field for an EB-1A
            draft, or both. The pathway step uses the wording you save here.
          </p>
          <label className="field">
            Proposed endeavor
            <textarea
              disabled={!editable}
              value={matter.endeavorSentence}
              onChange={(event) => update({ endeavorSentence: event.target.value })}
              placeholder="The specific work, in one sentence of a few clauses"
            />
          </label>
          <div className="row2">
            <label className="field">
              Mechanism
              <textarea disabled={!editable} value={matter.mechanism} onChange={(event) => update({ mechanism: event.target.value })} />
            </label>
            <label className="field">
              U.S. beneficiaries
              <textarea disabled={!editable} value={matter.beneficiaries} onChange={(event) => update({ beneficiaries: event.target.value })} />
            </label>
          </div>
          <label className="field">
            National-importance frame
            <textarea disabled={!editable} value={matter.niFrame} onChange={(event) => update({ niFrame: event.target.value })} placeholder="Impact of this work" />
          </label>
          <label className="field">
            Field of extraordinary ability
            <input disabled={!editable} value={matter.fieldArea} onChange={(event) => update({ fieldArea: event.target.value })} />
          </label>
          <label className="field">
            Continuing work in that field, if true
            <textarea disabled={!editable} value={matter.continueWork} onChange={(event) => update({ continueWork: event.target.value })} />
          </label>
          <Advance matter={matter} view={view} editable={editable} onAdvance={goForward} />
        </section>
      )}

      {view === "pathway" && (
        <section className="panel">
          <h2>Pathway</h2>
          <p className="note">
            EB-2 NIW uses Dhanasar. EB-1A uses the ten regulatory criteria.
            Both can be stored. This period has one active checklist.
          </p>
          <div className="views" role="tablist" aria-label="Pathway">
            {(
              [
                ["eb2-niw", "EB-2 NIW"],
                ["eb1a", "EB-1A"],
                ["both", "Both drafts"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                disabled={!editable}
                data-on={matter.pathway === id ? "true" : "false"}
                onClick={() =>
                  update({
                    pathway: id,
                    activePathway: id === "both" ? matter.activePathway : id,
                  })
                }
              >
                {label}
              </button>
            ))}
          </div>
          {matter.pathway === "both" && (
            <div className="views" role="tablist" aria-label="Active checklist">
              {(
                [
                  ["eb2-niw", "EB-2 checklist"],
                  ["eb1a", "EB-1A checklist"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  disabled={!editable}
                  data-on={matter.activePathway === id ? "true" : "false"}
                  onClick={() => update({ activePathway: id })}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          {!endeavorReady(matter) && (
            <p className="note">Save an endeavor sentence or a field on the previous stage before the pathway can be confirmed.</p>
          )}
          {matter.pathway === "eb2-niw" && !pathwayReady(matter) && endeavorReady(matter) && (
            <p className="note">EB-2 NIW needs the endeavor sentence, the mechanism, and the U.S. beneficiaries.</p>
          )}
          {matter.pathway === "eb1a" && !pathwayReady(matter) && endeavorReady(matter) && (
            <p className="note">EB-1A needs the field of extraordinary ability.</p>
          )}
          {matter.pathway === "both" && !pathwayReady(matter) && (
            <p className="note">Both drafts need the endeavor wording and the field, and one checklist must be active.</p>
          )}
          <Advance matter={matter} view={view} editable={editable} onAdvance={goForward} />
        </section>
      )}

      {view === "cv" && (
        <section className="panel">
          <h2>CV profile</h2>
          <p className="note">
            Add the CV, paste any quote you want filed, then run the check. A
            quote counts when it is found in the pasted text. An empty factor
            or criterion stays a gap.
          </p>
          <label className="field">
            CV file name
            <input
              disabled={!editable}
              value={matter.cvFileName}
              onChange={(event) => update({ cvFileName: event.target.value, cvChecked: false })}
              placeholder="The file name in the client folder"
            />
          </label>
          <div className="file">
            <input
              type="file"
              accept=".pdf,.docx,.txt,.md,text/plain"
              disabled={!editable}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                const apply = (text: string) =>
                  update({ cvFileName: file.name, cvText: text || matter.cvText, cvChecked: false });
                if (file.type.startsWith("text") || /\.(txt|md)$/i.test(file.name)) {
                  void file.text().then(apply);
                } else {
                  apply(matter.cvText);
                }
              }}
            />
          </div>
          <label className="field" style={{ marginTop: "1rem" }}>
            CV text
            <textarea
              disabled={!editable}
              value={matter.cvText}
              onChange={(event) => update({ cvText: event.target.value, cvChecked: false })}
              placeholder="Paste the CV when you want quotes checked against it"
            />
          </label>
          {pathway ? (
            quotes.map((row) => (
              <label className="field" key={row.id}>
                {row.label}
                <textarea
                  className="short"
                  disabled={!editable}
                  value={row.quote}
                  onChange={(event) => {
                    const quote = event.target.value;
                    const key = pathway === "eb1a" ? "quotesEb1a" : "quotesEb2";
                    update({
                      cvChecked: false,
                      [key]: quotes.map((item) => (item.id === row.id ? { ...item, quote, inCv: false } : item)),
                    });
                  }}
                />
                <span className={row.inCv ? "tag ok" : "tag no"}>{row.inCv ? "in CV" : "not in CV"}</span>
              </label>
            ))
          ) : (
            <p className="note">Choose a pathway before filing quotes.</p>
          )}
          <div className="actions">
            <button
              className="btn ghost"
              type="button"
              disabled={!editable || !cvOnFile(matter)}
              onClick={() => setMatter(checkCvQuotes(matter))}
            >
              {matter.cvChecked ? "Quote check ran" : "Run quote check"}
            </button>
          </div>
          <Advance matter={matter} view={view} editable={editable} onAdvance={goForward} />
        </section>
      )}

      {view === "positioning" && (
        <section className="panel">
          <h2>Well positioning</h2>
          <p className="note">
            {pathway
              ? "Tick a line when that document is in the file. A milestone is complete when every line is ticked."
              : "Choose a pathway to open this checklist."}
          </p>
          {GROUPS.map((group) => {
            const rows = applicableMilestones(matter).filter((milestone) => milestone.group === group.id);
            if (!rows.length) return null;
            const settled = rows.filter((milestone) => {
              const state = milestoneState(milestone);
              return state === "in-file" || state === "waived";
            }).length;
            return (
              <div className="checkgroup" key={group.id}>
                <h3>
                  <span>{pathway === "eb1a" ? eb1aGroupLabel(group.id) : group.label}</span>
                  <small>{settled} of {rows.length}</small>
                </h3>
                {rows.map((milestone) => (
                  <MilestoneCard
                    key={milestone.id}
                    milestone={milestone}
                    editable={editable}
                    onChange={(next) =>
                      update({
                        milestones: matter.milestones.map((item) => (item.id === next.id ? next : item)),
                      })
                    }
                  />
                ))}
              </div>
            );
          })}
          <div className="actions">
            <button
              className="btn"
              type="button"
              disabled={!editable || !positioningReady(matter)}
              onClick={() => update({ readyForDraft: true })}
            >
              {matter.readyForDraft ? "Marked ready for petition draft" : "Mark ready for petition draft"}
            </button>
          </div>
          {matter.readyForDraft && (
            <div className="warn" style={{ marginTop: "1rem" }}>
              Ready for the {pathwayLabel(matter.pathway, matter.activePathway)} petition draft.
              This is a case status. It does not say the client qualifies or that USCIS will approve.
              <div className="actions">
                <Link className="btn ghost" href="/">
                  Open the studio
                </Link>
                {matter.endeavorSentence.trim() && pathway && (
                  <Link
                    className="btn ghost"
                    href={`/project?track=${pathway}&endeavor=${encodeURIComponent(pathway === "eb1a" ? matter.fieldArea : matter.endeavorSentence)}`}
                  >
                    Tailored projects
                  </Link>
                )}
              </div>
            </div>
          )}
        </section>
      )}

      <CaseFileExtras caseId={matter.id} />

      {matter.periods.some((item) => item.closedAt) && (
        <section className="panel" style={{ marginTop: "1rem" }}>
          <h2>Period history</h2>
          {[...matter.periods].reverse().filter((item) => item.closedAt).map((item) => (
            <article key={item.id} className="card">
              <b>Period {item.number}</b>
              <p className="small">
                {item.openedAt.slice(0, 10)} to {item.closedAt?.slice(0, 10)} · next review {item.nextReview}
              </p>
              <p className="small">{item.summary}</p>
              <p>{item.note}</p>
            </article>
          ))}
        </section>
      )}

      <div className="actions">
        <button
          className="btn danger"
          type="button"
          onClick={() => {
            if (!confirmRemove) {
              setConfirmRemove(true);
              return;
            }
            removeCase(matter.id);
            router.push("/cases");
          }}
        >
          {confirmRemove ? "Confirm remove client" : "Remove client"}
        </button>
      </div>
      <footer className="disclaimer">{DISCLAIMER}</footer>
      </div>
    </main>
  );
}

function Advance({
  matter,
  view,
  editable,
  onAdvance,
}: {
  matter: ClientCase;
  view: StageId;
  editable: boolean;
  onAdvance: () => void;
}) {
  if (view !== matter.stage || matter.stage === "positioning") return null;
  const ready = stageReady(matter.stage, matter);
  return (
    <div className="actions">
      <button className="btn" type="button" disabled={!editable || !ready} onClick={onAdvance}>
        Continue
      </button>
      {!ready && <p className="small">{gateCopy(matter)}</p>}
    </div>
  );
}

function eb1aGroupLabel(group: Milestone["group"]): string {
  if (group === "record") return "Regulatory criteria";
  if (group === "plan-progress") return "Work the criteria can use";
  return group;
}

function gateCopy(matter: ClientCase): string {
  if (matter.stage === "profile" && !profileReady(matter)) return "Rate every current-evidence line.";
  if (matter.stage === "endeavor" && !endeavorReady(matter)) {
    return "Save an endeavor of a few sentences, or a field of at least 8 characters.";
  }
  if (matter.stage === "pathway" && !pathwayReady(matter)) return "Choose the pathway and save the wording it uses.";
  if (matter.stage === "cv") return "Add the CV and run the quote check.";
  return "";
}

function MilestoneCard({
  milestone,
  editable,
  onChange,
}: {
  milestone: Milestone;
  editable: boolean;
  onChange: (next: Milestone) => void;
}) {
  const state = milestoneState(milestone);
  return (
    <article className="factor checkitem">
      <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", alignItems: "baseline" }}>
        <b>
          {milestone.name}
          {milestone.optional ? " · optional" : ""}
        </b>
        <span className={state === "in-file" || state === "waived" ? "tag ok" : state === "partial" ? "tag" : "tag no"}>
          {stateLabel(state)}
        </span>
      </div>
      <p className="small">{milestone.serves}</p>
      {milestone.bullets.map((bullet) => (
        <label className="tick" key={bullet.id} data-on={lineDone(bullet) ? "true" : "false"}>
          <input
            type="checkbox"
            disabled={!editable}
            checked={lineDone(bullet)}
            onChange={(event) =>
              onChange({
                ...milestone,
                waivedReason: "",
                bullets: milestone.bullets.map((item) =>
                  item.id === bullet.id ? { ...item, done: event.target.checked } : item
                ),
              })
            }
          />
          <span>{bullet.label}</span>
        </label>
      ))}
      {milestone.optional && (
        <label className="tick leave" data-on={state === "waived" ? "true" : "false"}>
          <input
            type="checkbox"
            disabled={!editable}
            checked={state === "waived"}
            onChange={(event) =>
              onChange({
                ...milestone,
                waivedReason: event.target.checked ? "Left out" : "",
                bullets: event.target.checked
                  ? milestone.bullets.map((item) => ({ ...item, done: false }))
                  : milestone.bullets,
              })
            }
          />
          <span>Leave this optional item out</span>
        </label>
      )}
    </article>
  );
}
