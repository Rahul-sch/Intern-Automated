import fs from "node:fs";
import path from "node:path";
import type { Profile, Project, Skills } from "./library";
import type { Tailored } from "./tailor";

const TEMPLATES_DIR = path.join(process.cwd(), "templates");

export const PRETTY_TEMPLATE = path.join(TEMPLATES_DIR, "base.tex");
export const ATS_TEMPLATE = path.join(TEMPLATES_DIR, "ats-plain.tex");

// LLMs love non-ASCII punctuation (non-breaking hyphen, narrow NBSP, smart
// quotes, em/en dashes). Jake's template has \pdfgentounicode=1 but the source
// still needs plain ASCII for reliable tectonic compiles + ATS parsing.
function sanitize(s: string): string {
  return s
    .replace(/\u2011/g, "-")       // non-breaking hyphen
    .replace(/\u2013/g, "--")      // en dash
    .replace(/\u2014/g, "---")     // em dash
    .replace(/[\u2018\u2019]/g, "'") // smart single quotes
    .replace(/[\u201C\u201D]/g, '"') // smart double quotes
    .replace(/\u2026/g, "...")     // ellipsis
    .replace(/[\u00A0\u202F\u2009]/g, " "); // no-break / narrow / thin spaces
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

  // Header fields
  tex = tex
    .replaceAll("%%NAME%%", profile.name)
    .replaceAll("%%PHONE%%", profile.phone)
    .replaceAll("%%EMAIL%%", profile.email)
    .replaceAll("%%LINKEDIN_URL%%", profile.linkedin.url)
    .replaceAll("%%LINKEDIN_LABEL%%", profile.linkedin.label)
    .replaceAll("%%GITHUB_URL%%", profile.github.url)
    .replaceAll("%%GITHUB_LABEL%%", profile.github.label);

  // Summary slot — italic small line under the contact line
  const summaryClean = sanitize(tailored.summary.trim());
  const summaryBlock = summaryClean
    ? `\\\\ \\vspace{2pt}\n    \\textit{\\small ${summaryClean}}`
    : "";
  tex = tex.replace("%% SLOT:SUMMARY %%", summaryBlock);

  // Education slot
  const eduBlock = profile.education
    .map(
      (e) => `    \\resumeSubheading
      {${e.school}}{${e.location}}
      {${e.degree}}{${e.dates}}`,
    )
    .join("\n");
  tex = tex.replace("%% SLOT:EDUCATION %%", eduBlock);

  // Experience slot (locked — no tailoring per plan)
  const expBlock = profile.experience
    .map((x) => {
      const items = x.bullets.map((b) => `        \\resumeItem{${b}}`).join("\n");
      return `    \\resumeSubheading
      {${x.title}}{${x.dates}}
      {${x.company}}{${x.location}}
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
        .map((b) => `            \\resumeItem{${sanitize(b)}}`)
        .join("\n");
      return `      \\resumeProjectHeading
          {\\textbf{${p.name}} $|$ \\emph{${p.stack}}}{${p.date}}
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
      const items = (tailored.skill_emphasis[catId] ?? cat.items).map(sanitize);
      const suffix = idx < tailored.skill_order.length - 1 ? " \\\\" : "";
      return `     \\textbf{${cat.label}}{: ${items.join(", ")}}${suffix}`;
    })
    .filter(Boolean)
    .join("\n");
  tex = tex.replace("%% SLOT:SKILLS %%", skillLines);

  return tex;
}
