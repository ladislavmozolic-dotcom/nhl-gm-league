// In-memory distribution harness: sim a mini round-robin, aggregate per-player
// goals/assists/points, scale to an 82-game season, report top scorers + D dist.
//   npx tsx scripts/dist-harness.ts [perPair]
import { prisma } from "../lib/prisma";
import { loadSimTeam } from "../lib/sim";
import { simulateGame } from "../lib/sim/engine";
import type { SimTeam } from "../lib/sim/types";

const isD = (p: string) => /(^|\/)D(\/|$)/.test((p || "").toUpperCase());

async function main() {
  const perPair = Number(process.argv[2] ?? 1);
  const teams = await prisma.team.findMany({ where: { league: "NHL", isAffiliate: false }, select: { id: true } });
  const sims: SimTeam[] = [];
  for (const t of teams) { try { sims.push(await loadSimTeam(t.id)); } catch {} }

  type Agg = { name: string; pos: string; g: number; a: number; pts: number; games: number };
  const agg = new Map<number, Agg>();
  const teamGames = new Map<number, number>();
  let totGoals = 0, teamGameCount = 0;

  for (let i = 0; i < sims.length; i++) for (let j = 0; j < sims.length; j++) {
    if (i === j) continue;
    for (let g = 0; g < perPair; g++) {
      const r = simulateGame(sims[i], sims[j], { seed: (i * 1000 + j) * 31 + g });
      for (const box of [r.home, r.away]) {
        totGoals += box.goals; teamGameCount++;
        for (const s of box.skaters) {
          const a = agg.get(s.id) ?? { name: s.name, pos: s.position, g: 0, a: 0, pts: 0, games: 0 };
          a.g += s.goals; a.a += s.assists; a.pts += s.points; a.games++;
          agg.set(s.id, a);
        }
      }
    }
  }

  // scale each player to 82 games
  const scaled = [...agg.values()].filter(a => a.games >= 3).map(a => ({
    name: a.name, pos: a.pos,
    G: Math.round(a.g * 82 / a.games), A: Math.round(a.a * 82 / a.games), P: Math.round(a.pts * 82 / a.games),
  }));
  const byPts = [...scaled].sort((x, y) => y.P - x.P);
  console.log(`gpg/team ${(totGoals / teamGameCount).toFixed(3)}`);
  console.log("\n=== TOP SCORERS (scaled to 82) ===");
  for (const s of byPts.slice(0, 8)) console.log(`${s.P}pts (${s.G}G ${s.A}A) ${s.pos} ${s.name}`);
  const ds = scaled.filter(s => isD(s.pos)).sort((x, y) => y.G - x.G);
  console.log("\n=== D GOALS ===");
  console.log("top6 D:", ds.slice(0, 6).map(s => s.G).join(","));
  console.log("D 10+:", ds.filter(s => s.G >= 10).length, "| 20+:", ds.filter(s => s.G >= 20).length, "| #50 D:", ds[49]?.G);
  await prisma.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
