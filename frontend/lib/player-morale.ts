// Ice-time morale — every NHL player (not just ones with a signing promise, which
// lib/promises.ts handles) compares the ice time he's actually getting with what
// his talent says he deserves ON HIS OWN CLUB. Stay short of it and he sours:
//   day `iceWarnDays`    → his agent tells the GM (private, League Notifications)
//   day `iceRequestDays` → he publicly requests a trade
// While he's unhappy he won't negotiate an extension (app/free-agents/actions.ts).
// Give him the minutes back and it unwinds: the warning clears, an ice-time trade
// request is withdrawn. A trade to a new club wipes it (lib/trade-exec.ts).
//
// "What he deserves" is self-calibrating — no hard-coded minutes: a player whose
// talent projects onto the 2nd line is compared with the average ice time of HIS
// team's 2nd-line tier (forwards ranked 4-6 by TOI) over the club's last 10 games.
// A healthy scratch counts as 0:00. Goalies compare their share of starts.

import { prisma } from "./prisma";
import { getLeagueClock } from "./calendar-server";
import { loadSettings } from "./sim/settings";
import { loadTeamContext, projectSlot, playerMarket, teamContentionMap } from "./free-agency-server";
import { slotLabel, type LineSlot } from "./free-agency";
import { REGULAR_SEASON } from "./phase";
import { cleanName } from "./playerName";

const WINDOW = 10;               // the club's last N regular-season games
const SETTLE_DAYS = 14;          // just traded / signed → give him two weeks to settle
const MORALE_DROP_PER_DAY = 1.5; // each unhappy day
const MORALE_FLOOR = 25;
const MIN_GAMES = 5;             // games with THIS club inside the window before he's judged
const GOALIE_SHARE: Record<number, number> = { 1: 0.65, 2: 0.25 };
// tier of TOI ranks each line maps to (1-based ranks within F / D)
const F_TIER: Record<number, [number, number]> = { 1: [1, 3], 2: [4, 6], 3: [7, 9], 4: [10, 12] };
const D_TIER: Record<number, [number, number]> = { 1: [1, 2], 2: [3, 4], 3: [5, 6] };
const EXTRA: LineSlot[] = ["XF", "XD", "G3"]; // projects as a press-box extra — no minutes expected

const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, "0")}`;

export type IceEval = { playerId: number; name: string; team: string | null; role: string; games: number; actual: string; expected: string; ratio: number; unhappy: boolean };
export type IceCheck = { warned: number; requested: number; resolved: number; withdrawn: number; notes: string[]; evals: IceEval[] };

/** `dryRun` evaluates without writing anything (and without the phase gate) — for
 *  calibration against real data; `season` defaults to the regular season. */
export async function checkIceTimeMorale(opts: { dryRun?: boolean; season?: string } = {}): Promise<IceCheck> {
  const out: IceCheck = { warned: 0, requested: 0, resolved: 0, withdrawn: 0, notes: [], evals: [] };
  const season = opts.season ?? REGULAR_SEASON;
  if (!opts.dryRun) {
    const clock = await getLeagueClock();
    if (clock.phase !== "regular") return out;
  }
  const s = await loadSettings();
  if (!s.moraleEnabled && !opts.dryRun) return out;

  const teams = await prisma.team.findMany({ where: { league: "NHL", isAffiliate: false }, select: { id: true, code: true } });
  const cmap = await teamContentionMap().catch(() => undefined);
  const settleSince = new Date(Date.now() - SETTLE_DAYS * 86400000);
  const [recentTrades, recentSigns] = await Promise.all([
    prisma.trade.findMany({ where: { status: "ACCEPTED", OR: [{ respondedAt: { gte: settleSince } }, { respondedAt: null, createdAt: { gte: settleSince } }] }, select: { id: true } }),
    prisma.signingLog.findMany({ where: { createdAt: { gte: settleSince } }, select: { playerId: true } }),
  ]);
  const settling = new Set<number>(recentSigns.map((r) => r.playerId));
  if (recentTrades.length) {
    for (const a of await prisma.tradeAsset.findMany({ where: { tradeId: { in: recentTrades.map((t) => t.id) }, assetType: "PLAYER" }, select: { playerId: true } }))
      if (a.playerId) settling.add(a.playerId);
  }

  for (const team of teams) {
    const games = await prisma.game.findMany({
      where: { season, league: "NHL", status: "FINAL", seriesId: null, OR: [{ homeTeamId: team.id }, { awayTeamId: team.id }] },
      orderBy: [{ gameDate: "desc" }, { id: "desc" }], take: WINDOW, select: { id: true },
    });
    if (games.length < MIN_GAMES) continue; // not enough of a sample yet
    const gameIds = games.map((g) => g.id); // newest first

    const [roster, apps, skStats, gkStarts, ctx] = await Promise.all([
      prisma.player.findMany({
        where: { teamId: team.id, rosterType: "NHL" },
        select: { id: true, name: true, position: true, isGoalie: true, capHit: true, sc: true, pa: true, df: true, sk: true, goalieRating: { select: { ag: true, rb: true, sc: true, hs: true } },
          injuryDaysLeft: true, injuredAt: true, signPromiseLine: true, morale: true, iceUnhappyChecks: true, iceWarnedAt: true, tradeRequested: true, tradeRequestReason: true },
      }),
      // every appearance with this club this season → where his membership window starts
      Promise.all([
        prisma.playerGameStat.findMany({ where: { teamId: team.id, game: { season, league: "NHL", status: "FINAL", seriesId: null } }, select: { playerId: true, gameId: true } }),
        prisma.goalieGameStat.findMany({ where: { teamId: team.id, game: { season, league: "NHL", status: "FINAL", seriesId: null } }, select: { playerId: true, gameId: true } }),
      ]).then(([a, b]) => [...a, ...b]),
      prisma.playerGameStat.groupBy({ by: ["playerId"], where: { gameId: { in: gameIds }, teamId: team.id }, _sum: { toi: true } }),
      prisma.goalieGameStat.groupBy({ by: ["playerId"], where: { gameId: { in: gameIds }, teamId: team.id, started: true }, _count: { _all: true } }),
      loadTeamContext(team.id, cmap),
    ]);
    const toiBy = new Map(skStats.map((r) => [r.playerId, r._sum.toi ?? 0]));
    // games (in this window) since his FIRST appearance for this club — a call-up
    // or new arrival isn't blamed for games before he was here. Never dressed for
    // them this season → we can't tell when he arrived, so he isn't judged.
    const allGames = await prisma.game.findMany({ where: { id: { in: [...new Set(apps.map((a) => a.gameId))] } }, select: { id: true, gameDate: true } });
    const gDate = new Map(allGames.map((g) => [g.id, g.gameDate?.getTime() ?? 0]));
    const firstApp = new Map<number, number>();
    for (const a of apps) { const t = gDate.get(a.gameId) ?? 0; if (!firstApp.has(a.playerId) || t < firstApp.get(a.playerId)!) firstApp.set(a.playerId, t); }
    const windowDates = await prisma.game.findMany({ where: { id: { in: gameIds } }, select: { id: true, gameDate: true } });
    const wDate = new Map(windowDates.map((g) => [g.id, g.gameDate?.getTime() ?? 0]));
    const memberGames = (pid: number) => { const f = firstApp.get(pid); return f == null ? 0 : gameIds.filter((id) => (wDate.get(id) ?? 0) >= f).length; };
    const startsBy = new Map(gkStarts.map((r) => [r.playerId, r._count._all]));
    const skaters = roster.filter((p) => !p.isGoalie);
    const isD = (pos: string | null) => (pos ?? "").toUpperCase().startsWith("D");
    // per-game TOI of every regular in the group, ranked → the average of a tier
    const tierAvg = (group: typeof skaters, tier: [number, number]) => {
      const perGame = group.map((p) => { const n = memberGames(p.id); return n ? (toiBy.get(p.id) ?? 0) / n : 0; }).sort((a, b) => b - a).slice(tier[0] - 1, tier[1]);
      return perGame.length ? perGame.reduce((a, b) => a + b, 0) / perGame.length : 0;
    };
    const windowStart = new Date(Date.now() - 30 * 86400000);

    for (const p of roster) {
      if (p.signPromiseLine != null) continue;                       // promises.ts owns him
      if (settling.has(p.id)) continue;
      if (p.injuryDaysLeft > 0 || (p.injuredAt && p.injuredAt > windowStart)) continue; // hurt, not snubbed
      const { grp, market } = playerMarket(p as never);
      const { slot, line } = projectSlot(ctx, grp, market);
      if (EXTRA.includes(slot)) continue;
      const n = memberGames(p.id);
      if (n < MIN_GAMES) continue;

      let unhappy: boolean, actualTxt: string, expectTxt: string, ratio: number;
      if (p.isGoalie) {
        const share = (startsBy.get(p.id) ?? 0) / n;
        const want = GOALIE_SHARE[line] ?? 0.25;
        ratio = share / want;
        unhappy = ratio < s.iceUnhappyPct / 100;
        actualTxt = `${startsBy.get(p.id) ?? 0} of the last ${n} starts`; expectTxt = `~${Math.round(want * n)}`;
      } else {
        const group = skaters.filter((x) => isD(x.position) === isD(p.position));
        const tier = (isD(p.position) ? D_TIER : F_TIER)[line];
        if (!tier) continue;
        const expected = tierAvg(group, tier);
        const actual = (toiBy.get(p.id) ?? 0) / n;
        if (expected <= 0) continue;
        ratio = actual / expected;
        unhappy = ratio < s.iceUnhappyPct / 100;
        actualTxt = `${mmss(actual)} a night`; expectTxt = mmss(expected);
      }
      const name = cleanName(p.name);
      const role = slotLabel(slot);
      out.evals.push({ playerId: p.id, name, team: team.code, role, games: n, actual: actualTxt, expected: expectTxt, ratio, unhappy });
      if (opts.dryRun) continue;

      if (unhappy) {
        const checks = p.iceUnhappyChecks + 1;
        const morale = Math.max(MORALE_FLOOR, (p.morale ?? 50) - MORALE_DROP_PER_DAY);
        const data: Record<string, unknown> = { iceUnhappyChecks: checks, morale, mo: morale };
        if (checks >= s.iceWarnDays && !p.iceWarnedAt) {
          data.iceWarnedAt = new Date();
          await notify(team.id, `🗣️ ${name}'s agent: he sees himself as your ${role}, but he's getting ${actualTxt} over his last ${n} games (that role gets ${expectTxt} on your club). He wants more ice time — until then he won't talk about an extension, and if it drags on he'll ask to be traded.`);
          out.warned++; out.notes.push(`${name} (${team.code}) warned about ice time`);
        }
        if (checks >= s.iceRequestDays && !p.tradeRequested) {
          Object.assign(data, { tradeRequested: true, tradeRequestReason: "ice", morale: Math.min(morale, 35), mo: Math.min(morale, 35) });
          await prisma.transaction.create({ data: { type: "TRADE_REQUEST", playerId: p.id, teamId: team.id, message: `${team.code ?? "?"}: ${name} has requested a trade — unhappy with his ice time (${actualTxt}).` } });
          await notify(team.id, `📣 ${name} has formally requested a trade. He's been stuck at ${actualTxt} for weeks. Give him his minutes back and he may withdraw it — or move him.`);
          out.requested++; out.notes.push(`${name} (${team.code}) requested a trade`);
        }
        await prisma.player.update({ where: { id: p.id }, data });
      } else if (p.iceUnhappyChecks > 0) {
        const checks = Math.max(0, p.iceUnhappyChecks - 2); // recovers twice as fast as it sours
        const data: Record<string, unknown> = { iceUnhappyChecks: checks };
        if (checks === 0 && p.iceWarnedAt) {
          data.iceWarnedAt = null;
          await notify(team.id, `🙂 ${name} is happy with his role again — he's open to extension talks.`);
          out.resolved++;
        }
        if (checks === 0 && p.tradeRequested && p.tradeRequestReason === "ice") {
          Object.assign(data, { tradeRequested: false, tradeRequestReason: null });
          await prisma.transaction.create({ data: { type: "NEWS", playerId: p.id, teamId: team.id, message: `${team.code ?? "?"}: ${name} has withdrawn his trade request — he's getting the ice time he wanted.` } });
          out.withdrawn++;
        }
        await prisma.player.update({ where: { id: p.id }, data });
      }
    }
  }
  return out;
}

/** Private note to the club's League Notifications thread (a team messaging itself). */
async function notify(teamId: number, body: string) {
  await prisma.dmMessage.create({ data: { fromTeamId: teamId, toTeamId: teamId, body } }).catch(() => {});
}
