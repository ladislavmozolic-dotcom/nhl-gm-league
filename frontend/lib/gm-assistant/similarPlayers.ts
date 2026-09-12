import { prisma } from "@/lib/prisma";
import { liveCapHit } from "@/lib/finance";
import { posGroup } from "@/lib/ratingBands";

// UNHL Intelligence — "Similar Players" / "Contract Comparables" (Player
// Intelligence, phase 4 of the design doc — see memory: gm-assistant-intelligence).
// Same rule as the rest of the tool: a plain distance over real rated
// parameters (CK/PA/SC/DF for skaters, goalieRating.overall for goalies — see
// ov-vs-specific-params) plus age, decomposable per stat, no invented single
// "match" score presented as a verdict — the same numbers driving the sort
// are the ones shown in the table.

export interface SimilarPlayer {
  id: number;
  name: string;
  slug: string;
  position: string | null;
  age: number | null;
  teamCode: string | null;
  teamSlug: string | null;
  teamLogo: string | null;
  ck: number | null; pa: number | null; sc: number | null; df: number | null; // null for goalies
  overall: number | null;
  capHit: number;
  contractYears: number | null;
  rosterType: string | null;
  distance: number; // lower = closer profile; see summary below for how it's built
}

export interface SimilarPlayersResult {
  playerId: number;
  isGoalie: boolean;
  players: SimilarPlayer[];
}

const AGE_WEIGHT = 3; // 1 year of age counted like a 3-point stat gap — a plain, stated choice, not fitted

export async function findSimilarPlayers(playerId: number, limit = 8): Promise<SimilarPlayersResult | null> {
  const target = await prisma.player.findUnique({
    where: { id: playerId },
    select: { id: true, isGoalie: true, position: true, age: true, ck: true, pa: true, sc: true, df: true, goalieRating: { select: { overall: true } } },
  });
  if (!target) return null;
  const isGoalie = target.isGoalie;
  const grp = posGroup(target.position, isGoalie);

  if (isGoalie) {
    const targetOv = target.goalieRating?.overall ?? null;
    if (targetOv == null) return { playerId, isGoalie, players: [] };
    const candidates = await prisma.player.findMany({
      where: { id: { not: playerId }, isGoalie: true, rosterType: "NHL" },
      select: {
        id: true, name: true, slug: true, position: true, age: true, capHit: true, contractYears: true, rosterType: true,
        goalieRating: { select: { overall: true } }, team: { select: { code: true, slug: true, logoUrl: true } },
      },
    });
    const scored = candidates
      .filter((c) => c.goalieRating?.overall != null && c.age != null)
      .map((c) => {
        const ovDiff = (c.goalieRating!.overall as number) - targetOv;
        const ageDiff = ((c.age as number) - (target.age ?? c.age as number)) * AGE_WEIGHT;
        const distance = Math.sqrt(ovDiff * ovDiff + ageDiff * ageDiff);
        return {
          id: c.id, name: c.name, slug: c.slug, position: c.position, age: c.age,
          teamCode: c.team?.code ?? null, teamSlug: c.team?.slug ?? null, teamLogo: c.team?.logoUrl ?? null,
          ck: null, pa: null, sc: null, df: null, overall: c.goalieRating!.overall,
          capHit: liveCapHit(c), contractYears: c.contractYears, rosterType: c.rosterType, distance,
        } satisfies SimilarPlayer;
      })
      .sort((a, b) => a.distance - b.distance)
      .slice(0, limit);
    return { playerId, isGoalie, players: scored };
  }

  const candidates = await prisma.player.findMany({
    where: { id: { not: playerId }, isGoalie: false, rosterType: "NHL" },
    select: { id: true, name: true, slug: true, position: true, age: true, ck: true, pa: true, sc: true, df: true, overall: true, capHit: true, contractYears: true, rosterType: true, team: { select: { code: true, slug: true, logoUrl: true } } },
  });
  const scored = candidates
    .filter((c) => posGroup(c.position, false) === grp && c.age != null && c.ck != null && c.pa != null && c.sc != null && c.df != null)
    .map((c) => {
      const dCk = (c.ck as number) - (target.ck ?? 0);
      const dPa = (c.pa as number) - (target.pa ?? 0);
      const dSc = (c.sc as number) - (target.sc ?? 0);
      const dDf = (c.df as number) - (target.df ?? 0);
      const dAge = ((c.age as number) - (target.age ?? (c.age as number))) * AGE_WEIGHT;
      const distance = Math.sqrt(dCk * dCk + dPa * dPa + dSc * dSc + dDf * dDf + dAge * dAge);
      return {
        id: c.id, name: c.name, slug: c.slug, position: c.position, age: c.age,
        teamCode: c.team?.code ?? null, teamSlug: c.team?.slug ?? null, teamLogo: c.team?.logoUrl ?? null,
        ck: c.ck, pa: c.pa, sc: c.sc, df: c.df, overall: c.overall,
        capHit: liveCapHit(c), contractYears: c.contractYears, rosterType: c.rosterType, distance,
      } satisfies SimilarPlayer;
    })
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit);

  return { playerId, isGoalie, players: scored };
}
