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
    progressTowardEndeavor: stringArray,
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

export const skeletonsSchema = obj(
  {
    chosenSentence: str,
    wellPositioning: draft,
    nationalImportance: draft,
    gaps: stringArray,
  },
  ["chosenSentence", "wellPositioning", "nationalImportance", "gaps"]
);
