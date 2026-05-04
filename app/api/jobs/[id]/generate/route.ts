/**
 * POST /api/jobs/[id]/generate
 * Tailor → render both templates → compile both PDFs. Persists a generations
 * row and updates the job with the (pretty) tex/pdf paths and rationale.
 */
import { requireGroqKey, requireUser } from "@/lib/auth";
import { db, newId, type JobRow } from "@/lib/db";
import { AppError, ok, withErrorEnvelope } from "@/lib/errors";
import { TAILOR_MODEL, tailorResume } from "@/lib/tailor";
import { buildBoth } from "@/lib/build";
import {
  loadUserProfile,
  loadUserProjects,
  loadUserSkills,
} from "@/lib/userdata";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  return withErrorEnvelope(async () => {
    const { userId } = await requireUser();
    const apiKey = await requireGroqKey();
    const { id } = await ctx.params;
    const job = db()
      .prepare(`SELECT * FROM jobs WHERE id = ? AND user_id = ?`)
      .get(id, userId) as JobRow | undefined;
    if (!job) throw new AppError("NOT_FOUND", "Job not found", undefined, 404);

    const profile = loadUserProfile(userId);
    const projects = loadUserProjects(userId);
    const skills = loadUserSkills(userId);
    if (!profile) {
      throw new AppError(
        "VALIDATION",
        "Finish onboarding before tailoring.",
        "Visit /onboarding to upload your resume.",
        400,
      );
    }

    const tailored = await tailorResume({
      profile,
      projects,
      skills,
      jd: job.jd_text,
      company: job.company,
      title: job.title,
      apiKey,
    });

    const built = await buildBoth({
      jobId: job.id,
      profile,
      projects,
      skills,
      tailored,
    });

    const genId = newId();
    db()
      .prepare(
        `INSERT INTO generations
           (id, job_id, user_id, tailored_json, tex_path, pdf_path,
            tex_ats_path, pdf_ats_path, model)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        genId,
        job.id,
        userId,
        JSON.stringify(tailored),
        built.texPath,
        built.pdfPath,
        built.texAtsPath,
        built.pdfAtsPath,
        TAILOR_MODEL,
      );

    db()
      .prepare(
        `UPDATE jobs
         SET status = CASE WHEN status = 'new' THEN 'generated' ELSE status END,
             rationale = ?, tex_path = ?, pdf_path = ?, updated_at = datetime('now')
         WHERE id = ? AND user_id = ?`,
      )
      .run(tailored.rationale, built.texPath, built.pdfPath, job.id, userId);

    return ok({
      id: genId,
      tailored,
      texPath: built.texPath,
      pdfPath: built.pdfPath,
      texAtsPath: built.texAtsPath,
      pdfAtsPath: built.pdfAtsPath,
      compileError: built.compileError,
    });
  });
}
