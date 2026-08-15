// Play scheduled games and persist results, with day-by-day goalie condition
// (CON) management: rotation, daily recovery, and back-to-back fatigue.
//
// CON model (per the league rules):
//   - shot load after a start: <=23 shots -> -1, 24..32 -> -2, 33+ -> -3
//   - daily recovery: +1 every day, +2 if the goalie has high durability (DU)
//   - a goalie starting on consecutive days is "fatigued" (back-to-back)
//   Each round is treated as one day (until a real NHL schedule is imported).

import { prisma } from "../prisma";
import { loadSimTeam } from "./index";
import { simulateGame } from "./engine";
import { saveGameResult } from "./persist";
import { fixtureSeed } from "./rng";
import { loadSettings, type EngineSettings } from "./settings";
import type { SimTeam, SimGoalie, TeamBox } from "./types";

const DU_HIGH = 85; // durability at/above which CON recovers +2/day instead of +1
export const PLAY_CON = 95; // a skater must be at CON >= 95 to dress (below = still hurt / rusty)

/** A hurt skater's CON, as a function of DAYS STILL TO GO. Calibrated to the
 *  league: 4-day (day-to-day) ≈ 94, a week ≈ 93, ~2 weeks ≈ 90, 3 months ≈ 50.
 *  At 0 days left he's back at the 95 play threshold. Goalies are excluded —
 *  their CON tracks shots faced, not injury. */
export function injuryConTarget(daysLeft: number): number {
  const d = Math.max(0, daysLeft);
  return Math.max(45, Math.round((PLAY_CON - 0.1866 * Math.pow(d, 1.22)) * 100) / 100);
}

/** After healing a day, re-derive injured skaters' CON from their remaining days,
 *  and bring the newly-returned back at the 95 threshold (rusty). */
export async function updateInjuryCon() {
  await prisma.$executeRawUnsafe(
    `UPDATE "Player" SET condition = GREATEST(45, ROUND((${PLAY_CON} - 0.1866 * POWER("injuryDaysLeft", 1.22))::numeric, 2)) WHERE "injuryDaysLeft" > 0 AND "isGoalie" = false`,
  );
  await prisma.$executeRawUnsafe(
    `UPDATE "Player" SET condition = ${PLAY_CON}, "injuryDesc" = NULL WHERE "injuryDaysLeft" <= 0 AND "injuryDesc" IS NOT NULL AND "isGoalie" = false`,
  );
}

// ---- line chemistry: sync onto skaters before a game, evolve after ----------
function syncChem(team: SimTeam, base: number) {
  const map = new Map<number, number>();
  for (const u of team.units) { const v = team.chemistry[u.sig] ?? base; for (const id of u.members) map.set(id, v); }
  for (const s of [...team.forwards, ...team.defense]) s.chem = map.get(s.id) ?? 100;
}
function evolveChem(team: SimTeam, cfg: EngineSettings) {
  const dressed = new Set([...team.forwards, ...team.defense].map((s) => s.id));
  const slow = new Set(team.slowChem ?? []);
  for (const u of team.units) {
    const intact = u.members.every((id) => dressed.has(id));
    const cur = team.chemistry[u.sig] ?? cfg.chemistryBase;
    // an off-position unit never fully gels — its chemistry is capped
    const cap = slow.has(u.sig) ? cfg.offPosChemCap : 100;
    team.chemistry[u.sig] = intact
      ? Math.min(cap, cur + cfg.chemistryGrowth)            // gelling together (capped if off-position)
      : Math.max(cfg.chemistryBase, cur - cfg.chemistryDrop); // broken by injury/call-up
  }
}

// ---- morale (STHS "MO"): team result, personal production, scoring droughts and
// ice-time-vs-role all push it; mean-reverts to base so the league stays calibrated.
function evolveMorale(team: SimTeam, box: TeamBox, won: boolean, cfg: EngineSettings) {
  const stat = new Map(box.skaters.map((s) => [s.id, s]));
  for (const s of [...team.forwards, ...team.defense]) {
    const bs = stat.get(s.id);
    let d = won ? cfg.moraleWin : -cfg.moraleWin;      // 1) team result
    if ((bs?.points ?? 0) > 0) d += 1;                  // 2) personal production lifts mood
    // 3) scoring drought: a forward who goes cold loses confidence
    if (!s.isDefense) {
      if ((bs?.goals ?? 0) > 0) s.goalDrought = 0;
      else {
        s.goalDrought = (s.goalDrought ?? 0) + 1;
        if (s.goalDrought >= cfg.moraleDroughtGames) d -= cfg.moraleDroughtDrop;
      }
    }
    // 4) misused elite: a clear top-end player buried on ~4th-line minutes sulks
    if (s.overall >= 63 && s.iceTime < 0.10) d -= cfg.moraleRoleDrop;
    // strong mean-reversion so morale tracks RECENT form (~last 8-10 games), not
    // season-long dominance — this keeps hot streaks streaky and prevents a
    // winning team from snowballing to a permanent, sim-breaking morale edge.
    s.morale = Math.max(1, Math.min(100, s.morale + d + (cfg.moraleBase - s.morale) * 0.12));
  }
  // goalie psyche swings harder than a skater's (STHS: his morale drops first on a
  // losing streak) and a shutout / shelling colours it further.
  const gk = team.goalie;
  if (gk) {
    const ga = box.goalie?.goalsAgainst ?? 0;
    let gd = (won ? cfg.moraleWin : -cfg.moraleWin) * 1.5;
    if (ga === 0 && won) gd += 2;         // a shutout is a confidence boost
    else if (ga >= 5) gd -= 2;            // a shelling stings
    gk.morale = Math.max(1, Math.min(100, gk.morale + gd + (cfg.moraleBase - gk.morale) * 0.12));
  }
}

export type PlayOptions = {
  season?: string;
  round?: number;
  limit?: number;
  onGame?: (info: { gameId: number; home: string; away: string; hg: number; ag: number; endedIn: string }) => void;
};

type GoalieState = { lastStartRound: number; starts: number };

/**
 * Pick which goalie starts. The #1 plays most nights, but the backup gets the
 * second half of a back-to-back and a tired starter (low CON) is rested — so no
 * goalie plays all 82 and CON stays healthy.
 */
function chooseStarter(team: SimTeam, prevRound: number, state: Map<number, GoalieState>): SimGoalie {
  return [...team.goalies]
    .map((g) => {
      const startedYesterday = (state.get(g.id)?.lastStartRound ?? -99) === prevRound;
      // durable (DU>=86) goalies are worked harder: they rest less on a b2b and
      // tolerate a lower CON before being spelled -> a clear #1 reaches ~58-62
      // starts (real Hellebuyck/Vasilevskiy workloads) while his backup mostly
      // just mops up the second half of back-to-backs.
      const workhorse = g.du >= 86;
      // back-to-back: the starter is rested and the backup gets the second night
      // (a strong penalty so even a #1 who's dipped a CON point sits). Only a fully
      // rested (CON 100) workhorse still goes on the second of a b2b.
      const b2bPenalty = startedYesterday ? (workhorse ? (g.con >= 100 ? 6 : 16) : 30) : 0;
      const tiredFloor = workhorse ? 92 : 96;
      const tiredPenalty = g.con < tiredFloor ? (tiredFloor - g.con) * 2.5 : 0;
      // load management: rest pressure climbs past ~50 starts and steepens, so
      // even a workhorse with a weak backup tops out around 62-66 (real
      // Hellebuyck/Oettinger workloads) — nobody catches 70+.
      const load = Math.max(0, (state.get(g.id)?.starts ?? 0) - 50) * 3.2;
      // OVERALL dominates the pick so a clearly better starter (e.g. Vasilevskiy)
      // out-starts a merely-good backup (e.g. Ingram) by a wide margin — the
      // backup mostly gets the second half of back-to-backs and rest days.
      const score = g.con * 0.15 + g.overall * 0.85 - b2bPenalty - tiredPenalty - load;
      return { g, score };
    })
    .sort((a, b) => b.score - a.score)[0].g;
}

/** Map a scheduling round (day index) to a calendar date so the Scores page can
 *  group games by day and back-to-backs land on consecutive dates. Season starts
 *  ~Oct 1 of its first year (e.g. "2026-27" -> 2026-10-01). */
function seasonDateFor(season: string, round: number): Date {
  const year = parseInt(season.slice(0, 4), 10) || 2026;
  return new Date(Date.UTC(year, 9, 1) + round * 86_400_000); // Oct 1 + `round` days
}

/** Play all (or a subset of) SCHEDULED games for a season, saving each result. */
export async function playScheduledGames(opts: PlayOptions = {}) {
  const season = opts.season ?? "2026-27";
  const where = {
    season, status: "SCHEDULED" as const,
    ...(opts.round != null ? { round: opts.round } : {}),
  };
  const scheduled = await prisma.game.findMany({
    where,
    orderBy: [{ round: "asc" }, { id: "asc" }],
    ...(opts.limit ? { take: opts.limit } : {}),
    select: { id: true, homeTeamId: true, awayTeamId: true, round: true, league: true },
  });

  const settings = await loadSettings();
  const cache = new Map<number, SimTeam | null>();
  // Season-long MORALE state that must SURVIVE a mid-season roster reload
  // (injuries force a reload, which otherwise re-reads stale morale from the DB
  // and wipes the in-memory evolution — flattening morale to the base). NB: CON is
  // deliberately NOT carried — a reloaded roster keeps fresh legs (call-ups come
  // in rested), which is realistic and matches the long-standing behaviour.
  const moraleState = new Map<number, number>();
  const droughtState = new Map<number, number>();
  const applyPersistentState = (t: SimTeam) => {
    for (const s of [...t.forwards, ...t.defense]) {
      if (moraleState.has(s.id)) s.morale = moraleState.get(s.id)!;
      if (droughtState.has(s.id)) s.goalDrought = droughtState.get(s.id)!;
    }
    for (const g of t.goalies) {
      if (moraleState.has(g.id)) g.morale = moraleState.get(g.id)!;
    }
  };
  const getTeam = async (id: number): Promise<SimTeam | null> => {
    if (cache.has(id)) return cache.get(id) ?? null;
    try {
      const t = await loadSimTeam(id, undefined, { chemBase: settings.chemistryBase, offPos: { wing: settings.offPosWingPct, center: settings.offPosCenterPct, def: settings.offPosDefPct, chemCap: settings.offPosChemCap } });
      applyPersistentState(t); // restore evolved morale/CON/drought after a reload
      cache.set(id, t); return t;
    }
    catch { cache.set(id, null); return null; } // e.g. AHL team with no goalie -> skip its games
  };
  const gState = new Map<number, GoalieState>();

  let currentRound = scheduled[0]?.round ?? 0;
  const recoverCon = (days: number) => {
    for (const team of cache.values()) {
      for (const g of team?.goalies ?? [])
        g.con = Math.min(100, g.con + days * (g.du >= DU_HIGH ? 2 : 1));
      // skaters recover post-game conditioning per rest day (admin-tunable)
      for (const s of [...(team?.forwards ?? []), ...(team?.defense ?? [])])
        s.con = Math.min(100, s.con + days * settings.skaterConRecovery);
    }
  };
  // teams whose injured roster may have changed -> reload from DB before next use
  let injuredTeams = new Set<number>();
  const advanceDay = async (days: number) => {
    recoverCon(days);
    // heal `days` off every active injury (floor at 0)
    await prisma.player.updateMany({
      where: { injuryDaysLeft: { gt: 0 } },
      data: { injuryDaysLeft: { decrement: days } },
    });
    await prisma.player.updateMany({ where: { injuryDaysLeft: { lt: 0 } }, data: { injuryDaysLeft: 0 } });
    await updateInjuryCon(); // injured skaters' CON tracks days-to-go; returners come back at 95
    // rosters of previously-injured teams may have changed (returns) -> reload
    for (const tid of injuredTeams) cache.delete(tid);
    const stillHurt = await prisma.player.findMany({
      where: { injuryDaysLeft: { gt: 0 }, team: { league: "NHL" } },
      select: { teamId: true },
    });
    injuredTeams = new Set(stillHurt.map((r) => r.teamId));
  };

  let played = 0;
  for (const gm of scheduled) {
    const round = gm.round ?? 0;
    if (round !== currentRound) { await advanceDay(Math.max(1, round - currentRound)); currentRound = round; }

    const [home, away] = await Promise.all([getTeam(gm.homeTeamId), getTeam(gm.awayTeamId)]);
    if (!home || !away) continue; // couldn't load a roster -> skip this game
    for (const team of [home, away]) {
      const starter = chooseStarter(team, round - 1, gState);
      starter.fatigued = (gState.get(starter.id)?.lastStartRound ?? -99) === round - 1;
      team.goalie = starter;
      team.backup = team.goalies.find((g) => g.id !== starter.id) ?? null;
    }

    // reflect current line chemistry on the skaters before the puck drops
    syncChem(home, settings.chemistryBase);
    syncChem(away, settings.chemistryBase);

    const seed = fixtureSeed(gm.homeTeamId, gm.awayTeamId, round);
    const rivalry = home.rivalTeamIds.includes(away.id) || away.rivalTeamIds.includes(home.id);
    const result = simulateGame(home, away, { seed, settings, rivalry, league: gm.league === "AHL" ? "AHL" : "NHL" });
    await saveGameResult(result, { gameId: gm.id, season, gameDate: seasonDateFor(season, round) });

    // coach fine: a team that racks up too many penalty minutes is fined by the league
    for (const box of [result.home, result.away]) {
      if (box.pim > settings.coachFinePimThreshold && settings.coachFineAmount > 0) {
        await prisma.team.update({ where: { id: box.teamId }, data: { bankAccount: { decrement: settings.coachFineAmount }, ledgerAdj: { decrement: settings.coachFineAmount } } });
      }
    }

    // chemistry grows for intact units, drops for units broken by injury/call-up
    evolveChem(home, settings);
    evolveChem(away, settings);

    // morale: winners rise, losers fall (producers a touch more)
    const homeWon = result.winner === home.id;
    evolveMorale(home, result.home, homeWon, settings);
    evolveMorale(away, result.away, !homeWon, settings);

    // apply post-game CON to the starters and record their start round
    for (const [box, team] of [[result.home, home], [result.away, away]] as const) {
      const starter = team.goalie;
      starter.con = box.goalie.conAfter;
      gState.set(starter.id, { lastStartRound: round, starts: (gState.get(starter.id)?.starts ?? 0) + 1 });
      // carry each skater's post-game conditioning into the next game
      const skMap = new Map([...team.forwards, ...team.defense].map((s) => [s.id, s]));
      for (const sb of box.skaters) { const s = skMap.get(sb.id); if (s) s.con = sb.conAfter; }
    }

    // snapshot evolved morale/drought so it survives a mid-season reload
    for (const team of [home, away]) {
      for (const s of [...team.forwards, ...team.defense]) {
        moraleState.set(s.id, s.morale); droughtState.set(s.id, s.goalDrought ?? 0);
      }
      for (const g of team.goalies) moraleState.set(g.id, g.morale);
    }

    // apply injuries -> CON crashes (severity-scaled), player is out until healed.
    // Store the body part + how it happened, e.g. "Shoulder (Hit)".
    for (const inj of result.injuries) {
      await prisma.player.update({
        where: { id: inj.playerId },
        data: { injuryDaysLeft: inj.days, injuryDesc: `${inj.desc} (${inj.mechanism})`, condition: injuryConTarget(inj.days) },
      });
      cache.delete(inj.teamId);
      injuredTeams.add(inj.teamId);
    }

    played++;
    opts.onGame?.({
      gameId: gm.id, home: home.name, away: away.name,
      hg: result.home.goals, ag: result.away.goals, endedIn: result.endedIn,
    });
  }

  // persist final CON + morale back to the players (goalies + skaters), using the
  // season-long state maps so even players whose team was reloaded keep their evolution
  const updates: Promise<unknown>[] = [];
  for (const team of cache.values()) {
    for (const g of team?.goalies ?? [])
      updates.push(prisma.player.update({ where: { id: g.id }, data: { condition: Math.round(g.con), morale: Math.round(moraleState.get(g.id) ?? g.morale) } }));
    for (const s of [...(team?.forwards ?? []), ...(team?.defense ?? [])])
      updates.push(prisma.player.update({ where: { id: s.id }, data: { condition: Math.round(s.con), morale: Math.round(moraleState.get(s.id) ?? s.morale) } }));
    // persist evolved line chemistry back to the team's lines
    if (team && team.units.length)
      updates.push(prisma.teamLines.update({ where: { teamId: team.id }, data: { chemistry: team.chemistry } }).catch(() => undefined));
  }
  await Promise.all(updates);

  return { played };
}

/** Reset conditions and clear injuries for a fresh season start. */
export async function resetConditions() {
  // every NHL player (skaters + goalies) starts at full condition and the league
  // baseline morale (MO 50 — everyone even; it diverges over the season)
  await prisma.player.updateMany({
    where: { team: { league: "NHL" } },
    data: { condition: 100, morale: 50, injuryDaysLeft: 0, injuryDesc: null },
  });
}
