/**
 * GET   /api/jobs/[id] — full job (incl. jd_text) + latest generation meta
 * PATCH /api/jobs/[id] — update status { status }
 * DELETE /api/jobs/[id] — remove job + cascaded generations (files stay on disk)
 */
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db, type JobRow, type JobStatus } from "@/lib/db";
import { AppError, fail, ok, withErrorEnvelope } from "@/lib/errors";

export const runtime = "nodejs";

const STATUSES: JobStatus[] = ["new", "generated", "applied", "rejected", "archived"];
const PatchBody = z.object({
  status: z.enum(STATUSES as [JobStatus, ...JobStatus[]]),
});

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return withErrorEnvelope(async () => {
    const { userId } = await requireUser();
    const { id } = await ctx.params;
    const row = db()
      .prepare(`SELECT * FROM jobs WHERE id = ? AND user_id = ?`)
      .get(id, userId) as JobRow | undefined;
    if (!row) throw new AppError("NOT_FOUND", "Job not found", undefined, 404);

    const gen = db()
      .prepare(
        `SELECT id, created_at, model, tailored_json, tailored_overrides_json,
                pdf_path, pdf_ats_path
         FROM generations
         WHERE job_id = ? ORDER BY created_at DESC LIMIT 1`,
      )
      .get(id) as
      | {
          id: string;
          created_at: string;
          model: string;
          tailored_json: string;
          tailored_overrides_json: string | null;
          pdf_path: string | null;
          pdf_ats_path: string | null;
        }
      | undefined;

    return ok({
      job: row,
      latest: gen
        ? {
            id: gen.id,
            created_at: gen.created_at,
            model: gen.model,
            tailored: JSON.parse(gen.tailored_json),
            overrides: gen.tailored_overrides_json
              ? JSON.parse(gen.tailored_overrides_json)
              : null,
            hasPdf: !!gen.pdf_path,
            hasAtsPdf: !!gen.pdf_ats_path,
          }
        : null,
    });
  });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return withErrorEnvelope(async () => {
    const { userId } = await requireUser();
    const { id } = await ctx.params;
    const raw = await req.json().catch(() => null);
    const parsed = PatchBody.safeParse(raw);
    if (!parsed.success) return fail("VALIDATION", parsed.error.issues[0].message, 400);

    const res = db()
      .prepare(
        `UPDATE jobs SET status = ?, updated_at = datetime('now')
         WHERE id = ? AND user_id = ?`,
      )
      .run(parsed.data.status, id, userId);
    if (res.changes === 0)
      throw new AppError("NOT_FOUND", "Job not found", undefined, 404);
    return ok({ id, status: parsed.data.status });
  });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  return withErrorEnvelope(async () => {
    const { userId } = await requireUser();
    const { id } = await ctx.params;
    const res = db()
      .prepare(`DELETE FROM jobs WHERE id = ? AND user_id = ?`)
      .run(id, userId);
    if (res.changes === 0)
      throw new AppError("NOT_FOUND", "Job not found", undefined, 404);
    return ok({ id });
  });
}
