import fs from "node:fs";
import path from "node:path";
import { AppError } from "./errors";
import { compilePdf } from "./compile";
import type { Profile, Project, Skills } from "./library";
import { ATS_TEMPLATE, PRETTY_TEMPLATE, renderLatex } from "./render";
import type { Tailored } from "./tailor";

const GENERATED_DIR = path.join(process.cwd(), "generated");

export type BuildResult = {
  texPath: string;
  pdfPath: string | null;
  texAtsPath: string;
  pdfAtsPath: string | null;
  /** Concatenated compile errors (pretty + ATS), or null if both succeeded. */
  compileError: string | null;
};

/**
 * Render both LaTeX templates from a Tailored object and compile each to PDF.
 * Always writes both .tex files; PDF paths are null when their tectonic
 * compile failed (we surface that in `compileError` rather than throwing so
 * the caller can still persist the .tex artifact for debugging).
 */
export async function buildBoth(args: {
  jobId: string;
  profile: Profile;
  projects: Project[];
  skills: Skills;
  tailored: Tailored;
}): Promise<BuildResult> {
  const dir = path.join(GENERATED_DIR, args.jobId);
  fs.mkdirSync(dir, { recursive: true });

  const texPath = path.join(dir, "resume.tex");
  const texAtsPath = path.join(dir, "resume-ats.tex");
  fs.writeFileSync(texPath, renderLatex(args, PRETTY_TEMPLATE), "utf8");
  fs.writeFileSync(texAtsPath, renderLatex(args, ATS_TEMPLATE), "utf8");

  const errors: string[] = [];
  const pdfPath = await safeCompile(texPath, errors, "pretty");
  const pdfAtsPath = await safeCompile(texAtsPath, errors, "ATS");

  return {
    texPath,
    pdfPath,
    texAtsPath,
    pdfAtsPath,
    compileError: errors.length ? errors.join(" | ") : null,
  };
}

async function safeCompile(
  texPath: string,
  errors: string[],
  label: string,
): Promise<string | null> {
  try {
    const { pdfPath } = await compilePdf(texPath);
    return pdfPath;
  } catch (err) {
    if (err instanceof AppError) {
      errors.push(`${label}: ${err.message}${err.hint ? ` — ${err.hint}` : ""}`);
      return null;
    }
    throw err;
  }
}
