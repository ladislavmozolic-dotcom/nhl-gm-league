"use client";

import { useState } from "react";
import { accruedCapSpace, SEASON_GAMES, money } from "@/lib/finance";

type Team = { name: string; code: string | null; capHit: number; gp: number };

export default function CapCalculator({ ceiling, teams, gamesTotal = SEASON_GAMES }: { ceiling: number; teams: Team[]; gamesTotal?: number }) {
  const [capM, setCapM] = useState("81.60");   // projected cap hit, in $M
  const [gp, setGp] = useState("10");           // games played

  const capHit = Math.max(0, (parseFloat(capM) || 0) * 1_000_000);
  const played = Math.max(0, Math.min(gamesTotal, Math.round(parseFloat(gp) || 0)));
  const annualSpace = ceiling - capHit;
  const { actual, remaining } = accruedCapSpace(annualSpace, played, gamesTotal);
  const maxCapHit = capHit + actual;

  const prefill = (code: string) => {
    const t = teams.find((x) => x.code === code);
    if (!t) return;
    setCapM((t.capHit / 1_000_000).toFixed(2));
    setGp(String(t.gp));
  };

  const Field = ({ label, value, onChange, suffix }: { label: string; value: string; onChange: (v: string) => void; suffix: string }) => (
    <label className="block">
      <span className="text-xs text-slate-400">{label}</span>
      <div className="mt-1 flex items-center bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
        <input type="number" value={value} onChange={(e) => onChange(e.target.value)} step="0.1"
          className="w-full bg-transparent px-3 py-2 text-lg font-semibold tabular-nums outline-none" />
        <span className="px-3 text-slate-500 text-sm">{suffix}</span>
      </div>
    </label>
  );

  const Out = ({ label, value, big, tone }: { label: string; value: string; big?: boolean; tone?: "good" | "bad" | "neutral" }) => (
    <div className="flex items-baseline justify-between px-4 py-2.5 border-b border-slate-800/60 last:border-0">
      <span className="text-sm text-slate-400">{label}</span>
      <span className={`tabular-nums ${big ? "text-2xl font-black" : "text-base font-semibold"} ${tone === "good" ? "text-emerald-400" : tone === "bad" ? "text-red-400" : "text-slate-200"}`}>{value}</span>
    </div>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* inputs */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Inputs</div>
        {teams.length > 0 && (
          <label className="block">
            <span className="text-xs text-slate-400">Pre-fill from a club (optional)</span>
            <select onChange={(e) => e.target.value && prefill(e.target.value)} defaultValue=""
              className="mt-1 w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm">
              <option value="">— enter manually —</option>
              {teams.map((t) => <option key={t.code} value={t.code ?? ""}>{t.name} — {money(t.capHit)} · {t.gp} GP</option>)}
            </select>
          </label>
        )}
        <Field label="Projected Cap Hit" value={capM} onChange={setCapM} suffix="$M" />
        <Field label="Games Played" value={gp} onChange={setGp} suffix={`/ ${gamesTotal}`} />
        <div className="text-xs text-slate-500 pt-1">
          League cap ceiling: <b className="text-slate-300">{money(ceiling)}</b> — set in Admin → Simulation Engine.
        </div>
      </div>

      {/* results */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-4 py-2.5 bg-slate-800/30 border-b border-slate-800 text-xs font-bold uppercase tracking-wide text-slate-400">Result — {remaining} games left</div>
        <Out label="Actual Cap Space (vs ceiling)" value={money(annualSpace)} tone={annualSpace < 0 ? "bad" : "neutral"} />
        <Out label="Projected Cap Space" value={money(actual)} big tone={actual < 0 ? "bad" : "good"} />
        <Out label="Projected Cap Hit (max for the rest)" value={money(maxCapHit)} />
        <div className="px-4 py-3 text-xs text-slate-500 border-t border-slate-800">
          <b>Projected Cap Space</b> is the biggest <b>full-season cap hit</b> a new player can carry and still leave you legal —
          you can afford an addition up to <b className="text-emerald-400">{money(Math.max(0, actual))}</b> even if it pushes you over the
          <b> {money(ceiling)}</b> ceiling today, because the space you banked while under the cap covers it.
          <div className="mt-2 text-slate-600">Tip: a signing’s real increase = the newcomer’s cap hit minus the player he bumps to the farm (nil if that player just becomes your 13th F / 7th D).</div>
        </div>
      </div>
    </div>
  );
}
