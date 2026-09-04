// Player rating attributes (CK/FG/DI/SK/... for skaters, SK/DU/EN/SZ/... for
// goalies) are hidden from anyone browsing without a GM login — OV stays visible
// as a general quality signal, but the granular ratings that make up a team's
// real scouting edge are GM-only.
export const SKATER_ATTRS = ["ck", "fg", "di", "sk", "st", "en", "du", "ph", "fo", "pa", "sc", "df", "ps", "ex", "ld", "mo"];
export const GOALIE_ATTRS = ["sk", "du", "en", "sz", "ag", "rb", "sc", "hs", "rt", "ph", "ps", "ex", "ld", "mo"];
export const ALL_RATING_ATTRS = [...new Set([...SKATER_ATTRS, ...GOALIE_ATTRS])];

/** Null out the rating-attribute fields on a player-shaped record when `hide` is
 *  true. Shallow copy — safe on any record shape, unrelated keys pass through
 *  untouched. Call this SERVER-SIDE before the record reaches a client component,
 *  so an anonymous visitor's response never contains the values at all (not just
 *  a UI that hides them). */
export function redactAttrs<T extends Record<string, unknown>>(obj: T, hide: boolean): T {
  if (!hide) return obj;
  const copy = { ...obj } as Record<string, unknown>;
  for (const k of ALL_RATING_ATTRS) if (k in copy) copy[k] = null;
  return copy as T;
}
