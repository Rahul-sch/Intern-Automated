"use client";

import { useState } from "react";

export function SkillChips({
  label,
  items,
  onChange,
  onReset,
  resetDisabled,
}: {
  label: string;
  items: string[];
  onChange: (next: string[]) => void;
  onReset: () => void;
  resetDisabled: boolean;
}) {
  const [draft, setDraft] = useState("");

  function add() {
    const v = draft.trim();
    if (!v) return;
    if (items.includes(v)) {
      setDraft("");
      return;
    }
    onChange([...items, v]);
    setDraft("");
  }

  function remove(index: number) {
    onChange(items.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
          {label}
        </span>
        <button
          type="button"
          onClick={onReset}
          disabled={resetDisabled}
          className="text-[11px] text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 disabled:opacity-30 disabled:hover:text-slate-500"
        >
          Reset
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1.5 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20">
        {items.map((item, i) => (
          <span
            key={`${item}-${i}`}
            className="group inline-flex items-center gap-1 rounded bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs text-slate-800 dark:text-slate-200"
          >
            {item}
            <button
              type="button"
              onClick={() => remove(i)}
              aria-label={`Remove ${item}`}
              className="text-slate-400 hover:text-rose-500"
            >
              ×
            </button>
          </span>
        ))}
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add();
            } else if (e.key === "Backspace" && draft === "" && items.length) {
              remove(items.length - 1);
            }
          }}
          onBlur={add}
          placeholder={items.length ? "" : "Add item…"}
          className="flex-1 min-w-[80px] bg-transparent outline-none text-xs py-0.5"
        />
      </div>
    </div>
  );
}
