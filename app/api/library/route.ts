/**
 * GET   /api/library — returns the signed-in user's { profile, projects, skills }
 * PATCH /api/library — updates any subset { profile?, projects?, skills? }
 */
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { fail, ok, withErrorEnvelope } from "@/lib/errors";
import { ProfileSchema, ProjectSchema, SkillsSchema } from "@/lib/library";
import {
  loadUserLibrary,
  saveUserProfile,
  saveUserProjects,
  saveUserSkills,
} from "@/lib/userdata";

export const runtime = "nodejs";

export async function GET() {
  return withErrorEnvelope(async () => {
    const { userId } = await requireUser();
    return ok(loadUserLibrary(userId));
  });
}

const PatchBody = z
  .object({
    profile: ProfileSchema.optional(),
    projects: z.array(ProjectSchema).optional(),
    skills: SkillsSchema.optional(),
  })
  .refine((v) => v.profile || v.projects || v.skills, {
    message: "Provide at least one of profile, projects, skills",
  });

export async function PATCH(req: Request) {
  return withErrorEnvelope(async () => {
    const { userId } = await requireUser();
    const raw = await req.json().catch(() => null);
    const parsed = PatchBody.safeParse(raw);
    if (!parsed.success) return fail("VALIDATION", parsed.error.issues[0].message, 400);
    if (parsed.data.profile) saveUserProfile(userId, parsed.data.profile);
    if (parsed.data.projects) saveUserProjects(userId, parsed.data.projects);
    if (parsed.data.skills) saveUserSkills(userId, parsed.data.skills);
    return ok({ saved: true });
  });
}
