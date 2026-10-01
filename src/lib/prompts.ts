import type { CvRecord, Intake } from "./types";

const LAW = `Dhanasar NIW: endeavor must be more specific than a job; national importance is the prospective impact of THIS work, not the field; do not invent facts, cases, or biography; never say the person qualifies or will be approved. Job-creation claims are not enough for entrepreneurs.`;

export const endeavorSystem = `${LAW}
Draft EB-2 NIW proposed-endeavor language. No CV yet. No well-positioning. JSON only:
{"options":[{"id":"conservative|core|stretch","label":"","sentence":"","description":"","nationalImportanceFrame":""}],"warnings":[]}
Exactly 3 options. sentence = one specific project sentence. description ~80 words. nationalImportanceFrame = impact of this work, not the industry. warnings if occupation-only, local service, or generic startup.`;

export function endeavorUser(intake: Intake): string {
  return `Domain: ${intake.domain}
Problem: ${intake.problem}
Mechanism: ${intake.mechanism}
US beneficiaries: ${intake.beneficiaries}
Role: ${intake.roleType}
Progress: ${intake.progress || "none"}`;
}

export const parseSystem = `${LAW}
Extract ONLY facts in the CV. Empty string/array if absent. Never invent. JSON:
{"degrees":[{"degree":"","field":"","institution":"","year":""}],"occupation":"","yearsExperience":"","projects":[{"title":"","summary":""}],"publications":[],"patents":[],"grantsOrFunding":[],"leadership":[],"skills":[],"progressTowardEndeavor":[],"gaps":[]}`;

export function parseUser(cvText: string, endeavorSentence: string): string {
  return `Endeavor (context only): ${endeavorSentence}\n\nCV:\n${cvText}`;
}

export const fitSystem = `${LAW}
Compare endeavor to CV. JSON:
{"recommended":"keep|narrow|pivot","rationale":"","narrowedSentence":"","pivotSentence":"","missingExhibits":[],"recordFitNotes":[]}
keep = record already in this subdomain. narrow = endeavor too big. pivot = mismatch. Do not invent evidence.`;

export function fitUser(args: {
  sentence: string;
  description: string;
  niFrame: string;
  record: CvRecord;
}): string {
  return `Endeavor: ${args.sentence}
Description: ${args.description}
NI frame: ${args.niFrame}
CV JSON: ${JSON.stringify(args.record)}`;
}

export const skeletonsSystem = `${LAW}
Two skeletal drafts, not a petition. JSON:
{"chosenSentence":"","wellPositioning":{"paragraphs":[],"claimedFacts":[{"claim":"","cvSpan":"","supported":true}]},"nationalImportance":{"paragraphs":[],"claimedFacts":[{"claim":"","cvSpan":"","supported":true}]},"gaps":[]}
wellPositioning: 3 short paragraphs, CV facts only; missing facts as [GAP: ].
nationalImportance: 3 short paragraphs on THIS endeavor's prospective impact, not field importance.
chosenSentence is the full endeavor sentence after applying keep, narrow, or pivot — not the word keep/narrow/pivot.`;

export function skeletonsUser(args: {
  choice: string;
  sentence: string;
  description: string;
  niFrame: string;
  fitRationale: string;
  narrowedSentence: string;
  pivotSentence: string;
  record: CvRecord;
  cvExcerpt: string;
}): string {
  return `Choice: ${args.choice}
Original: ${args.sentence}
Narrow: ${args.narrowedSentence}
Pivot: ${args.pivotSentence}
Why: ${args.fitRationale}
Description: ${args.description}
NI frame: ${args.niFrame}
CV JSON: ${JSON.stringify(args.record)}
CV excerpt: ${args.cvExcerpt}`;
}
