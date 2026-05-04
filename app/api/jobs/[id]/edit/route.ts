/**
 * PATCH /api/jobs/[id]/edit       — save user-edited Tailored object on the
 *                                    latest generation; recompile both PDFs.
 *
 * Edits are scoped to a single generation row (and therefore a single job)
 * owned by the signed-in user. They never touch the user's library.
 */
import { requireUser } from "@/lib/auth";
import { db, type JobRow } from "@/lib/db";
import { AppError, ok, withErrorEnvelope, fail } from "@/lib/errors";
import { TailoredSchema, type Tailored, validateTailored } from "@/lib/tailor";
import { buildBoth } from "@/lib/build";
import {
  loadUserProfile,
  loadUserProjects,
  loadUserSkills,
} from "@/lib/userdata";

export const runtime = "nodejs";
export const maxDuration = 120;

type LatestGen = {
  id: string;
  tailored_json: string;
  tailored_overrides_json: string | null;
};

function getLatest(jobId: string, userId: string): LatestGen | undefined {
  return db()
    .prepare(
      `SELECT id, tailored_json, tailored_overrides_json
       FROM generations
       WHERE job_id = ? AND user_id = ?
       ORDER BY created_at DESC LIMIT 1`,
    )
    .get(jobId, userId) as LatestGen | undefined;
}

async function rebuild(args: {
  userId: string;
  jobId: string;
  generationId: string;
  tailored: Tailored;
  overridesJson: string | null;
}) {
  const profile = loadUserProfile(args.userId);
  const projects = loadUserProjects(args.userId);
  const skills = loadUserSkills(args.userId);
  if (!profile) {
    throw new AppError("VALIDATION", "Profile missing — finish onboarding first.");
  }

  validateTailored(args.tailored, projects, skills);

  db()
    .prepare(`UPDATE generations SET tailored_overrides_json = ? WHERE id = ?`)
    .run(args.overridesJson, args.generationId);

  const built = await buildBoth({
    jobId: args.jobId,
    profile,
    projects,
    skills,
    tailored: args.tailored,
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
      args.generationId,
    );

  db()
    .prepare(
      `UPDATE jobs
       SET tex_path = ?, pdf_path = ?, updated_at = datetime('now')
       WHERE id = ? AND user_id = ?`,
    )
    .run(built.texPath, built.pdfPath, args.jobId, args.userId);

  return built;
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  return withErrorEnvelope(async () => {
    const { userId } = await requireUser();
    const { id } = await ctx.params;
    const job = db()
      .prepare(`SELECT * FROM jobs WHERE id = ? AND user_id = ?`)
      .get(id, userId) as JobRow | undefined;
    if (!job) throw new AppError("NOT_FOUND", "Job not found", undefined, 404);

    const latest = getLatest(id, userId);
    if (!latest) {
      throw new AppError(
        "NOT_FOUND",
        "No generation to edit yet — click Generate first.",
        undefined,
        404,
      );
    }

    const raw = await req.json().catch(() => null);
    const parsed = TailoredSchema.safeParse(raw);
    if (!parsed.success) {
      return fail("VALIDATION", parsed.error.issues[0].message, 400);
    }

    const built = await rebuild({
      userId,
      jobId: id,
      generationId: latest.id,
      tailored: parsed.data,
      overridesJson: JSON.stringify(parsed.data),
    });

    return ok({
      generationId: latest.id,
      tailored: parsed.data,
      pdfPath: built.pdfPath,
      pdfAtsPath: built.pdfAtsPath,
      compileError: built.compileError,
    });
  });
}
