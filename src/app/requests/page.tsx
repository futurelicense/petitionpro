import type { Metadata } from "next";
import { RequestTank } from "@/components/RequestTank";

export const metadata: Metadata = {
  title: "Request Tank — PetitionPro",
  description: "A timeline for an act that has to get done on a case. Software, not legal advice.",
};

export default async function RequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ case?: string }>;
}) {
  const caseId = (await searchParams).case ?? "";
  return <RequestTank initialCaseId={caseId} />;
}
