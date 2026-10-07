// Play scheduled games and persist results, with day-by-day goalie condition
// (CON) management: rotation, daily recovery, and back-to-back fatigue.
//
// CON model (per the league rules):
//   - shot load after a start: <=23 shots -> -1, 24..32 -> -2, 33+ -> -3
//   - daily recovery: +1 every day, +2 if the goalie has high durability (DU)
//   - a goalie starting on consecutive days is "fatigued" (back-to-back)
//   Each round is treated as one day (until a real NHL schedule is imported).

import { assignCrews, type Crew } from "../officials-server";
import { prisma } from "../prisma";
import { loadSimTeam } from "./index";
import { simulateGame } from "./engine";
import { saveGameResult } from "./persist";
import { secureSeed } from "./secure-seed";
import { loadSettings, type EngineSettings } from "./settings";
import { activeSimEngine, engineVersionFor } from "./version";
import { pairSig, unitPairs } from "./chemistry";
import { computeStandings } from "./standings";
import { getArenaSections, selloutRevenue, attendanceRate, priceAttendanceFactor, projectedPointsPct } from "../finance";
import { cleanName } from "../playerName";
import type { SimTeam, SimGoalie, TeamBox } from "./types";
import type { TeamLinesData } from "./lines-core";

type SeasonTeam = SimTeam & { linesUsed: TeamLinesData; /** a registered human GM runs this club (AHL farm → its parent club's GM) */ humanGm?: boolean };

const DU_HIGH = 95; // goalie durability at/above which CON recovers +2/day instead of +1 (only the true iron men — ~11 of 70)
export const PLAY_CON = 95; // a skater must be at CON >= 95 to dress (below = still hurt / rusty)
const PICKED_REST_CON = 92; // the GM's chosen #1 is spelled below this CON
const PICKED_MAX_STARTS = 64; // …and after this many starts (a real workhorse load)
const GOALIE_REST_CON = 98; // auto-rotation: a goalie below this CON on game day is spelled by the fresher one (so CON 97 → backup starts)

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
  // Preserve a small league-wide return-to-play event before clearing the
  // temporary injury fields. This feeds the home-page health tracker and runs
  // only once per injury because the update below immediately clears injuryDesc.
  const returners = await prisma.player.findMany({
    where: { injuryDaysLeft: { lte: 0 }, injuryDesc: { not: null } },
    select: { id: true, name: true, injuryDesc: true, teamId: true, team: { select: { code: true } } },
  });
  if (returners.length) {
    await prisma.transaction.createMany({
      data: returners.map((p) => ({
        type: "INJURY_RETURN",
        playerId: p.id,
        teamId: p.teamId,
        message: `🏥 ${cleanName(p.name)}${p.team?.code ? ` (${p.team.code})` : ""} returned from ${p.injuryDesc}.`,
      })),
    });
  }
  await prisma.$executeRawUnsafe(
    `UPDATE "Player" SET condition = GREATEST(45, ROUND((${PLAY_CON} - 0.1866 * POWER("injuryDaysLeft", 1.22))::numeric, 2)) WHERE "injuryDaysLeft" > 0 AND "isGoalie" = false`,
  );
  await prisma.$executeRawUnsafe(
    `UPDATE "Player" SET condition = ${PLAY_CON}, "injuryDesc" = NULL, "injurySeverity" = NULL, "injuredAt" = NULL WHERE "injuryDaysLeft" <= 0 AND "injuryDesc" IS NOT NULL AND "isGoalie" = false`,
  );
  // healed goalies (or anyone left over) — clear the injury note/severity, CON handled elsewhere
  await prisma.$executeRawUnsafe(
    `UPDATE "Player" SET "injuryDesc" = NULL, "injurySeverity" = NULL, "injuredAt" = NULL WHERE "injuryDaysLeft" <= 0 AND "injurySeverity" IS NOT NULL`,
  );
}

// ---- line chemistry: sync onto skaters before a game, evolve after ----------
export function syncChem(team: SimTeam, base: number) {
  const map = new Map<number, number>();
  for (const u of team.units) { const v = team.chemistry[u.sig] ?? base; for (const id of u.members) map.set(id, v); }
  for (const s of [...team.forwards, ...team.defense]) s.chem = map.get(s.id) ?? 100;
}
/** Chemistry gained this game by a bond at `cur`: full rate up to 50, then it tapers
 *  linearly (4 at 50 → ~2 at 75 → ~0.8 at 90), so the last points take a long time. */
function chemGain(cur: number, growth: number): number {
  return cur < 50 ? growth : Math.max(0.4, growth * (100 - cur) / 50);
}
export function evolveChem(team: SimTeam, cfg: EngineSettings) {
  const dressed = new Set([...team.forwards, ...team.defense].map((s) => s.id));
  const slow = new Set(team.slowChem ?? []);
  // 5v5 chemistry is PAIRWISE: each bond in an intact line/pair gels; bonds that
  // weren't together this game fade SLOWLY (time-together memory — a re-united duo
  // resumes near where it left off, not from scratch).
  const together = new Set<string>();
  for (const u of team.units) {
    if (u.sig.includes(":")) continue;
    const intact = u.members.every((id) => dressed.has(id));
    if (!intact) continue;
    const cap = slow.has(u.sig) ? cfg.offPosChemCap : 100;   // off-position unit never fully gels
    for (const [a, b] of unitPairs(u.members)) {
      const sig = pairSig(a, b); together.add(sig);
      const cur = team.chemistry[sig] ?? cfg.chemistryBase;
      team.chemistry[sig] = Math.min(cap, cur + chemGain(cur, cfg.chemistryGrowth));
    }
  }
  const fade = Math.max(0.5, cfg.chemistryGrowth * 0.5);     // bonds fade SLOWER than they build → a re-united duo keeps most of its history
  for (const key of Object.keys(team.chemistry)) {
    if (key.includes(":") || together.has(key)) continue;    // ST unit key or a bond that played → skip
    team.chemistry[key] = Math.max(cfg.chemistryBase, team.chemistry[key] - fade);
  }
  // special-teams units (PP1/PK1) keep their own unit-level gel/decay
  for (const u of team.stUnits ?? []) {
    const intact = u.members.every((id) => dressed.has(id));
    const cur = team.chemistry[u.sig] ?? cfg.chemistryBase;
    team.chemistry[u.sig] = intact ? Math.min(100, cur + chemGain(cur, cfg.chemistryGrowth)) : Math.max(cfg.chemistryBase, cur - cfg.chemistryDrop);
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
  actor?: string; // who triggered this sim (commissioner name / "Auto-sim") — for the audit log
  onGame?: (info: { gameId: number; home: string; away: string; hg: number; ag: number; endedIn: string }) => void;
};

type GoalieState = { lastStartRound: number; starts: number };

/**
 * Pick which goalie starts. The #1 plays most nights, but the backup gets the
 * second half of a back-to-back and a tired starter (low CON) is rested — so no
 * goalie plays all 82 and CON stays healthy.
 */
function chooseStarter(team: SeasonTeam, prevRound: number, state: Map<number, GoalieState>): SimGoalie {
  // Honor the GM's explicit starter pick from Lines whenever he's actually fit
  // to go — the auto-rotation below exists to manage goalies the GM never set
  // an opinion on, not to overrule a deliberate choice (rest a hot backup, etc).
  // Same fitness bar as a skater dressing (PLAY_CON) rather than the AI's own
  // stricter GOALIE_REST_CON, which is tuned for its own rotation heuristic.
  // …but the GM's pick is his NUMBER ONE, not an iron man: he still sits the second
  // night of a back-to-back, when he's run down, and once he's carried a real #1's
  // workload — otherwise every picked starter played all 82 (incl. every b2b at the
  // b2bFatigue penalty) and won 55-60 games. The auto-rotation below then decides,
  // and it still favours him by OVERALL on normal nights.
  const picked = team.goalies.find((g) => g.id === team.linesUsed?.situations?.others?.starter);
  // A human GM decides who is in net — full stop. No back-to-back / workload / CON-rest
  // rotation overrides his pick (that rotation exists for AI-run clubs); the only thing that
  // keeps his starter out is being genuinely unfit to dress (below PLAY_CON), and a b2b still
  // costs the starter a little performance via `fatigued`.
  if (team.humanGm && picked && picked.con >= PLAY_CON) return picked;
  if (picked && picked.con >= PLAY_CON) {
    const st = state.get(picked.id);
    const startedYesterday = (st?.lastStartRound ?? -99) === prevRound;
    const hasBackup = team.goalies.some((g) => g.id !== picked.id && g.con >= PLAY_CON);
    if (!hasBackup || (!startedYesterday && picked.con >= PICKED_REST_CON && (st?.starts ?? 0) < PICKED_MAX_STARTS)) return picked;
  }
  const scored = [...team.goalies]
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
    });
  // Auto-rotation: a goalie must be at CON >= GOALIE_REST_CON to start. If his CON has
  // dipped below it, the fresher goalie gets the net — so no starter is ridden into the
  // ground.
  const eligible = scored.filter((s) => s.g.con >= GOALIE_REST_CON);
  if (eligible.length) return eligible.sort((a, b) => b.score - a.score)[0].g;
  // Nobody's fully rested. A goalie below PLAY_CON is genuinely gassed and must not
  // start — fall back to whoever is still fit to dress (>= PLAY_CON) instead.
  const fit = scored.filter((s) => s.g.con >= PLAY_CON);
  if (fit.length) return fit.sort((a, b) => b.score - a.score)[0].g;
  // Both goalies are below PLAY_CON (shouldn't happen once rest-day recovery tops
  // them up) — can't forfeit for lack of a fit netminder, so the freshest starts anyway.
  return scored.sort((a, b) => b.g.con - a.g.con)[0].g;
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
    select: { id: true, homeTeamId: true, awayTeamId: true, round: true, league: true, gameDate: true, simCount: true, eventCapacity: true, eventKind: true },
  });

  const settings = await loadSettings();
  const engineVersion = engineVersionFor(await activeSimEngine());

  // Off-day CON recovery: top up every healthy player for the days elapsed since the
  // last games were played, BEFORE tonight's games. This runs even when you step one
  // day at a time via "Sim Next Day" (which otherwise skipped recovery), so goalies
  // reliably recharge on their rest days and both never sit stuck under the bar.
  const firstRound = scheduled[0]?.round ?? 0;
  if (opts.round != null) {
    const lastPlayed = await prisma.game.aggregate({ _max: { round: true }, where: { season, status: "FINAL", seriesId: null } });
    const restDays = lastPlayed._max.round != null ? Math.max(0, firstRound - lastPlayed._max.round) : 0;
    const playingTeams = [...new Set(scheduled.flatMap((g) => [g.homeTeamId, g.awayTeamId]))];
    if (restDays > 0) {
      // Heal active injuries for the days elapsed — days pass for EVERYONE, so this must
      // run even when stepping one round at a time via "Sim Next Day" (advanceDay only
      // fired on an in-call round change, so day-by-day sims never healed → injuries piled
      // up all season). Then re-derive injured skaters' CON and clear the healed ones.
      await prisma.player.updateMany({ where: { injuryDaysLeft: { gt: 0 } }, data: { injuryDaysLeft: { decrement: restDays } } });
      await prisma.player.updateMany({ where: { injuryDaysLeft: { lt: 0 } }, data: { injuryDaysLeft: 0 } });
      await updateInjuryCon();
    }
    if (restDays > 0 && playingTeams.length) {
      // Only players who are actually RESTING recover — teams playing tonight are
      // handled by the game itself (the starter's conAfter etc.), so a starter never
      // gets a spurious rest-day bump on his own game day (which over-inflated CON).
      const goalieRec = restDays * 1;                                 // goalies +1/rest day …
      // … or +2 for a goalie with DU >= DU_HIGH (same rule as the in-memory recovery below)
      const goalieRecSql = `${goalieRec} * CASE WHEN COALESCE((SELECT r.du FROM "GoalieRating" r WHERE r."playerId" = "Player".id), 0) >= ${DU_HIGH} THEN 2 ELSE 1 END`;
      const skaterRec = restDays * (settings.skaterConRecovery ?? 1);
      await prisma.$executeRawUnsafe(
        `UPDATE "Player" SET condition = LEAST(100, condition + CASE WHEN "isGoalie" THEN ${goalieRecSql} ELSE ${skaterRec} END) WHERE "injuryDaysLeft" <= 0 AND condition < 100 AND "teamId" NOT IN (${playingTeams.join(",")})`
      );
      // A goalie who SAT on a club that plays tonight (the backup, or a starter being rested) must
      // recover too — the NOT IN above only covers clubs that are idle tonight, so a goalie on a
      // team playing most days never got a rest-day bump. Anyone who started on the last played
      // game day (a back-to-back) gets nothing, like before.
      const lastDay = lastPlayed._max.round;
      if (lastDay != null) {
        await prisma.$executeRawUnsafe(
          `UPDATE "Player" SET condition = LEAST(100, condition + ${goalieRecSql}) WHERE "isGoalie" = true AND "injuryDaysLeft" <= 0 AND condition < 100 AND "teamId" IN (${playingTeams.join(",")}) AND id NOT IN (SELECT gs."playerId" FROM "GoalieGameStat" gs JOIN "Game" g ON g.id = gs."gameId" WHERE gs.started = true AND g.season = '${season.replace(/'/g, "")}' AND g.round = ${Number(lastDay)} AND g."seriesId" IS NULL)`
        );
      }
    }
  }
  const cache = new Map<number, SeasonTeam | null>();
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
  const getTeam = async (id: number): Promise<SeasonTeam | null> => {
    if (cache.has(id)) return cache.get(id) ?? null;
    try {
      const t = await loadSimTeam(id, undefined, { chemBase: settings.chemistryBase, offPos: { wing: settings.offPosWingPct, center: settings.offPosCenterPct, def: settings.offPosDefPct, chemCap: settings.offPosChemCap } });
      applyPersistentState(t); // restore evolved morale/CON/drought after a reload
      const own = await prisma.team.findUnique({ where: { id }, select: { passwordHash: true, parentTeam: { select: { passwordHash: true } } } });
      (t as SeasonTeam).humanGm = !!(own?.passwordHash || own?.parentTeam?.passwordHash);
      cache.set(id, t); return t;
    }
    catch { cache.set(id, null); return null; } // e.g. AHL team with no goalie -> skip its games
  };
  // Seed the goalie rotation state from games ALREADY played this season — the live
  // league sims one night per call, so without this the rotation forgot who started
  // last night (no back-to-back rest) and every starter's workload reset to 0 daily.
  const gState = new Map<number, GoalieState>();
  {
    const prior = await prisma.goalieGameStat.findMany({
      where: { started: true, game: { season, status: "FINAL", seriesId: null } },
      select: { playerId: true, game: { select: { round: true } } },
    });
    for (const r of prior) {
      const cur = gState.get(r.playerId) ?? { lastStartRound: -99, starts: 0 };
      gState.set(r.playerId, { lastStartRound: Math.max(cur.lastStartRound, r.game.round ?? -99), starts: cur.starts + 1 });
    }
  }

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

  // Attendance/gate context — computed once per call. Base draw per club from
  // popularity + record (as of now) + opponent quality; arena sellout sets the gate.
  // Stored on each home game so the crowd figure is a real, locked-in record.
  const attStandings = await computeStandings(season, "NHL").catch(() => [] as Awaited<ReturnType<typeof computeStandings>>);
  const pctBy = new Map(attStandings.map((s) => [s.teamId, projectedPointsPct(s)]));
  const finTeams = await prisma.team.findMany({ where: { league: "NHL" }, select: { id: true, popularity: true, capacity: true, arenaSections: true } });
  const finBy = new Map(finTeams.map((t) => {
    const secs = getArenaSections(t);
    return [t.id, { pop: t.popularity ?? 100, capacity: secs.reduce((a, x) => a + x.capacity, 0), sellout: selloutRevenue(secs), pf: priceAttendanceFactor(secs) }];
  }));
  // tonight's crowd (deterministic per game) — decided BEFORE the puck drops, so the
  // engine's home-crowd factor and the stored attendance are the same number
  const crowdOf = (gm: { id: number; homeTeamId: number; awayTeamId: number; league: string | null; eventCapacity?: number | null; eventKind?: string | null }) => {
    if (gm.league === "AHL") return null;
    const fin = finBy.get(gm.homeTeamId);
    // special event (outdoor / Global Series): the venue's crowd — these sell out
    if (gm.eventCapacity) {
      const fill = 0.97 + ((((gm.id * 2654435761) >>> 0) % 1000) / 1000) * 0.03;
      return { frac: fill, attendance: Math.round(gm.eventCapacity * fill), gate: fin?.sellout ?? 0, neutral: gm.eventKind === "GLOBAL" };
    }
    if (!fin || fin.capacity <= 0) return null;
    const base = attendanceRate(fin.pop, pctBy.get(gm.homeTeamId) ?? 0.5) * fin.pf; // cheaper tickets → more fans
    const jitter = (((gm.id * 2654435761) >>> 0) % 1000) / 1000;
    const oppDraw = ((pctBy.get(gm.awayTeamId) ?? 0.5) - 0.5) * 0.10;
    const frac = Math.max(0.4, Math.min(1, base * (1 + (jitter - 0.5) * 0.08 + oppDraw)));
    return { frac, attendance: Math.round(fin.capacity * frac), gate: Math.round(frac * fin.sellout), neutral: false };
  };
  const storeAttendance = async (gm: Parameters<typeof crowdOf>[0]) => {
    const c = crowdOf(gm);
    if (c) await prisma.game.update({ where: { id: gm.id }, data: { attendance: c.attendance, gate: c.gate } });
  };

  // tonight's referee crews (NHL games only; real 2025-26 officials)
  const crews = await assignCrews(scheduled.filter((g) => g.league !== "AHL").map((g) => g.id)).catch(() => new Map<number, Crew>());
  let played = 0;
  const playedIds: number[] = [];
  const skippedIds: number[] = [];
  for (const gm of scheduled) {
    const round = gm.round ?? 0;
    if (round !== currentRound) { await advanceDay(Math.max(1, round - currentRound)); currentRound = round; }

    const [home, away] = await Promise.all([getTeam(gm.homeTeamId), getTeam(gm.awayTeamId)]);
    if (!home || !away) { skippedIds.push(gm.id); continue; } // roster won't load (e.g. farm w/o goalie) — mark no-contest below so it never blocks the day pointer
    for (const team of [home, away]) {
      const starter = chooseStarter(team, round - 1, gState);
      starter.fatigued = (gState.get(starter.id)?.lastStartRound ?? -99) === round - 1;
      team.goalie = starter;
      team.backup = team.goalies.find((g) => g.id !== starter.id) ?? null;
    }

    // reflect current line chemistry on the skaters before the puck drops
    syncChem(home, settings.chemistryBase);
    syncChem(away, settings.chemistryBase);

    // Seed folds in the game row id + its sim count, so a RE-SIM (simCount++) and a
    // fresh schedule rebuild (new row id) each re-roll the result, while replaying
    // the very same row unchanged stays reproducible.
    const seed = secureSeed(); // unpredictable, drawn at sim time (lib/sim/secure-seed.ts)
    const rivalry = home.rivalTeamIds.includes(away.id) || away.rivalTeamIds.includes(home.id);
    const crew = crews.get(gm.id);
    const crowd = crowdOf(gm);
    const result = simulateGame(home, away, { seed, settings, rivalry, league: gm.league === "AHL" ? "AHL" : "NHL", engineVersion, officials: crew ? { penaltyMult: crew.penaltyMult, evenUp: crew.evenUp } : undefined, crowd: crowd ? { fill: crowd.frac, neutral: crowd.neutral } : undefined });
    if (crew) await prisma.game.update({ where: { id: gm.id }, data: { officialIds: crew.ids } }).catch(() => {});
    await saveGameResult(result, {
      gameId: gm.id, season, gameDate: gm.gameDate ?? seasonDateFor(season, round),
      homeLines: home.linesUsed, awayLines: away.linesUsed,
    });
    await storeAttendance(gm); // lock in the real crowd + gate for this home game

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
      // The backup didn't dress, so the game itself never touches his CON — but his
      // team IS excluded from the rest-day bulk recovery above (that logic assumes
      // "team playing tonight" means "handled by the game"), which was only true for
      // the starter. Without this he'd sit frozen at whatever CON he had, forever,
      // any night his team plays and he isn't the guy in net. One rest day's worth
      // of recovery, same rate as the bulk formula.
      if (team.backup && team.backup.id !== starter.id) {
        team.backup.con = Math.min(100, team.backup.con + (team.backup.du >= DU_HIGH ? 2 : 1));
      }
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
        data: {
          injuryDaysLeft: inj.days,
          injuryDesc: `${inj.desc} (${inj.mechanism})`,
          injurySeverity: inj.severity,
          injuredAt: gm.gameDate ?? new Date(),
          condition: injuryConTarget(inj.days),
        },
      });
      cache.delete(inj.teamId);
      injuredTeams.add(inj.teamId);
    }

    played++;
    playedIds.push(gm.id);
    opts.onGame?.({
      gameId: gm.id, home: home.name, away: away.name,
      hg: result.home.goals, ag: result.away.goals, endedIn: result.endedIn,
    });
  }

  // games we couldn't sim (a roster wouldn't load) are marked FINAL 0-0 no-contests
  // so the round always completes and "sim next day" never gets stuck on them.
  if (skippedIds.length) {
    await prisma.game.updateMany({
      where: { id: { in: skippedIds } },
      data: { status: "FINAL", homeGoals: 0, awayGoals: 0, endedIn: "REG", playedAt: new Date(), lastSimBy: "No contest (roster unavailable)" },
    });
    // sealed too, so a no-contest can't be confused with (or swapped for) a simulated result
    const { sealGame } = await import("../integrity-server");
    await prisma.$transaction(async (tx) => { for (const id of skippedIds) await sealGame(tx, id, "NO_CONTEST"); });
  }

  // persist final CON + morale back to the players (goalies + skaters), using the
  // season-long state maps so even players whose team was reloaded keep their evolution.
  // `mo` (the Ratings-strip/Player Compare "MO" parameter) is written to the same
  // value every time so it's always the live mood, not a separate frozen number.
  // CON is stored to 2 decimal places (the column is a Float) instead of rounded to a
  // whole number — otherwise every point of in-season shot-load/TOI/PK nuance the engine
  // already computes (e.g. the PK-workload fractional penalty in skaterConAfter) gets
  // thrown away the moment it's saved.
  const con2 = (v: number) => Math.round(v * 100) / 100;
  const updates: Promise<unknown>[] = [];
  for (const team of cache.values()) {
    for (const g of team?.goalies ?? []) {
      const gm = Math.round(moraleState.get(g.id) ?? g.morale);
      updates.push(prisma.player.update({ where: { id: g.id }, data: { condition: con2(g.con), morale: gm, mo: gm } }));
    }
    for (const s of [...(team?.forwards ?? []), ...(team?.defense ?? [])]) {
      const sm = Math.round(moraleState.get(s.id) ?? s.morale);
      updates.push(prisma.player.update({ where: { id: s.id }, data: { condition: con2(s.con), morale: sm, mo: sm } }));
    }
    // persist evolved line chemistry back to the team's lines
    if (team && team.units.length)
      updates.push(prisma.teamLines.update({ where: { teamId: team.id }, data: { chemistry: team.chemistry } }).catch(() => undefined));
  }
  await Promise.all(updates);

  // audit trail: who simulated these games, with engine version + seed
  try {
    const { recordSimAudit } = await import("../audit-server");
    await recordSimAudit(playedIds, opts.actor ?? "System");
  } catch (e) {
    console.error("[playScheduledGames] audit failed:", e);
  }

  // automatically score and persist game picks for the simulated round
  if (played > 0) {
    try {
      const { evaluateGamePicks } = await import("../game-picks-server");
      await evaluateGamePicks(opts.season ?? "2026-27", "NHL");
    } catch (e) {
      console.error("[playScheduledGames] evaluateGamePicks failed:", e);
    }
  }

  return { played };
}

/** Reset conditions and clear injuries for a fresh season start. */
export async function resetConditions() {
  // every NHL player (skaters + goalies) starts at full condition and the league
  // baseline morale (MO 50 — everyone even; it diverges over the season)
  await prisma.player.updateMany({
    where: { team: { league: "NHL" } },
    data: { condition: 100, morale: 50, mo: 50, injuryDaysLeft: 0, injuryDesc: null, injurySeverity: null, injuredAt: null },
  });
}
