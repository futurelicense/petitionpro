import type { Metadata } from "next";
import { Studio } from "@/components/Studio";

export const metadata: Metadata = {
  title: "Free proposed endeavor and CV assessment — PetitionPro",
  description: "Generate proposed endeavor options and CV-based working drafts, then continue DIY or request a consultant review.",
};

export default function Home() { return <Studio publicMode />; }
