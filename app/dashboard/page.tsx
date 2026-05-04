import Link from "next/link";
import { db, type JobRow } from "@/lib/db";

type JobListRow = Omit<JobRow, "jd_text">;

const STATUS_COLORS: Record<string, string> = {
  new: "bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-100",
  generated: "bg-blue-200 text-blue-900 dark:bg-blue-800 dark:text-blue-100",
  applied: "bg-emerald-200 text-emerald-900 dark:bg-emerald-800 dark:text-emerald-100",
  rejected: "bg-rose-200 text-rose-900 dark:bg-rose-800 dark:text-rose-100",
  archived: "bg-slate-300 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
};

export default function Dashboard() {
  const jobs = db()
    .prepare(
      `SELECT id, url_hash, url, company, title, status, rationale, tex_path, pdf_path, created_at, updated_at
       FROM jobs
       ORDER BY created_at DESC`,
    )
    .all() as JobListRow[];

  const byStatus = {
    new: jobs.filter((j) => j.status === "new").length,
    generated: jobs.filter((j) => j.status === "generated").length,
    applied: jobs.filter((j) => j.status === "applied").length,
    rejected: jobs.filter((j) => j.status === "rejected").length,
  };

  return (
    <main className="mx-auto max-w-5xl w-full px-6 py-10 space-y-8">
      <header className="flex items-start justify-between gap-6">
        <div>
          <h1 className="text-3xl font-semibold">InternShippy</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Tailored resumes for YC / a16z applications.
          </p>
          <div className="flex gap-3 mt-3 text-xs text-slate-500">
            <span>{byStatus.new} new</span>
            <span>·</span>
            <span>{byStatus.generated} generated</span>
            <span>·</span>
            <span>{byStatus.applied} applied</span>
            <span>·</span>
            <span>{byStatus.rejected} rejected</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Link
            href="/library"
            className="px-3 py-2 text-sm rounded border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Library
          </Link>
          <Link
            href="/jobs/new"
            className="px-3 py-2 text-sm rounded bg-blue-600 text-white hover:bg-blue-500"
          >
            + New job
          </Link>
        </div>
      </header>

      {jobs.length === 0 ? (
        <div className="border border-dashed border-slate-300 dark:border-slate-700 rounded p-10 text-center text-sm text-slate-500">
          No jobs yet. Paste your first YC / a16z posting to get started.
        </div>
      ) : (
        <ul className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded">
          {jobs.map((j) => (
            <li key={j.id}>
              <Link
                href={`/jobs/${j.id}`}
                className="block px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-900 transition"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{j.company}</span>
                      <span className="text-slate-400">·</span>
                      <span className="text-slate-700 dark:text-slate-300 truncate">
                        {j.title}
                      </span>
                    </div>
                    {j.rationale && (
                      <p className="text-xs text-slate-500 mt-1 line-clamp-1">
                        {j.rationale}
                      </p>
                    )}
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[j.status] ?? ""}`}
                  >
                    {j.status}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
