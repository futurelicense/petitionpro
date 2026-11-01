import type { Metadata } from "next";
import { CaseWorkspace } from "@/components/CaseWorkspace";

export const metadata: Metadata = {
  title: "Client case — PetitionPro",
  description: "One client case, updated by review period. Software, not legal advice.",
};

export default async function CasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CaseWorkspace id={id} />;
}
