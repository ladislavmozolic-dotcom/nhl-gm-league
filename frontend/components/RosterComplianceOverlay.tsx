"use client";

import { useEffect, useState } from "react";
import { rosterComplianceAction, type RosterComplianceResult } from "@/lib/roster-compliance-server";
import { DRESS_TARGET } from "@/lib/roster-rules";

type Issue = Extract<RosterComplianceResult, { compliant: false }>;

const KEY = "dismissedRosterCompliance";
const sigOf = (r: Issue) => `${r.teamSlug}:${r.sides.map((s) => `${s.level}-${s.counts.F}-${s.counts.D}-${s.counts.G}`).join(",")}:${r.cap ? `${r.cap.kind}-${r.cap.amount}` : "cap-ok"}`;
const money = (n: number) => (n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M` : `$${Math.round(n / 1000)}K`);
const GROUP_SK = { F: "forward", D: "defenseman", G: "goalie" } as const;

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
  const hints = (s: Issue["sides"][number]) => {
    const out: string[] = [];
    for (const g of ["F", "D", "G"] as const) {
      const diff = s.counts[g] - DRESS_TARGET[g];
      if (diff > 0) out.push(`${diff} too many ${GROUP_SK[g]}(s) — mark the extras as scratched${s.level === "NHL" ? " or send them to the farm" : ""}.`);
      if (diff < 0) {
        out.push(`Missing ${-diff} ${GROUP_SK[g]}(s)${s.level === "NHL" ? " — call one up from the farm" : " — activate a scratched player"}.`);
        if (s.level === "NHL" && issue.noCallupGroups.includes(g)) out.push(`You have no one on the farm who can be called up ($100K contracts are AHL-only) — you must acquire a ${GROUP_SK[g]} on an NHL contract via trade or free agency.`);
      }
    }
    return out;
  };
  const f = issue.fines;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={close}>
      <div onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-amber-500/40 bg-[#1a1408] p-6 shadow-2xl shadow-amber-500/10">
        <h2 className="text-lg font-black text-white mb-1 flex items-center gap-2">⚠️ {issue.sides.length ? "Lineup is not valid" : "Team is outside the salary cap"}</h2>
        <p className="text-xs text-slate-400 mb-4">
          Exactly 20 players may dress for a game — 12 forwards, 6 defensemen, 2 goalies — in both the NHL and the AHL. The remaining players on the roster must be marked as <b>scratched</b>.
        </p>
        <div className="space-y-3 mb-5">
          {issue.sides.map((s) => (
            <div key={s.level} className="rounded-xl bg-slate-900/70 border border-slate-800 p-3 text-sm space-y-1.5">
              <div className="text-[11px] font-bold uppercase tracking-wide text-amber-300 mb-1">{levelLabel[s.level]} · {s.teamName}</div>
              {row("Forwards (F)", s.counts.F, DRESS_TARGET.F)}
              {row("Obrancovia (D)", s.counts.D, DRESS_TARGET.D)}
              {row("Goalies (G)", s.counts.G, DRESS_TARGET.G)}
              {hints(s).length > 0 && (
                <ul className="mt-2 pt-2 border-t border-slate-800 space-y-1 text-xs text-slate-300 list-disc pl-4">
                  {hints(s).map((h, i) => <li key={i}>{h}</li>)}
                </ul>
              )}
              <div className="text-[11px] text-rose-300">Penalty: {money(s.level === "NHL" ? f.nhlRoster : f.ahlRoster)} for every day with an invalid roster</div>
            </div>
          ))}
          {issue.cap && (
            <div className="rounded-xl bg-slate-900/70 border border-slate-800 p-3 text-sm space-y-1.5">
              <div className="text-[11px] font-bold uppercase tracking-wide text-amber-300 mb-1">Salary cap</div>
              <div className="text-slate-300">
                {issue.cap.kind === "over"
                  ? <>You are <b className="text-rose-300">{money(issue.cap.amount)} over the cap</b> ({money(issue.cap.committed)} of {money(issue.cap.limit)}). You must cut salary by at least {money(issue.cap.amount)} — trade, buyout, waivers or sending a player to the farm.</>
                  : <>You are <b className="text-rose-300">{money(issue.cap.amount)} under the floor</b> ({money(issue.cap.committed)} of the {money(issue.cap.limit)} minimum). You must add at least {money(issue.cap.amount)} in salary.</>}
              </div>
              <div className="text-[11px] text-rose-300">
                Penalty: {money(issue.cap.kind === "over" ? f.cap : f.floor)} per day; it also counts toward lowering/raising next season's cap.
              </div>
            </div>
          )}
          <p className="text-[11px] text-slate-500">
            Penalties go to the League Bank and are deducted from the team account. The check runs every day at 20:30 (Bratislava time){f.active ? "." : " — automatic penalties are currently off, but the rules still apply."}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <a href={`/teams/${issue.teamSlug}/rosters`} onClick={close}
            className="flex-1 text-center px-4 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-sm font-bold">
            Edit lineup
          </a>
          <button onClick={close} className="px-4 py-2.5 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 text-sm font-semibold">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
