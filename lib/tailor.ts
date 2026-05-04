import { groq } from "@ai-sdk/groq";
import { generateObject } from "ai";
import { z } from "zod";
import { AppError } from "./errors";
import type { Profile, Project, Skills } from "./library";

export const TAILOR_MODEL = "openai/gpt-oss-120b";

export const TailoredSchema = z.object({
  summary: z
    .string()
    .min(30)
    .max(220)
    .describe(
      "One tailored line rendered under the name/contact header. Include role framing + 2-3 JD-relevant themes. No period at end.",
    ),
  project_ids: z
    .array(z.string())
    .length(5)
    .describe(
      "IDs of the 5 projects to include, ordered most-to-least JD-relevant. Must be a subset of the supplied project library IDs.",
    ),
  project_bullet_rewrites: z
    .record(z.string(), z.array(z.string()).min(2).max(3))
    .describe(
      "For each chosen project_id, 2-3 LaTeX-safe bullets that echo JD keywords while staying grounded in the original bullets. Preserve LaTeX escapes like \\%, \\_, \\&, \\$. Each bullet < 220 chars.",
    ),
  skill_order: z
    .array(z.string())
    .length(4)
    .describe(
      "The four skill category IDs ('languages','frameworks','infrastructure','ai_ml') in JD-priority order.",
    ),
  skill_emphasis: z
    .record(z.string(), z.array(z.string()))
    .describe(
      "For each skill category id, the items reordered with JD-relevant ones first. May drop obviously-irrelevant items but never invent new ones.",
    ),
  rationale: z
    .string()
    .max(600)
    .describe("2-4 sentences for the dashboard explaining project picks and emphasis."),
});

export type Tailored = z.infer<typeof TailoredSchema>;

function buildPrompt(args: {
  profile: Profile;
  projects: Project[];
  skills: Skills;
  jd: string;
  company: string;
  title: string;
}): string {
  const library = args.projects.map((p) => ({
    id: p.id,
    name: p.name,
    stack: p.stack,
    tags: p.tags,
    bullets: p.bullets,
  }));
  const skillBlock = args.skills.categories.map((c) => ({
    id: c.id,
    label: c.label,
    items: c.items,
  }));
  return [
    `You tailor Rahul Bainsla's resume for a specific startup job. Pick the 5 projects and skill framing that best match this JD.`,
    ``,
    `APPLICANT: ${args.profile.name} — CS @ Virginia Tech (grad May 2026). Current roles: SWE Distributed Systems @ Ithena; Co-Founder/CTO @ MedRa Robotics.`,
    ``,
    `COMPANY: ${args.company}`,
    `ROLE: ${args.title}`,
    ``,
    `JOB DESCRIPTION:`,
    args.jd,
    ``,
    `PROJECT LIBRARY (pick exactly 5 ids, ordered by relevance):`,
    JSON.stringify(library, null, 2),
    ``,
    `SKILL CATEGORIES (four; reorder categories + items within each):`,
    JSON.stringify(skillBlock, null, 2),
    ``,
    `RULES:`,
    `1. Output LaTeX-safe strings. Keep existing escapes (\\%, \\_, \\&, \\$). Use \\texttt{...} for code-like terms, $\\to$ for arrows.`,
    `2. Rewritten bullets must remain factually grounded in the original bullets. Do NOT invent new metrics, libraries, or outcomes. You may re-frame vocabulary to echo JD keywords.`,
    `3. The summary is one line that will render under the header. Example shape: "CS senior @ VT building <theme>; shipping <theme> at Ithena and founding MedRa Robotics".`,
    `4. project_ids must be 5 distinct ids from the library. skill_order must contain all four category ids.`,
    `5. For skill_emphasis, include every category; list items JD-relevant-first; may omit obviously-irrelevant items (aim 4-7 items per category).`,
  ].join("\n");
}

export async function tailorResume(args: {
  profile: Profile;
  projects: Project[];
  skills: Skills;
  jd: string;
  company: string;
  title: string;
}): Promise<Tailored> {
  const prompt = buildPrompt(args);
  try {
    const { object } = await generateObject({
      model: groq(TAILOR_MODEL),
      schema: TailoredSchema,
      schemaName: "TailoredResume",
      schemaDescription: "Tailored resume structure for Rahul Bainsla",
      prompt,
      temperature: 0.3,
      maxOutputTokens: 4000,
    });
    return validateTailored(object, args.projects, args.skills);
  } catch (err) {
    if (err instanceof AppError) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    throw new AppError("LLM_SCHEMA_MISMATCH", `Tailoring failed: ${msg}`, undefined, 502);
  }
}

export function validateTailored(
  t: Tailored,
  projects: Project[],
  skills: Skills,
): Tailored {
  const projectIds = new Set(projects.map((p) => p.id));
  for (const id of t.project_ids) {
    if (!projectIds.has(id)) {
      throw new AppError(
        "LLM_SCHEMA_MISMATCH",
        `Tailoring picked unknown project id: ${id}`,
      );
    }
  }
  if (new Set(t.project_ids).size !== 5) {
    throw new AppError("LLM_SCHEMA_MISMATCH", "Tailoring picked duplicate project ids");
  }
  for (const id of t.project_ids) {
    if (!t.project_bullet_rewrites[id] || t.project_bullet_rewrites[id].length < 2) {
      throw new AppError(
        "LLM_SCHEMA_MISMATCH",
        `Missing/short bullets for project: ${id}`,
      );
    }
  }
  const catIds = new Set(skills.categories.map((c) => c.id));
  for (const id of t.skill_order) {
    if (!catIds.has(id)) {
      throw new AppError("LLM_SCHEMA_MISMATCH", `Unknown skill category: ${id}`);
    }
  }
  if (new Set(t.skill_order).size !== skills.categories.length) {
    throw new AppError(
      "LLM_SCHEMA_MISMATCH",
      "skill_order must contain every category exactly once",
    );
  }
  return t;
}
