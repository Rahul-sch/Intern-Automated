/**
 * POST   /api/settings/groq-key — save (and validate) the user's Groq API key
 * DELETE /api/settings/groq-key — clear it
 *
 * The key lives in Clerk's privateMetadata (server-only, encrypted at rest).
 * Validation hits Groq's /models endpoint with the candidate key — cheap and
 * authoritative.
 */
import { clerkClient } from "@clerk/nextjs/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { AppError, fail, ok, withErrorEnvelope } from "@/lib/errors";

export const runtime = "nodejs";

const Body = z.object({
  apiKey: z.string().min(20, "Looks too short — Groq keys start with gsk_..."),
});

async function validateKey(apiKey: string): Promise<void> {
  let res: Response;
  try {
    res = await fetch("https://api.groq.com/openai/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
  } catch {
    throw new AppError("VALIDATION", "Couldn't reach Groq — check your network.", undefined, 502);
  }
  if (res.status === 401) {
    throw new AppError(
      "VALIDATION",
      "Groq rejected this key.",
      "Generate a new one at console.groq.com/keys.",
      401,
    );
  }
  if (!res.ok) {
    throw new AppError(
      "VALIDATION",
      `Groq returned ${res.status} when validating the key.`,
      undefined,
      res.status,
    );
  }
}

export async function POST(req: Request) {
  return withErrorEnvelope(async () => {
    const { userId } = await requireUser();
    const raw = await req.json().catch(() => null);
    const parsed = Body.safeParse(raw);
    if (!parsed.success) return fail("VALIDATION", parsed.error.issues[0].message, 400);

    await validateKey(parsed.data.apiKey);

    const client = await clerkClient();
    await client.users.updateUserMetadata(userId, {
      privateMetadata: { groqApiKey: parsed.data.apiKey },
    });
    return ok({ saved: true });
  });
}

export async function DELETE() {
  return withErrorEnvelope(async () => {
    const { userId } = await requireUser();
    const client = await clerkClient();
    await client.users.updateUserMetadata(userId, {
      privateMetadata: { groqApiKey: null },
    });
    return ok({ cleared: true });
  });
}
