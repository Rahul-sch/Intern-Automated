"use client";

import { Reorder } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { apiPatch, apiPost, ApiError } from "@/lib/api";
import type { Project, Skills } from "@/lib/library";
import type { Tailored } from "@/lib/tailor";
import { SkillChips } from "./SkillChips";
import { SortableProjectCard } from "./SortableProjectCard";

const SUMMARY_LIMIT = 220;

type Variant = "pretty" | "ats";

export function Editor({
  jobId,
  generationId,
  original,
  override,
  projects,
  skills,
  hasPdf,
  hasAtsPdf,
}: {
  jobId: string;
  generationId: string;
  original: Tailored;
  override: Tailored | null;
  projects: Project[];
  skills: Skills;
  hasPdf: boolean;
  hasAtsPdf: boolean;
}) {
  const router = useRouter();
  const projectById = useMemo(
    () => new Map(projects.map((p) => [p.id, p])),
    [projects],
  );
  const skillById = useMemo(
    () => new Map(skills.categories.map((c) => [c.id, c])),
    [skills],
  );

  const initial = useMemo<Tailored>(
    () => deepClone(override ?? original),
    [override, original],
  );

  const [working, setWorking] = useState<Tailored>(initial);
  const [savedSnapshot, setSavedSnapshot] = useState<Tailored>(initial);
  const [busy, setBusy] = useState<null | "save" | "reset">(null);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [savedTick, setSavedTick] = useState(0);
  const [variant, setVariant] = useState<Variant>("pretty");
  const [previewKey, setPreviewKey] = useState(generationId);

  const dirty = useMemo(
    () => !deepEqual(working, savedSnapshot),
    [working, savedSnapshot],
  );

  // Warn before tab close while dirty.
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  // Cmd/Ctrl+S → save. Ref is updated in an effect (not during render) so the
  // global keydown handler always sees the latest closure.
  const saveRef = useRef<() => void>(() => {});

  async function save() {
    if (busy || !dirty) return;
    setBusy("save");
    setError(null);
    setWarning(null);
    try {
      const res = await apiPatch<{
        generationId: string;
        compileError: string | null;
      }>(`/api/jobs/${jobId}/edit`, working);
      setSavedSnapshot(deepClone(working));
      setSavedTick((t) => t + 1);
      setPreviewKey(`${res.generationId}-${Date.now()}`);
      if (res.compileError) setWarning(res.compileError);
      router.refresh();
    } catch (err) {
      surfaceError(err, setError);
    } finally {
      setBusy(null);
    }
  }

  useEffect(() => {
    saveRef.current = save;
  });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isSave =
        (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s" && !e.shiftKey;
      if (!isSave) return;
      e.preventDefault();
      saveRef.current();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  async function resetAll() {
    if (busy) return;
    if (!confirm("Discard all edits and rebuild from the LLM original?")) return;
    setBusy("reset");
    setError(null);
    setWarning(null);
    try {
      const res = await apiPost<{
        compileError: string | null;
        tailored: Tailored;
      }>(`/api/jobs/${jobId}/edit/reset`);
      const fresh = deepClone(res.tailored);
      setWorking(fresh);
      setSavedSnapshot(fresh);
      setPreviewKey(`reset-${Date.now()}`);
      if (res.compileError) setWarning(res.compileError);
      router.refresh();
    } catch (err) {
      surfaceError(err, setError);
    } finally {
      setBusy(null);
    }
  }

  // Per-section restore from `original` — purely client-side, no server call;
  // the user still has to click Save to persist + recompile.
  function resetSummary() {
    setWorking((w) => ({ ...w, summary: original.summary }));
  }
  function resetProjects() {
    setWorking((w) => ({
      ...w,
      project_ids: original.project_ids.slice(),
      project_bullet_rewrites: deepClone(original.project_bullet_rewrites),
    }));
  }
  function resetProjectBullets(projectId: string) {
    setWorking((w) => ({
      ...w,
      project_bullet_rewrites: {
        ...w.project_bullet_rewrites,
        [projectId]: (original.project_bullet_rewrites[projectId] ?? []).slice(),
      },
    }));
  }
  function resetSkillCategory(catId: string) {
    setWorking((w) => ({
      ...w,
      skill_emphasis: {
        ...w.skill_emphasis,
        [catId]: (original.skill_emphasis[catId] ?? []).slice(),
      },
    }));
  }

  const summaryLen = working.summary.length;
  const summaryTone =
    summaryLen > SUMMARY_LIMIT
      ? "text-rose-600 dark:text-rose-400"
      : summaryLen > SUMMARY_LIMIT * 0.9
        ? "text-amber-600 dark:text-amber-400"
        : "text-slate-400";

  const summaryDirty = working.summary !== original.summary;
  const projectsDirty =
    !arrayEqual(working.project_ids, original.project_ids) ||
    !deepEqual(
      working.project_bullet_rewrites,
      original.project_bullet_rewrites,
    );

  const previewSrc = `/api/jobs/${jobId}/download?format=${
    variant === "pretty" ? "pdf" : "pdf-ats"
  }&disposition=inline&v=${previewKey}`;
  const previewAvailable = variant === "pretty" ? hasPdf : hasAtsPdf;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <div className="space-y-4">
        {/* Summary */}
        <Section
          title="Summary"
          rightSlot={
            <button
              type="button"
              onClick={resetSummary}
              disabled={!summaryDirty}
              className="text-[11px] text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 disabled:opacity-30 disabled:hover:text-slate-500"
            >
              Reset
            </button>
          }
        >
          <textarea
            value={working.summary}
            onChange={(e) =>
              setWorking((w) => ({ ...w, summary: e.target.value }))
            }
            rows={3}
            className="w-full resize-none rounded border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-sm leading-relaxed outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          />
          <div className={`text-[11px] text-right ${summaryTone}`}>
            {summaryLen} / {SUMMARY_LIMIT}
          </div>
        </Section>

        {/* Projects */}
        <Section
          title="Projects (drag to reorder)"
          rightSlot={
            <button
              type="button"
              onClick={resetProjects}
              disabled={!projectsDirty}
              className="text-[11px] text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 disabled:opacity-30 disabled:hover:text-slate-500"
            >
              Reset section
            </button>
          }
        >
          <Reorder.Group
            axis="y"
            values={working.project_ids}
            onReorder={(next: string[]) =>
              setWorking((w) => ({ ...w, project_ids: next }))
            }
            className="space-y-2"
          >
            {working.project_ids.map((pid, idx) => {
              const project = projectById.get(pid);
              if (!project) return null;
              const bullets = working.project_bullet_rewrites[pid] ?? [];
              const originalBullets =
                original.project_bullet_rewrites[pid] ?? [];
              const bulletsDirty =
                !pid || !arrayEqual(bullets, originalBullets);
              return (
                <SortableProjectCard
                  key={pid}
                  project={project}
                  bullets={bullets}
                  index={idx}
                  onBulletsChange={(next) =>
                    setWorking((w) => ({
                      ...w,
                      project_bullet_rewrites: {
                        ...w.project_bullet_rewrites,
                        [pid]: next,
                      },
                    }))
                  }
                  onReset={() => resetProjectBullets(pid)}
                  resetDisabled={!bulletsDirty}
                />
              );
            })}
          </Reorder.Group>
        </Section>

        {/* Skills */}
        <Section title="Technical skills">
          <div className="space-y-3">
            {working.skill_order.map((catId) => {
              const cat = skillById.get(catId);
              if (!cat) return null;
              const items = working.skill_emphasis[catId] ?? [];
              const originalItems = original.skill_emphasis[catId] ?? [];
              return (
                <SkillChips
                  key={catId}
                  label={cat.label}
                  items={items}
                  onChange={(next) =>
                    setWorking((w) => ({
                      ...w,
                      skill_emphasis: { ...w.skill_emphasis, [catId]: next },
                    }))
                  }
                  onReset={() => resetSkillCategory(catId)}
                  resetDisabled={arrayEqual(items, originalItems)}
                />
              );
            })}
          </div>
        </Section>

        {/* Toolbar */}
        <div className="sticky bottom-2 z-10 rounded-lg border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 backdrop-blur px-3 py-2 shadow-lg">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={save}
              disabled={busy !== null || !dirty}
              className="px-3 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy === "save" ? "Saving…" : dirty ? "Save & compile" : "Saved"}
            </button>
            <button
              type="button"
              onClick={resetAll}
              disabled={busy !== null}
              className="px-3 py-1.5 text-sm rounded border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
            >
              {busy === "reset" ? "Resetting…" : "Reset to LLM"}
            </button>
            <span className="grow" />
            <a
              href={`/api/jobs/${jobId}/download?format=pdf`}
              className={`px-2.5 py-1 text-xs rounded border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 ${hasPdf ? "" : "opacity-40 pointer-events-none"}`}
            >
              Pretty PDF
            </a>
            <a
              href={`/api/jobs/${jobId}/download?format=pdf-ats`}
              className={`px-2.5 py-1 text-xs rounded border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 ${hasAtsPdf ? "" : "opacity-40 pointer-events-none"}`}
            >
              ATS PDF
            </a>
          </div>
          {(error || warning || savedTick > 0) && (
            <div className="mt-2 text-xs">
              {error && (
                <div className="text-rose-600 dark:text-rose-400">{error}</div>
              )}
              {warning && (
                <div className="text-amber-700 dark:text-amber-400">
                  {warning}
                </div>
              )}
              {!error && !warning && savedTick > 0 && !dirty && (
                <div className="text-emerald-600 dark:text-emerald-400">
                  Saved · both PDFs recompiled
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Preview pane */}
      <div className="space-y-2 min-w-0">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Preview
          </h3>
          <div className="inline-flex rounded border border-slate-300 dark:border-slate-700 overflow-hidden text-xs">
            <button
              type="button"
              onClick={() => setVariant("pretty")}
              className={`px-2.5 py-1 ${variant === "pretty" ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900" : "hover:bg-slate-100 dark:hover:bg-slate-800"}`}
            >
              Pretty
            </button>
            <button
              type="button"
              onClick={() => setVariant("ats")}
              className={`px-2.5 py-1 border-l border-slate-300 dark:border-slate-700 ${variant === "ats" ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900" : "hover:bg-slate-100 dark:hover:bg-slate-800"}`}
            >
              ATS-plain
            </button>
          </div>
        </div>
        {previewAvailable ? (
          <iframe
            key={`${variant}-${previewKey}`}
            src={previewSrc}
            className="w-full h-[88vh] rounded border border-slate-200 dark:border-slate-800 bg-white"
            title={`${variant} resume preview`}
          />
        ) : (
          <div className="rounded border border-dashed border-slate-300 dark:border-slate-700 p-6 text-sm text-slate-500 text-center">
            {variant === "ats"
              ? "ATS-plain PDF will appear after the next save (or regenerate)."
              : "PDF compile failed — check the warning above and try Save again."}
          </div>
        )}
      </div>
    </div>
  );
}

function Section({
  title,
  rightSlot,
  children,
}: {
  title: string;
  rightSlot?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
          {title}
        </h3>
        {rightSlot}
      </div>
      {children}
    </section>
  );
}

function surfaceError(err: unknown, set: (msg: string) => void) {
  if (err instanceof ApiError) {
    set(err.hint ? `${err.message} — ${err.hint}` : err.message);
  } else {
    set(err instanceof Error ? err.message : "Save failed");
  }
}

function deepClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}
function deepEqual<T>(a: T, b: T): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
function arrayEqual<T>(a: T[], b: T[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
