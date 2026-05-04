/**
 * PATCH /api/jobs/[id]/edit       — save user-edited Tailored object on the
 *                                    latest generation; recompile both PDFs.
 * POST  /api/jobs/[id]/edit/reset — clear overrides; recompile both PDFs from
 *                                    the original LLM tailored_json.
 *
 * Edits are scoped to a single generation row (and therefore a single job).
 * They never touch data/projects.json or the rest of the library.
 */
import { db, type JobRow } from "@/lib/db";
import { AppError, ok, withErrorEnvelope, fail } from "@/lib/errors";
import { loadProfile, loadProjects, loadSkills } from "@/lib/library";
import { TailoredSchema, type Tailored, validateTailored } from "@/lib/tailor";
import { buildBoth } from "@/lib/build";

export const runtime = "nodejs";
export const maxDuration = 120;

type LatestGen = {
  id: string;
  tailored_json: string;
  tailored_overrides_json: string | null;
};

function getLatest(jobId: string): LatestGen | undefined {
  return db()
    .prepare(
      `SELECT id, tailored_json, tailored_overrides_json
       FROM generations WHERE job_id = ? ORDER BY created_at DESC LIMIT 1`,
    )
    .get(jobId) as LatestGen | undefined;
}

async function rebuild(args: {
  jobId: string;
  generationId: string;
  tailored: Tailored;
  overridesJson: string | null;
}) {
  const profile = loadProfile();
  const projects = loadProjects();
  const skills = loadSkills();

  // Cross-check the chosen project_ids and skill categories against the
  // current library so an override can't smuggle in unknown ids.
  validateTailored(args.tailored, projects, skills);

  // Persist overrides BEFORE compile so DB state is consistent even if
  // tectonic blows up — the next save will retry the compile.
  db()
    .prepare(
      `UPDATE generations SET tailored_overrides_json = ? WHERE id = ?`,
    )
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
       WHERE id = ?`,
    )
    .run(built.texPath, built.pdfPath, args.jobId);

  return built;
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  return withErrorEnvelope(async () => {
    const { id } = await ctx.params;
    const job = db().prepare(`SELECT * FROM jobs WHERE id = ?`).get(id) as
      | JobRow
      | undefined;
    if (!job) throw new AppError("NOT_FOUND", "Job not found", undefined, 404);

    const latest = getLatest(id);
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
