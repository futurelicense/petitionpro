import type { Metadata } from "next";
import "@fontsource-variable/fraunces";
import "@fontsource-variable/source-sans-3";
import "./globals.css";

export const metadata: Metadata = {
  title: "PetitionPro — EB-2 NIW and EB-1A studio",
  description:
    "EB-2 NIW uses the Dhanasar proposed-endeavor framework. EB-1A uses the extraordinary-ability criteria. Software, not legal advice.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
