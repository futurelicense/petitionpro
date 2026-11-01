import { Suspense } from "react";
import type { Metadata } from "next";
import { ProjectStudio } from "@/components/ProjectStudio";

export const metadata: Metadata = {
  title: "Tailored projects — PetitionPro",
  description:
    "Match work to projects under the classification in use: EB-2 NIW (Dhanasar) or EB-1A (extraordinary-ability criteria). Software, not legal advice.",
};

export default function ProjectPage() {
  return (
    <Suspense
      fallback={
        <main className="shell">
          <h1 className="brand">
            Petition<span>Pro</span>
          </h1>
          <p className="lede">Loading projects…</p>
        </main>
      }
    >
      <ProjectStudio />
    </Suspense>
  );
}
