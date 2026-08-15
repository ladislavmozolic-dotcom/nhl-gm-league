// Game Report + Game Flow — an auto-written story of a game and a rolling xG-flow
// graph, both built from the event stream the engine already persists (GameEvent:
// SHOT/SAVE/GOAL with xg, sector, shotType, strength, meta). No animation needed —
// the data tells the story.

import { prisma } from "./prisma";
import { cleanName } from "./playerName";

const PERIOD = 1200;
const absT = (period: number, seconds: number) => (period - 1) * PERIOD + seconds;
const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;
const periodLabel = (p: number) => (p <= 3 ? `${p}${["st", "nd", "rd"][p - 1]}` : p === 4 ? "OT" : `${p - 3}OT`);
const SECTOR_TXT: Record<string, string> = { SLOT: "the slot", NET_FRONT: "the net-front", CIRCLE: "the circle", LEFT_CIRCLE: "the left circle", RIGHT_CIRCLE: "the right circle", POINT: "the point", HIGH_SLOT: "the high slot" };
const SHOT_TXT: Record<string, string> = { WRIST: "wrist shot", SLAP: "slap shot", SNAP: "snap shot", BACKHAND: "backhander", TIP: "tip-in", ONE_TIMER: "one-timer", DEFLECTION: "deflection" };

export type ReportBit = { time: string; period: number; text: string; player?: string } | null;
export type GameReport = { summary: string; turningPoint: ReportBit; playOfGame: ReportBit; saveOfGame: ReportBit };
export type FlowBin = { startSec: number; endSec: number; label: string; homeXg: number; awayXg: number; plays: string[] };
export type GameFlow = {
  homeCode: string; awayCode: string; homeXg: number; awayXg: number;
  points: { t: number; diff: number }[];            // cumulative (home xG − away xG) over game time
  goals: { t: number; home: boolean; text: string }[];
  bins: FlowBin[];
  maxAbs: number;                                    // for scaling the Y axis
};

type Ev = { type: string; period: number; seconds: number; teamId: number | null; playerId: number | null; targetId: number | null; xg: number | null; sector: string | null; shotType: string | null; strength: string | null; meta: unknown };

export async function gameStory(gameId: number): Promise<{ report: GameReport; flow: GameFlow } | null> {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: { homeTeamId: true, awayTeamId: true, homeGoals: true, awayGoals: true, endedIn: true, homeTeam: { select: { code: true, name: true } }, awayTeam: { select: { code: true, name: true } } },
  });
  if (!game) return null;
  const events = (await prisma.gameEvent.findMany({
    where: { gameId }, orderBy: [{ period: "asc" }, { seconds: "asc" }],
    select: { type: true, period: true, seconds: true, teamId: true, playerId: true, targetId: true, xg: true, sector: true, shotType: true, strength: true, meta: true },
  })) as Ev[];

  // resolve player names
  const pids = [...new Set(events.flatMap((e) => [e.playerId, e.targetId]).filter((x): x is number => x != null))];
  const nameById = new Map((await prisma.player.findMany({ where: { id: { in: pids } }, select: { id: true, name: true } })).map((p) => [p.id, cleanName(p.name)]));
  const nm = (id: number | null) => (id != null ? nameById.get(id) ?? "a player" : "a player");
  const homeId = game.homeTeamId, awayId = game.awayTeamId;
  const codeOf = (id: number | null) => (id === homeId ? game.homeTeam.code ?? game.homeTeam.name : game.awayTeam.code ?? game.awayTeam.name);
  const isHome = (id: number | null) => id === homeId;

  const goals = events.filter((e) => e.type === "GOAL");
  const shots = events.filter((e) => e.type === "SHOT" && e.xg != null);
  const saves = events.filter((e) => e.type === "SAVE" && e.xg != null);

  // ---------- FLOW ----------
  // xG timeline from SHOT events (each attributed to the shooting team). Cumulative
  // (home − away) over the game; goals marked; binned into 5-minute windows.
  const shotPts = shots.map((e) => ({ t: absT(e.period, e.seconds), home: isHome(e.teamId), xg: e.xg ?? 0 }))
    .concat(goals.filter((g) => (g.xg ?? 0) < 0.12).map((g) => ({ t: absT(g.period, g.seconds), home: isHome(g.teamId), xg: g.xg ?? 0 }))) // add low-danger goals (no persisted SHOT)
    .sort((a, b) => a.t - b.t);
  let cum = 0;
  const points: GameFlow["points"] = [{ t: 0, diff: 0 }];
  let homeXg = 0, awayXg = 0;
  for (const s of shotPts) { cum += s.home ? s.xg : -s.xg; if (s.home) homeXg += s.xg; else awayXg += s.xg; points.push({ t: s.t, diff: +cum.toFixed(3) }); }
  const endT = Math.max(3600, ...shotPts.map((s) => s.t));
  points.push({ t: endT, diff: +cum.toFixed(3) });
  const maxAbs = Math.max(0.5, ...points.map((p) => Math.abs(p.diff)));

  const goalMarks = goals.map((g) => ({ t: absT(g.period, g.seconds), home: isHome(g.teamId), text: `${codeOf(g.teamId)} ${nm(g.playerId)}` }));

  // 5-minute bins over regulation (+ one OT bin if needed)
  const bins: FlowBin[] = [];
  const lastP = Math.max(3, ...events.map((e) => e.period));
  const totalSec = lastP <= 3 ? 3600 : 3600 + PERIOD;
  for (let start = 0; start < totalSec; start += 300) {
    const end = start + 300;
    const inWin = (t: number) => t >= start && t < end;
    let hx = 0, ax = 0;
    for (const s of shots) { const t = absT(s.period, s.seconds); if (inWin(t)) { if (isHome(s.teamId)) hx += s.xg ?? 0; else ax += s.xg ?? 0; } }
    const plays: string[] = [];
    for (const g of goals) { const t = absT(g.period, g.seconds); if (inWin(t)) plays.push(`${mmss(g.seconds)} ${periodLabel(g.period)} — 🚨 ${codeOf(g.teamId)} ${nm(g.playerId)}${g.strength && g.strength !== "EV" ? ` (${g.strength})` : ""}`); }
    for (const sv of saves) { const t = absT(sv.period, sv.seconds); if (inWin(t) && (sv.xg ?? 0) >= 0.18) plays.push(`${mmss(sv.seconds)} ${periodLabel(sv.period)} — 🧤 ${nm(sv.playerId)} denies ${nm(sv.targetId)}`); }
    bins.push({ startSec: start, endSec: end, label: `${mmss(start)}–${mmss(Math.min(end, totalSec))}`, homeXg: +hx.toFixed(2), awayXg: +ax.toFixed(2), plays });
  }

  const flow: GameFlow = { homeCode: codeOf(homeId), awayCode: codeOf(awayId), homeXg: +homeXg.toFixed(2), awayXg: +awayXg.toFixed(2), points, goals: goalMarks, bins, maxAbs: +maxAbs.toFixed(3) };

  // ---------- REPORT ----------
  const report = buildReport(game, events, goals, saves, { nm, codeOf, isHome, homeId, awayId });
  return { report, flow };
}

function buildReport(
  game: { homeGoals: number | null; awayGoals: number | null; endedIn: string | null; homeTeam: { code: string | null; name: string }; awayTeam: { code: string | null; name: string } },
  events: Ev[], goals: Ev[], saves: Ev[],
  h: { nm: (id: number | null) => string; codeOf: (id: number | null) => string; isHome: (id: number | null) => boolean; homeId: number; awayId: number },
): GameReport {
  const hg = game.homeGoals ?? 0, ag = game.awayGoals ?? 0;
  const winnerId = hg >= ag ? h.homeId : h.awayId;
  const loserId = hg >= ag ? h.awayId : h.homeId;
  const winCode = h.codeOf(winnerId), loseCode = h.codeOf(loserId);
  const wG = Math.max(hg, ag), lG = Math.min(hg, ag);

  // per-period goals for each team
  const perPeriod = (teamId: number, p: number) => goals.filter((g) => g.teamId === teamId && g.period === p && g.strength !== "SO").length;
  const firstPeriodLoserGoals = perPeriod(loserId, 1), firstPeriodWinnerGoals = perPeriod(winnerId, 1);

  // top scorer of the winning team (goals + assists from meta.assistNames)
  const pts = new Map<number, { g: number; a: number; name: string }>();
  for (const gl of goals) {
    if (gl.playerId != null) { const e = pts.get(gl.playerId) ?? { g: 0, a: 0, name: h.nm(gl.playerId) }; e.g++; pts.set(gl.playerId, e); }
  }
  const topScorer = [...pts.values()].sort((a, b) => (b.g + b.a) - (a.g + a.a) || b.g - a.g)[0];

  // winning goalie line (saves / shots against) from SAVE + GOAL events against them
  const savesBy = (goalieTeamId: number) => saves.filter((s) => s.teamId === goalieTeamId).length;
  const goalsAgainst = (teamId: number) => goals.filter((g) => g.teamId !== teamId).length;
  // NB: persisted SAVE events are high-danger only, so this is an approximation for flavour.

  // summary sentences
  const parts: string[] = [];
  const startedStrong = firstPeriodLoserGoals > firstPeriodWinnerGoals;
  if (startedStrong) parts.push(`${winCode} survived a strong ${loseCode} start`);
  else parts.push(`${winCode} ${wG - lG >= 3 ? "controlled" : "edged"} ${loseCode}`);
  // where the winner took over: period with best winner goal differential (2nd/3rd)
  let bestP = 2, bestDiff = -99;
  for (const p of [1, 2, 3]) { const d = perPeriod(winnerId, p) - perPeriod(loserId, p); if (d > bestDiff) { bestDiff = d; bestP = p; } }
  if (startedStrong && bestP >= 2) parts.push(`before taking over in the ${periodLabel(bestP)} period`);
  const lead = `${winCode} won ${wG}–${lG}${game.endedIn && game.endedIn !== "REG" ? ` in ${game.endedIn}` : ""}`;
  let summary = `${parts.join(" ")}. ${lead}.`;
  if (topScorer && topScorer.g >= 2) summary += ` ${topScorer.name} scored ${topScorer.g === 2 ? "twice" : `${topScorer.g} times`}.`;
  else if (topScorer && topScorer.g === 1) summary += ` ${topScorer.name} led the way.`;

  // TURNING POINT — the game-winning goal (winner's goal that made the lead they never lost)
  let turningPoint: ReportBit = null;
  {
    // replay score; find the goal after which winner led for good
    let hs = 0, as = 0; let gwg: Ev | null = null; let gwgHome = 0, gwgAway = 0;
    const ordered = [...goals].filter((g) => g.strength !== "SO").sort((a, b) => absT(a.period, a.seconds) - absT(b.period, b.seconds));
    for (let i = 0; i < ordered.length; i++) {
      const g = ordered[i];
      if (h.isHome(g.teamId)) hs++; else as++;
      const winnerAhead = winnerId === h.homeId ? hs > as : as > hs;
      if (winnerAhead) {
        // does the winner stay ahead from here to the end?
        let hh = hs, aa = as, stays = true;
        for (let j = i + 1; j < ordered.length; j++) { if (h.isHome(ordered[j].teamId)) hh++; else aa++; const wa = winnerId === h.homeId ? hh > aa : aa > hh; if (!wa) { stays = false; break; } }
        if (stays) { gwg = g; gwgHome = hs; gwgAway = as; break; }
      }
    }
    if (gwg) {
      const meta = (gwg.meta ?? {}) as { assistNames?: string[] };
      const a1 = meta.assistNames?.[0];
      const scoreBefore = winnerId === h.homeId ? `${gwgHome - 1}–${gwgAway}` : `${gwgAway}–${gwgHome - 1}`;
      const setup = a1 ? ` ${a1} set up ${h.nm(gwg.playerId)}` : ` ${h.nm(gwg.playerId)} scored`;
      turningPoint = {
        time: mmss(gwg.seconds), period: gwg.period,
        player: h.nm(gwg.playerId),
        text: `With the game ${lG === 0 && gwgAway === 0 && gwgHome === 1 ? "scoreless" : `at ${scoreBefore}`},${setup} for the goal that put ${winCode} ahead to stay${gwg.strength && gwg.strength !== "EV" ? ` on the ${gwg.strength}` : ""}.`,
      };
    }
  }

  // PLAY OF THE GAME — highest-xG goal
  let playOfGame: ReportBit = null;
  {
    const best = [...goals].filter((g) => g.strength !== "SO").sort((a, b) => (b.xg ?? 0) - (a.xg ?? 0))[0];
    if (best) {
      const meta = (best.meta ?? {}) as { assistNames?: string[] };
      const loc = best.sector ? SECTOR_TXT[best.sector] ?? "in tight" : "in tight";
      const kind = best.shotType ? SHOT_TXT[best.shotType] ?? "shot" : "shot";
      const assist = meta.assistNames?.[0] ? ` off a feed from ${meta.assistNames[0]}` : "";
      playOfGame = {
        time: mmss(best.seconds), period: best.period, player: h.nm(best.playerId),
        text: `${h.nm(best.playerId)} (${h.codeOf(best.teamId)}) buried a ${kind} from ${loc}${assist} — the game's best chance (${((best.xg ?? 0) * 100).toFixed(0)}% xG).`,
      };
    }
  }

  // SAVE OF THE GAME — highest-xG save, preferring the late game
  let saveOfGame: ReportBit = null;
  {
    const scored = saves.map((s) => ({ s, score: (s.xg ?? 0) + (absT(s.period, s.seconds) > 3000 ? 0.05 : 0) })).sort((a, b) => b.score - a.score);
    const best = scored[0]?.s;
    if (best && (best.xg ?? 0) >= 0.15) {
      const meta = (best.meta ?? {}) as { setup?: string };
      const how = meta.setup === "rebound" ? "on the rebound" : "";
      saveOfGame = {
        time: mmss(best.seconds), period: best.period, player: h.nm(best.playerId),
        text: `${h.nm(best.playerId)} robbed ${h.nm(best.targetId)} ${how} from ${best.sector ? SECTOR_TXT[best.sector] ?? "in close" : "in close"} (${((best.xg ?? 0) * 100).toFixed(0)}% xG).`.replace(/\s+/g, " "),
      };
    }
  }

  return { summary, turningPoint, playOfGame, saveOfGame };
}
