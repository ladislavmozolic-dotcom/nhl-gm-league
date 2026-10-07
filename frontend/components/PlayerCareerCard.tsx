import Link from "next/link";
import { Card } from "@/components/ui";
import type { PlayerCareer, CareerSkaterRow, CareerGoalieRow } from "@/lib/career-server";

const AWARD_ICON: Record<string, string> = {
  Hart: "🏆", "Art Ross": "🎯", "Rocket Richard": "🚀", Norris: "🛡️", Vezina: "🧤",
  Calder: "🐣", Selke: "🔒", "Lady Byng": "🎩", "Conn Smythe": "👑", "Jack Adams": "📋", Presidents: "🥇",
};

const cellCls = "px-3 py-2.5 text-right tabular-nums whitespace-nowrap";
const headRowCls = "bg-slate-800/30 border-b border-slate-800 text-slate-500 text-xs uppercase tracking-wider";

const pmFmt = (v: number) => {
  if (v > 0) return <span className="text-emerald-400 font-medium">+{v}</span>;
  if (v < 0) return <span className="text-rose-400 font-medium">{v}</span>;
  return <span className="text-slate-400">0</span>;
};

const pctFmt = (v: number | null, d = 1) => (v == null ? "—" : v.toFixed(d));
const svpFmt = (v: number | null) => (v == null ? "—" : v.toFixed(3).replace(/^0/, ""));

function SkaterSection({ title, rows, isPlayoff }: { title: string; rows: CareerSkaterRow[]; isPlayoff?: boolean }) {
  if (!rows.length) return null;

  const total = rows.reduce(
    (acc, r) => ({
      gp: acc.gp + r.gp,
      goals: acc.goals + r.goals,
      assists: acc.assists + r.assists,
      points: acc.points + r.points,
      plusMinus: acc.plusMinus + r.plusMinus,
      pim: acc.pim + r.pim,
      shots: acc.shots + r.shots,
      hits: acc.hits + r.hits,
      blocks: acc.blocks + r.blocks,
    }),
    { gp: 0, goals: 0, assists: 0, points: 0, plusMinus: 0, pim: 0, shots: 0, hits: 0, blocks: 0 }
  );

  const totalSPct = total.shots ? (total.goals / total.shots) * 100 : null;
  const totalPPg = total.gp ? total.points / total.gp : 0;

  return (
    <div className="bg-slate-900/40 border border-slate-800 rounded-xl overflow-hidden">
      <div
        className={`px-4 py-2 text-xs font-bold uppercase tracking-wide ${
          isPlayoff
            ? "bg-amber-950/30 border-b border-amber-500/30 text-amber-300"
            : "bg-blue-950/40 border-b border-blue-500/30 text-blue-300"
        }`}
      >
        {title}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className={headRowCls}>
              <th className="px-3 py-2.5 text-left font-medium">Season</th>
              <th className="px-3 py-2.5 text-left font-medium">Team</th>
              <th className="px-3 py-2.5 text-right font-medium">GP</th>
              <th className="px-3 py-2.5 text-right font-medium">G</th>
              <th className="px-3 py-2.5 text-right font-medium">A</th>
              <th className="px-3 py-2.5 text-right font-medium">PTS</th>
              <th className="px-3 py-2.5 text-right font-medium">+/-</th>
              <th className="px-3 py-2.5 text-right font-medium">PIM</th>
              <th className="px-3 py-2.5 text-right font-medium">S</th>
              <th className="px-3 py-2.5 text-right font-medium">S%</th>
              <th className="px-3 py-2.5 text-right font-medium">HITS</th>
              <th className="px-3 py-2.5 text-right font-medium">BKS</th>
              <th className="px-3 py-2.5 text-right font-medium">P/PG</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const sPct = r.shots ? (r.goals / r.shots) * 100 : null;
              const pPg = r.gp ? r.points / r.gp : 0;
              return (
                <tr key={i} className="border-b border-slate-800/40 last:border-0 hover:bg-slate-800/20">
                  <td className="px-3 py-2.5 text-left font-medium">{r.season}</td>
                  <td className="px-3 py-2.5 text-left">
                    {r.teamSlug ? (
                      <Link href={`/teams/${r.teamSlug}`} className="hover:text-blue-400 font-medium">
                        {r.teamCode ?? "—"}
                      </Link>
                    ) : (
                      <span className="font-medium text-slate-400">{r.teamCode ?? "—"}</span>
                    )}
                  </td>
                  <td className={cellCls}>{r.gp}</td>
                  <td className={`${cellCls} font-semibold text-white`}>{r.goals}</td>
                  <td className={cellCls}>{r.assists}</td>
                  <td className={`${cellCls} font-bold text-white`}>{r.points}</td>
                  <td className={cellCls}>{pmFmt(r.plusMinus)}</td>
                  <td className={cellCls}>{r.pim}</td>
                  <td className={cellCls}>{r.shots}</td>
                  <td className={cellCls}>{pctFmt(sPct)}</td>
                  <td className={cellCls}>{r.hits}</td>
                  <td className={cellCls}>{r.blocks}</td>
                  <td className={cellCls}>{pPg.toFixed(2)}</td>
                </tr>
              );
            })}
            {/* Totals Row */}
            <tr className="border-t border-slate-700 bg-slate-800/40 font-semibold">
              <td className="px-3 py-2.5 text-left font-bold">Kariéra celkovo</td>
              <td className="px-3 py-2.5 text-left">
                <span className="text-slate-500 font-bold">TOT</span>
              </td>
              <td className={cellCls}>{total.gp}</td>
              <td className={`${cellCls} font-bold text-white`}>{total.goals}</td>
              <td className={cellCls}>{total.assists}</td>
              <td className={`${cellCls} font-black text-white`}>{total.points}</td>
              <td className={cellCls}>{pmFmt(total.plusMinus)}</td>
              <td className={cellCls}>{total.pim}</td>
              <td className={cellCls}>{total.shots}</td>
              <td className={cellCls}>{pctFmt(totalSPct)}</td>
              <td className={cellCls}>{total.hits}</td>
              <td className={cellCls}>{total.blocks}</td>
              <td className={cellCls}>{totalPPg.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function GoalieSection({ title, rows, isPlayoff }: { title: string; rows: CareerGoalieRow[]; isPlayoff?: boolean }) {
  if (!rows.length) return null;

  const total = rows.reduce(
    (acc, r) => ({
      gp: acc.gp + r.gp,
      wins: acc.wins + r.wins,
      losses: acc.losses + r.losses,
      otl: acc.otl + r.otl,
      shutouts: acc.shutouts + r.shutouts,
      shotsAgainst: acc.shotsAgainst + r.shotsAgainst,
      saves: acc.saves + r.saves,
      goalsAgainst: acc.goalsAgainst + r.goalsAgainst,
    }),
    { gp: 0, wins: 0, losses: 0, otl: 0, shutouts: 0, shotsAgainst: 0, saves: 0, goalsAgainst: 0 }
  );

  const totalSvPct = total.shotsAgainst ? total.saves / total.shotsAgainst : null;
  const totalGaa = total.gp ? total.goalsAgainst / total.gp : 0;

  return (
    <div className="bg-slate-900/40 border border-slate-800 rounded-xl overflow-hidden">
      <div
        className={`px-4 py-2 text-xs font-bold uppercase tracking-wide ${
          isPlayoff
            ? "bg-amber-950/30 border-b border-amber-500/30 text-amber-300"
            : "bg-blue-950/40 border-b border-blue-500/30 text-blue-300"
        }`}
      >
        {title}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className={headRowCls}>
              <th className="px-3 py-2.5 text-left font-medium">Season</th>
              <th className="px-3 py-2.5 text-left font-medium">Team</th>
              <th className="px-3 py-2.5 text-right font-medium">GP</th>
              <th className="px-3 py-2.5 text-right font-medium">W</th>
              <th className="px-3 py-2.5 text-right font-medium">L</th>
              <th className="px-3 py-2.5 text-right font-medium">OTL</th>
              <th className="px-3 py-2.5 text-right font-medium">SO</th>
              <th className="px-3 py-2.5 text-right font-medium">SV%</th>
              <th className="px-3 py-2.5 text-right font-medium">GAA</th>
              <th className="px-3 py-2.5 text-right font-medium">SA</th>
              <th className="px-3 py-2.5 text-right font-medium">SV</th>
              <th className="px-3 py-2.5 text-right font-medium">GA</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-slate-800/40 last:border-0 hover:bg-slate-800/20">
                <td className="px-3 py-2.5 text-left font-medium">{r.season}</td>
                <td className="px-3 py-2.5 text-left">
                  {r.teamSlug ? (
                    <Link href={`/teams/${r.teamSlug}`} className="hover:text-blue-400 font-medium">
                      {r.teamCode ?? "—"}
                    </Link>
                  ) : (
                    <span className="font-medium text-slate-400">{r.teamCode ?? "—"}</span>
                  )}
                </td>
                <td className={cellCls}>{r.gp}</td>
                <td className={`${cellCls} font-semibold text-white`}>{r.wins}</td>
                <td className={cellCls}>{r.losses}</td>
                <td className={cellCls}>{r.otl}</td>
                <td className={cellCls}>{r.shutouts}</td>
                <td className={`${cellCls} font-semibold text-cyan-300`}>{svpFmt(r.svPct)}</td>
                <td className={cellCls}>{r.gaa.toFixed(2)}</td>
                <td className={cellCls}>{r.shotsAgainst}</td>
                <td className={cellCls}>{r.saves}</td>
                <td className={cellCls}>{r.goalsAgainst}</td>
              </tr>
            ))}
            {/* Totals Row */}
            <tr className="border-t border-slate-700 bg-slate-800/40 font-semibold">
              <td className="px-3 py-2.5 text-left font-bold">Kariéra celkovo</td>
              <td className="px-3 py-2.5 text-left">
                <span className="text-slate-500 font-bold">TOT</span>
              </td>
              <td className={cellCls}>{total.gp}</td>
              <td className={`${cellCls} font-bold text-white`}>{total.wins}</td>
              <td className={cellCls}>{total.losses}</td>
              <td className={cellCls}>{total.otl}</td>
              <td className={cellCls}>{total.shutouts}</td>
              <td className={`${cellCls} font-bold text-cyan-300`}>{svpFmt(totalSvPct)}</td>
              <td className={cellCls}>{totalGaa.toFixed(2)}</td>
              <td className={cellCls}>{total.shotsAgainst}</td>
              <td className={cellCls}>{total.saves}</td>
              <td className={cellCls}>{total.goalsAgainst}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function PlayerCareerCard({ career }: { career: PlayerCareer }) {
  const isGoalie = career.isGoalie;
  const regRows = isGoalie
    ? career.goalie.filter((r) => !r.isPlayoff)
    : career.skater.filter((r) => !r.isPlayoff);
  const poRows = isGoalie
    ? career.goalie.filter((r) => r.isPlayoff)
    : career.skater.filter((r) => r.isPlayoff);

  const hasRows = regRows.length > 0 || poRows.length > 0;

  return (
    <Card title="Season History" bodyClassName="p-4 space-y-5">
      {career.awards.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {career.awards.map((a, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1.5 rounded-full bg-amber-950/30 border border-amber-800/40 px-3 py-1 text-xs text-amber-300"
            >
              <span>{AWARD_ICON[a.category] ?? "🏅"}</span>
              <span className="font-semibold">{a.category}</span>
              <span className="text-amber-500/70">{a.season}{a.detail ? ` · ${a.detail}` : ""}</span>
            </span>
          ))}
        </div>
      )}

      {hasRows ? (
        <div className="space-y-5">
          {isGoalie ? (
            <>
              <GoalieSection title="NHL · Základná časť" rows={regRows as CareerGoalieRow[]} isPlayoff={false} />
              <GoalieSection title="NHL · Play-off" rows={poRows as CareerGoalieRow[]} isPlayoff={true} />
            </>
          ) : (
            <>
              <SkaterSection title="NHL · Základná časť" rows={regRows as CareerSkaterRow[]} isPlayoff={false} />
              <SkaterSection title="NHL · Play-off" rows={poRows as CareerSkaterRow[]} isPlayoff={true} />
            </>
          )}
        </div>
      ) : (
        <p className="py-6 text-center text-slate-500 text-sm">Žiadne zaznamenané zápasy.</p>
      )}
    </Card>
  );
}
