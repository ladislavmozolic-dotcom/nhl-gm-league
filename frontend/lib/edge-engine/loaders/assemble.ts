// Merge N MoneyPuck season maps (most-recent-first) into engine PlayerInput[], attaching
// bio (MoneyPuck has none) + optional edge / injuries / career / previous ratings by a lookup.

import type { EdgeData, InjurySeason, CareerData, PlayerBio, PlayerInput, Pos, RatingKey } from "../types";
import type { LoadedSkater } from "./moneypuck";

const POS: Record<string, Pos> = { C: "C", L: "LW", R: "RW", LW: "LW", RW: "RW", D: "D", G: "G" };
export const mpPos = (p: string): Pos => POS[p] ?? "C";

export interface Extra {
  edge?: EdgeData;
  injuries?: InjurySeason[];
  career?: CareerData;
  previous?: Partial<Record<RatingKey, number>>;
  overrides?: Partial<Record<RatingKey, number>>;
}

export interface Assembled { input: PlayerInput; team: string; mpName: string }

/**
 * @param seasonMaps MoneyPuck season maps, MOST RECENT FIRST (e.g. [2025-26, 2024-25, 2023-24]).
 * @param bio        id → PlayerBio (from our DB or NHL API); return null to skip a player.
 * @param extra      id → edge/injury/career/previous (optional).
 * @param minSeason  only build players present in at least this many seasons (default 1).
 */
export function assemble(
  seasonMaps: Map<string, LoadedSkater>[],
  bio: (s: LoadedSkater) => PlayerBio | null,
  extra: (id: string) => Extra = () => ({}),
  minSeason = 1,
): Assembled[] {
  const ids = new Set<string>();
  seasonMaps.forEach((m) => m.forEach((_, id) => ids.add(id)));
  const out: Assembled[] = [];

  for (const id of ids) {
    const present = seasonMaps.map((m) => m.get(id)).filter(Boolean) as LoadedSkater[];
    if (present.length < minSeason) continue;
    const head = present[0]; // most recent season this player appears in
    const b = bio(head);
    if (!b) continue;
    const ex = extra(id);
    const input: PlayerInput = {
      bio: b,
      seasons: present.map((s) => s.stats), // already most-recent-first
      edge: ex.edge,
      injuries: ex.injuries,
      career: ex.career,
      previous: ex.previous,
      overrides: ex.overrides,
    };
    out.push({ input, team: head.team, mpName: head.name });
  }
  return out;
}
