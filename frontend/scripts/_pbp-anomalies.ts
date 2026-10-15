/* eslint-disable @typescript-eslint/no-explicit-any */
// Read-only: scan V3 games for sequences that look unreal. npx tsx scripts/_pbp-anomalies.ts [games=300] [seedBase=555000]
import { simulateGame } from "../lib/sim/engine";
import { loadSettings } from "../lib/sim/settings";
import { loadSimTeam } from "../lib/sim/index";
import { ENGINE_V3 } from "../lib/sim/version";
import { prisma } from "../lib/prisma";
(async () => {
  const n = Number(process.argv[2] ?? 300), seedBase = Number(process.argv[3] ?? 555000);
  const settings = await loadSettings();
  const ids = (await prisma.team.findMany({ where: { league: "NHL" }, select: { id: true }, orderBy: { id: "asc" } })).map((t) => t.id);
  const teams: any[] = []; for (const id of ids) teams.push(await loadSimTeam(id));
  const c: Record<string, number> = {}; const ex: Record<string, string> = {};
  const hit = (k: string, e: string) => { c[k] = (c[k] ?? 0) + 1; ex[k] ??= e; };
  for (let g = 0; g < n; g++) {
    const i = g % teams.length, j = (g * 7 + 3) % teams.length; if (i === j) continue;
    const r: any = simulateGame(structuredClone(teams[i]), structuredClone(teams[j]), { settings, seed: seedBase + g, engineVersion: ENGINE_V3 });
    const ev: any[] = (r.events ?? []).slice().sort((a, b) => (a.period - b.period) || (a.seconds - b.seconds) || (a.seq - b.seq));
    const abs = (e: any) => (e.period - 1) * 1200 + e.seconds;
    const att = ev.filter((e) => ["SHOT", "MISS", "BLOCK"].includes(e.type));
    for (let k = 1; k < att.length; k++) {
      const a = att[k - 1], b = att[k];
      if (a.playerId === b.playerId && abs(b) - abs(a) <= 2 && !b.meta?.rush && b.meta?.setup !== "rebound" && a.type !== "SHOT") hit("same shooter ≤2s (after miss/block)", `${g}: ${a.playerName} ${a.type}@${abs(a)} → ${b.type}@${abs(b)}`);
    }
    for (const t of ev.filter((e) => e.type === "TAKEAWAY")) if (att.some((a) => abs(t) - abs(a) >= 0 && abs(t) - abs(a) <= 3)) hit("takeaway ≤3s after an attempt", `${g}: ${t.playerName}@${abs(t)}`);
    const ent = ev.filter((e) => e.type === "ZONE_ENTRY");
    for (let k = 1; k < ent.length; k++) if (ent[k].teamId === ent[k - 1].teamId && abs(ent[k]) - abs(ent[k - 1]) <= 2 && ent[k].meta?.entryType !== "dump") hit("same team two entries ≤2s", `${g}: @${abs(ent[k - 1])},${abs(ent[k])}`);
    const goals = ev.filter((e) => e.type === "GOAL" && !e.meta?.so);
    for (const gl of goals) if (ev.some((e) => ["ZONE_ENTRY", "SHOT", "HIT", "BLOCK", "TAKEAWAY"].includes(e.type) && abs(e) === abs(gl) && e.seq > gl.seq)) hit("play event in the same second AFTER a goal", `${g}: goal@${abs(gl)}`);
    const hitsSame = ev.filter((e) => e.type === "HIT");
    for (let k = 1; k < hitsSame.length; k++) if (hitsSame[k].playerId === hitsSame[k - 1].playerId && abs(hitsSame[k]) - abs(hitsSame[k - 1]) <= 1) hit("same player two hits ≤1s", `${g}: ${hitsSame[k].playerName}@${abs(hitsSame[k])}`);
    if (ev.filter((e) => e.type === "PRESSURE").length > 9) hit("more than 9 pressure lines", `${g}`);
    if (r.endedIn === "REG" && Math.abs(r.home.goals - r.away.goals) === 0) hit("tied after regulation but REG", `${g}`);
  }
  console.log(`${n} games scanned`); for (const k of Object.keys(c)) console.log(`${String(c[k]).padStart(5)}  ${k}   e.g. ${ex[k]}`);
  if (!Object.keys(c).length) console.log("no anomalies found");
  await prisma.$disconnect();
})();
