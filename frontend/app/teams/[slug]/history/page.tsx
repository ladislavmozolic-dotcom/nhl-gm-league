import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ComingSoon from "@/components/ComingSoon";
import { Card } from "@/components/ui";
import { cleanName } from "@/lib/playerName";
import { franchiseHistory, type FranchiseLeader } from "@/lib/career-server";

export const dynamic = "force-dynamic";

const RESULT_TONE: Record<string, string> = { Champion: "text-amber-400", Final: "text-slate-200", "Conf Final": "text-sky-400" };

const AWARD_LABEL: Record<string, string> = {
  Hart: "Hart (MVP)", "Art Ross": "Art Ross", "Rocket Richard": "Rocket Richard",
  Norris: "Norris", Vezina: "Vezina", Calder: "Calder", Selke: "Selke",
  "Lady Byng": "Lady Byng", "Conn Smythe": "Conn Smythe", "Jack Adams": "Jack Adams",
};

export default async function TeamHistoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const team = await prisma.team.findUnique({ where: { slug } });
  if (!team) notFound();

  const [records, awards, fh] = await Promise.all([
    prisma.seasonRecord.findMany({
      where: { OR: [{ championTeamId: team.id }, { runnerUpTeamId: team.id }, { presidentsTeamId: team.id }] },
    }),
    prisma.seasonAward.findMany({ where: { teamId: team.id } }),
    franchiseHistory(team.id, team.league ?? "NHL"),
  ]);

  if (records.length === 0 && awards.length === 0 && fh.seasons.length === 0) {
    return (
      <div className="space-y-6">
        <ComingSoon
          title="Team History"
          points={[
            "Championships, finals appearances and President's Trophies",
            "Award winners from this franchise",
            "Fills in automatically once seasons are archived (Admin → Season Control)",
          ]}
        />
      </div>
    );
  }

  const pids = [...new Set(awards.map((a) => a.playerId).filter((x): x is number => !!x))];
  const pRows = pids.length ? await prisma.player.findMany({ where: { id: { in: pids } }, select: { id: true, name: true, slug: true } }) : [];
  const pMap = new Map(pRows.map((p) => [p.id, p]));

  const champs = records.filter((r) => r.championTeamId === team.id);
  const runnersUp = records.filter((r) => r.runnerUpTeamId === team.id);
  const presidents = records.filter((r) => r.presidentsTeamId === team.id);

  const Trophy = ({ n, label, seasons, tone }: { n: number; label: string; seasons: string[]; tone: string }) => (
    <div className="bg-slate-800/40 rounded-xl p-4 text-center">
      <div className={`text-3xl font-black ${tone}`}>{n}</div>
      <div className="text-xs uppercase tracking-wide text-slate-400 mt-1">{label}</div>
      {seasons.length > 0 && <div className="text-[11px] text-slate-500 mt-1">{seasons.join(", ")}</div>}
    </div>
  );

  const at = fh.allTime;
  const pct = at.gp ? ((at.wins * 2 + at.otl) / (at.gp * 2) * 100).toFixed(1) : "0.0";
  const LeaderList = ({ title, rows, unit }: { title: string; rows: FranchiseLeader[]; unit: string }) => (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-slate-500 mb-1.5">{title}</div>
      {rows.length === 0 ? <p className="text-sm text-slate-600">—</p> : (
        <ol className="space-y-1">
          {rows.map((l, i) => (
            <li key={i} className="flex items-center gap-2 text-sm">
              <span className="w-4 text-slate-600 text-xs">{i + 1}</span>
              {l.slug ? <Link href={`/players/${l.slug}`} className="flex-1 truncate hover:text-blue-400">{l.name}</Link> : <span className="flex-1 truncate">{l.name}</span>}
              <span className="tabular-nums font-semibold">{l.value}<span className="text-slate-500 text-xs ml-0.5">{unit}</span></span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-3">
        <Trophy n={champs.length} label={champs.some((c) => c.league === "AHL") ? "Cups" : "Stanley Cups"} tone="text-amber-400" seasons={champs.map((c) => c.season)} />
        <Trophy n={runnersUp.length} label="Finals Losses" tone="text-slate-300" seasons={runnersUp.map((c) => c.season)} />
        <Trophy n={presidents.length} label="Best Records" tone="text-green-400" seasons={presidents.map((c) => c.season)} />
      </div>

      <Card title="All-Time Record" accent="text-blue-400">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <div><div className="text-2xl font-black text-white">{at.seasons}</div><div className="text-[11px] uppercase tracking-wide text-slate-500">Seasons</div></div>
          <div><div className="text-2xl font-black text-white tabular-nums">{at.wins}-{at.losses}-{at.otl}</div><div className="text-[11px] uppercase tracking-wide text-slate-500">Record ({pct}%)</div></div>
          <div><div className="text-2xl font-black text-white tabular-nums">{at.points}</div><div className="text-[11px] uppercase tracking-wide text-slate-500">Points</div></div>
          <div><div className="text-2xl font-black text-white tabular-nums">{at.gf}<span className="text-slate-500 text-base">/</span>{at.ga}</div><div className="text-[11px] uppercase tracking-wide text-slate-500">GF / GA</div></div>
        </div>
      </Card>

      <Card title="Franchise Leaders" accent="text-amber-400">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <LeaderList title="Points" rows={fh.leaders.points} unit="P" />
          <LeaderList title="Goals" rows={fh.leaders.goals} unit="G" />
          <LeaderList title="Wins (Goalie)" rows={fh.leaders.wins} unit="W" />
        </div>
      </Card>

      {fh.seasons.length > 0 && (
        <Card title="Season by Season" accent="text-slate-200">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide text-slate-500 border-b border-slate-800">
                  <th className="text-left py-1.5 pr-2">Season</th><th className="text-right px-1.5">GP</th><th className="text-right px-1.5">W</th><th className="text-right px-1.5">L</th><th className="text-right px-1.5">OTL</th><th className="text-right px-1.5">PTS</th><th className="text-right px-1.5">GF</th><th className="text-right px-1.5">GA</th><th className="text-right px-1.5">Finish</th><th className="text-right pl-1.5">Result</th>
                </tr>
              </thead>
              <tbody>
                {[...fh.seasons].reverse().map((s) => (
                  <tr key={s.season} className="border-b border-slate-800/50 text-slate-200">
                    <td className="py-1.5 pr-2 whitespace-nowrap font-medium">{s.season}</td>
                    <td className="text-right px-1.5 tabular-nums">{s.gp}</td>
                    <td className="text-right px-1.5 tabular-nums font-semibold">{s.wins}</td>
                    <td className="text-right px-1.5 tabular-nums">{s.losses}</td>
                    <td className="text-right px-1.5 tabular-nums">{s.otl}</td>
                    <td className="text-right px-1.5 tabular-nums font-semibold">{s.points}</td>
                    <td className="text-right px-1.5 tabular-nums">{s.gf}</td>
                    <td className="text-right px-1.5 tabular-nums">{s.ga}</td>
                    <td className="text-right px-1.5 tabular-nums text-slate-400">{s.finish ? `#${s.finish}` : "—"}</td>
                    <td className={`text-right pl-1.5 whitespace-nowrap ${s.playoffResult ? (RESULT_TONE[s.playoffResult] ?? "text-slate-400") : "text-slate-600"}`}>{s.playoffResult ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {awards.length > 0 && (
        <Card title="Individual Awards" accent="text-blue-400">
          <div className="divide-y divide-slate-800/60">
            {awards.sort((a, b) => b.season.localeCompare(a.season)).map((a) => {
              const p = a.playerId ? pMap.get(a.playerId) : null;
              const name = p ? cleanName(p.name) : a.playerName ? cleanName(a.playerName) : "—";
              return (
                <div key={a.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="text-xs text-slate-500 w-16 shrink-0">{a.season}</span>
                  <span className="text-[11px] text-amber-400/90 w-28 shrink-0">{AWARD_LABEL[a.category] ?? a.category}</span>
                  {p ? (
                    <Link href={`/players/${p.slug}`} className="text-sm font-semibold text-slate-100 hover:text-blue-400 flex-1 truncate">{name}</Link>
                  ) : (
                    <span className="text-sm font-semibold text-slate-100 flex-1 truncate">{name}</span>
                  )}
                  <span className="text-xs text-slate-400 whitespace-nowrap">{a.detail}</span>
                  <span className="text-[10px] text-slate-600">{a.league}</span>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
