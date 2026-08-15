// The verifiable heart of the lottery: 14 numbered balls, four drawn at a time.
// C(14,4) = 1001 possible combinations. 1000 are assigned to the 16 clubs in
// proportion to their odds (18.5% → 185 combinations, …); the 1001st combination
// (11-12-13-14) is the "redraw" and belongs to no one. A club wins if the four
// balls that come up form one of its combinations. Because the assignment is fully
// deterministic (canonical lexicographic order, blocks handed out worst-club-first),
// any GM can independently check who owns any drawn combination.

export const BALLS = 14;
export const DRAW_SIZE = 4;
export const TOTAL_COMBOS = 1001; // C(14,4)
export const ASSIGNED_COMBOS = 1000; // last one (11-12-13-14) is the redraw

/** All C(14,4) combinations as sorted 4-tuples, in canonical lexicographic order.
 *  Index i (0-based) ⇒ combination rank i+1. The final entry [11,12,13,14] is the redraw. */
export function allCombos(): number[][] {
  const out: number[][] = [];
  for (let a = 1; a <= 11; a++)
    for (let b = a + 1; b <= 12; b++)
      for (let c = b + 1; c <= 13; c++)
        for (let d = c + 1; d <= 14; d++) out.push([a, b, c, d]);
  return out;
}

/** Canonical 1-based rank of a combination (order-independent). Returns null if the
 *  four numbers aren't a valid distinct set within 1..14. Uses the combinatorial
 *  number system so a GM can verify a combo without listing all 1001. */
export function comboRank(nums: number[]): number | null {
  const s = [...new Set(nums)].sort((a, b) => a - b);
  if (s.length !== DRAW_SIZE) return null;
  if (s[0] < 1 || s[DRAW_SIZE - 1] > BALLS) return null;
  // rank = 1 + Σ over positions of combinations that come lexicographically before.
  let rank = 1;
  let prev = 0; // last chosen value (0 = none yet)
  for (let pos = 0; pos < DRAW_SIZE; pos++) {
    const remaining = DRAW_SIZE - pos - 1; // slots still to fill after this one
    for (let v = prev + 1; v < s[pos]; v++) rank += choose(BALLS - v, remaining);
    prev = s[pos];
  }
  return rank;
}

function choose(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = 0; i < k; i++) r = (r * (n - i)) / (i + 1);
  return Math.round(r);
}

export type ComboBlock = { teamId: number; pos: number; pct: number; count: number; startRank: number; endRank: number };

/** Hand the 1000 assigned combinations to the clubs worst-first: club 1 gets the
 *  first `pct*10` ranks, club 2 the next block, and so on. Deterministic + published. */
export function assignBlocks(nonPlayoffTeamIds: number[], oddsPct: number[]): ComboBlock[] {
  const blocks: ComboBlock[] = [];
  let cursor = 1;
  nonPlayoffTeamIds.forEach((teamId, i) => {
    const pct = oddsPct[i] ?? 0.5;
    const count = Math.round(pct * 10); // 18.5% → 185 combinations
    blocks.push({ teamId, pos: i + 1, pct, count, startRank: cursor, endRank: cursor + count - 1 });
    cursor += count;
  });
  return blocks;
}

/** Which club owns a given combination rank (null = the redraw / unassigned). */
export function ownerOfRank(blocks: ComboBlock[], rank: number): number | null {
  for (const b of blocks) if (rank >= b.startRank && rank <= b.endRank) return b.teamId;
  return null;
}

/** Draw four distinct balls (1..14), returned sorted, with their canonical rank. */
export function drawFourBalls(): { balls: number[]; rank: number } {
  const pool = Array.from({ length: BALLS }, (_, i) => i + 1);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const balls = pool.slice(0, DRAW_SIZE).sort((a, b) => a - b);
  return { balls, rank: comboRank(balls)! };
}
