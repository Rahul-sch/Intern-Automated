"use client";

import { useState } from "react";
import type { Profile, Project, Skills } from "@/lib/library";

type Extracted = { profile: Profile; projects: Project[]; skills: Skills };

export function ReviewLibrary({
  initial,
  onSave,
  onBack,
  busy,
  error,
}: {
  initial: Extracted;
  onSave: (next: Extracted) => void;
  onBack: () => void;
  busy: boolean;
  error: string | null;
}) {
  const [profile, setProfile] = useState<Profile>(initial.profile);
  const [projects, setProjects] = useState<Project[]>(initial.projects);
  const [skills, setSkills] = useState<Skills>(initial.skills);

  function patchProfile(p: Partial<Profile>) {
    setProfile((prev) => ({ ...prev, ...p }));
  }
  function patchLinkedin(p: Partial<Profile["linkedin"]>) {
    setProfile((prev) => ({ ...prev, linkedin: { ...prev.linkedin, ...p } }));
  }
  function patchGithub(p: Partial<Profile["github"]>) {
    setProfile((prev) => ({ ...prev, github: { ...prev.github, ...p } }));
  }
  function patchProject(i: number, p: Partial<Project>) {
    setProjects((prev) => prev.map((proj, idx) => (idx === i ? { ...proj, ...p } : proj)));
  }
  function removeProject(i: number) {
    setProjects((prev) => prev.filter((_, idx) => idx !== i));
  }
  function patchProjectBullets(i: number, bullets: string[]) {
    patchProject(i, { bullets });
  }
  function patchSkillCategory(i: number, items: string[]) {
    setSkills((prev) => ({
      ...prev,
      categories: prev.categories.map((c, idx) =>
        idx === i ? { ...c, items } : c,
      ),
    }));
  }
  function removeSkillCategory(i: number) {
    setSkills((prev) => ({
      ...prev,
      categories: prev.categories.filter((_, idx) => idx !== i),
    }));
  }

  const canSave =
    profile.name.trim().length > 0 &&
    projects.length > 0 &&
    skills.categories.length > 0 &&
    !busy;

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Step 3 — Review & edit</h2>
          <p className="text-sm text-slate-500 mt-1">
            The AI did its best. Fix anything it missed or got wrong before
            saving.
          </p>
        </div>

        {/* Profile */}
        <Section title="Profile">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Name">
              <Input
                value={profile.name}
                onChange={(v) => patchProfile({ name: v })}
              />
            </Field>
            <Field label="Phone">
              <Input
                value={profile.phone}
                onChange={(v) => patchProfile({ phone: v })}
              />
            </Field>
            <Field label="Email">
              <Input
                value={profile.email}
                onChange={(v) => patchProfile({ email: v })}
              />
            </Field>
            <Field label="LinkedIn URL">
              <Input
                value={profile.linkedin.url}
                onChange={(v) => patchLinkedin({ url: v })}
              />
            </Field>
            <Field label="LinkedIn label">
              <Input
                value={profile.linkedin.label}
                onChange={(v) => patchLinkedin({ label: v })}
              />
            </Field>
            <Field label="GitHub URL">
              <Input
                value={profile.github.url}
                onChange={(v) => patchGithub({ url: v })}
              />
            </Field>
            <Field label="GitHub label">
              <Input
                value={profile.github.label}
                onChange={(v) => patchGithub({ label: v })}
              />
            </Field>
          </div>

          <div className="mt-4 space-y-2">
            <Subhead>Education</Subhead>
            {profile.education.length === 0 && (
              <Empty>No education entries detected.</Empty>
            )}
            {profile.education.map((e, i) => (
              <div
                key={i}
                className="rounded border border-slate-200 dark:border-slate-800 p-3 grid grid-cols-2 gap-2 text-sm"
              >
                <Input
                  placeholder="School"
                  value={e.school}
                  onChange={(v) =>
                    setProfile((prev) => ({
                      ...prev,
                      education: prev.education.map((row, idx) =>
                        idx === i ? { ...row, school: v } : row,
                      ),
                    }))
                  }
                />
                <Input
                  placeholder="Location"
                  value={e.location}
                  onChange={(v) =>
                    setProfile((prev) => ({
                      ...prev,
                      education: prev.education.map((row, idx) =>
                        idx === i ? { ...row, location: v } : row,
                      ),
                    }))
                  }
                />
                <Input
                  placeholder="Degree"
                  value={e.degree}
                  onChange={(v) =>
                    setProfile((prev) => ({
                      ...prev,
                      education: prev.education.map((row, idx) =>
                        idx === i ? { ...row, degree: v } : row,
                      ),
                    }))
                  }
                />
                <Input
                  placeholder="Dates"
                  value={e.dates}
                  onChange={(v) =>
                    setProfile((prev) => ({
                      ...prev,
                      education: prev.education.map((row, idx) =>
                        idx === i ? { ...row, dates: v } : row,
                      ),
                    }))
                  }
                />
              </div>
            ))}
          </div>

          <div className="mt-4 space-y-2">
            <Subhead>Experience</Subhead>
            {profile.experience.length === 0 && (
              <Empty>No experience entries detected.</Empty>
            )}
            {profile.experience.map((x, i) => (
              <div
                key={i}
                className="rounded border border-slate-200 dark:border-slate-800 p-3 space-y-2"
              >
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder="Title"
                    value={x.title}
                    onChange={(v) =>
                      setProfile((prev) => ({
                        ...prev,
                        experience: prev.experience.map((row, idx) =>
                          idx === i ? { ...row, title: v } : row,
                        ),
                      }))
                    }
                  />
                  <Input
                    placeholder="Company"
                    value={x.company}
                    onChange={(v) =>
                      setProfile((prev) => ({
                        ...prev,
                        experience: prev.experience.map((row, idx) =>
                          idx === i ? { ...row, company: v } : row,
                        ),
                      }))
                    }
                  />
                  <Input
                    placeholder="Dates"
                    value={x.dates}
                    onChange={(v) =>
                      setProfile((prev) => ({
                        ...prev,
                        experience: prev.experience.map((row, idx) =>
                          idx === i ? { ...row, dates: v } : row,
                        ),
                      }))
                    }
                  />
                  <Input
                    placeholder="Location"
                    value={x.location}
                    onChange={(v) =>
                      setProfile((prev) => ({
                        ...prev,
                        experience: prev.experience.map((row, idx) =>
                          idx === i ? { ...row, location: v } : row,
                        ),
                      }))
                    }
                  />
                </div>
                <BulletList
                  bullets={x.bullets}
                  onChange={(next) =>
                    setProfile((prev) => ({
                      ...prev,
                      experience: prev.experience.map((row, idx) =>
                        idx === i ? { ...row, bullets: next } : row,
                      ),
                    }))
                  }
                />
              </div>
            ))}
          </div>
        </Section>

        {/* Projects */}
        <Section
          title={`Projects (${projects.length})`}
          hint="Edit names, stacks, dates, bullets. Remove anything irrelevant — you'll have a chance to add more later."
        >
          {projects.length === 0 && (
            <Empty>No projects detected. Go back and try again.</Empty>
          )}
          <div className="space-y-3">
            {projects.map((p, i) => (
              <div
                key={p.id}
                className="rounded border border-slate-200 dark:border-slate-800 p-3 space-y-2"
              >
                <div className="flex items-start gap-2">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 flex-1">
                    <Input
                      placeholder="Name"
                      value={p.name}
                      onChange={(v) => patchProject(i, { name: v })}
                    />
                    <Input
                      placeholder="Stack"
                      value={p.stack}
                      onChange={(v) => patchProject(i, { stack: v })}
                    />
                    <Input
                      placeholder="Date"
                      value={p.date}
                      onChange={(v) => patchProject(i, { date: v })}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeProject(i)}
                    className="text-xs text-rose-600 hover:text-rose-700 px-2 py-1"
                  >
                    Remove
                  </button>
                </div>
                <BulletList
                  bullets={p.bullets}
                  onChange={(next) => patchProjectBullets(i, next)}
                />
              </div>
            ))}
          </div>
        </Section>

        {/* Skills */}
        <Section title={`Skill categories (${skills.categories.length})`}>
          <div className="space-y-2">
            {skills.categories.map((c, i) => (
              <div
                key={c.id}
                className="rounded border border-slate-200 dark:border-slate-800 p-3"
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <Input
                    value={c.label}
                    onChange={(v) =>
                      setSkills((prev) => ({
                        ...prev,
                        categories: prev.categories.map((cat, idx) =>
                          idx === i ? { ...cat, label: v } : cat,
                        ),
                      }))
                    }
                  />
                  <button
                    type="button"
                    onClick={() => removeSkillCategory(i)}
                    className="text-xs text-rose-600 hover:text-rose-700 px-2 py-1 shrink-0"
                  >
                    Remove
                  </button>
                </div>
                <Input
                  value={c.items.join(", ")}
                  onChange={(v) =>
                    patchSkillCategory(
                      i,
                      v
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    )
                  }
                  placeholder="Comma-separated items"
                />
              </div>
            ))}
          </div>
        </Section>
      </div>

      {error && (
        <div className="rounded border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 px-3 py-2 text-sm text-rose-700 dark:text-rose-200">
          {error}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          disabled={busy}
          className="px-4 py-2 text-sm rounded border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
        >
          ← Re-upload
        </button>
        <button
          type="button"
          onClick={() => onSave({ profile, projects, skills })}
          disabled={!canSave}
          className="px-5 py-2 text-sm rounded bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {busy ? "Saving…" : "Save library & start tailoring →"}
        </button>
      </div>
    </div>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800 first:pt-0 first:border-t-0">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">
        {title}
      </h3>
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
      {children}
    </section>
  );
}

function Subhead({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
      {children}
    </h4>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-xs text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function Input({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded border border-slate-300 dark:border-slate-700 bg-transparent px-2 py-1.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
    />
  );
}

function BulletList({
  bullets,
  onChange,
}: {
  bullets: string[];
  onChange: (next: string[]) => void;
}) {
  function update(i: number, v: string) {
    onChange(bullets.map((b, idx) => (idx === i ? v : b)));
  }
  function remove(i: number) {
    onChange(bullets.filter((_, idx) => idx !== i));
  }
  function add() {
    onChange([...bullets, ""]);
  }
  return (
    <div className="space-y-1">
      {bullets.map((b, i) => (
        <div key={i} className="flex gap-2">
          <textarea
            value={b}
            rows={2}
            onChange={(e) => update(i, e.target.value)}
            className="flex-1 rounded border border-slate-300 dark:border-slate-700 bg-transparent px-2 py-1.5 text-sm font-mono leading-snug resize-none outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          />
          <button
            type="button"
            onClick={() => remove(i)}
            className="text-xs text-slate-400 hover:text-rose-600 px-2"
            aria-label="Remove bullet"
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
      >
        + add bullet
      </button>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs text-slate-500 italic px-3 py-2 border border-dashed border-slate-300 dark:border-slate-700 rounded">
      {children}
    </div>
  );
}
