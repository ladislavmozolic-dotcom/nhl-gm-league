/* eslint-disable @typescript-eslint/no-explicit-any */
// Read-only: V3 with vs without in-play hits/blocks/takeaways on identical seeds (every ordered pair of the 32 NHL clubs).
// Totals that must stay put: goals, shots, PIM. Targets per team-game: hits ≈21, blocks ≈14, takeaways ≈7.
// Run: npx tsx scripts/play-events-check.ts [bases=1] [seedBase=31000000]
import { simulateGame, PACE_TUNING, PIN_TUNING } from "../lib/sim/engine";
import { loadSettings } from "../lib/sim/settings";
import { loadSimTeam } from "../lib/sim/index";
import { ENGINE_V3 } from "../lib/sim/version";
import { prisma } from "../lib/prisma";

const FLAG = process.env.FLAG ?? "playEvents"; // which V3 flag the two arms differ by
if (process.argv[4]) Object.assign(process.env.TUNE === "pin" ? PIN_TUNING : PACE_TUNING, JSON.parse(process.argv[4]));
const bases = Number(process.argv[2] ?? 1), seedBase = Number(process.argv[3] ?? 31_000_000);
const fresh = () => ({ games: 0, goals: 0, shots: 0, pim: 0, hits: 0, blocks: 0, takes: 0, hitEv: 0, blockEv: 0, ot: 0, closeTake: 0, entries: 0, fastEntryShot: 0, takeAfterShot: 0, killFast: 0, rushKill: 0, fav: 0, pressure: 0, maxPin: 0, tiredPress: 0, longShift: 0 });

(async () => {
  const settings = await loadSettings();
  const ids = (await prisma.team.findMany({ where: { league: "NHL" }, select: { id: true }, orderBy: { id: "asc" } })).map((t) => t.id);
  const teams: Awaited<ReturnType<typeof loadSimTeam>>[] = [];
  for (const id of ids) teams.push(await loadSimTeam(id));
  const arms = { off: fresh(), on: fresh() };
  for (let b = 0; b < bases; b++) for (let i = 0; i < teams.length; i++) for (let j = 0; j < teams.length; j++) {
    if (i === j) continue;
    for (const arm of ["off", "on"] as const) {
      const r: any = simulateGame(structuredClone(teams[i]), structuredClone(teams[j]), { settings, seed: seedBase + b * 100_000 + i * 100 + j, engineVersion: ENGINE_V3, experimentalV3: { [FLAG]: arm === "on" } as any });
      const a = arms[arm]; a.games++;
      a.goals += r.home.goals + r.away.goals; a.shots += r.home.shots + r.away.shots; a.pim += r.home.pim + r.away.pim;
      a.hits += r.home.hits + r.away.hits; a.blocks += r.home.blocks + r.away.blocks; a.ot += r.endedIn !== "REG" ? 1 : 0;
      const ev: any[] = r.events ?? [];
      a.takes += ev.filter((e) => e.type === "TAKEAWAY").length;
      const tk = ev.filter((e) => e.type === "TAKEAWAY").map((e) => (e.period - 1) * 1200 + e.seconds).sort((x, y) => x - y);
      { const fav = teams[i].avgOV >= teams[j].avgOV ? teams[i].id : teams[j].id; a.fav += r.winner === fav ? 1 : 0; }
      a.pressure += ev.filter((e) => e.type === "PRESSURE").length; a.tiredPress += ev.filter((e) => e.type === "PRESSURE" && e.meta?.tired).length;
      const abs = (e: any) => (e.period - 1) * 1200 + e.seconds;
      const att = ev.filter((e) => e.type === "SHOT" || e.type === "MISS" || e.type === "BLOCK" || e.type === "GOAL");
      for (const e of ev) {
        if (e.type === "ZONE_ENTRY") { a.entries++; if (att.some((x) => x.teamId === e.teamId && abs(x) >= abs(e) && abs(x) - abs(e) <= 2 && !x.meta?.rush)) a.fastEntryShot++; }
        if (e.type === "TAKEAWAY" && att.some((x) => abs(e) - abs(x) >= 0 && abs(e) - abs(x) <= 5)) a.takeAfterShot++;
        if (e.type === "RUSH" && (e.meta?.outcome === "backchecked" || e.meta?.outcome === "pass-broken")) { a.rushKill++; if (att.some((x) => x.teamId !== e.teamId && abs(x) >= abs(e) && abs(x) - abs(e) <= 4)) a.killFast++; }
      }
      for (let k = 1; k < tk.length; k++) if (tk[k] - tk[k - 1] <= 3) a.closeTake++;
    }
  }
  for (const [k, a] of Object.entries(arms)) {
    const tg = a.games * 2;
    console.log(k.padEnd(4), `games ${a.games}`, `goals/g ${(a.goals / a.games).toFixed(2)}`, `shots/tg ${(a.shots / tg).toFixed(1)}`, `pim/g ${(a.pim / a.games).toFixed(1)}`, `OT ${(100 * a.ot / a.games).toFixed(1)}%`,
      `| hits/tg ${(a.hits / tg).toFixed(1)}`, `blocks/tg ${(a.blocks / tg).toFixed(1)}`, `takeaways/tg ${(a.takes / tg).toFixed(1)}`, `| entries/tg ${(a.entries / tg).toFixed(1)} entry→shot ≤2s ${(100 * a.fastEntryShot / Math.max(1, a.entries)).toFixed(1)}%`, `fav wins ${(100 * a.fav / a.games).toFixed(1)}%`, `pressure/g ${(a.pressure / a.games).toFixed(2)} (tired ${(a.tiredPress / a.games).toFixed(2)})`, `takeaway ≤5s after a shot /g ${(a.takeAfterShot / a.games).toFixed(2)}`, `rush killed→opp shot ≤4s ${(100 * a.killFast / Math.max(1, a.rushKill)).toFixed(0)}% of ${a.rushKill}`);
  }
  await prisma.$disconnect();
})();
