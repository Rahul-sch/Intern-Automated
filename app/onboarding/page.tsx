import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { isOnboarded } from "@/lib/userdata";
import { ensureUser } from "@/lib/userdata";
import { OnboardingFlow } from "./OnboardingFlow";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const user = await currentUser();
  if (!user) redirect("/");
  // Sync the Clerk user into our users table so isOnboarded() works.
  ensureUser({
    userId: user.id,
    email: user.primaryEmailAddress?.emailAddress ?? null,
    name: [user.firstName, user.lastName].filter(Boolean).join(" ") || null,
  });

  if (isOnboarded(user.id)) redirect("/dashboard");

  const meta = (user.privateMetadata as { groqApiKey?: string } | undefined)
    ?.groqApiKey;
  const hasKey = typeof meta === "string" && meta.length > 0;

  return (
    <main className="mx-auto max-w-3xl w-full px-6 py-10">
      <div className="space-y-2 mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">
          Let&apos;s set up your library
        </h1>
        <p className="text-sm text-slate-500">
          Two minutes. One Groq API key, one resume upload — the AI handles the
          rest.
        </p>
      </div>
      <OnboardingFlow initialHasKey={hasKey} />
    </main>
  );
}
