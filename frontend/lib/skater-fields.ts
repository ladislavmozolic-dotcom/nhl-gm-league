// The skater rating fields the Admin > Player Ratings editor exposes.
// Split out of app/admin/ratings/actions.ts because a "use server" file may only
// export async functions — a plain const array export breaks module evaluation.
export const SKATER_FIELDS = ["overall", "sc", "pa", "sk", "df", "ck", "st", "fo", "ex", "ld"] as const;
export type SkaterField = (typeof SKATER_FIELDS)[number];
