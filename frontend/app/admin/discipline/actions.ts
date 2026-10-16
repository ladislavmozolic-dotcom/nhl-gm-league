"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/auth";
import { reviewGames } from "@/lib/discipline-server";
import { REGULAR_SEASON } from "@/lib/phase";

/** Admin: re-run the Player Safety review for the NHL regular-season games of one calendar day (YYYY-MM-DD).
 *  Safe to repeat — a player who already has a ruling for that game is skipped — so it can repair a day that was
 *  simulated by a path that skipped the review. It does NOT credit games toward active suspensions (that part is not
 *  repeat-safe and the nightly sim / manual Sim Next Day already do it). */
export async function reviewDayAction(iso: string): Promise<{ ok: boolean; error?: string; games?: number; suspensions?: number; fines?: number }> {
  if (!(await isAdmin())) return { ok: false, error: "Admin only." };
  const d = new Date(`${iso}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || isNaN(d.getTime())) return { ok: false, error: "Invalid date." };
  const end = new Date(d.getTime() + 24 * 3_600_000);
  const games = await prisma.game.findMany({
    where: { season: REGULAR_SEASON, league: "NHL", status: "FINAL", seriesId: null, gameDate: { gte: d, lt: end } },
    select: { id: true },
  });
  if (!games.length) return { ok: false, error: "No finished NHL regular-season games on that date." };
  const r = await reviewGames(games.map((g) => g.id));
  revalidatePath("/admin/discipline");
  revalidatePath("/league/player-safety");
  return { ok: true, games: games.length, suspensions: r.suspensions, fines: r.fines };
}
