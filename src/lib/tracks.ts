import { quoteFoundInCv } from "./framework";

/** Self-petition tracks this studio drafts. EB-1B and EB-1C need a U.S. employer. */
export type PetitionTrack = "eb2-niw" | "eb1a";

export const STUDIO_STORAGE = "petitionpro-v1";

export function asTrack(value: unknown): PetitionTrack {
  return value === "eb1a" ? "eb1a" : "eb2-niw";
}

export function trackProfile(track: PetitionTrack) {
  if (track === "eb1a") {
    return {
      id: track,
      short: "EB-1A",
      workNoun: "Field of extraordinary ability",
      workPlaceholder: "The field the person has already worked in, stated specifically",
      minChars: 8,
      tooShort: "Name the field of extraordinary ability before matching projects.",
      impactLabel: "Criterion this could evidence",
      pathLabel: "Evidence path",
      projectLede:
        "EB-1A. Describe the field of extraordinary ability. Projects are possible evidence paths under the regulatory criteria. They are not a Dhanasar national-interest showing. GitHub finds public repositories. Groq suggests projects it knows.",
    };
  }
  return {
    id: track,
    short: "EB-2 NIW",
    workNoun: "Proposed endeavor",
    workPlaceholder:
      "Paste the proposed endeavor: the specific work, the mechanism, and who in the United States benefits",
    minChars: 40,
    tooShort:
      "Paste a proposed endeavor of at least a few sentences so the projects can be matched to specific work.",
    impactLabel: "National importance",
    pathLabel: "Well positioning",
    projectLede:
      "EB-2 NIW. Paste a proposed endeavor. Projects are matched for national importance and well positioning under Dhanasar. GitHub finds public repositories. Groq suggests projects it knows.",
  };
}

/**
 * EB-1A initial-evidence criteria, 8 C.F.R. 204.5(h)(3).
 * USCIS Policy Manual, Volume 6, Part F, Chapter 2.
 * A quote under a criterion is not a finding that the criterion is met.
 * Final merits is a separate determination.
 */
export const EB1A_CRITERIA = [
  {
    id: "awards",
    label: "Nationally or internationally recognized prizes or awards for excellence",
    hint: "Lesser nationally or internationally recognized prizes or awards for excellence in the field. Not a one-time major award such as a Nobel.",
  },
  {
    id: "membership",
    label: "Membership in associations that require outstanding achievements",
    hint: "Membership in associations in the field that require outstanding achievements of their members, judged by recognized national or international experts.",
  },
  {
    id: "published-material",
    label: "Published material about the person in professional or major media",
    hint: "Published material about the person, relating to the work in the field, in professional or major trade publications or other major media. Not articles the person wrote.",
  },
  {
    id: "judging",
    label: "Judging the work of others in the same or an allied field",
    hint: "Participation, individually or on a panel, as a judge of the work of others in the same or an allied field.",
  },
  {
    id: "contributions",
    label: "Original contributions of major significance in the field",
    hint: "Original scientific, scholarly, artistic, athletic, or business-related contributions of major significance in the field.",
  },
  {
    id: "authorship",
    label: "Authorship of scholarly articles in the field",
    hint: "Authorship of scholarly articles in the field, in professional or major trade publications or other major media.",
  },
  {
    id: "display",
    label: "Display of work at artistic exhibitions or showcases",
    hint: "Display of the person's work in the field at artistic exhibitions or showcases.",
  },
  {
    id: "leading-role",
    label: "Leading or critical role for organizations with a distinguished reputation",
    hint: "A leading or critical role for organizations or establishments that have a distinguished reputation.",
  },
  {
    id: "remuneration",
    label: "High salary or other significantly high remuneration for the field",
    hint: "A high salary or other significantly high remuneration for services, in relation to others in the field.",
  },
  {
    id: "commercial",
    label: "Commercial successes in the performing arts",
    hint: "Commercial successes in the performing arts, such as box office receipts or recorded sales.",
  },
] as const;

export type Eb1aCriterion = (typeof EB1A_CRITERIA)[number]["id"];

export type CriterionItem = {
  criterion: Eb1aCriterion;
  fact: string;
  cvSpan: string;
  inCv: boolean;
};

const MAX_PER_CRITERION = 2;

const CRITERION_ALIASES: Record<string, Eb1aCriterion> = {
  prizes: "awards",
  award: "awards",
  memberships: "membership",
  associations: "membership",
  media: "published-material",
  press: "published-material",
  "about-the-person": "published-material",
  judge: "judging",
  judging: "judging",
  original: "contributions",
  contribution: "contributions",
  "major-significance": "contributions",
  articles: "authorship",
  scholarly: "authorship",
  authorship: "authorship",
  exhibition: "display",
  showcase: "display",
  leading: "leading-role",
  "critical-role": "leading-role",
  salary: "remuneration",
  "high-salary": "remuneration",
  remuneration: "remuneration",
  "box-office": "commercial",
  "performing-arts": "commercial",
};

export function criterionGuide(): string {
  return EB1A_CRITERIA.map((criterion) => `${criterion.id}: ${criterion.hint}`).join("\n");
}

export function checkCriteria(raw: unknown, cvText: string): CriterionItem[] {
  const counts = new Map<Eb1aCriterion, number>();
  const seen = new Set<string>();
  const out: CriterionItem[] = [];
  for (const item of coerceCriteria(raw)) {
    const quote = item.cvSpan.trim() || item.fact.trim();
    if (!quote) continue;
    const key = collapse(quote);
    if (seen.has(key)) continue;
    seen.add(key);
    const used = counts.get(item.criterion) ?? 0;
    if (used >= MAX_PER_CRITERION) continue;
    counts.set(item.criterion, used + 1);
    out.push({
      criterion: item.criterion,
      fact: quote,
      cvSpan: quote,
      inCv: quoteFoundInCv(cvText, quote),
    });
  }
  return out;
}

export function criteriaWithQuotes(items: CriterionItem[]): number {
  return EB1A_CRITERIA.filter((criterion) =>
    items.some((item) => item.criterion === criterion.id && item.inCv)
  ).length;
}

function coerceCriteria(raw: unknown): CriterionItem[] {
  if (Array.isArray(raw)) return raw.flatMap((entry) => itemFrom(entry));
  if (!raw || typeof raw !== "object") return [];
  return Object.entries(raw as Record<string, unknown>).flatMap(([key, value]) => {
    const criterion = criterionId(key);
    if (!criterion) return [];
    const entries = Array.isArray(value) ? value : [value];
    return entries.flatMap((entry) => {
      if (typeof entry === "string") {
        const quote = entry.trim();
        if (!quote) return [];
        return [{ criterion, fact: quote, cvSpan: quote, inCv: false }];
      }
      return itemFrom(entry, criterion);
    });
  });
}

function itemFrom(entry: unknown, forced?: Eb1aCriterion): CriterionItem[] {
  if (!entry || typeof entry !== "object") return [];
  const row = entry as Record<string, unknown>;
  const fact = text(row.fact) || text(row.claim) || text(row.text);
  const cvSpan = text(row.cvSpan) || text(row.quote) || text(row.span);
  const criterion = forced ?? criterionId(text(row.criterion) || text(row.id) || text(row.factor));
  if (!criterion || (!fact && !cvSpan)) return [];
  return [
    {
      criterion,
      fact: fact || cvSpan,
      cvSpan: cvSpan || fact,
      inCv: false,
    },
  ];
}

function criterionId(raw: string): Eb1aCriterion | null {
  const key = raw.trim().toLowerCase().replace(/[_\s]+/g, "-");
  if (!key) return null;
  if (EB1A_CRITERIA.some((criterion) => criterion.id === key)) return key as Eb1aCriterion;
  return CRITERION_ALIASES[key] ?? null;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function collapse(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}
