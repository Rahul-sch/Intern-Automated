import Database from "better-sqlite3";
import crypto from "node:crypto";
import path from "node:path";
import fs from "node:fs";

export type JobStatus = "new" | "generated" | "applied" | "rejected" | "archived";

export type JobRow = {
  id: string;
  url_hash: string;
  url: string | null;
  company: string;
  title: string;
  jd_text: string;
  status: JobStatus;
  rationale: string | null;
  tex_path: string | null;
  pdf_path: string | null;
  created_at: string;
  updated_at: string;
};

export type GenerationRow = {
  id: string;
  job_id: string;
  tailored_json: string;
  tailored_overrides_json: string | null;
  tex_path: string;
  pdf_path: string | null;
  tex_ats_path: string | null;
  pdf_ats_path: string | null;
  model: string;
  created_at: string;
};

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "internshippy.db");

let cached: Database.Database | null = null;

export function db(): Database.Database {
  if (cached) return cached;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const d = new Database(DB_PATH);
  d.pragma("journal_mode = WAL");
  d.pragma("foreign_keys = ON");
  migrate(d);
  cached = d;
  return d;
}

function migrate(d: Database.Database) {
  d.transaction(() => {
    d.exec(`
      CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY,
        url_hash TEXT NOT NULL UNIQUE,
        url TEXT,
        company TEXT NOT NULL,
        title TEXT NOT NULL,
        jd_text TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'new',
        rationale TEXT,
        tex_path TEXT,
        pdf_path TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS jobs_status_idx ON jobs(status);
      CREATE INDEX IF NOT EXISTS jobs_created_idx ON jobs(created_at DESC);

      CREATE TABLE IF NOT EXISTS generations (
        id TEXT PRIMARY KEY,
        job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
        tailored_json TEXT NOT NULL,
        tex_path TEXT NOT NULL,
        pdf_path TEXT,
        model TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS generations_job_idx ON generations(job_id, created_at DESC);
    `);

    const cols = (
      d.prepare(`PRAGMA table_info(generations)`).all() as { name: string }[]
    ).map((r) => r.name);
    if (!cols.includes("tailored_overrides_json")) {
      d.exec(`ALTER TABLE generations ADD COLUMN tailored_overrides_json TEXT`);
    }
    if (!cols.includes("tex_ats_path")) {
      d.exec(`ALTER TABLE generations ADD COLUMN tex_ats_path TEXT`);
    }
    if (!cols.includes("pdf_ats_path")) {
      d.exec(`ALTER TABLE generations ADD COLUMN pdf_ats_path TEXT`);
    }
  })();
}

export function hashUrl(url: string): string {
  return crypto.createHash("sha256").update(url.trim().toLowerCase()).digest("hex");
}

export function newId(): string {
  return crypto.randomBytes(8).toString("hex");
}
