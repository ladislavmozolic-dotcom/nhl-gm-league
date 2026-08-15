import { Card } from "@/components/ui";
import type { PlayerCareer, CareerSkaterRow, CareerGoalieRow } from "@/lib/career-server";

const AWARD_ICON: Record<string, string> = {
  Hart: "🏆", "Art Ross": "🎯", "Rocket Richard": "🚀", Norris: "🛡️", Vezina: "🧤",
  Calder: "🐣", Selke: "🔒", "Lady Byng": "🎩", "Conn Smythe": "👑", "Jack Adams": "📋", Presidents: "🥇",
};

function SkaterTable({ rows }: { rows: CareerSkaterRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[11px] uppercase tracking-wide text-slate-500 border-b border-slate-800">
            <th className="text-left py-1.5 pr-2">Season</th><th className="text-left pr-2">Team</th>
            <th className="text-right px-1.5">GP</th><th className="text-right px-1.5">G</th><th className="text-right px-1.5">A</th>
            <th className="text-right px-1.5">P</th><th className="text-right px-1.5">+/-</th><th className="text-right px-1.5">PIM</th>
            <th className="text-right px-1.5">S</th><th className="text-right px-1.5 hidden sm:table-cell">Hits</th><th className="text-right pl-1.5 hidden sm:table-cell">Blk</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className={`border-b border-slate-800/50 ${r.isPlayoff ? "text-slate-400" : "text-slate-200"}`}>
              <td className="py-1.5 pr-2 whitespace-nowrap">{r.season} <span className="text-[10px] text-slate-500">{r.league}{r.isPlayoff ? " · PO" : ""}</span></td>
              <td className="pr-2 text-slate-400">{r.teamCode ?? "—"}</td>
              <td className="text-right px-1.5 tabular-nums">{r.gp}</td>
              <td className="text-right px-1.5 tabular-nums">{r.goals}</td>
              <td className="text-right px-1.5 tabular-nums">{r.assists}</td>
              <td className="text-right px-1.5 tabular-nums font-semibold">{r.points}</td>
              <td className="text-right px-1.5 tabular-nums">{r.plusMinus > 0 ? `+${r.plusMinus}` : r.plusMinus}</td>
              <td className="text-right px-1.5 tabular-nums">{r.pim}</td>
              <td className="text-right px-1.5 tabular-nums">{r.shots}</td>
              <td className="text-right px-1.5 tabular-nums hidden sm:table-cell">{r.hits}</td>
              <td className="text-right pl-1.5 tabular-nums hidden sm:table-cell">{r.blocks}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GoalieTable({ rows }: { rows: CareerGoalieRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[11px] uppercase tracking-wide text-slate-500 border-b border-slate-800">
            <th className="text-left py-1.5 pr-2">Season</th><th className="text-left pr-2">Team</th>
            <th className="text-right px-1.5">GP</th><th className="text-right px-1.5">W</th><th className="text-right px-1.5">L</th>
            <th className="text-right px-1.5">OTL</th><th className="text-right px-1.5">SO</th><th className="text-right px-1.5">SV%</th><th className="text-right pl-1.5">GAA</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className={`border-b border-slate-800/50 ${r.isPlayoff ? "text-slate-400" : "text-slate-200"}`}>
              <td className="py-1.5 pr-2 whitespace-nowrap">{r.season} <span className="text-[10px] text-slate-500">{r.league}{r.isPlayoff ? " · PO" : ""}</span></td>
              <td className="pr-2 text-slate-400">{r.teamCode ?? "—"}</td>
              <td className="text-right px-1.5 tabular-nums">{r.gp}</td>
              <td className="text-right px-1.5 tabular-nums font-semibold">{r.wins}</td>
              <td className="text-right px-1.5 tabular-nums">{r.losses}</td>
              <td className="text-right px-1.5 tabular-nums">{r.otl}</td>
              <td className="text-right px-1.5 tabular-nums">{r.shutouts}</td>
              <td className="text-right px-1.5 tabular-nums">{r.svPct ? (r.svPct * 100).toFixed(1) : "—"}</td>
              <td className="text-right pl-1.5 tabular-nums">{r.gaa ? r.gaa.toFixed(2) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function PlayerCareerCard({ career }: { career: PlayerCareer }) {
  const hasRows = career.isGoalie ? career.goalie.length > 0 : career.skater.length > 0;
  return (
    <Card title="Career" bodyClassName="p-4">
      {career.awards.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {career.awards.map((a, i) => (
            <span key={i} className="inline-flex items-center gap-1 rounded-full bg-amber-950/30 border border-amber-800/40 px-2.5 py-1 text-xs text-amber-300">
              <span>{AWARD_ICON[a.category] ?? "🏅"}</span>{a.category}
              <span className="text-amber-500/70">{a.season}{a.detail ? ` · ${a.detail}` : ""}</span>
            </span>
          ))}
        </div>
      )}
      {hasRows ? (
        career.isGoalie ? <GoalieTable rows={career.goalie} /> : <SkaterTable rows={career.skater} />
      ) : (
        <p className="py-6 text-center text-slate-500 text-sm">No games on record yet.</p>
      )}
      {!career.isGoalie && career.totals && (
        <p className="mt-3 text-xs text-slate-500">NHL regular-season career: <span className="text-slate-300 font-semibold">{career.totals.gp} GP · {career.totals.goals}-{career.totals.assists}-{career.totals.points}</span></p>
      )}
      {career.isGoalie && career.goalieTotals && (
        <p className="mt-3 text-xs text-slate-500">NHL regular-season career: <span className="text-slate-300 font-semibold">{career.goalieTotals.gp} GP · {career.goalieTotals.wins} W · {career.goalieTotals.shutouts} SO · {(career.goalieTotals.svPct * 100).toFixed(1)}% · {career.goalieTotals.gaa.toFixed(2)} GAA</span></p>
      )}
    </Card>
  );
}
