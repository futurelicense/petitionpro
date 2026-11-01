import {
  applicableMilestones,
  checklistCounts,
  milestoneState,
  pathwayLabel,
  stageLabel,
  workingPathway,
  type ClientCase,
} from "./cases";

export const IDEAS_STORAGE = "petitionpro-ideas-v1";

export type IdeaAction = {
  id: string;
  caseId: string;
  caseName: string;
  createdAt: string;
  insight: string;
  recommendation: string;
  suggestion: string;
};

export type Idea = {
  id: string;
  title: string;
  source: string;
  note: string;
  createdAt: string;
  actions: IdeaAction[];
};

export function createIdea(input: { title: string; source: string; note: string }): Idea {
  return {
    id: crypto.randomUUID(),
    title: input.title.trim(),
    source: input.source.trim(),
    note: input.note.trim(),
    createdAt: new Date().toISOString(),
    actions: [],
  };
}

export function caseBrief(matter: ClientCase): string {
  const open = applicableMilestones(matter)
    .filter((milestone) => !milestone.optional && milestoneState(milestone) !== "in-file")
    .map((milestone) => milestone.name);
  const counts = checklistCounts(matter);
  const ratings = matter.baseline.map((line) => `${line.label}: ${line.rating || "not rated"}`);
  return [
    `Client: ${matter.name}`,
    `Stage: ${stageLabel(matter.stage)}`,
    `Pathway: ${pathwayLabel(matter.pathway, matter.activePathway)}`,
    matter.endeavorSentence.trim() ? `Proposed endeavor: ${clip(matter.endeavorSentence, 900)}` : "",
    matter.mechanism.trim() ? `Mechanism: ${clip(matter.mechanism, 400)}` : "",
    matter.beneficiaries.trim() ? `U.S. beneficiaries: ${clip(matter.beneficiaries, 400)}` : "",
    matter.fieldArea.trim() ? `Field: ${clip(matter.fieldArea, 300)}` : "",
    `Current ratings: ${ratings.join("; ") || "none"}`,
    `Required complete: ${counts.requiredMet} of ${counts.requiredTotal}`,
    open.length ? `Required milestones still open: ${open.join("; ")}` : "No required milestone is still open.",
  ]
    .filter(Boolean)
    .join("\n");
}

export function loadIdeas(): Idea[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(IDEAS_STORAGE);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Idea[];
    return Array.isArray(parsed) ? parsed.map(normalizeIdea) : [];
  } catch {
    return [];
  }
}

export function saveIdeas(ideas: Idea[]) {
  localStorage.setItem(IDEAS_STORAGE, JSON.stringify(ideas));
}

export function removeIdea(id: string) {
  saveIdeas(loadIdeas().filter((idea) => idea.id !== id));
}

function normalizeIdea(idea: Idea): Idea {
  return { ...idea, source: idea.source ?? "", actions: idea.actions ?? [] };
}

function clip(value: string, max: number) {
  const text = value.trim();
  return text.length <= max ? text : `${text.slice(0, max)}…`;
}
