import { NextResponse } from "next/server";
import { GithubError, searchRepos, type RepoHit } from "@/lib/github";
import { groqJson, groqModel, isGroqConfigured } from "@/lib/groq";
import { asString, asStringArray, fail } from "@/lib/http";
import {
  openSourceDiscoverRetry,
  openSourceDiscoverSystemFor,
  openSourceDiscoverUser,
  openSourceSuggestSystemFor,
  openSourceSuggestUser,
  openSourceSystemFor,
  openSourceUser,
} from "@/lib/prompts";
import { asTrack, trackProfile, type PetitionTrack } from "@/lib/tracks";
import {
  openSourceDiscoverSchema,
  openSourceSchema,
  openSourceSuggestSchema,
} from "@/lib/schemas";
import type { OpenSourceMatch } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_CHARS = 6000;

export async function POST(req: Request) {
  try {
    if (!isGroqConfigured()) {
      return NextResponse.json(
        { error: "GROQ_API_KEY is not configured on the server." },
        { status: 503 }
      );
    }

    const body = (await req.json()) as { endeavor?: unknown; source?: unknown; track?: unknown };
    const track = asTrack(body.track);
    const profile = trackProfile(track);
    const endeavor = asString(body.endeavor).slice(0, MAX_CHARS);
    if (endeavor.length < profile.minChars) {
      return NextResponse.json({ error: profile.tooShort }, { status: 400 });
    }

    if (body.source === "suggested") {
      return await suggestProjects(endeavor, track);
    }

    const discovered = await discover(endeavor, [], track);
    let subject = oneWord(asString(discovered.subject));
    let angles = cleanAngles(discovered.angles, subject);
    let repos = await collectRepos(subject, angles);

    if (repos.length < 4 && subject) {
      const again = await discover(
        endeavor,
        angles.map((angle) => `${subject} ${angle}`),
        track
      );
      const subject2 = oneWord(asString(again.subject)) || subject;
      const angles2 = cleanAngles(again.angles, subject2).filter(
        (angle) => !angles.includes(angle)
      );
      const more = await collectRepos(subject2, angles2);
      repos = mergeRepos(repos, more);
      subject = subject2;
      angles = [...angles, ...angles2];
    }

    if (repos.length < 3) {
      return NextResponse.json(
        {
          error:
            "GitHub did not return enough public repositories for this endeavor. Try a more specific description of the work.",
        },
        { status: 502 }
      );
    }

    const menu = repos.slice(0, 12);
    const raw = await groqJson<{ projects?: unknown; warnings?: unknown }>({
      messages: [
        { role: "system", content: openSourceSystemFor(track) },
        {
          role: "user",
          content: openSourceUser(endeavor, formatRepos(menu), profile.workNoun),
        },
      ],
      model: groqModel(),
      temperature: 0.25,
      maxTokens: 2400,
      jsonSchema: { name: "oss_projects", schema: openSourceSchema },
    });

    const projects = projectsFromModel(raw.projects, menu).slice(0, 5);
    if (projects.length < 1) {
      return NextResponse.json(
        { error: "The model did not keep enough verified projects. Try again." },
        { status: 502 }
      );
    }

    return NextResponse.json({
      projects,
      warnings: asStringArray(raw.warnings),
    });
  } catch (error) {
    if (error instanceof GithubError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return fail(error);
  }
}

async function suggestProjects(endeavor: string, track: PetitionTrack) {
  const noun = trackProfile(track).workNoun;
  const rejected: string[] = [];
  let projects: OpenSourceMatch[] = [];
  let warnings: string[] = [];

  for (let attempt = 0; attempt < 2 && projects.length < 4; attempt++) {
    const raw = await groqJson<{ projects?: unknown; warnings?: unknown }>({
      messages: [
        { role: "system", content: openSourceSuggestSystemFor(track) },
        {
          role: "user",
          content:
            rejected.length > 0
              ? `${openSourceSuggestUser(endeavor, noun)}\n\nDo not suggest these general-purpose libraries: ${rejected.join(", ")}. Suggest projects about this work.`
              : openSourceSuggestUser(endeavor, noun),
        },
      ],
      model: groqModel(),
      temperature: 0.3,
      maxTokens: 2400,
      jsonSchema: { name: "oss_suggested", schema: openSourceSuggestSchema },
    });
    const all = normalizeSuggested(raw.projects);
    for (const project of all) {
      if (isGenericLibrary(project.name) && !rejected.includes(project.name)) {
        rejected.push(project.name);
      }
    }
    projects = all.filter((project) => !isGenericLibrary(project.name)).slice(0, 5);
    warnings = asStringArray(raw.warnings);
  }

  if (projects.length < 4) {
    return NextResponse.json(
      { error: "The model did not return enough project suggestions. Try again." },
      { status: 502 }
    );
  }

  return NextResponse.json({ projects, warnings });
}

const GENERIC_LIBRARIES = new Set([
  "pandas",
  "numpy",
  "scipy",
  "sklearn",
  "scikitlearn",
  "pytorch",
  "tensorflow",
  "keras",
  "mlflow",
  "dvc",
  "plotly",
  "matplotlib",
  "statsmodels",
  "dask",
  "seaborn",
  "jupyter",
]);

function isGenericLibrary(name: string): boolean {
  const key = name.toLowerCase().replace(/[^a-z0-9]/g, "");
  return GENERIC_LIBRARIES.has(key);
}

function normalizeSuggested(raw: unknown): OpenSourceMatch[] {
  const list = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object"
      ? Object.values(raw as Record<string, unknown>)
      : [];
  const seen = new Set<string>();
  const out: OpenSourceMatch[] = [];

  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const name = asString(row.name) || asString(row.project) || asString(row.title);
    const frameworkConcept =
      asString(row.frameworkConcept) || asString(row.framework) || asString(row.concept);
    if (!name || !frameworkConcept) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      name,
      url: httpUrl(asString(row.url) || asString(row.link)),
      summary: asString(row.summary) || asString(row.description),
      frameworkConcept,
      alignment: asString(row.alignment) || asString(row.fit),
      nationalImportance:
        asString(row.nationalImportance) || asString(row.national_importance),
      wellPositioning: asString(row.wellPositioning) || asString(row.well_positioning),
    });
  }
  return out;
}

function httpUrl(value: string): string {
  if (!value) return "";
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    return url.toString();
  } catch {
    return "";
  }
}

async function discover(endeavor: string, missed: string[] = [], track: PetitionTrack = "eb2-niw") {
  const noun = trackProfile(track).workNoun;
  return groqJson<{ subject?: unknown; angles?: unknown }>({
    messages: [
      { role: "system", content: openSourceDiscoverSystemFor(track) },
      {
        role: "user",
        content: missed.length
          ? openSourceDiscoverRetry(endeavor, missed, noun)
          : openSourceDiscoverUser(endeavor, noun),
      },
    ],
    model: groqModel(),
    temperature: 0.1,
    maxTokens: 500,
    jsonSchema: { name: "oss_discover", schema: openSourceDiscoverSchema },
  });
}

async function collectRepos(subject: string, angles: string[]): Promise<RepoHit[]> {
  const byUrl = new Map<string, RepoHit>();
  if (!subject) return [];

  for (const angle of angles.slice(0, 3)) {
    const words = [subject, angle];
    const hits = await searchOrEmpty(
      `${words.join(" ")} stars:>40 archived:false fork:false`,
      5
    );
    for (const hit of hits) {
      if (!hit.description || !overlaps(hit, words)) continue;
      if (!byUrl.has(hit.url)) byUrl.set(hit.url, hit);
    }
  }

  return [...byUrl.values()].sort((a, b) => b.stars - a.stars);
}

function mergeRepos(left: RepoHit[], right: RepoHit[]): RepoHit[] {
  const byUrl = new Map<string, RepoHit>();
  for (const repo of [...left, ...right]) byUrl.set(repo.url, repo);
  return [...byUrl.values()].sort((a, b) => b.stars - a.stars);
}

function oneWord(value: string): string {
  const word = searchPhrase(value).toLowerCase().split(" ").find((part) => part.length > 0);
  if (!word || STOP_WORDS.has(word) || GENERIC_ANGLES.has(word)) return "";
  return word;
}

function cleanAngles(raw: unknown, subject: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of asStringArray(raw)) {
    const angle = searchPhrase(value).toLowerCase().split(" ").find((part) => part.length > 0);
    if (!angle || angle === subject || STOP_WORDS.has(angle) || GENERIC_ANGLES.has(angle)) {
      continue;
    }
    if (seen.has(angle)) continue;
    seen.add(angle);
    out.push(angle);
    if (out.length === 3) break;
  }
  return out;
}

function overlaps(hit: RepoHit, words: string[]): boolean {
  const hay = `${hit.name} ${hit.description}`.toLowerCase();
  return words.every((word) => tokenHits(hay, word));
}

function tokenHits(hay: string, word: string): boolean {
  return hay.split(/[^a-z0-9]+/).some((token) => {
    return token === word || token === `${word}s` || token === `${word}es`;
  });
}

async function searchOrEmpty(query: string, perPage: number): Promise<RepoHit[]> {
  try {
    return await searchRepos(query, perPage);
  } catch (error) {
    if (error instanceof GithubError && error.status === 429) throw error;
    return [];
  }
}

function formatRepos(repos: RepoHit[]): string {
  return repos
    .map(
      (repo, i) =>
        `${i + 1}. name: ${repo.name}\nURL: ${repo.url}\nDescription: ${(repo.description || "none").slice(0, 280)}`
    )
    .join("\n\n");
}

function projectsFromModel(raw: unknown, repos: RepoHit[]): OpenSourceMatch[] {
  const list = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object"
      ? Object.values(raw as Record<string, unknown>)
      : [];
  const used = new Set<string>();
  const out: OpenSourceMatch[] = [];

  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const frameworkConcept =
      asString(row.frameworkConcept) ||
      asString(row.framework) ||
      asString(row.concept);
    if (!frameworkConcept) continue;
    const repo = repoAt(row, repos);
    if (!repo || used.has(repo.url)) continue;
    used.add(repo.url);
    out.push({
      name: repo.name,
      url: repo.url,
      summary: repo.description,
      frameworkConcept,
      alignment: asString(row.alignment) || asString(row.fit) || "",
      nationalImportance:
        asString(row.nationalImportance) || asString(row.national_importance) || "",
      wellPositioning:
        asString(row.wellPositioning) || asString(row.well_positioning) || "",
    });
  }
  return out;
}

function repoAt(row: Record<string, unknown>, repos: RepoHit[]): RepoHit | undefined {
  const index = Number(row.index ?? row.n ?? row.id);
  if (Number.isInteger(index) && index >= 1 && index <= repos.length) {
    return repos[index - 1];
  }
  const name = asString(row.name) || asString(row.project);
  if (!name) return undefined;
  return repos.find((repo) => namesMatch(repo.name, name));
}

function searchPhrase(value: string): string {
  return value
    .replace(/["\\]/g, " ")
    .replace(/-/g, " ")
    .replace(/[^\w\s.+#]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "using",
  "from",
  "into",
  "over",
  "via",
  "that",
  "this",
]);

const GENERIC_ANGLES = new Set([
  "data",
  "system",
  "open",
  "analysis",
  "monitoring",
  "tool",
  "app",
  "platform",
  "software",
  "project",
  "sensor",
  "network",
  "energy",
]);

function namesMatch(repoName: string, candidate: string): boolean {
  const a = repoName.toLowerCase().replace(/[^a-z0-9]/g, "");
  const b = candidate.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!a || !b) return false;
  if (a === b) return true;
  if (b.length < 5) return false;
  return a.startsWith(b) || b.startsWith(a);
}
