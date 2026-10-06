import type { ReactNode } from "react";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { notFound } from "next/navigation";
import PlayerAvatar from "@/components/playerAvatar";
import { cleanName } from "@/lib/playerName";
import { Card } from "@/components/ui";
import { salaryOf, fmtM } from "@/components/TeamRosterTable";
import { teamRetentionStatus } from "@/lib/cap";
import { deadMoneyForYear, CURRENT_SEASON_START, ltirRelief } from "@/lib/finance";
import { teamManagerLabel } from "@/lib/team-gm";
import ContractSection from "@/components/ContractSection";
import { teamStatTotals, type TeamStatTotal } from "@/lib/stats-server";

export const dynamic = "force-dynamic";

const SEASON = "2026-27";

const isDefPos = (pos = "") => pos.includes("D") && !(pos.includes("C") || pos.includes("W") || pos.includes("F"));

const fmtStripDate = (d: Date | null) => (d ? d.toLocaleDateString("sk-SK", { day: "numeric", month: "short" }) : "—");

export default async function TeamHomePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const cfg = await prisma.leagueConfig.findUnique({ where: { id: 1 } });
  const rosterSource = cfg?.rosterMode === "real" ? "real" : "profinhl";
  const capCeiling = cfg ? (rosterSource === "real" ? cfg.realCapUpper : cfg.profinhlCapUpper) : 85_900_000;

  const team = await prisma.team.findUnique({
    where: { slug },
    include: {
      // rosterType-filtered — a player parked as PROSPECT/UFA/RETIRED/RELEASED keeps
      // this teamId (schema requires one) but must never count toward roster size,
      // cap total, captains or injured list once he's off the active roster.
      players: { where: { rosterType: { in: ["NHL", "AHL"] } }, orderBy: { overall: "desc" }, select: { id: true, rosterType: true, isGoalie: true, position: true, age: true, capHit: true, contractYears: true, retainedSalary: true, contractText: true, name: true, slug: true, photoUrl: true, captaincy: true, nationality: true, injuryDaysLeft: true, condition: true, injuryDesc: true } },
      // NOT counted in players above (deliberately excluded from roster size/cap) — an
      // RFA-age player benched at regular-season opening day for staying unsigned
      // (sweepUnsignedRfasToNonRoster). Fetched separately just for a visibility count.
      _count: { select: { players: { where: { rosterType: "NONROSTER" } } } },
      prospects: { where: { source: rosterSource }, select: { id: true, name: true, position: true, draftYear: true } },
      // same rosterType filter as the parent's own `players` above — a released/
      // waived/prospect-parked farm player keeps this teamId too, and must not
      // keep counting toward the farm size after he's off the active AHL roster.
      affiliateTeams: { select: { id: true, name: true, slug: true, logoUrl: true, code: true, players: { where: { rosterType: "AHL" }, select: { id: true } } } },
      parentTeam: true,
      headCoach: { select: { name: true } },
    },
  });
  if (!team) return notFound();

  const isNhl = team.league === "NHL" && !team.isAffiliate;
  const [retention, buyouts] = await Promise.all([
    isNhl ? teamRetentionStatus(team.id) : Promise.resolve(null),
    isNhl ? prisma.buyout.findMany({ where: { teamId: team.id }, select: { perYear: true, startYear: true, years: true } }) : Promise.resolve([]),
  ]);
  const proCount = team.players.length;
  const farmCount = team.affiliateTeams.reduce((s, a) => s + a.players.length, 0);
  // Cap purposes: NHL roster only (farm salaries never count against the NHL
  // cap) plus dead money from buyouts and retained-salary trades — same figure
  // as the team's own Salary Cap page, so the two never disagree.
  const nhlPlayers = team.players.filter((p) => p.rosterType === "NHL");
  const nhlSalaries = nhlPlayers.reduce((s, p) => s + Math.max(0, salaryOf(p) - (p.retainedSalary ?? 0)), 0);
  const deadMoney = deadMoneyForYear(buyouts, CURRENT_SEASON_START);
  const totalCap = nhlSalaries + deadMoney;
  const ltir = isNhl ? ltirRelief(nhlPlayers.map((p) => ({ ...p, capHit: Math.max(0, salaryOf(p) - (p.retainedSalary ?? 0)) }))) : 0;
  const effectiveCeiling = capCeiling + ltir;
  const capSpace = capCeiling - totalCap;
  const effectiveSpace = effectiveCeiling - totalCap;
  const capPct = Math.min(100, effectiveCeiling ? (totalCap / effectiveCeiling) * 100 : 0);
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
  const [skAgg, gRows, teamGames, allTeamStats, foAgg, recentGames, nextGames] = await Promise.all([
    prisma.playerGameStat.groupBy({ by: ["playerId"], where: gWhere, _sum: { goals: true, assists: true, points: true, pim: true, plusMinus: true } }),
    prisma.goalieGameStat.findMany({ where: gWhere, select: { playerId: true, started: true, saves: true, shotsAgainst: true, decision: true } }),
    prisma.game.findMany({ where: { season: SEASON, status: "FINAL", seriesId: null, OR: [{ homeTeamId: team.id }, { awayTeamId: team.id }] }, select: { id: true, homeTeamId: true, awayTeamId: true, homeGoals: true, awayGoals: true, homeShots: true, awayShots: true, endedIn: true, winnerTeamId: true } }),
    teamStatTotals(SEASON, team.league ?? "NHL").catch(() => []),
    prisma.playerGameStat.aggregate({ where: gWhere, _sum: { faceoffWins: true, faceoffLosses: true } }),
    prisma.game.findMany({
      where: { season: SEASON, league: team.league ?? "NHL", status: "FINAL", seriesId: null, OR: [{ homeTeamId: team.id }, { awayTeamId: team.id }] },
      orderBy: [{ gameDate: "desc" }, { id: "desc" }],
      take: 3,
      include: {
        homeTeam: { select: { id: true, code: true, name: true, logoUrl: true } },
        awayTeam: { select: { id: true, code: true, name: true, logoUrl: true } },
      },
    }),
    prisma.game.findMany({
      where: { season: SEASON, league: team.league ?? "NHL", status: "SCHEDULED", seriesId: null, OR: [{ homeTeamId: team.id }, { awayTeamId: team.id }] },
      orderBy: [{ gameDate: "asc" }, { id: "asc" }],
      take: 3,
      include: {
        homeTeam: { select: { id: true, code: true, name: true, logoUrl: true } },
        awayTeam: { select: { id: true, code: true, name: true, logoUrl: true } },
      },
    }),
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

  const leaderOf = (top: { pid: number; val: number } | null, signed = false) => {
    if (!top) return { value: "0" };
    if (signed) {
      if (top.val > 0) return { pid: top.pid, value: <span className="text-emerald-400">+{top.val}</span> };
      if (top.val < 0) return { pid: top.pid, value: <span className="text-rose-400">{top.val}</span> };
      return { pid: top.pid, value: <span className="text-slate-400">0</span> };
    }
    return { pid: top.pid, value: String(top.val) };
  };

  const leaders: { label: string; pid?: number; value: ReactNode }[] = [
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

  // Expanded Team Stats & League Rankings
  const teamStats = allTeamStats.find((t) => t.teamId === team.id);
  const getLeagueRank = (key: keyof TeamStatTotal, higherIsBetter = true) => {
    if (!allTeamStats.length || !teamStats) return null;
    const sorted = [...allTeamStats].sort((a, b) => {
      const va = Number(a[key]) || 0;
      const vb = Number(b[key]) || 0;
      return higherIsBetter ? vb - va : va - vb;
    });
    const idx = sorted.findIndex((t) => t.teamId === team.id);
    return idx >= 0 ? idx + 1 : null;
  };
  const ord = (n: number | null) => {
    if (!n) return "";
    const s = ["th", "st", "nd", "rd"], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };
  const rankPP = getLeagueRank("ppPct", true);
  const rankPK = getLeagueRank("pkPct", true);
  const rankGF = getLeagueRank("gfPerGame", true);
  const rankGA = getLeagueRank("gaPerGame", false);

  const fWins = foAgg._sum.faceoffWins ?? 0;
  const fLoss = foAgg._sum.faceoffLosses ?? 0;
  const fTotal = fWins + fLoss;
  const foPct = fTotal > 0 ? `${((fWins / fTotal) * 100).toFixed(1)}%` : "—";

  let homeW = 0, homeL = 0, homeOtl = 0;
  let awayW = 0, awayL = 0, awayOtl = 0;
  for (const g of teamGames) {
    const isHome = g.homeTeamId === team.id;
    const won = g.winnerTeamId === team.id;
    const ot = g.endedIn && g.endedIn !== "REG";
    if (isHome) {
      if (won) homeW++;
      else if (ot) homeOtl++;
      else homeL++;
    } else {
      if (won) awayW++;
      else if (ot) awayOtl++;
      else awayL++;
    }
  }
  const homeRecord = `${homeW}-${homeL}-${homeOtl}`;
  const awayRecord = `${awayW}-${awayL}-${awayOtl}`;

  const scheduleStrip = [...[...recentGames].reverse(), ...nextGames];

  return (
    <div className="space-y-6">
      {/* TÍMOVÝ KALENDÁR / ROZPIS */}
      {scheduleStrip.length > 0 && (
        <Card title="Tímový rozpis & Kalendár" accent="text-amber-400" right={<Link href={`/teams/${slug}/schedule`} className="text-xs text-slate-400 hover:text-blue-400">Celý rozpis sezóny →</Link>}>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
            {scheduleStrip.map((g) => {
              const isHome = g.homeTeamId === team.id;
              const opp = isHome ? g.awayTeam : g.homeTeam;
              const isFinal = g.status === "FINAL";
              const won = g.winnerTeamId === team.id;
              const ot = g.endedIn && g.endedIn !== "REG";
              const result: "W" | "L" | "OTL" = won ? "W" : ot ? "OTL" : "L";
              const myGoals = isHome ? g.homeGoals : g.awayGoals;
              const oppGoals = isHome ? g.awayGoals : g.homeGoals;
              const isNext = !isFinal && g.id === nextGames[0]?.id;

              return (
                <div
                  key={g.id}
                  className={`relative rounded-xl p-3 flex flex-col justify-between transition-all group ${
                    isNext
                      ? "bg-gradient-to-b from-amber-950/30 to-slate-950 border-2 border-amber-500/60 shadow-lg shadow-amber-950/30"
                      : "bg-slate-950/70 border border-slate-800/80 hover:border-slate-700"
                  }`}
                >
                  {isNext && (
                    <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-amber-500 text-black text-[9px] font-black uppercase tracking-wider px-2 py-0.2 rounded-full shadow">
                      NAJBLIŽŠÍ
                    </span>
                  )}
                  <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono mb-2">
                    <span className={isNext ? "text-amber-300 font-bold" : ""}>{fmtStripDate(g.gameDate)}</span>
                    {isFinal && (
                      <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider border ${
                        result === "W"
                          ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                          : result === "OTL"
                          ? "bg-amber-500/15 border-amber-500/30 text-amber-400"
                          : "bg-rose-500/15 border-rose-500/30 text-rose-400"
                      }`}>
                        {result}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 my-1">
                    <span className="text-xs text-slate-500 font-medium">{isHome ? "vs" : "@"}</span>
                    {opp.logoUrl && <img src={opp.logoUrl} alt="" className="w-6 h-6 object-contain" />}
                    <span className="font-bold text-sm text-white truncate">{opp.code || opp.name}</span>
                  </div>

                  <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                    {isFinal ? (
                      <>
                        <span className={`font-mono font-black tabular-nums ${result === "W" ? "text-emerald-400" : "text-rose-400"}`}>
                          {myGoals} – {oppGoals} {ot ? (g.endedIn ?? "OT") : ""}
                        </span>
                        <Link href={`/games/${g.id}`} className="text-[10px] text-slate-500 group-hover:text-sky-400">
                          Detail →
                        </Link>
                      </>
                    ) : (
                      <span className="text-[10px] text-slate-500">
                        {isHome ? "Doma" : "Vonku"}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

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

          {/* ROZŠÍRENÉ TÍMOVÉ ŠTATISTIKY */}
          <Card title="Team Stats (Tímové štatistiky)" accent="text-blue-400" right={<Link href={`/teams/${slug}/stats`} className="text-xs text-slate-400 hover:text-blue-400">Podrobné štatistiky hráčov →</Link>}>
            <div className="space-y-4">
              {/* Kľúčové ukazovatele s ligovým poradím */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 text-center">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Presilovky (PP%)</span>
                  <span className="text-xl font-black text-amber-400 tabular-nums">
                    {teamStats ? `${teamStats.ppPct.toFixed(1)}%` : "—"}
                  </span>
                  <div className="flex items-center justify-center gap-1.5 mt-0.5">
                    <span className="text-[10px] font-mono text-slate-400">
                      {teamStats ? `${teamStats.ppGoals}/${teamStats.ppOpp} PPG` : ""}
                    </span>
                    {rankPP && (
                      <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20">
                        {ord(rankPP)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 text-center">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Oslabenia (PK%)</span>
                  <span className="text-xl font-black text-sky-400 tabular-nums">
                    {teamStats ? `${teamStats.pkPct.toFixed(1)}%` : "—"}
                  </span>
                  <div className="flex items-center justify-center gap-1.5 mt-0.5">
                    <span className="text-[10px] font-mono text-slate-400">
                      {teamStats ? `${Math.max(0, teamStats.timesSh - teamStats.ppGoalsAgainst)}/${teamStats.timesSh} PK` : ""}
                    </span>
                    {rankPK && (
                      <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20">
                        {ord(rankPK)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 text-center">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Góly / zápas (GF/G)</span>
                  <span className="text-xl font-black text-white tabular-nums">
                    {teamStats ? teamStats.gfPerGame.toFixed(2) : per(gf)}
                  </span>
                  <div className="flex items-center justify-center gap-1.5 mt-0.5">
                    <span className="text-[10px] font-mono text-slate-400">{gf} gólov</span>
                    {rankGF && (
                      <span className="text-[10px] text-slate-300 font-bold bg-slate-800 px-1.5 py-0.2 rounded">
                        {ord(rankGF)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 text-center">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Inkasované / zápas (GA/G)</span>
                  <span className="text-xl font-black text-emerald-400 tabular-nums">
                    {teamStats ? teamStats.gaPerGame.toFixed(2) : per(ga)}
                  </span>
                  <div className="flex items-center justify-center gap-1.5 mt-0.5">
                    <span className="text-[10px] font-mono text-slate-400">{ga} inkasovaných</span>
                    {rankGA && (
                      <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20">
                        {ord(rankGA)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Detailné 3 bloky */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-1">
                {/* Blok A: Ofenzíva */}
                <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5">
                    <span className="text-xs font-bold text-amber-400 uppercase tracking-wide flex items-center gap-1.5">
                      <span>🏒</span> Ofenzíva & Streľba
                    </span>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Strely na bránu (SF):</span>
                      <span className="font-mono font-bold text-white">{sf} <span className="text-[10px] text-slate-500 font-normal">({per(sf)}/gm)</span></span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Úspešnosť streľby (SH%):</span>
                      <span className="font-mono font-bold text-white">{sf > 0 ? `${((gf / sf) * 100).toFixed(1)}%` : "—"}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Góly v oslabení (SHG):</span>
                      <span className="font-mono font-bold text-white">{teamStats?.shGoals ?? 0}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Očakávané góly (xGF/60):</span>
                      <span className="font-mono font-bold text-sky-400">{teamStats?.xgf60 ? teamStats.xgf60.toFixed(2) : "—"}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Nebezpečné šance (HDCF%):</span>
                      <span className="font-mono font-bold text-emerald-400">{teamStats?.hdcfPct ? `${teamStats.hdcfPct.toFixed(1)}%` : "—"}</span>
                    </div>
                  </div>
                </div>

                {/* Blok B: Defenzíva */}
                <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5">
                    <span className="text-xs font-bold text-sky-400 uppercase tracking-wide flex items-center gap-1.5">
                      <span>🛡️</span> Defenzíva & Brankári
                    </span>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Strely súpera (SA):</span>
                      <span className="font-mono font-bold text-white">{sa} <span className="text-[10px] text-slate-500 font-normal">({per(sa)}/gm)</span></span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Úspešnosť zákrokov (SV%):</span>
                      <span className="font-mono font-bold text-emerald-400">{sa > 0 ? `${(((sa - ga) / sa) * 100).toFixed(1)}%` : "—"}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Čisté kontá (Shutouts):</span>
                      <span className="font-mono font-bold text-white">{teamStats?.shutouts ?? 0}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Očak. inkasované (xGA/60):</span>
                      <span className="font-mono font-bold text-emerald-400">{teamStats?.xga60 ? teamStats.xga60.toFixed(2) : "—"}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Rozdiel gólov (DIFF):</span>
                      <span className={`font-mono font-bold ${gf - ga >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                        {gf - ga > 0 ? `+${gf - ga}` : gf - ga}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Blok C: Fyzická hra & Bilancia */}
                <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5">
                    <span className="text-xs font-bold text-emerald-400 uppercase tracking-wide flex items-center gap-1.5">
                      <span>⚖️</span> Fyzická hra & Bilancia
                    </span>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Vhadzovania (Faceoffs%):</span>
                      <span className="font-mono font-bold text-amber-400">{foPct}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Hity (Hits):</span>
                      <span className="font-mono font-bold text-white">
                        {teamStats?.hits ?? 0} <span className="text-[10px] text-slate-500 font-normal">({gp ? ((teamStats?.hits ?? 0) / gp).toFixed(1) : "0"}/gm)</span>
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Zblokované strely (Blocks):</span>
                      <span className="font-mono font-bold text-white">
                        {teamStats?.blocks ?? 0} <span className="text-[10px] text-slate-500 font-normal">({gp ? ((teamStats?.blocks ?? 0) / gp).toFixed(1) : "0"}/gm)</span>
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Trestné minúty (PIM):</span>
                      <span className="font-mono font-bold text-white">
                        {teamStats?.pim ?? 0} min <span className="text-[10px] text-slate-500 font-normal">({gp ? ((teamStats?.pim ?? 0) / gp).toFixed(1) : "0"}/gm)</span>
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Doma / Vonku (W-L-OTL):</span>
                      <span className="font-mono font-bold text-white">{homeRecord} / {awayRecord}</span>
                    </div>
                  </div>
                </div>
              </div>
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

          {/* Končiace zmluvy & Podpisovanie (priamo pod Maródkou) */}
          <ContractSection teamId={team.id} />

          <Card title="Team Info" accent="text-blue-400">
            <div className="space-y-2.5">
              <InfoRow label="General Manager" value={teamManagerLabel(team)} />
              <InfoRow label="Head Coach" value={<Link href={`/teams/${slug}/coach`} className="hover:text-blue-400">{team.headCoach?.name || team.coach || "TBD"} <span className="text-slate-500 text-xs">· manage</span></Link>} />
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
              <span className="text-xs text-slate-500">
                of {fmtM(capCeiling)} {ltir > 0 && <span className="text-sky-400 font-semibold">(+{fmtM(ltir)} LTIR)</span>}
              </span>
            </div>
            <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
              <div className={`h-full ${totalCap > effectiveCeiling ? "bg-red-500" : (totalCap / effectiveCeiling) >= 0.9 ? "bg-amber-500" : "bg-green-500"}`} style={{ width: `${capPct}%` }} />
            </div>
            <div className="mt-3 space-y-2">
              <InfoRow
                label={ltir > 0 ? "Call-up space (LTIR)" : "Cap space"}
                value={
                  <span className={effectiveSpace < 0 ? "text-red-400 font-semibold" : "text-green-400 font-semibold"}>
                    {fmtM(effectiveSpace)}
                  </span>
                }
              />
              <InfoRow label="Ceiling" value={ltir > 0 ? `${fmtM(capCeiling)} (+${fmtM(ltir)} LTIR)` : fmtM(capCeiling)} />
              {retention && (
                <>
                  <InfoRow label="Retention slots" value={
                    <span className={retention.slotsOutUsed + retention.slotsInUsed >= retention.slotsMax ? "text-red-400" : "text-slate-200"}>
                      {retention.slotsOutUsed + retention.slotsInUsed}/{retention.slotsMax} <span className="text-slate-500 text-xs">({retention.slotsOutUsed} out, {retention.slotsInUsed} in)</span>
                    </span>
                  } />
                  <InfoRow label="Retention % of cap" value={
                    <span className={retention.pctOfCap >= retention.pctMax ? "text-red-400" : "text-slate-200"}>{retention.pctOfCap.toFixed(1)}% <span className="text-slate-500">/ {retention.pctMax}%</span></span>
                  } />
                </>
              )}
            </div>
          </Card>

          <Card title="Roster Info" accent="text-blue-400">
            <div className="space-y-2.5">
              <InfoRow label="Total players" value={`${proCount + farmCount} players`} />
              <InfoRow label="Pro roster" value={`${proCount} players`} />
              {farmCount > 0 && (
                <InfoRow label="Farm" value={
                  team.affiliateTeams[0] ? (
                    <Link href={`/teams/${team.affiliateTeams[0].slug}`} className="hover:text-blue-400">
                      {farmCount} players <span className="text-slate-500 text-xs">· {team.affiliateTeams[0].name}</span>
                    </Link>
                  ) : `${farmCount} players`
                } />
              )}
              {team._count.players > 0 && (
                <InfoRow label="Non-roster" value={
                  <Link href={`/teams/${team.slug}/contracts`} className="text-amber-400 hover:text-amber-300">
                    {team._count.players} unsigned RFA{team._count.players === 1 ? "" : "s"} →
                  </Link>
                } />
              )}
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
                    <Link href={`/players/${c.slug}`} className="flex-1 truncate text-white hover:text-blue-400">{cleanName(c.name)}</Link>
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

function LeaderTile({ label, player, value }: { label: string; player?: { name: string; slug: string; photoUrl: string | null; position: string }; value: ReactNode }) {
  return (
    <div className="bg-slate-800/40 rounded-xl overflow-hidden border-b-2 border-yellow-500/70">
      <div className="flex items-stretch">
        <div className="w-20 h-20 shrink-0 bg-slate-800/60 flex items-center justify-center">
          <PlayerAvatar src={player?.photoUrl ?? null} alt={player?.name ?? ""} size={72} />
        </div>
        <div className="flex-1 min-w-0 p-3 flex flex-col justify-center">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
          {player ? (
            <Link href={`/players/${player.slug}`} className="text-sm font-semibold text-white hover:text-blue-400 transition-colors truncate block">{cleanName(player.name)}</Link>
          ) : <span className="text-sm text-slate-500">—</span>}
          <p className="text-2xl font-black leading-none mt-1 text-white">{value}</p>
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
