"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ApiError, apiPost } from "@/lib/api";
import type { Project } from "@/lib/library";
import type { GhRepo } from "@/lib/github";

type Mode = "closed" | "manual" | "github";

export function LibraryPanel({
  initialProjects,
}: {
  initialProjects: Project[];
}) {
  const router = useRouter();
  const [projects, setProjects] = useState(initialProjects);
  const [mode, setMode] = useState<Mode>("closed");

  function handleAdded(merged: Project[]) {
    setProjects(merged);
    setMode("closed");
    router.refresh();
  }

  async function remove(slug: string) {
    if (!confirm(`Remove "${slug}" from your library?`)) return;
    try {
      const res = await fetch(`/api/library/projects/${slug}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      const body = await res.json();
      if (!body.ok) throw new Error(body.error?.message ?? `HTTP ${res.status}`);
      setProjects(body.data.projects);
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Remove failed");
    }
  }

  return (
    <section className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
      <header className="flex items-baseline justify-between gap-3 px-4 py-3 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">
            Project library
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {projects.length} {projects.length === 1 ? "project" : "projects"}{" "}
            available to the tailoring AI.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          <button
            onClick={() => setMode(mode === "manual" ? "closed" : "manual")}
            className={`px-2.5 py-1 text-xs rounded border transition ${
              mode === "manual"
                ? "border-slate-900 dark:border-white bg-slate-900 dark:bg-white text-white dark:text-slate-900"
                : "border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            + Add manually
          </button>
          <button
            onClick={() => setMode(mode === "github" ? "closed" : "github")}
            className={`px-2.5 py-1 text-xs rounded border transition ${
              mode === "github"
                ? "border-slate-900 dark:border-white bg-slate-900 dark:bg-white text-white dark:text-slate-900"
                : "border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            Import from GitHub
          </button>
        </div>
      </header>

      {projects.length > 0 && mode === "closed" && (
        <ul className="divide-y divide-slate-100 dark:divide-slate-900">
          {projects.map((p) => (
            <li
              key={p.id}
              className="px-4 py-2 flex items-center justify-between gap-3 text-sm"
            >
              <div className="min-w-0">
                <span className="font-medium truncate">{p.name}</span>
                {p.stack && (
                  <span className="text-xs text-slate-500 ml-2 truncate">
                    {p.stack}
                  </span>
                )}
              </div>
              <button
                onClick={() => remove(p.id)}
                className="text-xs text-slate-400 hover:text-rose-600 shrink-0"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      {mode === "manual" && <ManualForm onAdded={handleAdded} />}
      {mode === "github" && <GithubImport onAdded={handleAdded} />}
    </section>
  );
}

// ----- Manual add ----------------------------------------------------------

function ManualForm({ onAdded }: { onAdded: (merged: Project[]) => void }) {
  const [name, setName] = useState("");
  const [stack, setStack] = useState("");
  const [date, setDate] = useState("");
  const [bullets, setBullets] = useState<string[]>(["", ""]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function slugify(s: string) {
    return s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40);
  }

  const cleanedBullets = bullets.map((b) => b.trim()).filter(Boolean);
  const canSubmit =
    name.trim().length > 0 && cleanedBullets.length >= 2 && !busy;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const project = {
        id: slugify(name) || "project",
        name: name.trim(),
        stack: stack.trim(),
        date: date.trim(),
        tags: [],
        bullets: cleanedBullets,
      };
      const res = await apiPost<{ projects: Project[] }>(
        "/api/library/projects",
        { project },
      );
      onAdded(res.projects);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : (err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="px-4 py-4 space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <Input placeholder="Name *" value={name} onChange={setName} />
        <Input
          placeholder="Stack (e.g., Python, FastAPI)"
          value={stack}
          onChange={setStack}
        />
        <Input placeholder="Date (e.g., Mar. 2026)" value={date} onChange={setDate} />
      </div>
      <div className="space-y-2">
        {bullets.map((b, i) => (
          <div key={i} className="flex gap-2">
            <textarea
              value={b}
              onChange={(e) =>
                setBullets((arr) => arr.map((x, idx) => (idx === i ? e.target.value : x)))
              }
              rows={2}
              placeholder={`Bullet ${i + 1}${i < 2 ? " *" : ""}`}
              className="flex-1 rounded border border-slate-300 dark:border-slate-700 bg-transparent px-2 py-1.5 text-sm font-mono leading-snug resize-none outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
            {bullets.length > 2 && (
              <button
                type="button"
                onClick={() =>
                  setBullets((arr) => arr.filter((_, idx) => idx !== i))
                }
                className="text-xs text-slate-400 hover:text-rose-600 px-2"
              >
                ×
              </button>
            )}
          </div>
        ))}
        {bullets.length < 3 && (
          <button
            type="button"
            onClick={() => setBullets((b) => [...b, ""])}
            className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          >
            + add bullet
          </button>
        )}
      </div>
      {error && (
        <div className="text-xs text-rose-600 dark:text-rose-400">{error}</div>
      )}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={!canSubmit}
          className="px-3 py-1.5 text-xs rounded bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {busy ? "Saving…" : "Save project"}
        </button>
      </div>
    </form>
  );
}

// ----- GitHub import -------------------------------------------------------

type GhStep = "token" | "select" | "review";

function GithubImport({ onAdded }: { onAdded: (merged: Project[]) => void }) {
  const [step, setStep] = useState<GhStep>("token");
  const [token, setToken] = useState("");
  const [repos, setRepos] = useState<GhRepo[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [drafts, setDrafts] = useState<
    {
      id: string;
      name: string;
      stack: string;
      date: string;
      tags: string[];
      bullets: string[];
    }[]
  >([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchRepos(e: React.FormEvent) {
    e.preventDefault();
    if (busy || token.trim().length < 20) return;
    setBusy(true);
    setError(null);
    try {
      const res = await apiPost<{ login: string; repos: GhRepo[] }>(
        "/api/library/github/repos",
        { token: token.trim() },
      );
      setRepos(res.repos);
      setPicked(new Set());
      setStep("select");
    } catch (err) {
      setError(humanError(err));
    } finally {
      setBusy(false);
    }
  }

  async function generateDrafts() {
    const selected = repos.filter((r) => picked.has(r.full_name));
    if (selected.length === 0) {
      setError("Pick at least one repo.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await apiPost<{
        drafts: typeof drafts;
      }>("/api/library/github/import", {
        token: token.trim(),
        repos: selected.map((r) => ({
          owner: r.owner,
          repo: r.name,
          description: r.description,
          pushed_at: r.pushed_at,
        })),
      });
      setDrafts(res.drafts);
      setStep("review");
    } catch (err) {
      setError(humanError(err));
    } finally {
      setBusy(false);
    }
  }

  async function saveDrafts() {
    if (drafts.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const res = await apiPost<{ projects: Project[] }>(
        "/api/library/projects",
        { projects: drafts },
      );
      onAdded(res.projects);
    } catch (err) {
      setError(humanError(err));
      setBusy(false);
    }
  }

  if (step === "token") {
    return (
      <form onSubmit={fetchRepos} className="px-4 py-4 space-y-3">
        <p className="text-xs text-slate-500">
          Paste a{" "}
          <a
            href="https://github.com/settings/tokens"
            target="_blank"
            rel="noreferrer"
            className="underline hover:opacity-80"
          >
            GitHub PAT
          </a>{" "}
          with <code>repo</code> scope. We use it once to fetch your repo list
          and then discard it — never stored.
        </p>
        <input
          type="password"
          autoComplete="off"
          placeholder="ghp_..."
          value={token}
          onChange={(e) => setToken(e.target.value)}
          className="w-full rounded border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-sm font-mono outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
        />
        {error && (
          <div className="text-xs text-rose-600 dark:text-rose-400">{error}</div>
        )}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={busy || token.trim().length < 20}
            className="px-3 py-1.5 text-xs rounded bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {busy ? "Fetching…" : "Fetch my repos →"}
          </button>
        </div>
      </form>
    );
  }

  if (step === "select") {
    return (
      <div className="px-4 py-4 space-y-3">
        <p className="text-xs text-slate-500">
          Pick up to 8 repos. The AI will read each README and draft 2-3 bullets.
        </p>
        <div className="max-h-80 overflow-auto border border-slate-200 dark:border-slate-800 rounded">
          {repos.map((r) => {
            const checked = picked.has(r.full_name);
            return (
              <label
                key={r.full_name}
                className={`flex items-start gap-3 px-3 py-2 cursor-pointer text-sm border-b border-slate-100 dark:border-slate-900 last:border-b-0 ${checked ? "bg-slate-50 dark:bg-slate-900" : "hover:bg-slate-50 dark:hover:bg-slate-900"}`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => {
                    setPicked((prev) => {
                      const next = new Set(prev);
                      if (e.target.checked) {
                        if (next.size < 8) next.add(r.full_name);
                      } else next.delete(r.full_name);
                      return next;
                    });
                  }}
                  className="mt-1 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold truncate">{r.name}</span>
                    {r.language && (
                      <span className="text-[11px] text-slate-500">
                        {r.language}
                      </span>
                    )}
                    {r.stargazers_count > 0 && (
                      <span className="text-[11px] text-slate-500">
                        ★ {r.stargazers_count}
                      </span>
                    )}
                  </div>
                  {r.description && (
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                      {r.description}
                    </p>
                  )}
                </div>
              </label>
            );
          })}
        </div>
        {error && (
          <div className="text-xs text-rose-600 dark:text-rose-400">{error}</div>
        )}
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500">
            {picked.size} / {Math.min(repos.length, 8)} selected
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep("token")}
              className="px-3 py-1.5 text-xs rounded border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              ← Back
            </button>
            <button
              type="button"
              onClick={generateDrafts}
              disabled={busy || picked.size === 0}
              className="px-3 py-1.5 text-xs rounded bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {busy ? "Generating…" : `Generate bullets (${picked.size})`}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // step === "review"
  return (
    <div className="px-4 py-4 space-y-4">
      <p className="text-xs text-slate-500">
        Review the AI-drafted bullets. Edit anything before saving.
      </p>
      <div className="space-y-3">
        {drafts.map((d, i) => (
          <div
            key={d.id}
            className="rounded border border-slate-200 dark:border-slate-800 p-3 space-y-2"
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <Input
                value={d.name}
                onChange={(v) =>
                  setDrafts((arr) =>
                    arr.map((x, idx) => (idx === i ? { ...x, name: v } : x)),
                  )
                }
              />
              <Input
                value={d.stack}
                onChange={(v) =>
                  setDrafts((arr) =>
                    arr.map((x, idx) => (idx === i ? { ...x, stack: v } : x)),
                  )
                }
              />
              <Input
                value={d.date}
                onChange={(v) =>
                  setDrafts((arr) =>
                    arr.map((x, idx) => (idx === i ? { ...x, date: v } : x)),
                  )
                }
              />
            </div>
            <div className="space-y-1">
              {d.bullets.map((b, bi) => (
                <textarea
                  key={bi}
                  value={b}
                  rows={2}
                  onChange={(e) =>
                    setDrafts((arr) =>
                      arr.map((x, idx) =>
                        idx === i
                          ? {
                              ...x,
                              bullets: x.bullets.map((bb, bidx) =>
                                bidx === bi ? e.target.value : bb,
                              ),
                            }
                          : x,
                      ),
                    )
                  }
                  className="w-full rounded border border-slate-300 dark:border-slate-700 bg-transparent px-2 py-1.5 text-sm font-mono leading-snug resize-none outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      {error && (
        <div className="text-xs text-rose-600 dark:text-rose-400">{error}</div>
      )}
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => setStep("select")}
          disabled={busy}
          className="px-3 py-1.5 text-xs rounded border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
        >
          ← Reselect
        </button>
        <button
          type="button"
          onClick={saveDrafts}
          disabled={busy || drafts.length === 0}
          className="px-3 py-1.5 text-xs rounded bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {busy ? "Saving…" : `Save ${drafts.length} to library`}
        </button>
      </div>
    </div>
  );
}

// ----- shared --------------------------------------------------------------

function Input({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded border border-slate-300 dark:border-slate-700 bg-transparent px-2 py-1.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
    />
  );
}

function humanError(err: unknown): string {
  if (err instanceof ApiError) {
    return err.hint ? `${err.message} — ${err.hint}` : err.message;
  }
  return err instanceof Error ? err.message : "Something went wrong";
}
