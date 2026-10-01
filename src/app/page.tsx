"use client";

import dynamic from "next/dynamic";

const Studio = dynamic(() => import("@/components/Studio").then((m) => m.Studio), {
  ssr: false,
  loading: () => (
    <main className="shell">
      <h1 className="brand">
        Petition<span>Pro</span>
      </h1>
      <p className="lede">Loading studio…</p>
    </main>
  ),
});

export default function Home() {
  return <Studio />;
}
