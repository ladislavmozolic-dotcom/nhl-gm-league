// 10 practice full seasons (in-memory, no DB writes). Each season = a balanced double
// round-robin (32 teams, 62 GP). Reports per-season winners, aggregate standings vs
// roster strength, calibration realism, scoring leaders, and flags anomalies.
//   npx tsx scripts/practice-10.ts [seasons]
import { prisma } from "../lib/prisma";
import { loadSimTeam } from "../lib/sim";
import { simulateGame } from "../lib/sim/engine";
import { loadSettings } from "../lib/sim/settings";
import type { SimTeam } from "../lib/sim/types";

const N = Number(process.argv[2] ?? 10);
const GP = 62; // double round-robin
const per82 = (v: number) => v * 82 / GP;

async function main() {
  const t0 = Date.now();
  const teams = await prisma.team.findMany({ where: { league: "NHL", isAffiliate: false }, select: { id: true, code: true, name: true } });
  const strength: Record<number, number> = {}, gOV: Record<number, number> = {};
  for (const t of teams) {
    const pl = await prisma.player.findMany({ where: { teamId: t.id }, select: { overall: true, isGoalie: true } });
    const sk = pl.filter((x) => !x.isGoalie && x.overall != null).map((x) => x.overall!).sort((a, b) => b - a).slice(0, 18);
    gOV[t.id] = pl.filter((x) => x.isGoalie && x.overall != null).map((x) => x.overall!).sort((a, b) => b - a)[0] ?? 0;
    strength[t.id] = (sk.reduce((a, b) => a + b, 0) / (sk.length || 1)) * 0.8 + gOV[t.id] * 0.2;
  }
  const sim = new Map<number, SimTeam>();
  for (const t of teams) sim.set(t.id, await loadSimTeam(t.id));
  const settings = await loadSettings();
  const codeOf = new Map(teams.map((t) => [t.id, t.code]));
  const nameOf = new Map(teams.map((t) => [t.id, t.name]));

  const seasonPts: Record<number, number[]> = {}; teams.forEach((t) => (seasonPts[t.id] = []));
  const pGoals: Record<number, number> = {}, pAst: Record<number, number> = {}, pGP: Record<number, number> = {};
  let TG = 0, TGames = 0, TSA = 0, TSaves = 0, homeW = 0, otGames = 0;
  const winners: { champ: string; champPts: number; spoon: string; spoonPts: number }[] = [];
  let seed = 1;

  for (let s = 0; s < N; s++) {
    const st: Record<number, { w: number; l: number; otl: number; pts: number; gf: number; ga: number }> = {};
    teams.forEach((t) => (st[t.id] = { w: 0, l: 0, otl: 0, pts: 0, gf: 0, ga: 0 }));
    for (const h of teams) for (const a of teams) {
      if (h.id === a.id) continue;
      const r = simulateGame(sim.get(h.id)!, sim.get(a.id)!, { seed: seed++, settings });
      st[h.id].gf += r.home.goals; st[h.id].ga += r.away.goals; st[a.id].gf += r.away.goals; st[a.id].ga += r.home.goals;
      TG += r.home.goals + r.away.goals; TGames++;
      if (r.endedIn !== "REG") otGames++;
      const lid = r.winner === h.id ? a.id : h.id;
      st[r.winner].w++; st[r.winner].pts += 2;
      if (r.endedIn !== "REG") { st[lid].otl++; st[lid].pts += 1; } else st[lid].l++;
      if (r.winner === h.id) homeW++;
      for (const box of [r.home, r.away]) {
        for (const sk of box.skaters) { pGoals[sk.id] = (pGoals[sk.id] || 0) + sk.goals; pAst[sk.id] = (pAst[sk.id] || 0) + sk.assists; if (sk.toi > 0) pGP[sk.id] = (pGP[sk.id] || 0) + 1; }
        TSA += box.goalie.shotsAgainst; TSaves += box.goalie.saves;
      }
    }
    teams.forEach((t) => seasonPts[t.id].push(st[t.id].pts));
    const ranked = [...teams].sort((a, b) => st[b.id].pts - st[a.id].pts);
    winners.push({ champ: nameOf.get(ranked[0].id)!, champPts: st[ranked[0].id].pts, spoon: nameOf.get(ranked[31].id)!, spoonPts: st[ranked[31].id].pts });
  }

  // aggregate
  const agg = teams.map((t) => {
    const arr = seasonPts[t.id]; const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
    return { id: t.id, code: t.code, avg82: per82(avg), min: Math.min(...arr), max: Math.max(...arr), str: +strength[t.id].toFixed(1), gOV: gOV[t.id] };
  });
  agg.sort((a, b) => b.avg82 - a.avg82); agg.forEach((r, i) => (r as any).pRank = i + 1);
  const byStr = [...agg].sort((a, b) => b.str - a.str); byStr.forEach((r, i) => (r as any).sRank = i + 1);
  const n = agg.length, d2 = agg.reduce((s, r) => s + ((r as any).pRank - (r as any).sRank) ** 2, 0);
  const spearman = 1 - (6 * d2) / (n * (n * n - 1));

  console.log(`\n============ ${N} PRACTICE SEASONS (${GP} GP double round-robin, ${N * n * (n - 1)} games, ${((Date.now() - t0) / 1000).toFixed(0)}s) ============`);
  console.log(`\n── CALIBRATION vs NHL targets ──`);
  console.log(`  goals/team/game: ${(TG / TGames / 2).toFixed(2)}   (target ~3.05)`);
  console.log(`  save%:           ${(TSaves / TSA).toFixed(3)}   (target ~0.905)`);
  console.log(`  home-win%:       ${(homeW / TGames).toFixed(3)}   (target ~0.545)`);
  console.log(`  OT/SO games:     ${(otGames / TGames * 100).toFixed(1)}%   (target ~23%)`);

  console.log(`\n── PER-SEASON: best & worst team ──`);
  winners.forEach((w, i) => console.log(`  S${String(i + 1).padStart(2)}: 🏆 ${w.champ.padEnd(22)} ${w.champPts}pts   ·   🥄 ${w.spoon.padEnd(22)} ${w.spoonPts}pts`));

  console.log(`\n── AGGREGATE STANDINGS (avg pts/82 over ${N} seasons) ── Spearman(strength,pts)=${spearman.toFixed(3)} ──`);
  console.log(`  #  Team  pts/82  range     strengthRank`);
  agg.forEach((r) => console.log(`  ${String((r as any).pRank).padStart(2)} ${r.code.padEnd(4)} ${r.avg82.toFixed(1).padStart(6)}  ${String(r.min).padStart(3)}-${String(r.max).padStart(3)}   #${(r as any).sRank} (${r.str})`));

  const top8 = byStr.slice(0, 8), bot8 = byStr.slice(-8);
  const avgPts = (rows: typeof agg) => rows.reduce((s, r) => s + r.avg82, 0) / rows.length;
  console.log(`\n── TOP-8 (by strength) vs BOTTOM-8 ──`);
  console.log(`  top-8 strength avg: ${avgPts(top8).toFixed(1)} pts/82   [${top8.map((r) => r.code).join(",")}]`);
  console.log(`  bot-8 strength avg: ${avgPts(bot8).toFixed(1)} pts/82   [${bot8.map((r) => r.code).join(",")}]`);
  console.log(`  gap: ${(avgPts(top8) - avgPts(bot8)).toFixed(1)} pts → top teams ${avgPts(top8) > avgPts(bot8) ? "clearly better ✓" : "NOT better ✗"}`);

  console.log(`\n── BIGGEST OVER / UNDER performers (pts rank vs strength rank) ──`);
  const dev = agg.map((r) => ({ code: r.code, d: (r as any).sRank - (r as any).pRank, p: (r as any).pRank, s: (r as any).sRank }));
  dev.sort((a, b) => b.d - a.d);
  console.log(`  over:  ${dev.slice(0, 4).map((x) => `${x.code}(pts#${x.p} str#${x.s})`).join("  ")}`);
  console.log(`  under: ${dev.slice(-4).map((x) => `${x.code}(pts#${x.p} str#${x.s})`).join("  ")}`);

  const scorers = teams.length ? Object.keys(pGoals).map(Number) : [];
  const pl = await prisma.player.findMany({ where: { id: { in: scorers } }, select: { id: true, name: true, position: true, overall: true } });
  const info = new Map(pl.map((p) => [p.id, p]));
  const leaders = scorers.map((id) => ({ id, g: pGoals[id] || 0, a: pAst[id] || 0, gp: pGP[id] || 0 }))
    .map((x) => ({ ...x, pts: x.g + x.a, g82: per82(x.g / (x.gp / N || 1) * (x.gp / N)), })) // total per season → per82
    .map((x) => ({ ...x, g82: per82(x.g / N), p82: per82((x.g + x.a) / N) }))
    .sort((a, b) => b.pts - a.pts).slice(0, 12);
  console.log(`\n── SCORING LEADERS (per-82 avg over ${N} seasons) ──`);
  leaders.forEach((x, i) => { const p = info.get(x.id); console.log(`  ${String(i + 1).padStart(2)}. ${(p?.name ?? "?").padEnd(22)} ${(p?.position ?? "").padEnd(6)} OV${p?.overall}  ${x.p82.toFixed(0)}pts (${x.g82.toFixed(0)}G ${(x.p82 - x.g82).toFixed(0)}A)/82`);
  });
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
