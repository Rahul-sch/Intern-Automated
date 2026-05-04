/**
 * POST /api/library/projects
 *   body: { project: Project } OR { projects: Project[] }
 *   Appends to the user's library, deduping slugs against existing projects.
 *   Returns the resulting full list.
 */
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { fail, ok, withErrorEnvelope } from "@/lib/errors";
import { ProjectSchema } from "@/lib/library";
import { appendUserProjects } from "@/lib/userdata";

export const runtime = "nodejs";

const Body = z
  .object({
    project: ProjectSchema.optional(),
    projects: z.array(ProjectSchema).max(20).optional(),
  })
  .refine((v) => v.project || (v.projects && v.projects.length > 0), {
    message: "Provide `project` or `projects`",
  });

export async function POST(req: Request) {
  return withErrorEnvelope(async () => {
    const { userId } = await requireUser();
    const raw = await req.json().catch(() => null);
    const parsed = Body.safeParse(raw);
    if (!parsed.success) {
      return fail("VALIDATION", parsed.error.issues[0].message, 400);
    }
    const incoming = parsed.data.project
      ? [parsed.data.project]
      : (parsed.data.projects ?? []);
    const merged = appendUserProjects(userId, incoming);
    return ok({ projects: merged });
  });
}
