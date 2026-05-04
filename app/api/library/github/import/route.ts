/**
 * POST /api/library/github/import
 *   body: { token: string, repos: { owner, repo, description, pushed_at }[] }
 *   For each selected repo, fetch README + languages and ask the LLM
 *   (user's BYO Groq key) to draft a Project entry. Returns the drafts;
 *   does NOT save. Client posts to /api/library/projects after review.
 */
import { z } from "zod";
import { requireGroqKey, requireUser } from "@/lib/auth";
import { fail, ok, withErrorEnvelope } from "@/lib/errors";
import { buildDraftsFromRepos } from "@/lib/github_drafts";

export const runtime = "nodejs";
export const maxDuration = 300;

const Body = z.object({
  token: z.string().min(20),
  repos: z
    .array(
      z.object({
        owner: z.string().min(1),
        repo: z.string().min(1),
        description: z.string().default(""),
        pushed_at: z.string().default(""),
      }),
    )
    .min(1)
    .max(8, "Pick at most 8 repos per import to keep things snappy."),
});

export async function POST(req: Request) {
  return withErrorEnvelope(async () => {
    await requireUser();
    const apiKey = await requireGroqKey();
    const raw = await req.json().catch(() => null);
    const parsed = Body.safeParse(raw);
    if (!parsed.success) return fail("VALIDATION", parsed.error.issues[0].message, 400);

    const drafts = await buildDraftsFromRepos({
      apiKey,
      ghToken: parsed.data.token,
      repos: parsed.data.repos,
    });
    return ok({ drafts });
  });
}
