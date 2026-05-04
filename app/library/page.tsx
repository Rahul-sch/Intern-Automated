import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, currentUser } from "@clerk/nextjs/server";
import { ensureUser, isOnboarded, loadUserLibrary } from "@/lib/userdata";
import { LibraryEditor } from "./LibraryEditor";

export const dynamic = "force-dynamic";

export default async function LibraryPage() {
  const { userId } = await auth();
  if (!userId) redirect("/");
  const user = await currentUser();
  ensureUser({
    userId,
    email: user?.primaryEmailAddress?.emailAddress ?? null,
    name: [user?.firstName, user?.lastName].filter(Boolean).join(" ") || null,
  });
  if (!isOnboarded(userId)) redirect("/onboarding");

  const { profile, projects, skills } = loadUserLibrary(userId);

  return (
    <main className="mx-auto max-w-5xl w-full px-6 py-10 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Library</h1>
          <p className="text-sm text-slate-500 mt-1">
            Your profile, projects, and skills. These feed every tailored resume.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
        >
          ← Dashboard
        </Link>
      </div>
      {profile ? (
        <LibraryEditor profile={profile} projects={projects} skills={skills} />
      ) : (
        <div className="border border-dashed border-slate-300 dark:border-slate-700 rounded p-10 text-center text-sm text-slate-500">
          Profile not found. Visit{" "}
          <Link className="underline" href="/onboarding">
            /onboarding
          </Link>{" "}
          to set one up.
        </div>
      )}
    </main>
  );
}
