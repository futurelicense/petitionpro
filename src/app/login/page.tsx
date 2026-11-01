import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/LoginForm";
import { ADMIN_COOKIE, safeNext, sessionValid } from "@/lib/admin-session";

export const metadata: Metadata = {
  title: "Sign in — PetitionPro",
  description: "Admin sign-in for PetitionPro. Software, not legal advice.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const nextPath = safeNext((await searchParams).next);
  const jar = await cookies();
  if (sessionValid(jar.get(ADMIN_COOKIE)?.value)) redirect(nextPath);

  return (
    <main className="gate">
      <section className="gate-story">
        <div>
          <p className="kicker">Private drafting room</p>
          <h1 className="brand">
            Petition<span>Pro</span>
          </h1>
          <p className="gate-lede">
            EB-2 NIW and EB-1A stay on separate tests. A client case keeps one file, from the profile through well positioning.
          </p>
        </div>
        <ol className="gate-points">
          <li>
            <b>Studio</b>
            <span>The endeavor or the field, then the CV, then draft language.</span>
          </li>
          <li>
            <b>Projects</b>
            <span>Public repositories and suggested work, read against the chosen test.</span>
          </li>
          <li>
            <b>Cases</b>
            <span>One matter, updated by review period, with the checklist in the file.</span>
          </li>
          <li>
            <b>Idea bank</b>
            <span>USCIS research, used on a case for an insight, a recommendation, and a suggestion.</span>
          </li>
          <li>
            <b>Request Tank</b>
            <span>An act for a case, moved along a timeline until it is done.</span>
          </li>
        </ol>
        <p className="gate-foot">Drafting software. Not a law firm, and not a finding that anyone qualifies.</p>
      </section>
      <section className="gate-panel">
        <LoginForm nextPath={nextPath} />
      </section>
    </main>
  );
}
