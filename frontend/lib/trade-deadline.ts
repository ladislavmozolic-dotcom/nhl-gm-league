// NHL trade deadline. Real rule: after the deadline no club may trade until its
// own season is over — i.e. clubs that missed the playoffs can trade again once
// the regular season ends, playoff clubs once they're eliminated, and everyone
// in the off-season. A trade needs BOTH clubs to be past their season.
import { prisma } from "./prisma";
import { getLeagueDate, computePhase } from "./calendar-server";
import { REGULAR_SEASON } from "./phase";

export const DEADLINE_TZ = "Europe/Bratislava";

export async function getTradeDeadline(): Promise<Date | null> {
  const cfg = await prisma.leagueConfig.findUnique({ where: { id: 1 }, select: { tradeDeadlineAt: true } }).catch(() => null);
  return cfg?.tradeDeadlineAt ?? null;
}

/** Clubs still alive in the NHL playoffs (in an unfinished series, or waiting for
 *  their next-round series after winning one — the champion is done). */
async function aliveInPlayoffs(): Promise<Set<number>> {
  const series = await prisma.playoffSeries.findMany({ where: { season: REGULAR_SEASON, league: "NHL" }, select: { round: true, highSeedTeamId: true, lowSeedTeamId: true, winnerTeamId: true } });
  const alive = new Set<number>();
  const maxRound = Math.max(0, ...series.map((s) => s.round));
  for (const s of series) {
    if (!s.winnerTeamId) { alive.add(s.highSeedTeamId); alive.add(s.lowSeedTeamId); continue; }
    // won the latest round so far and it isn't the Final → waiting on the next round
    if (s.round === maxRound && s.round < 4) alive.add(s.winnerTeamId);
  }
  return alive;
}

export type TradeWindow = { deadline: Date | null; passed: boolean; frozen: boolean; reason: string | null };

/** Is trading between these clubs allowed right now? */
export async function tradeWindow(teamIds: number[] = []): Promise<TradeWindow> {
  const deadline = await getTradeDeadline();
  if (!deadline || Date.now() < deadline.getTime()) return { deadline, passed: false, frozen: false, reason: null };
  const cfg = await prisma.leagueConfig.findUnique({ where: { id: 1 }, select: { phaseOverride: true } }).catch(() => null);
  const phase = await computePhase(await getLeagueDate(), cfg?.phaseOverride);
  if (phase !== "regular" && phase !== "playoffs") return { deadline, passed: true, frozen: false, reason: null }; // season over → open again
  if (phase === "regular") return { deadline, passed: true, frozen: true, reason: "The trade deadline has passed — trading reopens once each club's season is over (end of the regular season for non-playoff clubs, elimination for playoff clubs)." };
  const alive = await aliveInPlayoffs();
  const stillPlaying = teamIds.filter((id) => alive.has(id));
  if (teamIds.length === 0 || stillPlaying.length) {
    return { deadline, passed: true, frozen: true, reason: "The trade deadline has passed — a club still alive in the playoffs can't trade until it's eliminated." };
  }
  return { deadline, passed: true, frozen: false, reason: null };
}

/** Throw if the deadline freeze blocks a trade between these clubs. Affiliates
 *  trade through their parent, so resolve them to the parent club first. */
export async function assertTradeWindowOpen(teamIds: number[]): Promise<void> {
  const deadline = await getTradeDeadline();
  if (!deadline || Date.now() < deadline.getTime()) return; // cheap path — no deadline / not yet
  const teams = await prisma.team.findMany({ where: { id: { in: teamIds } }, select: { id: true, parentTeamId: true } });
  const ids = [...new Set(teams.map((t) => t.parentTeamId ?? t.id))];
  const w = await tradeWindow(ids);
  if (w.frozen) throw new Error(w.reason ?? "Trading is frozen after the trade deadline.");
}

/** "YYYY-MM-DDTHH:mm" wall-clock in Europe/Bratislava → UTC Date (DST-safe). */
export function bratislavaLocalToUtc(local: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  // offset of Bratislava at that instant: format the guess there and diff
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: DEADLINE_TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date(guess)).map((p) => [p.type, p.value]));
  const asLocal = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour % 24, +parts.minute);
  return new Date(guess - (asLocal - guess));
}

/** UTC Date → "YYYY-MM-DDTHH:mm" Bratislava wall-clock (for the admin input). */
export function utcToBratislavaLocal(d: Date): string {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: DEADLINE_TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(d).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${String(+p.hour % 24).padStart(2, "0")}:${p.minute}`;
}
