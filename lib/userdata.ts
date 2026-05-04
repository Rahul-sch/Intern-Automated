/**
 * Per-user library reads/writes against SQLite.
 * Replaces the JSON-file readers in lib/library.ts (which now act only as
 * type/schema definitions and the legacy seed for /scripts/smoke-render.mjs).
 */
import { db, type UserProjectRow, type UserSkillRow } from "./db";
import {
  ProfileSchema,
  ProjectSchema,
  SkillsSchema,
  type Profile,
  type Project,
  type Skills,
} from "./library";

export function ensureUser(args: {
  userId: string;
  email?: string | null;
  name?: string | null;
}) {
  const existing = db()
    .prepare(`SELECT id FROM users WHERE id = ?`)
    .get(args.userId) as { id: string } | undefined;
  if (existing) {
    if (args.email || args.name) {
      db()
        .prepare(
          `UPDATE users SET email = COALESCE(?, email), name = COALESCE(?, name) WHERE id = ?`,
        )
        .run(args.email ?? null, args.name ?? null, args.userId);
    }
    return;
  }
  db()
    .prepare(`INSERT INTO users (id, email, name) VALUES (?, ?, ?)`)
    .run(args.userId, args.email ?? null, args.name ?? null);
}

export function isOnboarded(userId: string): boolean {
  const row = db()
    .prepare(`SELECT onboarded_at FROM users WHERE id = ?`)
    .get(userId) as { onboarded_at: string | null } | undefined;
  return !!row?.onboarded_at;
}

export function markOnboarded(userId: string) {
  db()
    .prepare(`UPDATE users SET onboarded_at = datetime('now') WHERE id = ?`)
    .run(userId);
}

export function loadUserProfile(userId: string): Profile | null {
  const row = db()
    .prepare(
      `SELECT name, phone, email, linkedin_url, linkedin_label,
              github_url, github_label, education_json, experience_json
       FROM user_profiles WHERE user_id = ?`,
    )
    .get(userId) as
    | {
        name: string;
        phone: string;
        email: string;
        linkedin_url: string;
        linkedin_label: string;
        github_url: string;
        github_label: string;
        education_json: string;
        experience_json: string;
      }
    | undefined;
  if (!row) return null;
  return ProfileSchema.parse({
    name: row.name,
    phone: row.phone,
    email: row.email,
    linkedin: { url: row.linkedin_url, label: row.linkedin_label },
    github: { url: row.github_url, label: row.github_label },
    education: JSON.parse(row.education_json),
    experience: JSON.parse(row.experience_json),
  });
}

export function saveUserProfile(userId: string, profile: Profile) {
  const parsed = ProfileSchema.parse(profile);
  db()
    .prepare(
      `INSERT INTO user_profiles
         (user_id, name, phone, email, linkedin_url, linkedin_label,
          github_url, github_label, education_json, experience_json, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(user_id) DO UPDATE SET
         name = excluded.name,
         phone = excluded.phone,
         email = excluded.email,
         linkedin_url = excluded.linkedin_url,
         linkedin_label = excluded.linkedin_label,
         github_url = excluded.github_url,
         github_label = excluded.github_label,
         education_json = excluded.education_json,
         experience_json = excluded.experience_json,
         updated_at = datetime('now')`,
    )
    .run(
      userId,
      parsed.name,
      parsed.phone,
      parsed.email,
      parsed.linkedin.url,
      parsed.linkedin.label,
      parsed.github.url,
      parsed.github.label,
      JSON.stringify(parsed.education),
      JSON.stringify(parsed.experience),
    );
}

export function loadUserProjects(userId: string): Project[] {
  const rows = db()
    .prepare(
      `SELECT slug, name, stack, date, tags_json, bullets_json
       FROM user_projects WHERE user_id = ? ORDER BY position ASC`,
    )
    .all(userId) as Pick<
    UserProjectRow,
    "slug" | "name" | "stack" | "date" | "tags_json" | "bullets_json"
  >[];
  return rows.map((r) =>
    ProjectSchema.parse({
      id: r.slug,
      name: r.name,
      stack: r.stack,
      date: r.date,
      tags: JSON.parse(r.tags_json),
      bullets: JSON.parse(r.bullets_json),
    }),
  );
}

export function saveUserProjects(userId: string, projects: Project[]) {
  const parsed = projects.map((p) => ProjectSchema.parse(p));
  const tx = db().transaction(() => {
    db().prepare(`DELETE FROM user_projects WHERE user_id = ?`).run(userId);
    const insert = db().prepare(
      `INSERT INTO user_projects
         (id, user_id, slug, name, stack, date, tags_json, bullets_json, position)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    parsed.forEach((p, i) => {
      insert.run(
        `${userId}::${p.id}`,
        userId,
        p.id,
        p.name,
        p.stack,
        p.date,
        JSON.stringify(p.tags),
        JSON.stringify(p.bullets),
        i,
      );
    });
  });
  tx();
}

export function loadUserSkills(userId: string): Skills {
  const rows = db()
    .prepare(
      `SELECT category_id, label, items_json
       FROM user_skills WHERE user_id = ? ORDER BY position ASC`,
    )
    .all(userId) as Pick<UserSkillRow, "category_id" | "label" | "items_json">[];
  return SkillsSchema.parse({
    categories: rows.map((r) => ({
      id: r.category_id,
      label: r.label,
      items: JSON.parse(r.items_json),
    })),
  });
}

export function saveUserSkills(userId: string, skills: Skills) {
  const parsed = SkillsSchema.parse(skills);
  const tx = db().transaction(() => {
    db().prepare(`DELETE FROM user_skills WHERE user_id = ?`).run(userId);
    const insert = db().prepare(
      `INSERT INTO user_skills
         (id, user_id, category_id, label, items_json, position)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );
    parsed.categories.forEach((c, i) => {
      insert.run(
        `${userId}::${c.id}`,
        userId,
        c.id,
        c.label,
        JSON.stringify(c.items),
        i,
      );
    });
  });
  tx();
}

export function loadUserLibrary(userId: string): {
  profile: Profile | null;
  projects: Project[];
  skills: Skills;
} {
  return {
    profile: loadUserProfile(userId),
    projects: loadUserProjects(userId),
    skills: loadUserSkills(userId),
  };
}
