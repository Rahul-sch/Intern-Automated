import Link from "next/link";
import { Show, SignUpButton } from "@clerk/nextjs";

export default function Landing() {
  return (
    <main className="flex-1 flex flex-col">
      {/* Hero */}
      <section className="mx-auto max-w-5xl w-full px-6 pt-20 pb-24 md:pt-28 md:pb-32">
        <div className="space-y-6 max-w-3xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-1 text-xs text-slate-600 dark:text-slate-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            AI tailoring · ATS-clean PDFs · 30 second turnaround
          </span>
          <h1 className="text-5xl md:text-6xl font-semibold tracking-tight leading-[1.05]">
            One resume,
            <br />
            tailored for{" "}
            <span className="bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">
              every
            </span>{" "}
            startup.
          </h1>
          <p className="text-lg md:text-xl text-slate-600 dark:text-slate-400 max-w-2xl leading-relaxed">
            Paste a job description. Get a recruiter-grade PDF and an ATS-clean
            variant in under a minute. Drag-reorder projects, tweak any bullet,
            ship.
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Show when="signed-out">
              <SignUpButton mode="modal">
                <button className="px-5 py-3 rounded-md bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 transition text-sm font-medium">
                  Start tailoring — it&apos;s free
                </button>
              </SignUpButton>
              <a
                href="#how-it-works"
                className="px-5 py-3 rounded-md border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 transition text-sm font-medium"
              >
                See how it works
              </a>
            </Show>
            <Show when="signed-in">
              <Link
                href="/dashboard"
                className="px-5 py-3 rounded-md bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 transition text-sm font-medium"
              >
                Go to dashboard →
              </Link>
            </Show>
          </div>
          <p className="text-xs text-slate-400 pt-1">
            No credit card. Sign in with Google, GitHub, or email.
          </p>
        </div>
      </section>

      {/* Stat strip */}
      <section className="border-y border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40">
        <div className="mx-auto max-w-5xl w-full px-6 py-8 grid grid-cols-2 md:grid-cols-4 gap-6">
          <Stat label="Avg. tailoring time" value="~30s" />
          <Stat label="Outputs per job" value="2 PDFs" />
          <Stat label="Editable bullets" value="Every line" />
          <Stat label="ATS pass rate" value="Clean parse" />
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="mx-auto max-w-5xl w-full px-6 py-20 md:py-24">
        <h2 className="text-3xl md:text-4xl font-semibold tracking-tight mb-12">
          How it works.
        </h2>
        <div className="grid md:grid-cols-3 gap-8">
          <Step
            n="01"
            title="Paste the JD"
            body="Drop in any startup job posting — YC's Work at a Startup, a16z portfolio, Lever, Greenhouse. Plain text, no parsing tricks needed."
          />
          <Step
            n="02"
            title="AI tailors your resume"
            body="The model picks the 5 projects from your library that best match the role, reorders skill emphasis, and rewrites bullets to echo the JD's keywords — without inventing experience you don't have."
          />
          <Step
            n="03"
            title="Edit, review, ship"
            body="Drag-reorder projects, tweak any bullet inline, swap skill chips. Save and both PDFs recompile — a pretty version for humans, an ATS-clean version for parsers."
          />
        </div>
      </section>

      {/* Why two PDFs */}
      <section className="border-t border-slate-200 dark:border-slate-800">
        <div className="mx-auto max-w-5xl w-full px-6 py-20 md:py-24">
          <div className="grid md:grid-cols-2 gap-12 items-start">
            <div>
              <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">
                Two PDFs.
                <br />
                Both for you.
              </h2>
              <p className="mt-4 text-slate-600 dark:text-slate-400 leading-relaxed">
                Pretty resumes look great in front of a recruiter. ATS parsers
                hate the same tricks that make them pretty. So we generate
                both — automatically, on every save.
              </p>
            </div>
            <div className="space-y-4">
              <Feature
                title="Pretty PDF"
                body="Jake's classic LaTeX template, recruiter-tested. Use this when you know a human reads it first."
              />
              <Feature
                title="ATS-plain PDF"
                body="Single column, no tables, no icon fonts, bare URLs. Built for the parsing engines that gate every Greenhouse / Lever pipeline."
              />
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40">
        <div className="mx-auto max-w-3xl w-full px-6 py-20 md:py-24 text-center space-y-6">
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">
            Stop hand-tuning resumes at 2am.
          </h2>
          <p className="text-slate-600 dark:text-slate-400 max-w-xl mx-auto">
            Sign up, paste a JD, and have a tailored resume before your coffee
            cools.
          </p>
          <Show when="signed-out">
            <SignUpButton mode="modal">
              <button className="px-6 py-3 rounded-md bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 transition text-sm font-medium">
                Get started free
              </button>
            </SignUpButton>
          </Show>
          <Show when="signed-in">
            <Link
              href="/dashboard"
              className="inline-block px-6 py-3 rounded-md bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 transition text-sm font-medium"
            >
              Open your dashboard →
            </Link>
          </Show>
        </div>
      </section>

      <footer className="border-t border-slate-200 dark:border-slate-800">
        <div className="mx-auto max-w-5xl w-full px-6 py-6 flex items-center justify-between text-xs text-slate-500">
          <span>© {new Date().getFullYear()} InternShippy</span>
          <span className="font-mono">v0.1</span>
        </div>
      </footer>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-2xl md:text-3xl font-semibold tracking-tight">
        {value}
      </div>
      <div className="text-xs text-slate-500 mt-1">{label}</div>
    </div>
  );
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="space-y-2">
      <div className="text-xs font-mono text-slate-400">{n}</div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
        {body}
      </p>
    </div>
  );
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-5">
      <div className="text-sm font-semibold">{title}</div>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
        {body}
      </p>
    </div>
  );
}
