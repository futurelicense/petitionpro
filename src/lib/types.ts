import type { ProgressItem } from "./framework";
import type { CriterionItem, PetitionTrack } from "./tracks";

export type { PetitionTrack };

export type RoleType = "researcher" | "entrepreneur" | "practitioner";

export type EndeavorId = "conservative" | "core" | "stretch";

export type FitChoice = "keep" | "narrow" | "pivot";

export type Step =
  | "disclaimer"
  | "track"
  | "field"
  | "intake"
  | "endeavor"
  | "upload"
  | "record"
  | "fit"
  | "skeletons";

export type Intake = {
  domain: string;
  problem: string;
  mechanism: string;
  beneficiaries: string;
  roleType: RoleType;
  progress: string;
};

export type EndeavorOption = {
  id: EndeavorId;
  label: string;
  sentence: string;
  description: string;
  nationalImportanceFrame: string;
};

export type EndeavorResult = {
  options: EndeavorOption[];
  warnings: string[];
};

export type CvDegree = {
  degree: string;
  field: string;
  institution: string;
  year: string;
};

export type CvProject = {
  title: string;
  summary: string;
};

export type CvRecord = {
  degrees: CvDegree[];
  occupation: string;
  yearsExperience: string;
  projects: CvProject[];
  publications: string[];
  patents: string[];
  grantsOrFunding: string[];
  leadership: string[];
  skills: string[];
  progressTowardEndeavor: ProgressItem[];
  extraordinaryAbility: CriterionItem[];
  gaps: string[];
};

export type FitResult = {
  recommended: FitChoice;
  rationale: string;
  narrowedSentence: string;
  pivotSentence: string;
  missingExhibits: string[];
  recordFitNotes: string[];
};

export type ClaimSpan = {
  claim: string;
  cvSpan: string;
  supported: boolean;
};

export type SkeletonDraft = {
  paragraphs: string[];
  claimedFacts: ClaimSpan[];
};

export type SkeletonsResult = {
  chosenSentence: string;
  wellPositioning: SkeletonDraft;
  nationalImportance: SkeletonDraft;
  gaps: string[];
};

export type Eb1aDraft = {
  area: string;
  paragraphs: string[];
  claimedFacts: ClaimSpan[];
  gaps: string[];
};

export type OpenSourceMatch = {
  name: string;
  url: string;
  summary: string;
  frameworkConcept: string;
  alignment: string;
  nationalImportance: string;
  wellPositioning: string;
};

export type OpenSourceResult = {
  projects: OpenSourceMatch[];
  warnings: string[];
};

export const emptyIntake = (): Intake => ({
  domain: "",
  problem: "",
  mechanism: "",
  beneficiaries: "",
  roleType: "researcher",
  progress: "",
});

export const emptyRecord = (): CvRecord => ({
  degrees: [],
  occupation: "",
  yearsExperience: "",
  projects: [],
  publications: [],
  patents: [],
  grantsOrFunding: [],
  leadership: [],
  skills: [],
  progressTowardEndeavor: [],
  extraordinaryAbility: [],
  gaps: [],
});
