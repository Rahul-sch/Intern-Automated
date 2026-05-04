"use client";

import { Reorder, useDragControls } from "motion/react";
import type { Project } from "@/lib/library";

const BULLET_LIMIT = 220;

export function SortableProjectCard({
  project,
  bullets,
  index,
  onBulletsChange,
  onReset,
  resetDisabled,
}: {
  project: Project;
  bullets: string[];
  index: number;
  onBulletsChange: (next: string[]) => void;
  onReset: () => void;
  resetDisabled: boolean;
}) {
  const controls = useDragControls();

  function update(i: number, value: string) {
    const next = bullets.slice();
    next[i] = value;
    onBulletsChange(next);
  }

  return (
    <Reorder.Item
      value={project.id}
      dragListener={false}
      dragControls={controls}
      className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-sm"
    >
      <div className="flex items-start gap-2 px-3 py-2.5 border-b border-slate-100 dark:border-slate-800/60">
        <button
          type="button"
          aria-label={`Drag ${project.name}`}
          onPointerDown={(e) => controls.start(e)}
          className="cursor-grab active:cursor-grabbing touch-none select-none px-1.5 py-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
        >
          <DragIcon />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-[11px] font-mono text-slate-400 w-5 shrink-0">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className="font-semibold truncate">{project.name}</span>
            <span className="text-slate-400 text-xs truncate">·</span>
            <span className="text-slate-500 text-xs italic truncate">
              {project.stack}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={onReset}
          disabled={resetDisabled}
          className="text-[11px] text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 disabled:opacity-30 disabled:hover:text-slate-500"
        >
          Reset
        </button>
      </div>
      <div className="p-3 space-y-2">
        {bullets.map((b, i) => {
          const len = b.length;
          const tone =
            len > BULLET_LIMIT
              ? "text-rose-600 dark:text-rose-400"
              : len > BULLET_LIMIT * 0.9
                ? "text-amber-600 dark:text-amber-400"
                : "text-slate-400";
          return (
            <div key={i} className="space-y-1">
              <textarea
                value={b}
                onChange={(e) => update(i, e.target.value)}
                rows={2}
                className="w-full resize-none rounded border border-slate-300 dark:border-slate-700 bg-transparent px-2 py-1.5 text-sm font-mono leading-snug outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
              <div className={`text-[11px] text-right ${tone}`}>
                {len} / {BULLET_LIMIT}
              </div>
            </div>
          );
        })}
      </div>
    </Reorder.Item>
  );
}

function DragIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden>
      <circle cx="4" cy="3" r="1.2" />
      <circle cx="4" cy="7" r="1.2" />
      <circle cx="4" cy="11" r="1.2" />
      <circle cx="10" cy="3" r="1.2" />
      <circle cx="10" cy="7" r="1.2" />
      <circle cx="10" cy="11" r="1.2" />
    </svg>
  );
}
