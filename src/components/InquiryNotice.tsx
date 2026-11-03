"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export function InquiryNotice() {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const response = await fetch("/api/admin/inquiries?summary=1", { cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json();
        if (!cancelled) setCount(data.newCount);
      } catch { /* The case board remains usable when the inbox is unavailable. */ }
    };
    void refresh(); const timer = setInterval(() => void refresh(), 60_000);
    const focus = () => void refresh(); window.addEventListener("focus", focus);
    return () => { cancelled = true; clearInterval(timer); window.removeEventListener("focus", focus); };
  }, []);
  return <Link className={`inquiry-notice${count ? " has-new" : ""}`} href="/inquiries">{count === null ? "Open consultant inquiries" : count ? `${count} new consultant ${count === 1 ? "inquiry" : "inquiries"} awaiting review →` : "Consultant inbox · no new inquiries"}</Link>;
}
