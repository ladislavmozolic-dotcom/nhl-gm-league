/** A display label, not a claim about a player's age. Source competitions and
 * team names may explicitly identify an age group; otherwise they are senior. */
export function worldTeamLevel(leagueName: string, teamName: string): string {
  const label = `${leagueName} ${teamName}`;
  if (/\b(?:U|J)[ -]?20\b|\bjunior(?:s)?[ -]?20\b/i.test(label)) return "U20";
  if (/\b(?:U|J)[ -]?18\b|\bjunior(?:s)?[ -]?18\b/i.test(label)) return "U18";
  if (/\b(?:U|J)[ -]?21\b/i.test(label)) return "U21";
  if (/\b(?:U|J)[ -]?19\b/i.test(label)) return "U19";
  if (/\b(?:U|J)[ -]?17\b/i.test(label)) return "U17";
  return "Senior";
}
