import type { Metadata } from "next";
import { CaseBoard } from "@/components/CaseBoard";

export const metadata: Metadata = {
  title: "Case overview — PetitionPro",
  description:
    "Admin cases from profile evaluation through well positioning, updated by review period. Software, not legal advice.",
};

export default function CasesPage() {
  return <CaseBoard />;
}
