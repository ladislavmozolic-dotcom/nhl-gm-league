"use client";

import { useMemo, useState } from "react";
import { buyoutTerms, seasonLabel, CURRENT_SEASON_START, money } from "@/lib/finance";

export type BuyoutPickerPlayer = {
  id: number; name: string; teamCode: string | null; rosterType: string | null; capHit: number; contractYears: number;
};

type BuyoutPhase = "offseason" | "preseason" | "regular" | "playoffs";

function normalizedPhase(phase: string): BuyoutPhase {
  if (phase === "regular" || phase === "playoffs" || phase === "preseason") return phase;
  return "offseason";
}

function PlayerPicker({ pool, value, onPick, onClear }: {
  pool: BuyoutPickerPlayer[]; value: BuyoutPickerPlayer | null;
  onPick: (p: BuyoutPickerPlayer) => void; onClear: () => void;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const matches = useMemo(() => {
    if (!q.trim()) return [];
    const s = q.toLowerCase();
    return pool.filter((p) => p.name.toLowerCase().includes(s)).slice(0, 8);
  }, [q, pool]);

  if (value) {
    return (
      <div className="flex items-center justify-between gap-2 bg-slate-800/60 rounded-lg px-3 py-2">
        <span className="font-semibold text-sm truncate">{value.name} <span className="text-slate-500 text-xs">{value.teamCode ?? ""} · {value.rosterType}</span></span>
        <button onClick={onClear} className="text-slate-400 hover:text-red-400 text-sm shrink-0">✕</button>
      </div>
    );
  }
  return (
    <div className="relative">
      <input value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)} placeholder="Search a signed NHL player…"
        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm" />
      {open && matches.length > 0 && (
        <div className="absolute z-30 mt-1 w-full max-h-72 overflow-y-auto bg-[#0f1d32] border border-slate-700 rounded-lg shadow-2xl">
          {matches.map((p) => (
            <button key={p.id} onMouseDown={() => { onPick(p); setQ(""); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-slate-700/50 flex items-center justify-between gap-2">
              <span className="truncate">{p.name}</span>
              <span className="text-slate-500 text-xs shrink-0">{p.teamCode} · {p.rosterType} · {money(p.capHit)} · {p.contractYears}yr</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function BuyoutCalculator({ players, offseasonPct, seasonPct, currentPhase }: {
  players: BuyoutPickerPlayer[]; offseasonPct: number; seasonPct: number; currentPhase: string;
}) {
  const [picked, setPicked] = useState<BuyoutPickerPlayer | null>(null);
  const [salary, setSalary] = useState(0);
  const [years, setYears] = useState(1);
  const [phase, setPhase] = useState<BuyoutPhase>(() => normalizedPhase(currentPhase));

  const pick = (p: BuyoutPickerPlayer) => {
    setPicked(p); setSalary(p.capHit); setYears(p.contractYears);
  };
  const isSeason = phase === "regular" || phase === "playoffs";
  const terms = useMemo(
    () => buyoutTerms(Math.max(0, salary), Math.max(1, Math.round(years)), isSeason, {
      buyoutPctOffseason: offseasonPct, buyoutPctSeason: seasonPct,
    }),
    [salary, years, isSeason, offseasonPct, seasonPct],
  );
  const originalYears = Math.max(1, Math.round(years));
  const rows = Array.from({ length: terms.years }, (_, i) => {
    const originalCapHit = i < originalYears ? salary : null;
    const savings = (originalCapHit ?? 0) - terms.perYear;
    return { season: seasonLabel(CURRENT_SEASON_START + i), originalCapHit, savings };
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-900/40 border border-slate-800 rounded-xl p-4">
        <div>
          <label className="block text-xs text-slate-500 mb-1">Player (optional — or fill in manually)</label>
          <PlayerPicker pool={players} value={picked} onPick={pick} onClear={() => setPicked(null)} />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Buyout period</label>
          <select value={phase} onChange={(e) => setPhase(e.target.value as BuyoutPhase)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm">
            <option value="offseason">Off-season / Frenzy ({offseasonPct}%)</option>
            <option value="preseason">Preseason ({offseasonPct}%)</option>
            <option value="regular">Regular season ({seasonPct}%)</option>
            <option value="playoffs">Playoffs ({seasonPct}%)</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Salary / Cap Hit</label>
          <input type="number" min={0} step={50000} value={salary}
            onChange={(e) => { setSalary(Number(e.target.value)); setPicked(null); }}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm tabular-nums" />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Years left</label>
          <input type="number" min={1} max={8} step={1} value={years}
            onChange={(e) => { setYears(Number(e.target.value)); setPicked(null); }}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm tabular-nums" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Stat label="Buyout rate" value={`${terms.pct}%`} />
        <Stat label="Dead cap per season" value={money(terms.perYear)} />
        <Stat label="Dead-cap duration" value={`${terms.years} seasons`} />
      </div>
      <Stat label="Total dead cap across all seasons" value={money(terms.totalCost)} />

      <div className="bg-slate-900/40 border border-slate-800 rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-slate-800 bg-slate-800/30 text-xs text-slate-500">
            <th className="px-3 py-2 text-left">Season</th>
            <th className="px-3 py-2 text-right">Original Cap Hit</th>
            <th className="px-3 py-2 text-right">Dead Cap</th>
            <th className="px-3 py-2 text-right">Cap change</th>
          </tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.season} className="border-b border-slate-800/60">
              <td className="px-3 py-1.5">{r.season}</td>
              <td className="px-3 py-1.5 text-right tabular-nums text-slate-400">{r.originalCapHit != null ? money(r.originalCapHit) : "—"}</td>
              <td className="px-3 py-1.5 text-right tabular-nums text-red-400">{money(terms.perYear)}</td>
              <td className={`px-3 py-1.5 text-right tabular-nums font-semibold ${r.savings >= 0 ? "text-green-400" : "text-red-400"}`}>
                {r.savings >= 0 ? "+" : ""}{money(r.savings)}
              </td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <p className="text-xs text-slate-500">
        This calculator uses the same <code>buyoutTerms</code> function as the live Buy out button. A completed
        buyout moves the player to UFA and records the amount above as team dead cap. It counts against the salary
        cap for every listed season. No money is deducted from the team bank.
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-4">
    <div className="text-xs text-slate-500">{label}</div>
    <div className="text-lg font-bold tabular-nums mt-0.5">{value}</div>
  </div>;
}
