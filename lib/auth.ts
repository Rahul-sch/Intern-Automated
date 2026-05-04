/**
 * Server-side auth helpers wrapping Clerk's auth() / currentUser() so the rest
 * of the app speaks our AppError envelope rather than Clerk's redirect dance.
 */
import { auth, currentUser } from "@clerk/nextjs/server";
import { AppError } from "./errors";
import { ensureUser } from "./userdata";

export async function requireUserId(): Promise<string> {
  const { userId } = await auth();
  if (!userId) {
    throw new AppError("VALIDATION", "Sign in to continue.", undefined, 401);
  }
  return userId;
}

/**
 * Resolves the signed-in user, syncs their email/name into our `users` table
 * (idempotent), and returns the Clerk user_id. Use this at the top of every
 * authenticated route handler so the FK on jobs/generations stays valid.
 */
export async function requireUser(): Promise<{
  userId: string;
  email: string | null;
  name: string | null;
}> {
  const userId = await requireUserId();
  const u = await currentUser();
  const email = u?.primaryEmailAddress?.emailAddress ?? null;
  const name =
    [u?.firstName, u?.lastName].filter(Boolean).join(" ").trim() || null;
  ensureUser({ userId, email, name });
  return { userId, email, name };
}

export async function getGroqKey(): Promise<string | null> {
  const u = await currentUser();
  const key = (u?.privateMetadata as { groqApiKey?: string } | undefined)
    ?.groqApiKey;
  return key && typeof key === "string" ? key : null;
}

export async function requireGroqKey(): Promise<string> {
  const key = await getGroqKey();
  if (!key) {
    throw new AppError(
      "VALIDATION",
      "Add your Groq API key in Settings before tailoring.",
      "https://console.groq.com/keys — free tier works.",
      400,
    );
  }
  return key;
}
