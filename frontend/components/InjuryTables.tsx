import Link from "next/link";
import type { CurrentInjury, SeasonInjury } from "@/lib/injuries-server";

const SEV_CLS: Record<string, string> = {
  "Day-to-Day": "text-slate-400", "Week-to-Week": "text-amber-400",
  "Multi-week": "text-orange-400", "Long-term": "text-red-400", "Season-ending": "text-red-500 font-bold",
};
const sevCls = (s: string) => SEV_CLS[s] ?? "text-slate-400";
const MECH_ICON: Record<string, string> = { Hit: "💥", "Blocked shot": "🛡️", Fight: "🥊", Collision: "🚑", Fatigue: "🔥" };

export function CurrentInjuryTable({ rows, showTeam = true }: { rows: CurrentInjury[]; showTeam?: boolean }) {
  if (rows.length === 0) return <p className="text-emerald-400 text-center py-10 text-lg font-semibold">No current injuries. 🎉</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[560px]">
        <thead>
          <tr className="text-xs text-slate-500 uppercase tracking-wide border-b border-slate-800">
            <th className="text-left px-3 py-2">Player</th>
            {showTeam && <th className="text-left px-3 py-2">Team</th>}
            <th className="text-left px-3 py-2">Pos</th>
            <th className="text-left px-3 py-2">Injury</th>
            <th className="text-right px-3 py-2">Days Left</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.playerId} className="border-b border-slate-800/50 hover:bg-slate-800/30">
              <td className="px-3 py-2"><Link href={`/players/${p.slug ?? p.playerId}`} className="hover:text-blue-400 font-medium">{p.name}</Link></td>
              {showTeam && <td className="px-3 py-2">{p.teamSlug ? <Link href={`/teams/${p.teamSlug}`} className="text-slate-400 hover:text-blue-400">{p.teamCode ?? p.teamName}</Link> : "—"}</td>}
              <td className="px-3 py-2 text-slate-500">{p.position}</td>
              <td className="px-3 py-2 text-slate-300">{p.desc}</td>
              <td className="px-3 py-2 text-right tabular-nums font-semibold text-amber-400">{p.daysLeft}</td>
            </tr>
          ))}
        </tbody>
      </table>
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
              {showTeam && <td className="px-3 py-2">{r.teamSlug ? <Link href={`/teams/${r.teamSlug}`} className="text-slate-400 hover:text-blue-400 whitespace-nowrap">{r.teamCode ?? r.teamName}</Link> : "—"}</td>}
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
