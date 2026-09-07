"use server";

import { prisma } from "@/lib/prisma";
import { getTeamSession } from "@/lib/auth";
import { loadSettings } from "@/lib/sim/settings";
import { getLeagueClock } from "@/lib/calendar-server";
import { buyoutTerms, CURRENT_SEASON_START } from "@/lib/finance";
import { revalidatePath } from "next/cache";

/** Buy a player out of his contract ("vyplatený zo zmluvy"). GM-only.
 *  inSeason (which buyout % applies) is derived from the league's actual
 *  current phase, not a client-supplied flag — it used to be hardcoded true
 *  by the only caller (BuyoutButton), so an off-season buyout was silently
 *  charged the in-season rate. Regular season/playoffs = in-season; frenzy/
 *  preseason/off-season = the cheaper off-season rate. */
export async function buyoutPlayer(slug: string, playerId: number) {
  const team = await prisma.team.findUnique({ where: { slug }, select: { id: true } });
  if (!team) throw new Error("Team not found");
  const session = await getTeamSession();
  if (session !== team.id) throw new Error("Not authorized for this team");

  const player = await prisma.player.findFirst({
    where: { id: playerId, teamId: team.id, rosterType: "NHL" },
    select: { id: true, name: true, capHit: true, contractYears: true },
  });
  if (!player) throw new Error("Player not on this team's NHL roster");
  if (!player.capHit || !player.contractYears) throw new Error("Player has no contract to buy out");

  const { phase } = await getLeagueClock();
  const inSeason = phase === "regular" || phase === "playoffs";
  const settings = await loadSettings();
  const terms = buyoutTerms(player.capHit, player.contractYears, inSeason, settings);

  await prisma.$transaction([
    prisma.buyout.create({
      data: {
        teamId: team.id, playerId: player.id, playerName: player.name,
        perYear: terms.perYear, years: terms.years, startYear: CURRENT_SEASON_START,
        totalCost: terms.totalCost, inSeason,
      },
    }),
    prisma.team.update({ where: { id: team.id }, data: { bankAccount: { decrement: terms.totalCost }, ledgerAdj: { decrement: terms.totalCost } } }),
    prisma.player.update({ where: { id: player.id }, data: { rosterType: "UFA", captaincy: null } }),
  ]);

  revalidatePath(`/finance/${slug}`);
  revalidatePath("/salary-cap");
  revalidatePath("/finance");
}
