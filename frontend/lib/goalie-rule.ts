// League rule: every club must carry at least one NHL-roster goalie who's
// "worthy" — MIN_GOALIE_OV+ overall, OR proven durable/effective in real life
// last season (MIN_GOALIE_GP+ games started, or more than MIN_GOALIE_GP_SVPCT
// games at a save % above MIN_GOALIE_SVPCT). A young/rebuilt-rating goalie with
// a genuine real-life NHL track record still counts, even if his in-league OV
// hasn't caught up yet. A club that falls below this (a trade, an injury-driven
// send-down, etc.) is flagged wherever the site surfaces roster legality — the
// team's own Goalies section, the trade builder's fit analysis, and the
// Commissioner Dashboard's pre-flight checks — but nothing here BLOCKS a trade
// or the sim itself; it's advisory, same as the cap-ceiling warnings elsewhere.
export const MIN_GOALIE_OV = 73;
export const MIN_GOALIE_GP = 35;           // real last-season games played, on its own
export const MIN_GOALIE_GP_SVPCT = 15;     // real last-season games played, paired with...
export const MIN_GOALIE_SVPCT = 0.90;      // ...a save % above this

export type GoalieRuleInput = { overall: number | null; lastSeasonGP?: number | null; lastSeasonSvPct?: number | null };

export function isWorthyGoalie(g: GoalieRuleInput): boolean {
  if ((g.overall ?? 0) >= MIN_GOALIE_OV) return true;
  const gp = g.lastSeasonGP ?? 0;
  if (gp >= MIN_GOALIE_GP) return true;
  if (gp > MIN_GOALIE_GP_SVPCT && (g.lastSeasonSvPct ?? 0) > MIN_GOALIE_SVPCT) return true;
  return false;
}

export function hasWorthyGoalie(goalies: GoalieRuleInput[]): boolean {
  return goalies.some(isWorthyGoalie);
}
