import { prisma } from "@/lib/prisma";
import { loadLeagueSlots, rankSlot, compositeRating } from "./leagueSlots";
import { slotsForPosition } from "./playerFit";

// UNHL Intelligence — "Ideal role" (Player Intelligence, phase 4 — see
// memory: gm-assistant-intelligence). Holds a player's own rating up against
// the league-wide average for every slot his position is eligible for (top
// vs. depth line/pair, or starter/backup for goalies) — the same per-slot
// numbers Analyze My Roster and Find Trade Partner already rank on, just
// benchmarked league-wide instead of against one club. No single "he's a
// 2nd-liner" verdict — the full per-slot breakdown (league median, his
// rating, and where he'd rank if plugged into that slot across all 32 clubs)
// is what's shown; the GM reads the role off the numbers.

export interface RoleBenchmark {
  slotId: string;
  slotLabel: string;
  leagueMedian: number;
  playerRating: number;
  delta: number; // playerRating - leagueMedian
  rank: number; // 1-based — where he'd land if inserted into that slot's league-wide ranking
  outOf: number;
}

export interface IdealRoleResult {
  playerId: number;
  playerRating: number;
  slots: RoleBenchmark[]; // in SLOTS order (top slot before its depth slot, per side)
}

function median(nums: number[]): number {
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export async function idealRole(playerId: number): Promise<IdealRoleResult | null> {
  const player = await prisma.player.findUnique({
    where: { id: playerId },
    select: { id: true, isGoalie: true, position: true, ck: true, pa: true, sc: true, df: true, sk: true, ph: true, goalieRating: { select: { overall: true } } },
  });
  if (!player) return null;

  const playerRating = player.isGoalie ? (player.goalieRating?.overall ?? null) : compositeRating(player);
  if (playerRating == null) return null;

  const relevantSlots = slotsForPosition(player.position, player.isGoalie);
  if (!relevantSlots.length) return null;

  const data = await loadLeagueSlots();
  const slots: RoleBenchmark[] = relevantSlots.map((slot) => {
    const rows = rankSlot(data, slot); // best-first, one avg per team with anyone eligible
    const leagueMedian = Math.round(median(rows.map((r) => r.avg)) * 10) / 10;
    const rank = rows.filter((r) => r.avg > playerRating).length + 1;
    return {
      slotId: slot.id, slotLabel: slot.label, leagueMedian, playerRating,
      delta: Math.round((playerRating - leagueMedian) * 10) / 10,
      rank, outOf: rows.length,
    };
  });

  return { playerId, playerRating, slots };
}
