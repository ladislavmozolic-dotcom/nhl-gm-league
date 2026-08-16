// Trade Block — GMs list players they'll move + the positions they're shopping
// for. The match helper surfaces, for a given team, the listed players elsewhere
// that fit its stated needs. It suggests partners; it does NOT judge fairness.

import { prisma } from "./prisma";
import { cleanName } from "./playerName";

export const NEED_POSITIONS = ["C", "LW", "RW", "D", "G"] as const;
export type NeedPos = (typeof NEED_POSITIONS)[number];

export type BlockPlayer = {
  id: number; name: string; slug: string | null; position: string; overall: number | null;
  age: number | null; capHit: number | null; contractYears: number | null; note: string | null;
  teamId: number; teamCode: string | null; teamName: string; teamSlug: string | null;
};
export type BlockTeam = { teamId: number; code: string | null; name: string; slug: string | null; needs: string[]; players: BlockPlayer[] };

// A player fills a need if the need position appears in its position string
// ("C", "C/RW", "LW/RW"…). "D" matches any defenceman, "G" any goalie.
export function fillsNeed(position: string, need: string): boolean {
  const parts = (position || "").split("/").map((s) => s.trim().toUpperCase());
  return parts.includes(need.toUpperCase());
}

export async function tradeBlockBoard(): Promise<BlockTeam[]> {
  const players = await prisma.player.findMany({
    where: { onBlock: true, rosterType: { in: ["NHL", "AHL"] } },
    select: { id: true, name: true, slug: true, position: true, overall: true, age: true, capHit: true, contractYears: true, blockNote: true, teamId: true, team: { select: { code: true, name: true, slug: true, needs: true, league: true } } },
    orderBy: [{ overall: "desc" }],
  });
  const byTeam = new Map<number, BlockTeam>();
  for (const p of players) {
    if (!p.team) continue;
    let t = byTeam.get(p.teamId);
    if (!t) { t = { teamId: p.teamId, code: p.team.code, name: p.team.name, slug: p.team.slug, needs: p.team.needs ?? [], players: [] }; byTeam.set(p.teamId, t); }
    t.players.push({
      id: p.id, name: cleanName(p.name), slug: p.slug, position: p.position, overall: p.overall, age: p.age,
      capHit: p.capHit, contractYears: p.contractYears, note: p.blockNote,
      teamId: p.teamId, teamCode: p.team.code, teamName: p.team.name, teamSlug: p.team.slug,
    });
  }
  return [...byTeam.values()].sort((a, b) => b.players.length - a.players.length);
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

// A team's own roster for the manage page (mark on/off block + note).
export async function teamRosterForBlock(teamId: number): Promise<{ needs: string[]; players: (BlockPlayer & { onBlock: boolean })[] }> {
  const team = await prisma.team.findUnique({ where: { id: teamId }, select: { needs: true } });
  const rows = await prisma.player.findMany({
    where: { teamId, rosterType: { in: ["NHL", "AHL"] } },
    select: { id: true, name: true, slug: true, position: true, overall: true, age: true, capHit: true, contractYears: true, onBlock: true, blockNote: true, team: { select: { code: true, name: true, slug: true } } },
  });
  return {
    needs: team?.needs ?? [],
    players: rows.map((p) => ({
      id: p.id, name: cleanName(p.name), slug: p.slug, position: p.position, overall: p.overall, age: p.age,
      capHit: p.capHit, contractYears: p.contractYears, note: p.blockNote, onBlock: p.onBlock,
      teamId, teamCode: p.team?.code ?? null, teamName: p.team?.name ?? "", teamSlug: p.team?.slug ?? null,
    })).sort((a, b) => a.name.localeCompare(b.name)),
  };
}
