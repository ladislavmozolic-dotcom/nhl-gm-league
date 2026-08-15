// Quick Phase-1 sanity check: simulate a handful of NHL games in-memory and
// report the notable event-stream breakdown (no DB writes).
import { prisma } from "../lib/prisma";
import { loadSimTeam } from "../lib/sim";
import { simulateGame } from "../lib/sim/engine";
import { loadSettings } from "../lib/sim/settings";

async function main() {
  const teams = await prisma.team.findMany({ where: { league: "NHL" }, select: { id: true, name: true }, take: 8 });
  const settings = await loadSettings();
  const tally: Record<string, number> = {};
  let games = 0, totalGoals = 0;

  for (let i = 0; i + 1 < teams.length; i += 2) {
    const home = await loadSimTeam(teams[i].id);
    const away = await loadSimTeam(teams[i + 1].id);
    const r = simulateGame(home, away, { settings, seed: 1000 + i });
    games++;
    totalGoals += r.home.goals + r.away.goals;
    for (const e of r.events ?? []) tally[e.type] = (tally[e.type] ?? 0) + 1;
    // Print the first game's event stream as a play-by-play preview
    if (i === 0) {
      console.log(`\n=== ${teams[0].name} vs ${teams[1].name}  (${r.home.goals}-${r.away.goals}) ===`);
      for (const e of (r.events ?? []).slice(0, 14)) {
        const t = `P${e.period} ${String(Math.floor(e.seconds / 60)).padStart(2, "0")}:${String(e.seconds % 60).padStart(2, "0")}`;
        console.log(`  ${t}  [${e.importance.padEnd(9)}] ${e.type.padEnd(8)} ${e.teamCode ?? ""} ${e.playerName ?? ""}${e.type === "SHOT" || e.type === "SAVE" ? `  xg=${(e.xg ?? 0).toFixed(3)}` : ""}`);
      }
    }
  }

  console.log(`\n=== ${games} games — NOTABLE-and-above events persisted per game ===`);
  const perGame = (n: number) => (n / games).toFixed(1);
  for (const [k, v] of Object.entries(tally).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(9)} ${String(v).padStart(4)}  (${perGame(v)}/game)`);
  }
  console.log(`  goals/game (box): ${(totalGoals / games).toFixed(2)}`);
  await prisma.$disconnect();
}
main();
