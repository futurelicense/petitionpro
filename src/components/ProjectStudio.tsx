"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Brand } from "@/components/Brand";
import { DISCLAIMER } from "@/lib/disclaimer";
import { asTrack, STUDIO_STORAGE, trackProfile, type PetitionTrack } from "@/lib/tracks";
import type { OpenSourceMatch } from "@/lib/types";

const STORAGE = "petitionpro-projects-v2";
const LEGACY = "petitionpro-projects-v1";

type Source = "github" | "suggested";

type Bucket = {
  endeavor?: string;
  track?: PetitionTrack;
  projects: OpenSourceMatch[];
  warnings: string[];
};

type Persist = {
  endeavor: string;
  track?: PetitionTrack;
  source: Source;
  github: Bucket;
  suggested: Bucket;
};

const emptyBucket = (): Bucket => ({ projects: [], warnings: [] });

const VIEWS: { id: Source; label: string }[] = [
  { id: "github", label: "GitHub" },
  { id: "suggested", label: "Suggested" },
];

export function ProjectStudio() {
  const params = useSearchParams();
  const seeded = params.get("endeavor")?.trim() ?? "";
  const seededTrack = params.has("track") ? asTrack(params.get("track")) : null;
  return (
    <ProjectSession
      key={`${seededTrack ?? "auto"}:${seeded}`}
      seeded={seeded}
      seededTrack={seededTrack}
    />
  );
}

function ProjectSession({
  seeded,
  seededTrack,
}: {
  seeded: string;
  seededTrack: PetitionTrack | null;
}) {
  const [track, setTrack] = useState<PetitionTrack>(seededTrack ?? "eb2-niw");
  const [endeavor, setEndeavor] = useState(seeded);
  const [source, setSource] = useState<Source>("github");
  const [github, setGithub] = useState<Bucket>(emptyBucket);
  const [suggested, setSuggested] = useState<Bucket>(emptyBucket);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const bucket = source === "github" ? github : suggested;
  const profile = trackProfile(track);
  const active =
    bucket.endeavor === endeavor.trim() && (bucket.track ?? "eb2-niw") === track
      ? bucket
      : emptyBucket();
  const projects = active.projects;
  const warnings = active.warnings;

  useEffect(() => {
    let cancelled = false;
    // Restore after mounting so server and initial client markup agree.
    void Promise.resolve().then(() => {
      if (cancelled) return;
      try {
        let studioTrack: PetitionTrack | null = null;
        let studioText = "";
        if (!seeded || !seededTrack) {
          const studioRaw = localStorage.getItem(STUDIO_STORAGE);
          if (studioRaw) {
            const studio = JSON.parse(studioRaw) as {
              track?: string;
              eb1aArea?: string;
              selectedId?: string | null;
              options?: { id?: string; sentence?: string }[];
            };
            studioTrack = asTrack(studio.track);
            if (studioTrack === "eb1a") studioText = studio.eb1aArea?.trim() || "";
            else {
              const options = studio.options ?? [];
              const selected = options.find((option) => option.id === studio.selectedId) ?? options[0];
              studioText = selected?.sentence?.trim() || "";
            }
          }
        }
        const nextTrack = seededTrack ?? studioTrack ?? "eb2-niw";
        const nextText = seeded || studioText;
        setTrack(nextTrack);
        if (nextText) setEndeavor(nextText);

        const raw = localStorage.getItem(STORAGE) || localStorage.getItem(LEGACY);
        if (raw) {
          const data = JSON.parse(raw) as Persist & {
            projects?: OpenSourceMatch[];
            warnings?: string[];
          };
          const savedTrack = asTrack(data.track);
          const savedEndeavor = data.endeavor?.trim() || "";
          if (savedTrack === nextTrack && (!nextText || nextText === savedEndeavor)) {
            setSource(data.source === "suggested" ? "suggested" : "github");
            const restore = (bucket?: Bucket): Bucket => ({
              ...emptyBucket(),
              ...bucket,
              track: bucket?.track ?? savedTrack,
              endeavor: bucket?.endeavor ?? savedEndeavor,
            });
            setGithub(restore(data.github || {
              projects: data.projects || [],
              warnings: data.warnings || [],
            }));
            setSuggested(restore(data.suggested));
          }
        }
      } catch {
        /* Storage may be unavailable or contain invalid JSON. */
      }
      setHydrated(true);
    });
    return () => { cancelled = true; };
  }, [seeded, seededTrack]);

  useEffect(() => {
    if (!hydrated) return;
    const data: Persist = { endeavor, track, source, github, suggested };
    try {
      localStorage.setItem(STORAGE, JSON.stringify(data));
    } catch {
      /* Keep the session usable when storage is unavailable or full. */
    }
  }, [hydrated, endeavor, track, source, github, suggested]);

  const exportText = useMemo(() => {
    if (!projects.length) return "";
    const blocks = projects.map((project, i) => {
      const lines = [
        `## ${i + 1}. ${project.name}`,
        project.url ? project.url : "",
        "",
        `Scope: ${project.summary || ""}`,
        "",
        `Framework: ${project.frameworkConcept}`,
        "",
        project.alignment,
        "",
        `${profile.impactLabel}: ${project.nationalImportance}`,
        "",
        `${profile.pathLabel}: ${project.wellPositioning}`,
      ];
      return lines.filter((line, idx, arr) => line !== "" || arr[idx - 1] !== "").join("\n");
    });
    const title =
      source === "github"
        ? `# Projects tailored to this ${profile.short} work, from GitHub`
        : `# Projects tailored to this ${profile.short} work, suggested by the model`;
    return [title, "", endeavor.trim(), "", ...blocks, "", DISCLAIMER, ""].join("\n");
  }, [endeavor, profile.impactLabel, profile.pathLabel, profile.short, projects, source]);

  async function generate() {
    setBusy(true);
    setError(null);
    const clear = emptyBucket();
    if (source === "github") setGithub(clear);
    else setSuggested(clear);
    try {
      const res = await fetch("/api/project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endeavor, source, track }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not match projects.");
      const next: Bucket = {
        endeavor: endeavor.trim(),
        track,
        projects: (data.projects || []) as OpenSourceMatch[],
        warnings: (data.warnings || []) as string[],
      };
      if (source === "github") setGithub(next);
      else setSuggested(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not match projects.");
    } finally {
      setBusy(false);
    }
  }

  function download() {
    const blob = new Blob([exportText], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download =
      source === "github" ? "petitionpro-projects-github.md" : "petitionpro-projects-suggested.md";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="shell">
      <Brand lede={profile.projectLede} />

      <div className="views" role="tablist" aria-label="Classification">
        {(["eb2-niw", "eb1a"] as const).map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={track === id}
            data-on={track === id ? "true" : "false"}
            onClick={() => {
              setTrack(id);
              setError(null);
            }}
          >
            {trackProfile(id).short}
          </button>
        ))}
      </div>

      <div className="views" role="tablist" aria-label="Project source">
        {VIEWS.map((view) => (
          <button
            key={view.id}
            type="button"
            role="tab"
            aria-selected={source === view.id}
            data-on={source === view.id ? "true" : "false"}
            onClick={() => {
              setSource(view.id);
              setError(null);
            }}
          >
            {view.label}
          </button>
        ))}
      </div>

      <section className="panel">
        <h2>{profile.workNoun}</h2>
        <p className="note">
          {source === "github"
            ? `GitHub search returns public repositories that exist at search time. The notes below are framed for ${profile.short}. Only claim contributions you can document.`
            : `Groq suggests projects from what it knows, framed for ${profile.short}. Names and links are not checked against GitHub. Verify each one before you rely on it.`}
        </p>
        <label className="field">
          {profile.workNoun}
          <textarea
            value={endeavor}
            onChange={(e) => setEndeavor(e.target.value)}
            placeholder={profile.workPlaceholder}
            style={{ minHeight: "9rem" }}
          />
        </label>
        {error && <p className="err">{error}</p>}
        <div className="actions">
          <button
            className="btn"
            type="button"
            disabled={busy || !hydrated || endeavor.trim().length < profile.minChars}
            onClick={generate}
          >
            {busy
              ? source === "github"
                ? "Searching GitHub…"
                : "Asking Groq…"
              : source === "github"
                ? "Find on GitHub"
                : "Suggest with Groq"}
          </button>
          {projects.length > 0 && (
            <button className="btn ghost" type="button" onClick={download}>
              Download markdown
            </button>
          )}
        </div>
      </section>

      {projects.length > 0 && (
        <section className="panel" style={{ marginTop: "1rem" }}>
          <h2>
            {projects.length === 1 ? "1 project" : `${projects.length} projects`}
          </h2>
          <p className="note">
            {source === "github"
              ? `Ordered by fit to this ${profile.short} work. Each name is a public GitHub repository. Nothing here is evidence until the person does the work.`
              : `Ordered by fit to this ${profile.short} work. These are model suggestions, not a GitHub search. Nothing here is evidence until the person does the work.`}
          </p>
          {warnings.map((warning) => (
            <div key={warning} className="warn">
              {warning}
            </div>
          ))}
          {projects.map((project) => (
            <article key={`${source}-${project.name}`} className="card">
              <h3>
                {project.url ? (
                  <a href={project.url} target="_blank" rel="noreferrer">
                    {project.name}
                  </a>
                ) : (
                  project.name
                )}
              </h3>
              {project.url && <p className="small">{project.url}</p>}
              <dl className="meta">
                <div>
                  <dt>Scope</dt>
                  <dd>{project.summary || "—"}</dd>
                </div>
                <div>
                  <dt>Framework</dt>
                  <dd>{project.frameworkConcept || "—"}</dd>
                </div>
                <div>
                  <dt>Alignment</dt>
                  <dd>{project.alignment || "—"}</dd>
                </div>
                <div>
                  <dt>{profile.impactLabel}</dt>
                  <dd>{project.nationalImportance || "—"}</dd>
                </div>
                <div>
                  <dt>{profile.pathLabel}</dt>
                  <dd>{project.wellPositioning || "—"}</dd>
                </div>
              </dl>
            </article>
          ))}
        </section>
      )}

      <footer className="disclaimer">{DISCLAIMER}</footer>
    </main>
  );
}
