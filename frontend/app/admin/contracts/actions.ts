"use server";

import { prisma } from "@/lib/prisma";
import { isAdmin, isComishOrCoComish } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

/** Admin: set a player's salary (cap hit, in dollars) and contract length. When
 *  the Agent signing flow lands it will write these automatically; this is the
 *  manual override. Regenerates the display contract string too. */
export async function updateContract(formData: FormData) {
  if (!(await isAdmin())) throw new Error("Only a league admin can edit contracts.");
  const slug = String(formData.get("slug") ?? "");
  // salaries move in 50k steps (so a half-retained deal lands cleanly, e.g. 8.1M → 4.05M)
  const capHit = Math.max(0, Math.round((Number(formData.get("capHit")) || 0) / 50000) * 50000);
  const contractYears = Math.max(0, Math.round(Number(formData.get("contractYears")) || 0));
  const expiryRaw = formData.get("contractExpiry");
  const contractExpiry = expiryRaw && String(expiryRaw).trim() ? Number(expiryRaw) : null;
  // keep the shown contract string in sync (e.g. "9,000,000$ / 2yrs")
  const contractText = capHit ? `${capHit.toLocaleString("en-US")}$ / ${contractYears}yr${contractYears === 1 ? "" : "s"}` : null;

  await prisma.player.update({
    where: { slug },
    data: { capHit, contractYears, contractExpiry, contractText },
  });

  for (const p of ["/admin/contracts", `/admin/contracts/${slug}`, "/salary-cap", `/players/${slug}`]) revalidatePath(p);
  redirect(`/admin/contracts/${slug}?saved=1`);
}

/** Comish/Co-Comish only: park a player on Long-Term Injured Reserve — pulls him off
 *  his roster onto the reserve/prospects list (rosterType "PROSPECT"), flagged ltir,
 *  off the cap. Same end state the post-season reconciliation parks a low-GP player
 *  into (lib/roster-reconcile.ts), but triggerable any time — e.g. a real player who
 *  simply has no games logged in our league yet. Reversed by activateFromReserve. */
export async function markLtir(slug: string) {
  if (!(await isComishOrCoComish())) throw new Error("Only the Comish or Co-Comish can do this.");
  const player = await prisma.player.findFirst({ where: { slug }, select: { id: true } });
  if (!player) throw new Error("Player not found.");
  await prisma.player.update({
    where: { id: player.id },
    data: { rosterType: "PROSPECT", ltir: true, scratched: false, captaincy: null },
  });
  for (const p of ["/admin/contracts", `/admin/contracts/${slug}`, "/salary-cap"]) revalidatePath(p);
  redirect(`/admin/contracts/${slug}?saved=1`);
}

/** Comish/Co-Comish only: send a player to the reserve/prospects list without the
 *  LTIR flag — for someone who's left the NHL roster but could come back later
 *  (unlike markLtir, no injury implication; unlike releasePlayer, still off the cap
 *  rather than a free agent). */
export async function sendToProspects(slug: string) {
  if (!(await isComishOrCoComish())) throw new Error("Only the Comish or Co-Comish can do this.");
  const player = await prisma.player.findFirst({ where: { slug }, select: { id: true } });
  if (!player) throw new Error("Player not found.");
  await prisma.player.update({
    where: { id: player.id },
    data: { rosterType: "PROSPECT", ltir: false, scratched: false, captaincy: null },
  });
  for (const p of ["/admin/contracts", `/admin/contracts/${slug}`, "/salary-cap"]) revalidatePath(p);
  redirect(`/admin/contracts/${slug}?saved=1`);
}

/** Comish/Co-Comish only: reverse of markLtir/sendToProspects — bring a reserve
 *  player back onto the active roster (NHL or AHL). If his current team row is an
 *  AHL affiliate, "NHL" moves him up to the parent club; if it's a parent club,
 *  "AHL" moves him down to its affiliate. */
export async function activateFromReserve(slug: string, to: "NHL" | "AHL") {
  if (!(await isComishOrCoComish())) throw new Error("Only the Comish or Co-Comish can do this.");
  const player = await prisma.player.findFirst({
    where: { slug },
    select: { id: true, team: { select: { parentTeamId: true, affiliateTeams: { select: { id: true } } } } },
  });
  if (!player) throw new Error("Player not found.");
  const data: { rosterType: string; ltir: boolean; scratched: boolean; teamId?: number } = {
    rosterType: to, ltir: false, scratched: false,
  };
  if (to === "NHL" && player.team.parentTeamId) data.teamId = player.team.parentTeamId;
  if (to === "AHL" && player.team.affiliateTeams[0]) data.teamId = player.team.affiliateTeams[0].id;
  await prisma.player.update({ where: { id: player.id }, data });
  for (const p of ["/admin/contracts", `/admin/contracts/${slug}`, "/salary-cap"]) revalidatePath(p);
  redirect(`/admin/contracts/${slug}?saved=1`);
}
