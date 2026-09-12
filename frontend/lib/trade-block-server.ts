// Trade Block — GMs list players they'll move + the positions they're shopping
// for. The match helper surfaces, for a given team, the listed players elsewhere
// that fit its stated needs. It suggests partners; it does NOT judge fairness.

import { prisma } from "./prisma";
import { cleanName } from "./playerName";
import { liveCapHit } from "./finance";

export const NEED_POSITIONS = ["C", "LW", "RW", "D", "G"] as const;
export type NeedPos = (typeof NEED_POSITIONS)[number];

export type BlockPlayer = {
  id: number; name: string; slug: string | null; photoUrl: string | null; position: string; overall: number | null;
  age: number | null; capHit: number | null; contractYears: number | null; note: string | null;
  teamId: number; teamCode: string | null; teamName: string; teamSlug: string | null;
  farm: boolean; // rostered on the AHL affiliate, not the NHL club itself — same organization
};
export type BlockTeam = { teamId: number; code: string | null; name: string; slug: string | null; logoUrl: string | null; needs: string[]; players: BlockPlayer[] };

// A player fills a need if the need position appears in its position string
// ("C", "C/RW", "LW/RW"…). "D" matches any defenceman, "G" any goalie.
export function fillsNeed(position: string, need: string): boolean {
  const parts = (position || "").split("/").map((s) => s.trim().toUpperCase());
  return parts.includes(need.toUpperCase());
}

export async function tradeBlockBoard(): Promise<BlockTeam[]> {
  const players = await prisma.player.findMany({
    where: { onBlock: true, rosterType: { in: ["NHL", "AHL"] } },
    select: {
      id: true, name: true, slug: true, photoUrl: true, position: true, overall: true, age: true, capHit: true, contractYears: true, blockNote: true, teamId: true, rosterType: true,
      team: { select: { code: true, name: true, slug: true, logoUrl: true, needs: true, league: true, isAffiliate: true, parentTeamId: true } },
    },
  });
  if (players.length === 0) return [];

  // An AHL-rostered player is still that ORGANIZATION's asset — group him under his
  // NHL parent's card (tagged farm:true) instead of a separate card for the affiliate,
  // which is really the same club to a trading partner.
  const parentIds = players.map((p) => p.team?.parentTeamId).filter((x): x is number => x != null);
  const parents = parentIds.length
    ? await prisma.team.findMany({ where: { id: { in: parentIds } }, select: { id: true, code: true, name: true, slug: true, logoUrl: true, needs: true } })
    : [];
  const parentById = new Map(parents.map((t) => [t.id, t]));

  const byTeam = new Map<number, BlockTeam>();
  for (const p of players) {
    if (!p.team) continue;
    // parentTeamId is the reliable affiliate signal — isAffiliate isn't consistently
    // maintained in the data (some AHL clubs have it false despite a real parent).
    const org = p.team.parentTeamId ? (parentById.get(p.team.parentTeamId) ?? null) : null;
    const orgId = org?.id ?? p.teamId;
    const display = org ?? p.team;
    let t = byTeam.get(orgId);
    if (!t) { t = { teamId: orgId, code: display.code, name: display.name, slug: display.slug, logoUrl: display.logoUrl, needs: display.needs ?? [], players: [] }; byTeam.set(orgId, t); }
    t.players.push({
      id: p.id, name: cleanName(p.name), slug: p.slug, photoUrl: p.photoUrl, position: p.position, overall: p.overall, age: p.age,
      capHit: liveCapHit(p), contractYears: p.contractYears, note: p.blockNote,
      teamId: orgId, teamCode: display.code, teamName: display.name, teamSlug: display.slug,
      farm: p.rosterType === "AHL",
    });
  }
  for (const t of byTeam.values()) t.players.sort((a, b) => (b.overall ?? 0) - (a.overall ?? 0));
  return [...byTeam.values()].sort((a, b) => a.name.localeCompare(b.name));
}

// For a viewer team: the listed players on OTHER teams that fit the viewer's needs.
export async function matchesForTeam(viewerTeamId: number): Promise<{ needs: string[]; matches: BlockPlayer[] }> {
  const viewer = await prisma.team.findUnique({ where: { id: viewerTeamId }, select: { needs: true } });
  const needs = viewer?.needs ?? [];
  if (!needs.length) return { needs, matches: [] };
  const board = await tradeBlockBoard();
  const matches: BlockPlayer[] = [];
  for (const t of board) {
    if (t.teamId === viewerTeamId) continue;
    for (const p of t.players) if (needs.some((n) => fillsNeed(p.position, n))) matches.push(p);
  }
  matches.sort((a, b) => (b.overall ?? 0) - (a.overall ?? 0));
  return { needs, matches };
}

// A team's own roster for the manage page (mark on/off block + note) — the whole
// organization's players (NHL + AHL affiliate), same reasoning as tradeBlockBoard:
// a farm player is this club's asset too, so he must be listable from here.
export async function teamRosterForBlock(teamId: number): Promise<{ needs: string[]; players: (BlockPlayer & { onBlock: boolean })[] }> {
  const team = await prisma.team.findUnique({ where: { id: teamId }, select: { needs: true, affiliateTeams: { select: { id: true } } } });
  const orgIds = [teamId, ...(team?.affiliateTeams.map((a) => a.id) ?? [])];
  const rows = await prisma.player.findMany({
    where: { teamId: { in: orgIds }, rosterType: { in: ["NHL", "AHL"] } },
    select: { id: true, name: true, slug: true, photoUrl: true, position: true, overall: true, age: true, capHit: true, contractYears: true, onBlock: true, blockNote: true, rosterType: true, team: { select: { code: true, name: true, slug: true } } },
  });
  return {
    needs: team?.needs ?? [],
    players: rows.map((p) => ({
      id: p.id, name: cleanName(p.name), slug: p.slug, photoUrl: p.photoUrl, position: p.position, overall: p.overall, age: p.age,
      capHit: liveCapHit(p), contractYears: p.contractYears, note: p.blockNote, onBlock: p.onBlock,
      teamId, teamCode: p.team?.code ?? null, teamName: p.team?.name ?? "", teamSlug: p.team?.slug ?? null,
      farm: p.rosterType === "AHL",
    })).sort((a, b) => a.name.localeCompare(b.name)),
  };
}
