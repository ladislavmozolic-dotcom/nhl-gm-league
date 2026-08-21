import Link from "next/link";
import type { CurrentInjury, SeasonInjury } from "@/lib/injuries-server";
import { money } from "@/lib/finance";

const SEV_CLS: Record<string, string> = {
  "Day-to-Day": "text-slate-400", "Week-to-Week": "text-amber-400",
  "Multi-week": "text-orange-400", "Long-term": "text-red-400", "Season-ending": "text-red-500 font-bold",
};
const sevCls = (s: string) => SEV_CLS[s] ?? "text-slate-400";
// severity → the roster designation a GM would use (short day-to-day = no reserve move)
const SEV_TAG: Record<string, string> = { "Multi-week": "IR", "Long-term": "LTIR", "Season-ending": "LTIR" };
const MECH_ICON: Record<string, string> = { Hit: "💥", "Blocked shot": "🛡️", Fight: "🥊", Collision: "🚑", Fatigue: "🔥", "Non-contact": "🩹" };
// remaining days → human return estimate
const returnEta = (d: number) => d <= 6 ? `${d}d` : d < 14 ? "~1 wk" : d < 45 ? `~${Math.round(d / 7)} wks` : d < 120 ? `~${Math.round(d / 30)} mo` : "season";

export function CurrentInjuryTable({ rows, showTeam = true }: { rows: CurrentInjury[]; showTeam?: boolean }) {
  if (rows.length === 0) return <p className="text-emerald-400 text-center py-10 text-lg font-semibold">No current injuries. 🎉</p>;
  const reliefTotal = rows.reduce((s, p) => s + (p.onLtir ? p.capHit : 0), 0);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[640px]">
        <thead>
          <tr className="text-xs text-slate-500 uppercase tracking-wide border-b border-slate-800">
            <th className="text-left px-3 py-2">Player</th>
            {showTeam && <th className="text-left px-3 py-2">Team</th>}
            <th className="text-left px-3 py-2">Pos</th>
            <th className="text-left px-3 py-2">Injury</th>
            <th className="text-left px-3 py-2">Severity</th>
            <th className="text-left px-3 py-2">Status</th>
            <th className="text-right px-3 py-2">Return</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => {
            const tag = p.onLtir ? "LTIR" : SEV_TAG[p.severity];
            return (
            <tr key={p.playerId} className="border-b border-slate-800/50 hover:bg-slate-800/30">
              <td className="px-3 py-2"><Link href={`/players/${p.slug ?? p.playerId}`} className="hover:text-blue-400 font-medium">{p.name}</Link></td>
              {showTeam && <td className="px-3 py-2">{p.teamSlug ? <Link href={`/teams/${p.teamSlug}`} className="inline-flex items-center gap-1.5 text-slate-400 hover:text-blue-400">{p.teamLogo && <img src={p.teamLogo} alt="" className="w-5 h-5 object-contain shrink-0" />}{p.teamCode ?? p.teamName}</Link> : "—"}</td>}
              <td className="px-3 py-2 text-slate-500">{p.position}</td>
              <td className="px-3 py-2 text-slate-300">{p.desc}</td>
              <td className={`px-3 py-2 whitespace-nowrap ${sevCls(p.severity)}`}>{p.severity}</td>
              <td className="px-3 py-2">
                {tag === "LTIR"
                  ? <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300" title={`Long-Term Injured Reserve${p.onLtir ? ` — frees ${money(p.capHit)} of cap relief` : ""}`}>LTIR{p.onLtir ? ` · +${money(p.capHit)}` : ""}</span>
                  : tag === "IR"
                  ? <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-300" title="Injured Reserve — out multiple weeks (no cap relief; goalie or CON ≥ 90)">IR</span>
                  : <span className="text-slate-600 text-xs">active roster</span>}
              </td>
              <td className="px-3 py-2 text-right tabular-nums font-semibold text-amber-400 whitespace-nowrap" title={`${p.daysLeft} days left`}>{returnEta(p.daysLeft)}</td>
            </tr>
          );})}
        </tbody>
      </table>
      {reliefTotal > 0 && (
        <p className="px-3 py-2 text-xs text-slate-500 border-t border-slate-800/60">
          <span className="text-sky-300 font-semibold">LTIR relief: +{money(reliefTotal)}</span> — injured skaters (CON &lt; 90) whose cap hit the club may exceed the ceiling by to call up replacements. Relief clears automatically when they return.
        </p>
      )}
    </div>
  );
}

export function SeasonInjuryTable({ rows, showTeam = true }: { rows: SeasonInjury[]; showTeam?: boolean }) {
  if (rows.length === 0) return <p className="text-slate-500 text-center py-10">No injuries recorded this season yet.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[680px]">
        <thead>
          <tr className="text-xs text-slate-500 uppercase tracking-wide border-b border-slate-800">
            <th className="text-left px-3 py-2">Player</th>
            {showTeam && <th className="text-left px-3 py-2">Team</th>}
            <th className="text-left px-3 py-2">Injury</th>
            <th className="text-left px-3 py-2">Cause</th>
            <th className="text-left px-3 py-2">Severity</th>
            <th className="text-right px-3 py-2">Days</th>
            <th className="text-right px-3 py-2">Game</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
              <td className="px-3 py-2"><Link href={`/players/${r.slug ?? r.playerId}`} className="hover:text-blue-400 font-medium">{r.name}</Link></td>
              {showTeam && <td className="px-3 py-2">{r.teamSlug ? <Link href={`/teams/${r.teamSlug}`} className="inline-flex items-center gap-1.5 text-slate-400 hover:text-blue-400 whitespace-nowrap">{r.teamLogo && <img src={r.teamLogo} alt="" className="w-5 h-5 object-contain shrink-0" />}{r.teamCode ?? r.teamName}</Link> : "—"}</td>}
              <td className="px-3 py-2 text-slate-300">{r.part}</td>
              <td className="px-3 py-2 text-slate-400">{MECH_ICON[r.mechanism] ?? ""} {r.mechanism}{r.byName ? <span className="text-slate-600"> · by {r.byName}</span> : ""}</td>
              <td className={`px-3 py-2 ${sevCls(r.severity)}`}>{r.severity}</td>
              <td className="px-3 py-2 text-right tabular-nums text-slate-400">{r.days}</td>
              <td className="px-3 py-2 text-right"><Link href={`/games/${r.gameId}`} className="text-slate-500 hover:text-blue-400 text-xs">view</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
