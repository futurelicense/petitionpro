import { WELL_POSITIONED_FACTORS } from "./framework";
import { EB1A_CRITERIA } from "./tracks";

const str = { type: "string" } as const;

function obj(
  properties: Record<string, unknown>,
  required: string[]
): Record<string, unknown> {
  return {
    type: "object",
    additionalProperties: false,
    properties,
    required,
  };
}

const stringArray = {
  type: "array",
  items: str,
};

export const endeavorSchema = obj(
  {
    options: {
      type: "array",
      items: obj(
        {
          id: str,
          label: str,
          sentence: str,
          description: str,
          nationalImportanceFrame: str,
        },
        ["id", "label", "sentence", "description", "nationalImportanceFrame"]
      ),
    },
    warnings: stringArray,
  },
  ["options", "warnings"]
);

export const parseSchema = obj(
  {
    degrees: {
      type: "array",
      items: obj(
        {
          degree: str,
          field: str,
          institution: str,
          year: str,
        },
        ["degree", "field", "institution", "year"]
      ),
    },
    occupation: str,
    yearsExperience: str,
    projects: {
      type: "array",
      items: obj(
        {
          title: str,
          summary: str,
        },
        ["title", "summary"]
      ),
    },
    publications: stringArray,
    patents: stringArray,
    grantsOrFunding: stringArray,
    leadership: stringArray,
    skills: stringArray,
    progressTowardEndeavor: {
      type: "array",
      items: obj(
        {
          factor: {
            type: "string",
            enum: WELL_POSITIONED_FACTORS.map((factor) => factor.id),
          },
          fact: str,
          cvSpan: str,
        },
        ["factor", "fact", "cvSpan"]
      ),
    },
    gaps: stringArray,
  },
  [
    "degrees",
    "occupation",
    "yearsExperience",
    "projects",
    "publications",
    "patents",
    "grantsOrFunding",
    "leadership",
    "skills",
    "progressTowardEndeavor",
    "gaps",
  ]
);

const citedQuote = (idEnum: readonly string[]) =>
  obj(
    {
      criterion: { type: "string", enum: [...idEnum] },
      fact: str,
      cvSpan: str,
    },
    ["criterion", "fact", "cvSpan"]
  );

export const parseEb1aSchema = obj(
  {
    degrees: parseSchema.properties
      ? (parseSchema.properties as { degrees: unknown }).degrees
      : { type: "array" },
    occupation: str,
    yearsExperience: str,
    projects: parseSchema.properties
      ? (parseSchema.properties as { projects: unknown }).projects
      : { type: "array" },
    publications: stringArray,
    patents: stringArray,
    grantsOrFunding: stringArray,
    leadership: stringArray,
    skills: stringArray,
    extraordinaryAbility: {
      type: "array",
      items: citedQuote(EB1A_CRITERIA.map((criterion) => criterion.id)),
    },
    gaps: stringArray,
  },
  [
    "degrees",
    "occupation",
    "yearsExperience",
    "projects",
    "publications",
    "patents",
    "grantsOrFunding",
    "leadership",
    "skills",
    "extraordinaryAbility",
    "gaps",
  ]
);

export const fitSchema = obj(
  {
    recommended: str,
    rationale: str,
    narrowedSentence: str,
    pivotSentence: str,
    missingExhibits: stringArray,
    recordFitNotes: stringArray,
  },
  [
    "recommended",
    "rationale",
    "narrowedSentence",
    "pivotSentence",
    "missingExhibits",
    "recordFitNotes",
  ]
);

const claim = obj(
  {
    claim: str,
    cvSpan: str,
    supported: { type: "boolean" },
  },
  ["claim", "cvSpan", "supported"]
);

const draft = obj(
  {
    paragraphs: stringArray,
    claimedFacts: { type: "array", items: claim },
  },
  ["paragraphs", "claimedFacts"]
);

export const openSourceDiscoverSchema = obj(
  {
    subject: str,
    angles: stringArray,
  },
  ["subject", "angles"]
);

const openSourceMatch = obj(
  {
    index: { type: "integer" },
    frameworkConcept: str,
    alignment: str,
    nationalImportance: str,
    wellPositioning: str,
  },
  [
    "index",
    "frameworkConcept",
    "alignment",
    "nationalImportance",
    "wellPositioning",
  ]
);

const suggestedMatch = obj(
  {
    name: str,
    url: str,
    summary: str,
    frameworkConcept: str,
    alignment: str,
    nationalImportance: str,
    wellPositioning: str,
  },
  [
    "name",
    "url",
    "summary",
    "frameworkConcept",
    "alignment",
    "nationalImportance",
    "wellPositioning",
  ]
);

export const openSourceSuggestSchema = obj(
  {
    projects: { type: "array", items: suggestedMatch },
    warnings: stringArray,
  },
  ["projects", "warnings"]
);

export const openSourceSchema = obj(
  {
    projects: { type: "array", items: openSourceMatch },
    warnings: stringArray,
  },
  ["projects", "warnings"]
);

export const skeletonsSchema = obj(
  {
    chosenSentence: str,
    wellPositioning: draft,
    nationalImportance: draft,
    gaps: stringArray,
  },
  ["chosenSentence", "wellPositioning", "nationalImportance", "gaps"]
);
