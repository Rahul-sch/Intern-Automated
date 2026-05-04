import { createGroq } from "@ai-sdk/groq";
import { generateObject } from "ai";
import { z } from "zod";
import { AppError } from "./errors";
import type { Profile, Project, Skills } from "./library";

export const TAILOR_MODEL = "openai/gpt-oss-120b";
export const TARGET_PROJECT_COUNT = 5;

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
    .min(1)
    .max(TARGET_PROJECT_COUNT)
    .describe(
      "IDs of the projects to include, ordered most-to-least JD-relevant. Must be a subset of the supplied project library IDs. Pick up to 5.",
    ),
  project_bullet_rewrites: z
    .record(z.string(), z.array(z.string()).min(2).max(3))
    .describe(
      "For each chosen project_id, 2-3 LaTeX-safe bullets that echo JD keywords while staying grounded in the original bullets. Preserve LaTeX escapes like \\%, \\_, \\&, \\$. Each bullet < 220 chars.",
    ),
  skill_order: z
    .array(z.string())
    .min(1)
    .describe(
      "Skill category IDs in JD-priority order. Must include every category from the supplied library exactly once.",
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

function shortBio(profile: Profile): string {
  const parts: string[] = [profile.name];
  const edu = profile.education[0];
  if (edu) parts.push(`${edu.degree} @ ${edu.school} (${edu.dates})`);
  const roles = profile.experience
    .slice(0, 2)
    .map((e) => `${e.title} @ ${e.company}`)
    .join("; ");
  if (roles) parts.push(`Current: ${roles}`);
  return parts.join(" — ");
}

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
  const pickCount = Math.min(TARGET_PROJECT_COUNT, args.projects.length);
  return [
    `You tailor a software engineer's resume for a specific startup role. Pick the projects and skill framing that best match this JD.`,
    ``,
    `APPLICANT: ${shortBio(args.profile)}`,
    ``,
    `COMPANY: ${args.company}`,
    `ROLE: ${args.title}`,
    ``,
    `JOB DESCRIPTION:`,
    args.jd,
    ``,
    `PROJECT LIBRARY (pick up to ${pickCount} distinct ids, ordered by relevance):`,
    JSON.stringify(library, null, 2),
    ``,
    `SKILL CATEGORIES (reorder all of them by JD priority + emphasize JD-relevant items first within each):`,
    JSON.stringify(skillBlock, null, 2),
    ``,
    `RULES:`,
    `1. Output PLAIN TEXT only. No LaTeX commands, no backslash escapes, no \\texttt{}, no math mode. The renderer escapes everything. ASCII punctuation only — no smart quotes, em dashes, or non-breaking spaces.`,
    `2. Rewritten bullets must remain factually grounded in the original bullets. Do NOT invent new metrics, libraries, or outcomes. You may re-frame vocabulary to echo JD keywords.`,
    `3. The summary is one line that will render under the header — concise, role-framed, echoes 2-3 JD themes. Plain text, no period at end.`,
    `4. project_ids must be ${pickCount} distinct ids from the library. skill_order must contain every category id from the library exactly once.`,
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
  apiKey: string;
}): Promise<Tailored> {
  if (args.projects.length === 0) {
    throw new AppError(
      "VALIDATION",
      "Add projects to your library before tailoring.",
      "Onboarding extracts these from your resume — visit Settings to retry.",
      400,
    );
  }
  const groq = createGroq({ apiKey: args.apiKey });
  const prompt = buildPrompt(args);
  try {
    const { object } = await generateObject({
      model: groq(TAILOR_MODEL),
      schema: TailoredSchema,
      schemaName: "TailoredResume",
      schemaDescription: "Tailored resume structure",
      prompt,
      temperature: 0.3,
      maxOutputTokens: 4000,
    });
    return validateTailored(object, args.projects, args.skills);
  } catch (err) {
    if (err instanceof AppError) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    if (/api key|unauthorized|401/i.test(msg)) {
      throw new AppError(
        "VALIDATION",
        "Your Groq API key was rejected.",
        "Check Settings — you may need to regenerate at console.groq.com/keys.",
        401,
      );
    }
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
  if (new Set(t.project_ids).size !== t.project_ids.length) {
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
