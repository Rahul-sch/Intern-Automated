"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ApiError, apiPost } from "@/lib/api";
import type { Profile, Project, Skills } from "@/lib/library";
import { ReviewLibrary } from "./ReviewLibrary";

type Extracted = { profile: Profile; projects: Project[]; skills: Skills };
type Step = "key" | "upload" | "review";

export function OnboardingFlow({ initialHasKey }: { initialHasKey: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(initialHasKey ? "upload" : "key");
  const [extracted, setExtracted] = useState<Extracted | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: API key
  const [apiKey, setApiKey] = useState("");

  async function saveKey(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      await apiPost(`/api/settings/groq-key`, { apiKey: apiKey.trim() });
      setApiKey("");
      setStep("upload");
    } catch (err) {
      setError(humanError(err));
    } finally {
      setBusy(false);
    }
  }

  // Step 2: Resume upload
  const [file, setFile] = useState<File | null>(null);
  const [pasteText, setPasteText] = useState("");
  const [usePaste, setUsePaste] = useState(false);

  async function parseResume(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      let result: Extracted;
      if (usePaste) {
        result = await apiPost<Extracted>("/api/onboarding/parse-resume", {
          text: pasteText.trim(),
        });
      } else {
        if (!file) {
          setError("Pick a PDF or switch to 'Paste text'.");
          setBusy(false);
          return;
        }
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/onboarding/parse-resume", {
          method: "POST",
          body: fd,
          credentials: "same-origin",
        });
        const body = await res.json();
        if (!body.ok) {
          throw new ApiError(
            body.error?.code ?? "INTERNAL",
            body.error?.message ?? "Parse failed",
            body.error?.hint,
            res.status,
          );
        }
        result = body.data as Extracted;
      }
      setExtracted(result);
      setStep("review");
    } catch (err) {
      setError(humanError(err));
    } finally {
      setBusy(false);
    }
  }

  async function saveLibrary(reviewed: Extracted) {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      await apiPost(`/api/onboarding/save`, reviewed);
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(humanError(err));
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <Stepper current={step} hasKey={initialHasKey} />

      {step === "key" && (
        <form onSubmit={saveKey} className="space-y-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-6">
          <div>
            <h2 className="text-lg font-semibold">Step 1 — Connect Groq</h2>
            <p className="text-sm text-slate-500 mt-1">
              Get a free key at{" "}
              <a
                className="underline hover:opacity-80"
                href="https://console.groq.com/keys"
                target="_blank"
                rel="noreferrer"
              >
                console.groq.com/keys
              </a>
              . The key never touches our database — it&apos;s stored encrypted in
              your Clerk account.
            </p>
          </div>
          <input
            type="password"
            autoComplete="off"
            placeholder="gsk_..."
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="w-full rounded border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-sm font-mono outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          />
          <button
            type="submit"
            disabled={busy || !apiKey.trim()}
            className="px-4 py-2 text-sm rounded bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {busy ? "Validating…" : "Save & continue →"}
          </button>
          {error && <ErrorBanner message={error} />}
        </form>
      )}

      {step === "upload" && (
        <form onSubmit={parseResume} className="space-y-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-6">
          <div>
            <h2 className="text-lg font-semibold">Step 2 — Upload your resume</h2>
            <p className="text-sm text-slate-500 mt-1">
              We&apos;ll extract your profile, projects, and skills. You can edit
              everything before saving.
            </p>
          </div>

          <div className="inline-flex rounded border border-slate-300 dark:border-slate-700 overflow-hidden text-xs">
            <button
              type="button"
              onClick={() => setUsePaste(false)}
              className={`px-3 py-1.5 ${!usePaste ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "hover:bg-slate-100 dark:hover:bg-slate-800"}`}
            >
              Upload PDF
            </button>
            <button
              type="button"
              onClick={() => setUsePaste(true)}
              className={`px-3 py-1.5 border-l border-slate-300 dark:border-slate-700 ${usePaste ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "hover:bg-slate-100 dark:hover:bg-slate-800"}`}
            >
              Paste text
            </button>
          </div>

          {!usePaste ? (
            <label className="block">
              <input
                type="file"
                accept="application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="block w-full text-sm text-slate-700 dark:text-slate-300 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-slate-900 file:text-white dark:file:bg-white dark:file:text-slate-900 file:cursor-pointer"
              />
              {file && (
                <p className="text-xs text-slate-500 mt-2">
                  {file.name} · {(file.size / 1024).toFixed(0)} KB
                </p>
              )}
            </label>
          ) : (
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              rows={12}
              placeholder="Paste your full resume text here…"
              className="w-full rounded border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-sm font-mono outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
          )}

          <button
            type="submit"
            disabled={busy || (!usePaste ? !file : pasteText.trim().length < 200)}
            className="px-4 py-2 text-sm rounded bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {busy ? "Extracting (~15-30s)…" : "Extract with AI →"}
          </button>
          {error && <ErrorBanner message={error} />}
        </form>
      )}

      {step === "review" && extracted && (
        <ReviewLibrary
          initial={extracted}
          onSave={saveLibrary}
          onBack={() => setStep("upload")}
          busy={busy}
          error={error}
        />
      )}
    </div>
  );
}

function Stepper({
  current,
  hasKey,
}: {
  current: Step;
  hasKey: boolean;
}) {
  const steps: { id: Step; label: string }[] = [
    { id: "key", label: "Groq key" },
    { id: "upload", label: "Upload" },
    { id: "review", label: "Review" },
  ];
  const idx = steps.findIndex((s) => s.id === current);
  return (
    <ol className="flex items-center gap-2 text-xs">
      {steps.map((s, i) => {
        const done = i < idx || (s.id === "key" && hasKey && current !== "key");
        const active = s.id === current;
        return (
          <li key={s.id} className="flex items-center gap-2">
            <span
              className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-semibold ${
                active
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                  : done
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                    : "bg-slate-100 text-slate-500 dark:bg-slate-800"
              }`}
            >
              {done ? "✓" : i + 1}
            </span>
            <span
              className={
                active
                  ? "font-semibold"
                  : "text-slate-500 dark:text-slate-400"
              }
            >
              {s.label}
            </span>
            {i < steps.length - 1 && (
              <span className="text-slate-300 dark:text-slate-700 ml-1">/</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 px-3 py-2 text-sm text-rose-700 dark:text-rose-200">
      {message}
    </div>
  );
}

function humanError(err: unknown): string {
  if (err instanceof ApiError) {
    return err.hint ? `${err.message} — ${err.hint}` : err.message;
  }
  return err instanceof Error ? err.message : "Something went wrong";
}
