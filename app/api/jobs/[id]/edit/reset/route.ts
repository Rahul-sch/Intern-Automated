/**
 * POST /api/jobs/[id]/edit/reset
 * Discard the user's overrides on the latest generation and recompile both
 * PDFs from the original LLM `tailored_json`.
 */
import { requireUser } from "@/lib/auth";
import { db, type JobRow } from "@/lib/db";
import { AppError, ok, withErrorEnvelope } from "@/lib/errors";
import type { Tailored } from "@/lib/tailor";
import { buildBoth } from "@/lib/build";
import {
  loadUserProfile,
  loadUserProjects,
  loadUserSkills,
} from "@/lib/userdata";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  return withErrorEnvelope(async () => {
    const { userId } = await requireUser();
    const { id } = await ctx.params;
    const job = db()
      .prepare(`SELECT * FROM jobs WHERE id = ? AND user_id = ?`)
      .get(id, userId) as JobRow | undefined;
    if (!job) throw new AppError("NOT_FOUND", "Job not found", undefined, 404);

    const latest = db()
      .prepare(
        `SELECT id, tailored_json FROM generations
         WHERE job_id = ? AND user_id = ?
         ORDER BY created_at DESC LIMIT 1`,
      )
      .get(id, userId) as { id: string; tailored_json: string } | undefined;
    if (!latest) {
      throw new AppError(
        "NOT_FOUND",
        "No generation to reset — click Generate first.",
        undefined,
        404,
      );
    }

    const original = JSON.parse(latest.tailored_json) as Tailored;
    const profile = loadUserProfile(userId);
    const projects = loadUserProjects(userId);
    const skills = loadUserSkills(userId);
    if (!profile) {
      throw new AppError("VALIDATION", "Profile missing — finish onboarding first.");
    }

    db()
      .prepare(`UPDATE generations SET tailored_overrides_json = NULL WHERE id = ?`)
      .run(latest.id);

    const built = await buildBoth({
      jobId: id,
      profile,
      projects,
      skills,
      tailored: original,
    });

    db()
      .prepare(
        `UPDATE generations
         SET tex_path = ?, pdf_path = ?, tex_ats_path = ?, pdf_ats_path = ?
         WHERE id = ?`,
      )
      .run(
        built.texPath,
        built.pdfPath,
        built.texAtsPath,
        built.pdfAtsPath,
        latest.id,
      );

    db()
      .prepare(
        `UPDATE jobs
         SET tex_path = ?, pdf_path = ?, updated_at = datetime('now')
         WHERE id = ? AND user_id = ?`,
      )
      .run(built.texPath, built.pdfPath, id, userId);

    return ok({
      generationId: latest.id,
      tailored: original,
      pdfPath: built.pdfPath,
      pdfAtsPath: built.pdfAtsPath,
      compileError: built.compileError,
    });
  });
}
