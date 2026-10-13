import { prisma } from "./prisma";
import { isAdmin } from "./auth";
import { loadSettings } from "./sim/settings";
import { checkIceTimeMorale } from "./player-morale";
import { cleanName } from "./playerName";

export type UnhappyRow = {
  id: number; name: string; slug: string | null; position: string; teamCode: string | null; teamLogo: string | null;
  morale: number; checks: number; warnedAt: string | null; promiseWarned: boolean;
  tradeRequested: boolean; tradeReason: string | null; disgruntled: boolean;
  promise: string | null;
  // the ice-time check re-run right now (null = not evaluated: injured / too few games / extra)
  now: { role: string; games: number; actual: string; expected: string; ratio: number; unhappy: boolean } | null;
};

export type UnhappyData = { rows: UnhappyRow[]; warnDays: number; requestDays: number; pct: number };

/** Every NHL player carrying an unhappiness flag (ice-time count / warning / trade request / broken promise),
 *  together with a live re-evaluation of his ice time. */
export async function loadUnhappyPlayers(opts: { evaluate?: boolean } = {}): Promise<UnhappyData> {
  const s = await loadSettings();
  const players = await prisma.player.findMany({
    where: {
      team: { league: "NHL", isAffiliate: false },
      OR: [{ iceUnhappyChecks: { gt: 0 } }, { iceWarnedAt: { not: null } }, { promiseWarnGame: { not: null } }, { tradeRequested: true }, { disgruntled: true }],
    },
    select: {
      id: true, name: true, slug: true, position: true, morale: true, iceUnhappyChecks: true, iceWarnedAt: true, promiseWarnGame: true,
      tradeRequested: true, tradeRequestReason: true, disgruntled: true, signPromiseLine: true, signPromisePP: true, signPromisePK: true, isGoalie: true,
      team: { select: { code: true, logoUrl: true } },
    },
  });
  // the live re-check runs the ice-time evaluation for the whole league (~15 s) — the page loads
  // without it and asks for it afterwards (evaluateUnhappyNow)
  const evals = opts.evaluate ? new Map((await checkIceTimeMorale({ dryRun: true })).evals.map((e) => [e.playerId, e])) : new Map<number, never>();
  const promiseText = (p: (typeof players)[number]) => {
    if (p.signPromiseLine == null) return null;
    const role = p.isGoalie ? (p.signPromiseLine <= 1 ? "Starter" : p.signPromiseLine === 2 ? "Backup" : "3rd goalie")
      : /D/.test(p.position ?? "") ? (["", "top pair", "2nd pair", "3rd pair", "7th D"][p.signPromiseLine] ?? `pair ${p.signPromiseLine}`)
      : (["", "1st line", "2nd line", "3rd line", "4th line", "extra F"][p.signPromiseLine] ?? `line ${p.signPromiseLine}`);
    return `${role}${p.signPromisePP ? " + PP" : ""}${p.signPromisePK ? " + PK" : ""}`;
  };
  const rows: UnhappyRow[] = players.map((p) => {
    const e = evals.get(p.id);
    return {
      id: p.id, name: cleanName(p.name), slug: p.slug, position: p.position ?? "—", teamCode: p.team?.code ?? null, teamLogo: p.team?.logoUrl ?? null,
      morale: Math.round((p.morale ?? 50) * 10) / 10, checks: p.iceUnhappyChecks, warnedAt: p.iceWarnedAt?.toISOString() ?? null,
      promiseWarned: p.promiseWarnGame != null, tradeRequested: p.tradeRequested, tradeReason: p.tradeRequestReason, disgruntled: p.disgruntled,
      promise: promiseText(p),
      now: e ? { role: e.role, games: e.games, actual: e.actual, expected: e.expected, ratio: e.ratio, unhappy: e.unhappy } : null,
    };
  });
  rows.sort((a, b) => Number(b.tradeRequested) - Number(a.tradeRequested) || b.checks - a.checks || a.name.localeCompare(b.name));
  return { rows, warnDays: s.iceWarnDays, requestDays: s.iceRequestDays, pct: s.iceUnhappyPct };
}

/** Admin: wipe a player's unhappiness (count, warning, broken-promise warning, an ice/promise trade request)
 *  and the warning notes his agent sent to the club. */
export async function clearUnhappiness(playerIds: number[]) {
  if (!(await isAdmin())) return { ok: false as const, error: "Only a league admin can clear this." };
  const ids = [...new Set(playerIds.filter((n) => Number.isInteger(n) && n > 0))];
  if (!ids.length) return { ok: false as const, error: "No player given." };
  const players = await prisma.player.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, teamId: true, tradeRequested: true, tradeRequestReason: true } });
  for (const p of players) {
    const data: Record<string, unknown> = { iceUnhappyChecks: 0, iceWarnedAt: null, promiseWarnGame: null, disgruntled: false };
    if (p.tradeRequested && (p.tradeRequestReason === "ice" || p.tradeRequestReason === "promise")) Object.assign(data, { tradeRequested: false, tradeRequestReason: null });
    await prisma.player.update({ where: { id: p.id }, data });
    const name = cleanName(p.name);
    await prisma.dmMessage.deleteMany({
      where: { fromTeamId: p.teamId, toTeamId: p.teamId, OR: [{ body: { startsWith: `🗣️ ${name}'s agent` } }, { body: { startsWith: `📣 ${name} has formally` } }, { body: { startsWith: `🙂 ${name} is happy` } }] },
    }).catch(() => {});
  }
  return { ok: true as const, cleared: players.length };
}

/** The ice-time check re-run right now (writes nothing) — keyed by player id. */
export async function evaluateUnhappyNow(): Promise<Record<number, NonNullable<UnhappyRow["now"]>>> {
  if (!(await isAdmin())) return {};
  const out: Record<number, NonNullable<UnhappyRow["now"]>> = {};
  for (const e of (await checkIceTimeMorale({ dryRun: true })).evals) out[e.playerId] = { role: e.role, games: e.games, actual: e.actual, expected: e.expected, ratio: e.ratio, unhappy: e.unhappy };
  return out;
}
