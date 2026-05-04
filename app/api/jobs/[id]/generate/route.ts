/**
 * POST /api/jobs/[id]/generate
 * Tailor → render both templates → compile both PDFs. Persists a generations
 * row and updates the job with the (pretty) tex/pdf paths and rationale.
 */
import { db, newId, type JobRow } from "@/lib/db";
import { AppError, ok, withErrorEnvelope } from "@/lib/errors";
import { loadProfile, loadProjects, loadSkills } from "@/lib/library";
import { TAILOR_MODEL, tailorResume } from "@/lib/tailor";
import { buildBoth } from "@/lib/build";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  return withErrorEnvelope(async () => {
    const { id } = await ctx.params;
    const job = db().prepare(`SELECT * FROM jobs WHERE id = ?`).get(id) as
      | JobRow
      | undefined;
    if (!job) throw new AppError("NOT_FOUND", "Job not found", undefined, 404);

    const profile = loadProfile();
    const projects = loadProjects();
    const skills = loadSkills();

    const tailored = await tailorResume({
      profile,
      projects,
      skills,
      jd: job.jd_text,
      company: job.company,
      title: job.title,
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
           (id, job_id, tailored_json, tex_path, pdf_path,
            tex_ats_path, pdf_ats_path, model)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        genId,
        job.id,
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
         WHERE id = ?`,
      )
      .run(tailored.rationale, built.texPath, built.pdfPath, job.id);

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
