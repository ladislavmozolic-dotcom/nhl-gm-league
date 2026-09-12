import { prisma } from "@/lib/prisma";
import { autoLines } from "@/lib/sim/lines-core";

// Shared slot model for UNHL Intelligence's roster-shape tools (Analyze My Roster,
// Find Trade Partner). Every slot below — forward lines, D pairs, the starting
// goalie tandem, and the top PP/PK units — is read from a club's own saved
// Team Lines wherever it has one set. Whatever a club HASN'T set (missing
// forward lines, an unset PP1, no goalie tandem chosen, ...) is filled in
// per-slot with the sim's own autoLines() fallback (lib/sim/lines-core.ts) —
// never written back, never shown on that club's own Lines page, only held in
// memory for this comparison — so every ranking always covers all 32 clubs.
// Which exact slots used the fallback for a given club is tracked per-slot
// (not per-club): a club can have real forward lines but no PP1 set, and
// that's shown as auto only on the PP1 finding, not the whole club.

type ForwardSide = "lw" | "c" | "rw";
type DefenseSide = "ld" | "rd";

export interface SlotDef {
  id: string;
  label: string;
  kind: "forward" | "defense" | "special" | "goalie";
  lineIdxs?: number[]; // forward/defense: 0-based indexes into forwardLines / defensePairs
  side?: ForwardSide | DefenseSide; // forward/defense
  situationsKey?: "pp" | "pk4"; // special
  goalieRole?: "starter" | "backup"; // goalie
}

// Top slot vs. depth slot, per side — mirrors how GMs actually talk about a
// lineup ("top-line C", "bottom-pair RD") and is exactly granular enough to
// reproduce findings like "2nd/3rd-pair RD". Plus the starting goalie tandem
// and each club's first PP/PK unit.
export const SLOTS: SlotDef[] = [
  { id: "lw-top", label: "Top-line LW", kind: "forward", lineIdxs: [0], side: "lw" },
  { id: "lw-depth", label: "Depth LW (2.–4. formácia)", kind: "forward", lineIdxs: [1, 2, 3], side: "lw" },
  { id: "c-top", label: "Top-line C", kind: "forward", lineIdxs: [0], side: "c" },
  { id: "c-depth", label: "Depth C (2.–4. formácia)", kind: "forward", lineIdxs: [1, 2, 3], side: "c" },
  { id: "rw-top", label: "Top-line RW", kind: "forward", lineIdxs: [0], side: "rw" },
  { id: "rw-depth", label: "Depth RW (2.–4. formácia)", kind: "forward", lineIdxs: [1, 2, 3], side: "rw" },
  { id: "ld-top", label: "Top-pár LD", kind: "defense", lineIdxs: [0], side: "ld" },
  { id: "ld-bottom", label: "2.–3. pár LD", kind: "defense", lineIdxs: [1, 2], side: "ld" },
  { id: "rd-top", label: "Top-pár RD", kind: "defense", lineIdxs: [0], side: "rd" },
  { id: "rd-bottom", label: "2.–3. pár RD", kind: "defense", lineIdxs: [1, 2], side: "rd" },
  { id: "goalie-starter", label: "Štartujúci brankár", kind: "goalie", goalieRole: "starter" },
  { id: "goalie-backup", label: "Náhradný brankár", kind: "goalie", goalieRole: "backup" },
  { id: "pp1", label: "PP1 (presilovka č.1)", kind: "special", situationsKey: "pp" },
  { id: "pk1", label: "PK1 (oslabenie č.1)", kind: "special", situationsKey: "pk4" },
];

export function slotById(id: string): SlotDef | undefined {
  return SLOTS.find((s) => s.id === id);
}

/** Maps a slot to the Find Player position filter that fills it — "ALL" for
 *  PP1/PK1, which draw from multiple positions and have no single fit. */
export function slotPositionFilter(slot: SlotDef): "C" | "LW" | "RW" | "D" | "G" | "ALL" {
  if (slot.kind === "goalie") return "G";
  if (slot.kind === "forward") return slot.side!.toUpperCase() as "LW" | "C" | "RW";
  if (slot.kind === "defense") return "D";
  return "ALL";
}

export interface SlotPlayer {
  id: number;
  name: string;
  slug: string;
  overall: number | null; // OV — orientational only, shown as secondary reference
  // The rating this player is actually ranked/averaged by: for skaters, the
  // plain average of CK/PA/SC/DF (the parameters that matter for real roster
  // decisions — OV is not one of them); for goalies, GoalieRating.overall,
  // since they have no CK/PA/SC/DF split. See memory: ov-vs-specific-params.
  rating: number | null;
}

/** Average of whichever of CK/PA/SC/DF a skater has (null if none). No single
 *  param dominates — a plain mean, same "no magic weighting" rule the rest of
 *  the sim follows. */
export function compositeRating(p: { ck: number | null; pa: number | null; sc: number | null; df: number | null }): number | null {
  const vals = [p.ck, p.pa, p.sc, p.df].filter((v): v is number => v != null);
  return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
}

interface ResolvedLines {
  forwardLines: { lw: number | null; c: number | null; rw: number | null }[];
  defensePairs: { ld: number | null; rd: number | null }[];
  ppUnit: (number | null)[]; // PP1 only
  pkUnit: (number | null)[]; // PK1 only
  starter: number | null;
  backup: number | null;
}

export interface LeagueSlotsData {
  teams: { id: number; name: string }[];
  resolved: Map<number, ResolvedLines>;
  // teamId -> set of slot ids whose value for that team came from the
  // autoLines() fallback rather than the club's own saved Team Lines.
  autoBySlot: Map<number, Set<string>>;
  playerMap: Map<number, SlotPlayer>; // skaters, rated by the CK/PA/SC/DF composite (SlotPlayer.rating)
  goalieMap: Map<number, SlotPlayer>; // goalies, rated by GoalieRating.overall (they have no CK/PA/SC/DF split)
}

function hasAnyId(arr: unknown): arr is (number | null)[] {
  return Array.isArray(arr) && arr.some((id) => typeof id === "number");
}

/** Loads every NHL club's line/pair/goalie/special-teams assignments (real
 *  where saved, else an in-memory autoLines() best-lineup per slot) plus a
 *  lookup of every rostered skater/goalie's rating — the shared input both
 *  roster-shape tools rank against. */
export async function loadLeagueSlots(): Promise<LeagueSlotsData> {
  const [teams, linesRows, skaterRows, goalieRows] = await Promise.all([
    prisma.team.findMany({ where: { league: "NHL", isAffiliate: false }, select: { id: true, name: true } }),
    prisma.teamLines.findMany({
      where: { team: { league: "NHL", isAffiliate: false } },
      select: { teamId: true, forwardLines: true, defensePairs: true, situations: true },
    }),
    // same roster filter teamLineBuilder/the sim use for its own auto-lines fallback
    prisma.player.findMany({
      where: { team: { league: "NHL", isAffiliate: false }, rosterType: "NHL", isGoalie: false, scratched: false },
      select: { id: true, name: true, slug: true, overall: true, ck: true, pa: true, sc: true, df: true, position: true, shoots: true, teamId: true },
    }),
    prisma.player.findMany({
      where: { team: { league: "NHL", isAffiliate: false }, rosterType: "NHL", isGoalie: true, scratched: false },
      select: { id: true, name: true, slug: true, teamId: true, goalieRating: { select: { overall: true } } },
    }),
  ]);

  const playerMap = new Map<number, SlotPlayer>(
    skaterRows.map((p) => [p.id, { id: p.id, name: p.name, slug: p.slug, overall: p.overall, rating: compositeRating(p) }])
  );
  const goalieMap = new Map<number, SlotPlayer>(
    goalieRows.map((g) => {
      const overall = g.goalieRating?.overall ?? null;
      return [g.id, { id: g.id, name: g.name, slug: g.slug, overall, rating: overall }];
    })
  );

  const linesByTeam = new Map(linesRows.map((l) => [l.teamId, l]));
  const skatersByTeam = new Map<number, typeof skaterRows>();
  for (const p of skaterRows) { const arr = skatersByTeam.get(p.teamId) ?? []; arr.push(p); skatersByTeam.set(p.teamId, arr); }
  const goaliesByTeam = new Map<number, typeof goalieRows>();
  for (const g of goalieRows) { const arr = goaliesByTeam.get(g.teamId) ?? []; arr.push(g); goaliesByTeam.set(g.teamId, arr); }

  const resolved = new Map<number, ResolvedLines>();
  const autoBySlot = new Map<number, Set<string>>();

  for (const team of teams) {
    const auto = new Set<string>();
    autoBySlot.set(team.id, auto);

    const teamSkaters = skatersByTeam.get(team.id) ?? [];
    const teamGoalies = goaliesByTeam.get(team.id) ?? [];
    // always computed — cheap pure function, used only for whatever this club
    // hasn't set itself (see per-field fallback below)
    const built = autoLines(
      teamSkaters.map((p) => ({ id: p.id, position: p.position, overall: p.overall ?? 0, shoots: p.shoots })),
      teamGoalies.map((g) => ({ id: g.id, overall: g.goalieRating?.overall ?? 0 }))
    );

    const saved = linesByTeam.get(team.id);
    const savedFl = Array.isArray(saved?.forwardLines) ? (saved!.forwardLines as ResolvedLines["forwardLines"]) : [];
    const savedDp = Array.isArray(saved?.defensePairs) ? (saved!.defensePairs as ResolvedLines["defensePairs"]) : [];
    const hasRealSkaterLines = savedFl.length > 0 && savedDp.length > 0;
    if (!hasRealSkaterLines) {
      for (const id of ["lw-top", "lw-depth", "c-top", "c-depth", "rw-top", "rw-depth", "ld-top", "ld-bottom", "rd-top", "rd-bottom"]) auto.add(id);
    }
    const forwardLines = hasRealSkaterLines ? savedFl : built.forwardLines;
    const defensePairs = hasRealSkaterLines ? savedDp : built.defensePairs;

    const sit = saved?.situations as { pp?: { players?: unknown }[]; pk4?: { players?: unknown }[]; others?: { starter?: unknown; backup?: unknown } } | null | undefined;

    const savedPp1 = sit?.pp?.[0]?.players;
    const hasRealPp1 = hasAnyId(savedPp1);
    if (!hasRealPp1) auto.add("pp1");
    const ppUnit = hasRealPp1 ? (savedPp1 as (number | null)[]) : built.situations.pp[0].players;

    const savedPk1 = sit?.pk4?.[0]?.players;
    const hasRealPk1 = hasAnyId(savedPk1);
    if (!hasRealPk1) auto.add("pk1");
    const pkUnit = hasRealPk1 ? (savedPk1 as (number | null)[]) : built.situations.pk4[0].players;

    const validGoalie = new Set(teamGoalies.map((g) => g.id));
    const savedStarter = sit?.others?.starter;
    const hasRealStarter = typeof savedStarter === "number" && validGoalie.has(savedStarter);
    if (!hasRealStarter) auto.add("goalie-starter");
    const starter = hasRealStarter ? (savedStarter as number) : built.situations.others.starter;

    const savedBackup = sit?.others?.backup;
    const hasRealBackup = typeof savedBackup === "number" && validGoalie.has(savedBackup);
    if (!hasRealBackup) auto.add("goalie-backup");
    const backup = hasRealBackup ? (savedBackup as number) : built.situations.others.backup;

    resolved.set(team.id, { forwardLines, defensePairs, ppUnit, pkUnit, starter, backup });
  }

  return { teams, resolved, autoBySlot, playerMap, goalieMap };
}

export function slotPlayers(lines: ResolvedLines, slot: SlotDef, playerMap: Map<number, SlotPlayer>, goalieMap: Map<number, SlotPlayer>): SlotPlayer[] {
  if (slot.kind === "goalie") {
    const id = slot.goalieRole === "starter" ? lines.starter : lines.backup;
    if (id == null) return [];
    const g = goalieMap.get(id);
    return g ? [g] : [];
  }
  if (slot.kind === "special") {
    const ids = slot.situationsKey === "pp" ? lines.ppUnit : lines.pkUnit;
    return ids.filter((id): id is number => typeof id === "number").map((id) => playerMap.get(id)).filter((p): p is SlotPlayer => !!p);
  }
  const rows = slot.kind === "forward" ? lines.forwardLines : lines.defensePairs;
  const picked: SlotPlayer[] = [];
  for (const idx of slot.lineIdxs ?? []) {
    const row = rows[idx] as Record<string, number | null> | undefined;
    const pid = row?.[slot.side!];
    if (typeof pid !== "number") continue;
    const player = playerMap.get(pid);
    if (player) picked.push(player);
  }
  return picked;
}

export interface SlotTeamRow {
  teamId: number;
  teamName: string;
  avg: number;
  players: SlotPlayer[];
  isAuto: boolean;
}

/** Every club's average rating for one slot, best first — CK/PA/SC/DF composite
 *  for skater slots, GoalieRating.overall for goalie slots (see SlotPlayer.rating).
 *  Clubs with nobody eligible for the slot are left out entirely (nothing to rank). */
export function rankSlot(data: LeagueSlotsData, slot: SlotDef): SlotTeamRow[] {
  return data.teams
    .map((team) => {
      const players = slotPlayers(data.resolved.get(team.id)!, slot, data.playerMap, data.goalieMap);
      const rated = players.filter((p) => p.rating != null);
      if (!rated.length) return null;
      const avg = rated.reduce((sum, p) => sum + (p.rating as number), 0) / rated.length;
      return { teamId: team.id, teamName: team.name, avg: Math.round(avg * 10) / 10, players, isAuto: data.autoBySlot.get(team.id)?.has(slot.id) ?? false };
    })
    .filter((r): r is SlotTeamRow => r != null)
    .sort((a, b) => b.avg - a.avg);
}
