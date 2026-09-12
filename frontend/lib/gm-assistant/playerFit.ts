import { prisma } from "@/lib/prisma";
import { loadLeagueSlots, rankSlot, SLOTS, compositeRating, type SlotDef } from "./leagueSlots";
import { teamCapStatus } from "@/lib/cap";
import { liveCapHit } from "@/lib/finance";

// UNHL Intelligence — "Fit for my team" and "Who could want him" (Player
// Intelligence, phase 4 — see memory: gm-assistant-intelligence). Both reuse
// the exact same per-slot rating (leagueSlots.ts: CK/PA/SC/DF composite for
// skaters, GoalieRating.overall for goalies) Analyze My Roster and Find Trade
// Partner already rank on — a player's "fit" is just his own rating held up
// against the same numbers, nothing invented.

const isPos = (pos: string, code: string) => new RegExp(`(^|/)${code}(/|$)`).test(pos.toUpperCase());

/** Forward-line / D-pair / goalie slots this player's position is eligible
 *  for (PP1/PK1 excluded — those draw from multiple positions and are a
 *  strategy choice, not a home-position fit). */
export function slotsForPosition(position: string | null, isGoalie: boolean): SlotDef[] {
  if (isGoalie) return SLOTS.filter((s) => s.kind === "goalie");
  const pos = position ?? "";
  return SLOTS.filter((s) => {
    if (s.kind === "goalie" || s.kind === "special") return false;
    if (s.kind === "defense") return isPos(pos, "D");
    return isPos(pos, s.side!.toUpperCase());
  });
}

async function loadPlayerForFit(playerId: number) {
  return prisma.player.findUnique({
    where: { id: playerId },
    select: {
      id: true, teamId: true, isGoalie: true, position: true, ck: true, pa: true, sc: true, df: true,
      capHit: true, contractYears: true, goalieRating: { select: { overall: true } },
    },
  });
}

export interface SlotFit {
  slotId: string;
  slotLabel: string;
  teamRating: number | null; // null = team has nobody eligible there at all
  teamAuto: boolean;
  playerRating: number | null;
  delta: number | null; // playerRating - teamRating, positive = upgrade
}

export interface FitForMyTeamResult {
  playerId: number;
  teamId: number;
  teamName: string;
  playerCapHit: number;
  capSpace: number; // strictSpace — the real, uncushioned room (see lib/cap.ts)
  capFits: boolean;
  slots: SlotFit[];
}

export async function fitForMyTeam(playerId: number, teamId: number): Promise<FitForMyTeamResult | null> {
  const player = await loadPlayerForFit(playerId);
  if (!player) return null;
  const playerRating = player.isGoalie ? (player.goalieRating?.overall ?? null) : compositeRating(player);
  const relevantSlots = slotsForPosition(player.position, player.isGoalie);
  if (!relevantSlots.length) return null;

  const [data, cap, team] = await Promise.all([
    loadLeagueSlots(),
    teamCapStatus(teamId).catch(() => null),
    prisma.team.findUnique({ where: { id: teamId }, select: { name: true } }),
  ]);
  if (!team) return null;

  const slots: SlotFit[] = relevantSlots.map((slot) => {
    const rows = rankSlot(data, slot);
    const mine = rows.find((r) => r.teamId === teamId);
    const teamRating = mine?.avg ?? null;
    return {
      slotId: slot.id, slotLabel: slot.label,
      teamRating, teamAuto: mine?.isAuto ?? false, playerRating,
      delta: playerRating != null && teamRating != null ? Math.round((playerRating - teamRating) * 10) / 10 : null,
    };
  });

  const playerCapHit = liveCapHit(player);
  const capSpace = cap?.strictSpace ?? 0;

  return { playerId, teamId, teamName: team.name, playerCapHit, capSpace, capFits: playerCapHit <= capSpace, slots };
}

export interface InterestedTeam {
  teamId: number;
  teamName: string;
  slotId: string;
  slotLabel: string;
  teamRating: number;
  delta: number; // playerRating - teamRating, always positive here
}

export interface WhoCouldWantHimResult {
  playerId: number;
  playerRating: number | null;
  teams: InterestedTeam[];
}

/** Every other NHL club whose matching slot currently rates below this
 *  player — one row per team (its weakest matching slot, i.e. biggest need),
 *  sorted by the size of the upgrade. Same "no willingness-to-deal guess"
 *  rule as Find Trade Partner: a candidate here means a real need exists,
 *  nothing about whether that club would actually deal for him. */
export async function whoCouldWantHim(playerId: number, limit = 8): Promise<WhoCouldWantHimResult | null> {
  const player = await loadPlayerForFit(playerId);
  if (!player) return null;
  const playerRating = player.isGoalie ? (player.goalieRating?.overall ?? null) : compositeRating(player);
  if (playerRating == null) return { playerId, playerRating, teams: [] };
  const relevantSlots = slotsForPosition(player.position, player.isGoalie);
  if (!relevantSlots.length) return { playerId, playerRating, teams: [] };

  const data = await loadLeagueSlots();
  const bestNeedByTeam = new Map<number, InterestedTeam>();
  for (const slot of relevantSlots) {
    const rows = rankSlot(data, slot);
    for (const row of rows) {
      if (row.teamId === player.teamId) continue; // already his own club
      if (row.avg >= playerRating) continue; // no upgrade there
      const delta = Math.round((playerRating - row.avg) * 10) / 10;
      const existing = bestNeedByTeam.get(row.teamId);
      if (!existing || delta > existing.delta) {
        bestNeedByTeam.set(row.teamId, { teamId: row.teamId, teamName: row.teamName, slotId: slot.id, slotLabel: slot.label, teamRating: row.avg, delta });
      }
    }
  }
  const teams = [...bestNeedByTeam.values()].sort((a, b) => b.delta - a.delta).slice(0, limit);
  return { playerId, playerRating, teams };
}
