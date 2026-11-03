"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";

const LINKS = [
  { href: "/studio", label: "Studio" },
  { href: "/project", label: "Projects" },
  { href: "/cases", label: "Overview" },
  { href: "/inquiries", label: "Inquiries" },
  { href: "/ideas", label: "Idea bank" },
  { href: "/requests", label: "Request Tank" },
];

export function Brand({ lede, tone = "intro" }: { lede: string; tone?: "intro" | "name" }) {
  const path = usePathname();
  const router = useRouter();
  const [signOutError, setSignOutError] = useState(false);

  async function signOut() {
    setSignOutError(false);
    try {
      const response = await fetch("/api/admin/logout", { method: "POST" });
      if (!response.ok) throw new Error("Sign-out failed");
      router.replace("/login");
      router.refresh();
    } catch {
      setSignOutError(true);
    }
  }

  return (
    <>
      <header className="rail">
        <div className="rail-inner">
          <div className="rail-mark">
            <p className="kicker">Drafting room</p>
            <h1 className="brand">
              Petition<span>Pro</span>
            </h1>
          </div>
          <nav className="sitenav" aria-label="Sections">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                data-on={link.href === "/" ? path === "/" : path === link.href || path.startsWith(`${link.href}/`) ? "true" : "false"}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <button className="signout" type="button" onClick={signOut}>
            Sign out
          </button>
          {signOutError && <p className="err" role="alert">Could not sign out. Please try again.</p>}
        </div>
      </header>
      {tone === "name" ? <h2 className="lede casename">{lede}</h2> : <p className="lede">{lede}</p>}
    </>
  );
}
