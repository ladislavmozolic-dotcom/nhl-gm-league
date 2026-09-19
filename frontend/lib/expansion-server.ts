// NHL Expansion — shared protection-list eligibility rules and validation, used by
// both the GM-facing form (client preview) and the server action (authoritative
// re-validation — never trust client-submitted counts).

import { prisma } from "./prisma";

// Same regex convention used across the codebase (lib/commissioner-server.ts,
// lib/gm-dashboard-server.ts, ...) — positions are slash-delimited (e.g. "C/LW").
export const isFwd = (pos: string) => /(^|\/)(C|LW|RW)(\/|$)/.test(pos.toUpperCase());
export const isDef = (pos: string) => /(^|\/)D(\/|$)/.test(pos.toUpperCase());

export type ProtectionFormat = "7-3-1" | "8-1";

export type ProtEligPlayer = {
  id: number;
  name: string;
  position: string;
  isGoalie: boolean;
  overall: number | null;
  capHit: number | null;
  tradeClause: string | null;
  contractType: string | null;
  contractText: string | null;
};

/** Forced-protected: an active no-movement clause forces the team to protect this
 *  player (real 2021 rule) — he can't be left exposed. */
export function isForcedProtect(p: Pick<ProtEligPlayer, "tradeClause">): boolean {
  return p.tradeClause === "NMC";
}

export type ExpansionRuleset = "real2021" | "simplified";

/** Auto-exempt: not protectable and not selectable by the expansion team at all.
 *  The codebase has no years-of-service field, so this approximates the real
 *  "first/second-year pro" exemption with the two-way/entry-level signal already
 *  used elsewhere for a similar "still developing" concept (see lib/ai-gm.ts).
 *  Commissioner-skippable (SimSettings.expansionRuleset = "simplified") for a
 *  league that doesn't want the approximation — NMC still forces protection
 *  either way (isForcedProtect is a real field, not an approximation). */
export function isAutoExempt(p: Pick<ProtEligPlayer, "contractType" | "contractText">, ruleset: ExpansionRuleset = "real2021"): boolean {
  if (ruleset === "simplified") return false;
  return p.contractType === "TWO_WAY" || !!p.contractText?.toUpperCase().includes("ELC");
}

export const FORMAT_SLOTS: Record<ProtectionFormat, { f: number; d: number; g: number; skaters: number }> = {
  "7-3-1": { f: 7, d: 3, g: 1, skaters: 10 },
  "8-1": { f: 0, d: 0, g: 1, skaters: 8 }, // 8-1: any F/D mix, no per-position split
};

export type ProtectionValidation = { ok: true } | { ok: false; error: string };

/** Full server-side re-validation of a protection submission — re-derives forced/exempt
 *  fresh from the roster (never trusts stored/client state) and checks the chosen
 *  format's slot counts exactly. `chosenIds` = the GM's voluntary picks (excludes
 *  forced-protected players, who are implicit). */
export function validateProtection(roster: ProtEligPlayer[], format: ProtectionFormat, chosenIds: number[], ruleset: ExpansionRuleset = "real2021"): ProtectionValidation {
  const byId = new Map(roster.map((p) => [p.id, p]));
  const forced = roster.filter(isForcedProtect);
  const forcedIds = new Set(forced.map((p) => p.id));
  const exemptIds = new Set(roster.filter((p) => isAutoExempt(p, ruleset)).map((p) => p.id));

  for (const id of chosenIds) {
    const p = byId.get(id);
    if (!p) return { ok: false, error: "A selected player is no longer on this roster." };
    if (exemptIds.has(id)) return { ok: false, error: `${p.name} is exempt (entry-level/two-way) — don't need to protect him.` };
    if (forcedIds.has(id)) return { ok: false, error: `${p.name} is already force-protected (NMC) — don't select him again.` };
  }
  const chosenSet = new Set(chosenIds);
  const protectedAll = [...forced, ...chosenIds.map((id) => byId.get(id)!)];
  if (new Set(protectedAll.map((p) => p.id)).size !== protectedAll.length) return { ok: false, error: "Duplicate player in the protection list." };

  const slots = FORMAT_SLOTS[format];
  const fCount = protectedAll.filter((p) => !p.isGoalie && isFwd(p.position)).length;
  const dCount = protectedAll.filter((p) => !p.isGoalie && isDef(p.position)).length;
  const gCount = protectedAll.filter((p) => p.isGoalie).length;
  const skaterCount = fCount + dCount;

  if (gCount !== slots.g) return { ok: false, error: `Format ${format} requires exactly ${slots.g} protected goalie(s) — you have ${gCount}.` };
  if (format === "7-3-1") {
    if (fCount !== slots.f) return { ok: false, error: `Format 7-3-1 requires exactly ${slots.f} forwards — you have ${fCount}.` };
    if (dCount !== slots.d) return { ok: false, error: `Format 7-3-1 requires exactly ${slots.d} defensemen — you have ${dCount}.` };
  } else {
    if (skaterCount !== slots.skaters) return { ok: false, error: `Format 8-1 requires exactly ${slots.skaters} skaters (any mix) — you have ${skaterCount}.` };
  }
  void chosenSet;
  return { ok: true };
}

/** The team's NHL roster shaped for protection-list eligibility. */
export async function protectionRosterFor(teamId: number): Promise<ProtEligPlayer[]> {
  return prisma.player.findMany({
    where: { teamId, rosterType: "NHL" },
    select: { id: true, name: true, position: true, isGoalie: true, overall: true, capHit: true, tradeClause: true, contractType: true, contractText: true },
    orderBy: { overall: "desc" },
  });
}

/** The players an expansion team may actually select from a given source team right
 *  now: the NHL roster minus auto-exempt players, minus force-protected (NMC)
 *  players, minus whatever that team explicitly chose to protect. Always re-derived
 *  live from the roster + their stored submission — never trusts a cached list. */
export async function exposedPlayersFor(sourceTeamId: number, expansionDraftId: number): Promise<ProtEligPlayer[]> {
  const { loadSettings } = await import("./sim/settings");
  const [roster, submission, settings] = await Promise.all([
    protectionRosterFor(sourceTeamId),
    prisma.expansionProtection.findUnique({ where: { expansionDraftId_teamId: { expansionDraftId, teamId: sourceTeamId } } }),
    loadSettings(),
  ]);
  const chosenIds = new Set(submission?.playerIds ?? []);
  return roster.filter((p) => !isAutoExempt(p, settings.expansionRuleset) && !isForcedProtect(p) && !chosenIds.has(p.id));
}

/** Worst-first pick order for an expansion draft: every OTHER active NHL club, once
 *  each, by reverse current standings. The expansion team itself is always excluded
 *  (a fresh 0-GP club can otherwise land anywhere in a reversed points-pct sort). */
export async function expansionPickOrder(expansionTeamId: number, season = "2026-27"): Promise<number[]> {
  const { reverseStandingsOrder } = await import("./draft-order");
  const order = await reverseStandingsOrder(season);
  return order.filter((id) => id !== expansionTeamId);
}

export type ExpansionRosterCheck = {
  goalieCount: number;
  hasGoalie: boolean;
  committedCap: number;
  capFloor: number;
  underFloorBy: number;
};

/** Post-draft sanity check on the expansion team's freshly-picked roster — advisory,
 *  not a hard block (see lib/sim/settings.ts expansionCapFloorPct / expansionRequireGoalie). */
export async function checkExpansionRoster(expansionTeamId: number, capFloorPct: number): Promise<ExpansionRosterCheck> {
  const { loadLeagueCap } = await import("./free-agency-server");
  const { liveCapHit } = await import("./finance");
  const [roster, cap] = await Promise.all([
    prisma.player.findMany({ where: { teamId: expansionTeamId, rosterType: "NHL" }, select: { isGoalie: true, capHit: true, contractYears: true } }),
    loadLeagueCap(),
  ]);
  const goalieCount = roster.filter((p) => p.isGoalie).length;
  const committedCap = roster.reduce((s, p) => s + liveCapHit(p), 0);
  const capFloor = Math.round(cap.lower * capFloorPct);
  return { goalieCount, hasGoalie: goalieCount > 0, committedCap, capFloor, underFloorBy: Math.max(0, capFloor - committedCap) };
}
