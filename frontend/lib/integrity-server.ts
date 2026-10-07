// Result integrity — makes it provable that game results come straight out of the simulator
// and can't be planned or edited afterwards.
//
//  1. Unpredictable seeds: every game is simulated with a seed drawn from the OS CSPRNG at sim
//     time (lib/sim/secure-seed.ts) — not derived from teams/round/game id like the old seed.
//  2. Sealing: in the SAME transaction that saves a result (lib/sim/persist.ts → saveGameResult,
//     the single door every regular-season, pre-season and playoff game goes through) a seal is
//     appended to a SHA-256 hash chain:
//        hash = SHA-256( prevHash | resultDigest | gameId | seed | engineVersion | seedSource | sealedAt(ms) )
//     resultDigest = SHA-256 of the canonical result as stored in the DB (score, per-period goals,
//     shots, winner, how it ended, seed, engine, and the full goal list).
//  3. Verification (/league/integrity): recompute the chain, recompute every result digest from the
//     live DB rows and compare with its seal, and cross-check score vs goal rows vs player stats.
//     Editing a result (or a seal) after the fact is therefore detected.
//  Results that existed before sealing started are sealed once as "LEGACY" (as-is, not at sim time).

import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

export const GENESIS_HASH = "0".repeat(64);
const LOCK_KEY = 7340211;
const sha = (s: string) => createHash("sha256").update(s).digest("hex");

type GameFields = {
  id: number; season: string; league: string | null; seriesId: number | null;
  homeTeamId: number; awayTeamId: number; homeGoals: number | null; awayGoals: number | null;
  homeGoalsByPeriod: unknown; awayGoalsByPeriod: unknown; homeShots: number | null; awayShots: number | null;
  endedIn: string | null; winnerTeamId: number | null; seed: number | null; engineVersion: string | null;
};
type GoalFields = { period: number; seconds: number; teamId: number; scorerId: number | null; assistIds: number[] };

const GAME_SELECT = {
  id: true, season: true, league: true, seriesId: true, homeTeamId: true, awayTeamId: true, homeGoals: true, awayGoals: true,
  homeGoalsByPeriod: true, awayGoalsByPeriod: true, homeShots: true, awayShots: true, endedIn: true, winnerTeamId: true,
  seed: true, engineVersion: true,
} as const;

/** Canonical SHA-256 of a stored result. Used both when sealing and when verifying. */
export function resultDigest(g: GameFields, goals: GoalFields[]): string {
  const goalList = goals
    .map((x) => [x.period, x.seconds, x.teamId, x.scorerId ?? null, [...(x.assistIds ?? [])]] as const)
    .sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2] || (a[3] ?? 0) - (b[3] ?? 0) || JSON.stringify(a[4]).localeCompare(JSON.stringify(b[4])));
  return sha(JSON.stringify([
    g.id, g.season, g.league ?? "NHL", g.seriesId ?? null, g.homeTeamId, g.awayTeamId, g.homeGoals, g.awayGoals,
    g.homeGoalsByPeriod ?? null, g.awayGoalsByPeriod ?? null, g.homeShots, g.awayShots, g.endedIn, g.winnerTeamId,
    g.seed, g.engineVersion ?? null, goalList,
  ]));
}

type SealFields = { prevHash: string; resultDigest: string; gameId: number; seed: number | null; engineVersion: string | null; seedSource: string; sealedAt: Date };
export const sealHash = (s: SealFields) =>
  sha(`${s.prevHash}|${s.resultDigest}|${s.gameId}|${s.seed ?? ""}|${s.engineVersion ?? ""}|${s.seedSource}|${s.sealedAt.getTime()}`);

/** Append a seal for `gameId` as it is stored right now. Call inside the transaction that saved it. */
export async function sealGame(tx: Prisma.TransactionClient, gameId: number, seedSource: "CSPRNG" | "LEGACY" | "NO_CONTEST") {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOCK_KEY})`; // one writer at a time → strictly linear chain
  const [last, game, goals] = await Promise.all([
    tx.gameSeal.findFirst({ orderBy: { id: "desc" }, select: { hash: true } }),
    tx.game.findUniqueOrThrow({ where: { id: gameId }, select: GAME_SELECT }),
    tx.gameGoal.findMany({ where: { gameId }, select: { period: true, seconds: true, teamId: true, scorerId: true, assistIds: true } }),
  ]);
  const prevHash = last?.hash ?? GENESIS_HASH;
  const digest = resultDigest(game as GameFields, goals as GoalFields[]);
  const sealedAt = new Date();
  const hash = sealHash({ prevHash, resultDigest: digest, gameId, seed: game.seed, engineVersion: game.engineVersion, seedSource, sealedAt });
  await tx.gameSeal.create({ data: { gameId, seed: game.seed, engineVersion: game.engineVersion, seedSource, resultDigest: digest, prevHash, hash, sealedAt } });
}

/** One-time: seal every result that already existed (as LEGACY), then drop a GENESIS marker so it never runs again. */
export async function backfillLegacySeals(): Promise<number> {
  if (await prisma.gameSeal.findFirst({ where: { seedSource: "GENESIS" }, select: { id: true } })) return 0;
  let sealed = 0;
  const already = new Set((await prisma.gameSeal.findMany({ where: { gameId: { gt: 0 } }, select: { gameId: true } })).map((x) => x.gameId));
  const todo = (await prisma.game.findMany({ where: { status: "FINAL" }, orderBy: { id: "asc" }, select: { id: true } })).map((g) => g.id).filter((id) => !already.has(id));
  for (let i = 0; i < todo.length; i += 100) {
    const batch = todo.slice(i, i + 100);
    await prisma.$transaction(async (tx) => { for (const id of batch) await sealGame(tx, id, "LEGACY"); }, { timeout: 60_000 });
    sealed += batch.length;
  }
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOCK_KEY})`;
    const last = await tx.gameSeal.findFirst({ orderBy: { id: "desc" }, select: { hash: true } });
    const prevHash = last?.hash ?? GENESIS_HASH;
    const digest = sha(`genesis|${sealed}`);
    const sealedAt = new Date();
    const hash = sealHash({ prevHash, resultDigest: digest, gameId: 0, seed: null, engineVersion: null, seedSource: "GENESIS", sealedAt });
    await tx.gameSeal.create({ data: { gameId: 0, seed: null, engineVersion: null, seedSource: "GENESIS", resultDigest: digest, prevHash, hash, sealedAt } });
  });
  return sealed;
}

/** Once per Bratislava day: publish the chain head as a league-news line so it can't be quietly rewritten. */
export async function postDailyCheckpoint(dateStr: string): Promise<boolean> {
  const prefix = `🔒 Integrity checkpoint ${dateStr}`;
  if (await prisma.transaction.findFirst({ where: { type: "NEWS", message: { startsWith: prefix } }, select: { id: true } })) return false;
  const [head, count] = await Promise.all([
    prisma.gameSeal.findFirst({ orderBy: { id: "desc" }, select: { hash: true } }),
    prisma.gameSeal.count(),
  ]);
  if (!head) return false;
  await prisma.transaction.create({ data: { type: "NEWS", message: `${prefix}: ${count} sealed entries, chain head ${head.hash.slice(0, 16)}… — verify on /league/integrity` } });
  return true;
}

export type IntegrityIssue = { gameId: number; label: string; detail: string };
export type IntegrityReport = {
  checkedAt: string;
  chain: { entries: number; ok: boolean; brokenAtSealId: number | null; head: string | null; genesisAt: string | null };
  games: { final: number; verified: number; csprng: number; legacy: number; noContest: number; unsealed: IntegrityIssue[]; edited: IntegrityIssue[] };
  consistency: { checked: number; mismatches: IntegrityIssue[] };
  resims: { games: number; list: IntegrityIssue[] };
  recent: { gameId: number; label: string; seed: number | null; seedSource: string; hash: string; sealedAt: string }[];
};

/** Recompute everything from the live DB and report. Read-only. */
export async function verifyIntegrity(): Promise<IntegrityReport> {
  const [seals, games] = await Promise.all([
    prisma.gameSeal.findMany({ orderBy: { id: "asc" } }),
    prisma.game.findMany({ where: { status: "FINAL" }, select: { ...GAME_SELECT, simCount: true, lastSimBy: true } }),
  ]);
  const ids = games.map((g) => g.id);
  const teamIds = [...new Set(games.flatMap((g) => [g.homeTeamId, g.awayTeamId]))];
  const [teams, goalRows, goalCounts, statSums] = await Promise.all([
    prisma.team.findMany({ where: { id: { in: teamIds } }, select: { id: true, code: true, name: true } }),
    prisma.gameGoal.findMany({ where: { gameId: { in: ids } }, select: { gameId: true, period: true, seconds: true, teamId: true, scorerId: true, assistIds: true } }),
    prisma.gameGoal.groupBy({ by: ["gameId", "teamId"], where: { gameId: { in: ids } }, _count: { _all: true } }),
    prisma.playerGameStat.groupBy({ by: ["gameId", "teamId"], where: { gameId: { in: ids } }, _sum: { goals: true } }),
  ]);
  const code = new Map(teams.map((t) => [t.id, t.code ?? t.name]));
  const label = (g: { id: number; homeTeamId: number; awayTeamId: number; homeGoals: number | null; awayGoals: number | null }) =>
    `${code.get(g.homeTeamId) ?? g.homeTeamId} ${g.homeGoals ?? "?"}–${g.awayGoals ?? "?"} ${code.get(g.awayTeamId) ?? g.awayTeamId} (#${g.id})`;

  // 1) the hash chain itself
  let ok = true, brokenAtSealId: number | null = null, prev = GENESIS_HASH;
  for (const s of seals) {
    if (s.prevHash !== prev || sealHash(s) !== s.hash) { ok = false; brokenAtSealId = s.id; break; }
    prev = s.hash;
  }

  // 2) every FINAL result must match the digest in its latest seal
  const latest = new Map<number, (typeof seals)[number]>();
  const sealCount = new Map<number, number>();
  for (const s of seals) { if (s.gameId > 0) { latest.set(s.gameId, s); sealCount.set(s.gameId, (sealCount.get(s.gameId) ?? 0) + 1); } }
  const goalsByGame = new Map<number, GoalFields[]>();
  for (const x of goalRows) { const a = goalsByGame.get(x.gameId) ?? []; a.push(x as GoalFields); goalsByGame.set(x.gameId, a); }
  const unsealed: IntegrityIssue[] = [], edited: IntegrityIssue[] = [];
  let verified = 0, csprng = 0, legacy = 0, noContest = 0;
  for (const g of games) {
    const s = latest.get(g.id);
    if (!s) { unsealed.push({ gameId: g.id, label: label(g), detail: "Result exists without a simulator seal" }); continue; }
    if (resultDigest(g as GameFields, goalsByGame.get(g.id) ?? []) !== s.resultDigest) {
      edited.push({ gameId: g.id, label: label(g), detail: `Stored result no longer matches its seal from ${s.sealedAt.toISOString().slice(0, 16).replace("T", " ")} UTC` });
      continue;
    }
    verified++;
    if (s.seedSource === "CSPRNG") csprng++; else if (s.seedSource === "NO_CONTEST") noContest++; else legacy++;
  }

  // 3) the score must agree with the goal log and the player box scores (shootout winner gets +1)
  const gc = new Map(goalCounts.map((r) => [`${r.gameId}:${r.teamId}`, r._count._all]));
  const ps = new Map(statSums.map((r) => [`${r.gameId}:${r.teamId}`, r._sum.goals ?? 0]));
  const mismatches: IntegrityIssue[] = [];
  for (const g of games) {
    const so = g.endedIn === "SO";
    const exp = (teamId: number) => (so && g.winnerTeamId === teamId ? 1 : 0);
    const hg = g.homeGoals ?? 0, ag = g.awayGoals ?? 0;
    const probs: string[] = [];
    if ((gc.get(`${g.id}:${g.homeTeamId}`) ?? 0) + exp(g.homeTeamId) !== hg || (gc.get(`${g.id}:${g.awayTeamId}`) ?? 0) + exp(g.awayTeamId) !== ag) probs.push("score ≠ goal log");
    if ((ps.get(`${g.id}:${g.homeTeamId}`) ?? 0) + exp(g.homeTeamId) !== hg || (ps.get(`${g.id}:${g.awayTeamId}`) ?? 0) + exp(g.awayTeamId) !== ag) probs.push("score ≠ player box score");
    const leader = hg > ag ? g.homeTeamId : ag > hg ? g.awayTeamId : null;
    if (leader != null && g.winnerTeamId !== leader) probs.push("winner ≠ higher score");
    if (probs.length) mismatches.push({ gameId: g.id, label: label(g), detail: probs.join("; ") });
  }

  const resimGames = games.filter((g) => (sealCount.get(g.id) ?? 0) > 1 || g.simCount > 1);
  const byId = new Map(games.map((g) => [g.id, g]));
  const recent = seals.filter((s) => s.gameId > 0).slice(-25).reverse().map((s) => {
    const g = byId.get(s.gameId);
    return { gameId: s.gameId, label: g ? label(g) : `#${s.gameId}`, seed: s.seed, seedSource: s.seedSource, hash: s.hash, sealedAt: s.sealedAt.toISOString() };
  });
  const genesis = seals.find((s) => s.seedSource === "GENESIS");

  return {
    checkedAt: new Date().toISOString(),
    chain: { entries: seals.length, ok, brokenAtSealId, head: seals.length ? seals[seals.length - 1].hash : null, genesisAt: genesis ? genesis.sealedAt.toISOString() : null },
    games: { final: games.length, verified, csprng, legacy, noContest, unsealed: unsealed.slice(0, 25), edited: edited.slice(0, 25) },
    consistency: { checked: games.length, mismatches: mismatches.slice(0, 25) },
    resims: { games: resimGames.length, list: resimGames.slice(0, 25).map((g) => ({ gameId: g.id, label: label(g), detail: `simulated ${Math.max(g.simCount, sealCount.get(g.id) ?? 0)}×` })) },
    recent,
  };
}
