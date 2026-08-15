// CLI: simulate a single game and print an NHL.com-style box score.
//
//   npx tsx scripts/sim-game.ts <homeIdOrSlug> <awayIdOrSlug> [seed]

import { prisma } from "../lib/prisma";
import { loadSimTeam } from "../lib/sim";
import { simulateGame } from "../lib/sim/engine";
import type { GameResult, TeamBox } from "../lib/sim/types";

async function resolveTeam(arg: string): Promise<number> {
  if (/^\d+$/.test(arg)) return Number(arg);
  const t = await prisma.team.findFirst({
    where: { OR: [{ slug: arg }, { code: arg.toUpperCase() }] },
    select: { id: true },
  });
  if (!t) throw new Error(`No team matches "${arg}"`);
  return t.id;
}

const L = (s: string | number, n: number) => String(s).padEnd(n);
const R = (s: string | number, n: number) => String(s).padStart(n);
const toi = (sec: number) => `${Math.floor(sec / 60)}:${Math.floor(sec % 60).toString().padStart(2, "0")}`;

function linescore(home: TeamBox, away: TeamBox, field: "goalsByPeriod" | "shotsByPeriod", label: string) {
  const cols = Math.max(home[field].length, away[field].length);
  const showOT = home[field][3] > 0 || away[field][3] > 0;
  const heads = ["1", "2", "3", ...(showOT ? ["OT"] : [])];
  const total = (b: TeamBox) => b[field].reduce((a, c) => a + c, 0);
  console.log(`\n${label}`);
  console.log("  " + L("", 22) + heads.map((h) => R(h, 5)).join("") + R("T", 6));
  for (const b of [away, home]) {
    const vals = heads.map((_, i) => R(b[field][i] ?? 0, 5)).join("");
    console.log("  " + L(b.name, 22) + vals + R(total(b), 6));
  }
}

function goalsAndPenalties(r: GameResult, homeName: string, awayName: string) {
  const nameOf = (id: number) => id === r.home.teamId ? homeName : awayName;
  console.log("\n" + "GOALS".padEnd(50) + "PENALTIES");
  for (let p = 1; p <= 4; p++) {
    const gp = r.goals.filter((g) => g.period === p && g.strength !== "SO");
    const pp = r.penalties.filter((x) => x.period === p);
    if (!gp.length && !pp.length) continue;
    const title = p === 4 ? "OT" : `${p}${["st", "nd", "rd"][p - 1]} PERIOD`;
    console.log(`\n-- ${title} --`);
    const rows = Math.max(gp.length, pp.length);
    for (let i = 0; i < rows; i++) {
      let left = "";
      if (gp[i]) {
        const g = gp[i];
        const st = g.emptyNet ? " (EN)" : g.strength !== "EV" ? ` (${g.strength})` : "";
        const a = g.assistNames.length ? ` (${g.assistNames.join(", ")})` : " (unassisted)";
        left = `${nameOf(g.team).slice(0, 3).toUpperCase()} ${g.scorerName}${a} @ ${g.time}${st}`;
      }
      let right = "";
      if (pp[i]) {
        const x = pp[i];
        right = `${x.playerName} (${x.teamCode ?? nameOf(x.team).slice(0, 3)}) ${x.type} (${x.severity}) @ ${x.time}`;
      }
      console.log("  " + L(left.slice(0, 47), 48) + right);
    }
  }
  if (r.endedIn === "SO") console.log("\n-- SHOOTOUT --  won by " + nameOf(r.winner));
}

function skaterTable(box: TeamBox) {
  console.log(`\n${box.name} — skaters`);
  console.log("  " + L("Player", 22) + L("Pos", 5) +
    ["G", "A", "P", "+/-", "SOG", "PIM", "HIT", "BLK", "FO"].map((h) => R(h, 5)).join("") + R("TOI", 7));
  for (const s of box.skaters) {
    if (!s.toi && !s.shots && !s.points) continue;
    const fo = s.faceoffWins + s.faceoffLosses ? `${s.faceoffWins}-${s.faceoffLosses}` : "-";
    const pm = s.plusMinus > 0 ? `+${s.plusMinus}` : `${s.plusMinus}`;
    console.log("  " + L(s.name, 22) + L(s.position, 5) +
      [s.goals, s.assists, s.points, pm,
        s.shots, s.pim, s.hits, s.blocks].map((v) => R(v, 5)).join("") +
      R(fo, 5) + R(toi(s.toi), 7));
  }
  const g = box.goalie;
  console.log(`  G ${g.name}: ${g.saves}/${g.shotsAgainst} (${(g.savePct * 100).toFixed(1)}%), ${g.goalsAgainst} GA [${g.decision}]`);
}

function teamStats(home: TeamBox, away: TeamBox) {
  const fo = (b: TeamBox) => {
    const t = b.faceoffWins + b.faceoffLosses;
    return t ? `${(b.faceoffWins / t * 100).toFixed(0)}%` : "-";
  };
  const rows: Array<[string, string | number, string | number]> = [
    ["Goals", away.goals, home.goals],
    ["Shots", away.shots, home.shots],
    ["PP", `${away.ppGoals}/${away.ppOpp}`, `${home.ppGoals}/${home.ppOpp}`],
    ["PIM", away.pim, home.pim],
    ["Faceoff %", fo(away), fo(home)],
    ["Hits", away.hits, home.hits],
    ["Blocks", away.blocks, home.blocks],
  ];
  console.log("\nTEAM STATS");
  console.log("  " + L("", 14) + R(away.name.slice(0, 12), 14) + R(home.name.slice(0, 12), 14));
  for (const [k, a, h] of rows) console.log("  " + L(k, 14) + R(a, 14) + R(h, 14));
}

async function main() {
  const [homeArg, awayArg, seedArg] = process.argv.slice(2);
  if (!homeArg || !awayArg) {
    console.error("Usage: npx tsx scripts/sim-game.ts <home> <away> [seed]");
    process.exit(1);
  }
  const [homeId, awayId] = await Promise.all([resolveTeam(homeArg), resolveTeam(awayArg)]);
  const [home, away] = await Promise.all([loadSimTeam(homeId), loadSimTeam(awayId)]);
  const r = simulateGame(home, away, seedArg ? { seed: Number(seedArg) } : {});

  console.log("=".repeat(76));
  const tag = r.endedIn === "REG" ? "" : ` (${r.endedIn})`;
  console.log(`FINAL${tag}:  ${away.name} ${r.away.goals} @ ${home.name} ${r.home.goals}    seed=${r.seed}`);
  linescore(r.home, r.away, "goalsByPeriod", "GOALS BY PERIOD");
  linescore(r.home, r.away, "shotsByPeriod", "SHOTS BY PERIOD");
  goalsAndPenalties(r, home.name, away.name);
  teamStats(r.home, r.away);
  skaterTable(r.away);
  skaterTable(r.home);
  console.log("=".repeat(76));

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
