"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Brand } from "@/components/Brand";
import { DISCLAIMER } from "@/lib/disclaimer";
import {
  WELL_POSITIONED_FACTORS,
  itemInCv,
  withCheckedProgress,
  type ProgressItem,
  type WellPositionedFactor,
} from "@/lib/framework";
import {
  EB1A_CRITERIA,
  checkCriteria,
  criteriaWithQuotes,
  type CriterionItem,
  type Eb1aCriterion,
  type PetitionTrack,
} from "@/lib/tracks";
import {
  emptyIntake,
  emptyRecord,
  type CvRecord,
  type EndeavorOption,
  type FitChoice,
  type Eb1aDraft,
  type FitResult,
  type Intake,
  type SkeletonsResult,
  type Step,
} from "@/lib/types";

const EB2_STEPS: { id: Step; label: string }[] = [
  { id: "disclaimer", label: "Notice" },
  { id: "track", label: "Classification" },
  { id: "intake", label: "Endeavor" },
  { id: "endeavor", label: "Options" },
  { id: "upload", label: "CV" },
  { id: "record", label: "Record" },
  { id: "fit", label: "Fit" },
  { id: "skeletons", label: "Drafts" },
];

const EB1_STEPS: { id: Step; label: string }[] = [
  { id: "disclaimer", label: "Notice" },
  { id: "track", label: "Classification" },
  { id: "field", label: "Field" },
  { id: "upload", label: "CV" },
  { id: "record", label: "Criteria" },
  { id: "skeletons", label: "Draft" },
];

type Persist = {
  step: Step;
  track?: PetitionTrack;
  eb1aArea?: string;
  eb1aContinue?: string;
  intake: Intake;
  options: EndeavorOption[];
  warnings: string[];
  selectedId: string | null;
  record: CvRecord;
  cvText: string;
  fit: FitResult | null;
  choice: FitChoice | null;
  skeletons: SkeletonsResult | null;
  eb1aDraft?: Eb1aDraft | null;
};

const STORAGE = "petitionpro-v1";

export function Studio() {
  const [step, setStep] = useState<Step>("disclaimer");
  const [track, setTrack] = useState<PetitionTrack>("eb2-niw");
  const [trackReturn, setTrackReturn] = useState<Step>("intake");
  const [eb1aArea, setEb1aArea] = useState("");
  const [eb1aContinue, setEb1aContinue] = useState("");
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
  const [eb1aDraft, setEb1aDraft] = useState<Eb1aDraft | null>(null);
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
      const savedTrack = data.track === "eb1a" ? "eb1a" : "eb2-niw";
      setStep(data.step || "disclaimer");
      setTrack(savedTrack);
      setEb1aArea(data.eb1aArea || "");
      setEb1aContinue(data.eb1aContinue || "");
      setIntake(data.intake || emptyIntake());
      setOptions(data.options || []);
      setWarnings(data.warnings || []);
      setSelectedId(data.selectedId);
      const savedCv = data.cvText || "";
      const checked = withCheckedProgress(data.record || emptyRecord(), savedCv);
      setRecord({
        ...checked,
        extraordinaryAbility: checkCriteria(data.record?.extraordinaryAbility, savedCv),
      });
      setCvText(savedCv);
      setFit(data.fit);
      setChoice(data.choice);
      setSkeletons(data.skeletons);
      setEb1aDraft(data.eb1aDraft ?? null);
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const data: Persist = {
      step,
      track,
      eb1aArea,
      eb1aContinue,
      intake,
      options,
      warnings,
      selectedId,
      record,
      cvText,
      fit,
      choice,
      skeletons,
      eb1aDraft,
    };
    localStorage.setItem(STORAGE, JSON.stringify(data));
  }, [
    hydrated,
    step,
    track,
    eb1aArea,
    eb1aContinue,
    intake,
    options,
    warnings,
    selectedId,
    record,
    cvText,
    fit,
    choice,
    skeletons,
    eb1aDraft,
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

  function chooseTrack(next: PetitionTrack) {
    if (next !== track) {
      setOptions([]);
      setWarnings([]);
      setSelectedId(null);
      setRecord(emptyRecord());
      setCvText("");
      setPasteCv("");
      setFit(null);
      setChoice(null);
      setSkeletons(null);
      setEb1aDraft(null);
      setTrack(next);
      setError(null);
      setStep(next === "eb1a" ? "field" : "intake");
      return;
    }
    setError(null);
    const back = trackReturn === "disclaimer" || trackReturn === "track" ? null : trackReturn;
    setStep(back ?? (next === "eb1a" ? "field" : "intake"));
  }

  async function parseCv(file?: File) {
    if (track === "eb2-niw" && !selected) return;
    if (track === "eb1a" && eb1aArea.trim().length < 8) return;
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      if (file) form.set("file", file);
      if (pasteCv.trim()) form.set("cvText", pasteCv);
      form.set("track", track);
      if (track === "eb1a") form.set("fieldArea", eb1aArea.trim());
      else if (selected) form.set("endeavorSentence", selected.sentence);
      const res = await fetch("/api/parse-cv", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not parse CV.");
      const parsedCv = data.cvText || "";
      const checked = withCheckedProgress(data.record || emptyRecord(), parsedCv);
      setRecord({
        ...checked,
        extraordinaryAbility: checkCriteria(data.record?.extraordinaryAbility, parsedCv),
      });
      setCvText(parsedCv);
      setFit(null);
      setChoice(null);
      setSkeletons(null);
      setEb1aDraft(null);
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
          cvText,
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

  async function runEb1aDraft() {
    if (eb1aArea.trim().length < 8) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/skeletons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          track: "eb1a",
          area: eb1aArea.trim(),
          continueWork: eb1aContinue,
          record,
          cvText,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not draft initial evidence.");
      setEb1aDraft(data);
      setStep("skeletons");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not draft initial evidence.");
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    localStorage.removeItem(STORAGE);
    setStep("disclaimer");
    setTrack("eb2-niw");
    setEb1aArea("");
    setEb1aContinue("");
    setIntake(emptyIntake());
    setOptions([]);
    setWarnings([]);
    setSelectedId(null);
    setRecord(emptyRecord());
    setCvText("");
    setFit(null);
    setChoice(null);
    setSkeletons(null);
    setEb1aDraft(null);
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

  function downloadEb1aDraft() {
    if (!eb1aDraft) return;
    const lines = [
      "# PetitionPro EB-1A initial-evidence draft (not a filing)",
      "",
      DISCLAIMER,
      "",
      `Field: ${eb1aDraft.area}`,
      "",
      ...eb1aDraft.paragraphs,
      "",
      "## Claims checked against the CV",
      ...(eb1aDraft.claimedFacts.length
        ? eb1aDraft.claimedFacts.map(
            (fact) => `- ${fact.supported ? "In CV" : "Not in CV"}: ${fact.claim}`
          )
        : ["- None listed"]),
      "",
      "## Gaps in CV support",
      ...(eb1aDraft.gaps.length ? eb1aDraft.gaps.map((gap) => `- ${gap}`) : ["- None listed"]),
      "",
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "petitionpro-eb1a-draft.md";
    a.click();
    URL.revokeObjectURL(url);
  }

  const steps =
    step === "disclaimer" || step === "track"
      ? ([
          { id: "disclaimer", label: "Notice" },
          { id: "track", label: "Classification" },
        ] as { id: Step; label: string }[])
      : track === "eb1a"
        ? EB1_STEPS
        : EB2_STEPS;

  const lede =
    step === "disclaimer" || step === "track"
      ? "Two self-petition classifications, two USCIS tests. EB-2 NIW is the Dhanasar endeavor framework. EB-1A is extraordinary ability. EB-1B and EB-1C need a U.S. employer and are not drafted here."
      : track === "eb1a"
        ? "EB-1A extraordinary ability. USCIS asks whether the person has sustained national or international acclaim and has risen to the very top of the field. This studio files CV quotes under the ten regulatory criteria. It does not make that decision."
        : "EB-2 NIW. USCIS applies Matter of Dhanasar to the proposed endeavor: national importance, and whether the person is well positioned to advance it. This is not an EB-1 extraordinary-ability test.";

  function downloadCriteria() {
    const lines = [
      "# PetitionPro EB-1A criteria cross-check (not a filing)",
      "",
      DISCLAIMER,
      "",
      `Area: ${eb1aArea.trim()}`,
      eb1aContinue.trim() ? `Continue in the area: ${eb1aContinue.trim()}` : "",
      "",
      `CV quotes found under ${criteriaWithQuotes(record.extraordinaryAbility)} of 10 criteria.`,
      "Initial evidence is a one-time major, internationally recognized award, or at least 3 of the 10 criteria. A quote is not a finding that a criterion is met. Final merits is a separate USCIS decision.",
      "",
    ];
    for (const criterion of EB1A_CRITERIA) {
      const rows = record.extraordinaryAbility.filter((item) => item.criterion === criterion.id);
      lines.push(`## ${criterion.label}`);
      if (!rows.length) {
        lines.push("No CV quote under this criterion.", "");
        continue;
      }
      for (const row of rows) {
        lines.push(`- ${row.inCv ? "In CV" : "Not in CV"}: ${row.cvSpan || row.fact}`);
      }
      lines.push("");
    }
    const blob = new Blob([lines.filter((line) => line !== undefined).join("\n")], {
      type: "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "petitionpro-eb1a-criteria.md";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="shell">
      <Brand lede={lede} />

      <nav className="stepper" aria-label="Progress">
        {steps.map((s) => (
          <span key={s.id} data-on={step === s.id ? "true" : "false"}>
            {s.label}
          </span>
        ))}
      </nav>
      {step !== "disclaimer" && step !== "track" && (
        <div className="actions band">
          <button
            className="btn ghost"
            type="button"
            onClick={() => {
              setTrackReturn(step);
              setStep("track");
            }}
          >
            {track === "eb1a" ? "EB-1A" : "EB-2 NIW"} — change classification
          </button>
        </div>
      )}

      {step === "disclaimer" && (
        <section className="panel">
          <h2>Before you draft</h2>
          <p className="note">{DISCLAIMER}</p>
          <p className="note">
            The next step chooses the classification. EB-2 NIW and EB-1A ask
            different questions, and the studio keeps those frameworks apart.
          </p>
          <div className="actions">
            <button className="btn" type="button" onClick={() => setStep("track")}>
              I understand — continue
            </button>
          </div>
        </section>
      )}

      {step === "track" && (
        <section className="panel">
          <h2>EB-2 NIW or EB-1A</h2>
          <p className="note">
            USCIS does not use the Dhanasar prongs to decide extraordinary
            ability, and it does not use the ten EB-1A criteria to decide a
            national interest waiver.
          </p>
          <div className="row2">
            <article className="factor">
              <b>EB-2 NIW</b>
              <p className="small">
                Second preference. Policy Manual, Volume 6, Part F, Chapter 5.
                Matter of Dhanasar.
              </p>
              <ul className="list">
                <li>
                  The person must first qualify as an advanced-degree
                  professional or as a person of exceptional ability, at least
                  3 of the 6 regulatory criteria.
                </li>
                <li>
                  A job offer and a labor certification are required unless
                  USCIS grants the waiver.
                </li>
                <li>
                  The waiver asks whether this proposed endeavor has substantial
                  merit and national importance, whether the person is well
                  positioned to advance it, and whether waiving the job offer
                  would, on balance, benefit the United States.
                </li>
              </ul>
            </article>
            <article className="factor">
              <b>EB-1A</b>
              <p className="small">
                First preference, extraordinary ability. Policy Manual, Volume
                6, Part F, Chapter 2. 8 C.F.R. 204.5(h).
              </p>
              <ul className="list">
                <li>No job offer and no labor certification. No degree is required.</li>
                <li>
                  Initial evidence is a one-time major, internationally
                  recognized award, or at least 3 of the 10 regulatory criteria.
                </li>
                <li>
                  Final merits is separate: sustained national or international
                  acclaim, and the person is among the small percentage who have
                  risen to the very top of the field. The person must be coming
                  to continue work in the area of extraordinary ability.
                </li>
              </ul>
            </article>
          </div>
          <p className="note" style={{ marginTop: "1rem" }}>
            EB-1B outstanding professors and researchers, and EB-1C
            multinational managers and executives, require a qualifying U.S.
            employer. This studio does not draft those petitions.
          </p>
          <div className="actions">
            <button className="btn ghost" type="button" onClick={() => setStep("disclaimer")}>
              Back
            </button>
            <button className="btn" type="button" onClick={() => chooseTrack("eb2-niw")}>
              Continue with EB-2 NIW
            </button>
            <button className="btn ghost" type="button" onClick={() => chooseTrack("eb1a")}>
              Continue with EB-1A
            </button>
          </div>
        </section>
      )}

      {step === "field" && track === "eb1a" && (
        <section className="panel">
          <h2>Area of extraordinary ability</h2>
          <p className="note">
            EB-1A is about the field the person has already risen in, not a
            Dhanasar proposed endeavor. USCIS also asks whether the person will
            continue to work in that area. State that only if it is true. This
            studio does not decide either question.
          </p>
          <label className="field">
            Field of extraordinary ability
            <textarea
              value={eb1aArea}
              onChange={(e) => setEb1aArea(e.target.value)}
              placeholder="The field, stated specifically enough that a CV line can be read against it"
            />
          </label>
          <label className="field">
            Continuing work in that area, if true
            <textarea
              value={eb1aContinue}
              onChange={(e) => setEb1aContinue(e.target.value)}
              placeholder="Only what the person will actually keep doing in this field"
            />
          </label>
          {error && <p className="err">{error}</p>}
          <div className="actions">
            <button className="btn ghost" type="button" onClick={() => setStep("track")}>
              Back
            </button>
            {eb1aArea.trim().length >= 8 && (
              <Link
                className="btn ghost"
                href={`/project?track=eb1a&endeavor=${encodeURIComponent(eb1aArea.trim())}`}
              >
                Tailored projects
              </Link>
            )}
            <button
              className="btn"
              type="button"
              disabled={eb1aArea.trim().length < 8}
              onClick={() => setStep("upload")}
            >
              Upload CV
            </button>
          </div>
        </section>
      )}

      {step === "intake" && (
        <section className="panel">
          <h2>Proposed endeavor — parameters</h2>
          <p className="note">
            Describe the work, not the job title. National importance is
            framed here; well positioning waits for a CV. Progress already
            underway on this form only words the endeavor. After the CV is
            parsed, those facts are cross-checked against the four USCIS
            well-positioned factors.
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
            <Link
              className="btn ghost"
              href={`/project?track=eb2-niw&endeavor=${encodeURIComponent(selected.sentence)}`}
            >
              Tailored projects
            </Link>
            <button className="btn" type="button" onClick={() => setStep("upload")}>
              Upload CV
            </button>
          </div>
        </section>
      )}

      {step === "upload" && (track === "eb1a" || selected) && (
        <section className="panel">
          <h2>Upload a CV</h2>
          <p className="note">
            {track === "eb1a" ? (
              <>
                PDF, DOCX, or text. The file is parsed on the server, redacted
                for obvious ID numbers, then filed under the ten EB-1A
                criteria for this field: <em>{eb1aArea}</em>
              </>
            ) : (
              <>
                PDF, DOCX, or text. The file is parsed on the server, redacted
                for obvious ID numbers, then cross-checked against the USCIS
                well-positioned factors for this endeavor:{" "}
                <em>{selected?.sentence}</em>
              </>
            )}
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
            <button
              className="btn ghost"
              type="button"
              onClick={() => setStep(track === "eb1a" ? "field" : "endeavor")}
            >
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
            {track === "eb1a"
              ? "Correct the parse. Do not add achievements that are not in the CV. The cross-check below files quotes under the ten EB-1A initial-evidence criteria. A quote is not a finding that the criterion is met, and it is not the final merits decision."
              : "Correct the parse before fit scoring. Do not add achievements that are not in the CV. The cross-check below is Dhanasar prong 2 only: a quote counts when it appears in the CV."}
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
          {track === "eb1a" ? (
            <CriteriaCrossCheck
              items={record.extraordinaryAbility}
              cvText={cvText}
              onChange={(extraordinaryAbility) => setRecord({ ...record, extraordinaryAbility })}
            />
          ) : (
            <FrameworkCrossCheck
              items={record.progressTowardEndeavor}
              cvText={cvText}
              editable
              onChange={(progressTowardEndeavor) =>
                setRecord({ ...record, progressTowardEndeavor })
              }
            />
          )}
          {error && <p className="err">{error}</p>}
          <div className="actions">
            <button className="btn ghost" type="button" onClick={() => setStep("upload")}>
              Back
            </button>
            {track === "eb1a" ? (
              <>
                <button className="btn" type="button" disabled={busy} onClick={runEb1aDraft}>
                  {busy ? "Drafting…" : "Draft initial evidence"}
                </button>
                <button className="btn ghost" type="button" onClick={downloadCriteria}>
                  Download cross-check
                </button>
                <Link
                  className="btn ghost"
                  href={`/project?track=eb1a&endeavor=${encodeURIComponent(eb1aArea.trim())}`}
                >
                  Tailored projects
                </Link>
              </>
            ) : (
              <button className="btn" type="button" disabled={busy} onClick={runFit}>
                {busy ? "Scoring fit…" : "Score record against endeavor"}
              </button>
            )}
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
          <FrameworkCrossCheck
            items={record.progressTowardEndeavor}
            cvText={cvText}
            editable={false}
          />
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

      {step === "skeletons" && track === "eb1a" && eb1aDraft && (
        <section className="panel">
          <h2>Initial-evidence draft</h2>
          <p className="note">
            Built only from CV quotes for {eb1aDraft.area}. A line marked in CV
            was found in the upload. This is not a finding that a criterion is
            met, and it is not the final merits decision.
          </p>
          <p className="draft">{eb1aDraft.area}</p>
          {eb1aDraft.paragraphs.map((paragraph) => (
            <p key={paragraph} className="small">
              {paragraph}
            </p>
          ))}
          <ClaimList facts={eb1aDraft.claimedFacts} />
          {eb1aDraft.gaps.length > 0 && (
            <>
              <h2 style={{ marginTop: "1.4rem" }}>Gaps</h2>
              <ul className="list">
                {eb1aDraft.gaps.map((gap) => (
                  <li key={gap}>{gap}</li>
                ))}
              </ul>
            </>
          )}
          <div className="actions">
            <button className="btn ghost" type="button" onClick={() => setStep("record")}>
              Back
            </button>
            <button className="btn" type="button" onClick={downloadEb1aDraft}>
              Download draft
            </button>
            <button className="btn danger" type="button" onClick={reset}>
              Start over
            </button>
          </div>
        </section>
      )}

      {step === "skeletons" && track !== "eb1a" && skeletons && (
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

function CriteriaCrossCheck({
  items,
  cvText,
  onChange,
}: {
  items: CriterionItem[];
  cvText: string;
  onChange: (next: CriterionItem[]) => void;
}) {
  const checked = items.map((item) => {
    const quote = item.cvSpan.trim() || item.fact.trim();
    return {
      criterion: item.criterion,
      fact: quote,
      cvSpan: item.cvSpan || quote,
      inCv: quote ? itemInCv({ fact: quote, cvSpan: quote }, cvText) : false,
    };
  });
  const found = criteriaWithQuotes(checked);

  function emit(next: CriterionItem[]) {
    onChange(
      next.map((item) => {
        const quote = item.cvSpan.trim() || item.fact.trim();
        return {
          criterion: item.criterion,
          fact: quote,
          cvSpan: item.cvSpan,
          inCv: quote ? itemInCv({ fact: quote, cvSpan: quote }, cvText) : false,
        };
      })
    );
  }

  return (
    <div>
      <h2 style={{ marginTop: "1.4rem" }}>EB-1A initial-evidence cross-check</h2>
      <p className="note">
        These are the ten criteria in 8 C.F.R. 204.5(h)(3). Policy Manual,
        Volume 6, Part F, Chapter 2. Quotes found under {found} of 10 criteria.
        Initial evidence is a one-time major, internationally recognized award,
        or at least 3 criteria. A quote is not a finding that the criterion is
        met. After initial evidence, USCIS makes a separate final merits
        decision: sustained acclaim, and whether the person is among the small
        percentage at the very top of the field. If a criterion does not readily
        apply to the occupation, USCIS may consider comparable evidence. This
        screen does not invent that evidence.
      </p>
      {EB1A_CRITERIA.map((criterion) => {
        const rows = checked
          .map((item, index) => ({ item, index }))
          .filter(({ item }) => item.criterion === criterion.id);
        const hits = rows.filter(({ item }) => item.inCv).length;
        const status =
          rows.length === 0
            ? "No CV quote under this criterion."
            : hits === rows.length
              ? "Quote found in the CV."
              : hits === 0
                ? "Quote not found in the CV."
                : "Some quotes were found in the CV.";
        return (
          <article key={criterion.id} className="factor">
            <b>{criterion.label}</b>
            <p className="small">{status}</p>
            {rows.map(({ item, index }) => (
              <div key={`${criterion.id}-${index}`}>
                <label className="field">
                  Quote from the CV
                  <textarea
                    className="short"
                    value={item.cvSpan}
                    onChange={(event) => {
                      const cvSpan = event.target.value;
                      emit(
                        checked.map((row, rowIndex) =>
                          rowIndex === index ? { ...row, cvSpan, fact: cvSpan } : row
                        )
                      );
                    }}
                  />
                </label>
                <label className="field">
                  Regulatory criterion
                  <select
                    value={item.criterion}
                    onChange={(event) => {
                      const nextCriterion = event.target.value as Eb1aCriterion;
                      emit(
                        checked.map((row, rowIndex) =>
                          rowIndex === index ? { ...row, criterion: nextCriterion } : row
                        )
                      );
                    }}
                  >
                    {EB1A_CRITERIA.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <p>
                  <span className={item.inCv ? "tag ok" : "tag no"}>
                    {item.inCv ? "in CV" : "not in CV"}
                  </span>
                  {item.cvSpan.trim() && !item.inCv
                    ? "This quote was not found in the uploaded CV."
                    : ""}
                </p>
                <button
                  className="btn ghost"
                  type="button"
                  onClick={() => emit(checked.filter((_, rowIndex) => rowIndex !== index))}
                >
                  Remove
                </button>
              </div>
            ))}
            {rows.length < 2 && (
              <div className="actions">
                <button
                  className="btn ghost"
                  type="button"
                  onClick={() =>
                    emit([
                      ...checked,
                      { criterion: criterion.id, fact: "", cvSpan: "", inCv: false },
                    ])
                  }
                >
                  Add a CV quote
                </button>
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}

function FrameworkCrossCheck({
  items,
  cvText,
  editable,
  onChange,
}: {
  items: ProgressItem[];
  cvText: string;
  editable: boolean;
  onChange?: (next: ProgressItem[]) => void;
}) {
  const checked = items.map((item) => {
    const quote = item.cvSpan.trim() || item.fact.trim();
    return {
      factor: item.factor,
      fact: quote,
      cvSpan: item.cvSpan || quote,
      inCv: quote ? itemInCv({ fact: quote, cvSpan: quote }, cvText) : false,
    };
  });

  function emit(next: ProgressItem[]) {
    onChange?.(
      next.map((item) => {
        const quote = item.cvSpan.trim() || item.fact.trim();
        return {
          factor: item.factor,
          fact: quote,
          cvSpan: item.cvSpan,
          inCv: quote ? itemInCv({ fact: quote, cvSpan: quote }, cvText) : false,
        };
      })
    );
  }

  return (
    <div>
      <h2 style={{ marginTop: "1.4rem" }}>Well-positioned cross-check</h2>
      <p className="note">
        USCIS lists these four factors, among others, for Dhanasar prong 2:
        whether the person is well positioned to advance the proposed endeavor
        (Policy Manual, Volume 6, Part F, Chapter 5). A quote counts only when
        it appears in the CV. An empty factor is a gap in this draft, not a
        decision on that factor. National importance and waiving a job offer
        are the other two prongs and are not decided here.
      </p>
      {WELL_POSITIONED_FACTORS.map((factor) => {
        const rows = checked
          .map((item, index) => ({ item, index }))
          .filter(
            ({ item }) =>
              item.factor === factor.id && (editable || item.cvSpan.trim().length > 0)
          );
        const found = rows.filter(({ item }) => item.inCv).length;
        const status =
          rows.length === 0
            ? "No CV quote under this factor."
            : found === rows.length
              ? "Quote found in the CV."
              : found === 0
                ? "Quote not found in the CV."
                : "Some quotes were found in the CV.";
        return (
          <article key={factor.id} className="factor">
            <b>{factor.label}</b>
            <p className="small">{status}</p>
            {rows.map(({ item, index }) =>
              editable ? (
                <div key={`${factor.id}-${index}`}>
                  <label className="field">
                    Quote from the CV
                    <textarea
                      className="short"
                      value={item.cvSpan}
                      onChange={(event) => {
                        const cvSpan = event.target.value;
                        emit(
                          checked.map((row, rowIndex) =>
                            rowIndex === index ? { ...row, cvSpan, fact: cvSpan } : row
                          )
                        );
                      }}
                    />
                  </label>
                  <label className="field">
                    USCIS factor
                    <select
                      value={item.factor}
                      onChange={(event) => {
                        const nextFactor = event.target.value as WellPositionedFactor;
                        emit(
                          checked.map((row, rowIndex) =>
                            rowIndex === index ? { ...row, factor: nextFactor } : row
                          )
                        );
                      }}
                    >
                      {WELL_POSITIONED_FACTORS.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <p>
                    <span className={item.inCv ? "tag ok" : "tag no"}>
                      {item.inCv ? "in CV" : "not in CV"}
                    </span>
                    {item.cvSpan.trim() && !item.inCv
                      ? "This quote was not found in the uploaded CV."
                      : ""}
                  </p>
                  <button
                    className="btn ghost"
                    type="button"
                    onClick={() => emit(checked.filter((_, rowIndex) => rowIndex !== index))}
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <p key={`${factor.id}-${index}`} className="small">
                  <span className={item.inCv ? "tag ok" : "tag no"}>
                    {item.inCv ? "in CV" : "not in CV"}
                  </span>
                  {item.cvSpan || item.fact}
                </p>
              )
            )}
            {editable && rows.length < 4 && (
              <div className="actions">
                <button
                  className="btn ghost"
                  type="button"
                  onClick={() =>
                    emit([
                      ...checked,
                      { factor: factor.id, fact: "", cvSpan: "", inCv: false },
                    ])
                  }
                >
                  Add a CV quote
                </button>
              </div>
            )}
          </article>
        );
      })}
    </div>
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
