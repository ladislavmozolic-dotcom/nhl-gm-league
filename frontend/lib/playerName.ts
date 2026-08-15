// Player display names in this dataset sometimes carry captaincy markers like
// `Nikita Kucherov ''A''` or `Sidney Crosby ''C''`, and rookies a trailing `(R)`.
// These helpers keep display clean while preserving the underlying data.

const CAP_RE = /\s*''[CA]''|\s*"[CA]"|\s*\((?:C|A)\)/g;
// Contract markers (no-trade / no-move clause) that leak into some names.
const CLAUSE_RE = /\s*\((?:NTC|NMC|NTC-M|UFA|RFA)\)/gi;

/** Strip captaincy + contract-clause markers from a name; keeps the rookie (R) tag. */
export function cleanName(name: string): string {
  return name.replace(CAP_RE, "").replace(CLAUSE_RE, "").replace(/\s{2,}/g, " ").trim();
}

/** Captaincy from the raw name: "C", "A", or null. */
export function captaincyFromName(name: string): "C" | "A" | null {
  if (/''C''|"C"/.test(name)) return "C";
  if (/''A''|"A"/.test(name)) return "A";
  return null;
}

/** True if the raw name is tagged as a rookie, e.g. "Player (R)". */
export function isRookieName(name: string): boolean {
  return /\(R\)/.test(name);
}

/** Clean name without the rookie tag either (for pure display). */
export function displayName(name: string): string {
  return cleanName(name).replace(/\s*\(R\)/g, "").trim();
}

/** Just the name for an external search (EliteProspects etc.) — strips captaincy
 *  quote-markers AND every parenthetical tag ((LTIR), (R), (NTC)…). */
export function epSearchName(name: string): string {
  return name.replace(/''[A-Za-z]''|"[A-Za-z]"|\s*\([^)]*\)/g, "").replace(/\s{2,}/g, " ").trim();
}
