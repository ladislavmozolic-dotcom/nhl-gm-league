// Player display names in this dataset sometimes carry captaincy markers like
// `Nikita Kucherov ''A''` or `Sidney Crosby ''C''`, and rookies a trailing `(R)`.
// These helpers keep display clean while preserving the underlying data.

const CAP_RE = /\s*(?:''[CA]''|"[CA]"|\((?:C|A)\))/gi;
// Contract markers (no-trade / no-move clause) that leak into some names.
// Some imports wrap the whole marker in straight/smart quotes, for example
// `Connor McDavid (C) "(NTC)"`; consume those quotes together with the marker.
const CLAUSE_RE = /\s*(?:''|["“”])?\((?:NTC|NMC|NTC-M|M-NTC|UFA|RFA)\)(?:''|["“”])?/gi;

/** Strip captaincy + contract-clause markers from a name; keeps the rookie (R) tag. */
export function cleanName(name: string): string {
  return name
    .replace(CAP_RE, "")
    .replace(CLAUSE_RE, "")
    // Defensive cleanup for an orphaned quote left by older imported formats.
    .replace(/\s+(?:''|"")\s*$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
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

/** Remove import-only player tags from a public transaction sentence. Historical
 * transaction rows persist the name in their message, so this works on the
 * whole sentence instead of requiring a player-record lookup. */
export function cleanTransactionMessage(message: string): string {
  return message
    .replace(CAP_RE, "")
    .replace(CLAUSE_RE, "")
    .replace(/\s*\(R\)/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Just the name for an external search (EliteProspects etc.) — strips captaincy
 *  quote-markers AND every parenthetical tag ((LTIR), (R), (NTC)…). */
export function epSearchName(name: string): string {
  return name.replace(/''[A-Za-z]''|"[A-Za-z]"|\s*\([^)]*\)/g, "").replace(/\s{2,}/g, " ").trim();
}

/** A link that lands directly on a player's EliteProspects profile instead of EP's own
 *  search-results page — EP's `/search/player?q=` never auto-picks the top hit, but
 *  DuckDuckGo's "\" bang (jump straight to the #1 organic result) reliably does, and EP's
 *  own profile is consistently that #1 result for "<name> eliteprospects player". */
export function epProfileUrl(name: string): string {
  return `https://duckduckgo.com/?q=${encodeURIComponent("\\" + epSearchName(name) + " eliteprospects player")}`;
}

/** Safe fallback when no verified player ID is known: route directly to the player's
 *  EliteProspects profile using DuckDuckGo's direct jump instead of EP's search-results page. */
export function epPlayerSearchUrl(name: string): string {
  return epProfileUrl(name);
}

export type TradeClause = "NTC" | "NMC" | "M_NTC";
export const CLAUSE_LABEL: Record<TradeClause, string> = {
  NTC: "No-Trade Clause (NTC)",
  NMC: "No-Movement Clause (NMC)",
  M_NTC: "Modified No-Trade Clause (M-NTC)",
};

/** A player's trade clause — ONLY the real `tradeClause` field (granted in this league).
 *  Legacy "(NTC)" markers in imported names are NOT clauses here: the league started with none. */
export function clauseOf(p: { tradeClause?: unknown }): TradeClause | null {
  const c = p.tradeClause;
  return c === "NTC" || c === "NMC" || c === "M_NTC" ? c : null;
}

const asClause = (c: unknown): TradeClause | null => (c === "NTC" || c === "NMC" || c === "M_NTC" ? c : null);

/** Hover text for the ★ — which clause he has now and, for a signed-but-deferred extension,
 *  which one kicks in from next season. null = no clause at all. */
export function clauseTooltip(p: { tradeClause?: unknown; extClause?: unknown; noTradeTeams?: unknown; name?: string | null }): string | null {
  const cur = clauseOf(p);
  const next = asClause(p.extClause);
  const list = Array.isArray(p.noTradeTeams) && p.noTradeTeams.length ? ` — ${p.noTradeTeams.length}-team no-trade list` : "";
  if (cur && next && next !== cur) return `${CLAUSE_LABEL[next]} — signed extension, from next season · until then: ${CLAUSE_LABEL[cur]}${list}`;
  if (cur) return `${CLAUSE_LABEL[cur]}${list}`;
  if (next) return `${CLAUSE_LABEL[next]} — starts next season (extension already signed)`;
  return null;
}
