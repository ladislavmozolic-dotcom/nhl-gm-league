// Offer-sheet compensation — pure, no DB. Given the offer sheet's AAV (salary)
// and the league's tier ladder, return the draft rounds the poaching club owes
// the old club. Tiers are ordered ascending by maxAav; a tier with maxAav 0 is
// the open-ended top bracket.

export type OsCompTier = { maxAav: number; picks: number[] };

/** Draft rounds owed as compensation for an offer sheet of this AAV. */
export function compensationFor(aav: number, tiers: OsCompTier[]): number[] {
  const ordered = [...tiers].sort((a, b) => {
    if (a.maxAav === 0) return 1; // open tier last
    if (b.maxAav === 0) return -1;
    return a.maxAav - b.maxAav;
  });
  for (const t of ordered) {
    if (t.maxAav === 0 || aav <= t.maxAav) return [...t.picks].sort((x, y) => x - y);
  }
  // fallback: the last (largest) tier
  return ordered.length ? [...ordered[ordered.length - 1].picks] : [];
}

/** Human label like "a 1st + 3rd" or "four 1sts". */
export function compensationLabel(rounds: number[]): string {
  if (rounds.length === 0) return "no picks";
  const ord = (r: number) => (r === 1 ? "1st" : r === 2 ? "2nd" : r === 3 ? "3rd" : `${r}th`);
  const counts = new Map<number, number>();
  for (const r of rounds) counts.set(r, (counts.get(r) ?? 0) + 1);
  const words = ["", "one", "two", "three", "four", "five"];
  const parts = [...counts.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([r, n]) => (n === 1 ? `a ${ord(r)}` : `${words[n] ?? n} ${ord(r)}s`));
  if (parts.length === 1) return parts[0];
  return parts.slice(0, -1).join(", ") + " + " + parts[parts.length - 1];
}
