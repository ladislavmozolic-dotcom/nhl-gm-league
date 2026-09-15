"use client";

import { useMemo, useState } from "react";
import { realBuyoutTerms, seasonLabel, CURRENT_SEASON_START, money } from "@/lib/finance";

export type BuyoutPickerPlayer = {
  id: number; name: string; teamCode: string | null; capHit: number; contractYears: number; age: number | null;
};

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
        <span className="font-semibold text-sm truncate">{value.name} <span className="text-slate-500 text-xs">{value.teamCode ?? ""}</span></span>
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
              <span className="text-slate-500 text-xs shrink-0">{p.teamCode} · {money(p.capHit)} · {p.contractYears}yr</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function BuyoutCalculator({ players, ageThreshold, youngPct, oldPct }: {
  players: BuyoutPickerPlayer[]; ageThreshold: number; youngPct: number; oldPct: number;
}) {
  const [picked, setPicked] = useState<BuyoutPickerPlayer | null>(null);
  const [salary, setSalary] = useState(0);
  const [years, setYears] = useState(1);
  const [age, setAge] = useState(27);
  const [bonus, setBonus] = useState(0);

  const pick = (p: BuyoutPickerPlayer) => { setPicked(p); setSalary(p.capHit); setYears(p.contractYears); setAge(p.age ?? 27); setBonus(0); };
  const clear = () => setPicked(null);

  const terms = useMemo(
    () => realBuyoutTerms(Math.max(0, salary), Math.max(1, Math.round(years)), age, {
      buyoutRealAgeThreshold: ageThreshold, buyoutRealYoungPct: youngPct, buyoutRealOldPct: oldPct,
    }, Math.max(0, Math.min(salary, bonus))),
    [salary, years, age, ageThreshold, youngPct, oldPct, bonus],
  );
  const rows = Array.from({ length: terms.years }, (_, i) => {
    const isOriginal = i < terms.originalYears;
    const originalCapHit = isOriginal ? salary : null;
    const buyoutCapHit = isOriginal ? terms.perYearOriginal : terms.perYearExtended;
    const savings = (originalCapHit ?? 0) - buyoutCapHit;
    return { season: seasonLabel(CURRENT_SEASON_START + i), originalCapHit, buyoutCapHit, savings };
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-900/40 border border-slate-800 rounded-xl p-4">
        <div>
          <label className="block text-xs text-slate-500 mb-1">Player (optional — or fill in manually below)</label>
          <PlayerPicker pool={players} value={picked} onPick={pick} onClear={clear} />
        </div>
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <label className="block text-xs text-slate-500 mb-1">Salary / Cap Hit</label>
            <input type="number" min={0} step={50000} value={salary}
              onChange={(e) => { setSalary(Number(e.target.value)); setPicked(null); }}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm tabular-nums" />
          </div>
          <div className="w-28">
            <label className="block text-xs text-slate-500 mb-1">Years left</label>
            <input type="number" min={1} max={8} step={1} value={years}
              onChange={(e) => { setYears(Number(e.target.value)); setPicked(null); }}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm tabular-nums" />
          </div>
          <div className="w-24">
            <label className="block text-xs text-slate-500 mb-1">Age at buyout</label>
            <input type="number" min={17} max={45} step={1} value={age}
              onChange={(e) => setAge(Number(e.target.value))}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm tabular-nums" />
          </div>
          <div className="w-36">
            <label className="block text-xs text-slate-500 mb-1">Signing bonus / yr</label>
            <input type="number" min={0} step={50000} value={bonus}
              onChange={(e) => setBonus(Number(e.target.value))}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm tabular-nums" />
          </div>
        </div>
        <p className="sm:col-span-2 text-xs text-slate-600">
          Under {ageThreshold} at buyout → {youngPct}% of salary owed. {ageThreshold}+ → {oldPct}%. Change these
          conditions in Sim Settings to test different rules. Signing bonus is guaranteed money — a buyout never
          reduces it, only the salary portion (Cap Hit − bonus) gets the %. We don&apos;t store real signing-bonus
          data, so enter it manually (e.g. from CapWages) to match a real player&apos;s numbers — leave at 0 for
          our own league&apos;s contracts, which never carry one.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Buyout %" value={`${terms.pct}%`} />
        <Stat label={`Cap hit / yr (yrs 1–${terms.originalYears})`} value={money(terms.perYearOriginal)} />
        <Stat label={`Cap hit / yr (yrs ${terms.originalYears + 1}–${terms.years})`} value={money(terms.perYearExtended)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Spread over" value={`${terms.years} seasons`} />
        <Stat label="Total cost (bonus + salary charge, debited at signing)" value={money(terms.totalCost)} />
      </div>

      <div className="bg-slate-900/40 border border-slate-800 rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-800/30 text-xs text-slate-500">
              <th className="px-3 py-2 text-left">Season</th>
              <th className="px-3 py-2 text-right">Original Cap Hit</th>
              <th className="px-3 py-2 text-right">Buyout Cap Hit</th>
              <th className="px-3 py-2 text-right">Cap Savings</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.season} className="border-b border-slate-800/60">
                <td className="px-3 py-1.5">{r.season}</td>
                <td className="px-3 py-1.5 text-right tabular-nums text-slate-400">{r.originalCapHit != null ? money(r.originalCapHit) : "—"}</td>
                <td className="px-3 py-1.5 text-right tabular-nums text-red-400">{money(r.buyoutCapHit)}</td>
                <td className={`px-3 py-1.5 text-right tabular-nums font-semibold ${r.savings >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {r.savings >= 0 ? "+" : ""}{money(r.savings)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-500">
        Real NHL buyout math (CBA Art. 50.5(b)), via <code>realBuyoutTerms</code> in <code>lib/finance.ts</code>: the
        club owes buyout% of the player&apos;s SALARY only (Cap Hit minus signing bonus) for each remaining year,
        paid out — and counted against the cap — evenly over 2× the remaining contract years. The full signing
        bonus is added on top for the original {terms.originalYears} year{terms.originalYears === 1 ? "" : "s"} only
        (it&apos;s guaranteed, not reduced, and isn&apos;t owed past the deal&apos;s real term). Since we only
        store a flat annual figure (no real per-year salary/bonus schedule), a real player with a front- or
        back-loaded contract may still differ slightly from CapWages/CapFriendly — this is exact for any contract
        with a genuinely flat salary and bonus year to year, which covers every contract our own league generates.
        This is a preview only: the live in-game &quot;Buy out&quot; button still uses the league&apos;s own
        simpler season/off-season rule unless you ask to switch it over.
      </p>
    </div>
  );
}

function Stat({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={`bg-slate-900/40 border border-slate-800 rounded-xl p-4 ${wide ? "col-span-full" : ""}`}>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-lg font-bold tabular-nums mt-0.5">{value}</div>
    </div>
  );
}
