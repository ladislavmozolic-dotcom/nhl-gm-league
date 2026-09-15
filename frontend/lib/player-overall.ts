type PlayerOverallSource = {
  isGoalie: boolean;
  overall: number | null;
  goalieRating?: { overall: number | null } | null;
};

/**
 * Goalie ratings are edited and recalculated in GoalieRating. Player.overall is
 * retained as a fallback for older rows, while it remains authoritative for
 * skaters.
 */
export function livePlayerOverall(player: PlayerOverallSource): number | null {
  return player.isGoalie
    ? player.goalieRating?.overall ?? player.overall
    : player.overall;
}
