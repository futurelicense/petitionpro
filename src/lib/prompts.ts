import { progressFactorGuide } from "./framework";
import { criterionGuide, type PetitionTrack } from "./tracks";
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
{"degrees":[{"degree":"","field":"","institution":"","year":""}],"occupation":"","yearsExperience":"","projects":[{"title":"","summary":""}],"publications":[],"patents":[],"grantsOrFunding":[],"leadership":[],"skills":[],"progressTowardEndeavor":[{"factor":"education-skills-record|model-or-plan|progress|stakeholder-interest","fact":"","cvSpan":""}],"gaps":[]}
progressTowardEndeavor is a Dhanasar prong 2 cross-check only (USCIS Policy Manual, Volume 6, Part F, Chapter 5). It is not national importance and it is not a finding that anyone is well positioned or qualifies.
${progressFactorGuide()}
cvSpan is a verbatim quote from the CV. fact must not go beyond that quote. Omit a factor the CV does not support. Do not file the same quote under two factors.`;

export function parseUser(cvText: string, endeavorSentence: string): string {
  return `Endeavor (context only): ${endeavorSentence}\n\nCV:\n${cvText}`;
}

export const parseSystemEb1a = `EB-1A extraordinary ability. Do not use Dhanasar, a proposed endeavor, national importance, or well positioning. Do not invent facts. Never say the person qualifies, meets a criterion, or is at the top of the field.
Extract ONLY facts in the CV. Empty string/array if absent. Never invent. JSON:
{"degrees":[{"degree":"","field":"","institution":"","year":""}],"occupation":"","yearsExperience":"","projects":[{"title":"","summary":""}],"publications":[],"patents":[],"grantsOrFunding":[],"leadership":[],"skills":[],"extraordinaryAbility":[{"criterion":"awards|membership|published-material|judging|contributions|authorship|display|leading-role|remuneration|commercial","fact":"","cvSpan":""}],"gaps":[]}
extraordinaryAbility files a CV quote under one regulatory criterion for the initial-evidence step only (8 C.F.R. 204.5(h)(3); Policy Manual, Volume 6, Part F, Chapter 2).
${criterionGuide()}
published-material is material about the person. authorship is articles the person wrote. Do not swap them.
cvSpan is a verbatim quote from the CV. fact must not go beyond that quote. Omit a criterion the CV does not support. At most 2 quotes per criterion. Do not file the same quote under two criteria.`;

export function parseUserEb1a(cvText: string, fieldArea: string): string {
  return `Area of extraordinary ability (context only): ${fieldArea}\n\nCV:\n${cvText}`;
}

export const fitSystem = `${LAW}
Compare endeavor to CV. JSON:
{"recommended":"keep|narrow|pivot","rationale":"","narrowedSentence":"","pivotSentence":"","missingExhibits":[],"recordFitNotes":[]}
keep = record already in this subdomain. narrow = endeavor too big. pivot = mismatch. Do not invent evidence.
progressTowardEndeavor is the prong 2 cross-check. Count an item only when inCv is true, and only toward well positioning. Ignore inCv false as evidence. Do not use the list for national importance. Do not count a fact twice if it is also under projects, publications, or degrees. For each of the four factors with no inCv item, add a missingExhibits line naming that USCIS factor as a gap in this draft, not as a failed legal test.`;

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
A progressTowardEndeavor item may support well positioning only when inCv is true, and the quote must be that item's cvSpan. An item with inCv false is a gap: write [GAP: ] and do not state the fact.
nationalImportance: 3 short paragraphs on THIS endeavor's prospective impact, not field importance. Do not build national importance from progressTowardEndeavor.
chosenSentence is the full endeavor sentence after applying keep, narrow, or pivot — not the word keep/narrow/pivot.`;

const SEARCH_SHAPE = `JSON only:
{"subject":"","angles":[]}
subject: one word, the concrete thing the work is about. Use the specific noun, such as battery rather than energy, or genome rather than health.
angles: exactly 3 different single words that narrow that noun (a failure mode, method, or model). Each search will be "subject" plus one angle.
Do not use these angles: data, system, open, analysis, monitoring, tool, app, platform, software, project, sensor, network.
No search operators.`;

export function openSourceDiscoverSystemFor(track: PetitionTrack): string {
  const intro =
    track === "eb1a"
      ? "EB-1A. Turn the field of extraordinary ability into GitHub searches. Do not use Dhanasar."
      : `${LAW}\nTurn the proposed endeavor into GitHub searches.`;
  return `${intro} ${SEARCH_SHAPE}`;
}

export function openSourceDiscoverUser(work: string, noun = "Proposed endeavor"): string {
  return `${noun}:\n${work}`;
}

export function openSourceDiscoverRetry(work: string, missed: string[], noun = "Proposed endeavor"): string {
  return `${noun}:\n${work}

These searches did not find enough established repositories: ${missed.join(", ")}
Return a more specific subject and 3 new angles. Do not repeat those angles.`;
}

const PROJECT_JSON = `{"projects":[{"index":1,"frameworkConcept":"","alignment":"","nationalImportance":"","wellPositioning":""}],"warnings":[]}`;
const SUGGEST_JSON = `{"projects":[{"name":"","url":"","summary":"","frameworkConcept":"","alignment":"","nationalImportance":"","wellPositioning":""}],"warnings":[]}`;

const SHARED_PICKS = `- index is the number from the list. Use only those repositories. Do not add projects.
- Reject general-purpose tools unless the work is specifically to advance that tool.
- Reject a repository that only matches by idiom, a class assignment, a game, or an unrelated toolkit.
- Prefer repositories maintained by a lab, university, company, or foundation. Skip one-off personal or course repositories when a stronger repository is on the list.
- Return 5 whenever the list contains 5 plausible fits. Use the closest ones. Return fewer only when the others are plainly unrelated, and say why in warnings.
- frameworkConcept is a short proper name (2–6 words). Not a buzzword list.
- alignment maps this repository onto the specific work, using the repository description.`;

function projectClose(track: PetitionTrack): string {
  if (track === "eb1a") {
    return `- nationalImportance names one EB-1A regulatory criterion this repository could help document later (authorship, original contributions, judging, or a leading or critical role). It is a possible evidence path. Do not say the criterion is met. Do not discuss national importance or Dhanasar.
- wellPositioning is a contribution the person could document later. Do not invent past roles, commits, citations, or acclaim.
- Order by fit to the field.
Never say the person qualifies, meets a criterion, or is at the top of the field.`;
  }
  return `- nationalImportance is the prospective U.S. impact of advancing the endeavor through this project. Impact of this work, not field prestige, popularity, or job creation by itself. Do not recite star counts.
- wellPositioning is a contribution path the petitioner could document. Do not invent past roles, commits, citations, or adoption.
- Order by fit to the endeavor, then by how cleanly the project supports national importance.
Never say the person qualifies or will be approved.`;
}

export function openSourceSystemFor(track: PetitionTrack): string {
  const intro =
    track === "eb1a"
      ? "EB-1A extraordinary ability. You are given a field and a numbered list of verified public GitHub repositories. Choose 5 that could carry an evidence path under the regulatory criteria."
      : `${LAW}
You are given a proposed endeavor and a numbered list of verified public GitHub repositories. Choose 5 that best align with the endeavor and can carry national importance and well positioning.`;
  return `${intro} JSON only:
${PROJECT_JSON}
Rules:
${SHARED_PICKS}
${projectClose(track)}`;
}

export function openSourceSuggestSystemFor(track: PetitionTrack): string {
  const intro =
    track === "eb1a"
      ? "EB-1A extraordinary ability. Suggest exactly 5 projects tailored to this field. A project may be a research effort, a public program, a standards effort, or an open-source repository. You are not searching GitHub. Use projects you know."
      : `${LAW}
Suggest exactly 5 projects tailored to this proposed endeavor. A project may be a research effort, a public program, a standards effort, or an open-source repository, whichever carries this work. You are not searching GitHub. Use projects you know.`;
  const subject =
    track === "eb1a"
      ? "- Every project must be about this field. Do not suggest a general data, statistics, visualization, or machine-learning library unless the field is specifically that library."
      : "- Every project must be about the endeavor's subject. Do not suggest a general data, statistics, visualization, or machine-learning library unless the endeavor is specifically to advance that library.";
  return `${intro} JSON only:
${SUGGEST_JSON}
Rules:
- name is the project's published title. Do not invent a title by arranging words from the description.
- url is the canonical project site or repository only when you are confident it is exact. Otherwise use an empty string. Do not guess a GitHub path.
- summary is the project's brief scope in one or two sentences.
- frameworkConcept is a short proper name (2–6 words).
- alignment maps this project onto the specific work, not the industry in general.
${projectClose(track)}
${subject}
- Prefer projects used by laboratories, utilities, hospitals, agencies, or research communities.
- warnings if a name is uncertain or a match is a stretch.`;
}

export function openSourceSuggestUser(work: string, noun = "Proposed endeavor"): string {
  return `${noun}:\n${work}`;
}

export function openSourceUser(work: string, repos: string, noun = "Proposed endeavor"): string {
  return `${noun}:\n${work}\n\nVerified repositories:\n${repos}`;
}

export const ideaActionSystem = `You read one research note against one petition case file. You are drafting software, not a lawyer and not a law firm. Never say the person qualifies, meets a criterion, is well positioned, or will be approved. Do not invent facts that are not in the note or the file. Do not fill gaps with placeholders or examples such as "research on X". If a name, field, or endeavor is not in the file, say it is not in the file. If the note does not bear on this file, say that in the insight.

JSON only:
{"insight":"","recommendation":"","suggestion":""}
insight: 2 to 4 sentences on what the note might mean for this file.
recommendation: one next step in the file, such as a document to collect or a sentence to revise. Not a legal conclusion.
suggestion: one optional line of inquiry, written as a suggestion rather than a finding.`;

export function ideaActionUser(note: string, brief: string): string {
  return `Research note:\n${note}\n\nCase file:\n${brief}`;
}

export const eb1aDraftSystem = `EB-1A initial-evidence skeleton. Not a petition and not a final merits determination. Do not use Dhanasar, national importance, or well positioning. Do not invent facts. Never say the person qualifies, meets a criterion, or is at the top of the field.
JSON only:
{"paragraphs":[],"claimedFacts":[{"claim":"","cvSpan":"","supported":true}],"gaps":[]}
paragraphs: up to 4 short paragraphs. Use only quotes marked inCv true. A missing criterion that matters for this field is written as [GAP: ].
claimedFacts: one entry per factual sentence. cvSpan is that quote. supported is true only when the quote was marked inCv true.
gaps: criteria with no inCv quote, named as missing CV support, not as a failed legal test.`;

export function eb1aDraftUser(args: {
  area: string;
  continueWork: string;
  quotes: string;
  cvExcerpt: string;
}): string {
  return `Field: ${args.area}
Continuing work, only if stated by the user, and not a CV fact: ${args.continueWork || "none"}
Checked quotes:
${args.quotes || "none"}
CV excerpt:
${args.cvExcerpt}`;
}

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
