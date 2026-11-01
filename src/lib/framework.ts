/**
 * Dhanasar prong 2, as USCIS describes it in the Policy Manual,
 * Volume 6, Part F, Chapter 5. These are factors USCIS may consider,
 * among others. They are not a checklist, and a gap is not a decision.
 * Prong 1 (substantial merit and national importance) and prong 3
 * (waiving the job offer) are outside this cross-check.
 */
export const WELL_POSITIONED_FACTORS = [
  {
    id: "education-skills-record",
    label:
      "The person's education, skills, knowledge, and record of success in related or similar efforts",
    hint: "Degrees, skills, knowledge, or a record of success in efforts related to this endeavor. CV lines only.",
  },
  {
    id: "model-or-plan",
    label: "A model or plan for future activities",
    hint: "A model or plan the CV itself states for future work. Leave this factor empty when the CV states no plan.",
  },
  {
    id: "progress",
    label: "Any progress towards achieving the proposed endeavor",
    hint: "Work the CV shows is already done toward this specific endeavor, not the field in general.",
  },
  {
    id: "stakeholder-interest",
    label:
      "The interest of potential customers, users, investors, or other relevant entities",
    hint: "Interest the CV documents from customers, users, investors, or other relevant entities. Leave this factor empty when the CV documents none.",
  },
] as const;

export type WellPositionedFactor = (typeof WELL_POSITIONED_FACTORS)[number]["id"];

export type ProgressItem = {
  factor: WellPositionedFactor;
  fact: string;
  cvSpan: string;
  inCv: boolean;
};

const MAX_PER_FACTOR = 4;
const MIN_QUOTE = 8;

const FACTOR_ALIASES: Record<string, WellPositionedFactor> = {
  education: "education-skills-record",
  skills: "education-skills-record",
  knowledge: "education-skills-record",
  record: "education-skills-record",
  "record-of-success": "education-skills-record",
  plan: "model-or-plan",
  model: "model-or-plan",
  "future-activities": "model-or-plan",
  endeavor: "progress",
  "progress-toward-endeavor": "progress",
  stakeholder: "stakeholder-interest",
  interest: "stakeholder-interest",
  customers: "stakeholder-interest",
  investors: "stakeholder-interest",
  users: "stakeholder-interest",
};

export function progressFactorGuide(): string {
  return WELL_POSITIONED_FACTORS.map((factor) => `${factor.id}: ${factor.hint}`).join(
    "\n"
  );
}

export function quoteFoundInCv(cvText: string, span: string): boolean {
  const needle = collapse(span);
  if (needle.length < MIN_QUOTE) return false;
  return collapse(cvText).includes(needle);
}

export function itemInCv(
  item: { fact: string; cvSpan: string },
  cvText: string
): boolean {
  const span = item.cvSpan.trim();
  if (span) return quoteFoundInCv(cvText, span);
  return quoteFoundInCv(cvText, item.fact);
}

export function checkProgress(raw: unknown, cvText: string): ProgressItem[] {
  const counts = new Map<WellPositionedFactor, number>();
  const seen = new Set<string>();
  const out: ProgressItem[] = [];
  for (const item of coerceProgress(raw)) {
    const quote = item.cvSpan.trim() || item.fact.trim();
    if (!quote) continue;
    const key = collapse(quote);
    if (seen.has(key)) continue;
    seen.add(key);
    const used = counts.get(item.factor) ?? 0;
    if (used >= MAX_PER_FACTOR) continue;
    counts.set(item.factor, used + 1);
    out.push({
      factor: item.factor,
      fact: quote,
      cvSpan: quote,
      inCv: quoteFoundInCv(cvText, quote),
    });
  }
  return out;
}

export function withCheckedProgress<T extends { progressTowardEndeavor?: unknown }>(
  record: T,
  cvText: string
): T & { progressTowardEndeavor: ProgressItem[] } {
  return {
    ...record,
    progressTowardEndeavor: checkProgress(record.progressTowardEndeavor, cvText),
  };
}

function coerceProgress(raw: unknown): ProgressItem[] {
  if (Array.isArray(raw)) return raw.flatMap((entry) => itemFrom(entry));
  if (raw && typeof raw === "object") {
    return Object.entries(raw as Record<string, unknown>).flatMap(([key, value]) => {
      const factor = factorId(key);
      const list = Array.isArray(value) ? value : [value];
      return list.flatMap((entry) => itemFrom(entry, factor));
    });
  }
  return [];
}

function itemFrom(entry: unknown, forced?: WellPositionedFactor): ProgressItem[] {
  if (typeof entry === "string") {
    const fact = entry.trim();
    if (!fact) return [];
    return [{ factor: forced ?? "progress", fact, cvSpan: fact, inCv: false }];
  }
  if (!entry || typeof entry !== "object") return [];
  const row = entry as Record<string, unknown>;
  const fact = text(row.fact) || text(row.claim) || text(row.text);
  const cvSpan = text(row.cvSpan) || text(row.quote) || text(row.span);
  if (!fact && !cvSpan) return [];
  return [
    {
      factor: forced ?? factorId(text(row.factor) || text(row.id)),
      fact: fact || cvSpan,
      cvSpan: cvSpan || fact,
      inCv: false,
    },
  ];
}

function factorId(raw: string): WellPositionedFactor {
  const key = raw.trim().toLowerCase().replace(/[_\s]+/g, "-");
  if (WELL_POSITIONED_FACTORS.some((factor) => factor.id === key)) {
    return key as WellPositionedFactor;
  }
  return FACTOR_ALIASES[key] ?? "progress";
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function collapse(value: string): string {
  return value
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}
