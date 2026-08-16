"use server";

import { prisma } from "@/lib/prisma";
import { canManageTeam } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { ROSTER_LIMITS, type MoveRow } from "@/lib/roster-rules";

export async function saveRosterMoves(slug: string, moves: MoveRow[]) {
  const team = await prisma.team.findUnique({
    where: { slug },
    include: { affiliateTeams: { select: { id: true } } },
  });
  if (!team) throw new Error("Team not found");
  if (!(await canManageTeam(team.id))) throw new Error("Not authorized for this team");
  const affiliate = team.affiliateTeams[0];
  if (!affiliate) throw new Error("Team has no affiliate to move players to");

  // load real player rows for validation (position/goalie can't be spoofed by client)
  const ids = moves.map((m) => m.id);
  const players = await prisma.player.findMany({
    where: { id: { in: ids }, teamId: { in: [team.id, affiliate.id] } },
    select: { id: true, isGoalie: true },
  });
  const byId = new Map(players.map((p) => [p.id, p]));
  const valid = moves.filter((m) => byId.has(m.id));

  const pro = valid.filter((m) => m.side === "pro");
  const farm = valid.filter((m) => m.side === "farm");
  const goalies = (list: MoveRow[]) => list.filter((m) => byId.get(m.id)!.isGoalie).length;

  // rule: one-way contracts cannot be sent to the farm
  const illegalFarm = farm.find((m) => m.contractType === "ONE_WAY");
  if (illegalFarm) throw new Error("A one-way contract player cannot be sent to the farm.");

  // Only HARD maxima block a save. Being under a minimum (short-handed pro roster)
  // is allowed — the farm auto-fills the missing bodies before each game, and a
  // call-up is usually the very move that fixes it.
  if (pro.length > ROSTER_LIMITS.proMax) throw new Error(`Pro roster over the ${ROSTER_LIMITS.proMax}-player cap limit.`);
  if (valid.length > ROSTER_LIMITS.orgMax) throw new Error(`Organization over ${ROSTER_LIMITS.orgMax} players (NHL + AHL).`);
  if (goalies(valid) > ROSTER_LIMITS.orgMaxGoalies) throw new Error(`Organization can hold at most ${ROSTER_LIMITS.orgMaxGoalies} goalies (NHL + AHL).`);

  await prisma.$transaction(valid.map((m) =>
    prisma.player.update({
      where: { id: m.id },
      data: {
        teamId: m.side === "pro" ? team.id : affiliate.id,
        rosterType: m.side === "pro" ? "NHL" : "AHL",
        contractType: m.contractType,
      },
    })));

  revalidatePath(`/teams/${slug}/rosters`);
  revalidatePath(`/teams/${slug}`);
}
