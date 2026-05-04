import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { db, type JobRow } from "@/lib/db";
import type { Skills } from "@/lib/library";
import type { Tailored } from "@/lib/tailor";
import { loadUserProjects, loadUserSkills } from "@/lib/userdata";
import { Editor } from "./Editor";
import { JobActions } from "./JobActions";

export const dynamic = "force-dynamic";

export default async function JobDetail(props: {
  params: Promise<{ id: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/");

  const { id } = await props.params;
  const job = db()
    .prepare(`SELECT * FROM jobs WHERE id = ? AND user_id = ?`)
    .get(id, userId) as JobRow | undefined;
  if (!job) notFound();

  const latest = db()
    .prepare(
      `SELECT id, created_at, model, tailored_json, tailored_overrides_json,
              pdf_path, pdf_ats_path
       FROM generations
       WHERE job_id = ? AND user_id = ?
       ORDER BY created_at DESC LIMIT 1`,
    )
    .get(id, userId) as
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

  const original: Tailored | null = latest
    ? (JSON.parse(latest.tailored_json) as Tailored)
    : null;
  const override: Tailored | null = latest?.tailored_overrides_json
    ? (JSON.parse(latest.tailored_overrides_json) as Tailored)
    : null;

  const projects = latest ? loadUserProjects(userId) : [];
  const skills: Skills = latest
    ? loadUserSkills(userId)
    : { categories: [] };

  return (
    <main className="mx-auto max-w-7xl w-full px-6 py-6 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Link
            href="/dashboard"
            className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          >
            ← Dashboard
          </Link>
          <h1 className="text-2xl font-semibold mt-1">
            {job.company} · {job.title}
          </h1>
          {job.url && (
            <a
              href={job.url}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-blue-600 hover:underline break-all"
            >
              {job.url}
            </a>
          )}
        </div>
        <JobActions id={job.id} initialStatus={job.status} hasPdf={!!job.pdf_path} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <section className="lg:col-span-4 space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Job description
          </h2>
          <pre className="whitespace-pre-wrap text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded p-3 font-mono max-h-[88vh] overflow-auto">
            {job.jd_text}
          </pre>
          {original?.rationale && (
            <details className="text-xs">
              <summary className="cursor-pointer text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
                LLM rationale
              </summary>
              <p className="mt-2 text-slate-600 dark:text-slate-400 whitespace-pre-wrap">
                {original.rationale}
              </p>
              {latest && (
                <p className="mt-2 text-[11px] text-slate-400">
                  {latest.model} · {latest.created_at}
                </p>
              )}
            </details>
          )}
        </section>

        <section className="lg:col-span-8 min-w-0">
          {!latest || !original ? (
            <div className="border border-dashed border-slate-300 dark:border-slate-700 rounded p-8 text-sm text-slate-500 text-center">
              No generation yet. Click <b>Generate</b> above — takes ~15-40s.
            </div>
          ) : (
            <Editor
              jobId={job.id}
              generationId={latest.id}
              original={original}
              override={override}
              projects={projects}
              skills={skills}
              hasPdf={!!latest.pdf_path}
              hasAtsPdf={!!latest.pdf_ats_path}
            />
          )}
        </section>
      </div>
    </main>
  );
}
