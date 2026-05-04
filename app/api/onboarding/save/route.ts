/**
 * POST /api/onboarding/save
 *
 * Persists the user's reviewed library (profile + projects + skills) to the
 * per-user tables, then flips users.onboarded_at so the dashboard stops
 * redirecting to /onboarding.
 */
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { fail, ok, withErrorEnvelope } from "@/lib/errors";
import { ProfileSchema, ProjectSchema, SkillsSchema } from "@/lib/library";
import {
  markOnboarded,
  saveUserProfile,
  saveUserProjects,
  saveUserSkills,
} from "@/lib/userdata";

export const runtime = "nodejs";

const Body = z.object({
  profile: ProfileSchema,
  projects: z.array(ProjectSchema).min(1).max(20),
  skills: SkillsSchema,
});

export async function POST(req: Request) {
  return withErrorEnvelope(async () => {
    const { userId } = await requireUser();
    const raw = await req.json().catch(() => null);
    const parsed = Body.safeParse(raw);
    if (!parsed.success) {
      return fail("VALIDATION", parsed.error.issues[0].message, 400);
    }
    saveUserProfile(userId, parsed.data.profile);
    saveUserProjects(userId, parsed.data.projects);
    saveUserSkills(userId, parsed.data.skills);
    markOnboarded(userId);
    return ok({ saved: true });
  });
}
