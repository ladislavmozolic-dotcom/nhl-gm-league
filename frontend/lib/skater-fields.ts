// The skater rating fields the Admin > Player Ratings editor exposes.
// Split out of app/admin/ratings/actions.ts because a "use server" file may only
// export async functions — a plain const array export breaks module evaluation.
export const SKATER_FIELDS = [
  "overall", "ck", "fg", "di", "sk", "st", "en", "du", "ph", "fo", "pa", "sc", "df", "ps", "ex", "ld", "mo",
] as const;
export type SkaterField = (typeof SKATER_FIELDS)[number];
