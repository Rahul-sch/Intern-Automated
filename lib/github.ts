/**
 * Thin GitHub REST client. The user's PAT is passed per-request — we never
 * persist it. All calls go through `fetch` so we don't add a dep.
 *
 * Scopes needed: `repo` for full access (private + public). A fine-grained
 * PAT with read-only "Contents" + "Metadata" on the user's repos works too.
 */
import { AppError } from "./errors";

const GH = "https://api.github.com";

export type GhRepo = {
  full_name: string; // "owner/repo"
  owner: string;
  name: string;
  description: string;
  language: string | null;
  topics: string[];
  stargazers_count: number;
  fork: boolean;
  archived: boolean;
  pushed_at: string;
  default_branch: string;
  html_url: string;
};

async function gh<T>(token: string, path: string): Promise<T> {
  const res = await fetch(`${GH}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (res.status === 401) {
    throw new AppError(
      "VALIDATION",
      "GitHub rejected this token.",
      "Generate a new PAT at github.com/settings/tokens with `repo` scope.",
      401,
    );
  }
  if (res.status === 403) {
    throw new AppError(
      "VALIDATION",
      "GitHub denied access (rate limit or scope).",
      "Check the PAT has `repo` or `public_repo` scope.",
      403,
    );
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new AppError(
      "VALIDATION",
      `GitHub returned ${res.status}.`,
      body.slice(0, 200) || undefined,
      res.status,
    );
  }
  return (await res.json()) as T;
}

/** Validate the token + return the owner login (used as default in repo searches). */
export async function whoAmI(token: string): Promise<{ login: string }> {
  const u = await gh<{ login: string }>(token, "/user");
  return { login: u.login };
}

/**
 * List repos owned by the authenticated user, most-recently-pushed first.
 * Excludes forks and archived repos by default — those rarely make good
 * portfolio entries. Caps at 100 (one page).
 */
export async function listOwnedRepos(token: string): Promise<GhRepo[]> {
  const raw = await gh<
    Array<{
      full_name: string;
      owner: { login: string };
      name: string;
      description: string | null;
      language: string | null;
      topics: string[] | null;
      stargazers_count: number;
      fork: boolean;
      archived: boolean;
      pushed_at: string;
      default_branch: string;
      html_url: string;
    }>
  >(
    token,
    "/user/repos?visibility=all&affiliation=owner&per_page=100&sort=pushed",
  );
  return raw
    .filter((r) => !r.fork && !r.archived)
    .map((r) => ({
      full_name: r.full_name,
      owner: r.owner.login,
      name: r.name,
      description: r.description ?? "",
      language: r.language,
      topics: r.topics ?? [],
      stargazers_count: r.stargazers_count,
      fork: r.fork,
      archived: r.archived,
      pushed_at: r.pushed_at,
      default_branch: r.default_branch,
      html_url: r.html_url,
    }));
}

/**
 * Fetch the README for a repo as plain markdown text. Returns "" on 404.
 * Truncates to 6000 chars so we don't burn tokens on huge READMEs.
 */
export async function fetchReadme(
  token: string,
  owner: string,
  repo: string,
): Promise<string> {
  const res = await fetch(`${GH}/repos/${owner}/${repo}/readme`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.raw",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (res.status === 404) return "";
  if (!res.ok) {
    return ""; // best-effort — proceed without README
  }
  const text = await res.text();
  return text.slice(0, 6000);
}

/**
 * Fetch the top-N languages for a repo (used as the project's "stack" hint).
 * Returns an ordered list, most-bytes first.
 */
export async function fetchLanguages(
  token: string,
  owner: string,
  repo: string,
): Promise<string[]> {
  try {
    const map = await gh<Record<string, number>>(
      token,
      `/repos/${owner}/${repo}/languages`,
    );
    return Object.entries(map)
      .sort(([, a], [, b]) => b - a)
      .map(([k]) => k);
  } catch {
    return [];
  }
}
