# InternShippy

A personal resume-tailoring tool. Paste a job posting, get back a Jake-style LaTeX resume rewritten for it — rendered as a clean modern PDF and an ATS-plain PDF side-by-side.

## What it does

- **Onboarding** — upload your resume PDF; an LLM extracts your education, experience, projects, and skills into structured data you can review and edit.
- **Project library** — keep a canonical list of projects (added manually or imported from GitHub) so the tailor step has good source material to draw from.
- **Per-job tailoring** — for each job posting, the LLM reorders, rewrites, and trims your bullets to match the role. Drag to reorder, edit inline.
- **Dual-template render** — every tailored resume builds twice: a modern Jake template and an ATS-plain template, both rendered to PDF.
- **Multi-tenant** — Clerk-backed auth on every route; data is scoped per user.
- **BYO Groq key** — bring your own API key in `/settings`. Nothing is shared.

## Stack

- Next.js 16 (App Router) · React 19
- Clerk for auth
- Groq via `@ai-sdk/groq` for extraction + tailoring
- `better-sqlite3` for per-user data
- `pdf-parse` for resume ingest
- LaTeX → PDF rendered through the build pipeline in [scripts/](scripts/) and [templates/](templates/)
- Tailwind v4, Zustand, Motion

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:3000 and sign in. On first run you'll be walked through onboarding: drop in a Groq key, upload a resume PDF, review the extracted data.

A working LaTeX install is required for PDF rendering (`pdflatex` on `PATH`).

## Layout

- [app/](app/) — routes: landing, onboarding, dashboard, library, jobs, settings, api
- [lib/](lib/) — db, auth, LLM, LaTeX render helpers
- [templates/](templates/) — LaTeX templates (modern + ATS-plain)
- [scripts/](scripts/) — build pipeline glue
- [data/](data/) — local SQLite

## Status

Active personal project. Expect rough edges.
