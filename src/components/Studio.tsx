"use client";

import { useEffect, useMemo, useState } from "react";
import { DISCLAIMER } from "@/lib/disclaimer";
import {
  emptyIntake,
  emptyRecord,
  type CvRecord,
  type EndeavorOption,
  type FitChoice,
  type FitResult,
  type Intake,
  type SkeletonsResult,
  type Step,
} from "@/lib/types";

const STEPS: { id: Step; label: string }[] = [
  { id: "disclaimer", label: "Notice" },
  { id: "intake", label: "Endeavor" },
  { id: "endeavor", label: "Options" },
  { id: "upload", label: "CV" },
  { id: "record", label: "Record" },
  { id: "fit", label: "Fit" },
  { id: "skeletons", label: "Drafts" },
];

type Persist = {
  step: Step;
  intake: Intake;
  options: EndeavorOption[];
  warnings: string[];
  selectedId: string | null;
  record: CvRecord;
  cvText: string;
  fit: FitResult | null;
  choice: FitChoice | null;
  skeletons: SkeletonsResult | null;
};

const STORAGE = "petitionpro-v1";

export function Studio() {
  const [step, setStep] = useState<Step>("disclaimer");
  const [intake, setIntake] = useState<Intake>(emptyIntake);
  const [options, setOptions] = useState<EndeavorOption[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [record, setRecord] = useState<CvRecord>(emptyRecord);
  const [cvText, setCvText] = useState("");
  const [pasteCv, setPasteCv] = useState("");
  const [fit, setFit] = useState<FitResult | null>(null);
  const [choice, setChoice] = useState<FitChoice | null>(null);
  const [skeletons, setSkeletons] = useState<SkeletonsResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const selected = options.find((o) => o.id === selectedId) ?? options[0] ?? null;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE);
      if (!raw) {
        setHydrated(true);
        return;
      }
      const data = JSON.parse(raw) as Persist;
      setStep(data.step || "disclaimer");
      setIntake(data.intake || emptyIntake());
      setOptions(data.options || []);
      setWarnings(data.warnings || []);
      setSelectedId(data.selectedId);
      setRecord(data.record || emptyRecord());
      setCvText(data.cvText || "");
      setFit(data.fit);
      setChoice(data.choice);
      setSkeletons(data.skeletons);
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const data: Persist = {
      step,
      intake,
      options,
      warnings,
      selectedId,
      record,
      cvText,
      fit,
      choice,
      skeletons,
    };
    localStorage.setItem(STORAGE, JSON.stringify(data));
  }, [
    hydrated,
    step,
    intake,
    options,
    warnings,
    selectedId,
    record,
    cvText,
    fit,
    choice,
    skeletons,
  ]);

  async function generateEndeavor() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/endeavor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(intake),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not generate endeavor.");
      setOptions(data.options);
      setWarnings(data.warnings || []);
      setSelectedId(data.options[0]?.id ?? null);
      setFit(null);
      setChoice(null);
      setSkeletons(null);
      setStep("endeavor");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not generate endeavor.");
    } finally {
      setBusy(false);
    }
  }

  async function parseCv(file?: File) {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      if (file) form.set("file", file);
      if (pasteCv.trim()) form.set("cvText", pasteCv);
      form.set("endeavorSentence", selected.sentence);
      const res = await fetch("/api/parse-cv", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not parse CV.");
      setRecord(data.record);
      setCvText(data.cvText || "");
      setFit(null);
      setChoice(null);
      setSkeletons(null);
      setStep("record");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not parse CV.");
    } finally {
      setBusy(false);
    }
  }

  async function runFit() {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/fit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sentence: selected.sentence,
          description: selected.description,
          niFrame: selected.nationalImportanceFrame,
          record,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not score fit.");
      setFit(data);
      setChoice(data.recommended);
      setStep("fit");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not score fit.");
    } finally {
      setBusy(false);
    }
  }

  async function runSkeletons() {
    if (!selected || !fit || !choice) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/skeletons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          choice,
          sentence: selected.sentence,
          description: selected.description,
          niFrame: selected.nationalImportanceFrame,
          fitRationale: fit.rationale,
          narrowedSentence: fit.narrowedSentence,
          pivotSentence: fit.pivotSentence,
          record,
          cvText,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not draft skeletons.");
      setSkeletons(data);
      setStep("skeletons");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not draft skeletons.");
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    localStorage.removeItem(STORAGE);
    setStep("disclaimer");
    setIntake(emptyIntake());
    setOptions([]);
    setWarnings([]);
    setSelectedId(null);
    setRecord(emptyRecord());
    setCvText("");
    setFit(null);
    setChoice(null);
    setSkeletons(null);
    setError(null);
  }

  const exportText = useMemo(() => {
    if (!selected || !skeletons) return "";
    return [
      "# PetitionPro draft (not a filing)",
      "",
      DISCLAIMER,
      "",
      "## Proposed endeavor",
      skeletons.chosenSentence,
      "",
      selected.description,
      "",
      "## Skeletal well positioning (Dhanasar prong 2)",
      ...skeletons.wellPositioning.paragraphs.map((p) => p),
      "",
      "## Skeletal national importance (Dhanasar prong 1)",
      ...skeletons.nationalImportance.paragraphs.map((p) => p),
      "",
      "## Gaps",
      ...(skeletons.gaps.length ? skeletons.gaps.map((g) => `- ${g}`) : ["- None listed"]),
      "",
    ].join("\n");
  }, [selected, skeletons]);

  function downloadDraft() {
    const blob = new Blob([exportText], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "petitionpro-draft.md";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="shell">
      <header>
        <h1 className="brand">
          Petition<span>Pro</span>
        </h1>
        <p className="lede">
          First generate a specific proposed endeavor. Then upload a CV to
          draft skeletal well positioning and national importance — not a
          petition, and not a prediction.
        </p>
      </header>

      <nav className="stepper" aria-label="Progress">
        {STEPS.map((s) => (
          <span key={s.id} data-on={step === s.id ? "true" : "false"}>
            {s.label}
          </span>
        ))}
      </nav>

      {step === "disclaimer" && (
        <section className="panel">
          <h2>Before you draft</h2>
          <p className="note">{DISCLAIMER}</p>
          <p className="note">
            Phase 1 uses parameters only. Phase 2 needs a CV, then asks
            whether to keep, narrow, or pivot the endeavor before writing
            skeletons.
          </p>
          <div className="actions">
            <button className="btn" type="button" onClick={() => setStep("intake")}>
              I understand — continue
            </button>
          </div>
        </section>
      )}

      {step === "intake" && (
        <section className="panel">
          <h2>Proposed endeavor — parameters</h2>
          <p className="note">
            Describe the work, not the job title. National importance is
            framed here; well positioning waits for a CV.
          </p>
          <label className="field">
            Domain / subdomain
            <input
              value={intake.domain}
              onChange={(e) => setIntake({ ...intake, domain: e.target.value })}
              placeholder="e.g. grid-scale battery diagnostics, not 'engineering'"
            />
          </label>
          <label className="field">
            Specific problem
            <textarea
              value={intake.problem}
              onChange={(e) => setIntake({ ...intake, problem: e.target.value })}
              placeholder="What fails today, for whom, and why it matters beyond one employer"
            />
          </label>
          <label className="field">
            Mechanism of work
            <textarea
              value={intake.mechanism}
              onChange={(e) => setIntake({ ...intake, mechanism: e.target.value })}
              placeholder="How you will actually do the work: methods, projects, deployments"
            />
          </label>
          <div className="row2">
            <label className="field">
              U.S. beneficiaries / institutions
              <input
                value={intake.beneficiaries}
                onChange={(e) =>
                  setIntake({ ...intake, beneficiaries: e.target.value })
                }
                placeholder="Who beyond your employer"
              />
            </label>
            <label className="field">
              Role type
              <select
                value={intake.roleType}
                onChange={(e) =>
                  setIntake({
                    ...intake,
                    roleType: e.target.value as Intake["roleType"],
                  })
                }
              >
                <option value="researcher">Researcher</option>
                <option value="practitioner">Practitioner</option>
                <option value="entrepreneur">Entrepreneur</option>
              </select>
            </label>
          </div>
          <label className="field">
            Progress already underway (optional)
            <textarea
              value={intake.progress}
              onChange={(e) => setIntake({ ...intake, progress: e.target.value })}
              placeholder="Pilots, prototypes, papers, customers — only if true"
            />
          </label>
          {error && <p className="err">{error}</p>}
          <div className="actions">
            <button className="btn ghost" type="button" onClick={() => setStep("disclaimer")}>
              Back
            </button>
            <button className="btn" type="button" disabled={busy} onClick={generateEndeavor}>
              {busy ? "Generating…" : "Generate proposed endeavor"}
            </button>
          </div>
        </section>
      )}

      {step === "endeavor" && selected && (
        <section className="panel">
          <h2>Choose a framing</h2>
          <p className="note">
            These are first-generation options with no CV attached. They are
            not filing-ready. Pick one, then upload a CV to test whether the
            record can carry it.
          </p>
          {warnings.map((w) => (
            <div key={w} className="warn">
              {w}
            </div>
          ))}
          {options.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className="option"
              data-on={selected.id === opt.id ? "true" : "false"}
              onClick={() => setSelectedId(opt.id)}
            >
              <b>
                {opt.id} · {opt.label}
              </b>
              <p className="draft">{opt.sentence}</p>
              <p className="small">{opt.description}</p>
            </button>
          ))}
          <h2 style={{ marginTop: "1.4rem" }}>National-importance frame</h2>
          <p className="small">{selected.nationalImportanceFrame}</p>
          <p className="note" style={{ marginTop: "1rem" }}>
            Unverified until a CV is attached. Well positioning is not
            written yet.
          </p>
          {error && <p className="err">{error}</p>}
          <div className="actions">
            <button className="btn ghost" type="button" onClick={() => setStep("intake")}>
              Edit parameters
            </button>
            <button className="btn" type="button" onClick={() => setStep("upload")}>
              Upload CV
            </button>
          </div>
        </section>
      )}

      {step === "upload" && selected && (
        <section className="panel">
          <h2>Upload a CV</h2>
          <p className="note">
            PDF, DOCX, or text. The file is parsed on the server, redacted
            for obvious ID numbers, and used only to test this endeavor:{" "}
            <em>{selected.sentence}</em>
          </p>
          <div className="file">
            <input
              type="file"
              accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
              disabled={busy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void parseCv(file);
              }}
            />
          </div>
          <label className="field" style={{ marginTop: "1rem" }}>
            Or paste CV text
            <textarea
              value={pasteCv}
              disabled={busy}
              onChange={(e) => setPasteCv(e.target.value)}
              placeholder="Paste a text CV if you do not have a PDF yet"
            />
          </label>
          {error && <p className="err">{error}</p>}
          <div className="actions">
            <button className="btn ghost" type="button" onClick={() => setStep("endeavor")}>
              Back
            </button>
            <button
              className="btn"
              type="button"
              disabled={busy || pasteCv.replace(/\s/g, "").length < 80}
              onClick={() => void parseCv()}
            >
              {busy ? "Reading CV…" : "Parse pasted CV"}
            </button>
          </div>
        </section>
      )}

      {step === "record" && (
        <section className="panel">
          <h2>Confirm the extracted record</h2>
          <p className="note">
            Correct the parse before fit scoring. Do not add achievements
            that are not in the CV.
          </p>
          <label className="field">
            Occupation
            <input
              value={record.occupation}
              onChange={(e) => setRecord({ ...record, occupation: e.target.value })}
            />
          </label>
          <label className="field">
            Years of experience
            <input
              value={record.yearsExperience}
              onChange={(e) =>
                setRecord({ ...record, yearsExperience: e.target.value })
              }
            />
          </label>
          <label className="field">
            Degrees (one per line: degree — field — institution — year)
            <textarea
              value={record.degrees
                .map((d) => [d.degree, d.field, d.institution, d.year].filter(Boolean).join(" — "))
                .join("\n")}
              onChange={(e) =>
                setRecord({
                  ...record,
                  degrees: e.target.value
                    .split("\n")
                    .map((line) => line.trim())
                    .filter(Boolean)
                    .map((line) => {
                      const [degree, field, institution, year] = line.split("—").map((s) => s.trim());
                      return {
                        degree: degree || "",
                        field: field || "",
                        institution: institution || "",
                        year: year || "",
                      };
                    }),
                })
              }
            />
          </label>
          <label className="field">
            Projects (one per line: title — summary)
            <textarea
              value={record.projects
                .map((p) => [p.title, p.summary].filter(Boolean).join(" — "))
                .join("\n")}
              onChange={(e) =>
                setRecord({
                  ...record,
                  projects: e.target.value
                    .split("\n")
                    .map((line) => line.trim())
                    .filter(Boolean)
                    .map((line) => {
                      const [title, ...rest] = line.split("—").map((s) => s.trim());
                      return { title: title || "", summary: rest.join(" — ") };
                    }),
                })
              }
            />
          </label>
          {(
            [
              ["publications", "Publications"],
              ["patents", "Patents"],
              ["grantsOrFunding", "Grants or funding"],
              ["leadership", "Leadership"],
              ["skills", "Skills"],
              ["gaps", "Parser-noted gaps"],
            ] as const
          ).map(([key, label]) => (
            <label className="field" key={key}>
              {label} (one per line)
              <textarea
                value={record[key].join("\n")}
                onChange={(e) =>
                  setRecord({
                    ...record,
                    [key]: e.target.value
                      .split("\n")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
              />
            </label>
          ))}
          {error && <p className="err">{error}</p>}
          <div className="actions">
            <button className="btn ghost" type="button" onClick={() => setStep("upload")}>
              Back
            </button>
            <button className="btn" type="button" disabled={busy} onClick={runFit}>
              {busy ? "Scoring fit…" : "Score record against endeavor"}
            </button>
          </div>
        </section>
      )}

      {step === "fit" && fit && (
        <section className="panel">
          <h2>Keep, narrow, or pivot</h2>
          <p className="note">{fit.rationale}</p>
          <p className="small">
            Recommended: <strong>{fit.recommended}</strong>
          </p>
          {fit.recordFitNotes.length > 0 && (
            <ul className="list">
              {fit.recordFitNotes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          )}
          {fit.missingExhibits.length > 0 && (
            <>
              <p className="note" style={{ marginTop: "1rem" }}>
                Missing exhibits (not facts to invent)
              </p>
              <ul className="list">
                {fit.missingExhibits.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </>
          )}
          <div className="actions" style={{ marginBottom: "1rem" }}>
            {(["keep", "narrow", "pivot"] as const).map((c) => (
              <button
                key={c}
                type="button"
                className={choice === c ? "btn" : "btn ghost"}
                onClick={() => setChoice(c)}
              >
                {c}
              </button>
            ))}
          </div>
          {choice === "narrow" && (
            <p className="draft">{fit.narrowedSentence}</p>
          )}
          {choice === "pivot" && <p className="draft">{fit.pivotSentence}</p>}
          {error && <p className="err">{error}</p>}
          <div className="actions">
            <button className="btn ghost" type="button" onClick={() => setStep("record")}>
              Back
            </button>
            <button
              className="btn"
              type="button"
              disabled={busy || !choice}
              onClick={runSkeletons}
            >
              {busy ? "Drafting…" : "Draft well positioning and national importance"}
            </button>
          </div>
        </section>
      )}

      {step === "skeletons" && skeletons && (
        <section className="panel">
          <h2>Skeletal drafts</h2>
          <p className="draft">{skeletons.chosenSentence}</p>
          <h2 style={{ marginTop: "1.4rem" }}>Well positioning</h2>
          {skeletons.wellPositioning.paragraphs.map((p) => (
            <p key={p} className="small">
              {p}
            </p>
          ))}
          <ClaimList facts={skeletons.wellPositioning.claimedFacts} />
          <h2 style={{ marginTop: "1.4rem" }}>National importance</h2>
          {skeletons.nationalImportance.paragraphs.map((p) => (
            <p key={p} className="small">
              {p}
            </p>
          ))}
          <ClaimList facts={skeletons.nationalImportance.claimedFacts} />
          {skeletons.gaps.length > 0 && (
            <>
              <h2 style={{ marginTop: "1.4rem" }}>Gaps</h2>
              <ul className="list">
                {skeletons.gaps.map((g) => (
                  <li key={g}>{g}</li>
                ))}
              </ul>
            </>
          )}
          <div className="actions">
            <button className="btn ghost" type="button" onClick={() => setStep("fit")}>
              Back
            </button>
            <button className="btn" type="button" onClick={downloadDraft}>
              Download Markdown
            </button>
            <button className="btn danger" type="button" onClick={reset}>
              Start over
            </button>
          </div>
        </section>
      )}

      <footer className="disclaimer">{DISCLAIMER}</footer>
    </main>
  );
}

function ClaimList({
  facts,
}: {
  facts: { claim: string; cvSpan: string; supported: boolean }[];
}) {
  if (!facts.length) return null;
  return (
    <ul className="list">
      {facts.map((f) => (
        <li key={f.claim}>
          <span className={f.supported ? "tag ok" : "tag no"}>
            {f.supported ? "supported" : "unsupported"}
          </span>
          {f.claim}
          {f.cvSpan ? ` — “${f.cvSpan}”` : ""}
        </li>
      ))}
    </ul>
  );
}
