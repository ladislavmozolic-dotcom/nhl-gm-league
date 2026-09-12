import { prisma } from "@/lib/prisma";
import { autoLines } from "@/lib/sim/lines-core";
import { playerCapYears, seasonLabel, CURRENT_SEASON_START } from "@/lib/finance";
import { loadLeagueCap } from "@/lib/free-agency-server";
import { loadLeagueSlots, rankSlot, compositeRating, SLOTS, type LeagueSlotsData, type SlotPlayer } from "./leagueSlots";

// UNHL Intelligence — Scenario Engine ("Čo ak?", roadmap Phase 6, see memory:
// gm-assistant-intelligence). Same non-negotiable rule as every other tool
// here: no model, no verdict — a hypothetical move is applied to an in-memory
// clone of the real roster/league state (nothing is ever written to the DB),
// and the ONLY output is a plain before/after diff on three real numbers:
// cap hit by season, this club's league rank on every roster-shape slot
// (the exact same slots/rating Analyze My Roster uses), and average age.
// The GM decides what the numbers mean — this never says "good/bad trade".

export type ScenarioMove =
  | { kind: "sign"; playerId: number; capHit: number; years: number }
  | { kind: "walk"; playerId: number }
  | { kind: "trade"; partnerTeamId: number; giveIds: number[]; getIds: number[] };

export interface ScenarioMoveDescribed {
  move: ScenarioMove;
  label: string;
  valid: boolean;
  problem?: string;
}

export interface ScenarioCapRow {
  year: string;
  before: number;
  after: number;
  delta: number;
  overBefore: boolean;
  overAfter: boolean;
}

export interface ScenarioSlotRow {
  id: string;
  label: string;
  before: { rank: number; size: number; avg: number } | null;
  after: { rank: number; size: number; avg: number } | null;
  delta: number | null; // positive = rank improved (moved up)
}

export interface ScenarioResult {
  teamId: number;
  teamName: string;
  moves: ScenarioMoveDescribed[];
  capBySeason: ScenarioCapRow[];
  capCeiling: number;
  avgAge: { before: number | null; after: number | null; delta: number | null };
  slots: ScenarioSlotRow[];
}

// ---- move string encoding (kept in the page's ?moves= URL, never persisted) --

export function encodeMoves(moves: ScenarioMove[]): string {
  return moves
    .map((m) => {
      if (m.kind === "sign") return `sign:${m.playerId}:${m.capHit}:${m.years}`;
      if (m.kind === "walk") return `walk:${m.playerId}`;
      return `trade:${m.partnerTeamId}:${m.giveIds.join(".")}:${m.getIds.join(".")}`;
    })
    .join(",");
}

export function parseMoves(raw: string | undefined): ScenarioMove[] {
  if (!raw) return [];
  const out: ScenarioMove[] = [];
  for (const chunk of raw.split(",")) {
    const s = chunk.trim();
    if (!s) continue;
    const [kind, ...rest] = s.split(":");
    if (kind === "sign") {
      const [id, cap, yrs] = rest;
      const playerId = Number(id), capHit = Number(cap), years = Number(yrs);
      if (Number.isFinite(playerId) && Number.isFinite(capHit) && Number.isFinite(years)) out.push({ kind: "sign", playerId, capHit, years });
    } else if (kind === "walk") {
      const playerId = Number(rest[0]);
      if (Number.isFinite(playerId)) out.push({ kind: "walk", playerId });
    } else if (kind === "trade") {
      const [partner, give, get] = rest;
      const partnerTeamId = Number(partner);
      const giveIds = (give ? give.split(".") : []).map(Number).filter(Number.isFinite);
      const getIds = (get ? get.split(".") : []).map(Number).filter(Number.isFinite);
      if (Number.isFinite(partnerTeamId) && (giveIds.length || getIds.length)) out.push({ kind: "trade", partnerTeamId, giveIds, getIds });
    }
  }
  return out;
}

// ---- data access helpers used by the page (search boxes / rosters) ----------

const ROSTER_SELECT = {
  id: true, name: true, slug: true, position: true, overall: true,
  capHit: true, contractYears: true, isGoalie: true,
  goalieRating: { select: { overall: true } },
} as const;

export async function listTeamRoster(teamId: number) {
  return prisma.player.findMany({ where: { teamId, rosterType: "NHL" }, select: ROSTER_SELECT, orderBy: { overall: "desc" } });
}

export async function listNhlTeams() {
  return prisma.team.findMany({ where: { league: "NHL", isAffiliate: false }, select: { id: true, name: true, code: true }, orderBy: { name: "asc" } });
}

export async function searchUfaPlayers(query: string) {
  const q = query.trim();
  if (!q) return [];
  return prisma.player.findMany({
    where: { rosterType: "UFA", name: { contains: q, mode: "insensitive" } },
    select: ROSTER_SELECT,
    orderBy: { overall: "desc" },
    take: 12,
  });
}

// ---- the engine itself --------------------------------------------------

const PLAYER_SELECT = {
  id: true, name: true, slug: true, teamId: true, isGoalie: true,
  position: true, shoots: true, overall: true, ck: true, pa: true, sc: true, df: true, sk: true, ph: true,
  capHit: true, contractYears: true, age: true, birthDate: true, scratched: true,
  goalieRating: { select: { overall: true } },
} as const;

type RawPlayer = Awaited<ReturnType<typeof fetchRoster>>[number];

async function fetchRoster(teamIds: number[]) {
  return prisma.player.findMany({ where: { teamId: { in: teamIds }, rosterType: "NHL" }, select: PLAYER_SELECT });
}

function toLineSkater(p: RawPlayer) {
  return { id: p.id, position: p.position, overall: p.overall ?? 0, shoots: p.shoots };
}
function toLineGoalie(p: RawPlayer) {
  return { id: p.id, overall: p.goalieRating?.overall ?? p.overall ?? 0 };
}
function toSlotPlayer(p: RawPlayer): SlotPlayer {
  return p.isGoalie
    ? { id: p.id, name: p.name, slug: p.slug, overall: p.goalieRating?.overall ?? null, rating: p.goalieRating?.overall ?? null }
    : { id: p.id, name: p.name, slug: p.slug, overall: p.overall, rating: compositeRating(p) };
}

const avgAgeOf = (players: RawPlayer[]) => {
  const ages = players.map((p) => p.age).filter((a): a is number => a != null);
  return ages.length ? ages.reduce((s, a) => s + a, 0) / ages.length : null;
};

function capBySeasonFor(players: RawPlayer[], span: number) {
  const totals = new Array(span).fill(0) as number[];
  for (const p of players) {
    playerCapYears(p, CURRENT_SEASON_START, span).forEach((y, i) => { if (y.salary != null) totals[i] += y.salary; });
  }
  return totals;
}

export async function runScenario(teamId: number, moves: ScenarioMove[]): Promise<ScenarioResult | null> {
  const data = await loadLeagueSlots();
  const myTeam = data.teams.find((t) => t.id === teamId);
  if (!myTeam) return null;

  const partnerIds = moves.filter((m) => m.kind === "trade").map((m) => (m as { partnerTeamId: number }).partnerTeamId);
  const touchedTeamIds = [...new Set([teamId, ...partnerIds])].filter((id) => data.teams.some((t) => t.id === id));

  const signIds = [...new Set(moves.filter((m) => m.kind === "sign").map((m) => (m as { playerId: number }).playerId))];
  const [touchedRows, signRows] = await Promise.all([
    fetchRoster(touchedTeamIds),
    signIds.length ? prisma.player.findMany({ where: { id: { in: signIds }, rosterType: "UFA" }, select: PLAYER_SELECT }) : Promise.resolve([] as RawPlayer[]),
  ]);

  const nameById = new Map<number, string>();
  for (const p of [...touchedRows, ...signRows]) nameById.set(p.id, p.name);
  const teamNameById = new Map(data.teams.map((t) => [t.id, t.name]));
  const signById = new Map(signRows.map((p) => [p.id, p]));

  const rosterByTeam = new Map<number, RawPlayer[]>();
  for (const id of touchedTeamIds) rosterByTeam.set(id, touchedRows.filter((p) => p.teamId === id));
  const myRosterBefore = [...(rosterByTeam.get(teamId) ?? [])];

  const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
  const describeMove = (move: ScenarioMove): ScenarioMoveDescribed => {
    if (move.kind === "sign") {
      const p = signById.get(move.playerId);
      if (!p) return { move, label: `Podpísať hráča #${move.playerId}`, valid: false, problem: "hráč sa nenašiel medzi voľnými agentmi" };
      return { move, label: `Podpísať ${p.name} — ${money(move.capHit)} × ${move.years} r.`, valid: true };
    }
    if (move.kind === "walk") {
      const onRoster = (rosterByTeam.get(teamId) ?? []).some((p) => p.id === move.playerId);
      const name = nameById.get(move.playerId) ?? `hráč #${move.playerId}`;
      if (!onRoster) return { move, label: `Vyradiť ${name} z kádra`, valid: false, problem: "hráč momentálne nie je na tvojom NHL rosteri" };
      return { move, label: `Vyradiť ${name} z kádra (odchádza bez náhrady, bez capu)`, valid: true };
    }
    const partnerName = teamNameById.get(move.partnerTeamId) ?? `tím #${move.partnerTeamId}`;
    const giveNames = move.giveIds.map((id) => nameById.get(id) ?? `#${id}`);
    const getNames = move.getIds.map((id) => nameById.get(id) ?? `#${id}`);
    const giveOk = move.giveIds.every((id) => (rosterByTeam.get(teamId) ?? []).some((p) => p.id === id));
    const getOk = move.getIds.every((id) => (rosterByTeam.get(move.partnerTeamId) ?? []).some((p) => p.id === id));
    if (!giveOk || !getOk) {
      return { move, label: `Trade s ${partnerName}: dávaš [${giveNames.join(", ") || "—"}] za [${getNames.join(", ") || "—"}]`, valid: false, problem: "niektorý z hráčov nie je na očakávanom rosteri" };
    }
    return { move, label: `Trade s ${partnerName}: dávaš [${giveNames.join(", ") || "—"}] za [${getNames.join(", ") || "—"}]`, valid: true };
  };

  // Validate AND apply each move in order against the roster state left by
  // the ones before it — not the original roster — so a chained scenario
  // ("sign him, then trade him away") resolves correctly move by move. Only
  // a team whose player pool ACTUALLY changes (a valid move touched it) goes
  // into dirtyTeams — a zero-move or all-invalid scenario must leave every
  // club's real (possibly hand-saved) lines alone, not silently replace them
  // with a fresh autoLines() rebuild that can rank differently for no reason.
  const dirtyTeams = new Set<number>();
  const described: ScenarioMoveDescribed[] = [];
  for (const move of moves) {
    const d = describeMove(move);
    described.push(d);
    if (!d.valid) continue;
    if (move.kind === "sign") {
      const p = signById.get(move.playerId)!;
      const hypothetical: RawPlayer = { ...p, teamId, capHit: move.capHit, contractYears: move.years };
      rosterByTeam.set(teamId, [...(rosterByTeam.get(teamId) ?? []), hypothetical]);
      dirtyTeams.add(teamId);
    } else if (move.kind === "walk") {
      rosterByTeam.set(teamId, (rosterByTeam.get(teamId) ?? []).filter((p) => p.id !== move.playerId));
      dirtyTeams.add(teamId);
    } else {
      const mine = rosterByTeam.get(teamId) ?? [];
      const theirs = rosterByTeam.get(move.partnerTeamId) ?? [];
      const giving = mine.filter((p) => move.giveIds.includes(p.id));
      const getting = theirs.filter((p) => move.getIds.includes(p.id));
      rosterByTeam.set(teamId, [...mine.filter((p) => !move.giveIds.includes(p.id)), ...getting]);
      rosterByTeam.set(move.partnerTeamId, [...theirs.filter((p) => !move.getIds.includes(p.id)), ...giving]);
      dirtyTeams.add(teamId);
      dirtyTeams.add(move.partnerTeamId);
    }
  }

  const myRosterAfter = rosterByTeam.get(teamId) ?? [];

  // Rebuild resolved lines / rating maps for every DIRTY club with its
  // hypothetical roster, via the exact same autoLines() best-lineup the rest
  // of UNHL Intelligence already uses for any club that hasn't saved its own
  // lines — a hypothetical roster is, by definition, never "saved" anywhere.
  const afterResolved = new Map(data.resolved);
  const afterAutoBySlot = new Map(data.autoBySlot);
  const afterPlayerMap = new Map(data.playerMap);
  const afterGoalieMap = new Map(data.goalieMap);

  for (const tid of dirtyTeams) {
    const roster = (rosterByTeam.get(tid) ?? []).filter((p) => !p.scratched);
    const skaters = roster.filter((p) => !p.isGoalie);
    const goalies = roster.filter((p) => p.isGoalie);
    const built = autoLines(skaters.map(toLineSkater), goalies.map(toLineGoalie));
    afterResolved.set(tid, {
      forwardLines: built.forwardLines,
      defensePairs: built.defensePairs,
      ppUnit: built.situations.pp[0].players,
      pkUnit: built.situations.pk4[0].players,
      starter: built.situations.others.starter,
      backup: built.situations.others.backup,
    });
    afterAutoBySlot.set(tid, new Set(SLOTS.map((s) => s.id))); // hypothetical lineup is always auto-built
    for (const p of skaters) afterPlayerMap.set(p.id, toSlotPlayer(p));
    for (const p of goalies) afterGoalieMap.set(p.id, toSlotPlayer(p));
  }
  const afterData: LeagueSlotsData = { teams: data.teams, resolved: afterResolved, autoBySlot: afterAutoBySlot, playerMap: afterPlayerMap, goalieMap: afterGoalieMap };

  const slots: ScenarioSlotRow[] = SLOTS.map((slot) => {
    const beforeRows = rankSlot(data, slot);
    const afterRows = rankSlot(afterData, slot);
    const bi = beforeRows.findIndex((r) => r.teamId === teamId);
    const ai = afterRows.findIndex((r) => r.teamId === teamId);
    const before = bi === -1 ? null : { rank: bi + 1, size: beforeRows.length, avg: beforeRows[bi].avg };
    const after = ai === -1 ? null : { rank: ai + 1, size: afterRows.length, avg: afterRows[ai].avg };
    return { id: slot.id, label: slot.label, before, after, delta: before && after ? before.rank - after.rank : null };
  });

  const span = 5;
  const beforeTotals = capBySeasonFor(myRosterBefore, span);
  const afterTotals = capBySeasonFor(myRosterAfter, span);
  const cap = await loadLeagueCap();
  const capBySeason: ScenarioCapRow[] = beforeTotals.map((before, i) => {
    const after = afterTotals[i];
    return { year: seasonLabel(CURRENT_SEASON_START + i), before, after, delta: after - before, overBefore: before > cap.upper, overAfter: after > cap.upper };
  });

  const ageBefore = avgAgeOf(myRosterBefore);
  const ageAfter = avgAgeOf(myRosterAfter);

  return {
    teamId, teamName: myTeam.name,
    moves: described,
    capBySeason, capCeiling: cap.upper,
    avgAge: { before: ageBefore, after: ageAfter, delta: ageBefore != null && ageAfter != null ? Math.round((ageAfter - ageBefore) * 10) / 10 : null },
    slots,
  };
}
