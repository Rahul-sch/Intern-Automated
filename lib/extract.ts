/**
 * Extracts a structured Profile/Project[]/Skills library from raw resume
 * text using the user's Groq API key. Used by /api/onboarding/parse-resume.
 *
 * The schema mirrors lib/library.ts but is intentionally permissive
 * (most fields fall back to "" or []) — real resumes are messy and we'd
 * rather pass through what the LLM finds than fail the whole parse on a
 * missing phone number.
 */
import { createGroq } from "@ai-sdk/groq";
import { generateObject } from "ai";
import { z } from "zod";
import { AppError } from "./errors";
import type { Profile, Project, Skills } from "./library";
import { TAILOR_MODEL } from "./tailor";

const ExtractedSchema = z.object({
  profile: z.object({
    name: z.string(),
    phone: z.string().default(""),
    email: z.string().default(""),
    linkedin: z
      .object({
        url: z.string().default(""),
        label: z.string().default(""),
      })
      .default({ url: "", label: "" }),
    github: z
      .object({
        url: z.string().default(""),
        label: z.string().default(""),
      })
      .default({ url: "", label: "" }),
    education: z
      .array(
        z.object({
          school: z.string(),
          location: z.string().default(""),
          degree: z.string().default(""),
          dates: z.string().default(""),
        }),
      )
      .default([]),
    experience: z
      .array(
        z.object({
          title: z.string(),
          dates: z.string().default(""),
          company: z.string(),
          location: z.string().default(""),
          bullets: z.array(z.string()).default([]),
        }),
      )
      .default([]),
  }),
  projects: z
    .array(
      z.object({
        name: z.string(),
        stack: z.string().default(""),
        date: z.string().default(""),
        tags: z.array(z.string()).default([]),
        bullets: z.array(z.string()).min(1).max(5),
      }),
    )
    .min(1)
    .max(12),
  skills: z.object({
    categories: z
      .array(
        z.object({
          label: z.string(),
          items: z.array(z.string()).min(1),
        }),
      )
      .min(1)
      .max(8),
  }),
});

export type Extracted = {
  profile: Profile;
  projects: Project[];
  skills: Skills;
};

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

function categoryId(label: string): string {
  // Reuse a stable id so subsequent saves don't churn.
  return slugify(label).replace(/-/g, "_") || "skills";
}

export async function extractFromResume(args: {
  apiKey: string;
  text: string;
}): Promise<Extracted> {
  const text = args.text.trim();
  if (text.length < 200) {
    throw new AppError(
      "VALIDATION",
      "Resume text looks too short to extract from.",
      "Make sure your PDF has selectable text (not a scanned image).",
      400,
    );
  }

  const groq = createGroq({ apiKey: args.apiKey });
  const prompt = [
    `You read a software engineer's resume and extract a structured library that will power resume tailoring.`,
    ``,
    `RESUME TEXT (raw, possibly noisy from PDF extraction):`,
    `"""`,
    text.slice(0, 12000),
    `"""`,
    ``,
    `RULES:`,
    `1. profile.name: full name as it appears at the top.`,
    `2. profile.linkedin / github: extract both the URL and a short label (e.g., label="linkedin.com/in/jane"). If only the URL is present, use the URL as the label too. Empty strings are OK.`,
    `3. education: every degree program, in reverse chronological order.`,
    `4. experience: every full-time / internship role, in reverse chronological order. Bullets stay verbatim — do not rewrite, do not invent. Skip pure 'projects' or 'leadership' sections — those go in projects.`,
    `5. projects: every personal/portfolio/research project. 'name' is the project name, 'stack' is the comma-separated tech (or '' if not given), 'date' is e.g. "Aug. 2024" if listed, 'tags' is 3-7 short keywords (one or two words each, lowercase), 'bullets' are 1-5 verbatim bullets describing what they built.`,
    `6. skills.categories: 3-6 categories like "Languages", "Frameworks", "Infrastructure", "AI/ML", "Tools". 'items' is the comma-separated list under each, deduplicated.`,
    `7. Never invent metrics, links, or dates that aren't in the source. Empty strings are always fine.`,
    `8. Output LaTeX-safe strings: escape % as \\%, & as \\&, $ as \\$, _ as \\_, # as \\#. Don't add Unicode bullets — let the renderer add them.`,
  ].join("\n");

  let object: z.infer<typeof ExtractedSchema>;
  try {
    const result = await generateObject({
      model: groq(TAILOR_MODEL),
      schema: ExtractedSchema,
      schemaName: "ResumeLibrary",
      schemaDescription: "Structured resume library extracted from raw text",
      prompt,
      temperature: 0.1,
      maxOutputTokens: 6000,
    });
    object = result.object;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/api key|unauthorized|401/i.test(msg)) {
      throw new AppError(
        "VALIDATION",
        "Your Groq API key was rejected during extraction.",
        "Double-check it on /settings.",
        401,
      );
    }
    throw new AppError(
      "LLM_SCHEMA_MISMATCH",
      `Resume extraction failed: ${msg}`,
      undefined,
      502,
    );
  }

  // Stitch IDs (the LLM doesn't see lib/library's id requirement).
  const usedSlugs = new Set<string>();
  const projects: Project[] = object.projects.map((p) => {
    let slug = slugify(p.name);
    if (!slug) slug = `project-${usedSlugs.size + 1}`;
    let candidate = slug;
    let i = 2;
    while (usedSlugs.has(candidate)) {
      candidate = `${slug}-${i++}`;
    }
    usedSlugs.add(candidate);
    return {
      id: candidate,
      name: p.name,
      stack: p.stack,
      date: p.date,
      tags: p.tags,
      bullets: p.bullets,
    };
  });

  const usedCatIds = new Set<string>();
  const skills: Skills = {
    categories: object.skills.categories.map((c) => {
      const id = categoryId(c.label);
      let candidate = id;
      let i = 2;
      while (usedCatIds.has(candidate)) {
        candidate = `${id}_${i++}`;
      }
      usedCatIds.add(candidate);
      return {
        id: candidate,
        label: c.label,
        items: c.items,
      };
    }),
  };

  return { profile: object.profile, projects, skills };
}
