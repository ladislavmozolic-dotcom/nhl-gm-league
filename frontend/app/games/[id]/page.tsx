import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import GameView from "@/components/GameView";
import type { PbpEvent, ShootoutAttempt } from "@/lib/sim/types";
import type { TeamLinesData } from "@/lib/sim/lines";
import { cleanName } from "@/lib/playerName";
import GameIntegrity from "@/components/GameIntegrity";
import PostGameIntelCard from "@/components/PostGameIntelCard";
import { gameStory } from "@/lib/game-report-server";
import { getTeamSession } from "@/lib/auth";

// Resolve an already-fully-deployed TeamLinesData into the Lines tab's display
// groups (player ids -> names). Shared by the frozen game-time snapshot and the
// live-lines fallback below.
function lineGroupsFromData(ld: TeamLinesData, nameOf: Map<number, string>) {
  const nm = (id: number | null | undefined) => (id == null ? null : nameOf.get(id) ?? null);
  const s = ld.situations;
  const NT = { phy: 1, df: 2, of: 2 };
  return [
    { title: "5 vs 5 Forward", cols: ["Left Wing", "Center", "Right Wing"], units: ld.forwardLines.map((l, i) => ({ n: i + 1, players: [nm(l.lw), nm(l.c), nm(l.rw)], tactic: l.tactic ?? NT, wanted: l.timePct })) },
    { title: "5 vs 5 Defense", cols: ["Left D", "Right D"], units: ld.defensePairs.map((p, i) => ({ n: i + 1, players: [nm(p.ld), nm(p.rd)], tactic: p.tactic ?? NT, wanted: p.timePct })) },
    { title: "Power Play", cols: ["LW", "C", "RW", "LD", "RD"], units: s.pp.map((u, i) => ({ n: i + 1, players: u.players.map(nm), tactic: u.tactic ?? { phy: 0, df: 1, of: 4 }, wanted: u.timePct })) },
    { title: "Power Play 4 on 3", cols: ["F1", "F2", "F3", "D1"], units: s.pp4.map((u, i) => ({ n: i + 1, players: u.players.map(nm), tactic: u.tactic ?? { phy: 0, df: 1, of: 4 }, wanted: u.timePct })) },
    { title: "Penalty Kill (4)", cols: ["C", "W", "LD", "RD"], units: s.pk4.map((u, i) => ({ n: i + 1, players: u.players.map(nm), tactic: u.tactic ?? { phy: 1, df: 4, of: 0 }, wanted: u.timePct })) },
    { title: "Penalty Kill (3)", cols: ["C", "LD", "RD"], units: s.pk3.map((u, i) => ({ n: i + 1, players: u.players.map(nm), tactic: u.tactic ?? { phy: 1, df: 4, of: 0 }, wanted: u.timePct })) },
    { title: "4 vs 4", cols: ["C", "W", "LD", "RD"], units: s.fourVFour.map((u, i) => ({ n: i + 1, players: u.players.map(nm), tactic: u.tactic ?? NT, wanted: u.timePct })) },
    { title: "Overtime (3 vs 3)", cols: ["OT1", "OT2", "OT3"], units: s.overtime.map((u, i) => ({ n: i + 1, players: u.players.map(nm), tactic: u.tactic ?? { phy: 0, df: 1, of: 4 }, wanted: u.timePct })) },
  ];
}

type BoxSkater = { playerId: number; toi: number; ppToi: number; pkToi: number; name: string; position: string | null };

const isDefPos = (pos: string | null) => /(^|\/)D(\/|$)/.test(pos ?? "") || pos === "D";
const chunk = <T,>(arr: T[], n: number) => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
};
const shareOf = (group: BoxSkater[], total: number, key: "toi" | "ppToi" | "pkToi" = "toi") =>
  total > 0 ? Math.round((group.reduce((a, s) => a + s[key], 0) / total) * 1000) / 10 : 0;

// A pre-fix game has no frozen snapshot (see below), so reconstruct the Lines tab
// straight from what was actually PLAYED — the persisted box score — instead of
// today's live (and by now likely different) Lines. Every name shown here is
// guaranteed to have an actual stat row for this exact game; grouping into
// lines/pairs/PP/PK units is inferred from ice-time rank (best-effort — the real
// linemate pairings from that night were never recorded before this fix shipped).
async function reconstructFromBoxScore(gameId: number, teamId: number) {
  const skaterRows = await prisma.playerGameStat.findMany({
    where: { gameId, teamId },
    select: { playerId: true, toi: true, ppToi: true, pkToi: true, player: { select: { name: true, position: true } } },
  });
  const skaters: BoxSkater[] = skaterRows.map((s) => ({
    playerId: s.playerId, toi: s.toi, ppToi: s.ppToi ?? 0, pkToi: s.pkToi ?? 0,
    name: cleanName(s.player.name), position: s.player.position,
  }));
  const nm = (s: BoxSkater | undefined) => s?.name ?? null;
  const NT = { phy: 1, df: 2, of: 2 };

  // 5v5 forward lines / D pairs, ranked by even-strength TOI (total minus special
  // teams) so a PP/PK workhorse doesn't out-rank his actual 5v5 linemates.
  const evToi = (s: BoxSkater) => Math.max(0, s.toi - s.ppToi - s.pkToi);
  const fwds = skaters.filter((s) => !isDefPos(s.position)).sort((a, b) => evToi(b) - evToi(a));
  const defs = skaters.filter((s) => isDefPos(s.position)).sort((a, b) => evToi(b) - evToi(a));
  const totalFEv = fwds.reduce((a, s) => a + evToi(s), 0);
  const totalDEv = defs.reduce((a, s) => a + evToi(s), 0);
  const slotForward = (three: BoxSkater[]) => {
    const c = three.find((p) => (p.position ?? "").includes("C")) ?? three[0];
    const rest = three.filter((p) => p !== c);
    const rw = rest.find((p) => (p.position ?? "").includes("RW")) ?? rest[0];
    const lw = rest.find((p) => p !== rw) ?? rest[1];
    return [nm(lw), nm(c), nm(rw)];
  };
  const forwardLines = chunk(fwds, 3).slice(0, 4).map((line, i) => ({
    n: i + 1, players: slotForward(line), tactic: NT,
    wanted: totalFEv > 0 ? Math.round((line.reduce((a, s) => a + evToi(s), 0) / totalFEv) * 1000) / 10 : 0,
  }));
  const defensePairs = chunk(defs, 2).slice(0, 3).map((pair, i) => ({
    n: i + 1, players: [nm(pair[0]), nm(pair[1])], tactic: NT,
    wanted: totalDEv > 0 ? Math.round((pair.reduce((a, s) => a + evToi(s), 0) / totalDEv) * 1000) / 10 : 0,
  }));

  // Power play / penalty kill: same idea, ranked by that special-teams TOI itself.
  const ppF = [...skaters].filter((s) => !isDefPos(s.position) && s.ppToi > 0).sort((a, b) => b.ppToi - a.ppToi);
  const ppD = [...skaters].filter((s) => isDefPos(s.position) && s.ppToi > 0).sort((a, b) => b.ppToi - a.ppToi);
  const ppUnits = chunk(ppF, 3).slice(0, 2).map((f, i) => {
    const d = chunk(ppD, 2)[i] ?? [];
    return { n: i + 1, players: [nm(f[0]), nm(f[1]), nm(f[2]), nm(d[0]), nm(d[1])], tactic: { phy: 0, df: 1, of: 4 }, wanted: shareOf(f, ppF.reduce((a, s) => a + s.ppToi, 0), "ppToi") };
  });
  const pkF = [...skaters].filter((s) => !isDefPos(s.position) && s.pkToi > 0).sort((a, b) => b.pkToi - a.pkToi);
  const pkD = [...skaters].filter((s) => isDefPos(s.position) && s.pkToi > 0).sort((a, b) => b.pkToi - a.pkToi);
  const pk4Units = chunk(pkF, 2).slice(0, 2).map((f, i) => {
    const d = chunk(pkD, 2)[i] ?? [];
    return { n: i + 1, players: [nm(f[0]), nm(f[1]), nm(d[0]), nm(d[1])], tactic: { phy: 1, df: 4, of: 0 }, wanted: shareOf(f, pkF.reduce((a, s) => a + s.pkToi, 0), "pkToi") };
  });

  return [
    { title: "5 vs 5 Forward", cols: ["Left Wing", "Center", "Right Wing"], units: forwardLines },
    { title: "5 vs 5 Defense", cols: ["Left D", "Right D"], units: defensePairs },
    { title: "Power Play", cols: ["LW", "C", "RW", "LD", "RD"], units: ppUnits },
    { title: "Power Play 4 on 3", cols: ["F1", "F2", "F3", "D1"], units: [] as typeof ppUnits },
    { title: "Penalty Kill (4)", cols: ["C", "W", "LD", "RD"], units: pk4Units },
    { title: "Penalty Kill (3)", cols: ["C", "LD", "RD"], units: [] as typeof pk4Units },
    { title: "4 vs 4", cols: ["C", "W", "LD", "RD"], units: [] as typeof pk4Units },
    { title: "Overtime (3 vs 3)", cols: ["OT1", "OT2", "OT3"], units: [] as typeof pk4Units },
  ];
}

// Build every line unit for the Lines tab. `snapshot` is the exact TeamLinesData
// frozen at simulation time (Game.homeLines/awayLines) — always prefer it, since
// the GM's live Lines can (and often does) change after the game is played, which
// must never rewrite a past game's report. A game simulated before this snapshot
// existed (no `snapshot`) instead reconstructs from that game's own box score —
// never from today's live Lines, which by now may bear no relation to it.
async function buildLineGroups(teamId: number, snapshot: TeamLinesData | null | undefined, gameId: number) {
  if (snapshot) {
    const roster = await prisma.player.findMany({ where: { teamId }, select: { id: true, name: true } });
    const nameOf = new Map(roster.map((p) => [p.id, cleanName(p.name)]));
    return lineGroupsFromData(snapshot, nameOf);
  }
  return reconstructFromBoxScore(gameId, teamId);
}

import GamePreviewView, { type MatchPreviewData } from "@/components/GamePreviewView";
import { computeStandings } from "@/lib/sim/standings";
import { skaterTotals, goalieTotals } from "@/lib/stats-server";
import { loadTeamLines } from "@/lib/sim/lines";
import { livePlayerOverall } from "@/lib/player-overall";

import type { TeamTactics } from "@/lib/sim/tactics";

async function buildMatchPreviewData(game: any, me: number | null): Promise<MatchPreviewData> {
  const league = game.league ?? "NHL";
  const season = game.season;

  const [standings, allSkaters, allGoalies, homeLines, awayLines, homeLast5, awayLast5, h2hGames] = await Promise.all([
    computeStandings(season, league).catch(() => []),
    skaterTotals(season, league).catch(() => []),
    goalieTotals(season, league).catch(() => []),
    loadTeamLines(game.homeTeamId).catch(() => null),
    loadTeamLines(game.awayTeamId).catch(() => null),
    prisma.game.findMany({
      where: {
        status: "FINAL",
        season,
        league,
        seriesId: null,
        OR: [{ homeTeamId: game.homeTeamId }, { awayTeamId: game.homeTeamId }],
        ...(game.gameDate ? { gameDate: { lt: game.gameDate } } : {}),
      },
      orderBy: [{ gameDate: "desc" }, { id: "desc" }],
      take: 5,
      include: {
        homeTeam: { select: { id: true, code: true, name: true, logoUrl: true } },
        awayTeam: { select: { id: true, code: true, name: true, logoUrl: true } },
      },
    }),
    prisma.game.findMany({
      where: {
        status: "FINAL",
        season,
        league,
        seriesId: null,
        OR: [{ homeTeamId: game.awayTeamId }, { awayTeamId: game.awayTeamId }],
        ...(game.gameDate ? { gameDate: { lt: game.gameDate } } : {}),
      },
      orderBy: [{ gameDate: "desc" }, { id: "desc" }],
      take: 5,
      include: {
        homeTeam: { select: { id: true, code: true, name: true, logoUrl: true } },
        awayTeam: { select: { id: true, code: true, name: true, logoUrl: true } },
      },
    }),
    prisma.game.findMany({
      where: {
        status: "FINAL",
        season,
        league,
        seriesId: null,
        OR: [
          { homeTeamId: game.homeTeamId, awayTeamId: game.awayTeamId },
          { homeTeamId: game.awayTeamId, awayTeamId: game.homeTeamId },
        ],
      },
      orderBy: [{ gameDate: "desc" }, { id: "desc" }],
      take: 5,
      include: {
        homeTeam: { select: { id: true, code: true, name: true, logoUrl: true } },
        awayTeam: { select: { id: true, code: true, name: true, logoUrl: true } },
      },
    }),
  ]);

  // Standings lookup
  const homeStIdx = standings.findIndex((s) => s.teamId === game.homeTeamId);
  const awayStIdx = standings.findIndex((s) => s.teamId === game.awayTeamId);
  const homeSt = homeStIdx >= 0 ? standings[homeStIdx] : null;
  const awaySt = awayStIdx >= 0 ? standings[awayStIdx] : null;
  const confRankOf = (st: typeof homeSt) => {
    if (!st) return 0;
    const sameConf = standings.filter((s) => s.conference === st.conference);
    return sameConf.findIndex((s) => s.teamId === st.teamId) + 1;
  };

  // Top skaters per team
  const homeTopSkaters = allSkaters
    .filter((s) => s.teamId === game.homeTeamId && s.gp > 0)
    .sort((a, b) => b.points - a.points || b.goals - a.goals)
    .slice(0, 5);
  const awayTopSkaters = allSkaters
    .filter((s) => s.teamId === game.awayTeamId && s.gp > 0)
    .sort((a, b) => b.points - a.points || b.goals - a.goals)
    .slice(0, 5);

  const [fallbackHomeSkaters, fallbackAwaySkaters] = await Promise.all([
    homeTopSkaters.length === 0
      ? prisma.player.findMany({
          where: { teamId: game.homeTeamId, isGoalie: false, rosterType: league === "AHL" ? "AHL" : "NHL", scratched: false },
          orderBy: { overall: "desc" },
          take: 5,
          select: { id: true, name: true, slug: true, position: true, overall: true, number: true, photoUrl: true, age: true, shoots: true, isGoalie: true },
        })
      : Promise.resolve([]),
    awayTopSkaters.length === 0
      ? prisma.player.findMany({
          where: { teamId: game.awayTeamId, isGoalie: false, rosterType: league === "AHL" ? "AHL" : "NHL", scratched: false },
          orderBy: { overall: "desc" },
          take: 5,
          select: { id: true, name: true, slug: true, position: true, overall: true, number: true, photoUrl: true, age: true, shoots: true, isGoalie: true },
        })
      : Promise.resolve([]),
  ]);

  const neededPlayerIds = [
    ...homeTopSkaters.map((s) => s.playerId),
    ...awayTopSkaters.map((s) => s.playerId),
    ...fallbackHomeSkaters.map((s) => s.id),
    ...fallbackAwaySkaters.map((s) => s.id),
    homeLines?.situations?.others?.starter,
    homeLines?.situations?.others?.backup,
    awayLines?.situations?.others?.starter,
    awayLines?.situations?.others?.backup,
  ].filter((id): id is number => id != null);

  const playerMeta = neededPlayerIds.length
    ? await prisma.player.findMany({
        where: { id: { in: neededPlayerIds } },
        select: { id: true, name: true, slug: true, position: true, overall: true, number: true, photoUrl: true, age: true, shoots: true, isGoalie: true, goalieRating: { select: { overall: true } } },
      })
    : [];
  const pMetaMap = new Map(playerMeta.map((p) => [p.id, p]));

  // Goalies
  const getGoalieObj = async (teamId: number, lines: typeof homeLines) => {
    const starterId = lines?.situations?.others?.starter;
    const backupId = lines?.situations?.others?.backup;
    let sPlayer = starterId ? pMetaMap.get(starterId) : null;
    let bPlayer = backupId ? pMetaMap.get(backupId) : null;

    if (!sPlayer) {
      const fallbackGoalies = await prisma.player.findMany({
        where: { teamId, isGoalie: true, rosterType: league === "AHL" ? "AHL" : "NHL", scratched: false },
        include: { goalieRating: { select: { overall: true } } },
        orderBy: { overall: "desc" },
      });
      fallbackGoalies.sort((a, b) => (livePlayerOverall(b) ?? 0) - (livePlayerOverall(a) ?? 0));
      if (fallbackGoalies[0]) sPlayer = fallbackGoalies[0];
      if (fallbackGoalies[1]) bPlayer = fallbackGoalies[1];
    }

    const sStats = sPlayer ? allGoalies.find((g) => g.playerId === sPlayer!.id && g.teamId === teamId) : null;
    const bStats = bPlayer ? allGoalies.find((g) => g.playerId === bPlayer!.id && g.teamId === teamId) : null;

    return {
      starter: sPlayer
        ? {
            id: sPlayer.id,
            name: cleanName(sPlayer.name),
            slug: sPlayer.slug,
            overall: livePlayerOverall(sPlayer) ?? 75,
            age: sPlayer.age ?? undefined,
            catches: sPlayer.shoots ?? "L",
            photoUrl: sPlayer.photoUrl,
            stats: sStats
              ? { gp: sStats.gp, w: sStats.wins, l: sStats.losses, otl: sStats.otl, gaa: sStats.gaa, svPct: sStats.svPct, shutouts: sStats.shutouts }
              : undefined,
          }
        : null,
      backup: bPlayer
        ? {
            id: bPlayer.id,
            name: cleanName(bPlayer.name),
            slug: bPlayer.slug,
            overall: livePlayerOverall(bPlayer) ?? 70,
            age: bPlayer.age ?? undefined,
            catches: bPlayer.shoots ?? "L",
            photoUrl: bPlayer.photoUrl,
            stats: bStats
              ? { gp: bStats.gp, w: bStats.wins, l: bStats.losses, otl: bStats.otl, gaa: bStats.gaa, svPct: bStats.svPct, shutouts: bStats.shutouts }
              : undefined,
          }
        : null,
    };
  };

  const [homeGoalies, awayGoalies] = await Promise.all([
    getGoalieObj(game.homeTeamId, homeLines),
    getGoalieObj(game.awayTeamId, awayLines),
  ]);

  const mapForm = (gamesList: typeof homeLast5, teamId: number) => {
    return gamesList.map((g) => {
      const isHome = g.homeTeamId === teamId;
      const opp = isHome ? g.awayTeam : g.homeTeam;
      const goalsFor = isHome ? g.homeGoals ?? 0 : g.awayGoals ?? 0;
      const goalsAgainst = isHome ? g.awayGoals ?? 0 : g.homeGoals ?? 0;
      let result = "L";
      if (goalsFor > goalsAgainst) {
        result = g.endedIn === "REG" ? "W" : "OTW";
      } else {
        result = g.endedIn === "REG" ? "L" : "OTL";
      }
      const d = g.gameDate ? new Date(g.gameDate) : null;
      const date = d ? `${d.getUTCDate()}.${d.getUTCMonth() + 1}.` : "—";
      return {
        gameId: g.id,
        isHome,
        oppCode: opp.code ?? opp.name,
        oppName: opp.name,
        oppLogo: opp.logoUrl,
        goalsFor,
        goalsAgainst,
        result,
        endedIn: g.endedIn ?? "REG",
        date,
      };
    });
  };

  const mapH2h = h2hGames.map((g) => {
    const d = g.gameDate ? new Date(g.gameDate) : null;
    const date = d ? `${d.getUTCDate()}.${d.getUTCMonth() + 1}.` : "—";
    return {
      gameId: g.id,
      homeTeamCode: g.homeTeam.code ?? g.homeTeam.name,
      homeTeamLogo: g.homeTeam.logoUrl,
      homeGoals: g.homeGoals ?? 0,
      awayTeamCode: g.awayTeam.code ?? g.awayTeam.name,
      awayTeamLogo: g.awayTeam.logoUrl,
      awayGoals: g.awayGoals ?? 0,
      endedIn: g.endedIn ?? "REG",
      date,
    };
  });

  // Tactics
  const defaultTactics: TeamTactics = { tempo: "balanced", forecheck: "balanced", puckStyle: "balanced", dZone: "balanced", ppStyle: "balanced", pkStyle: "balanced" };
  const homeSys: TeamTactics = (homeLines?.system as TeamTactics) ?? defaultTactics;
  const awaySys: TeamTactics = (awayLines?.system as TeamTactics) ?? defaultTactics;

  // Build projected lines
  const buildLinesForTeam = async (teamId: number, lines: typeof homeLines) => {
    if (!lines) return [];
    const teamPlayers = await prisma.player.findMany({
      where: { teamId },
      select: { id: true, name: true, slug: true, position: true },
    });
    const pMap = new Map(teamPlayers.map((p) => [p.id, { id: p.id, name: cleanName(p.name), slug: p.slug, pos: p.position ?? undefined }]));
    const getP = (id: number | null | undefined) => (id ? pMap.get(id) ?? null : null);

    return [
      {
        title: "5 vs 5 Forward Lines",
        cols: ["LW", "C", "RW"],
        units: lines.forwardLines.map((l, i) => ({
          n: i + 1,
          players: [getP(l.lw), getP(l.c), getP(l.rw)],
          tactic: l.tactic,
        })),
      },
      {
        title: "5 vs 5 Defense Pairs",
        cols: ["LD", "RD"],
        units: lines.defensePairs.map((p, i) => ({
          n: i + 1,
          players: [getP(p.ld), getP(p.rd)],
          tactic: p.tactic,
        })),
      },
    ];
  };

  const [homeLineGroups, awayLineGroups] = await Promise.all([
    buildLinesForTeam(game.homeTeamId, homeLines),
    buildLinesForTeam(game.awayTeamId, awayLines),
  ]);

  return {
    gameId: game.id,
    season: game.season,
    league: game.league,
    gameDate: game.gameDate ? game.gameDate.toISOString() : null,
    round: game.round,
    status: game.status,
    homeTeam: {
      id: game.homeTeam.id,
      name: game.homeTeam.name,
      code: game.homeTeam.code ?? game.homeTeam.name,
      slug: game.homeTeam.slug,
      logoUrl: game.homeTeam.logoUrl,
      conference: game.homeTeam.conference,
      division: game.homeTeam.division,
      arena: game.homeTeam.arena,
      standing: homeSt
        ? {
            gp: homeSt.gp,
            w: homeSt.w,
            l: homeSt.l,
            otl: homeSt.otl,
            pts: homeSt.points,
            rank: homeStIdx + 1,
            confRank: confRankOf(homeSt),
            gf: homeSt.gf,
            ga: homeSt.ga,
            diff: homeSt.diff,
            streak: "",
          }
        : null,
    },
    awayTeam: {
      id: game.awayTeam.id,
      name: game.awayTeam.name,
      code: game.awayTeam.code ?? game.awayTeam.name,
      slug: game.awayTeam.slug,
      logoUrl: game.awayTeam.logoUrl,
      conference: game.awayTeam.conference,
      division: game.awayTeam.division,
      arena: game.awayTeam.arena,
      standing: awaySt
        ? {
            gp: awaySt.gp,
            w: awaySt.w,
            l: awaySt.l,
            otl: awaySt.otl,
            pts: awaySt.points,
            rank: awayStIdx + 1,
            confRank: confRankOf(awaySt),
            gf: awaySt.gf,
            ga: awaySt.ga,
            diff: awaySt.diff,
            streak: "",
          }
        : null,
    },
    startingGoalies: {
      home: homeGoalies,
      away: awayGoalies,
    },
    topScorers: {
      home: homeTopSkaters.length > 0
        ? homeTopSkaters.map((s) => {
            const pm = pMetaMap.get(s.playerId);
            return {
              id: s.playerId,
              name: cleanName(s.name),
              slug: pm?.slug ?? null,
              position: s.position,
              number: s.number,
              overall: (pm ? livePlayerOverall(pm) : null) ?? 75,
              photoUrl: pm?.photoUrl ?? null,
              age: pm?.age ?? undefined,
              gp: s.gp,
              goals: s.goals,
              assists: s.assists,
              points: s.points,
              plusMinus: s.plusMinus,
            };
          })
        : fallbackHomeSkaters.map((p) => {
            const pm = pMetaMap.get(p.id) ?? p;
            return {
              id: p.id,
              name: cleanName(p.name),
              slug: p.slug ?? null,
              position: p.position ?? "F",
              number: p.number ?? null,
              overall: livePlayerOverall(pm) ?? 75,
              photoUrl: p.photoUrl ?? null,
              age: p.age ?? undefined,
              gp: 0,
              goals: 0,
              assists: 0,
              points: 0,
              plusMinus: 0,
            };
          }),
      away: awayTopSkaters.length > 0
        ? awayTopSkaters.map((s) => {
            const pm = pMetaMap.get(s.playerId);
            return {
              id: s.playerId,
              name: cleanName(s.name),
              slug: pm?.slug ?? null,
              position: s.position,
              number: s.number,
              overall: (pm ? livePlayerOverall(pm) : null) ?? 75,
              photoUrl: pm?.photoUrl ?? null,
              age: pm?.age ?? undefined,
              gp: s.gp,
              goals: s.goals,
              assists: s.assists,
              points: s.points,
              plusMinus: s.plusMinus,
            };
          })
        : fallbackAwaySkaters.map((p) => {
            const pm = pMetaMap.get(p.id) ?? p;
            return {
              id: p.id,
              name: cleanName(p.name),
              slug: p.slug ?? null,
              position: p.position ?? "F",
              number: p.number ?? null,
              overall: livePlayerOverall(pm) ?? 75,
              photoUrl: p.photoUrl ?? null,
              age: p.age ?? undefined,
              gp: 0,
              goals: 0,
              assists: 0,
              points: 0,
              plusMinus: 0,
            };
          }),
    },
    recentForm: {
      home: mapForm(homeLast5, game.homeTeamId),
      away: mapForm(awayLast5, game.awayTeamId),
    },
    h2h: mapH2h,
    tactics: {
      home: {
        preset: homeSys.preset,
        tempo: homeSys.tempo,
        forecheck: homeSys.forecheck,
        puckStyle: homeSys.puckStyle,
        dZone: homeSys.dZone,
        ppStyle: homeSys.ppStyle,
        pkStyle: homeSys.pkStyle,
      },
      away: {
        preset: awaySys.preset,
        tempo: awaySys.tempo,
        forecheck: awaySys.forecheck,
        puckStyle: awaySys.puckStyle,
        dZone: awaySys.dZone,
        ppStyle: awaySys.ppStyle,
        pkStyle: awaySys.pkStyle,
      },
    },
    lines: {
      home: homeLineGroups,
      away: awayLineGroups,
    },
    userTeamId: me,
  };
}

export default async function GamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const game = await prisma.game.findUnique({
    where: { id: Number(id) },
    include: {
      homeTeam: true,
      awayTeam: true,
      goalEvents: { orderBy: [{ period: "asc" }, { seconds: "asc" }] },
      penaltyEvents: { orderBy: [{ period: "asc" }, { seconds: "asc" }] },
      playerStats: { include: { player: { select: { name: true, position: true, slug: true, number: true } } } },
      goalieStats: { include: { player: { select: { name: true, slug: true } } } },
    },
  });
  if (!game) notFound();

  const me = await getTeamSession();

  if (game.status !== "FINAL") {
    const previewData = await buildMatchPreviewData(game, me);
    return <GamePreviewView data={previewData} />;
  }

  const teamMeta = (t: typeof game.homeTeam) => ({
    teamId: t.id, name: t.name, slug: t.slug, logoUrl: t.logoUrl, code: t.code,
  });

  const skaters = (teamId: number) => game.playerStats
    .filter((s) => s.teamId === teamId)
    .map((s) => ({
      id: s.playerId, name: s.player.name, position: s.player.position, slug: s.player.slug,
      goals: s.goals, assists: s.assists, points: s.points, shots: s.shots, pim: s.pim,
      plusMinus: s.plusMinus, ppGoals: s.ppGoals, shGoals: s.shGoals, gwg: s.gwg,
      hits: s.hits, blocks: s.blocks, faceoffWins: s.faceoffWins, faceoffLosses: s.faceoffLosses,
      toi: s.toi, ppToi: s.ppToi, pkToi: s.pkToi, conAfter: s.conAfter, xg: s.xg, hdShots: s.hdShots,
    }))
    .sort((a, b) => b.points - a.points || b.goals - a.goals || b.toi - a.toi);

  // enrich goals with scorer/assist slugs + which goal of the season each was
  const scorerIds = [...new Set(game.goalEvents.map((g) => g.scorerId))];
  const assistIds = [...new Set(game.goalEvents.flatMap((g) => g.assistIds))];
  // "prior" = games earlier in the season than this one. Order by `round` (the
  // scheduling day) — gameDate isn't always set, which used to make this count
  // the whole season, so a game-1 scorer showed a 30-goal total.
  // running season goal/assist totals must stay within THIS game's league — an NHL box
  // score shows NHL totals, an AHL box score shows AHL totals (not the two combined).
  const priorGame = game.round != null
    ? { status: "FINAL" as const, seriesId: null, season: game.season, league: game.league, round: { lt: game.round } }
    : { status: "FINAL" as const, seriesId: null, season: game.season, league: game.league, id: { lt: game.id } };
  const [priorGoals, priorAssists, involved] = await Promise.all([
    scorerIds.length ? prisma.gameGoal.groupBy({ by: ["scorerId"], where: { scorerId: { in: scorerIds }, game: priorGame }, _count: { _all: true } }) : Promise.resolve([]),
    assistIds.length ? prisma.playerGameStat.groupBy({ by: ["playerId"], where: { playerId: { in: assistIds }, game: priorGame }, _sum: { assists: true } }) : Promise.resolve([]),
    prisma.player.findMany({ where: { id: { in: [...new Set([...scorerIds, ...assistIds])] } }, select: { id: true, slug: true } }),
  ]);
  const priorGoalMap = new Map(priorGoals.map((p) => [p.scorerId, p._count._all]));
  const priorAssistMap = new Map(priorAssists.map((a) => [a.playerId, a._sum.assists ?? 0]));
  const runningAssist = new Map<number, number>();
  const slugById = new Map(involved.map((p) => [p.id, p.slug]));
  const runningGoal = new Map<number, number>();

  // each goalie's season W-L-OTL record THROUGH this game (same season/league,
  // regular-season games up to & including this scheduling day).
  const goalieIds = game.goalieStats.map((s) => s.playerId);
  const upToThis = game.round != null
    ? { status: "FINAL" as const, seriesId: null, season: game.season, league: game.league, round: { lte: game.round } }
    : { status: "FINAL" as const, seriesId: null, season: game.season, league: game.league, id: { lte: game.id } };
  const goalieDecisions = goalieIds.length
    ? await prisma.goalieGameStat.groupBy({ by: ["playerId", "decision"], where: { playerId: { in: goalieIds }, decision: { not: null }, game: upToThis }, _count: { _all: true } })
    : [];
  const recOf = new Map<number, { w: number; l: number; otl: number }>();
  for (const g of goalieDecisions) {
    const r = recOf.get(g.playerId) ?? { w: 0, l: 0, otl: 0 };
    if (g.decision === "W") r.w += g._count._all;
    else if (g.decision === "L") r.l += g._count._all;
    else if (g.decision === "OTL") r.otl += g._count._all;
    recOf.set(g.playerId, r);
  }

  const goalies = (teamId: number) => game.goalieStats
    .filter((s) => s.teamId === teamId)
    .map((s) => {
      const isHome = teamId === game.homeTeamId;
      const teamGoals = (isHome ? game.homeGoals : game.awayGoals) ?? 0;
      const oppGoals = (isHome ? game.awayGoals : game.homeGoals) ?? 0;
      const enGoals = game.goalEvents.filter((g) => g.teamId === teamId && g.emptyNet).length;
      const effectiveTeamGoals = teamGoals - enGoals;
      const margin = Math.max(0, effectiveTeamGoals - oppGoals);
      const gsax = (s.xga ?? 0) - s.goalsAgainst;
      const isSteal = s.decision === "W" && gsax > margin;
      return {
        id: s.playerId, name: s.player.name, slug: s.player.slug, started: s.started,
        shotsAgainst: s.shotsAgainst, saves: s.saves, goalsAgainst: s.goalsAgainst,
        conBefore: s.conBefore, conAfter: s.conAfter, fatigued: s.fatigued, decision: s.decision,
        record: recOf.get(s.playerId) ?? { w: 0, l: 0, otl: 0 },
        xga: s.xga,
        isSteal,
        hdShotsAg: s.hdShotsAg, hdSaves: s.hdSaves, mdShotsAg: s.mdShotsAg, mdSaves: s.mdSaves,
        ldShotsAg: s.ldShotsAg, ldSaves: s.ldSaves,
      };
    })
    .sort((a, b) => Number(b.started) - Number(a.started));

  const [homeLines, awayLines] = await Promise.all([
    buildLineGroups(game.homeTeamId, game.homeLines as TeamLinesData | null, game.id),
    buildLineGroups(game.awayTeamId, game.awayLines as TeamLinesData | null, game.id),
  ]);

  // injuries that happened in THIS game (from the event stream) — timed, with cause
  const injuryEvents = await prisma.gameEvent.findMany({
    where: { gameId: game.id, type: "INJURY" }, orderBy: [{ period: "asc" }, { seconds: "asc" }],
  });
  const injIds = [...new Set(injuryEvents.flatMap((e) => [e.playerId, e.targetId]).filter((x): x is number => x != null))];
  const injPlayers = injIds.length ? await prisma.player.findMany({ where: { id: { in: injIds } }, select: { id: true, name: true, slug: true } }) : [];
  const injName = new Map(injPlayers.map((p) => [p.id, cleanName(p.name)]));
  const injSlug = new Map(injPlayers.map((p) => [p.id, p.slug]));
  const injuries = injuryEvents.map((e) => {
    const m = (e.meta ?? {}) as { part?: string; mechanism?: string; severity?: string; days?: number };
    return {
      period: e.period, seconds: e.seconds, teamId: e.teamId,
      playerName: e.playerId != null ? (injName.get(e.playerId) ?? "—") : "—",
      playerSlug: e.playerId != null ? (injSlug.get(e.playerId) ?? null) : null,
      part: m.part ?? "Injury", mechanism: m.mechanism ?? "—", severity: m.severity ?? "—", days: m.days ?? 0,
      byName: e.targetId != null ? (injName.get(e.targetId) ?? null) : null,
    };
  });

  // High-danger shot map: every GOAL (always persisted, importance HIGHLIGHT) plus
  // every high-danger non-scoring SHOT (importance NOTABLE only when hd — most
  // ordinary shots are MINOR and never make it into GameEvent, so this is NOT the
  // full shot volume; see the "Shot Locations" bar chart below for that). SHOT and
  // its GOAL twin share the same period/seconds/teamId — a GOAL doesn't duplicate
  // the SHOT row, it replaces its outcome.
  const shotEvents = await prisma.gameEvent.findMany({
    where: { gameId: game.id, type: { in: ["SHOT", "GOAL"] }, sector: { not: null } },
    orderBy: [{ period: "asc" }, { seconds: "asc" }],
  });
  const shotPlayerIds = [...new Set(shotEvents.map((e) => e.playerId).filter((x): x is number => x != null))];
  const shotPlayers = shotPlayerIds.length ? await prisma.player.findMany({ where: { id: { in: shotPlayerIds } }, select: { id: true, name: true } }) : [];
  const shotPlayerName = new Map(shotPlayers.map((p) => [p.id, cleanName(p.name)]));
  // A HD goal has BOTH a SHOT row (NOTABLE, since hd) and a GOAL row (always
  // HIGHLIGHT) at the same instant — use the GOAL row and skip its SHOT twin so
  // it isn't plotted twice; a non-HD goal has ONLY the GOAL row (its SHOT was
  // MINOR, never persisted), so this also recovers those, not just HD ones.
  const goalKeys = new Set(shotEvents.filter((e) => e.type === "GOAL").map((e) => `${e.period}:${e.seconds}:${e.teamId}`));
  const shotDots = (teamId: number) => shotEvents
    .filter((e) => e.teamId === teamId && (e.type === "GOAL" || !goalKeys.has(`${e.period}:${e.seconds}:${e.teamId}`)))
    .map((e) => ({
      sector: e.sector as string, xg: e.xg, goal: e.type === "GOAL",
      playerName: e.playerId != null ? (shotPlayerName.get(e.playerId) ?? null) : null,
    }));

  const story = game.status === "FINAL" ? await gameStory(game.id).catch(() => null) : null;
  let runningHomeScore = 0;
  let runningAwayScore = 0;

  const data = {
    id: game.id,
    endedIn: game.endedIn ?? "REG",
    home: {
      ...teamMeta(game.homeTeam), goals: game.homeGoals ?? 0, shots: game.homeShots ?? 0,
      xg: game.homeXg ?? null, hd: game.homeHd ?? null,
      ozPct: game.homeOzPct ?? null, nzPct: game.homeNzPct ?? null, dzPct: game.homeDzPct ?? null,
      shotSectors: game.homeShotSectors ?? [],
      topShot: game.homeTopShot ?? null, topShotBy: game.homeTopShotBy ? cleanName(game.homeTopShotBy) : null, avgShot: game.homeAvgShot ?? null,
      goalsByPeriod: game.homeGoalsByPeriod, shotsByPeriod: game.homeShotsByPeriod,
      skaters: skaters(game.homeTeamId), goalies: goalies(game.homeTeamId), lines: homeLines,
      shotDots: shotDots(game.homeTeamId),
    },
    away: {
      ...teamMeta(game.awayTeam), goals: game.awayGoals ?? 0, shots: game.awayShots ?? 0,
      xg: game.awayXg ?? null, hd: game.awayHd ?? null,
      ozPct: game.awayOzPct ?? null, nzPct: game.awayNzPct ?? null, dzPct: game.awayDzPct ?? null,
      shotSectors: game.awayShotSectors ?? [],
      topShot: game.awayTopShot ?? null, topShotBy: game.awayTopShotBy ? cleanName(game.awayTopShotBy) : null, avgShot: game.awayAvgShot ?? null,
      goalsByPeriod: game.awayGoalsByPeriod, shotsByPeriod: game.awayShotsByPeriod,
      skaters: skaters(game.awayTeamId), goalies: goalies(game.awayTeamId), lines: awayLines,
      shotDots: shotDots(game.awayTeamId),
    },
    homeTeamId: game.homeTeamId,
    awayTeamId: game.awayTeamId,
    goals: game.goalEvents.map((g) => {
      // Shootout attempts have their own report. Only official game goals advance
      // the score shown beside each scoring play.
      if (g.strength !== "SO") {
        if (g.teamId === game.homeTeamId) runningHomeScore++;
        else if (g.teamId === game.awayTeamId) runningAwayScore++;
      }
      const n = (runningGoal.get(g.scorerId) ?? 0) + 1;
      runningGoal.set(g.scorerId, n);
      return {
        period: g.period, seconds: g.seconds, teamId: g.teamId,
        homeScoreAfter: runningHomeScore, awayScoreAfter: runningAwayScore,
        scorerName: cleanName(g.scorerName), scorerSlug: slugById.get(g.scorerId) ?? null,
        scorerSeasonGoal: (priorGoalMap.get(g.scorerId) ?? 0) + n,
        assistNames: g.assistNames.map(cleanName),
        assists: g.assistIds.map((aid, i) => {
          const ra = (runningAssist.get(aid) ?? 0) + 1; runningAssist.set(aid, ra);
          return { name: cleanName(g.assistNames[i] ?? ""), slug: slugById.get(aid) ?? null, total: (priorAssistMap.get(aid) ?? 0) + ra };
        }),
        strength: g.strength, emptyNet: g.emptyNet,
        onIceForNames: g.onIceForNames.map(cleanName), onIceAgainstNames: g.onIceAgainstNames.map(cleanName),
      };
    }),
    penalties: game.penaltyEvents.map((p) => ({
      period: p.period, seconds: p.seconds, teamId: p.teamId,
      playerName: cleanName(p.playerName), type: p.type, minutes: p.minutes, severity: p.severity, givesPP: p.givesPP,
    })),
    injuries,
    story,
    homeSystem: (game.homeSystem as Record<string, string> | null) ?? null,
    awaySystem: (game.awaySystem as Record<string, string> | null) ?? null,
    // Also clean already-persisted games created before names were normalized
    // at the simulation boundary, sanitize regular season overtime events past 5:00,
    // and synthesize missing OT period events for games ending in OT/SO where period 4 was omitted.
    playByPlay: (() => {
      const hasOt = game.endedIn === "OT" || game.endedIn === "SO" || (game.otPeriods ?? 0) > 0;
      let pbp = ((game.playByPlay as unknown as PbpEvent[] | null) ?? [])
        .filter((e) => {
          if (game.seriesId == null && e.period === 4 && e.kind !== "period" && e.seconds > 300) return false;
          return true;
        })
        .map((e) => {
          let seconds = e.seconds;
          let time = e.time;
          const text = cleanName(e.text);
          if (game.seriesId == null && e.period === 4 && e.text.includes("End of the overtime")) {
            seconds = 300;
            time = "5:00";
          }
          return { ...e, seconds, time, text };
        });

      if (hasOt && !pbp.some((e) => e.period === 4)) {
        const otGoal = game.goalEvents.find((g) => g.period === 4);
        const otEvents: PbpEvent[] = [
          { period: 4, seconds: 0, time: "0:00", teamId: null, kind: "period", text: "Start of the overtime.", major: true },
        ];
        if (otGoal) {
          const goalTag = otGoal.strength && otGoal.strength !== "EV" ? ` (${otGoal.strength})` : "";
          otEvents.push({
            period: 4,
            seconds: otGoal.seconds,
            time: `${Math.floor(otGoal.seconds / 60)}:${Math.floor(otGoal.seconds % 60).toString().padStart(2, "0")}`,
            teamId: otGoal.teamId,
            kind: "goal",
            text: `GOAL${goalTag} scored by ${cleanName(otGoal.scorerName)}${otGoal.assistNames.length ? ` assisted by ${otGoal.assistNames.map(cleanName).join(" and ")}` : " unassisted"}. Game over.`,
            major: true,
          });
        } else {
          otEvents.push({
            period: 4,
            seconds: 300,
            time: "5:00",
            teamId: null,
            kind: "period",
            text: "End of the overtime.",
            major: true,
          });
        }
        pbp = [...pbp, ...otEvents].sort((a, b) => a.period - b.period || a.seconds - b.seconds);
      }

      return pbp;
    })(),
    shootout: ((game.shootout as unknown as ShootoutAttempt[] | null) ?? []).map((a) => ({
      ...a, teamCode: a.teamId === game.homeTeamId ? game.homeTeam.code : game.awayTeam.code,
      shooterSlug: slugById.get(a.shooterId) ?? null,
    })),
  };

  return (
    <>
      <GameView data={data} />
      {game.status === "FINAL" && (await getTeamSession()) != null && <PostGameIntelCard gameId={game.id} />}
      {game.status === "FINAL" && (
        <GameIntegrity
          engineVersion={game.engineVersion}
          seed={game.seed}
          simCount={game.simCount}
          lastSimBy={game.lastSimBy}
          lastSimAt={game.lastSimAt ? game.lastSimAt.toISOString() : null}
        />
      )}
    </>
  );
}
