// One-shot fresh re-simulation of the whole season (NHL + AHL), mirroring the admin
// Season Control flow: reset → generate schedules → play → run playoffs → summary.
//   npx tsx scripts/resim-season.ts
import { prisma } from "../lib/prisma";
import { generateSchedule } from "../lib/sim/schedule";
import { mirrorAhlSchedule } from "../lib/sim/ahl";
import { playScheduledGames, resetConditions } from "../lib/sim/season";
import { runPlayoffs } from "../lib/sim/playoffs";
import { computeStandings } from "../lib/sim/standings";

const SEASON = "2026-27";
const nameOf = async (id: number | null) =>
  id ? (await prisma.team.findUnique({ where: { id }, select: { name: true } }))?.name ?? "?" : "—";

async function main() {
  const t0 = Date.now();
  console.log(`── Fresh re-sim: ${SEASON} ──`);

  // reset season state (generateSchedule wipes Game rows; clear series + stale injuries)
  await prisma.playoffSeries.deleteMany({ where: { season: SEASON } });
  await prisma.player.updateMany({ where: { injuryDaysLeft: { not: 0 } }, data: { injuryDaysLeft: 0, injuryDesc: null } });

  const g = await generateSchedule(SEASON, { gamesPerTeam: 82 });
  console.log(`NHL schedule: ${g.games} games · ${g.gamesPerTeam}/team · ${g.rounds} rounds`);
  const a = await mirrorAhlSchedule(SEASON).catch((e) => { console.log("AHL schedule skipped:", e.message); return null; });
  if (a) console.log(`AHL schedule: ${JSON.stringify(a)}`);
  await resetConditions();

  console.log("Playing regular season…");
  let n = 0;
  const { played } = await playScheduledGames({ season: SEASON, onGame: () => { if (++n % 200 === 0) process.stdout.write(`  …${n} games\r`); } });
  console.log(`\nPlayed ${played} regular-season games in ${((Date.now() - t0) / 1000).toFixed(0)}s`);

  console.log("Running playoffs…");
  const nhl = await runPlayoffs(SEASON, "NHL");
  const ahl = await runPlayoffs(SEASON, "AHL").catch((e) => { console.log("AHL playoffs skipped:", e.message); return { championTeamId: null as number | null }; });

  // freeze awards + season-record + the career/franchise stat archive
  const { archiveSeason } = await import("../lib/awards");
  await archiveSeason(SEASON, "NHL").catch((e) => console.log("archive NHL skipped:", e.message));
  await archiveSeason(SEASON, "AHL").catch((e) => console.log("archive AHL skipped:", e.message));
  console.log("Archived awards + season stats.");

  // ── summary ──
  const std = await computeStandings(SEASON, "NHL");
  console.log("\n=== NHL — top 6 ===");
  std.slice(0, 6).forEach((s, i) => console.log(`${i + 1}. ${s.name.padEnd(22)} ${String(s.points).padStart(3)}pts  ${s.w}-${s.l}-${s.otl}  GF${s.gf} GA${s.ga}`));

  const scorers = await prisma.playerGameStat.groupBy({
    by: ["playerId"], where: { game: { season: SEASON, status: "FINAL", seriesId: null } },
    _sum: { goals: true, assists: true, points: true }, _count: { _all: true },
    orderBy: { _sum: { points: "desc" } }, take: 8,
  });
  const pIds = scorers.map((s) => s.playerId);
  const players = await prisma.player.findMany({ where: { id: { in: pIds } }, select: { id: true, name: true, position: true } });
  const pOf = new Map(players.map((p) => [p.id, p]));
  console.log("\n=== NHL scoring leaders ===");
  scorers.forEach((s, i) => { const p = pOf.get(s.playerId); console.log(`${i + 1}. ${(p?.name ?? "?").padEnd(22)} ${p?.position ?? ""}  ${s._sum.points}pts (${s._sum.goals}G ${s._sum.assists}A) · ${s._count._all}GP`); });

  console.log(`\n🏆 NHL champion: ${await nameOf(nhl.championTeamId)}   ·   AHL champion: ${await nameOf(ahl.championTeamId)}`);
  const ev = await prisma.game.groupBy({ by: ["engineVersion"], where: { season: SEASON, status: "FINAL" }, _count: { _all: true } });
  console.log("engineVersion stamps:", JSON.stringify(ev.map((x) => ({ v: x.engineVersion, n: x._count._all }))));
  console.log(`✅ Done in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
