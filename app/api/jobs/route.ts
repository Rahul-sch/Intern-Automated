/**
 * GET  /api/jobs — list signed-in user's jobs (newest first)
 * POST /api/jobs — create job { url?, company, title, jd_text }
 */
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db, hashUrl, newId, type JobRow } from "@/lib/db";
import { AppError, fail, ok, withErrorEnvelope } from "@/lib/errors";

export const runtime = "nodejs";

const CreateBody = z.object({
  url: z.string().url().optional().or(z.literal("").transform(() => undefined)),
  company: z.string().min(1).max(200),
  title: z.string().min(1).max(200),
  jd_text: z.string().min(40, "JD must be at least 40 characters"),
});

export async function GET() {
  return withErrorEnvelope(async () => {
    const { userId } = await requireUser();
    const rows = db()
      .prepare(
        `SELECT id, url_hash, url, company, title, status, rationale, tex_path, pdf_path, created_at, updated_at
         FROM jobs
         WHERE user_id = ?
         ORDER BY created_at DESC`,
      )
      .all(userId) as Omit<JobRow, "jd_text">[];
    return ok(rows);
  });
}

export async function POST(req: Request) {
  return withErrorEnvelope(async () => {
    const { userId } = await requireUser();
    const raw = await req.json().catch(() => null);
    const parsed = CreateBody.safeParse(raw);
    if (!parsed.success) {
      return fail("VALIDATION", parsed.error.issues[0].message, 400);
    }
    const { url, company, title, jd_text } = parsed.data;

    const id = newId();
    // Scope the dedupe hash to the user so two people can save the same JD.
    const basis = `${userId}::${url ?? `${company}::${title}::${jd_text.slice(0, 200)}`}`;
    const url_hash = hashUrl(basis);

    try {
      db()
        .prepare(
          `INSERT INTO jobs (id, user_id, url_hash, url, company, title, jd_text)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(id, userId, url_hash, url ?? null, company, title, jd_text);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("UNIQUE")) {
        throw new AppError(
          "DUPLICATE",
          "You've already tracked this job.",
          "Check the dashboard — it may be under a different status.",
          409,
        );
      }
      throw err;
    }
    return ok({ id });
  });
}
