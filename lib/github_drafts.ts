/**
 * Turn a GitHub repo (name + description + README + language list) into a
 * draft Project[] entry by asking the user's LLM for stack/tags/bullets.
 *
 * Bullets are kept verbatim from the README narrative — we never invent
 * features or metrics. The user reviews + edits before saving so any
 * embellishment they find can be removed.
 */
import { createGroq } from "@ai-sdk/groq";
import { generateObject } from "ai";
import { z } from "zod";
import { AppError } from "./errors";
import { fetchLanguages, fetchReadme } from "./github";
import type { Project } from "./library";
import { TAILOR_MODEL } from "./tailor";

const DraftSchema = z.object({
  stack: z.string().describe(
    "Comma-separated tech stack inferred from README + languages list, e.g. 'TypeScript, Next.js, Postgres'.",
  ),
  tags: z
    .array(z.string())
    .min(2)
    .max(7)
    .describe("Short keyword tags (one or two words, lowercase)."),
  bullets: z
    .array(z.string())
    .min(2)
    .max(3)
    .describe(
      "2-3 plain-text bullets describing what the project does, drawn from the README. Plain ASCII only — no LaTeX, no smart quotes, no em dashes.",
    ),
});

export type Draft = Pick<Project, "id" | "name" | "stack" | "date" | "tags" | "bullets">;

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

function shortDate(iso: string): string {
  // pushed_at is ISO 8601. Convert to "Mon. YYYY" to match the existing date style.
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const month = d.toLocaleString("en-US", { month: "short" });
  return `${month}. ${d.getFullYear()}`;
}

export async function buildDraftsFromRepos(args: {
  apiKey: string;
  ghToken: string;
  repos: { owner: string; repo: string; description: string; pushed_at: string }[];
}): Promise<Draft[]> {
  if (args.repos.length === 0) return [];
  const groq = createGroq({ apiKey: args.apiKey });

  const drafts: Draft[] = [];
  for (const r of args.repos) {
    const [readme, langs] = await Promise.all([
      fetchReadme(args.ghToken, r.owner, r.repo),
      fetchLanguages(args.ghToken, r.owner, r.repo),
    ]);

    const prompt = [
      `Write a structured project entry for a software engineer's resume from this GitHub repo.`,
      ``,
      `REPO: ${r.owner}/${r.repo}`,
      `DESCRIPTION: ${r.description || "(none)"}`,
      `LANGUAGES (most-bytes first): ${langs.join(", ") || "(unknown)"}`,
      ``,
      `README (raw markdown, possibly truncated):`,
      `"""`,
      readme || "(no README)",
      `"""`,
      ``,
      `RULES:`,
      `1. Output PLAIN TEXT only. ASCII punctuation. No LaTeX, no markdown, no emoji, no smart quotes, no em dashes.`,
      `2. Bullets must be grounded in what the README says or what the languages strongly imply. Do NOT invent metrics, dates, or claimed integrations.`,
      `3. 'stack' is a comma-separated tech stack. 'tags' is 3-7 lowercase one-or-two-word keywords.`,
      `4. Bullets describe what the project DOES and what was BUILT — not blogging-style commentary.`,
    ].join("\n");

    let object: z.infer<typeof DraftSchema>;
    try {
      const result = await generateObject({
        model: groq(TAILOR_MODEL),
        schema: DraftSchema,
        schemaName: "ProjectDraft",
        schemaDescription: "Resume project entry derived from a GitHub repo",
        prompt,
        temperature: 0.2,
        maxOutputTokens: 1500,
      });
      object = result.object;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/api key|unauthorized|401/i.test(msg)) {
        throw new AppError(
          "VALIDATION",
          "Your Groq API key was rejected.",
          "Update it on /settings.",
          401,
        );
      }
      // Skip a single bad repo rather than failing the whole import.
      continue;
    }

    drafts.push({
      id: slugify(r.repo),
      name: r.repo,
      stack: object.stack,
      date: shortDate(r.pushed_at),
      tags: object.tags,
      bullets: object.bullets,
    });
  }
  return drafts;
}
