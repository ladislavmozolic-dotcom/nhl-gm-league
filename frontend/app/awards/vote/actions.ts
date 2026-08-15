"use server";

import { prisma } from "@/lib/prisma";
import { getTeamSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { buildBallots, awardByKey, pointsForPicks } from "@/lib/award-voting";

/** A GM submits (or updates) their ranked ballot for one category. rankedKeys are
 *  candidate keys ("p<id>" / "t<id>") in the GM's preference order, best first. */
export async function submitBallotAction(season: string, league: string, category: string, rankedKeys: string[]) {
  const voterTeamId = await getTeamSession();
  if (voterTeamId == null) return { ok: false, error: "Not signed in as a GM." };

  const voting = await prisma.awardVoting.findUnique({ where: { season_league: { season, league } } });
  if (!voting || voting.status !== "OPEN") return { ok: false, error: "Voting is not open." };

  const award = awardByKey(category);
  if (!award) return { ok: false, error: "Unknown award." };

  const ballots = await buildBallots(season, league);
  const cands = ballots[category] ?? [];
  const byKey = new Map(cands.map((c) => [c.key, c]));

  // validate: within pick limit, no dupes, all real ballot candidates
  const picked = rankedKeys.filter((k, i) => rankedKeys.indexOf(k) === i).slice(0, award.picks);
  const valid = picked.filter((k) => byKey.has(k));
  if (valid.length === 0) return { ok: false, error: "Pick at least one candidate." };

  const pts = pointsForPicks(award.picks);
  const rows = valid.map((k, i) => {
    const c = byKey.get(k)!;
    return { season, league, category, voterTeamId, rank: i + 1, points: pts[i], playerId: c.playerId ?? null, teamId: c.kind === "team" ? c.teamId ?? null : null, isAi: false };
  });

  await prisma.$transaction([
    prisma.awardVote.deleteMany({ where: { season, league, category, voterTeamId } }),
    prisma.awardVote.createMany({ data: rows }),
  ]);
  revalidatePath("/awards/vote");
  return { ok: true, saved: rows.length };
}
