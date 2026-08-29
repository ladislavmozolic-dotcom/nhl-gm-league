"use server";

import { prisma } from "@/lib/prisma";
import { canManageTeam } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { ROSTER_LIMITS, isNhlSide, isScratchSide, type MoveRow } from "@/lib/roster-rules";
import { canAddCapHit } from "@/lib/cap";
import { money } from "@/lib/finance";
import { loadSettings } from "@/lib/sim/settings";

export async function saveRosterMoves(slug: string, moves: MoveRow[]) {
  const team = await prisma.team.findUnique({
    where: { slug },
    include: { affiliateTeams: { select: { id: true } } },
  });
  if (!team) return { ok: false as const, error: "Team not found." };
  if (!(await canManageTeam(team.id))) return { ok: false as const, error: "You don't manage this team." };
  const affiliate = team.affiliateTeams[0];
  if (!affiliate) return { ok: false as const, error: "This team has no AHL affiliate to move players to." };

  // load real player rows for validation (position/goalie can't be spoofed by client)
  const ids = moves.map((m) => m.id);
  const players = await prisma.player.findMany({
    where: { id: { in: ids }, teamId: { in: [team.id, affiliate.id] } },
    select: { id: true, name: true, isGoalie: true, rosterType: true, capHit: true, contractType: true, contractText: true },
  });
  const byId = new Map(players.map((p) => [p.id, p]));
  const valid = moves.filter((m) => byId.has(m.id));

  // an AHL-only (minor-league) contract — exactly the $100k farm deal — can't be on
  // the NHL roster at all (dressed OR scratched). Keep him on the farm no matter what
  // the client requested. Anything else, including a two-way deal well below the real
  // NHL minimum ($600k-774k), is governed by contractType like every other player —
  // ONE_WAY/TWO_WAY, not the cap hit, decides whether he can be sent down.
  const isAhlOnly = (id: number) => { const p = byId.get(id)!; return (p.capHit ?? 0) === 100_000; };
  for (const m of valid) if (isNhlSide(m.side) && isAhlOnly(m.id)) m.side = "farm";

  const nhlRoster = valid.filter((m) => isNhlSide(m.side)); // dressed + scratched → cap + 23-limit
  const pro = valid.filter((m) => m.side === "pro");
  const goalies = (list: MoveRow[]) => list.filter((m) => byId.get(m.id)!.isGoalie).length;

  // rule: a one-way contract can't be sent DOWN — but only block a NEW demotion
  // (a player currently on the NHL roster moving to the farm). One-way players
  // already sitting on the farm are grandfathered, so they don't block unrelated
  // moves like a call-up.
  // use the DB contract type, NOT the client's — flipping the 1-way badge in the UI must
  // not let a one-way player be buried on the farm.
  // an AHL-only ($100k) contract is farm-bound no matter what — it overrides any
  // stale one-way flag, so it never triggers the send-down blocks below.
  const goingDown = valid.filter((m) => !isNhlSide(m.side)); // ending on the AHL (farm or farm-scratched)
  const illegalFarm = goingDown.find((m) => byId.get(m.id)!.contractType === "ONE_WAY" && byId.get(m.id)!.rosterType === "NHL" && !isAhlOnly(m.id));
  if (illegalFarm) return { ok: false as const, error: `${byId.get(illegalFarm.id)!.name} has a one-way contract — he can't be sent down. Keep him on the NHL roster.` };

  // waivers ON → a non-exempt NHL player must clear the waiver wire before he drops.
  // ELC and two-way contracts are waiver-exempt (sent down freely).
  const settings = await loadSettings();
  if (settings.waiversEnabled) {
    const buried = goingDown.find((m) => {
      const p = byId.get(m.id)!;
      const exempt = p.contractType === "TWO_WAY" || isAhlOnly(m.id) || /ELC/i.test(p.contractText ?? "");
      return p.rosterType === "NHL" && !exempt;
    });
    if (buried) return { ok: false as const, error: `Waivers are on — ${byId.get(buried.id)!.name} must clear the Waiver Wire before going down (ELC & two-way players are exempt).` };
  }

  // Only HARD maxima block a save. Being under a minimum (short-handed pro roster)
  // is allowed — the farm auto-fills the missing bodies before each game, and a
  // call-up is usually the very move that fixes it.
  if (nhlRoster.length > ROSTER_LIMITS.proMax) return { ok: false as const, error: `NHL roster over the ${ROSTER_LIMITS.proMax}-player limit (dressed + scratched).` };
  if (valid.length > ROSTER_LIMITS.orgMax) return { ok: false as const, error: `Organization over ${ROSTER_LIMITS.orgMax} players (NHL + AHL).` };
  if (goalies(valid) > ROSTER_LIMITS.orgMaxGoalies) return { ok: false as const, error: `Organization can hold at most ${ROSTER_LIMITS.orgMaxGoalies} goalies (NHL + AHL).` };

  // salary cap: the NET new NHL salary from this batch (call-ups minus send-downs)
  // must fit under the ceiling — same rule the single-player call-up enforces.
  let netAdd = 0;
  for (const m of valid) {
    const p = byId.get(m.id)!;
    const toNhl = isNhlSide(m.side); // dressed or NHL-scratched both sit on the cap
    const wasNhl = p.rosterType === "NHL";
    if (toNhl && !wasNhl) netAdd += p.capHit ?? 0;       // call-up adds cap
    else if (!toNhl && wasNhl) netAdd -= p.capHit ?? 0;  // send-down frees cap
  }
  if (netAdd > 0) {
    const cap = await canAddCapHit(team.id, netAdd);
    if (!cap.ok) return { ok: false as const, error: `Call-ups blocked — ${team.name} has ${money(cap.status.space)} of cap space, this batch adds ${money(netAdd)}. Send a player down first.` };
  }

  await prisma.$transaction(valid.map((m) =>
    prisma.player.update({
      where: { id: m.id },
      data: {
        teamId: isNhlSide(m.side) ? team.id : affiliate.id,
        rosterType: isNhlSide(m.side) ? "NHL" : "AHL",
        scratched: isScratchSide(m.side), // NHL-scratched + farm-scratched
        // contractType is a contract term — the roster mover does NOT change it (no
        // flipping 1-way → 2-way to bury a player).
      },
    })));

  revalidatePath(`/teams/${slug}/rosters`);
  revalidatePath(`/teams/${slug}`);
  return { ok: true as const };
}

/** Release a $100k minor-league (AHL-only) player to the UFA market. Only a $100k
 *  farm contract qualifies — real minor-league deals ($100k–775k) and NHL players
 *  can't be released this way. The player keeps his team id (schema requires one)
 *  but rosterType "UFA" drops him off every roster/depth view and onto the FA market. */
export async function releasePlayer(slug: string, playerId: number) {
  const team = await prisma.team.findUnique({
    where: { slug },
    include: { affiliateTeams: { select: { id: true } } },
  });
  if (!team) return { ok: false as const, error: "Team not found." };
  if (!(await canManageTeam(team.id))) return { ok: false as const, error: "You don't manage this team." };
  const orgIds = [team.id, ...team.affiliateTeams.map((a) => a.id)];

  const player = await prisma.player.findFirst({
    where: { id: playerId, teamId: { in: orgIds } },
    select: { id: true, name: true, capHit: true },
  });
  if (!player) return { ok: false as const, error: "Player isn't in your organization." };
  if (player.capHit !== 100_000) return { ok: false as const, error: "Only a $100k minor-league contract can be released." };

  await prisma.player.update({
    where: { id: player.id },
    data: { rosterType: "UFA", scratched: false, captaincy: null },
  });

  revalidatePath(`/teams/${slug}/rosters`);
  revalidatePath(`/teams/${slug}`);
  revalidatePath(`/teams/${slug}/depth-chart`);
  revalidatePath("/free-agents");
  return { ok: true as const, name: player.name };
}
