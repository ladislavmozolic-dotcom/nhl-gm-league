"use client";

import { useEffect } from "react";

// Logs one visit per browser per day (registered or guest) so the commissioner's
// Login Audit sees all traffic, not just GM sign-ins. Deduped via localStorage.
export default function VisitBeacon() {
  useEffect(() => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      if (localStorage.getItem("unhl_visit") === today) return;
      localStorage.setItem("unhl_visit", today);
      fetch("/api/visit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path: location.pathname }), keepalive: true }).catch(() => {});
    } catch { /* ignore */ }
  }, []);
  return null;
}
