// Full-season practice sim from the CURRENT rosters (in-memory, no DB writes).
// Plays every still-scheduled regular-season NHL game on top of the games already FINAL.
//   DATABASE_URL=... npx tsx scripts/season-forecast.ts [runs]
import { prisma } from "../lib/prisma";
import { loadSimTeam } from "../lib/sim";
import { simulateGame } from "../lib/sim/engine";
import { loadSettings } from "../lib/sim/settings";
import { computeStandings } from "../lib/sim/standings";
import type { SimTeam } from "../lib/sim/types";

const RUNS = Number(process.argv[2] ?? 20);
type Row = { w: number; l: number; otl: number; row: number; gf: number; ga: number; gp: number };

async function main() {
  const teams = await prisma.team.findMany({ where: { league: "NHL", isAffiliate: false }, select: { id: true, code: true, name: true, conference: true, division: true } });
  const sim = new Map<number, SimTeam>();
  for (const t of teams) sim.set(t.id, await loadSimTeam(t.id));
  const settings = await loadSettings();
  if (process.env.PARITY) settings.parityPct = Number(process.env.PARITY);
  if (process.env.VARIANCE) settings.gameVariancePct = Number(process.env.VARIANCE);
  const base = await computeStandings("2026-27", "NHL");
  const remaining = await prisma.game.findMany({
    where: { season: "2026-27", league: "NHL", status: "SCHEDULED", seriesId: null },
    orderBy: [{ gameDate: "asc" }, { id: "asc" }], select: { homeTeamId: true, awayTeamId: true },
  });
  console.log(`teams ${teams.length} · played ${base.reduce((a, b) => a + b.gp, 0) / 2} · remaining ${remaining.length}`);

  const runs: Record<number, Row>[] = [];
  let seed = 424242;
  for (let r = 0; r < RUNS; r++) {
    const tb: Record<number, Row> = {};
    for (const b of base) tb[b.teamId] = { w: b.w, l: b.l, otl: b.otl, row: b.row, gf: b.gf, ga: b.ga, gp: b.gp };
    for (const g of remaining) {
      const res = simulateGame(sim.get(g.homeTeamId)!, sim.get(g.awayTeamId)!, { seed: seed++, settings });
      const h = tb[g.homeTeamId], a = tb[g.awayTeamId];
      h.gp++; a.gp++; h.gf += res.home.goals; h.ga += res.away.goals; a.gf += res.away.goals; a.ga += res.home.goals;
      const homeWon = res.winner === g.homeTeamId, win = homeWon ? h : a, lose = homeWon ? a : h;
      win.w++; if (res.endedIn === "REG" || res.endedIn === "OT") win.row++;
      if (res.endedIn !== "REG") lose.otl++; else lose.l++;
    }
    runs.push(tb);
  }
  const pts = (x: Row) => x.w * 2 + x.otl;
  const rank = (tb: Record<number, Row>, ids: number[]) =>
    [...ids].sort((a, b) => pts(tb[b]) - pts(tb[a]) || tb[b].row - tb[a].row || tb[b].w - tb[a].w || (tb[b].gf - tb[b].ga) - (tb[a].gf - tb[a].ga));
  const avg: Record<number, number> = {};
  for (const t of teams) avg[t.id] = runs.reduce((s, r) => s + pts(r[t.id]), 0) / runs.length;
  if (process.env.SUMMARY) {
    const sd: number[] = [];
    for (const t of teams) { const m = avg[t.id]; sd.push(Math.sqrt(runs.reduce((a, r) => a + (pts(r[t.id]) - m) ** 2, 0) / runs.length)); }
    const sorted = [...teams].sort((a, b) => avg[b.id] - avg[a.id]);
    const best = sorted[0], worst = sorted[sorted.length - 1];
    const wpg = teams.find((t) => t.code === "WPG")!;
    const poSpread = runs.map((r) => { const s2 = [...teams].map((t) => pts(r[t.id])).sort((a, b) => b - a); return [s2[0], s2[s2.length - 1]]; });
    console.log(`parity ${settings.parityPct}% var ${settings.gameVariancePct}% | avg pts best ${best.code} ${avg[best.id].toFixed(1)} worst ${worst.code} ${avg[worst.id].toFixed(1)} | spread ${(avg[best.id] - avg[worst.id]).toFixed(1)} | WPG ${avg[wpg.id].toFixed(1)} | mean team sd ${(sd.reduce((a, b) => a + b, 0) / sd.length).toFixed(1)} | single-run top ${(poSpread.reduce((a, b) => a + b[0], 0) / runs.length).toFixed(0)} bottom ${(poSpread.reduce((a, b) => a + b[1], 0) / runs.length).toFixed(0)}`);
    return;
  }
  const first = runs[0];
  const out = (conf: string) => {
    const ids = teams.filter((t) => t.conference === conf).map((t) => t.id);
    const rk = rank(first, ids);
    console.log(`\n== ${conf} Conference — 1 simulated season (run #1) | avg pts over ${RUNS} runs ==`);
    console.log("  # Team  Div          GP   W   L OTL  PTS  GF  GA  DIFF | avgPTS");
    rk.forEach((id, i) => {
      const t = teams.find((x) => x.id === id)!, x = first[id];
      console.log(`${String(i + 1).padStart(3)} ${(t.code ?? "").padEnd(5)} ${(t.division ?? "").replace(/ Division/, "").padEnd(11)} ${String(x.gp).padStart(3)} ${String(x.w).padStart(3)} ${String(x.l).padStart(3)} ${String(x.otl).padStart(3)} ${String(pts(x)).padStart(4)} ${String(x.gf).padStart(3)} ${String(x.ga).padStart(3)} ${String(x.gf - x.ga).padStart(5)} | ${avg[id].toFixed(1)}`);
    });
  };
  for (const c of [...new Set(teams.map((t) => t.conference).filter(Boolean))] as string[]) out(c);
}
main().finally(() => prisma.$disconnect());
