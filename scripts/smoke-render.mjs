#!/usr/bin/env node
// Render a tailored resume from a synthetic tailored-JSON to verify the LaTeX
// render path end-to-end without calling Claude. Writes /tmp/smoke-resume.tex.
import { loadProfile, loadProjects, loadSkills } from "../lib/library.ts";
import { renderLatex, ATS_TEMPLATE } from "../lib/render.ts";

const profile = loadProfile();
const projects = loadProjects();
const skills = loadSkills();

const tailored = {
  summary:
    "CS senior @ VT shipping distributed systems + real-time ML at Ithena and founding MedRa Robotics",
  project_ids: ["repowhisper", "nexus", "vibeguard", "supercoder", "vettriage"],
  project_bullet_rewrites: Object.fromEntries(
    ["repowhisper", "nexus", "vibeguard", "supercoder", "vettriage"].map((id) => [
      id,
      projects.find((p) => p.id === id).bullets.slice(0, 2),
    ]),
  ),
  skill_order: ["ai_ml", "frameworks", "languages", "infrastructure"],
  skill_emphasis: Object.fromEntries(
    skills.categories.map((c) => [c.id, c.items]),
  ),
  rationale: "synthetic test",
};

const fs = await import("node:fs");

const tex = renderLatex({ profile, projects, skills, tailored });
const out = "/tmp/smoke-resume.tex";
fs.writeFileSync(out, tex, "utf8");
console.log(`wrote ${out} (${tex.length} bytes)`);

const texAts = renderLatex({ profile, projects, skills, tailored }, ATS_TEMPLATE);
const outAts = "/tmp/smoke-resume-ats.tex";
fs.writeFileSync(outAts, texAts, "utf8");
console.log(`wrote ${outAts} (${texAts.length} bytes)`);
