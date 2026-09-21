"use client";

import { useEffect, useState } from "react";
import { rosterComplianceAction, type RosterComplianceResult } from "@/lib/roster-compliance-server";
import { DRESS_TARGET } from "@/lib/roster-rules";

type Issue = Extract<RosterComplianceResult, { compliant: false }>;

const KEY = "dismissedRosterCompliance";
const sigOf = (r: Issue) => `${r.teamSlug}:${r.sides.map((s) => `${s.level}-${s.counts.F}-${s.counts.D}-${s.counts.G}`).join(",")}`;

export default function RosterComplianceOverlay() {
  const [issue, setIssue] = useState<Issue | null>(null);

  useEffect(() => {
    let alive = true;
    const check = async () => {
      try {
        const r = await rosterComplianceAction();
        if (!alive) return;
        if (r.ok && !r.compliant) {
          let seen: string | null = null;
          try { seen = sessionStorage.getItem(KEY); } catch { /* ignore */ }
          setIssue(seen === sigOf(r) ? null : r);
        } else {
          setIssue(null);
        }
      } catch { /* ignore */ }
    };
    check();
    const iv = setInterval(check, 60000);
    return () => { alive = false; clearInterval(iv); };
  }, []);

  if (!issue) return null;

  const close = () => { try { sessionStorage.setItem(KEY, sigOf(issue)); } catch { /* ignore */ } setIssue(null); };
  const row = (label: string, have: number, need: number) => {
    const off = have - need;
    return (
      <div className="flex items-center justify-between">
        <span className="text-slate-300">{label}</span>
        <span className={`tabular-nums font-semibold ${off === 0 ? "text-emerald-400" : "text-amber-400"}`}>
          {have}/{need}{off !== 0 ? ` (${off > 0 ? "+" : ""}${off})` : ""}
        </span>
      </div>
    );
  };
  const levelLabel: Record<"NHL" | "AHL", string> = { NHL: "NHL zostava", AHL: "AHL zostava" };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={close}>
      <div onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-amber-500/40 bg-[#1a1408] p-6 shadow-2xl shadow-amber-500/10">
        <h2 className="text-lg font-black text-white mb-1 flex items-center gap-2">⚠️ Zostava nie je v poriadku</h2>
        <p className="text-xs text-slate-400 mb-4">
          Do zápasu smie nastúpiť presne 20 hráčov — 12 útočníkov, 6 obrancov, 2 brankári — v NHL aj v AHL. Zvyšní hráči na súpiske musia byť označení ako <b>scratched</b>.
        </p>
        <div className="space-y-3 mb-5">
          {issue.sides.map((s) => (
            <div key={s.level} className="rounded-xl bg-slate-900/70 border border-slate-800 p-3 text-sm space-y-1.5">
              <div className="text-[11px] font-bold uppercase tracking-wide text-amber-300 mb-1">{levelLabel[s.level]} · {s.teamName}</div>
              {row("Útočníci (F)", s.counts.F, DRESS_TARGET.F)}
              {row("Obrancovia (D)", s.counts.D, DRESS_TARGET.D)}
              {row("Brankári (G)", s.counts.G, DRESS_TARGET.G)}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <a href={`/teams/${issue.teamSlug}/rosters`} onClick={close}
            className="flex-1 text-center px-4 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-sm font-bold">
            Upraviť zostavu
          </a>
          <button onClick={close} className="px-4 py-2.5 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 text-sm font-semibold">
            Zavrieť
          </button>
        </div>
      </div>
    </div>
  );
}
