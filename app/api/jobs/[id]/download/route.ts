/**
 * GET /api/jobs/[id]/download?format=pdf|tex|pdf-ats|tex-ats
 *
 * Reads file paths from the latest generations row (scoped to the signed-in
 * user); filename uses the user's profile name when available.
 */
import fs from "node:fs";
import { requireUser } from "@/lib/auth";
import { db, type JobRow } from "@/lib/db";
import { loadUserProfile } from "@/lib/userdata";

export const runtime = "nodejs";

type Format = "pdf" | "tex" | "pdf-ats" | "tex-ats";
const FORMATS: readonly Format[] = ["pdf", "tex", "pdf-ats", "tex-ats"] as const;

function slug(parts: string[]): string {
  return parts
    .filter(Boolean)
    .join("-")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { userId } = await requireUser();
  const { id } = await ctx.params;
  const formatParam = new URL(req.url).searchParams.get("format") ?? "pdf";
  if (!FORMATS.includes(formatParam as Format)) {
    return Response.json(
      {
        ok: false,
        error: { code: "VALIDATION", message: `format must be one of ${FORMATS.join(", ")}` },
      },
      { status: 400 },
    );
  }
  const format = formatParam as Format;

  const job = db()
    .prepare(`SELECT * FROM jobs WHERE id = ? AND user_id = ?`)
    .get(id, userId) as JobRow | undefined;
  if (!job) {
    return Response.json(
      { ok: false, error: { code: "NOT_FOUND", message: "Job not found" } },
      { status: 404 },
    );
  }

  const gen = db()
    .prepare(
      `SELECT tex_path, pdf_path, tex_ats_path, pdf_ats_path
       FROM generations
       WHERE job_id = ? AND user_id = ?
       ORDER BY created_at DESC LIMIT 1`,
    )
    .get(id, userId) as
    | {
        tex_path: string | null;
        pdf_path: string | null;
        tex_ats_path: string | null;
        pdf_ats_path: string | null;
      }
    | undefined;

  const filePath =
    format === "pdf"
      ? gen?.pdf_path
      : format === "tex"
        ? gen?.tex_path
        : format === "pdf-ats"
          ? gen?.pdf_ats_path
          : gen?.tex_ats_path;

  if (!filePath || !fs.existsSync(filePath)) {
    return Response.json(
      {
        ok: false,
        error: {
          code: "NOT_FOUND",
          message: `No ${format} file yet — click Generate first.`,
        },
      },
      { status: 404 },
    );
  }

  const data = fs.readFileSync(filePath);
  const profile = loadUserProfile(userId);
  const userSlug = slug(
    profile?.name ? [profile.name] : ["resume"],
  );
  const jobSlug = slug([job.company, job.title]);
  const isPdf = format === "pdf" || format === "pdf-ats";
  const isAts = format === "pdf-ats" || format === "tex-ats";
  const ext = isPdf ? "pdf" : "tex";
  const variant = isAts ? "-ats" : "";
  const filename = `${userSlug || "resume"}-${jobSlug || job.id}${variant}.${ext}`;
  const disposition =
    new URL(req.url).searchParams.get("disposition") === "inline"
      ? "inline"
      : "attachment";
  return new Response(new Uint8Array(data), {
    status: 200,
    headers: {
      "Content-Type": isPdf
        ? "application/pdf"
        : "application/x-tex; charset=utf-8",
      "Content-Disposition": `${disposition}; filename="${filename}"`,
    },
  });
}
