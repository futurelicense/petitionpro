import { WELL_POSITIONED_FACTORS, quoteFoundInCv } from "./framework";
import type { MilestoneCost } from "./costs";
import { costTotals, usd } from "./costs";
import { EB1A_CRITERIA } from "./tracks";
import type { PetitionTrack } from "./tracks";

export const CASES_STORAGE = "petitionpro-cases-v1";
export const CASES_CHANGED_EVENT = "petitionpro-cases-changed";

export type StageId = "profile" | "endeavor" | "pathway" | "cv" | "positioning";
export type Rating = "strong" | "weak" | "missing";
export type ItemState = "missing" | "partial" | "in-file" | "waived";
export type PathwayChoice = PetitionTrack | "both" | "";

export type BaselineLine = {
  id: string;
  label: string;
  rating: Rating | "";
};

export type MilestoneBullet = {
  id: string;
  label: string;
  documentName: string;
  done: boolean;
};

export type MilestoneGroup = "prong-1" | "plan-progress" | "stakeholder" | "record";

export type Milestone = {
  id: string;
  name: string;
  optional: boolean;
  group: MilestoneGroup;
  pathways: PetitionTrack[];
  serves: string;
  bullets: MilestoneBullet[];
  waivedReason: string;
  cost?: MilestoneCost;
};

export type QuoteRow = {
  id: string;
  label: string;
  quote: string;
  inCv: boolean;
};

export type Period = {
  id: string;
  number: number;
  openedAt: string;
  closedAt: string | null;
  nextReview: string;
  stageAtOpen: StageId;
  note: string;
  summary: string;
};

export type ClientCase = {
  sourceInquiryId?: string;
  assessmentReport?: string;
  id: string;
  name: string;
  email: string;
  phone: string;
  matterRef: string;
  createdAt: string;
  updatedAt: string;
  stage: StageId;
  pathway: PathwayChoice;
  activePathway: PetitionTrack | "";
  endeavorSentence: string;
  mechanism: string;
  beneficiaries: string;
  niFrame: string;
  fieldArea: string;
  continueWork: string;
  cvFileName: string;
  cvText: string;
  cvChecked: boolean;
  baseline: BaselineLine[];
  milestones: Milestone[];
  quotesEb2: QuoteRow[];
  quotesEb1a: QuoteRow[];
  periods: Period[];
  readyForDraft: boolean;
};

export const STAGES: { id: StageId; label: string }[] = [
  { id: "profile", label: "Profile" },
  { id: "endeavor", label: "Endeavor" },
  { id: "pathway", label: "Pathway" },
  { id: "cv", label: "CV profile" },
  { id: "positioning", label: "Well positioning" },
];

/** Accept older display labels without dropping a saved case from the workflow. */
export function caseStage(value: unknown): StageId {
  if (typeof value !== "string") return "profile";
  const key = value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  const aliases: Record<string, StageId> = {
    profile: "profile", profileevaluation: "profile",
    endeavor: "endeavor", proposedendeavor: "endeavor",
    pathway: "pathway", cv: "cv", cvprofile: "cv",
    positioning: "positioning", wellpositioning: "positioning", wellpositioned: "positioning",
  };
  return aliases[key] ?? "profile";
}

export const GROUPS: { id: MilestoneGroup; label: string }[] = [
  { id: "prong-1", label: "Prong 1 — national importance" },
  { id: "plan-progress", label: "Prong 2 — plan and progress" },
  { id: "stakeholder", label: "Prong 2 — stakeholder interest" },
  { id: "record", label: "Prong 2 — record of success" },
];

const BASELINE: { id: string; label: string }[] = [
  { id: "membership", label: "Membership" },
  { id: "authorship", label: "Authorship" },
  { id: "leading-role", label: "Leading role" },
  { id: "media", label: "Media" },
];

type MilestoneSeed = Omit<Milestone, "bullets" | "waivedReason"> & {
  bullets: string[];
};

const MILESTONE_SEEDS: MilestoneSeed[] = [
  {
    id: "framework",
    name: "Methodology or framework — open source",
    optional: false,
    group: "plan-progress",
    pathways: ["eb2-niw", "eb1a"],
    serves: "Plan, progress, and original contributions",
    bullets: [
      "Core framework document: problem, method, and expected impact",
      "Proof the client leads it, and that a third party has used or asked about it",
    ],
  },
  {
    id: "paper",
    name: "Research paper associated with the endeavor",
    optional: false,
    group: "plan-progress",
    pathways: ["eb2-niw", "eb1a"],
    serves: "Progress and authorship",
    bullets: ["Published paper or acceptance letter", "Citation report, or an independent paper that cites the work"],
  },
  {
    id: "ip",
    name: "Patents, trademarks, or copyrights",
    optional: true,
    group: "plan-progress",
    pathways: ["eb2-niw", "eb1a"],
    serves: "Progress",
    bullets: ["Registration or application naming the client", "Connection between the IP and the endeavor"],
  },
  {
    id: "github",
    name: "GitHub repository",
    optional: false,
    group: "plan-progress",
    pathways: ["eb2-niw", "eb1a"],
    serves: "Progress and original contributions",
    bullets: [
      "Public repository URL and contributor history",
      "Outside use: forks, dependents, or a third-party reference",
    ],
  },
  {
    id: "economic",
    name: "Economic impact analysis",
    optional: false,
    group: "prong-1",
    pathways: ["eb2-niw"],
    serves: "National importance of this endeavor",
    bullets: [
      "Report of the national problem, the mechanism, and the assumptions",
      "Sources for the figures, with limitations stated",
    ],
  },
  {
    id: "partnerships",
    name: "Collaborative partnerships",
    optional: false,
    group: "stakeholder",
    pathways: ["eb2-niw"],
    serves: "Stakeholder interest",
    bullets: ["Agreement, MOU, or letter of collaboration", "Scope: activities, deliverables, and timeline"],
  },
  {
    id: "media",
    name: "Independent media coverage",
    optional: true,
    group: "record",
    pathways: ["eb2-niw", "eb1a"],
    serves: "Record of success and published material about the person",
    bullets: [
      "Full article identifying the client and the work",
      "Outlet page showing independent editorial authorship",
    ],
  },
  {
    id: "membership",
    name: "Membership requiring outstanding achievements",
    optional: false,
    group: "record",
    pathways: ["eb2-niw", "eb1a"],
    serves: "Record of success and the membership criterion",
    bullets: [
      "Certificate or approval letter",
      "Bylaws or criteria showing outstanding achievement is required",
    ],
  },
  {
    id: "presentations",
    name: "Presentations or workshops",
    optional: false,
    group: "plan-progress",
    pathways: ["eb2-niw", "eb1a"],
    serves: "Progress",
    bullets: ["Invitation or official program", "Slides or abstract tied to the endeavor"],
  },
  {
    id: "judging",
    name: "Judging the work of others",
    optional: true,
    group: "record",
    pathways: ["eb1a"],
    serves: "Judging criterion",
    bullets: [
      "Invitation to review or serve on a panel",
      "Evidence the review was in the same or an allied field",
    ],
  },
  {
    id: "awards",
    name: "Awards tied to the endeavor",
    optional: false,
    group: "record",
    pathways: ["eb2-niw", "eb1a"],
    serves: "Record of success and the awards criterion",
    bullets: ["Award certificate or letter", "Criteria and the granting organization's standing"],
  },
  {
    id: "certification",
    name: "Certification associated with the endeavor",
    optional: false,
    group: "plan-progress",
    pathways: ["eb2-niw"],
    serves: "Education, skills, and record",
    bullets: ["Certificate", "What the credential covers"],
  },
  {
    id: "portfolio",
    name: "Professional portfolio",
    optional: false,
    group: "plan-progress",
    pathways: ["eb2-niw", "eb1a"],
    serves: "Plan for future activities",
    bullets: ["Portfolio link or PDF in the file", "A page that identifies the client as the author"],
  },
  {
    id: "adoption",
    name: "Institutional adoption or planned adoption",
    optional: false,
    group: "stakeholder",
    pathways: ["eb2-niw"],
    serves: "Stakeholder interest",
    bullets: ["Letter or record from the institution", "What was adopted, or the commitment made"],
  },
  {
    id: "national-expert",
    name: "Expert assessment of prospective national impact",
    optional: false,
    group: "prong-1",
    pathways: ["eb2-niw"],
    serves: "National importance of this endeavor",
    bullets: ["Independent expert letter on this endeavor's prospective impact", "The expert's basis of knowledge"],
  },
  {
    id: "letters",
    name: "Independent expert recommendation letters",
    optional: false,
    group: "record",
    pathways: ["eb2-niw", "eb1a"],
    serves: "Record of success",
    bullets: ["Letter describing specific work", "The signer's independence and qualifications"],
  },
  {
    id: "pilots",
    name: "Collaboration, partnership, or pilot",
    optional: false,
    group: "stakeholder",
    pathways: ["eb2-niw"],
    serves: "Progress and stakeholder interest",
    bullets: ["Pilot agreement or correspondence", "Dates, site, and what was tested"],
  },
  {
    id: "citations",
    name: "Independent citations or use of the work",
    optional: false,
    group: "record",
    pathways: ["eb2-niw", "eb1a"],
    serves: "Record of success and authorship",
    bullets: ["Citation report", "Excerpt showing how an independent author used the work"],
  },
  {
    id: "government",
    name: "U.S. government agency validation",
    optional: false,
    group: "prong-1",
    pathways: ["eb2-niw"],
    serves: "National importance of this endeavor",
    bullets: ["Agency record, grant, or letter", "The connection to this endeavor"],
  },
  {
    id: "influence",
    name: "Influence on the field",
    optional: false,
    group: "record",
    pathways: ["eb2-niw", "eb1a"],
    serves: "Record of success and original contributions",
    bullets: [
      "A document showing another professional or organization relied on the work",
      "What they changed or adopted",
    ],
  },
];

export function lineDone(bullet: MilestoneBullet): boolean {
  if (typeof bullet.done === "boolean") return bullet.done;
  return (bullet.documentName ?? "").trim().length >= 2;
}

export function milestoneState(milestone: Milestone): ItemState {
  const filled = milestone.bullets.filter((bullet) => lineDone(bullet)).length;
  if (filled === 0 && milestone.optional && milestone.waivedReason.trim().length >= 3) return "waived";
  if (filled === 0) return "missing";
  if (filled < milestone.bullets.length) return "partial";
  return "in-file";
}

export function workingPathway(matter: ClientCase): PetitionTrack | "" {
  if (matter.pathway === "eb2-niw" || matter.pathway === "eb1a") return matter.pathway;
  if (matter.pathway === "both") return matter.activePathway;
  return "";
}

export function applicableMilestones(matter: ClientCase): Milestone[] {
  const pathway = workingPathway(matter);
  if (!pathway) return [];
  return matter.milestones.filter((milestone) => milestone.pathways.includes(pathway));
}

export function checklistCounts(matter: ClientCase): {
  requiredMet: number;
  requiredTotal: number;
  optionalOpen: number;
} {
  const items = applicableMilestones(matter);
  const required = items.filter((milestone) => !milestone.optional);
  const optional = items.filter((milestone) => milestone.optional);
  return {
    requiredMet: required.filter((milestone) => milestoneState(milestone) === "in-file").length,
    requiredTotal: required.length,
    optionalOpen: optional.filter((milestone) => {
      const state = milestoneState(milestone);
      return state !== "in-file" && state !== "waived";
    }).length,
  };
}

export function profileReady(matter: ClientCase): boolean {
  return matter.baseline.length > 0 && matter.baseline.every((line) => line.rating !== "");
}

function eb2Wording(matter: ClientCase): boolean {
  return (
    matter.endeavorSentence.trim().length >= 40 &&
    matter.mechanism.trim().length > 0 &&
    matter.beneficiaries.trim().length > 0
  );
}

function eb1Wording(matter: ClientCase): boolean {
  return matter.fieldArea.trim().length >= 8;
}

export function endeavorReady(matter: ClientCase): boolean {
  return eb2Wording(matter) || eb1Wording(matter);
}

export function pathwayReady(matter: ClientCase): boolean {
  const pathway = workingPathway(matter);
  if (!pathway) return false;
  if (matter.pathway === "both") return eb2Wording(matter) && eb1Wording(matter);
  if (pathway === "eb1a") return eb1Wording(matter);
  return eb2Wording(matter);
}

export function cvOnFile(matter: ClientCase): boolean {
  return matter.cvFileName.trim().length > 0 || matter.cvText.trim().length >= 80;
}

export function cvReady(matter: ClientCase): boolean {
  return cvOnFile(matter) && matter.cvText.trim().length >= 80 && matter.cvChecked;
}

export function positioningReady(matter: ClientCase): boolean {
  if (!profileReady(matter) || !pathwayReady(matter) || !cvReady(matter)) return false;
  const counts = checklistCounts(matter);
  return counts.requiredTotal > 0 && counts.requiredMet === counts.requiredTotal && counts.optionalOpen === 0;
}

export function stageReady(stage: StageId, matter: ClientCase): boolean {
  if (stage === "profile") return profileReady(matter);
  if (stage === "endeavor") return endeavorReady(matter);
  if (stage === "pathway") return pathwayReady(matter);
  if (stage === "cv") return cvReady(matter);
  return positioningReady(matter);
}

export function stageLabel(stage: StageId): string {
  return STAGES.find((item) => item.id === stage)?.label ?? stage;
}

export function pathwayLabel(pathway: PathwayChoice, active: PetitionTrack | ""): string {
  if (pathway === "both") {
    return active === "eb1a" ? "Both — EB-1A active" : active === "eb2-niw" ? "Both — EB-2 NIW active" : "Both drafts";
  }
  if (pathway === "eb1a") return "EB-1A";
  if (pathway === "eb2-niw") return "EB-2 NIW";
  return "Pathway not set";
}

export function openPeriod(matter: ClientCase): Period | null {
  return matter.periods.find((period) => !period.closedAt) ?? null;
}

export function nextReviewDate(matter: ClientCase): string {
  const closed = [...matter.periods].reverse().find((period) => period.closedAt);
  return closed?.nextReview ?? "";
}

export function reviewStatus(matter: ClientCase, today = todayISO()): "open" | "due" | "scheduled" | "unset" {
  if (openPeriod(matter)) return "open";
  const review = nextReviewDate(matter);
  if (!review) return "unset";
  return review <= today ? "due" : "scheduled";
}

export function todayISO(date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function createCase(input: {
  name: string;
  email: string;
  phone: string;
  matterRef: string;
}): ClientCase {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name: input.name.trim(),
    email: input.email.trim(),
    phone: input.phone.trim(),
    matterRef: input.matterRef.trim(),
    createdAt: now,
    updatedAt: now,
    stage: "profile",
    pathway: "",
    activePathway: "",
    endeavorSentence: "",
    mechanism: "",
    beneficiaries: "",
    niFrame: "",
    fieldArea: "",
    continueWork: "",
    cvFileName: "",
    cvText: "",
    cvChecked: false,
    baseline: BASELINE.map((line) => ({ ...line, rating: "" })),
    milestones: MILESTONE_SEEDS.map((seed) => ({
      ...seed,
      waivedReason: "",
      bullets: seed.bullets.map((label) => ({
        id: crypto.randomUUID(),
        label,
        documentName: "",
        done: false,
      })),
    })),
    quotesEb2: WELL_POSITIONED_FACTORS.map((factor) => ({
      id: factor.id,
      label: factor.label,
      quote: "",
      inCv: false,
    })),
    quotesEb1a: EB1A_CRITERIA.map((criterion) => ({
      id: criterion.id,
      label: criterion.label,
      quote: "",
      inCv: false,
    })),
    periods: [
      {
        id: crypto.randomUUID(),
        number: 1,
        openedAt: now,
        closedAt: null,
        nextReview: "",
        stageAtOpen: "profile",
        note: "",
        summary: "",
      },
    ],
    readyForDraft: false,
  };
}

export function touch(matter: ClientCase): ClientCase {
  const ready = matter.readyForDraft && positioningReady(matter);
  return { ...matter, readyForDraft: ready, updatedAt: new Date().toISOString() };
}

export function advanceStage(matter: ClientCase): ClientCase | null {
  if (!openPeriod(matter) || !stageReady(matter.stage, matter)) return null;
  const index = STAGES.findIndex((stage) => stage.id === matter.stage);
  const next = STAGES[index + 1];
  if (!next) return null;
  return touch({ ...matter, stage: next.id });
}

export function replaceCaseCv(matter: ClientCase, fileName: string, text = ""): ClientCase {
  return touch({
    ...matter,
    cvFileName: fileName,
    cvText: text,
    cvChecked: false,
    quotesEb2: matter.quotesEb2.map((row) => ({ ...row, inCv: false })),
    quotesEb1a: matter.quotesEb1a.map((row) => ({ ...row, inCv: false })),
  });
}

export function checkCvQuotes(matter: ClientCase): ClientCase {
  const mark = (rows: QuoteRow[]) =>
    rows.map((row) => ({ ...row, inCv: quoteFoundInCv(matter.cvText, row.quote) }));
  return touch({
    ...matter,
    cvChecked: matter.cvText.trim().length >= 80,
    quotesEb2: mark(matter.quotesEb2),
    quotesEb1a: mark(matter.quotesEb1a),
  });
}

export function closePeriod(matter: ClientCase, note: string, nextReview: string): ClientCase | null {
  const current = openPeriod(matter);
  if (!current || note.trim().length < 3 || !nextReview) return null;
  const counts = checklistCounts(matter);
  const costs = costTotals(matter.milestones);
  const summary = `${stageLabel(matter.stage)}. ${pathwayLabel(matter.pathway, matter.activePathway)}. Required complete: ${counts.requiredMet} of ${counts.requiredTotal}. Costs: ${usd(costs.estimated)} estimated; ${usd(costs.actual)} actual; ${usd(costs.paid)} paid; ${usd(costs.outstanding)} outstanding; ${usd(costs.advance)} advance or credit. ${costs.actualUnknown} recorded costs without an actual amount.`;
  return touch({
    ...matter,
    periods: matter.periods.map((period) =>
      period.id === current.id
        ? { ...period, closedAt: new Date().toISOString(), note: note.trim(), nextReview, summary }
        : period
    ),
  });
}

export function startPeriod(matter: ClientCase): ClientCase | null {
  if (openPeriod(matter)) return null;
  const last = matter.periods[matter.periods.length - 1];
  const period: Period = {
    id: crypto.randomUUID(),
    number: (last?.number ?? 0) + 1,
    openedAt: new Date().toISOString(),
    closedAt: null,
    nextReview: "",
    stageAtOpen: matter.stage,
    note: "",
    summary: "",
  };
  return touch({ ...matter, periods: [...matter.periods, period] });
}

export function loadCases(): ClientCase[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CASES_STORAGE);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ClientCase[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeCase);
  } catch {
    return [];
  }
}

export function saveCases(cases: ClientCase[]) {
  localStorage.setItem(CASES_STORAGE, JSON.stringify(cases));
  if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
    window.dispatchEvent(new Event(CASES_CHANGED_EVENT));
  }
}

export function upsertCase(matter: ClientCase) {
  const all = loadCases();
  const index = all.findIndex((item) => item.id === matter.id);
  if (index === -1) all.unshift(matter);
  else all[index] = matter;
  saveCases(all);
}

export function removeCase(id: string) {
  saveCases(loadCases().filter((matter) => matter.id !== id));
}

function normalizeCase(matter: ClientCase): ClientCase {
  return {
    ...matter,
    stage: caseStage(matter.stage),
    milestones: (matter.milestones ?? []).map((milestone) => ({
      ...milestone,
      bullets: (milestone.bullets ?? []).map((bullet) => ({
        ...bullet,
        documentName: bullet.documentName ?? "",
        done: typeof bullet.done === "boolean" ? bullet.done : (bullet.documentName ?? "").trim().length >= 2,
      })),
    })),
  };
}

export function stateLabel(state: ItemState): string {
  if (state === "in-file") return "Complete";
  if (state === "partial") return "Partial";
  if (state === "waived") return "Left out";
  return "Open";
}
