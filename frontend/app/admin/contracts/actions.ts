"use server";

import { prisma } from "@/lib/prisma";
import { isAdmin, isComishOrCoComish } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { SKATER_FIELDS } from "@/lib/skater-fields";

const slugify = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

/** Comish/Co-Comish only: create a player from scratch — bio + contract + (for a
 *  skater) all rating parameters, entered by hand. For a real player missing from
 *  the DB (the usual case) or a purely fictional one. Goalie ratings aren't set
 *  here (no admin editor for them exists yet — same gap as /admin/ratings). */
export async function createPlayer(formData: FormData) {
  if (!(await isComishOrCoComish())) throw new Error("Only the Comish or Co-Comish can do this.");
  const str = (k: string) => { const v = formData.get(k); return v && String(v).trim() ? String(v).trim() : null; };
  const num = (k: string) => { const v = formData.get(k); return v && String(v).trim() !== "" ? Number(v) : null; };

  const name = str("name");
  const teamId = num("teamId");
  const position = str("position");
  if (!name || !teamId || !position) throw new Error("Name, team and position are required.");
  const isGoalie = formData.get("isGoalie") === "on";

  const base = slugify(name) || "player";
  let slug = base;
  for (let i = 2; await prisma.player.findUnique({ where: { slug }, select: { id: true } }); i++) slug = `${base}-${i}`;

  const heightCm = num("heightCm");
  const capHit = num("capHit");
  const contractYears = num("contractYears");

  const data: Record<string, unknown> = {
    slug, name, position, isGoalie,
    teamId, rosterType: str("rosterType") ?? "NHL",
    nationality: str("nationality"), shoots: str("shoots"),
    height: heightCm ? `${heightCm} cm` : null, weight: num("weightKg"),
    birthDate: str("birthDate"), number: num("number"),
    capHit, contractYears, contractType: str("contractType"),
    contractText: capHit ? `${capHit.toLocaleString("en-US")}$ / ${contractYears ?? 0}yr${contractYears === 1 ? "" : "s"}` : null,
    condition: 100, morale: 50,
  };
  if (!isGoalie) {
    for (const f of SKATER_FIELDS) {
      const v = num(f);
      if (v != null) data[f] = Math.max(20, Math.min(99, Math.round(v)));
    }
  }

  await prisma.player.create({ data: data as Parameters<typeof prisma.player.create>[0]["data"] });
  revalidatePath("/admin/contracts");
  redirect(`/admin/contracts/${slug}?saved=1`);
}

/** Admin: set a player's salary (cap hit, in dollars) and contract length. When
 *  the Agent signing flow lands it will write these automatically; this is the
 *  manual override. Regenerates the display contract string too. */
export async function updateContract(formData: FormData) {
  if (!(await isAdmin())) throw new Error("Only a league admin can edit contracts.");
  const slug = String(formData.get("slug") ?? "");
  // any exact dollar amount — real contracts aren't all round 50k multiples (e.g. $1,325,000)
  const capHit = Math.max(0, Math.round(Number(formData.get("capHit")) || 0));
  const contractYears = Math.max(0, Math.round(Number(formData.get("contractYears")) || 0));
  const expiryRaw = formData.get("contractExpiry");
  const contractExpiry = expiryRaw && String(expiryRaw).trim() ? Number(expiryRaw) : null;
  const contractTypeRaw = String(formData.get("contractType") ?? "");
  const contractType = contractTypeRaw === "ONE_WAY" || contractTypeRaw === "TWO_WAY" ? contractTypeRaw : null;
  // keep the shown contract string in sync (e.g. "9,000,000$ / 2yrs")
  const contractText = capHit ? `${capHit.toLocaleString("en-US")}$ / ${contractYears}yr${contractYears === 1 ? "" : "s"}` : null;

  await prisma.player.update({
    where: { slug },
    data: { capHit, contractYears, contractExpiry, contractText, contractType },
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

/** Comish/Co-Comish only: permanently delete a player — irreversible. Clears the
 *  FK-constrained per-game/rating rows first (SkaterRating/GoalieRating are 1:1
 *  side tables; PlayerGameStat/GoalieGameStat are his box-score history) so the
 *  delete doesn't fail on a veteran with games played. Loosely-referenced data
 *  (GameEvent.playerId, trade history, etc. — plain ints, no FK) is left orphaned
 *  by design, same as any other roster departure. */
export async function deletePlayer(slug: string) {
  if (!(await isComishOrCoComish())) throw new Error("Only the Comish or Co-Comish can do this.");
  const player = await prisma.player.findFirst({ where: { slug }, select: { id: true } });
  if (!player) throw new Error("Player not found.");
  await prisma.$transaction([
    prisma.skaterRating.deleteMany({ where: { playerId: player.id } }),
    prisma.goalieRating.deleteMany({ where: { playerId: player.id } }),
    prisma.playerGameStat.deleteMany({ where: { playerId: player.id } }),
    prisma.goalieGameStat.deleteMany({ where: { playerId: player.id } }),
    prisma.player.delete({ where: { id: player.id } }),
  ]);
  revalidatePath("/admin/contracts");
  redirect("/admin/contracts?deleted=1");
}
