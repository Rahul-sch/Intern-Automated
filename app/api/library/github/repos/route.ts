/**
 * POST /api/library/github/repos
 *   body: { token: string }
 *   Validates the PAT via GET /user, then returns the user's owned non-fork
 *   non-archived repos (most-recently-pushed first). The PAT is NEVER
 *   persisted — it round-trips on this request only.
 */
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { fail, ok, withErrorEnvelope } from "@/lib/errors";
import { listOwnedRepos, whoAmI } from "@/lib/github";

export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({
  token: z.string().min(20, "Looks too short — GitHub PATs start with ghp_..."),
});

export async function POST(req: Request) {
  return withErrorEnvelope(async () => {
    await requireUser();
    const raw = await req.json().catch(() => null);
    const parsed = Body.safeParse(raw);
    if (!parsed.success) return fail("VALIDATION", parsed.error.issues[0].message, 400);

    const me = await whoAmI(parsed.data.token);
    const repos = await listOwnedRepos(parsed.data.token);
    return ok({ login: me.login, repos });
  });
}
