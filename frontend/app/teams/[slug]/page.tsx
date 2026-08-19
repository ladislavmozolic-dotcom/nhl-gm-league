import type { ReactNode } from "react";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { notFound } from "next/navigation";
import PlayerAvatar from "@/components/playerAvatar";
import { cleanName } from "@/lib/playerName";
import { Card } from "@/components/ui";
import { salaryOf, fmtM } from "@/components/TeamRosterTable";

const SEASON = "2026-27";

const isDefPos = (pos = "") => pos.includes("D") && !(pos.includes("C") || pos.includes("W") || pos.includes("F"));

export default async function TeamHomePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const cfg = await prisma.leagueConfig.findUnique({ where: { id: 1 } });
  const rosterSource = cfg?.rosterMode === "real" ? "real" : "profinhl";
  const capCeiling = cfg ? (rosterSource === "real" ? cfg.realCapUpper : cfg.profinhlCapUpper) : 85_900_000;

  const team = await prisma.team.findUnique({
    where: { slug },
    include: {
      players: { orderBy: { overall: "desc" }, select: { id: true, isGoalie: true, position: true, age: true, capHit: true, contractText: true, name: true, slug: true, photoUrl: true, captaincy: true, nationality: true, injuryDaysLeft: true, injuryDesc: true } },
      prospects: { where: { source: rosterSource }, select: { id: true, name: true, position: true, draftYear: true } },
      affiliateTeams: { select: { id: true, name: true, slug: true, logoUrl: true, code: true, players: { select: { id: true } } } },
      parentTeam: true,
      headCoach: { select: { name: true } },
    },
  });
  if (!team) return notFound();

  const isNhl = team.league === "NHL" && !team.isAffiliate;
  const proCount = team.players.length;
  const farmCount = team.affiliateTeams.reduce((s, a) => s + a.players.length, 0);
  const totalCap = team.players.reduce((s, p) => s + salaryOf(p), 0);
  const capSpace = capCeiling - totalCap;
  const capPct = Math.min(100, capCeiling ? (totalCap / capCeiling) * 100 : 0);
  const avgAge = proCount ? (team.players.reduce((s, p) => s + (p.age || 0), 0) / proCount).toFixed(1) : "0";
  const captains = team.players.filter((p) => p.captaincy === "C" || p.captaincy === "A").sort((a) => (a.captaincy === "C" ? -1 : 1));
  const injured = team.players.filter((p) => (p.injuryDaysLeft ?? 0) > 0).sort((a, b) => (b.injuryDaysLeft ?? 0) - (a.injuryDaysLeft ?? 0));

  const gmLinks = [
    ["Rosters (GM)", `/teams/${team.slug}/rosters`],
    ["Line Editor (GM)", `/teams/${team.slug}/lines`],
    ["Roster (GM)", `/teams/${team.slug}/roster/edit`],
    ["Finance (GM)", `/teams/${team.slug}/finance`],
  ];

  // ===== leaders + team stats (this team, regular season) =====
  const gWhere = { teamId: team.id, game: { season: SEASON, status: "FINAL", seriesId: null } } as const;
  const [skAgg, gRows, teamGames] = await Promise.all([
    prisma.playerGameStat.groupBy({ by: ["playerId"], where: gWhere, _sum: { goals: true, assists: true, points: true, pim: true, plusMinus: true } }),
    prisma.goalieGameStat.findMany({ where: gWhere, select: { playerId: true, started: true, saves: true, shotsAgainst: true, decision: true } }),
    prisma.game.findMany({ where: { season: SEASON, status: "FINAL", seriesId: null, OR: [{ homeTeamId: team.id }, { awayTeamId: team.id }] }, select: { homeTeamId: true, homeGoals: true, awayGoals: true, homeShots: true, awayShots: true } }),
  ]);
  const leaderIds = [...new Set([...skAgg.map((s) => s.playerId), ...gRows.map((r) => r.playerId)])];
  const leaderPlayers = leaderIds.length ? await prisma.player.findMany({ where: { id: { in: leaderIds } }, select: { id: true, name: true, slug: true, photoUrl: true, position: true } }) : [];
  const pById = new Map(leaderPlayers.map((p) => [p.id, p]));

  const topSk = (key: "goals" | "assists" | "points" | "pim" | "plusMinus", filter?: (pid: number) => boolean) => {
    let best: { pid: number; val: number } | null = null;
    for (const s of skAgg) {
      if (filter && !filter(s.playerId)) continue;
      const v = (s._sum as any)[key] ?? 0;
      if (!best || v > best.val) best = { pid: s.playerId, val: v };
    }
    return best;
  };
  const gByPlayer = new Map<number, { gp: number; w: number; sv: number; sa: number }>();
  for (const r of gRows) {
    const g = gByPlayer.get(r.playerId) ?? { gp: 0, w: 0, sv: 0, sa: 0 };
    if (r.started) g.gp++; if (r.decision === "W") g.w++; g.sv += r.saves; g.sa += r.shotsAgainst;
    gByPlayer.set(r.playerId, g);
  }
  const topWins = [...gByPlayer.entries()].sort((a, b) => b[1].w - a[1].w)[0];
  const topSvp = [...gByPlayer.entries()].filter(([, g]) => g.sa > 0).sort((a, b) => b[1].sv / b[1].sa - a[1].sv / a[1].sa)[0];

  const leaderOf = (top: { pid: number; val: number } | null, signed = false) =>
    top ? { pid: top.pid, value: signed && top.val > 0 ? `+${top.val}` : String(top.val) } : { value: "0" };

  const leaders: { label: string; pid?: number; value: string }[] = [
    { label: "Goals", ...leaderOf(topSk("goals")) },
    { label: "Assists", ...leaderOf(topSk("assists")) },
    { label: "Points", ...leaderOf(topSk("points")) },
    { label: "Defenseman", ...leaderOf(topSk("points", (pid) => isDefPos(pById.get(pid)?.position))) },
    { label: "PIM", ...leaderOf(topSk("pim")) },
    { label: "+/-", ...leaderOf(topSk("plusMinus"), true) },
    { label: "Wins", pid: topWins?.[0], value: topWins ? String(topWins[1].w) : "0" },
    { label: "SV%", pid: topSvp?.[0], value: topSvp ? (100 * topSvp[1].sv / topSvp[1].sa).toFixed(1) + "%" : "—" },
  ];

  let gf = 0, ga = 0, sf = 0, sa = 0;
  for (const g of teamGames) {
    const home = g.homeTeamId === team.id;
    gf += (home ? g.homeGoals : g.awayGoals) ?? 0;
    ga += (home ? g.awayGoals : g.homeGoals) ?? 0;
    sf += (home ? g.homeShots : g.awayShots) ?? 0;
    sa += (home ? g.awayShots : g.homeShots) ?? 0;
  }
  const gp = teamGames.length;
  const per = (v: number) => (gp ? (v / gp).toFixed(1) : "—");

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* MAIN — leaders + team stats */}
        <div className="lg:col-span-8 space-y-6">
          <Card title="Team Leaders" accent="text-blue-400">
            {gp === 0 ? (
              <p className="text-sm text-slate-500 py-4 text-center">Leaders appear after games are simulated.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {leaders.map((l) => <LeaderTile key={l.label} label={l.label} player={l.pid ? pById.get(l.pid) : undefined} value={l.value} />)}
              </div>
            )}
          </Card>

          <Card title="Team Stats" accent="text-blue-400">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <MiniMetric label="Games" value={String(gp)} />
              <MiniMetric label="Goals For" value={String(gf)} sub={`${per(gf)} / gm`} color="text-green-400" />
              <MiniMetric label="Goals Against" value={String(ga)} sub={`${per(ga)} / gm`} color="text-red-400" />
              <MiniMetric label="Goal Diff" value={gf - ga > 0 ? `+${gf - ga}` : String(gf - ga)} color={gf - ga >= 0 ? "text-green-400" : "text-red-400"} />
              <MiniMetric label="Shots For" value={String(sf)} sub={`${per(sf)} / gm`} />
              <MiniMetric label="Shots Against" value={String(sa)} sub={`${per(sa)} / gm`} />
              <MiniMetric label="Avg Age" value={String(avgAge)} />
              <MiniMetric label="Players" value={String(proCount)} />
            </div>
          </Card>
        </div>

        {/* SIDEBAR */}
        <div className="lg:col-span-4 space-y-6">
          <Card title="🏥 Injury Report" accent="text-red-400">
            {injured.length === 0 ? (
              <p className="text-sm text-slate-500 py-3 text-center">No injuries — full strength.</p>
            ) : (
              <div className="space-y-2">
                {injured.map((p) => (
                  <div key={p.id} className="flex items-center gap-2.5">
                    <span className="text-xs text-slate-500 w-9 shrink-0 text-center">{p.position}</span>
                    <Link href={`/players/${p.slug}`} className="text-sm font-medium text-slate-200 hover:text-blue-400 truncate flex-1">{cleanName(p.name)}</Link>
                    <span className="text-[11px] text-red-300/90 truncate max-w-[130px] text-right">{p.injuryDesc || "Injured"}</span>
                    <span className="text-[11px] font-semibold text-red-400 tabular-nums w-10 text-right shrink-0">{p.injuryDaysLeft}d</span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card title="Team Info" accent="text-blue-400">
            <div className="space-y-2.5">
              <InfoRow label="General Manager" value={team.passwordHash ? (team.gmNickname || [team.gmFirstName, team.gmLastName].filter(Boolean).join(" ").trim() || team.gm) : "🤖 AI GM"} />
              <InfoRow label="Head Coach" value={team.headCoach?.name || team.coach || "TBD"} />
              <InfoRow label="Conference" value={team.conference || "N/A"} />
              <InfoRow label="Division" value={team.division || "N/A"} />
              <InfoRow label="Arena" value={team.arena} />
              <InfoRow label="Capacity" value={team.capacity ? team.capacity.toLocaleString() : "N/A"} />
              {team.parentTeam && <InfoRow label="Parent Club" value={<Link href={`/teams/${team.parentTeam.slug}`} className="text-blue-400 hover:underline">{team.parentTeam.name}</Link>} />}
            </div>
            {isNhl && (
              <div className="flex flex-wrap gap-1.5 mt-4 pt-4 border-t border-slate-800">
                {gmLinks.map(([l, h]) => (
                  <Link key={h} href={h} className="px-2.5 py-1 rounded-lg bg-slate-800/70 hover:bg-slate-700 text-slate-200 text-[10px] font-bold uppercase tracking-wider border border-slate-600/40 transition-colors">{l}</Link>
                ))}
              </div>
            )}
          </Card>

          <Card title="Salary Cap" accent="text-green-400" right={<Link href={`/teams/${slug}/salary`} className="text-xs text-slate-400 hover:text-blue-400">details →</Link>}>
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-lg font-black">{fmtM(totalCap)}</span>
              <span className="text-xs text-slate-500">of {fmtM(capCeiling)}</span>
            </div>
            <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
              <div className={`h-full ${capPct >= 100 ? "bg-red-500" : capPct >= 90 ? "bg-amber-500" : "bg-green-500"}`} style={{ width: `${capPct}%` }} />
            </div>
            <div className="mt-3 space-y-2">
              <InfoRow label="Cap space" value={<span className={capSpace < 0 ? "text-red-400" : "text-green-400"}>{fmtM(Math.abs(capSpace))}</span>} />
              <InfoRow label="Ceiling" value={fmtM(capCeiling)} />
            </div>
          </Card>

          <Card title="Roster Info" accent="text-blue-400">
            <div className="space-y-2.5">
              <InfoRow label="Pro roster" value={`${proCount} players`} />
              {farmCount > 0 && <InfoRow label="Farm" value={`${farmCount} players`} />}
              <InfoRow label="Prospects" value={String(team.prospects.length)} />
              <InfoRow label="Avg age" value={String(avgAge)} />
            </div>
          </Card>

          {captains.length > 0 && (
            <Card title="Leadership" accent="text-yellow-400">
              <div className="space-y-2">
                {captains.map((c) => (
                  <div key={c.id} className="flex items-center gap-2 text-sm">
                    <PlayerAvatar src={c.photoUrl} alt={c.name} size={28} />
                    <Link href={`/players/${c.slug}`} className="flex-1 truncate hover:text-blue-400">{cleanName(c.name)}</Link>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${c.captaincy === "C" ? "bg-yellow-500/20 text-yellow-400" : "bg-slate-600/30 text-slate-300"}`}>{c.captaincy}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {team.prospects.length > 0 && (
            <Card title="Top Prospects" accent="text-blue-400" right={<Link href={`/teams/${slug}/prospects`} className="text-xs text-slate-400 hover:text-blue-400">all →</Link>}>
              <div className="space-y-2">
                {team.prospects.slice(0, 6).map((pr) => (
                  <div key={pr.id} className="flex items-center justify-between text-sm">
                    <span className="truncate">{cleanName(pr.name)} <span className="text-slate-500 text-xs">{pr.position || ""}</span></span>
                    <span className="text-slate-500 text-xs">{pr.draftYear || ""}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function LeaderTile({ label, player, value }: { label: string; player?: { name: string; slug: string; photoUrl: string | null; position: string }; value: string }) {
  return (
    <div className="bg-slate-800/40 rounded-xl overflow-hidden border-b-2 border-yellow-500/70">
      <div className="flex items-stretch">
        <div className="w-20 h-20 shrink-0 bg-slate-800/60 flex items-center justify-center">
          <PlayerAvatar src={player?.photoUrl ?? null} alt={player?.name ?? ""} size={72} />
        </div>
        <div className="flex-1 min-w-0 p-3 flex flex-col justify-center">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
          {player ? (
            <Link href={`/players/${player.slug}`} className="text-sm font-semibold hover:text-blue-400 transition-colors truncate block">{cleanName(player.name)}</Link>
          ) : <span className="text-sm text-slate-500">—</span>}
          <p className="text-2xl font-black leading-none mt-1">{value}</p>
        </div>
      </div>
    </div>
  );
}

function MiniMetric({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-slate-800/40 rounded-xl p-3">
      <p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`text-xl font-black leading-none mt-1 ${color ?? "text-white"}`}>{value}</p>
      {sub && <p className="text-[10px] text-slate-500 mt-1">{sub}</p>}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold text-white text-right truncate">{value}</span>
    </div>
  );
}
