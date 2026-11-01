import type { Metadata } from "next";
import { IdeaBank } from "@/components/IdeaBank";

export const metadata: Metadata = {
  title: "Idea bank — PetitionPro",
  description: "USCIS research and ideas that can be read against a case. Software, not legal advice.",
};

export default function IdeasPage() {
  return <IdeaBank />;
}
