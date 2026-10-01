import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PetitionPro — NIW proposed endeavor studio",
  description:
    "Draft a specific EB-2 NIW proposed endeavor, then attach a CV for skeletal well-positioning and national-importance drafts. Software, not legal advice.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
