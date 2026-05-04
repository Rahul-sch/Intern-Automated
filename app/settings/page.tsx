import Link from "next/link";
import { currentUser } from "@clerk/nextjs/server";
import { GroqKeyForm } from "./GroqKeyForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await currentUser();
  const meta = (user?.privateMetadata as { groqApiKey?: string } | undefined)
    ?.groqApiKey;
  const hasKey = typeof meta === "string" && meta.length > 0;
  // Last-4 fingerprint so the user can recognize their key without exposing it.
  const fingerprint = hasKey ? `…${meta!.slice(-4)}` : null;

  return (
    <main className="mx-auto max-w-2xl w-full px-6 py-10 space-y-8">
      <div>
        <Link
          href="/dashboard"
          className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
        >
          ← Dashboard
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight mt-2">Settings</h1>
        <p className="text-sm text-slate-500 mt-1">
          Bring your own Groq API key. We never store it in our database — it
          lives in your Clerk account&apos;s encrypted private metadata.
        </p>
      </div>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
            Groq API key
          </h2>
          {hasKey && (
            <span className="text-xs text-emerald-600 dark:text-emerald-400">
              Connected · {fingerprint}
            </span>
          )}
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Get a free key at{" "}
          <a
            className="underline hover:opacity-80"
            href="https://console.groq.com/keys"
            target="_blank"
            rel="noreferrer"
          >
            console.groq.com/keys
          </a>
          . The free tier comfortably covers ~30 tailorings per day.
        </p>
        <GroqKeyForm hasKey={hasKey} />
      </section>
    </main>
  );
}
