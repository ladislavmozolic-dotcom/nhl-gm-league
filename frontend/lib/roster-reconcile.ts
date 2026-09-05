// Post-season roster reconciliation (run before the NHL draft each June).
// Classifies every A-team / farm player into an action from last season's GP,
// age (UFA ≥27 / RFA ≤26 at June 30) and contract. Player-table rules 1-3 here;
// prospect activation (rules 4-5) is separate (needs the Prospect table).

import { prisma } from "./prisma";
import { computeELC } from "./elc";
import { CURRENT_SEASON_START } from "./finance";

export type ReconAction = "DELETE" | "TO_PROSPECTS" | "LTIR_PROSPECT" | "ACTIVATE_NHL" | "ACTIVATE_NHL_ELC" | "ACTIVATE_AHL" | "NONE";

const LTIR_GP = 10; // played at least 1 but fewer than this many games (NHL+AHL) → LTIR

export type ReconInput = {
  rosterType: string | null; age: number | null; contractType: string | null; capHit: number | null;
  nhlGP: number; ahlGP: number; isGoalie?: boolean;
};

const FARM_MAX = 600_000; // $100k two-way or the $599,999 mid-season-activation deal

export function reconcilePlayer(p: ReconInput): { action: ReconAction; reason: string } {
  const age = p.age ?? 27;
  const ufa = age >= 27;
  const oneWay = p.contractType === "ONE_WAY";
  const played = p.nhlGP > 0 || p.ahlGP > 0;

  // Prospects — activation rules 4 & 5
  if (p.rosterType === "PROSPECT") {
    if (p.nhlGP >= 10) return { action: "ACTIVATE_NHL_ELC", reason: `${p.nhlGP} NHL GP → activate to the A-team on an ELC` };
    if (p.isGoalie ? p.ahlGP >= 5 : p.ahlGP >= 15) return { action: "ACTIVATE_AHL", reason: `${p.ahlGP} AHL GP → activate to the farm ($100k)` };
    return { action: "NONE", reason: "still developing" };
  }

  // A-team / farm — rules 1, 2, 3
  if (!played) {
    if (ufa && !oneWay) return { action: "DELETE", reason: "0 NHL/AHL GP · UFA age · no one-way deal" };
    return { action: "TO_PROSPECTS", reason: ufa ? "0 NHL/AHL GP · UFA with a one-way deal" : "0 NHL/AHL GP · RFA age" };
  }
  // LTIR: played at least 1 game but under a full workload (<10 total) → park in the
  // prospects/reserve list next season with an LTIR note; off the cap until activated.
  const totalGP = p.nhlGP + p.ahlGP;
  if (totalGP < LTIR_GP) return { action: "LTIR_PROSPECT", reason: `only ${totalGP} GP (NHL+AHL) → LTIR reserve, off the cap` };
  if (p.rosterType === "AHL" && p.capHit != null && p.capHit <= FARM_MAX && p.nhlGP >= 10) {
    return { action: "ACTIVATE_NHL", reason: `${p.nhlGP} NHL GP on a farm deal → activate to the A-team` };
  }
  return { action: "NONE", reason: "" };
}

export type ReconRow = {
  id: number; name: string; teamCode: string | null; age: number | null; rosterType: string | null;
  nhlGP: number; ahlGP: number; capHit: number | null; action: ReconAction; reason: string;
};

/** League-wide reconciliation preview (only players with a proposed action). */
export async function previewReconciliation(): Promise<ReconRow[]> {
  const players = await prisma.player.findMany({
    where: { rosterType: { in: ["NHL", "AHL", "PROSPECT"] } },
    select: {
      id: true, name: true, age: true, rosterType: true, contractType: true, capHit: true, isGoalie: true,
      lastSeasonGP: true, lastSeasonAhlGP: true,
      team: { select: { code: true, parentTeamId: true } },
    },
  });
  const out: ReconRow[] = [];
  for (const p of players) {
    const nhlGP = p.lastSeasonGP ?? 0, ahlGP = p.lastSeasonAhlGP ?? 0;
    const { action, reason } = reconcilePlayer({ rosterType: p.rosterType, age: p.age, contractType: p.contractType, capHit: p.capHit, nhlGP, ahlGP, isGoalie: p.isGoalie });
    if (action === "NONE") continue;
    out.push({ id: p.id, name: p.name, teamCode: p.team?.code ?? null, age: p.age, rosterType: p.rosterType, nhlGP, ahlGP, capHit: p.capHit, action, reason });
  }
  const order: Record<ReconAction, number> = { ACTIVATE_NHL: 0, ACTIVATE_NHL_ELC: 0, ACTIVATE_AHL: 0, LTIR_PROSPECT: 1, TO_PROSPECTS: 2, DELETE: 3, NONE: 4 };
  return out.sort((a, b) => order[a.action] - order[b.action] || (a.teamCode ?? "").localeCompare(b.teamCode ?? ""));
}

/** Apply one player's reconciliation action. */
export async function applyReconcileOne(id: number): Promise<boolean> {
  const p = await prisma.player.findUnique({
    where: { id },
    select: {
      rosterType: true, age: true, position: true, isGoalie: true, contractType: true, capHit: true, df: true,
      lastSeasonGP: true, lastSeasonAhlGP: true, lastSeasonPts: true, lastSeasonSvPct: true,
      team: { select: { parentTeamId: true, affiliateTeams: { select: { id: true }, take: 1 } } },
    },
  });
  if (!p) return false;
  const { action } = reconcilePlayer({ rosterType: p.rosterType, age: p.age, contractType: p.contractType, capHit: p.capHit, nhlGP: p.lastSeasonGP ?? 0, ahlGP: p.lastSeasonAhlGP ?? 0, isGoalie: p.isGoalie });
  // `parent` = current team's parent (meaningful when currently AT an affiliate,
  // e.g. AHL→NHL or AHL→PROSPECT); `affiliateId` = current team's own affiliate
  // (meaningful when currently at the NHL club itself, e.g. PROSPECT→AHL). A
  // player must always move teamId to match rosterType — leaving him AHL-tagged
  // at a non-affiliate teamId (or PROSPECT-tagged at an affiliate's teamId)
  // makes him invisible to both the NHL and AHL roster queries.
  const parent = p.team?.parentTeamId;
  const affiliateId = p.team?.affiliateTeams?.[0]?.id;
  if (action === "DELETE") {
    await prisma.player.update({ where: { id }, data: { rosterType: "RELEASED" } });
  } else if (action === "TO_PROSPECTS") {
    await prisma.player.update({ where: { id }, data: { rosterType: "PROSPECT", ...(parent ? { teamId: parent } : {}) } });
  } else if (action === "LTIR_PROSPECT") {
    // park in the reserve list flagged LTIR; PROSPECT rosterType already drops him
    // out of every cap/roster query, so his hit no longer counts.
    await prisma.player.update({ where: { id }, data: { rosterType: "PROSPECT", ltir: true, ...(parent ? { teamId: parent } : {}) } });
  } else if (action === "ACTIVATE_NHL") {
    await prisma.player.update({ where: { id }, data: { rosterType: "NHL", ...(parent ? { teamId: parent } : {}) } });
  } else if (action === "ACTIVATE_NHL_ELC") {
    // prospect cracked the NHL → activate to the A-team on an ELC
    const pos = p.isGoalie ? "G" : (/\bD\b/.test((p.position ?? "").toUpperCase()) && !/[CW]/.test((p.position ?? "").toUpperCase()) ? "D" : "F");
    const c = computeELC({ pos, age: p.age, df: p.df, lastSeasonGP: p.lastSeasonGP, lastSeasonPts: p.lastSeasonPts, lastSeasonSvPct: p.lastSeasonSvPct });
    const expiry = CURRENT_SEASON_START + c.years;
    await prisma.player.update({ where: { id }, data: {
      rosterType: "NHL", ...(parent ? { teamId: parent } : {}),
      capHit: c.capHit, contractYears: c.years, contractExpiry: expiry, contractType: "TWO_WAY",
      contractText: `$${c.base.toLocaleString("en-US")} + $${c.bonus.toLocaleString("en-US")} bonus × ${c.years}yr (ELC, through ${expiry})`,
    } });
  } else if (action === "ACTIVATE_AHL") {
    // prospect earned an AHL role → farm contract at $100k, moved onto the
    // org's actual AHL affiliate roster (was sitting at the parent's teamId
    // as a PROSPECT, same as ACTIVATE_NHL moves the other way).
    await prisma.player.update({ where: { id }, data: {
      rosterType: "AHL", ...(affiliateId ? { teamId: affiliateId } : {}),
      capHit: 100_000, contractType: "TWO_WAY", contractText: "$100,000 × 1yr (farm)",
    } });
  } else return false;
  return true;
}
