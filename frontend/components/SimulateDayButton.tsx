"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { advanceLeagueDayAction } from "@/app/admin/season/actions";

export default function SimulateDayButton({ gamesReady }: { gamesReady: number }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();

  const run = () => start(async () => {
    setMsg(null);
    try {
      const r = await advanceLeagueDayAction();
      const d = new Date(r.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
      setMsg(r.played ? `✅ Simulated ${r.played} game${r.played === 1 ? "" : "s"} — advanced to ${d}.` : `Advanced to ${d} (${r.phase}) — no games scheduled.`);
      router.refresh();
    } catch (e) {
      setMsg(`⚠ ${e instanceof Error ? e.message : "Failed to simulate."}`);
    }
  });

  return (
    <div>
      <button onClick={run} disabled={pending}
        className="w-full sm:w-auto px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-lg shadow-lg shadow-blue-900/30 transition-colors">
        {pending ? "Simulating…" : `▶ Simulate Day${gamesReady ? ` (${gamesReady} games)` : ""}`}
      </button>
      <p className="text-xs text-slate-500 mt-2">Auto-fills any short roster (call-ups), picks starters, then plays every scheduled game and updates finances. Logged to the audit trail.</p>
      {msg && <p className={`mt-2 text-sm ${msg.startsWith("⚠") ? "text-red-400" : "text-emerald-400"}`}>{msg}</p>}
    </div>
  );
}
