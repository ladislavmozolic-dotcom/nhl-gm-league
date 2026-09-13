"use client";

import { useMemo, useState } from "react";
import { accruedCapSpace, money } from "@/lib/finance";
import { daysBetween, addDays, fmtLeagueDate } from "@/lib/calendar";

type Team = { name: string; code: string | null; capHit: number };

const iso = (d: Date) => d.toISOString().slice(0, 10);

const Out = ({ label, value, big, tone, sub }: { label: string; value: string; big?: boolean; tone?: "good" | "bad" | "neutral"; sub?: string }) => (
  <div className="flex items-start justify-between px-5 py-3.5 border-b border-slate-800/60 last:border-0">
    <div>
      <div className="text-sm text-slate-400">{label}</div>
      {sub && <div className="text-[11px] text-slate-600 mt-0.5">{sub}</div>}
    </div>
    <span className={`tabular-nums shrink-0 ${big ? "text-2xl font-black" : "text-base font-semibold"} ${tone === "good" ? "text-emerald-400" : tone === "bad" ? "text-red-400" : "text-slate-200"}`}>{value}</span>
  </div>
);

const PresetBtn = ({ label, onClick }: { label: string; onClick: () => void }) => (
  <button type="button" onClick={onClick}
    className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-800/70 hover:bg-slate-700 border border-slate-700 text-slate-300 transition-colors">
    {label}
  </button>
);

export default function CapCalculator({
  ceiling, teams, seasonStart, seasonEnd, daysTotal, defaultDate,
}: {
  ceiling: number; teams: Team[];
  seasonStart: string; seasonEnd: string; daysTotal: number; defaultDate: string;
}) {
  const [capM, setCapM] = useState("81.60"); // projected cap hit, in $M
  const [date, setDate] = useState(defaultDate);

  const start = useMemo(() => new Date(seasonStart), [seasonStart]);
  const capHit = Math.max(0, (parseFloat(capM) || 0) * 1_000_000);
  const played = Math.max(0, Math.min(daysTotal, daysBetween(start, new Date(date))));
  const annualSpace = ceiling - capHit;
  const { actual, remaining } = accruedCapSpace(annualSpace, played, daysTotal);
  const maxCapHit = capHit + actual;
  const pct = Math.max(0, Math.min(100, Math.round((played / daysTotal) * 100)));
  const multiplier = annualSpace > 0 ? actual / annualSpace : 1;

  const prefillTeam = (code: string) => {
    const t = teams.find((x) => x.code === code);
    if (t) setCapM((t.capHit / 1_000_000).toFixed(2));
  };
  const jump = (d: Date) => setDate(iso(new Date(Math.max(new Date(seasonStart).getTime(), Math.min(new Date(seasonEnd).getTime(), d.getTime())))));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* inputs */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-3 bg-slate-800/30 border-b border-slate-800 text-xs font-bold uppercase tracking-wider text-slate-400">Scenario</div>
        <div className="p-5 space-y-5">
          {teams.length > 0 && (
            <label className="block">
              <span className="text-xs text-slate-400">Pre-fill cap hit from a club (optional)</span>
              <select onChange={(e) => e.target.value && prefillTeam(e.target.value)} defaultValue=""
                className="mt-1.5 w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm">
                <option value="">— enter manually —</option>
                {teams.map((t) => <option key={t.code} value={t.code ?? ""}>{t.name} — {money(t.capHit)}</option>)}
              </select>
            </label>
          )}

          <label className="block">
            <span className="text-xs text-slate-400">Projected Cap Hit</span>
            <div className="mt-1.5 flex items-center bg-slate-900 border border-slate-700 rounded-lg overflow-hidden focus-within:border-sky-600">
              <input type="number" value={capM} onChange={(e) => setCapM(e.target.value)} step="0.1"
                className="w-full bg-transparent px-3 py-2.5 text-xl font-bold tabular-nums outline-none" />
              <span className="px-3 text-slate-500 text-sm">$M</span>
            </div>
          </label>

          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Calendar date</span>
              <span className="text-xs text-slate-500 tabular-nums">Day {played} / {daysTotal}</span>
            </div>
            <input type="date" value={date} min={seasonStart} max={seasonEnd} onChange={(e) => e.target.value && setDate(e.target.value)}
              className="mt-1.5 w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-sm tabular-nums focus:outline-none focus:border-sky-600" />
            <div className="mt-2 h-1.5 rounded-full bg-slate-800 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-sky-600 to-emerald-500 transition-all" style={{ width: `${pct}%` }} />
            </div>
            <div className="mt-1 flex justify-between text-[11px] text-slate-600"><span>{fmtLeagueDate(start)}</span><span>{fmtLeagueDate(new Date(seasonEnd))}</span></div>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              <PresetBtn label="Season start" onClick={() => jump(start)} />
              <PresetBtn label="Today" onClick={() => setDate(defaultDate)} />
              <PresetBtn label="+30 days" onClick={() => jump(addDays(new Date(date), 30))} />
              <PresetBtn label="Season end" onClick={() => jump(new Date(seasonEnd))} />
            </div>
          </div>

          <div className="text-xs text-slate-500 pt-1 border-t border-slate-800/60">
            League cap ceiling: <b className="text-slate-300">{money(ceiling)}</b> — set in Admin → Simulation Engine.
          </div>
        </div>
      </div>

      {/* results */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-3 bg-slate-800/30 border-b border-slate-800 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Result</span>
          <span className="text-xs text-slate-500 tabular-nums">{remaining} days left · ×{multiplier.toFixed(2)}</span>
        </div>
        <Out label="Actual Cap Space" value={money(annualSpace)} tone={annualSpace < 0 ? "bad" : "neutral"} sub="vs. ceiling, today" />
        <Out label="Projected Cap Space" value={money(actual)} big tone={actual < 0 ? "bad" : "good"} sub="biggest full-season addition you can still afford" />
        <Out label="Projected Cap Hit" value={money(maxCapHit)} sub="max you may carry for the rest of the season" />
        <div className="px-5 py-4 text-xs text-slate-500 border-t border-slate-800 bg-slate-950/30">
          Unused cap banks each <b className="text-slate-300">calendar day</b> of the regular season (not each game) — so the later the date,
          the bigger the multiplier on your saved space. You can afford an addition up to <b className="text-emerald-400">{money(Math.max(0, actual))}</b> even
          if it pushes you over the <b>{money(ceiling)}</b> ceiling today, because the space you banked while under the cap covers the rest.
          <div className="mt-2 text-slate-600">Tip: a signing&apos;s real increase = the newcomer&apos;s cap hit minus the player he bumps to the farm (nil if that player just becomes your 13th F / 7th D).</div>
        </div>
      </div>
    </div>
  );
}
