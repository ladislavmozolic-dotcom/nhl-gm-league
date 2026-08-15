// Seedable PRNG so a game (given the same seed + rosters) is fully reproducible.
// mulberry32 — small, fast, good enough for a game sim.

export class RNG {
  private state: number;

  constructor(seed: number) {
    // ensure a well-mixed non-zero 32-bit state
    this.state = (seed ^ 0x9e3779b9) >>> 0;
    if (this.state === 0) this.state = 0x1a2b3c4d;
  }

  /** float in [0, 1) */
  next(): number {
    let t = (this.state += 0x6d2b79f5) >>> 0;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** integer in [0, n) */
  int(n: number): number {
    return Math.floor(this.next() * n);
  }

  /** true with probability p */
  chance(p: number): boolean {
    return this.next() < p;
  }

  /** Poisson-distributed integer via Knuth's algorithm */
  poisson(lambda: number): number {
    if (lambda <= 0) return 0;
    const L = Math.exp(-lambda);
    let k = 0;
    let prod = 1;
    do {
      k++;
      prod *= this.next();
    } while (prod > L);
    return k - 1;
  }

  /** pick an index weighted by the given weights */
  weighted(weights: number[]): number {
    let total = 0;
    for (const w of weights) total += w;
    if (total <= 0) return this.int(weights.length);
    let r = this.next() * total;
    for (let i = 0; i < weights.length; i++) {
      r -= weights[i];
      if (r < 0) return i;
    }
    return weights.length - 1;
  }
}

/** Deterministic seed from a matchup — same fixture always sims identically.
 *  Returns a signed 32-bit int (fits a Postgres INT4); the RNG handles any sign. */
export function fixtureSeed(homeId: number, awayId: number, salt = 0): number {
  let h = 2166136261 ^ salt;
  for (const v of [homeId, awayId, salt]) {
    h = Math.imul(h ^ v, 16777619);
  }
  return h | 0;
}
