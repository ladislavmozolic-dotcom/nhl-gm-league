// CLI: seed and play the full playoff, then print the bracket.
//   npx tsx scripts/sim-playoffs.ts

import { prisma } from "../lib/prisma";
import { runPlayoffs, getBracket, roundName } from "../lib/sim/playoffs";

const SEASON = "2026-27";
const pad = (s: string, n: number) => s.length > n ? s.slice(0, n) : s.padEnd(n);

async function main() {
  console.log("Seeding & playing the playoffs...");
  const t0 = Date.now();
  await runPlayoffs(SEASON);

  const bracket = await getBracket(SEASON);
  const byRound = new Map<number, typeof bracket>();
  for (const s of bracket) {
    const arr = byRound.get(s.round) ?? [];
    arr.push(s); byRound.set(s.round, arr);
  }
  for (const round of [...byRound.keys()].sort((a, b) => a - b)) {
    console.log(`\n=== ${roundName(round)} ===`);
    for (const s of byRound.get(round)!) {
      const m = (id: number) => (id === s.winnerTeamId ? "✓" : " ");
      const conf = s.conference ? ` [${s.conference.replace(" Conference", "")}]` : "";
      console.log(`  ${m(s.high.id)} (${s.highSeed}) ${pad(s.high.name, 22)} ${s.highWins}-${s.lowWins}  (${s.lowSeed}) ${pad(s.low.name, 22)} ${m(s.low.id)}${conf}`);
    }
  }
  const champId = bracket.find((s) => s.round === 4)?.winnerTeamId;
  const champ = champId ? await prisma.team.findUnique({ where: { id: champId }, select: { name: true } }) : null;
  console.log(`\n🏆 Champion: ${champ?.name ?? "?"}   (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
