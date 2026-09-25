// One-off / idempotent: real NHL retired numbers, the 2026-27 special games, and a first odds snapshot.
// Run: npx tsx scripts/seed-season-extras.ts
import { seedHistoricRetiredNumbers } from "../lib/retired-numbers-server";
import { applyRealSpecialGames } from "../lib/special-games";
import { refreshPlayoffOdds } from "../lib/playoff-odds";
import { prisma } from "../lib/prisma";
(async () => {
  console.log("retired", await seedHistoricRetiredNumbers());
  console.log("special", await applyRealSpecialGames());
  const cfg = await prisma.leagueConfig.findUnique({ where: { id: 1 }, select: { leagueDate: true } });
  const d = await refreshPlayoffOdds(cfg?.leagueDate ?? new Date());
  console.log("odds", d ? d.rows.length : null);
  process.exit(0);
})();
