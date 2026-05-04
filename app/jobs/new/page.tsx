import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, currentUser } from "@clerk/nextjs/server";
import { ensureUser, isOnboarded } from "@/lib/userdata";
import { NewJobForm } from "./NewJobForm";

export const dynamic = "force-dynamic";

export default async function NewJobPage() {
  const { userId } = await auth();
  if (!userId) redirect("/");
  const user = await currentUser();
  ensureUser({
    userId,
    email: user?.primaryEmailAddress?.emailAddress ?? null,
    name: [user?.firstName, user?.lastName].filter(Boolean).join(" ") || null,
  });
  if (!isOnboarded(userId)) redirect("/onboarding");

  return (
    <main className="mx-auto max-w-3xl w-full px-6 py-10 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">New job</h1>
        <Link
          href="/dashboard"
          className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
        >
          ← Dashboard
        </Link>
      </div>
      <NewJobForm />
    </main>
  );
}
