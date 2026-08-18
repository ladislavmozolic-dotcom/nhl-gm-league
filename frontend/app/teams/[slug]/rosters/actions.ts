"use server";

import { prisma } from "@/lib/prisma";
import { canManageTeam } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { ROSTER_LIMITS, type MoveRow } from "@/lib/roster-rules";
import { canAddCapHit } from "@/lib/cap";
import { money } from "@/lib/finance";
import { loadSettings } from "@/lib/sim/settings";

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
    select: { id: true, isGoalie: true, rosterType: true, capHit: true },
  });
  const byId = new Map(players.map((p) => [p.id, p]));
  const valid = moves.filter((m) => byId.has(m.id));

  // an AHL-only (minor-league) contract — below the NHL minimum — can't be iced in
  // the NHL. Keep such a player on the farm no matter what the client requested.
  const NHL_MIN = 775_000;
  const isAhlOnly = (id: number) => { const c = byId.get(id)!.capHit ?? 0; return c > 0 && c < NHL_MIN; };
  for (const m of valid) if (m.side === "pro" && isAhlOnly(m.id)) m.side = "farm";

  const pro = valid.filter((m) => m.side === "pro");
  const farm = valid.filter((m) => m.side === "farm");
  const goalies = (list: MoveRow[]) => list.filter((m) => byId.get(m.id)!.isGoalie).length;

  // rule: a one-way contract can't be sent DOWN — but only block a NEW demotion
  // (a player currently on the NHL roster moving to the farm). One-way players
  // already sitting on the farm are grandfathered, so they don't block unrelated
  // moves like a call-up.
  const goingDown = valid.filter((m) => m.side === "farm" || m.side === "scratched");
  const illegalFarm = goingDown.find((m) => m.contractType === "ONE_WAY" && byId.get(m.id)!.rosterType === "NHL");
  if (illegalFarm) throw new Error("A one-way contract player cannot be sent down.");

  // waivers ON → an NHL player must clear the waiver wire before he drops. Block a
  // direct bury-to-the-farm from the roster mover and point the GM at the wire.
  const settings = await loadSettings();
  if (settings.waiversEnabled) {
    const buried = goingDown.find((m) => byId.get(m.id)!.rosterType === "NHL");
    if (buried) throw new Error("Waivers are on — expose NHL players on the Waiver Wire before sending them down (they can't skip the wire).");
  }

  // Only HARD maxima block a save. Being under a minimum (short-handed pro roster)
  // is allowed — the farm auto-fills the missing bodies before each game, and a
  // call-up is usually the very move that fixes it.
  if (pro.length > ROSTER_LIMITS.proMax) throw new Error(`Pro roster over the ${ROSTER_LIMITS.proMax}-player cap limit.`);
  if (valid.length > ROSTER_LIMITS.orgMax) throw new Error(`Organization over ${ROSTER_LIMITS.orgMax} players (NHL + AHL).`);
  if (goalies(valid) > ROSTER_LIMITS.orgMaxGoalies) throw new Error(`Organization can hold at most ${ROSTER_LIMITS.orgMaxGoalies} goalies (NHL + AHL).`);

  // salary cap: the NET new NHL salary from this batch (call-ups minus send-downs)
  // must fit under the ceiling — same rule the single-player call-up enforces.
  let netAdd = 0;
  for (const m of valid) {
    const p = byId.get(m.id)!;
    const toNhl = m.side === "pro";
    const wasNhl = p.rosterType === "NHL";
    if (toNhl && !wasNhl) netAdd += p.capHit ?? 0;       // call-up adds cap
    else if (!toNhl && wasNhl) netAdd -= p.capHit ?? 0;  // send-down frees cap
  }
  if (netAdd > 0) {
    const cap = await canAddCapHit(team.id, netAdd);
    if (!cap.ok) throw new Error(`Call-ups blocked — ${team.name} has ${money(cap.status.space)} of cap space, this batch adds ${money(netAdd)}. Send a player down first.`);
  }

  await prisma.$transaction(valid.map((m) =>
    prisma.player.update({
      where: { id: m.id },
      data: {
        teamId: m.side === "pro" ? team.id : affiliate.id,
        rosterType: m.side === "pro" ? "NHL" : "AHL",
        scratched: m.side === "scratched",
        contractType: m.contractType,
      },
    })));

  revalidatePath(`/teams/${slug}/rosters`);
  revalidatePath(`/teams/${slug}`);
}
