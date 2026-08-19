"use client";

import { useState, useTransition } from "react";
import { applyRosterMode, fillRealTeamsAction, fillRealCapsAction, fillRealProspectsAction } from "@/app/admin/rosters/actions";

export default function RosterModeControl({ mode, realCount, profinhlCount, profinhlCap, realCap, realCapCount }: {
  mode: string; realCount: number; profinhlCount: number; profinhlCap: string; realCap: string; realCapCount: number;
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [fillMsg, setFillMsg] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<null | "profinhl" | "real">(null);

  const apply = (m: "profinhl" | "real") => start(async () => {
    setMsg(null); setConfirm(null);
    const r = await applyRosterMode(m);
    setMsg(`Applied ${r.mode === "real" ? "Real NHL" : "ProfiNHL"} rosters.`);
  });

  const fill = () => start(async () => {
    setFillMsg(null);
    const r = await fillRealTeamsAction();
    if (!r.ok) { setFillMsg(`⚠ ${r.error}`); return; }
    setFillMsg(`✅ Matched ${r.matched} player${r.matched === 1 ? "" : "s"} to their real NHL team from ${r.rostersFetched} rosters${r.placed ? " (placed onto teams)" : ""}. ${r.unmatchedCount} still unmatched (not on any current NHL roster).`);
  });

  const fillCaps = () => start(async () => {
    setFillMsg(null);
    const r = await fillRealCapsAction();
    if (!r.ok) { setFillMsg(`⚠ ${r.error}`); return; }
    setFillMsg(`✅ Real cap hits from CapWages: ${r.updated} of ${r.total} rostered players updated (${r.fetched} salaries fetched)${r.placed ? " — live cap hits set" : ""}.`);
  });

  const fillProspects = () => start(async () => {
    setFillMsg(null);
    const r = await fillRealProspectsAction();
    if (!r.ok) { setFillMsg(`⚠ ${r.error}`); return; }
    setFillMsg(`✅ Rebuilt real prospects from EliteProspects: ${r.inserted} across ${r.teamsDone} teams.`);
  });

  const Btn = ({ m, label, desc, active }: { m: "profinhl" | "real"; label: string; desc: string; active: boolean }) => (
    <div className={`flex-1 rounded-xl border p-4 ${active ? "border-blue-500 bg-blue-600/10" : "border-slate-800 bg-slate-900/40"}`}>
      <div className="flex items-center gap-2 mb-1">
        <h3 className="font-bold">{label}</h3>
        {active && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-600 text-white">ACTIVE</span>}
      </div>
      <p className="text-xs text-slate-400 mb-3">{desc}</p>
      {confirm === m ? (
        <div className="flex items-center gap-2">
          <button onClick={() => apply(m)} disabled={pending} className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-semibold disabled:opacity-50">Confirm — reassign players</button>
          <button onClick={() => setConfirm(null)} className="px-3 py-1.5 rounded-lg bg-slate-700 text-sm">Cancel</button>
        </div>
      ) : (
        <button onClick={() => setConfirm(m)} disabled={pending || active}
          className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm font-semibold disabled:opacity-40">
          {active ? "In use" : `Switch to ${label}`}
        </button>
      )}
    </div>
  );

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-4">
        <Btn m="profinhl" label="ProfiNHL Rosters" desc={`Custom rosters & contracts (${profinhlCount} players). Cap ceiling ${profinhlCap}.`} active={mode === "profinhl"} />
        <Btn m="real" label="Real NHL Rosters" desc={`Real NHL teams + real cap hits (${realCount} rostered, ${realCapCount} real contracts). Cap ceiling ${realCap}. Unrostered players → free agents.`} active={mode === "real"} />
      </div>
      {msg && <p className="text-green-400 text-sm mt-3">{msg}</p>}
      <p className="text-xs text-slate-500 mt-3">Switching reassigns every player&apos;s team. It&apos;s reversible (the ProfiNHL assignment is snapshotted). Do this before generating a new season&apos;s schedule.</p>

      <div className="mt-5 rounded-xl border border-slate-800 bg-slate-900/40 p-4">
        <h3 className="font-bold text-sm mb-1">Fix missing real teams</h3>
        <p className="text-xs text-slate-400 mb-3">Some players (e.g. Marner, Wilson, Kopitar) had no real NHL team on file — names with suffixes like <code>&apos;&apos;A&apos;&apos;</code> / <code>(NTC)</code> broke the original match, so they land in Free Agency under Real rosters. This re-matches them against the live NHL rosters and fills their real team. In Real mode it also ices them immediately (no bank reset).</p>
        <div className="flex flex-wrap gap-2">
          <button onClick={fill} disabled={pending}
            className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold disabled:opacity-50">
            {pending ? "Working…" : "Fill missing real teams from NHL.com"}
          </button>
          <button onClick={fillCaps} disabled={pending}
            className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm font-semibold disabled:opacity-50"
            title="Pull real cap hits from CapWages — takes ~1-2 minutes">
            {pending ? "Working…" : "Fill real cap hits from CapWages"}
          </button>
          <button onClick={fillProspects} disabled={pending}
            className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm font-semibold disabled:opacity-50"
            title="Rebuild real prospects per team from EliteProspects — takes ~30s">
            {pending ? "Working…" : "Rebuild prospects from EliteProspects"}
          </button>
        </div>
        {fillMsg && <p className={`text-sm mt-3 ${fillMsg.startsWith("⚠") ? "text-rose-400" : "text-emerald-400"}`}>{fillMsg}</p>}
      </div>
    </div>
  );
}
