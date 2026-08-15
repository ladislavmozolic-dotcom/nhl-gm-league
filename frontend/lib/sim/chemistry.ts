// Line chemistry — pure, client-safe helpers.
//
// Chemistry is a 0..100 value per forward trio / defense pair. It grows while a
// unit plays together unchanged and drops when the unit is broken (an injury or
// a call-up forces a substitute). A fully gelled unit (>= neutral) sims at full
// strength; a fresh or disrupted unit is slightly penalized (never a bonus, so
// chemistry can't inflate league-wide scoring — it only suppresses new lines).

import type { TeamLinesData } from "./lines-core";
import type { LineUnit } from "./types";

/** Stable signature for a unit: its member ids, sorted, joined — order-independent. */
export function unitSignature(ids: Array<number | null | undefined>): string {
  return ids.filter((x): x is number => x != null).sort((a, b) => a - b).join("-");
}

/** The forward trios + defense pairs a team has set, as chemistry units. */
export function buildUnits(lines: TeamLinesData | null | undefined): LineUnit[] {
  if (!lines) return [];
  const units: LineUnit[] = [];
  for (const l of lines.forwardLines ?? []) {
    const members = [l.lw, l.c, l.rw].filter((x): x is number => x != null);
    if (members.length >= 2) units.push({ sig: unitSignature(members), members, isDef: false });
  }
  for (const p of lines.defensePairs ?? []) {
    const members = [p.ld, p.rd].filter((x): x is number => x != null);
    if (members.length >= 2) units.push({ sig: unitSignature(members), members, isDef: true });
  }
  return units;
}

/**
 * Special-teams units (PP1 + PK1) as their OWN chemistry units, tracked and
 * grown SEPARATELY from 5v5 (a PP unit that stays together gels on the PP
 * specifically). Signatures are prefixed so they never collide with 5v5 units,
 * and they're kept out of the per-player 5v5 chemistry map.
 */
export function buildStUnits(lines: TeamLinesData | null | undefined): LineUnit[] {
  if (!lines) return [];
  const units: LineUnit[] = [];
  const pp1 = (lines.situations?.pp?.[0]?.players ?? []).filter((x): x is number => x != null);
  if (pp1.length >= 3) units.push({ sig: "pp:" + unitSignature(pp1), members: pp1, isDef: false });
  const pk1 = (lines.situations?.pk4?.[0]?.players ?? []).filter((x): x is number => x != null);
  if (pk1.length >= 3) units.push({ sig: "pk:" + unitSignature(pk1), members: pk1, isDef: true });
  return units;
}

/**
 * Fallback units when a team has no manager-set lines: group the depth chart
 * (ids already ordered by ice time) into forward trios and defense pairs. This
 * only defines *who gels with whom* for chemistry — it does NOT set deployment.
 */
export function depthChartUnits(fwdIds: number[], defIds: number[]): LineUnit[] {
  const units: LineUnit[] = [];
  for (let i = 0; i + 1 < fwdIds.length; i += 3) {
    const members = fwdIds.slice(i, i + 3);
    if (members.length >= 2) units.push({ sig: unitSignature(members), members, isDef: false });
  }
  for (let i = 0; i + 1 < defIds.length; i += 2) {
    const members = defIds.slice(i, i + 2);
    if (members.length >= 2) units.push({ sig: unitSignature(members), members, isDef: true });
  }
  return units;
}

/** playerId -> chemistry of the unit they belong to (defaults to 100 = no penalty). */
export function playerChemistry(units: LineUnit[], chem: Record<string, number>, base: number): Map<number, number> {
  const m = new Map<number, number>();
  for (const u of units) {
    const v = chem[u.sig] ?? base;
    for (const id of u.members) m.set(id, v);
  }
  return m;
}
