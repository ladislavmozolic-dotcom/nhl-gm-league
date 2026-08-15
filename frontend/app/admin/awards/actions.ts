"use server";

import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { generateAiBallots, resolveAwardVoting } from "@/lib/award-voting";

async function guard() {
  if (!(await isAdmin())) throw new Error("Admin only.");
}

/** Open voting: create the window and seed stat-based AI ballots for every club
 *  (human GMs then override their own). Idempotent — AI ballots only fill blanks. */
export async function openVotingAction(season: string, league = "NHL") {
  await guard();
  await prisma.awardVoting.upsert({
    where: { season_league: { season, league } },
    update: { status: "OPEN" },
    create: { season, league, status: "OPEN" },
  });
  const r = await generateAiBallots(season, league);
  revalidatePath("/admin/awards"); revalidatePath("/awards/vote");
  return { ok: true, aiBallots: r.created };
}

export async function closeVotingAction(season: string, league = "NHL") {
  await guard();
  await prisma.awardVoting.update({ where: { season_league: { season, league } }, data: { status: "CLOSED" } });
  revalidatePath("/admin/awards"); revalidatePath("/awards/vote");
  return { ok: true };
}

/** Resolve: tally the ballot into official winners, archive the season, mark RESOLVED. */
export async function resolveVotingAction(season: string, league = "NHL") {
  await guard();
  const r = await resolveAwardVoting(season, league);
  revalidatePath("/admin/awards"); revalidatePath("/awards"); revalidatePath("/history");
  return { ok: true, awards: r.awards };
}

/** Re-seed AI ballots from scratch (wipes AI votes, keeps human ballots). */
export async function regenerateAiAction(season: string, league = "NHL") {
  await guard();
  await prisma.awardVote.deleteMany({ where: { season, league, isAi: true } });
  const r = await generateAiBallots(season, league);
  revalidatePath("/admin/awards");
  return { ok: true, aiBallots: r.created };
}
