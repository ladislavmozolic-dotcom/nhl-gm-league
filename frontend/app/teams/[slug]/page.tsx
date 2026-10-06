import type { ReactNode } from "react";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { notFound } from "next/navigation";
import PlayerAvatar from "@/components/playerAvatar";
import { cleanName, epProfileUrl } from "@/lib/playerName";
import { salaryOf, fmtM } from "@/components/TeamRosterTable";
import { teamRetentionStatus, teamCapStatus } from "@/lib/cap";
import { deadMoneyForYear, CURRENT_SEASON_START, ltirRelief } from "@/lib/finance";
import { teamManagerLabel } from "@/lib/team-gm";
import ExpiringContractsWidget from "@/components/ExpiringContractsWidget";
import TeamStandingsWidget from "@/components/TeamStandingsWidget";
import { teamStatTotals, type TeamStatTotal } from "@/lib/stats-server";
import { canManageTeam } from "@/lib/auth";
import { getLang } from "@/lib/lang-server";
import { computeStandings } from "@/lib/sim/standings";
import { projectProspect } from "@/lib/prospect-projection";

export const dynamic = "force-dynamic";

const SEASON = "2026-27";

const isDefPos = (pos = "") => pos.includes("D") && !(pos.includes("C") || pos.includes("W") || pos.includes("F"));

const fmtStripDate = (d: Date | null) => (d ? d.toLocaleDateString("sk-SK", { day: "numeric", month: "short" }) : "—");

const gradeBadgeStyle = (g: string) => {
  switch (g) {
    case "A":
      return "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";
    case "B":
      return "bg-sky-500/20 text-sky-300 border-sky-500/30";
    case "C":
      return "bg-violet-500/20 text-violet-300 border-violet-500/30";
    case "D":
      return "bg-amber-500/20 text-amber-300 border-amber-500/30";
    default:
      return "bg-slate-700/30 text-slate-400 border-slate-600/30";
  }
};

export default async function TeamHomePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const lang = await getLang();
  const isEn = lang !== "cs";
  const cfg = await prisma.leagueConfig.findUnique({ where: { id: 1 } });
  const rosterSource = cfg?.rosterMode === "real" ? "real" : "profinhl";
  const capCeiling = cfg ? (rosterSource === "real" ? cfg.realCapUpper : cfg.profinhlCapUpper) : 85_900_000;

  const team = await prisma.team.findUnique({
    where: { slug },
    include: {
      players: { where: { rosterType: { in: ["NHL", "AHL"] } }, orderBy: { overall: "desc" }, select: { id: true, rosterType: true, isGoalie: true, position: true, age: true, capHit: true, contractYears: true, retainedSalary: true, contractText: true, name: true, slug: true, photoUrl: true, captaincy: true, nationality: true, injuryDaysLeft: true, condition: true, injuryDesc: true } },
      _count: { select: { players: { where: { rosterType: "NONROSTER" } } } },
      prospects: {
        where: { source: rosterSource },
        include: {
          worldPlayer: {
            include: {
              currentTeam: { include: { league: true } },
              stats: { orderBy: [{ season: "desc" }, { gamesPlayed: "desc" }], include: { league: true } },
            },
          },
        },
      },
      affiliateTeams: { select: { id: true, name: true, slug: true, logoUrl: true, code: true, players: { where: { rosterType: "AHL" }, select: { id: true } } } },
      parentTeam: true,
      headCoach: { select: { name: true } },
    },
  });
  if (!team) return notFound();

  const isNhl = team.league === "NHL" && !team.isAffiliate;
  const [retention, buyouts, capStatus] = await Promise.all([
    isNhl ? teamRetentionStatus(team.id) : Promise.resolve(null),
    isNhl ? prisma.buyout.findMany({ where: { teamId: team.id }, select: { perYear: true, startYear: true, years: true } }) : Promise.resolve([]),
    isNhl ? teamCapStatus(team.id).catch(() => null) : Promise.resolve(null),
  ]);
  const proCount = team.players.length;
  const farmCount = team.affiliateTeams.reduce((s, a) => s + a.players.length, 0);

  const nhlPlayers = team.players.filter((p) => p.rosterType === "NHL");
  const nhlSalaries = nhlPlayers.reduce((s, p) => s + Math.max(0, salaryOf(p) - (p.retainedSalary ?? 0)), 0);
  const deadMoney = deadMoneyForYear(buyouts, CURRENT_SEASON_START);
  const totalCap = capStatus ? capStatus.committed : nhlSalaries + deadMoney;
  const ltir = capStatus ? capStatus.ltir : (isNhl ? ltirRelief(nhlPlayers.map((p) => ({ ...p, capHit: Math.max(0, salaryOf(p) - (p.retainedSalary ?? 0)) }))) : 0);
  const effectiveCeiling = capStatus ? capStatus.ceiling : capCeiling + ltir;
  const effectiveSpace = capStatus ? capStatus.strictSpace : effectiveCeiling - totalCap;
  const capPct = Math.min(100, effectiveCeiling ? (totalCap / effectiveCeiling) * 100 : 0);
  const avgAge = proCount ? (team.players.reduce((s, p) => s + (p.age || 0), 0) / proCount).toFixed(1) : "0";
  const captains = team.players.filter((p) => p.captaincy === "C" || p.captaincy === "A").sort((a) => (a.captaincy === "C" ? -1 : 1));
  const injured = team.players.filter((p) => (p.injuryDaysLeft ?? 0) > 0).sort((a, b) => (b.injuryDaysLeft ?? 0) - (a.injuryDaysLeft ?? 0));

  // Projected prospects sorted by projection score and draft
  const projectedProspects = team.prospects.map((pr) => {
    const proj = projectProspect({
      position: pr.position ?? pr.worldPlayer?.position,
      draftYear: pr.draftYear,
      overallPick: pr.overallPick,
      birthDate: pr.worldPlayer?.birthDate,
      stats: pr.worldPlayer?.stats,
      gradeOverride: pr.gradeOverride,
    });
    const round = pr.overallPick ? Math.ceil(pr.overallPick / 32) : null;
    const latestStat = pr.worldPlayer?.stats?.[0];
    return {
      id: pr.id,
      name: cleanName(pr.name),
      epUrl: pr.epUrl ?? epProfileUrl(pr.name),
      position: pr.position ?? pr.worldPlayer?.position ?? "—",
      draftYear: pr.draftYear,
      overallPick: pr.overallPick,
      round,
      undrafted: pr.undrafted,
      grade: proj.grade,
      score: proj.score,
      role: proj.role,
      eta: proj.eta,
      risk: proj.risk,
      teamName: pr.worldPlayer?.currentTeam?.name ?? null,
      leagueCode: pr.worldPlayer?.currentTeam?.league?.code ?? latestStat?.league?.code ?? null,
      latestStat: latestStat ? {
        gamesPlayed: latestStat.gamesPlayed,
        points: latestStat.points,
        savePercentage: latestStat.savePercentage,
        isGoalie: latestStat.isGoalie,
      } : null,
    };
  }).sort((a, b) => b.score - a.score || (b.draftYear ?? 0) - (a.draftYear ?? 0));

  const gmLinks = isEn
    ? [
        ["Rosters", `/teams/${team.slug}/rosters`],
        ["Lines", `/teams/${team.slug}/lines`],
        ["Edit Roster", `/teams/${team.slug}/roster/edit`],
        ["Finance", `/teams/${team.slug}/finance`],
      ]
    : [
        ["Zostava (Rosters)", `/teams/${team.slug}/rosters`],
        ["Formácie (Lines)", `/teams/${team.slug}/lines`],
        ["Upraviť súpisku", `/teams/${team.slug}/roster/edit`],
        ["Financie (Finance)", `/teams/${team.slug}/finance`],
      ];

  // ===== leaders + team stats (this team, regular season) =====
  const gWhere = { teamId: team.id, game: { season: SEASON, status: "FINAL", seriesId: null } } as const;
  const [skAgg, gRows, teamGames, allTeamStats, allFoAgg, recentGames, nextGames, standings, isGm, recentTransactions] = await Promise.all([
    prisma.playerGameStat.groupBy({ by: ["playerId"], where: gWhere, _sum: { goals: true, assists: true, points: true, pim: true, plusMinus: true } }),
    prisma.goalieGameStat.findMany({ where: gWhere, select: { playerId: true, started: true, saves: true, shotsAgainst: true, decision: true } }),
    prisma.game.findMany({ where: { season: SEASON, status: "FINAL", seriesId: null, OR: [{ homeTeamId: team.id }, { awayTeamId: team.id }] }, select: { id: true, homeTeamId: true, awayTeamId: true, homeGoals: true, awayGoals: true, homeShots: true, awayShots: true, endedIn: true, winnerTeamId: true } }),
    teamStatTotals(SEASON, team.league ?? "NHL").catch(() => []),
    prisma.playerGameStat.groupBy({
      by: ["teamId"],
      where: { game: { season: SEASON, league: team.league ?? "NHL", status: "FINAL", seriesId: null } },
      _sum: { faceoffWins: true, faceoffLosses: true },
    }),
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
    computeStandings(SEASON, team.league ?? "NHL").catch(() => []),
    canManageTeam(team.id),
    prisma.transaction.findMany({
      where: { OR: [{ teamId: team.id }, { message: { contains: team.name } }] },
      orderBy: { createdAt: "desc" },
      take: 3,
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

  const leaderOf = (top: { pid: number; val: number } | null, signed = false, isPoints = false) => {
    if (!top) return { value: "0" };
    if (signed) {
      if (top.val > 0) return { pid: top.pid, value: <span className="text-emerald-400">+{top.val}</span> };
      if (top.val < 0) return { pid: top.pid, value: <span className="text-rose-400">{top.val}</span> };
      return { pid: top.pid, value: <span className="text-slate-400">0</span> };
    }
    if (isPoints) {
      return { pid: top.pid, value: <span className="text-amber-400">{top.val}</span> };
    }
    return { pid: top.pid, value: String(top.val) };
  };

  const leaders: { label: string; pid?: number; value: ReactNode; sub?: string }[] = isEn
    ? [
        { label: "GOALS", ...leaderOf(topSk("goals")) },
        { label: "ASSISTS", ...leaderOf(topSk("assists")) },
        { label: "POINTS", ...leaderOf(topSk("points"), false, true) },
        { label: "DEFENSEMAN POINTS", ...leaderOf(topSk("points", (pid) => isDefPos(pById.get(pid)?.position))) },
        { label: "PENALTY MINUTES (PIM)", ...leaderOf(topSk("pim")) },
        { label: "PLUS / MINUS (+/-)", ...leaderOf(topSk("plusMinus"), true) },
        { label: "GOALIE WINS", pid: topWins?.[0], value: topWins ? String(topWins[1].w) : "0", sub: topWins ? `${topWins[1].gp} starts` : "" },
        { label: "SAVE % (SV%)", pid: topSvp?.[0], value: topSvp ? <span className="text-emerald-400">{(100 * topSvp[1].sv / topSvp[1].sa).toFixed(1)}%</span> : "—", sub: topSvp ? `${topSvp[1].sa} shots` : "" },
      ]
    : [
        { label: "GÓLY (GOALS)", ...leaderOf(topSk("goals")) },
        { label: "ASISTENCIE (ASSISTS)", ...leaderOf(topSk("assists")) },
        { label: "BODY (POINTS)", ...leaderOf(topSk("points"), false, true) },
        { label: "OBRANCA (DEFENSEMAN)", ...leaderOf(topSk("points", (pid) => isDefPos(pById.get(pid)?.position))) },
        { label: "TRESTNÉ MINÚTY (PIM)", ...leaderOf(topSk("pim")) },
        { label: "BILANCIA (+/-)", ...leaderOf(topSk("plusMinus"), true) },
        { label: "VÝHRY BRANKÁRA (WINS)", pid: topWins?.[0], value: topWins ? String(topWins[1].w) : "0", sub: topWins ? `${topWins[1].gp} štartov` : "" },
        { label: "ÚSPEŠNOSŤ (SV%)", pid: topSvp?.[0], value: topSvp ? <span className="text-emerald-400">{(100 * topSvp[1].sv / topSvp[1].sa).toFixed(1)}%</span> : "—", sub: topSvp ? `${topSvp[1].sa} striel` : "" },
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
  const getCustomRank = (valFn: (t: TeamStatTotal) => number, higherIsBetter = true) => {
    if (!allTeamStats.length || !teamStats) return null;
    const sorted = [...allTeamStats].sort((a, b) => {
      const va = valFn(a);
      const vb = valFn(b);
      return higherIsBetter ? vb - va : va - vb;
    });
    const idx = sorted.findIndex((t) => t.teamId === team.id);
    return idx >= 0 ? idx + 1 : null;
  };
  const ord = (n: number | null, isEnglish = isEn) => {
    if (!n) return "";
    if (!isEnglish) return `${n}.`;
    const s = ["th", "st", "nd", "rd"], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };

  const rankPP = getLeagueRank("ppPct", true);
  const rankPK = getLeagueRank("pkPct", true);
  const rankGF = getLeagueRank("gfPerGame", true);
  const rankGA = getLeagueRank("gaPerGame", false);

  // Blok A: Ofenzíva ranks
  const rankSF = getLeagueRank("sfPerGame", true);
  const rankSH = getCustomRank((t) => (t.shotsFor > 0 ? t.gf / t.shotsFor : 0), true);
  const rankSHG = getLeagueRank("shGoals", true);
  const rankXGF = getLeagueRank("xgf60", true);
  const rankHDCF = getLeagueRank("hdcfPct", true);

  // Blok B: Defenzíva ranks
  const rankSA = getLeagueRank("saPerGame", false);
  const rankSV = getCustomRank((t) => (t.shotsAgainst > 0 ? (t.shotsAgainst - t.ga) / t.shotsAgainst : 0), true);
  const rankSO = getLeagueRank("shutouts", true);
  const rankXGA = getLeagueRank("xga60", false);
  const rankDIFF = getLeagueRank("diff", true);

  // Blok C: Fyzická hra ranks
  const rankHits = getCustomRank((t) => (t.gp ? t.hits / t.gp : 0), true);
  const rankBlocks = getCustomRank((t) => (t.gp ? t.blocks / t.gp : 0), true);
  const rankPIM = getCustomRank((t) => (t.gp ? t.pim / t.gp : 0), false);

  // Faceoff calculation & ranking
  const thisTeamFo = allFoAgg.find((f) => f.teamId === team.id);
  const fWins = thisTeamFo?._sum.faceoffWins ?? 0;
  const fLoss = thisTeamFo?._sum.faceoffLosses ?? 0;
  const fTotal = fWins + fLoss;
  const foPct = fTotal > 0 ? `${((fWins / fTotal) * 100).toFixed(1)}%` : "—";

  const foMap = new Map<number, number>();
  for (const row of allFoAgg) {
    const w = row._sum.faceoffWins ?? 0;
    const l = row._sum.faceoffLosses ?? 0;
    const tot = w + l;
    foMap.set(row.teamId, tot > 0 ? w / tot : 0);
  }
  const sortedFo = [...foMap.entries()].sort((a, b) => b[1] - a[1]);
  const foIdx = sortedFo.findIndex(([tid]) => tid === team.id);
  const rankFO = foIdx >= 0 ? foIdx + 1 : null;

  const rankBadge = (rank: number | null) => {
    if (!rank) return null;
    const color = rank <= 10 ? "text-emerald-400" : rank <= 20 ? "text-amber-400" : "text-slate-400";
    return <span className={`text-[10px] font-bold ${color}`}>({ord(rank)})</span>;
  };

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

  // Conference & division teams for standings widget
  const conferenceTeams = standings
    .filter((s) => s.conference?.trim().toLowerCase() === team.conference?.trim().toLowerCase())
    .sort((a, b) => b.points - a.points || b.rw - a.rw || b.diff - a.diff);

  const divisionTeams = standings
    .filter((s) => s.division === team.division)
    .sort((a, b) => b.points - a.points || b.rw - a.rw || b.diff - a.diff);

  const ppPct = teamStats?.ppOpp ? `${(teamStats.ppPct * 100).toFixed(1)}%` : "—";
  const pkPct = teamStats?.timesSh ? `${(teamStats.pkPct * 100).toFixed(1)}%` : "—";

  return (
    <div className="space-y-6">
      {/* 2. TÍMOVÝ KALENDÁR / ROZPIS PÁSIK (MINI-SCHEDULE STRIP) */}
      {scheduleStrip.length > 0 && (
        <div className="bg-[#0b1120] border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-base">📅</span>
              <h2 className="text-sm font-black uppercase tracking-wider text-slate-200">
                {isEn ? "Team Calendar & Schedule" : "Tímový kalendár & Zápasový rozpis"}
              </h2>
              <span className="text-xs text-slate-500 hidden sm:inline">
                {isEn ? "(Recent Results & Upcoming Games)" : "(Posledné výsledky & Najbližšie stretnutia)"}
              </span>
            </div>
            <Link href={`/teams/${slug}/schedule`} className="text-xs text-sky-400 hover:text-sky-300 font-bold">
              {isEn ? "Full Season Schedule (82 games) →" : "Celý rozpis sezóny (82 zápasov) →"}
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5 pt-1">
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
                      ? "bg-gradient-to-b from-amber-950/30 to-slate-950 border-2 border-amber-500/50 hover:border-amber-400 shadow-lg shadow-amber-950/30"
                      : "bg-slate-950/80 border border-slate-800/90 hover:border-slate-700"
                  }`}
                >
                  {isNext && (
                    <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-amber-500 text-black text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full shadow">
                      {isEn ? "NEXT GAME" : "NAJBLIŽŠÍ ZÁPAS"}
                    </span>
                  )}
                  <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono mb-2">
                    <span className={isNext ? "text-amber-400 font-bold" : ""}>{fmtStripDate(g.gameDate)}</span>
                    {isFinal && (
                      <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider border ${
                        result === "W"
                          ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                          : result === "OTL"
                          ? "bg-amber-500/15 border-amber-500/30 text-amber-400"
                          : "bg-rose-500/15 border-rose-500/30 text-rose-400"
                      }`}>
                        {result === "W" ? (isEn ? "WIN" : "VÝHRA") : result === "OTL" ? "OTL" : (isEn ? "LOSS" : "PREHRA")}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 my-1">
                    <span className="text-xs text-slate-500 font-medium">{isHome ? "vs" : "@"}</span>
                    {opp.logoUrl && <img src={opp.logoUrl} alt="" className="w-6 h-6 object-contain" />}
                    <span className="font-bold text-sm text-white truncate">{opp.code || opp.name}</span>
                  </div>

                  <div className="mt-2 pt-2 border-t border-slate-900 flex items-center justify-between text-xs">
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
                      <span className="text-[10px] text-slate-500 font-medium">
                        {isHome ? (isEn ? "Home" : "Doma") : (isEn ? "Away" : "Vonku")}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. HLAVNÝ OBSAH (2 STĹPCE) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* HLAVNÝ ĽAVÝ STĹPEC (8 stĺpcov) */}
        <div className="lg:col-span-8 space-y-6">

          {/* ROZŠÍRENÉ TÍMOVÉ ŠTATISTIKY (EXPANDED TEAM STATS HUB) */}
          <div className="bg-[#0b1120] border border-slate-800 rounded-2xl p-5 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="text-amber-400 text-lg">📊</span>
                <div>
                  <h3 className="font-black text-sm uppercase tracking-wider text-white">
                    {isEn ? "Expanded Team Stats" : "Rozšírené tímové štatistiky (Team Stats)"}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {isEn ? "Comprehensive breakdown of offense, defense, special teams and league rankings" : "Kompletný prehľad ofenzívy, defenzívy, špeciálnych formácií a ligového poradia"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-slate-300 bg-slate-900 px-2.5 py-1 rounded border border-slate-800">
                  {gp} {isEn ? (gp === 1 ? "game played" : "games played") : (gp === 1 ? "odohratý zápas" : gp >= 2 && gp <= 4 ? "odohraté zápasy" : "odohratých zápasov")} (GP)
                </span>
                <Link href={`/teams/${slug}/stats`} className="text-xs text-sky-400 hover:text-sky-300 font-bold ml-2">
                  {isEn ? "Detailed Player Stats →" : "Podrobné štatistiky hráčov →"}
                </Link>
              </div>
            </div>

            {/* 1. KĽÚČOVÉ LIGOVÉ UKAZOVATELE (TOP 4 TILES) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 rounded-xl p-3.5 text-center">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">{isEn ? "Power Play (PP%)" : "Presilovky (PP%)"}</span>
                <span className="text-2xl font-black text-amber-400 tabular-nums">{ppPct}</span>
                <div className="flex items-center justify-center gap-1.5 mt-1">
                  <span className="text-[10px] font-mono text-slate-400">{teamStats?.ppGoalsFor ?? 0} / {teamStats?.ppOpp ?? 0} PPG</span>
                  {rankPP && (
                    <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20">
                      {ord(rankPP, isEn)} {isEn ? "in NHL" : "v NHL"}
                    </span>
                  )}
                </div>
              </div>

              <div className="bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 rounded-xl p-3.5 text-center">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">{isEn ? "Penalty Kill (PK%)" : "Oslabenia (PK%)"}</span>
                <span className="text-2xl font-black text-sky-400 tabular-nums">{pkPct}</span>
                <div className="flex items-center justify-center gap-1.5 mt-1">
                  <span className="text-[10px] font-mono text-slate-400">
                    {(teamStats?.timesSh ?? 0) - (teamStats?.ppGoalsAgainst ?? 0)} / {teamStats?.timesSh ?? 0} PK
                  </span>
                  {rankPK && (
                    <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20">
                      {ord(rankPK, isEn)} {isEn ? "in NHL" : "v NHL"}
                    </span>
                  )}
                </div>
              </div>

              <div className="bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 rounded-xl p-3.5 text-center">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">{isEn ? "Goals / Game (GF/G)" : "Góly / zápas (GF/G)"}</span>
                <span className="text-2xl font-black text-white tabular-nums">{per(gf)}</span>
                <div className="flex items-center justify-center gap-1.5 mt-1">
                  <span className="text-[10px] font-mono text-slate-400">{gf} {isEn ? "goals" : "gólov"}</span>
                  {rankGF && (
                    <span className="text-[10px] text-slate-300 font-bold bg-slate-800 px-1.5 py-0.2 rounded">
                      {ord(rankGF, isEn)} {isEn ? "in NHL" : "v NHL"}
                    </span>
                  )}
                </div>
              </div>

              <div className="bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 rounded-xl p-3.5 text-center">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">{isEn ? "Goals Against / Game (GA/G)" : "Inkasované / zápas (GA/G)"}</span>
                <span className="text-2xl font-black text-emerald-400 tabular-nums">{per(ga)}</span>
                <div className="flex items-center justify-center gap-1.5 mt-1">
                  <span className="text-[10px] font-mono text-slate-400">{ga} {isEn ? "allowed" : "inkasovaných"}</span>
                  {rankGA && (
                    <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20">
                      {ord(rankGA, isEn)} {isEn ? "in NHL" : "v NHL"}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* 2. DETAILNÉ ŠTATISTICKÉ KATEGÓRIE (TABUĽKOVÝ GRID V 3 BLOKOCH) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
              {/* BLOK A: OFENZÍVA & STREĽBA */}
              <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3.5 space-y-2.5">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                  <span className="text-xs font-bold text-amber-400 uppercase tracking-wide flex items-center gap-1.5">
                    <span>🏒</span> {isEn ? "Offense & Shooting" : "Ofenzíva & Streľba"}
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">{isEn ? "Offensive Data" : "Útočné dáta"}</span>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">{isEn ? "Shots on Goal (SF):" : "Strely na bránu (SF):"}</span>
                    <div className="flex items-center gap-1.5 font-mono">
                      <span className="font-bold text-white">{sf}</span>
                      <span className="text-[10px] text-slate-500">({per(sf)} / gm)</span>
                      {rankBadge(rankSF)}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">{isEn ? "Shooting % (SH%):" : "Úspešnosť streľby (SH%):"}</span>
                    <div className="flex items-center gap-1.5 font-mono">
                      <span className="font-bold text-white">{sf > 0 ? `${((gf / sf) * 100).toFixed(1)}%` : "—"}</span>
                      {rankBadge(rankSH)}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">{isEn ? "Shorthanded Goals (SHG):" : "Góly v oslabení (SHG):"}</span>
                    <div className="flex items-center gap-1.5 font-mono">
                      <span className="font-bold text-white">{teamStats?.shGoals ?? 0}</span>
                      {rankBadge(rankSHG)}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">{isEn ? "Expected Goals (xGF/60):" : "Očakávané góly (xGF/60):"}</span>
                    <div className="flex items-center gap-1.5 font-mono">
                      <span className="font-bold text-sky-400">{teamStats?.xgf60 ? teamStats.xgf60.toFixed(2) : "—"}</span>
                      {rankBadge(rankXGF)}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">{isEn ? "High-Danger Chances (HDCF%):" : "Nebezpečné šance (HDCF%):"}</span>
                    <div className="flex items-center gap-1.5 font-mono">
                      <span className="font-bold text-emerald-400">{teamStats?.hdcfPct ? `${(teamStats.hdcfPct * 100).toFixed(1)}%` : "—"}</span>
                      {rankBadge(rankHDCF)}
                    </div>
                  </div>
                </div>
              </div>

              {/* BLOK B: DEFENZÍVA & BRÁNKISKO */}
              <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3.5 space-y-2.5">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                  <span className="text-xs font-bold text-sky-400 uppercase tracking-wide flex items-center gap-1.5">
                    <span>🛡️</span> {isEn ? "Defense & Goaltending" : "Defenzíva & Brankári"}
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">{isEn ? "Defensive Data" : "Obranné dáta"}</span>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">{isEn ? "Shots Against (SA):" : "Strely súpera (SA):"}</span>
                    <div className="flex items-center gap-1.5 font-mono">
                      <span className="font-bold text-white">{sa}</span>
                      <span className="text-[10px] text-slate-500">({per(sa)} / gm)</span>
                      {rankBadge(rankSA)}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">{isEn ? "Save % (SV%):" : "Úspešnosť zákrokov (SV%):"}</span>
                    <div className="flex items-center gap-1.5 font-mono">
                      <span className="font-bold text-emerald-400">{sa > 0 ? `${(((sa - ga) / sa) * 100).toFixed(1)}%` : "—"}</span>
                      {rankBadge(rankSV)}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">{isEn ? "Shutouts:" : "Čisté kontá (Shutouts):"}</span>
                    <div className="flex items-center gap-1.5 font-mono">
                      <span className="font-bold text-white">{teamStats?.shutouts ?? 0}</span>
                      {rankBadge(rankSO)}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">{isEn ? "Exp. Goals Against (xGA/60):" : "Očak. inkasované (xGA/60):"}</span>
                    <div className="flex items-center gap-1.5 font-mono">
                      <span className="font-bold text-emerald-400">{teamStats?.xga60 ? teamStats.xga60.toFixed(2) : "—"}</span>
                      {rankBadge(rankXGA)}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">{isEn ? "Goal Differential (DIFF):" : "Rozdiel gólov (DIFF):"}</span>
                    <div className="flex items-center gap-1.5 font-mono">
                      <span className={`font-bold ${gf - ga >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                        {gf - ga > 0 ? `+${gf - ga}` : gf - ga}
                      </span>
                      {rankBadge(rankDIFF)}
                    </div>
                  </div>
                </div>
              </div>

              {/* BLOK C: BULY, FYZICKÁ HRA & BILANCIA */}
              <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3.5 space-y-2.5">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-wide flex items-center gap-1.5">
                    <span>⚖️</span> {isEn ? "Physical Play & Record" : "Fyzická hra & Bilancia"}
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">{isEn ? "Activity" : "Aktivita"}</span>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">{isEn ? "Faceoffs (FO%):" : "Vhadzovania (Faceoffs%):"}</span>
                    <div className="flex items-center gap-1.5 font-mono">
                      <span className="font-bold text-amber-400">{foPct}</span>
                      {rankBadge(rankFO)}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">{isEn ? "Hits:" : "Hity (Hits):"}</span>
                    <div className="flex items-center gap-1.5 font-mono">
                      <span className="font-bold text-white">{teamStats?.hits ?? 0}</span>
                      <span className="text-[10px] text-slate-500">({gp ? ((teamStats?.hits ?? 0) / gp).toFixed(1) : "0"} / gm)</span>
                      {rankBadge(rankHits)}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">{isEn ? "Blocked Shots (Blocks):" : "Zblokované strely (Blocks):"}</span>
                    <div className="flex items-center gap-1.5 font-mono">
                      <span className="font-bold text-white">{teamStats?.blocks ?? 0}</span>
                      <span className="text-[10px] text-slate-500">({gp ? ((teamStats?.blocks ?? 0) / gp).toFixed(1) : "0"} / gm)</span>
                      {rankBadge(rankBlocks)}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">{isEn ? "Penalty Minutes (PIM):" : "Trestné minúty (PIM):"}</span>
                    <div className="flex items-center gap-1.5 font-mono">
                      <span className="font-bold text-white">{teamStats?.pim ?? 0} min</span>
                      <span className="text-[10px] text-slate-500">({gp ? ((teamStats?.pim ?? 0) / gp).toFixed(1) : "0"} / gm)</span>
                      {rankBadge(rankPIM)}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">{isEn ? "Home / Away Record:" : "Bilancia Doma / Vonku:"}</span>
                    <span className="font-mono font-bold text-white">{homeRecord} / {awayRecord}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* TÍMOVÍ LÍDRI (VYLEPŠENÉ DLAŽDICE S FOTKAMI A TAGMI) */}
          <div className="bg-[#0b1120] border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-yellow-400">👑</span>
                <h3 className="font-black text-sm uppercase tracking-wider text-white">
                  {isEn ? "Team Leaders" : "Tímoví lídri (Team Leaders)"}
                </h3>
              </div>
              <Link href={`/teams/${slug}/stats`} className="text-xs text-sky-400 hover:text-sky-300 font-bold">
                {isEn ? "All Player Stats →" : "Všetky štatistiky hráčov →"}
              </Link>
            </div>

            {gp === 0 ? (
              <p className="text-sm text-slate-500 py-4 text-center">
                {isEn ? "Leaders will appear after the first games are played." : "Lídri sa zobrazia po odohraní prvých zápasov."}
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {leaders.map((l) => {
                  const player = l.pid ? pById.get(l.pid) : undefined;
                  return (
                    <div
                      key={l.label}
                      className="bg-slate-950/80 border border-slate-800 hover:border-amber-500/40 rounded-xl p-3 flex items-center gap-3 transition-colors group"
                    >
                      <div className="w-14 h-14 rounded-full bg-slate-900 border border-slate-700 overflow-hidden shrink-0 flex items-center justify-center">
                        <PlayerAvatar src={player?.photoUrl ?? null} alt={player?.name ?? ""} size={56} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                          {l.label}
                        </span>
                        {player ? (
                          <Link
                            href={`/players/${player.slug}`}
                            className="font-black text-base text-white hover:text-amber-400 cursor-pointer truncate block transition-colors"
                          >
                            {cleanName(player.name)}
                          </Link>
                        ) : (
                          <span className="text-sm text-slate-500 font-bold block">—</span>
                        )}
                        <span className="text-xs text-slate-400">
                          {l.sub || (player ? `${gp} ${isEn ? (gp === 1 ? "game" : "games") : (gp === 1 ? "zápas" : gp >= 2 && gp <= 4 ? "zápasy" : "zápasov")}` : "")}
                        </span>
                      </div>
                      <span className="text-2xl font-black text-white tabular-nums shrink-0">
                        {l.value}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* POSLEDNÁ AKTIVITA & SPRÁVY KLUBU (RECENT TRANSACTIONS & MOVES) */}
          <div className="bg-[#0b1120] border border-slate-800 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-sky-400">📜</span>
                <h3 className="font-black text-sm uppercase tracking-wider text-white">
                  {isEn ? "Recent Activity & Club News" : "Posledná aktivita & Správy klubu"}
                </h3>
              </div>
              <Link href={`/teams/${slug}/transactions`} className="text-xs text-sky-400 hover:text-sky-300 font-bold">
                {isEn ? "All Transactions →" : "Všetky transakcie →"}
              </Link>
            </div>

            {recentTransactions.length === 0 ? (
              <p className="text-xs text-slate-500 py-2">
                {isEn ? "No recent activity recorded." : "Žiadna zaznamenaná aktivita v poslednej dobe."}
              </p>
            ) : (
              <div className="space-y-2">
                {recentTransactions.map((tx) => (
                  <div key={tx.id} className="flex items-center gap-3 p-3 bg-slate-950/80 border border-slate-800/80 rounded-xl text-xs">
                    <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                    <span className="text-slate-400 font-mono shrink-0">
                      {fmtStripDate(tx.createdAt)}
                    </span>
                    <span className="text-slate-200 flex-1 truncate">
                      {tx.message}
                    </span>
                    <span className="text-[10px] font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20 uppercase shrink-0">
                      {tx.type}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* TOP NÁDEJE & PROSPECTS (PREHĽAD S HODNOTENÍM A PROJEKCIAMI) */}
          {projectedProspects.length > 0 && (
            <div className="bg-[#0b1120] border border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-yellow-400">🌟</span>
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-sm uppercase tracking-wider text-white">
                      {isEn ? "Top Prospects" : "Top Nádeje tímu (Prospects)"}
                    </h3>
                    <span className="text-[10px] font-bold text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded-full border border-slate-700">
                      {projectedProspects.length}
                    </span>
                  </div>
                </div>
                <Link
                  href={`/teams/${slug}/prospects`}
                  className="text-xs text-sky-400 hover:text-sky-300 font-bold transition-colors"
                >
                  {isEn ? `All Prospects (${projectedProspects.length}) →` : `Všetky nádeje (${projectedProspects.length}) →`}
                </Link>
              </div>

              <div className="overflow-x-auto -mx-1">
                <table className="w-full text-left text-xs min-w-[580px]">
                  <thead>
                    <tr className="border-b border-slate-800/80 text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-900/50">
                      <th className="py-2.5 px-3">{isEn ? "Player" : "Hráč"}</th>
                      <th className="py-2.5 px-3 text-center">Grade</th>
                      <th className="py-2.5 px-3">{isEn ? "Projected Role & ETA" : "Predikovaná rola & ETA"}</th>
                      <th className="py-2.5 px-3">Draft</th>
                      <th className="py-2.5 px-3">{isEn ? "Current Club & League" : "Súčasný klub & Liga"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/40">
                    {projectedProspects.slice(0, 7).map((pr) => {
                      const isGoalie = pr.latestStat?.isGoalie || pr.position === "G";
                      const statSummary = pr.latestStat
                        ? isGoalie
                          ? pr.latestStat.savePercentage
                            ? `${Math.round(pr.latestStat.savePercentage * 1000) / 10}% SV`
                            : `${pr.latestStat.gamesPlayed} Z`
                          : `${pr.latestStat.gamesPlayed} Z · ${pr.latestStat.points ?? 0} B`
                        : null;

                      return (
                        <tr key={pr.id} className="hover:bg-slate-800/20 transition-colors group">
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-2">
                              <a
                                href={pr.epUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-bold text-slate-200 group-hover:text-sky-400 transition-colors inline-flex items-center gap-1"
                                title="Otvoriť profil na EliteProspects"
                              >
                                {pr.name}
                                <span className="text-[9px] text-slate-500 opacity-60 group-hover:opacity-100 transition-opacity">↗</span>
                              </a>
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-800/90 text-slate-300 border border-slate-700/80 shrink-0">
                                {pr.position}
                              </span>
                            </div>
                          </td>

                          <td className="py-2.5 px-3 text-center">
                            <div className="inline-flex items-center gap-1.5">
                              <span className={`inline-flex items-center justify-center font-black rounded-md px-2 py-0.5 text-xs border ${gradeBadgeStyle(pr.grade)}`}>
                                {pr.grade}
                              </span>
                              <span className="text-[11px] font-mono text-slate-400 tabular-nums">
                                {pr.score}
                              </span>
                            </div>
                          </td>

                          <td className="py-2.5 px-3">
                            <div className="text-slate-200 font-medium">{pr.role}</div>
                            <div className="text-[10px] text-slate-500">ETA: {pr.eta}</div>
                          </td>

                          <td className="py-2.5 px-3 text-slate-300 font-mono text-[11px]">
                            {pr.draftYear ? (
                              <div>
                                <span>{pr.draftYear}</span>
                                {pr.overallPick ? (
                                  <span className="text-slate-500 text-[10px] ml-1">
                                    #{pr.overallPick} ({isEn ? `Round ${pr.round}` : `${pr.round}. kolo`})
                                  </span>
                                ) : null}
                              </div>
                            ) : pr.undrafted ? (
                              <span className="text-slate-500 text-[10px]">{isEn ? "Undrafted" : "Nedraftovaný"}</span>
                            ) : (
                              <span className="text-slate-600">—</span>
                            )}
                          </td>

                          <td className="py-2.5 px-3">
                            {pr.teamName || pr.leagueCode ? (
                              <div>
                                <div className="flex items-center gap-1.5 text-slate-300 font-medium">
                                  <span className="truncate max-w-[130px]">{pr.teamName ?? "—"}</span>
                                  {pr.leagueCode && (
                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-sky-950/60 text-sky-400 border border-sky-800/40 shrink-0">
                                      {pr.leagueCode}
                                    </span>
                                  )}
                                </div>
                                {statSummary && (
                                  <div className="text-[10px] text-slate-400 font-mono">
                                    {statSummary}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-600">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                <span className="text-[11px] text-slate-500">
                  {isEn ? "Sorted by projection score and draft" : "Zoradené podľa projekčného skóre a draftu"}
                </span>
                <Link
                  href={`/teams/${slug}/prospects`}
                  className="px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white font-medium text-xs transition-colors border border-slate-700/60 inline-flex items-center gap-1.5"
                >
                  {isEn ? `View all prospects (${projectedProspects.length}) →` : `Zobraziť všetky nádeje (${projectedProspects.length}) →`}
                </Link>
              </div>
            </div>
          )}

        </div>

        {/* BOČNÝ PRAVÝ STĹPEC (4 stĺpce) */}
        <div className="lg:col-span-4 space-y-6">

          {/* GM COCKPIT (RÝCHLE AKCIE PRE MANAŽÉRA) */}
          {isGm && (
            <div className="bg-gradient-to-b from-sky-950/40 via-slate-900 to-[#0b1120] border-2 border-sky-500/40 rounded-2xl p-4 sm:p-5 space-y-3 shadow-xl">
              <div className="flex items-center justify-between border-b border-sky-500/20 pb-2.5">
                <span className="text-xs font-black uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
                  <span>🎛️</span> {isEn ? "GM Cockpit & Quick Actions" : "GM Cockpit & Rýchle akcie"}
                </span>
                <span className="text-[10px] font-bold text-sky-300 bg-sky-500/20 px-2 py-0.5 rounded">GM MODE</span>
              </div>

              <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900/80 border border-slate-800">
                  <span className="text-slate-300">{isEn ? "Roster & Lines:" : "Zostava a formácie:"}</span>
                  <span className="text-emerald-400 font-bold">{isEn ? "Ready ✓" : "Pripravené ✓"}</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900/80 border border-slate-800">
                  <span className="text-slate-300">{isEn ? "Cap Space (Cap Room):" : "Platový strop (Cap Room):"}</span>
                  <span className={`font-bold ${effectiveSpace < 0 ? "text-rose-400" : "text-emerald-400"}`}>
                    {effectiveSpace < 0 ? `-$${(Math.abs(effectiveSpace) / 1_000_000).toFixed(2)}M` : fmtM(effectiveSpace)}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <Link href={`/teams/${slug}/lines`} className="px-3 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-black font-extrabold text-xs text-center transition-colors shadow">
                  🏒 {isEn ? "Edit Lines" : "Zmeniť zostavu"}
                </Link>
                <Link href="/trades/build" className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs text-center border border-slate-700 transition-colors">
                  🔄 {isEn ? "Trade" : "Obchodovať (Trade)"}
                </Link>
              </div>
            </div>
          )}

          {/* TABUĽKA & PLAY-OFF RACE (KONFERENCIA TOP 8 / DIVÍZIA) */}
          {(conferenceTeams.length > 0 || divisionTeams.length > 0) && (
            <TeamStandingsWidget
              currentTeamId={team.id}
              conferenceName={team.conference}
              divisionName={team.division}
              conferenceTeams={conferenceTeams}
              divisionTeams={divisionTeams}
              lang={lang}
            />
          )}

          {/* MARÓDKA (INJURIES) */}
          <div className="bg-[#0b1120] border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <span className="text-xs font-black uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
                <span>🏥</span> {isEn ? "Injuries" : "Maródka (Injuries)"}
              </span>
              <span className="text-[10px] font-mono text-rose-300 bg-rose-500/15 px-2 py-0.5 rounded border border-rose-500/30">
                {injured.length} {isEn ? "injured" : (injured.length === 1 ? "zranený" : injured.length >= 2 && injured.length <= 4 ? "zranení" : "zranených")}
              </span>
            </div>
            {injured.length === 0 ? (
              <p className="text-xs text-slate-500 py-1">
                {isEn ? "No injured players on the roster." : "Žiadni zranení hráči v tíme."}
              </p>
            ) : (
              <div className="space-y-2">
                {injured.map((p) => (
                  <div key={p.id} className="flex items-center justify-between p-2 rounded-lg bg-rose-950/20 border border-rose-500/20 text-xs">
                    <div>
                      <Link href={`/players/${p.slug}`} className="font-bold text-white hover:text-rose-300 transition-colors block">
                        {cleanName(p.name)} <span className="text-slate-400 font-normal">({p.position})</span>
                      </Link>
                      <span className="text-[10px] text-slate-400">{p.injuryDesc || (isEn ? "Injured" : "Zranenie")}</span>
                    </div>
                    <span className="text-xs font-mono font-bold text-rose-400">
                      {isEn ? `${p.injuryDaysLeft} ${p.injuryDaysLeft === 1 ? "day left" : "days left"}` : `ešte ${p.injuryDaysLeft} ${p.injuryDaysLeft === 1 ? "deň" : p.injuryDaysLeft >= 2 && p.injuryDaysLeft <= 4 ? "dni" : "dní"}`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Končiace zmluvy & Podpisovanie (priamo pod Maródkou) */}
          <ExpiringContractsWidget teamId={team.id} slug={slug} isGm={isGm} lang={lang} />

          {/* TEAM INFO */}
          <div className="bg-[#0b1120] border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <span className="text-xs font-black uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                <span>ℹ️</span> Team Info
              </span>
            </div>
            <div className="space-y-2.5 text-xs">
              <InfoRow label="General Manager" value={teamManagerLabel(team)} />
              <InfoRow label="Head Coach" value={<Link href={`/teams/${slug}/coach`} className="hover:text-blue-400">{team.headCoach?.name || team.coach || "TBD"} <span className="text-slate-500 text-xs">{isEn ? "· manage" : "· spravovať"}</span></Link>} />
              <InfoRow label={isEn ? "Conference" : "Konferencia"} value={team.conference || "N/A"} />
              <InfoRow label={isEn ? "Division" : "Divízia"} value={team.division || "N/A"} />
              <InfoRow label={isEn ? "Arena" : "Aréna"} value={team.arena} />
              <InfoRow label={isEn ? "Capacity" : "Kapacita"} value={team.capacity ? team.capacity.toLocaleString() : "N/A"} />
              {team.parentTeam && <InfoRow label={isEn ? "Parent Club" : "Materský klub"} value={<Link href={`/teams/${team.parentTeam.slug}`} className="text-blue-400 hover:underline">{team.parentTeam.name}</Link>} />}
            </div>
            {isNhl && (
              <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-slate-800">
                {gmLinks.map(([l, h]) => (
                  <Link key={h} href={h} className="px-2.5 py-1 rounded-lg bg-slate-800/70 hover:bg-slate-700 text-slate-200 text-[10px] font-bold uppercase tracking-wider border border-slate-600/40 transition-colors">{l}</Link>
                ))}
              </div>
            )}
          </div>

          {/* SALARY CAP */}
          <div className="bg-[#0b1120] border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <span className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                <span>💰</span> Salary Cap
              </span>
              <Link href={`/teams/${slug}/salary`} className="text-xs text-slate-400 hover:text-blue-400">{isEn ? "details →" : "detaily →"}</Link>
            </div>
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-lg font-black text-white">{fmtM(totalCap)}</span>
              <span className="text-xs text-slate-400">
                {isEn ? "of" : "z"} {fmtM(capCeiling)} {ltir > 0 && <span className="text-sky-400 font-semibold">(+{fmtM(ltir)} LTIR)</span>}
              </span>
            </div>
            <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
              <div className={`h-full ${totalCap > effectiveCeiling ? "bg-red-500" : (totalCap / effectiveCeiling) >= 0.9 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${capPct}%` }} />
            </div>
            <div className="mt-3 space-y-2">
              <InfoRow
                label={ltir > 0 ? (isEn ? "Cap Space (LTIR)" : "Priestor pod stropom (LTIR)") : "Cap Space"}
                value={
                  <span className={effectiveSpace < 0 ? "text-red-400 font-bold" : "text-emerald-400 font-bold"}>
                    {effectiveSpace < 0 ? `-$${(Math.abs(effectiveSpace) / 1_000_000).toFixed(2)}M` : fmtM(effectiveSpace)}
                  </span>
                }
              />
              <InfoRow label={isEn ? "Salary Cap Ceiling" : "Platový strop"} value={ltir > 0 ? `${fmtM(capCeiling)} (+${fmtM(ltir)} LTIR)` : fmtM(capCeiling)} />
              {capStatus && (
                <InfoRow label={isEn ? "Salary Floor" : "Platová podlaha (Floor)"} value={fmtM(capStatus.floor)} />
              )}
              {capStatus && (
                <InfoRow
                  label={isEn ? "Compliance Status" : "Status súladu"}
                  value={
                    <span className={`font-bold ${capStatus.compliant ? "text-emerald-400" : capStatus.underFloorBy > 0 ? "text-amber-400" : "text-rose-400"}`}>
                      {capStatus.compliant ? "Compliant ✓" : capStatus.overBy > 0 ? (isEn ? `Over Cap (${fmtM(capStatus.overBy)})` : `Nad stropom (${fmtM(capStatus.overBy)})`) : (isEn ? `Under Floor (${fmtM(capStatus.underFloorBy)})` : `Pod podlahou (${fmtM(capStatus.underFloorBy)})`)}
                    </span>
                  }
                />
              )}
              {retention && (
                <>
                  <InfoRow label={isEn ? "Retention Slots" : "Retenčné sloty"} value={
                    <span className={retention.slotsOutUsed + retention.slotsInUsed >= retention.slotsMax ? "text-red-400" : "text-slate-200"}>
                      {retention.slotsOutUsed + retention.slotsInUsed}/{retention.slotsMax} <span className="text-slate-500 text-xs">{isEn ? `(${retention.slotsOutUsed} out, ${retention.slotsInUsed} in)` : `(${retention.slotsOutUsed} von, ${retention.slotsInUsed} dnu)`}</span>
                    </span>
                  } />
                  <InfoRow label={isEn ? "Retention % of Cap" : "Retencia % zo stropu"} value={
                    <span className={retention.pctOfCap >= retention.pctMax ? "text-red-400" : "text-slate-200"}>{retention.pctOfCap.toFixed(1)}% <span className="text-slate-500">/ {retention.pctMax}%</span></span>
                  } />
                </>
              )}
            </div>
          </div>

          {/* ROSTER INFO */}
          <div className="bg-[#0b1120] border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <span className="text-xs font-black uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
                <span>📋</span> {isEn ? "Roster Info" : "Zostava (Roster Info)"}
              </span>
            </div>
            <div className="space-y-2.5 text-xs">
              <InfoRow label={isEn ? "All Org Players" : "Všetci hráči v organizácii"} value={`${proCount + farmCount} ${isEn ? "players" : "hráčov"}`} />
              <InfoRow label={isEn ? "Active NHL Roster" : "Aktívny NHL tím"} value={`${proCount} ${isEn ? "players" : "hráčov"}`} />
              {farmCount > 0 && (
                <InfoRow label={isEn ? "AHL Affiliate" : "AHL Farma"} value={
                  team.affiliateTeams[0] ? (
                    <Link href={`/teams/${team.affiliateTeams[0].slug}`} className="hover:text-blue-400">
                      {farmCount} {isEn ? "players" : "hráčov"} <span className="text-slate-500 text-xs">· {team.affiliateTeams[0].name}</span>
                    </Link>
                  ) : `${farmCount} ${isEn ? "players" : "hráčov"}`
                } />
              )}
              {team._count.players > 0 && (
                <InfoRow label={isEn ? "Non-roster" : "Mimo súpisky (Non-roster)"} value={
                  <Link href={`/teams/${team.slug}/contracts`} className="text-amber-400 hover:text-amber-300">
                    {team._count.players} {isEn ? "unsigned RFAs →" : "nepodpísaných RFA →"}
                  </Link>
                } />
              )}
              <InfoRow label={isEn ? "Prospects Count" : "Počet nádejí (Prospects)"} value={String(team.prospects.length)} />
              <InfoRow label={isEn ? "Average Age" : "Priemerný vek"} value={String(avgAge)} />
            </div>
          </div>

          {/* LEADERSHIP */}
          {captains.length > 0 && (
            <div className="bg-[#0b1120] border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <span className="text-xs font-black uppercase tracking-wider text-yellow-400 flex items-center gap-1.5">
                  <span>🎖️</span> Vedenie tímu (Leadership)
                </span>
              </div>
              <div className="space-y-2">
                {captains.map((c) => (
                  <div key={c.id} className="flex items-center gap-2 text-sm">
                    <PlayerAvatar src={c.photoUrl} alt={c.name} size={28} />
                    <Link href={`/players/${c.slug}`} className="flex-1 truncate text-white hover:text-blue-400">{cleanName(c.name)}</Link>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${c.captaincy === "C" ? "bg-yellow-500/20 text-yellow-400" : "bg-slate-600/30 text-slate-300"}`}>{c.captaincy}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="text-slate-400">{label}</span>
      <span className="font-semibold text-white text-right truncate">{value}</span>
    </div>
  );
}
