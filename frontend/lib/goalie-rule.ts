// League rule: every club must carry at least one NHL-roster goalie rated
// MIN_GOALIE_OV or higher. A club that falls below this (a trade, an injury-driven
// send-down, etc.) is flagged wherever the site surfaces roster legality — the
// team's own Goalies section, the trade builder's fit analysis, and the
// Commissioner Dashboard's pre-flight checks — but nothing here BLOCKS a trade
// or the sim itself; it's advisory, same as the cap-ceiling warnings elsewhere.
export const MIN_GOALIE_OV = 72;

export function hasWorthyGoalie(goalies: { overall: number | null }[]): boolean {
  return goalies.some((g) => (g.overall ?? 0) >= MIN_GOALIE_OV);
}
