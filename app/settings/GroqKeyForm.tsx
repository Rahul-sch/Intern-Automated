"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ApiError, apiPost } from "@/lib/api";

export function GroqKeyForm({ hasKey }: { hasKey: boolean }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [reveal, setReveal] = useState(false);
  const [busy, setBusy] = useState<null | "save" | "clear">(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setSaved(false);
    setBusy("save");
    try {
      await apiPost(`/api/settings/groq-key`, { apiKey: value.trim() });
      setValue("");
      setSaved(true);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.hint ? `${err.message} — ${err.hint}` : err.message);
      } else {
        setError(err instanceof Error ? err.message : "Save failed");
      }
    } finally {
      setBusy(null);
    }
  }

  async function clear() {
    if (busy) return;
    if (!confirm("Remove your Groq key?")) return;
    setBusy("clear");
    setError(null);
    try {
      const res = await fetch(`/api/settings/groq-key`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Clear failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <form onSubmit={save} className="space-y-3">
      <div className="flex gap-2">
        <input
          type={reveal ? "text" : "password"}
          autoComplete="off"
          placeholder="gsk_..."
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="flex-1 rounded border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-sm font-mono outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
        />
        <button
          type="button"
          onClick={() => setReveal((r) => !r)}
          className="px-3 py-2 text-xs rounded border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          {reveal ? "Hide" : "Show"}
        </button>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={busy !== null || !value.trim()}
          className="px-4 py-2 text-sm rounded bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {busy === "save" ? "Validating…" : hasKey ? "Replace key" : "Save key"}
        </button>
        {hasKey && (
          <button
            type="button"
            onClick={clear}
            disabled={busy !== null}
            className="px-4 py-2 text-sm rounded border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
          >
            {busy === "clear" ? "Removing…" : "Remove"}
          </button>
        )}
      </div>
      {error && (
        <div className="text-xs text-rose-600 dark:text-rose-400">{error}</div>
      )}
      {saved && !error && (
        <div className="text-xs text-emerald-600 dark:text-emerald-400">
          Key validated and saved.
        </div>
      )}
    </form>
  );
}
