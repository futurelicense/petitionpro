export type RepoHit = {
  name: string;
  fullName: string;
  url: string;
  description: string;
  stars: number;
};

export class GithubError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.name = "GithubError";
    this.status = status;
  }
}

type GithubRepo = {
  name?: string;
  full_name?: string;
  html_url?: string;
  description?: string | null;
  stargazers_count?: number;
  archived?: boolean;
  fork?: boolean;
};

export async function searchRepos(query: string, perPage = 8): Promise<RepoHit[]> {
  const url = new URL("https://api.github.com/search/repositories");
  url.searchParams.set("q", query);
  url.searchParams.set("sort", "stars");
  url.searchParams.set("order", "desc");
  url.searchParams.set("per_page", String(perPage));

  const res = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "petitionpro",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    signal: AbortSignal.timeout(15000),
  });

  if (res.status === 403 || res.status === 429) {
    throw new GithubError(
      "GitHub search is rate-limited. Wait a minute and try again.",
      429
    );
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new GithubError(
      `GitHub search failed (${res.status}). ${detail.slice(0, 160)}`.trim(),
      502
    );
  }

  const data = (await res.json()) as { items?: GithubRepo[] };
  const hits: RepoHit[] = [];
  for (const item of data.items ?? []) {
    if (!item.name || !item.full_name || !item.html_url) continue;
    if (item.archived || item.fork) continue;
    hits.push({
      name: item.name,
      fullName: item.full_name,
      url: item.html_url,
      description: (item.description || "").trim(),
      stars: item.stargazers_count ?? 0,
    });
  }
  return hits;
}
