/**
 * DELETE /api/library/projects/[slug] — remove a single project from the
 * user's library. Returns the resulting list.
 */
import { requireUser } from "@/lib/auth";
import { ok, withErrorEnvelope } from "@/lib/errors";
import { removeUserProject } from "@/lib/userdata";

export const runtime = "nodejs";

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  return withErrorEnvelope(async () => {
    const { userId } = await requireUser();
    const { slug } = await ctx.params;
    const projects = removeUserProject(userId, slug);
    return ok({ projects });
  });
}
