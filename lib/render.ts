import fs from "node:fs";
import path from "node:path";
import type { Profile, Project, Skills } from "./library";
import type { Tailored } from "./tailor";

const TEMPLATES_DIR = path.join(process.cwd(), "templates");

export const PRETTY_TEMPLATE = path.join(TEMPLATES_DIR, "base.tex");
export const ATS_TEMPLATE = path.join(TEMPLATES_DIR, "ats-plain.tex");

/**
 * Normalize Unicode that LLMs love but T1+lmodern can't render directly:
 * smart quotes, en/em dashes, NBSPs, ellipsis. Runs first so escapeLatex
 * sees only ASCII.
 */
function asciiize(s: string): string {
  return s
    .replace(/‑/g, "-") // non-breaking hyphen
    .replace(/–/g, "--") // en dash
    .replace(/—/g, "---") // em dash
    .replace(/[‘’]/g, "'") // smart single quotes
    .replace(/[“”]/g, '"') // smart double quotes
    .replace(/…/g, "...") // ellipsis
    .replace(/[   ]/g, " "); // no-break / narrow / thin spaces
}

/**
 * Escape every LaTeX special character. We treat user content as plain text —
 * the LLM is instructed not to emit LaTeX, but legacy data may still contain
 * \texttt{...} or pre-escaped \& \% etc. (the old prompt told the LLM to
 * escape those). We:
 *   1. Strip a small set of known legacy text-commands (\texttt, \emph,
 *      \textbf, \textit) keeping their argument as plain text.
 *   2. Stash already-escaped specials behind a sentinel so they don't get
 *      double-escaped, then restore them at the end.
 *   3. Aggressively escape every remaining LaTeX special.
 */
function escapeLatex(raw: string): string {
  if (!raw) return "";
  let s = asciiize(raw);

  // Strip legacy text-formatting commands (no nesting expected in user data).
  s = s.replace(/\\(?:texttt|emph|textbf|textit)\{([^{}]*)\}/g, "$1");

  // Stash already-escaped specials so the regex below doesn't double-escape.
  const TOKEN = "\x00";
  const escapedMap: Record<string, string> = {
    "\\&": `${TOKEN}A${TOKEN}`,
    "\\%": `${TOKEN}P${TOKEN}`,
    "\\$": `${TOKEN}D${TOKEN}`,
    "\\#": `${TOKEN}H${TOKEN}`,
    "\\_": `${TOKEN}U${TOKEN}`,
    "\\{": `${TOKEN}L${TOKEN}`,
    "\\}": `${TOKEN}R${TOKEN}`,
  };
  for (const [escaped, token] of Object.entries(escapedMap)) {
    s = s.split(escaped).join(token);
  }

  // Now escape every remaining unescaped special. Backslash first so we
  // don't re-escape the backslashes we're about to emit.
  s = s
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/&/g, "\\&")
    .replace(/%/g, "\\%")
    .replace(/\$/g, "\\$")
    .replace(/#/g, "\\#")
    .replace(/_/g, "\\_")
    .replace(/\{/g, "\\{")
    .replace(/\}/g, "\\}")
    .replace(/~/g, "\\textasciitilde{}")
    .replace(/\^/g, "\\textasciicircum{}");

  // Restore stashed pre-escaped specials.
  for (const [escaped, token] of Object.entries(escapedMap)) {
    s = s.split(token).join(escaped);
  }
  return s;
}

/**
 * URLs are content for \href targets — we cannot escape them as plain text
 * because that would break the link. We do still ASCII-normalize and we
 * percent-encode the few characters that genuinely break LaTeX in a URL
 * argument: %, #, \. Other URL-legal characters (?, &, =, /, etc.) are fine
 * inside \href because hyperref handles them.
 */
function escapeUrl(raw: string): string {
  if (!raw) return "";
  return asciiize(raw)
    .replace(/%/g, "\\%")
    .replace(/#/g, "\\#")
    .replace(/\\/g, "/");
}

export function renderLatex(
  args: {
    profile: Profile;
    projects: Project[];
    skills: Skills;
    tailored: Tailored;
  },
  templatePath: string = PRETTY_TEMPLATE,
): string {
  const { profile, projects, skills, tailored } = args;
  let tex = fs.readFileSync(templatePath, "utf8");

  // Header fields — labels are display text (escape), URLs target \href (escape URL).
  tex = tex
    .replaceAll("%%NAME%%", escapeLatex(profile.name))
    .replaceAll("%%PHONE%%", escapeLatex(profile.phone))
    .replaceAll("%%EMAIL%%", escapeLatex(profile.email))
    .replaceAll("%%LINKEDIN_URL%%", escapeUrl(profile.linkedin.url))
    .replaceAll("%%LINKEDIN_LABEL%%", escapeLatex(profile.linkedin.label))
    .replaceAll("%%GITHUB_URL%%", escapeUrl(profile.github.url))
    .replaceAll("%%GITHUB_LABEL%%", escapeLatex(profile.github.label));

  // Summary slot — italic small line under the contact line
  const summaryClean = escapeLatex(tailored.summary.trim());
  const summaryBlock = summaryClean
    ? `\\\\ \\vspace{2pt}\n    \\textit{\\small ${summaryClean}}`
    : "";
  tex = tex.replace("%% SLOT:SUMMARY %%", summaryBlock);

  // Education slot
  const eduBlock = profile.education
    .map(
      (e) => `    \\resumeSubheading
      {${escapeLatex(e.school)}}{${escapeLatex(e.location)}}
      {${escapeLatex(e.degree)}}{${escapeLatex(e.dates)}}`,
    )
    .join("\n");
  tex = tex.replace("%% SLOT:EDUCATION %%", eduBlock);

  // Experience slot (locked — no tailoring per plan)
  const expBlock = profile.experience
    .map((x) => {
      const items = x.bullets
        .map((b) => `        \\resumeItem{${escapeLatex(b)}}`)
        .join("\n");
      return `    \\resumeSubheading
      {${escapeLatex(x.title)}}{${escapeLatex(x.dates)}}
      {${escapeLatex(x.company)}}{${escapeLatex(x.location)}}
      \\resumeItemListStart
${items}
      \\resumeItemListEnd`;
    })
    .join("\n\n");
  tex = tex.replace("%% SLOT:EXPERIENCE %%", expBlock);

  // Projects slot — ordered by tailored.project_ids with rewritten bullets
  const byId = new Map(projects.map((p) => [p.id, p]));
  const projBlock = tailored.project_ids
    .map((id) => {
      const p = byId.get(id);
      if (!p) return "";
      const bullets = tailored.project_bullet_rewrites[id] ?? p.bullets;
      const items = bullets
        .map((b) => `            \\resumeItem{${escapeLatex(b)}}`)
        .join("\n");
      return `      \\resumeProjectHeading
          {\\textbf{${escapeLatex(p.name)}} $|$ \\emph{${escapeLatex(p.stack)}}}{${escapeLatex(p.date)}}
          \\resumeItemListStart
${items}
          \\resumeItemListEnd`;
    })
    .filter(Boolean)
    .join("\n");
  tex = tex.replace("%% SLOT:PROJECTS %%", projBlock);

  // Skills slot — reordered categories + emphasized items
  const byCat = new Map(skills.categories.map((c) => [c.id, c]));
  const skillLines = tailored.skill_order
    .map((catId, idx) => {
      const cat = byCat.get(catId);
      if (!cat) return "";
      const items = (tailored.skill_emphasis[catId] ?? cat.items).map(
        escapeLatex,
      );
      const suffix = idx < tailored.skill_order.length - 1 ? " \\\\" : "";
      return `     \\textbf{${escapeLatex(cat.label)}}{: ${items.join(", ")}}${suffix}`;
    })
    .filter(Boolean)
    .join("\n");
  tex = tex.replace("%% SLOT:SKILLS %%", skillLines);

  return tex;
}
