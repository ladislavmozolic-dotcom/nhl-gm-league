import { prisma } from "@/lib/prisma";
import { autoLines } from "@/lib/sim/lines-core";

// Shared slot model for GM Assistant's roster-shape tools (Analyze My Roster,
// Find Trade Partner). A club that hasn't set its own Team Lines gets a
// position-aware best-lineup computed on the fly with the sim's own
// autoLines() fallback (lib/sim/lines-core.ts) — never written back, never
// shown on that club's own Lines page, only used in memory for these two
// comparisons — so every ranking always covers all 32 NHL clubs.

type ForwardSide = "lw" | "c" | "rw";
type DefenseSide = "ld" | "rd";

export interface SlotDef {
  id: string;
  label: string;
  kind: "forward" | "defense";
  lineIdxs: number[]; // 0-based indexes into forwardLines / defensePairs
  side: ForwardSide | DefenseSide;
}

// Top slot vs. depth slot, per side — mirrors how GMs actually talk about a
// lineup ("top-line C", "bottom-pair RD") and is exactly granular enough to
// reproduce findings like "2nd/3rd-pair RD".
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
];

export function slotById(id: string): SlotDef | undefined {
  return SLOTS.find((s) => s.id === id);
}

export interface SlotPlayer {
  id: number;
  name: string;
  slug: string;
  overall: number | null;
}

interface ResolvedLines {
  forwardLines: { lw: number | null; c: number | null; rw: number | null }[];
  defensePairs: { ld: number | null; rd: number | null }[];
}

export interface LeagueSlotsData {
  teams: { id: number; name: string }[];
  resolved: Map<number, ResolvedLines>;
  autoTeamIds: Set<number>;
  playerMap: Map<number, SlotPlayer>;
}

/** Loads every NHL club's line/pair assignments (real if saved, else an
 *  in-memory autoLines() best-lineup) plus a lookup of every rostered
 *  skater's rating — the shared input both roster-shape tools rank against. */
export async function loadLeagueSlots(): Promise<LeagueSlotsData> {
  const [teams, linesRows, roster] = await Promise.all([
    prisma.team.findMany({ where: { league: "NHL", isAffiliate: false }, select: { id: true, name: true } }),
    prisma.teamLines.findMany({
      where: { team: { league: "NHL", isAffiliate: false } },
      select: { teamId: true, forwardLines: true, defensePairs: true },
    }),
    // same roster filter teamLineBuilder/the sim use for its own auto-lines fallback
    prisma.player.findMany({
      where: { team: { league: "NHL", isAffiliate: false }, rosterType: "NHL", isGoalie: false, scratched: false },
      select: { id: true, name: true, slug: true, overall: true, position: true, shoots: true, teamId: true },
    }),
  ]);

  const playerMap = new Map<number, SlotPlayer>(roster.map((p) => [p.id, { id: p.id, name: p.name, slug: p.slug, overall: p.overall }]));
  const linesByTeam = new Map(linesRows.map((l) => [l.teamId, l]));
  const rosterByTeam = new Map<number, typeof roster>();
  for (const p of roster) {
    const arr = rosterByTeam.get(p.teamId) ?? [];
    arr.push(p);
    rosterByTeam.set(p.teamId, arr);
  }

  const autoTeamIds = new Set<number>();
  const resolved = new Map<number, ResolvedLines>();
  for (const team of teams) {
    const saved = linesByTeam.get(team.id);
    const fl = Array.isArray(saved?.forwardLines) ? (saved!.forwardLines as ResolvedLines["forwardLines"]) : [];
    const dp = Array.isArray(saved?.defensePairs) ? (saved!.defensePairs as ResolvedLines["defensePairs"]) : [];
    if (fl.length > 0 && dp.length > 0) {
      resolved.set(team.id, { forwardLines: fl, defensePairs: dp });
    } else {
      const skaters = (rosterByTeam.get(team.id) ?? []).map((p) => ({
        id: p.id, position: p.position, overall: p.overall ?? 0, shoots: p.shoots,
      }));
      const built = autoLines(skaters, []);
      resolved.set(team.id, { forwardLines: built.forwardLines, defensePairs: built.defensePairs });
      autoTeamIds.add(team.id);
    }
  }

  return { teams, resolved, autoTeamIds, playerMap };
}

export function slotPlayers(lines: ResolvedLines, slot: SlotDef, playerMap: Map<number, SlotPlayer>): SlotPlayer[] {
  const rows = slot.kind === "forward" ? lines.forwardLines : lines.defensePairs;
  const picked: SlotPlayer[] = [];
  for (const idx of slot.lineIdxs) {
    const row = rows[idx] as Record<string, number | null> | undefined;
    const pid = row?.[slot.side];
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

/** Every club's average overall for one slot, best first. Clubs with nobody
 *  eligible for the slot are left out entirely (nothing to rank). */
export function rankSlot(data: LeagueSlotsData, slot: SlotDef): SlotTeamRow[] {
  return data.teams
    .map((team) => {
      const players = slotPlayers(data.resolved.get(team.id)!, slot, data.playerMap);
      const rated = players.filter((p) => p.overall != null);
      if (!rated.length) return null;
      const avg = rated.reduce((sum, p) => sum + (p.overall as number), 0) / rated.length;
      return { teamId: team.id, teamName: team.name, avg: Math.round(avg * 10) / 10, players, isAuto: data.autoTeamIds.has(team.id) };
    })
    .filter((r): r is SlotTeamRow => r != null)
    .sort((a, b) => b.avg - a.avg);
}
