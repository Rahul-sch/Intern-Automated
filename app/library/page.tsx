import Link from "next/link";
import { loadProfile, loadProjects, loadSkills } from "@/lib/library";
import { LibraryEditor } from "./LibraryEditor";

export default function LibraryPage() {
  const profile = loadProfile();
  const projects = loadProjects();
  const skills = loadSkills();
  return (
    <main className="mx-auto max-w-5xl w-full px-6 py-10 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Library</h1>
          <p className="text-sm text-slate-500 mt-1">
            Edit your profile, projects, and skills. These feed every tailored resume.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
        >
          ← Dashboard
        </Link>
      </div>
      <LibraryEditor profile={profile} projects={projects} skills={skills} />
    </main>
  );
}
