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

  const Trophy = ({ n, label, seasons, tone, icon }: { n: number; label: string; seasons: string[]; tone: string; icon: string }) => (
    <div className="relative bg-slate-800/40 rounded-xl p-4 text-center overflow-hidden">
      <div className="text-2xl leading-none mb-1" aria-hidden>{icon}</div>
      <div className={`text-3xl font-black ${tone} ${n > 0 ? "" : "opacity-40"}`}>{n}</div>
      <div className="text-xs uppercase tracking-wide text-slate-400 mt-1">{label}</div>
      {seasons.length > 0 && <div className="text-[11px] text-slate-500 mt-1">{seasons.join(", ")}</div>}
    </div>
  );

  const at = fh.allTime;
  const pct = at.gp ? ((at.wins * 2 + at.otl) / (at.gp * 2) * 100).toFixed(1) : "0.0";

  const LC: Record<string, { val: string; bar: string }> = {
    amber: { val: "text-amber-300", bar: "bg-amber-400/70" },
    blue: { val: "text-blue-300", bar: "bg-blue-400/70" },
    sky: { val: "text-sky-300", bar: "bg-sky-400/70" },
    emerald: { val: "text-emerald-300", bar: "bg-emerald-400/70" },
    violet: { val: "text-violet-300", bar: "bg-violet-400/70" },
    rose: { val: "text-rose-300", bar: "bg-rose-400/70" },
  };
  const medalCls = (i: number) =>
    i === 0 ? "bg-amber-400/20 text-amber-300 ring-1 ring-amber-400/40"
      : i === 1 ? "bg-slate-300/15 text-slate-200 ring-1 ring-slate-400/30"
        : i === 2 ? "bg-orange-500/15 text-orange-300 ring-1 ring-orange-500/30"
          : "text-slate-500 ring-1 ring-transparent";

  const LeaderCard = ({ title, icon, rows, unit, color, bars = true }: { title: string; icon: string; rows: FranchiseLeader[]; unit: string; color: string; bars?: boolean }) => {
    const c = LC[color] ?? LC.blue;
    const max = rows.length ? Math.max(...rows.map((r) => r.value)) : 0;
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden">
        <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-slate-800/70 bg-slate-800/25">
          <span className="text-base leading-none" aria-hidden>{icon}</span>
          <span className="text-[11px] font-bold uppercase tracking-wide text-slate-300">{title}</span>
        </div>
        {rows.length === 0 ? (
          <p className="px-3.5 py-5 text-sm text-slate-600 text-center">—</p>
        ) : (
          <ol className="divide-y divide-slate-800/50">
            {rows.map((l, i) => {
              const w = bars && max > 0 ? Math.max(6, Math.round((l.value / max) * 100)) : 0;
              return (
                <li key={i} className={`px-3 py-2 ${i === 0 ? "bg-gradient-to-r from-amber-500/[0.06] to-transparent" : ""}`}>
                  <div className="flex items-center gap-2.5 text-sm">
                    <span className={`grid place-items-center w-5 h-5 shrink-0 rounded-full text-[10px] font-bold tabular-nums ${medalCls(i)}`}>{i + 1}</span>
                    {l.slug ? <Link href={`/players/${l.slug}`} className="flex-1 truncate hover:text-blue-400">{l.name}</Link> : <span className="flex-1 truncate">{l.name}</span>}
                    <span className={`tabular-nums font-bold ${i === 0 ? c.val : "text-slate-200"}`}>{l.display ?? l.value}{l.display ? null : <span className="text-slate-500 text-[10px] ml-0.5 font-normal">{unit}</span>}</span>
                  </div>
                  {bars && (
                    <div className="mt-1.5 ml-[30px] h-1 rounded-full bg-slate-800 overflow-hidden">
                      <div className={`h-full rounded-full ${c.bar}`} style={{ width: `${w}%` }} />
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-3">
        <Trophy n={champs.length} icon="🏆" label={champs.some((c) => c.league === "AHL") ? "Cups" : "Stanley Cups"} tone="text-amber-400" seasons={champs.map((c) => c.season)} />
        <Trophy n={runnersUp.length} icon="🥈" label="Finals Losses" tone="text-slate-300" seasons={runnersUp.map((c) => c.season)} />
        <Trophy n={presidents.length} icon="🎖️" label="Best Records" tone="text-green-400" seasons={presidents.map((c) => c.season)} />
      </div>

      <Card title="All-Time Record" accent="text-blue-400">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
          <div className="rounded-xl bg-slate-800/40 border border-slate-800/60 p-3.5">
            <div className="text-lg leading-none mb-1" aria-hidden>📅</div>
            <div className="text-2xl font-black text-white tabular-nums">{at.seasons}</div>
            <div className="text-[11px] uppercase tracking-wide text-slate-500 mt-0.5">Seasons</div>
          </div>
          <div className="rounded-xl bg-slate-800/40 border border-slate-800/60 p-3.5 sm:col-span-2">
            <div className="text-lg leading-none mb-1" aria-hidden>⚔️</div>
            <div className="text-2xl font-black text-white tabular-nums">{at.wins}-{at.losses}-{at.otl}</div>
            <div className="text-[11px] uppercase tracking-wide text-slate-500 mt-0.5">Record · {pct}%</div>
            <div className="mt-2 h-1.5 rounded-full bg-slate-900 overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-400" style={{ width: `${Math.min(100, Number(pct))}%` }} /></div>
          </div>
          <div className="rounded-xl bg-slate-800/40 border border-slate-800/60 p-3.5">
            <div className="text-lg leading-none mb-1" aria-hidden>⭐</div>
            <div className="text-2xl font-black text-white tabular-nums">{at.points}</div>
            <div className="text-[11px] uppercase tracking-wide text-slate-500 mt-0.5">Points</div>
          </div>
          <div className="rounded-xl bg-slate-800/40 border border-slate-800/60 p-3.5">
            <div className="text-lg leading-none mb-1" aria-hidden>🥅</div>
            <div className="text-2xl font-black text-white tabular-nums">{at.gf}<span className="text-slate-500 text-base">/</span>{at.ga}</div>
            <div className="text-[11px] uppercase tracking-wide text-slate-500 mt-0.5">GF / GA</div>
          </div>
        </div>
      </Card>

      <Card title="Franchise Leaders" accent="text-amber-400">
        <div className="space-y-5">
          <div>
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-300 mb-2.5"><span aria-hidden>🏒</span> Skaters</div>
            <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
              <LeaderCard title="Points" icon="📈" rows={fh.leaders.points} unit="P" color="amber" />
              <LeaderCard title="Goals" icon="🚨" rows={fh.leaders.goals} unit="G" color="rose" />
              <LeaderCard title="Assists" icon="🎯" rows={fh.leaders.assists} unit="A" color="blue" />
              <LeaderCard title="Games Played" icon="📅" rows={fh.leaders.games} unit="GP" color="violet" />
            </div>
          </div>
          <div className="border-t border-slate-800 pt-4">
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-300 mb-2.5"><span aria-hidden>🥅</span> Goalies</div>
            <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
              <LeaderCard title="Wins" icon="🏆" rows={fh.leaders.wins} unit="W" color="amber" />
              <LeaderCard title="Shutouts" icon="🧱" rows={fh.leaders.shutouts} unit="SO" color="sky" />
              <LeaderCard title="GAA · min 10 GP" icon="🛡️" rows={fh.leaders.gaa} unit="" color="emerald" bars={false} />
              <LeaderCard title="SV% · min 10 GP" icon="🧤" rows={fh.leaders.savePct} unit="" color="emerald" bars={false} />
            </div>
          </div>
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
