import Link from "next/link";
import BackLink from "@/components/BackLink";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isLoggedIn, getTeamSession } from "@/lib/auth";
import { cleanName, epProfileUrl } from "@/lib/playerName";
import { Card } from "@/components/ui";
import { posGroup, ratingColor, ovColor, SKATER_ATTRS, GOALIE_ATTRS } from "@/lib/ratingBands";
import { playerType } from "@/lib/player-type";
import { playerCareer } from "@/lib/career-server";
import PlayerCareerCard from "@/components/PlayerCareerCard";
import PlayerGameLog from "@/components/PlayerGameLog";
import { playerForm } from "@/lib/form-server";
import PlayerFormCard from "@/components/PlayerFormCard";
import { playerHeatMap, playerDefenseMap } from "@/lib/heatmap-server";
import RinkHeatMap from "@/components/RinkHeatMap";
import RinkDefenseMap from "@/components/RinkDefenseMap";
import { goalieAnalytics } from "@/lib/goalie-analytics-server";
import GoalieAnalyticsCard from "@/components/GoalieAnalyticsCard";
import { starPowerForPlayer } from "@/lib/star-power-server";
import { onLtir, money, CURRENT_SEASON_START, seasonLabel, ageAsOfJune30, liveCapHit } from "@/lib/finance";
import { tierAccent } from "@/lib/star-power";
import InfoTip from "@/components/InfoTip";
import { playerTradeHistory, playerTransactionHistory } from "@/lib/trade-history-server";
import PlayerTradeHistoryCard from "@/components/PlayerTradeHistoryCard";
import PlayerTransactionHistoryCard from "@/components/PlayerTransactionHistoryCard";
import PlayerHistoryTabs from "@/components/PlayerHistoryTabs";
import PlayerProfileTabs from "@/components/PlayerProfileTabs";
import PlayerAdvancedStatsCard from "@/components/PlayerAdvancedStatsCard";

export const dynamic = "force-dynamic";

const SEASON = "2026-27";

// Accept either a numeric id or a slug (links across the app use the slug).
async function getPlayer(idOrSlug: string) {
  const where = /^\d+$/.test(idOrSlug) ? { id: parseInt(idOrSlug, 10) } : { slug: idOrSlug };
  const player = await prisma.player.findFirst({
    where,
    include: { team: true, goalieRating: true },
  });
  if (!player) notFound();
  return player;
}

function attrColor(val: number | null | undefined): string {
  if (val == null) return "text-slate-600";
  if (val >= 90) return "text-green-400 font-bold";
  if (val >= 80) return "text-blue-400";
  if (val >= 70) return "text-yellow-400";
  if (val < 50) return "text-red-400";
  return "text-slate-300";
}

// Common nationality codes → flag emoji. Unmapped/null → empty string.
const NAT_FLAGS: Record<string, string> = {
  CAN: "🇨🇦", USA: "🇺🇸", SWE: "🇸🇪", FIN: "🇫🇮", RUS: "🇷🇺", CZE: "🇨🇿",
  SVK: "🇸🇰", SUI: "🇨🇭", CHE: "🇨🇭", GER: "🇩🇪", DEU: "🇩🇪", DEN: "🇩🇰",
  DNK: "🇩🇰", NOR: "🇳🇴", LAT: "🇱🇻", LVA: "🇱🇻", AUT: "🇦🇹", FRA: "FRA",
  SLO: "🇸🇮", SVN: "🇸🇮", BLR: "🇧🇾", UKR: "🇺🇦", GBR: "🇬🇧", AUS: "🇦🇺",
  KAZ: "🇰🇿", ITA: "🇮🇹", NED: "🇳🇱", NLD: "🇳🇱", POL: "🇵🇱", JPN: "🇯🇵",
  CRO: "🇭🇷", HRV: "🇭🇷", EST: "🇪🇪", LTU: "🇱🇹",
};
function natFlag(nat: string | null | undefined): string {
  if (!nat) return "";
  return NAT_FLAGS[nat.toUpperCase().trim()] ?? "";
}

const mmss = (secs: number) => `${Math.floor(secs / 60)}:${Math.floor(secs % 60).toString().padStart(2, "0")}`;

function formatDOB(birthDate: string | null | undefined): string {
  if (!birthDate) return "—";
  const d = new Date(birthDate);
  if (isNaN(d.getTime())) return birthDate;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
}

// aggregate skater per-game rows into a single stat line
function aggSkater(rows: {
  goals: number; assists: number; points: number; shots: number; pim: number;
  plusMinus: number; ppGoals: number; shGoals: number; gwg: number;
  hits: number; blocks: number; faceoffWins: number; faceoffLosses: number; toi: number; ppToi: number; pkToi: number;
}[]) {
  const gp = rows.length;
  const sum = (k: keyof (typeof rows)[number]) => rows.reduce((s, r) => s + (r[k] as number), 0);
  const goals = sum("goals"), shots = sum("shots"), fw = sum("faceoffWins"), fl = sum("faceoffLosses"), toi = sum("toi"), points = sum("points");
  // TOI splits (seconds): even-strength = total − PP − PK. Shown as per-game averages.
  const ppToi = sum("ppToi"), pkToi = sum("pkToi"), evToi = Math.max(0, toi - ppToi - pkToi);
  return {
    gp,
    g: goals, a: sum("assists"), pts: points, pm: sum("plusMinus"), pim: sum("pim"),
    ppg: sum("ppGoals"), shg: sum("shGoals"), gwg: sum("gwg"),
    s: shots, sPct: shots ? (goals / shots) * 100 : null,
    hits: sum("hits"), bks: sum("blocks"),
    foPct: fw + fl ? (fw / (fw + fl)) * 100 : null,
    toi: gp ? mmss(toi / gp) : "—",
    evToi: gp ? mmss(evToi / gp) : "—",
    ppToi: gp ? mmss(ppToi / gp) : "—",
    pkToi: gp ? mmss(pkToi / gp) : "—",
    pPg: gp ? points / gp : 0,
  };
}

// aggregate goalie per-game rows into a single stat line
function aggGoalie(rows: {
  started: boolean; shotsAgainst: number; saves: number; goalsAgainst: number; decision: string | null;
  xga?: number | null; isSteal?: boolean;
}[]) {
  const started = rows.filter((r) => r.started);
  const gp = started.length || rows.length;
  const sa = rows.reduce((s, r) => s + r.shotsAgainst, 0);
  const sv = rows.reduce((s, r) => s + r.saves, 0);
  const ga = rows.reduce((s, r) => s + r.goalsAgainst, 0);
  const xga = rows.reduce((s, r) => s + (r.xga ?? 0), 0);
  const steals = rows.filter((r) => r.isSteal).length;
  return {
    gp,
    w: rows.filter((r) => r.decision === "W").length,
    l: rows.filter((r) => r.decision === "L").length,
    otl: rows.filter((r) => r.decision === "OTL").length,
    svPct: sa ? sv / sa : null,
    gaa: gp ? ga / gp : 0,
    gsax: xga - ga,
    steals,
    so: rows.filter((r) => r.started && r.goalsAgainst === 0).length,
    sa, sv, ga,
    toi: `${gp * 60}:00`,
  };
}

type SkAgg = ReturnType<typeof aggSkater>;
type GlAgg = ReturnType<typeof aggGoalie>;
const cellCls = "px-3 py-2.5 text-right tabular-nums whitespace-nowrap";
const headRowCls = "bg-slate-800/30 border-b border-slate-800 text-slate-500 text-xs uppercase tracking-wider";
const secHdr = "px-4 py-2 bg-slate-800/60 text-xs font-bold uppercase tracking-wide text-slate-300";
const pmFmt = (v: number) => {
  if (v > 0) return <span className="text-emerald-400 font-medium">+{v}</span>;
  if (v < 0) return <span className="text-rose-400 font-medium">{v}</span>;
  return <span className="text-slate-400">0</span>;
};
const pctFmt = (v: number | null, d = 1) => (v == null ? "—" : v.toFixed(d));
const svpFmt = (v: number | null) => (v == null ? "—" : v.toFixed(3).replace(/^0/, ""));

const COL_TITLES: Record<string, string> = {
  TOI: "Average total time on ice per game", EV: "Average even-strength ice time per game",
  PP: "Average power-play ice time per game", PK: "Average penalty-kill ice time per game",
  GSAx: "Goals Saved Above Expected (xGA − GA)",
  STL: "Steals — games won where GSAx > margin of victory (excl. empty-net goals)",
};
const SK_COLS = ["GP", "G", "A", "PTS", "+/-", "PIM", "PPG", "SHG", "GWG", "S", "S%", "HITS", "BKS", "FO%", "TOI", "EV", "PP", "PK", "P/PG"];
const skCells = (a: SkAgg): React.ReactNode[] => [a.gp, a.g, a.a, a.pts, pmFmt(a.pm), a.pim, a.ppg, a.shg, a.gwg, a.s, pctFmt(a.sPct), a.hits, a.bks, a.foPct == null ? "—" : a.foPct.toFixed(1), a.toi, a.evToi, a.ppToi, a.pkToi, a.pPg.toFixed(2)];
const GL_COLS = ["GP", "W", "L", "OTL", "SV%", "GAA", "GSAx", "STL", "SO", "SA", "SV", "GA", "TOI"];
const glCells = (a: GlAgg): React.ReactNode[] => [
  a.gp, a.w, a.l, a.otl, svpFmt(a.svPct), a.gaa.toFixed(2),
  (a.gsax >= 0 ? "+" : "") + a.gsax.toFixed(1), a.steals,
  a.so, a.sa, a.sv, a.ga, a.toi,
];

// A league block: "<LEAGUE> Seasons" (season row + career) and, if any, "<LEAGUE> Playoffs".
type Split = { team: React.ReactNode; agg: any };

function StatBlock({ league, cols, reg, po, cellsOf, team, regSplits, poSplits, season = "2026-27" }: {
  league: string; cols: string[]; reg: any; po: any; cellsOf: (a: any) => React.ReactNode[]; team: React.ReactNode;
  regSplits?: Split[]; poSplits?: Split[]; season?: string;
}) {
  if (!reg && !po) return null;
  const Head = () => (
    <thead><tr className={headRowCls}>
      <th className="px-3 py-2.5 text-left font-medium">Season</th>
      <th className="px-3 py-2.5 text-left font-medium">Team</th>
      {cols.map((h) => <th key={h} title={COL_TITLES[h]} className={`px-3 py-2.5 text-right font-medium whitespace-nowrap ${COL_TITLES[h] ? "cursor-help" : ""}`}>{h}</th>)}
    </tr></thead>
  );
  const Row = ({ label, a, bold, accent, teamNode }: { label: string; a: any; bold?: boolean; accent?: boolean; teamNode: React.ReactNode }) => (
    <tr className={`border-b border-slate-800/40 last:border-0 ${bold ? "bg-slate-800/40 font-semibold" : accent ? "text-amber-300/90" : ""}`}>
      <td className="px-3 py-2.5 text-left font-medium">{label}</td>
      <td className="px-3 py-2.5 text-left">{teamNode}</td>
      {cellsOf(a).map((c, i) => <td key={i} className={cellCls}>{c}</td>)}
    </tr>
  );
  return (
    <div className="bg-slate-900/40 border border-slate-800 rounded-xl overflow-hidden">
      <div className="px-4 py-2 bg-blue-950/40 border-b border-blue-500/30 text-xs font-bold uppercase tracking-wide text-blue-300">{league} Seasons</div>
      <div className="overflow-x-auto"><table className="w-full text-sm"><Head /><tbody>
        {reg && (regSplits && regSplits.length > 1
          ? <>
              {regSplits.map((sp, i) => <Row key={i} label={season} a={sp.agg} teamNode={sp.team} />)}
              <Row label={`${season} total`} a={reg} bold teamNode={<span className="text-slate-500">TOT</span>} />
            </>
          : <Row label={season} a={reg} teamNode={regSplits?.[0]?.team ?? team} />)}
      </tbody></table></div>
      {po && (
        <>
          <div className="px-4 py-2 bg-amber-950/30 border-y border-amber-500/30 text-xs font-bold uppercase tracking-wide text-amber-300">{league} Playoffs</div>
          <div className="overflow-x-auto"><table className="w-full text-sm"><Head /><tbody>
            {poSplits && poSplits.length > 1
              ? <>
                  {poSplits.map((sp, i) => <Row key={i} label={season} a={sp.agg} teamNode={sp.team} />)}
                  <Row label={`${season} total`} a={po} bold teamNode={<span className="text-slate-500">TOT</span>} />
                </>
              : <Row label={season} a={po} teamNode={poSplits?.[0]?.team ?? team} />}
          </tbody></table></div>
        </>
      )}
    </div>
  );
}

export default async function PlayerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ tab?: string; season?: string }>;
}) {
  const { id } = await params;
  const sParams = searchParams ? await searchParams : {};
  const [p, loggedIn, gmTeamId] = await Promise.all([getPlayer(id) as Promise<any>, isLoggedIn(), getTeamSession()]);
  const isGoalie: boolean = p.isGoalie || p.position === "G";
  // goalieRating.mo is never touched by the sim (it only writes the live
  // value to Player.mo/morale) — keep the live one, not the stale copy.
  const ratings = isGoalie ? { ...(p.goalieRating ?? {}), mo: p.mo } : p;
  const attrs = isGoalie ? GOALIE_ATTRS : SKATER_ATTRS;
  const overall: number | null = isGoalie ? (p.goalieRating?.overall ?? p.overall) : p.overall;
  const grp = posGroup(p.position, isGoalie);
  const ptype = playerType(isGoalie
    ? { id: p.id, isGoalie: true, position: p.position, ag: p.goalieRating?.ag, rb: p.goalieRating?.rb, sz: p.goalieRating?.sz }
    : { id: p.id, position: p.position, sc: p.sc, pa: p.pa, df: p.df, ck: p.ck, st: p.st, sk: p.sk, ph: p.ph });

  // Query distinct seasons where the player has played in our league
  const playedSeasonGames = await prisma.game.findMany({
    where: {
      OR: [
        { playerStats: { some: { playerId: p.id } } },
        { goalieStats: { some: { playerId: p.id } } },
      ],
      status: "FINAL",
    },
    select: { season: true },
    distinct: ["season"],
    orderBy: { season: "desc" },
  });
  const availableSeasons = playedSeasonGames.length > 0
    ? playedSeasonGames.map((g) => g.season)
    : [SEASON];
  const activeSeason = (sParams.season && availableSeasons.includes(sParams.season))
    ? sParams.season
    : availableSeasons[0] || SEASON;

  // Aggregate season, split by league (NHL / AHL) and regular / playoffs.
  const bucketKey = (league: string | null, seriesId: number | null) =>
    `${league === "AHL" ? "ahl" : "nhl"}${seriesId != null ? "Po" : "Reg"}`;
  const skB: Record<string, any[]> = { nhlReg: [], nhlPo: [], ahlReg: [], ahlPo: [] };
  const gB: Record<string, any[]> = { nhlReg: [], nhlPo: [], ahlReg: [], ahlPo: [] };

  if (isGoalie) {
    const rows = await prisma.goalieGameStat.findMany({
      where: { playerId: p.id, game: { season: activeSeason, status: "FINAL" } },
      select: {
        started: true, shotsAgainst: true, saves: true, goalsAgainst: true, decision: true,
        xga: true, teamId: true,
        game: {
          select: {
            league: true, seriesId: true, gameDate: true, homeTeamId: true, awayTeamId: true, homeGoals: true, awayGoals: true,
            goalEvents: { where: { emptyNet: true }, select: { teamId: true } },
          },
        },
      },
    });
    for (const r of rows) {
      if (!r.started && r.shotsAgainst === 0) continue;
      const isHome = r.teamId === r.game.homeTeamId;
      const teamGoals = (isHome ? r.game.homeGoals : r.game.awayGoals) ?? 0;
      const oppGoals = (isHome ? r.game.awayGoals : r.game.homeGoals) ?? 0;
      const enGoals = r.game.goalEvents.filter((g) => g.teamId === r.teamId).length;
      const effectiveTeamGoals = teamGoals - enGoals;
      const margin = Math.max(0, effectiveTeamGoals - oppGoals);
      const gameGsax = (r.xga ?? 0) - r.goalsAgainst;
      const isSteal = r.decision === "W" && gameGsax > margin;
      gB[bucketKey(r.game.league, r.game.seriesId)].push({ ...r, isSteal });
    }
  } else {
    const rows = await prisma.playerGameStat.findMany({
      where: { playerId: p.id, game: { season: activeSeason, status: "FINAL" } },
      select: {
        teamId: true, goals: true, assists: true, points: true, shots: true, pim: true, plusMinus: true,
        ppGoals: true, shGoals: true, gwg: true, hits: true, blocks: true, faceoffWins: true, faceoffLosses: true, toi: true, ppToi: true, pkToi: true,
        game: { select: { league: true, seriesId: true, gameDate: true } },
      },
    });
    for (const r of rows) skB[bucketKey(r.game.league, r.game.seriesId)].push(r);
  }

  const sk = {
    nhlReg: skB.nhlReg.length ? aggSkater(skB.nhlReg) : null, nhlPo: skB.nhlPo.length ? aggSkater(skB.nhlPo) : null,
    ahlReg: skB.ahlReg.length ? aggSkater(skB.ahlReg) : null, ahlPo: skB.ahlPo.length ? aggSkater(skB.ahlPo) : null,
  };
  const gl = {
    nhlReg: gB.nhlReg.length ? aggGoalie(gB.nhlReg) : null, nhlPo: gB.nhlPo.length ? aggGoalie(gB.nhlPo) : null,
    ahlReg: gB.ahlReg.length ? aggGoalie(gB.ahlReg) : null, ahlPo: gB.ahlPo.length ? aggGoalie(gB.ahlPo) : null,
  };

  // per-club split inside each bucket
  const splitIds = new Set<number>();
  const splitsOf = (rows: any[]): { teamId: number; rows: any[] }[] => {
    const by = new Map<number, { teamId: number; first: number; rows: any[] }>();
    for (const r of rows) {
      const t = r.game?.gameDate ? new Date(r.game.gameDate).getTime() : 0;
      const e: { teamId: number; first: number; rows: any[] } = by.get(r.teamId) ?? { teamId: r.teamId, first: t, rows: [] as any[] };
      e.first = Math.min(e.first, t); e.rows.push(r); by.set(r.teamId, e);
      splitIds.add(r.teamId);
    }
    return [...by.values()].sort((a, b) => a.first - b.first);
  };
  const rawSplits = Object.fromEntries((["nhlReg", "nhlPo", "ahlReg", "ahlPo"] as const).map((k) => [k, splitsOf(isGoalie ? gB[k] : skB[k])])) as Record<"nhlReg" | "nhlPo" | "ahlReg" | "ahlPo", { teamId: number; rows: any[] }[]>;
  const splitTeams = splitIds.size
    ? new Map((await prisma.team.findMany({ where: { id: { in: [...splitIds] } }, select: { id: true, code: true, name: true, logoUrl: true } })).map((t) => [t.id, t]))
    : new Map<number, { id: number; code: string | null; name: string; logoUrl: string | null }>();
  const mkSplits = (k: "nhlReg" | "nhlPo" | "ahlReg" | "ahlPo"): Split[] => rawSplits[k].map((sp) => {
    const t = splitTeams.get(sp.teamId);
    return {
      agg: isGoalie ? aggGoalie(sp.rows) : aggSkater(sp.rows),
      team: (
        <span className="inline-flex items-center gap-1.5">
          {t?.logoUrl && <img src={t.logoUrl} alt="" className="w-4 h-4 object-contain" />}
          <span className="font-medium">{t?.code ?? t?.name ?? "—"}</span>
        </span>
      ),
    };
  });
  const hasNhl = isGoalie ? !!(gl.nhlReg || gl.nhlPo) : !!(sk.nhlReg || sk.nhlPo);
  const hasAhl = isGoalie ? !!(gl.ahlReg || gl.ahlPo) : !!(sk.ahlReg || sk.ahlPo);

  const careerAll = await playerCareer(p.id);
  // Career = NHL only
  const career = { ...careerAll, skater: careerAll.skater.filter((r) => r.league === "NHL"), goalie: careerAll.goalie.filter((r) => r.league === "NHL") };
  const form = await playerForm(p.id);
  const heatMap = await playerHeatMap(p.id, activeSeason);
  const defenseMap = isGoalie ? null : await playerDefenseMap(p.id, activeSeason);
  const goalieStats = isGoalie ? await goalieAnalytics(p.id, activeSeason) : null;
  const tradeHistory = await playerTradeHistory(p.id);
  const txHistory = await playerTransactionHistory(p.id);
  const star = await starPowerForPlayer(p.id);

  // Skater advanced metrics for activeSeason
  let skaterAdvMetrics = null;
  if (!isGoalie) {
    const [advAgg, sitRows] = await Promise.all([
      prisma.playerGameStat.aggregate({
        where: { playerId: p.id, game: { season: activeSeason, status: "FINAL" } },
        _sum: { xg: true, hdShots: true, shifts: true, positiveShifts: true, goals: true, shots: true },
        _max: { topShot: true },
      }),
      prisma.playerSituationGameStat.groupBy({
        by: ["situation"],
        where: { playerId: p.id, game: { season: activeSeason, status: "FINAL" } },
        _sum: { toi: true, goals: true, assists: true, points: true, shots: true, xg: true, plusMinus: true },
      }),
    ]);
    const s = advAgg._sum;
    if (advAgg._max.topShot != null || (s.shifts ?? 0) > 0 || (s.shots ?? 0) > 0 || sitRows.length > 0) {
      skaterAdvMetrics = {
        xg: s.xg ?? 0,
        goals: s.goals ?? 0,
        hdShots: s.hdShots ?? 0,
        shots: s.shots ?? 0,
        topShot: advAgg._max.topShot ?? 0,
        shifts: s.shifts ?? 0,
        positiveShifts: s.positiveShifts ?? 0,
        situations: sitRows.map((r) => ({
          situation: r.situation,
          toi: r._sum.toi ?? 0,
          goals: r._sum.goals ?? 0,
          assists: r._sum.assists ?? 0,
          points: r._sum.points ?? 0,
          shots: r._sum.shots ?? 0,
          xg: r._sum.xg ?? 0,
          plusMinus: r._sum.plusMinus ?? 0,
        })).sort((a, b) => b.toi - a.toi),
      };
    }
  }

  // NHL game-by-game log (regular season)
  const nhlGL = { season: activeSeason, status: "FINAL" as const, league: "NHL", seriesId: null };
  const gameSel = { id: true, gameDate: true, homeTeamId: true, awayTeamId: true, homeGoals: true, awayGoals: true, homeTeam: { select: { code: true } }, awayTeam: { select: { code: true } } };
  const skaterLog = isGoalie ? [] : await prisma.playerGameStat.findMany({
    where: { playerId: p.id, game: nhlGL },
    select: { teamId: true, goals: true, assists: true, points: true, shots: true, pim: true, plusMinus: true, hits: true, blocks: true, toi: true, ppToi: true, pkToi: true, game: { select: gameSel } },
    orderBy: { game: { gameDate: "desc" } },
  });
  const goalieLogRaw = isGoalie ? await prisma.goalieGameStat.findMany({
    where: { playerId: p.id, started: true, game: nhlGL },
    select: {
      teamId: true, shotsAgainst: true, saves: true, goalsAgainst: true, decision: true, xga: true,
      game: {
        select: {
          ...gameSel,
          goalEvents: { where: { emptyNet: true }, select: { teamId: true } },
        },
      },
    },
    orderBy: { game: { gameDate: "desc" } },
  }) : [];
  const goalieLog = goalieLogRaw.map((r) => {
    const isHome = r.teamId === r.game.homeTeamId;
    const teamGoals = (isHome ? r.game.homeGoals : r.game.awayGoals) ?? 0;
    const oppGoals = (isHome ? r.game.awayGoals : r.game.homeGoals) ?? 0;
    const enGoals = r.game.goalEvents.filter((g) => g.teamId === r.teamId).length;
    const effectiveTeamGoals = teamGoals - enGoals;
    const margin = Math.max(0, effectiveTeamGoals - oppGoals);
    const gameGsax = (r.xga ?? 0) - r.goalsAgainst;
    const isSteal = r.decision === "W" && gameGsax > margin;
    return { ...r, isSteal };
  });

  const NOT_FREE_AGENT = ["NHL", "AHL", "RETIRED", "PROSPECT", "RELEASED", "NONROSTER"];
  const isFreeAgent = p.rosterType != null && !NOT_FREE_AGENT.includes(p.rosterType);
  const team = isFreeAgent ? null : (p.team as any);
  const teamCode: string = team?.code ?? team?.name ?? "—";
  const backHref = team ? `/teams/${team.slug}` : "/free-agents";

  const nhlTeamId = isGoalie
    ? (goalieLog[0]?.teamId ?? null)
    : (skaterLog.length ? [...skaterLog.reduce((m, r) => m.set(r.teamId, (m.get(r.teamId) ?? 0) + 1), new Map<number, number>()).entries()].sort((a, b) => b[1] - a[1])[0][0] : null);
  const nhlTeam = nhlTeamId && nhlTeamId !== team?.id
    ? await prisma.team.findUnique({ where: { id: nhlTeamId }, select: { code: true, name: true, slug: true, logoUrl: true } })
    : null;

  // Bio field values
  const flag = natFlag(p.nationality);
  const status = p.injuryDaysLeft > 0 ? "Injured" : (p.rosterType ?? "—");
  const contractType = p.contractType === "TWO_WAY" ? "Two-Way" : p.contractType === "ONE_WAY" ? "One-Way" : "—";
  const capHit = p.capHit != null ? money(p.capHit) : "—";
  const hasContract = (p.contractYears ?? 0) > 0;

  const leftInfo: [string, React.ReactNode][] = [
    ["Position", p.position ?? "—"],
    ["Date of Birth", formatDOB(p.birthDate)],
    ["Age", p.age != null ? String(p.age) : "—"],
    ["Height", p.height || "—"],
    ["Weight", p.weight != null ? `${p.weight} kg` : "—"],
    ["Condition", `${Math.round(p.condition ?? 100)}%`],
    ["Status", status],
    [isGoalie ? "Catches" : "Shoots", p.shoots ?? "—"],
  ];
  const retained = p.retainedSalary ?? 0;
  const retainedPct = retained > 0 && p.capHit ? Math.round((retained / p.capHit) * 100) : 0;
  const contractYearsN = p.contractYears ?? 0;
  const untilYear = contractYearsN > 0 ? seasonLabel(CURRENT_SEASON_START + contractYearsN - 1) : null;
  const expiryYear = CURRENT_SEASON_START + contractYearsN;
  const extN = p.extCapHit && p.extYears ? p.extYears : 0;
  const ageAtExpiry = p.birthDate != null ? ageAsOfJune30(p.birthDate, expiryYear + extN) : (p.age ?? 0) + contractYearsN + extN;
  const expiryStatus = contractYearsN > 0 ? (ageAtExpiry >= 27 ? "UFA" : "RFA") : null;
  const rightInfo: [string, React.ReactNode][] = [
    ["Contract Length", p.contractYears != null ? `${p.contractYears} yr${p.contractYears === 1 ? "" : "s"}` : "—"],
    ["Until", untilYear ?? "—"],
    ["Expiry Status", expiryStatus ? <span className={expiryStatus === "UFA" ? "text-red-400" : "text-blue-400"}>{expiryStatus}</span> : "—"],
    ["Type", contractType],
    [hasContract ? "Cap Hit" : "Previous Cap Hit", capHit],
    ...(retained > 0 ? ([
      ["Salary Retention", <span className="text-amber-300">{retainedPct}% retained</span>],
      ["Actual Salary after Retention", <b className="text-emerald-300">{money(Math.max(0, (p.capHit ?? 0) - retained))}</b>],
    ] as [string, React.ReactNode][]) : []),
    ...(hasContract ? ([["Last Year Salary", capHit]] as [string, React.ReactNode][]) : []),
    ...(p.extCapHit && p.extYears ? ([["Extension", <span key="ext" className="text-emerald-300">{money(p.extCapHit)} × {p.extYears} yr{p.extYears === 1 ? "" : "s"} <span className="text-slate-400 font-normal">from {seasonLabel(expiryYear)}</span>{p.extClause && <span className="ml-1.5 text-[11px] font-bold text-amber-300">{p.extClause === "M_NTC" ? "M-NTC" : p.extClause}{p.extClause === "M_NTC" && p.extNoTradeTeams?.length ? ` · ${p.extNoTradeTeams.length} teams` : ""}</span>}</span>]] as [string, React.ReactNode][]) : []),
    ...(p.tradeClause ? ([["Clause", <span key="clause" className="text-amber-300">{p.tradeClause === "M_NTC" ? "M-NTC" : p.tradeClause}{p.tradeClause === "M_NTC" && p.noTradeTeams?.length ? ` · ${p.noTradeTeams.length} teams protected` : ""}</span>]] as [string, React.ReactNode][]) : []),
  ];

  const InfoRow = ({ label, value, valueClass }: { label: string; value: React.ReactNode; valueClass?: string }) => (
    <div className="flex items-center justify-between gap-3 py-1.5 border-b border-white/5 last:border-0">
      <span className="text-xs uppercase tracking-wider text-slate-400">{label}</span>
      <span className={`text-sm font-semibold text-right ${valueClass ?? "text-slate-100"}`}>{value}</span>
    </div>
  );

  const TeamCell = () =>
    team ? (
      <span className="inline-flex items-center gap-1.5">
        {team.logoUrl && <img src={team.logoUrl} alt={teamCode} className="w-4 h-4 object-contain" />}
        <span className="font-medium">{teamCode}</span>
      </span>
    ) : (
      <span className="text-slate-600">—</span>
    );

  const NhlTeamCell = () =>
    nhlTeam ? (
      <span className="inline-flex items-center gap-1.5">
        {nhlTeam.logoUrl && <img src={nhlTeam.logoUrl} alt="" className="w-4 h-4 object-contain" />}
        <span className="font-medium">{nhlTeam.code ?? nhlTeam.name}</span>
      </span>
    ) : (
      <TeamCell />
    );

  // Tab content 1: Overview & Career
  const overviewContent = (
    <div className="space-y-6">
      {/* ── CAREER ─────────────────────────────────────────────────── */}
      <PlayerCareerCard career={career} />

      {/* ── TRADE / TRANSACTION HISTORY ───────────────────────────── */}
      <PlayerHistoryTabs
        tradeCard={<PlayerTradeHistoryCard playerName={cleanName(p.name)} history={tradeHistory} />}
        txCard={<PlayerTransactionHistoryCard history={txHistory} />}
      />
    </div>
  );

  // Tab content 2: Seasons & Analytics
  const seasonsContent = (
    <div className="space-y-6">
      {/* ── SEASON STAT TABLES ────────────────────────────────────── */}
      {hasNhl || hasAhl ? (
        <div className="space-y-6">
          {hasNhl && (
            <StatBlock
              league="NHL"
              cols={isGoalie ? GL_COLS : SK_COLS}
              reg={isGoalie ? gl.nhlReg : sk.nhlReg}
              po={isGoalie ? gl.nhlPo : sk.nhlPo}
              cellsOf={isGoalie ? glCells : skCells}
              team={<NhlTeamCell />}
              regSplits={mkSplits("nhlReg")}
              poSplits={mkSplits("nhlPo")}
              season={activeSeason}
            />
          )}
          {hasAhl && (
            <StatBlock
              league="AHL"
              cols={isGoalie ? GL_COLS : SK_COLS}
              reg={isGoalie ? gl.ahlReg : sk.ahlReg}
              po={isGoalie ? gl.ahlPo : sk.ahlPo}
              cellsOf={isGoalie ? glCells : skCells}
              team={<TeamCell />}
              regSplits={mkSplits("ahlReg")}
              poSplits={mkSplits("ahlPo")}
              season={activeSeason}
            />
          )}
        </div>
      ) : (
        <Card bodyClassName="py-8 text-center text-slate-500">
          Žiadne odohrané zápasy v sezóne {activeSeason}.
        </Card>
      )}

      {/* ── SKATER ADVANCED ANALYTICS & SITUATION SPLITS ─────────── */}
      {skaterAdvMetrics && <PlayerAdvancedStatsCard metrics={skaterAdvMetrics} />}

      {/* ── GOALIE ANALYTICS CENTER ────────────────────────────────── */}
      {goalieStats && <GoalieAnalyticsCard a={goalieStats} />}

      {/* ── SHOT / SAVE + DEFENSIVE HEAT MAPS ──────────────────────── */}
      {(heatMap || defenseMap) && (
        <div className="grid gap-4 lg:grid-cols-2">
          {heatMap && <RinkHeatMap map={heatMap} />}
          {defenseMap && <RinkDefenseMap map={defenseMap} />}
        </div>
      )}

      {/* ── GAME LOG ──────────────────────────────────────────────── */}
      <Card title={`Game Log · ${activeSeason}`} bodyClassName="p-0">
        <PlayerGameLog isGoalie={isGoalie} skater={skaterLog} goalie={goalieLog} />
      </Card>
    </div>
  );

  return (
    <div className="space-y-6 py-2">
      <BackLink fallback={backHref} label={team ? team.name : "Free Agents"} />

      {/* ── PLAYER BIO ─────────────────────────────────────────────── */}
      <Card title="Player Bio" bodyClassName="p-0">
        <div className="theme-dark-scope relative overflow-hidden bg-gradient-to-r from-[#0a1628] via-[#1e3a5f] to-[#0a1628]">
          {/* player action shot (NHL CDN) as the background */}
          {p.nhlId && (
            <img src={`https://assets.nhle.com/mugs/actionshots/1296x729/${p.nhlId}.jpg`} alt=""
              className="pointer-events-none absolute inset-0 w-full h-full object-cover object-[center_top] opacity-30" />
          )}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#0a1628] via-[#0a1628]/80 to-transparent" />
          {/* faint team logo, right */}
          {team?.logoUrl && (
            <img src={team.logoUrl} alt="" className="pointer-events-none absolute -right-6 top-1/2 -translate-y-1/2 w-56 h-56 object-contain opacity-[0.07]" />
          )}
          <div className="relative p-5 md:p-6">
            <div className="flex flex-col sm:flex-row items-start gap-5">
              {/* photo */}
              <div className="w-28 h-28 shrink-0 rounded-2xl overflow-hidden bg-slate-800/80 ring-1 ring-white/10 shadow-lg shadow-black/40">
                {p.photoUrl ? (
                  <img src={p.photoUrl} alt={cleanName(p.name)} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-4xl font-black text-slate-600">{p.name?.[0] ?? "?"}</div>
                )}
              </div>

              <div className="flex-1 min-w-0 w-full">
                {/* name row */}
                <div className="flex items-center gap-2.5 flex-wrap mb-1">
                  <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white">{cleanName(p.name)}</h1>
                  <span className="text-2xl md:text-3xl font-black text-slate-500">| #{p.number ?? "—"}</span>
                  {flag && <span className="text-2xl leading-none" title={p.nationality}>{flag}</span>}
                  {ptype && <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/30" title="Player type — derived from ratings">{ptype}</span>}
                  {star && (
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-800/80 border border-slate-600/40 ${tierAccent(star.tier)}`}>
                      ⭐ {star.tier} · {star.score}
                      <InfoTip text={`Star Power — business & media value (no on-ice effect). Drives merchandise, jersey sales, fan interest, ticket demand and sponsorships.${star.reasons.length ? " " + star.reasons.join(" · ") + "." : ""}`} />
                    </span>
                  )}
                  {(p.suspendedGames ?? 0) > 0 && (
                    <Link href="/league/player-safety" className="text-xs font-bold px-2.5 py-1 rounded-full bg-red-700/30 text-red-200 border border-red-600/40" title="Suspended by Player Safety — doesn't dress until served">
                      🚫 Suspended · {p.suspendedGames} game{p.suspendedGames === 1 ? "" : "s"} left
                    </Link>
                  )}
                  {p.tradeRequested && (
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-red-500/15 text-red-300 border border-red-500/30"
                      title={p.tradeRequestReason === "ice" ? "Unhappy with his ice time — has asked to be traded" : "Has asked to be traded"}>
                      📣 Trade requested
                    </span>
                  )}
                  {gmTeamId != null && (
                    <Link href={`/players/${p.id}/intelligence`}
                      className="ml-auto inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-blue-950/50 hover:bg-blue-900/60 text-blue-300 border border-blue-800/60 transition-colors">
                      🧠 UNHL Intelligence
                    </Link>
                  )}
                  <Link href={`/tools/compare?p=${p.id}`}
                    className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-600/40 transition-colors ${gmTeamId != null ? "" : "ml-auto"}`}>
                    ⚖ Player Comparison
                  </Link>
                  <a href={epProfileUrl(p.name)} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-600/40 transition-colors">
                    EliteProspects <span aria-hidden>↗</span>
                  </a>
                </div>
                {/* team line */}
                <div className="mb-4">
                  {team ? (
                    <Link href={`/teams/${team.slug}`} className="inline-flex items-center gap-1.5 text-sm text-slate-300 hover:text-blue-300 transition-colors">
                      {team.logoUrl && <img src={team.logoUrl} alt="" className="w-5 h-5 object-contain" />}
                      <span className="font-semibold">{team.name}</span>
                    </Link>
                  ) : (
                    <span className="text-sm text-slate-400">Free Agent</span>
                  )}
                </div>

                {/* 2-column info grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-0">
                  <div>
                    {leftInfo.map(([label, value]) => (
                      <InfoRow key={label} label={label} value={value} valueClass={label === "Status" && status === "Injured" ? "text-red-400" : undefined} />
                    ))}
                  </div>
                  <div>
                    {rightInfo.map(([label, value]) => (
                      <InfoRow key={label} label={label} value={value} />
                    ))}
                    {/* Current Form */}
                    <PlayerFormCard form={form} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── ATTRIBUTES — solid strip below the hero ── */}
        <div className="border-t border-slate-800 bg-slate-900">
          <div className="overflow-x-auto">
            <div className="flex min-w-max">
              {loggedIn ? attrs.map((a) => {
                const val = ratings[a.key] as number | null | undefined;
                return (
                  <div key={a.key} className="flex-1 min-w-[52px] text-center px-2 py-2.5 border-r border-slate-800">
                    <div className="text-[10px] font-bold text-slate-500 tracking-wide">{a.label}</div>
                    <div className={`text-lg font-semibold tabular-nums leading-tight ${ratingColor(grp, a.key, val)}`}>{val ?? "—"}</div>
                  </div>
                );
              }) : (
                <div className="flex-1 min-w-[240px] text-center px-3 py-2.5 text-xs text-slate-500">
                  🔒 <Link href="/login" className="text-blue-400 hover:underline">Sign in as a GM</Link> to see full player attributes.
                </div>
              )}
              <div className="min-w-[64px] text-center px-2 py-2.5 bg-slate-800/60 border-l border-slate-700">
                <div className="text-[10px] font-bold text-slate-400 tracking-wide">OV</div>
                <div className={`text-lg font-black tabular-nums leading-tight ${ovColor(grp, overall)}`}>{overall ?? "—"}</div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* ── INJURY (if active) ─────────────────────────────────────── */}
      {p.injuryDaysLeft > 0 && (() => {
        const sev: string = p.injurySeverity ?? (p.injuryDaysLeft >= 120 ? "Season-ending" : p.injuryDaysLeft >= 45 ? "Long-term" : p.injuryDaysLeft >= 20 ? "Multi-week" : p.injuryDaysLeft >= 7 ? "Week-to-Week" : "Day-to-Day");
        const sevCls = sev === "Season-ending" ? "text-red-500 font-bold" : sev === "Long-term" ? "text-red-400" : sev === "Multi-week" ? "text-orange-400" : sev === "Week-to-Week" ? "text-amber-400" : "text-slate-400";
        const eta = p.injuryDaysLeft <= 6 ? `${p.injuryDaysLeft}d` : p.injuryDaysLeft < 14 ? "~1 week" : p.injuryDaysLeft < 45 ? `~${Math.round(p.injuryDaysLeft / 7)} weeks` : p.injuryDaysLeft < 120 ? `~${Math.round(p.injuryDaysLeft / 30)} months` : "out for the season";
        const ltir = onLtir({ capHit: p.capHit, injuryDaysLeft: p.injuryDaysLeft, condition: p.condition, isGoalie: p.isGoalie });
        return (
          <Card title="Injury" accent="text-red-400">
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-300">{p.injuryDesc || "Injured"}</span>
                <span className={`text-xs font-semibold ${sevCls}`}>{sev}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Est. return: <span className="text-amber-400 font-semibold">{eta}</span> <span className="text-slate-600">({p.injuryDaysLeft} days)</span></span>
                {ltir
                  ? <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300" title={`On LTIR — the club may exceed the cap by his ${money(liveCapHit(p))} hit to call up a replacement.`}>LTIR · +{money(liveCapHit(p))}</span>
                  : (sev === "Multi-week" ? <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-300">IR</span> : null)}
              </div>
            </div>
          </Card>
        );
      })()}

      {/* ── PROFILE TABS: OVERVIEW & CAREER vs SEASONS & ANALYTICS ──── */}
      <PlayerProfileTabs
        overviewContent={overviewContent}
        seasonsContent={seasonsContent}
        availableSeasons={availableSeasons}
        currentSeason={activeSeason}
        playerSlugOrId={p.slug ?? p.id}
      />
    </div>
  );
}
