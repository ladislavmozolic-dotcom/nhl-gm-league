/* eslint-disable @typescript-eslint/no-explicit-any */
// Read-only: the current V3 default against real-NHL reference values. Game-state numbers (goals, periods, margins,
// OT/SO, leads after 2, comebacks, EN goals, home win) are MEASURED from all 2,624 regular-season games of 2023-24 +
// 2024-25 (api-web.nhle.com/v1/score/<date>), as are SOG, sv% and the PP/SH goal shares; PP chances and pull timing are approximate.
// Every ordered pair of the 32 NHL clubs × bases. Run: npx tsx scripts/nhl-reality-check.ts [bases=2] [seedBase=91000000]
import { simulateGame, CORE_TUNING, GOALIE_TUNING, PERIOD_TUNING, SCORE_TUNING, SIX_TUNING, BOUNCE_TUNING, COMPRESS_TUNING } from "../lib/sim/engine";
import { loadSettings, mergeSettings } from "../lib/sim/settings";
import { readFileSync } from "fs";
import { loadSimTeam } from "../lib/sim/index";
import { ENGINE_V2, ENGINE_V3 } from "../lib/sim/version";
import { prisma } from "../lib/prisma";

const bases = Number(process.argv[2] ?? 2), seedBase = Number(process.argv[3] ?? 91_000_000);
if (process.argv[4]) Object.assign(PERIOD_TUNING, JSON.parse(process.argv[4]));
if (process.argv[5]) Object.assign(SCORE_TUNING, JSON.parse(process.argv[5]));
if (process.argv[6]) Object.assign(SIX_TUNING, JSON.parse(process.argv[6]));
if (process.argv[7]) Object.assign(BOUNCE_TUNING, JSON.parse(process.argv[7]));
if (process.argv[8]) Object.assign(COMPRESS_TUNING, JSON.parse(process.argv[8]));
if (process.env.GOALIE_TUNING) Object.assign(GOALIE_TUNING, JSON.parse(process.env.GOALIE_TUNING));
if (process.env.CORE_TUNING) Object.assign(CORE_TUNING, JSON.parse(process.env.CORE_TUNING));
const EXP = process.env.EXP ? JSON.parse(process.env.EXP) : undefined; // e.g. EXP='{"core":true}'

// ≈ NHL reference (rounded; per game = both teams)
const NHL: Record<string, number> = {
  goals: 6.09, shots: 29.28, svp: 90.22, ppOpp: 2.9, ppPct: 21, ot: 20.7, so: 6.1, home: 55.2,
  shutout: 0.11, eng: 0.37, p1: 28.9, p2: 33.6, p3: 35.1,
  m1: 38.2, m2: 21.0, m3: 23.9, m4: 16.9, lead2win: 84.7, trailShotShare: 53, pullSec: 165,
};

type A = Record<string, number>;
const a: A = { games: 0 };
const add = (k: string, v: number) => { a[k] = (a[k] ?? 0) + v; };
const pulls: number[] = [];
const teamSv = new Map<number, { sa: number; ga: number }>(); // per club, for the save % spread

(async () => {
  // SETTINGS=<json file> runs with another league's settings (e.g. scripts/fixtures/league-settings-2026-10.json = the live league)
  const settings = process.env.SETTINGS ? mergeSettings(JSON.parse(readFileSync(process.env.SETTINGS, "utf8"))) : await loadSettings();
  const ids = (await prisma.team.findMany({ where: { league: "NHL" }, select: { id: true }, orderBy: { id: "asc" } })).map((t) => t.id);
  const teams: Awaited<ReturnType<typeof loadSimTeam>>[] = [];
  for (const id of ids) teams.push(await loadSimTeam(id));
  if (process.env.PULL) for (const t of teams as any[]) if (t.strategy?.goaliePull) t.strategy.goaliePull.pullSec = Number(process.env.PULL);
  for (let b = 0; b < bases; b++) for (let i = 0; i < teams.length; i++) for (let j = 0; j < teams.length; j++) {
    if (i === j) continue;
    const r: any = simulateGame(structuredClone(teams[i]), structuredClone(teams[j]), { settings, seed: seedBase + b * 100_000 + i * 100 + j, engineVersion: process.env.ENGINE === "v2" ? ENGINE_V2 : ENGINE_V3, ...(EXP ? { experimentalV3: EXP } : {}) });
    const H = r.home.teamId, ev: any[] = r.events ?? [];
    a.games++;
    const goals = ev.filter((e) => e.type === "GOAL" && !e.meta?.so);
    add("goals", r.home.goals + r.away.goals); add("shots", r.home.shots + r.away.shots);
    add("sv", r.home.shots + r.away.shots - goals.filter((g) => !g.meta?.emptyNet).length);
    add("sog", r.home.shots + r.away.shots);
    add("ppOpp", r.home.ppOpp + r.away.ppOpp); add("ppG", goals.filter((g) => g.strength === "PP").length);
    for (const [side, opp] of [[r.home, r.away], [r.away, r.home]] as const) {
      const t = teamSv.get(side.teamId) ?? { sa: 0, ga: 0 }; t.sa += opp.shots; t.ga += goals.filter((g) => g.teamId === opp.teamId && !g.meta?.emptyNet).length; teamSv.set(side.teamId, t);
    }
    add("icing", (r.home.icings ?? 0) + (r.away.icings ?? 0));
    add("shG", goals.filter((g) => g.strength === "SH").length); add("psG", goals.filter((g) => g.meta?.penaltyShot).length); add("allG", goals.length);
    add("ot", r.endedIn !== "REG" ? 1 : 0); add("so", r.endedIn === "SO" ? 1 : 0);
    add("home", r.winner === H ? 1 : 0);
    add("fav", r.winner === (teams[i].avgOV >= teams[j].avgOV ? teams[i].id : teams[j].id) ? 1 : 0);
    add("shutout", (r.home.goals === 0 ? 1 : 0) + (r.away.goals === 0 ? 1 : 0));
    add("eng", goals.filter((g) => g.meta?.emptyNet).length);
    for (const g of goals) add(`p${Math.min(g.period, 4)}`, 1);
    const m = Math.abs(r.home.goals - r.away.goals);
    add(m >= 4 ? "m4" : `m${m}`, 1);
    // score after 2 periods → who wins
    const s2 = goals.filter((g) => g.period <= 2).reduce((s, g) => s + (g.teamId === H ? 1 : -1), 0);
    if (s2 !== 0) {
      add("lead2", 1); const k = Math.min(3, Math.abs(s2)); add(`lead2_${k}`, 1);
      if ((s2 > 0) === (r.winner === H)) { add("lead2win", 1); add(`lead2win_${k}`, 1); }
    }
    // score effects: shots on goal (SAVE + GOAL, regulation) taken while trailing vs leading
    let diff = 0; // home − away, walked in time order
    const timeline = ev.filter((e) => (e.type === "SAVE" || e.type === "GOAL") && e.period <= 3 && !e.meta?.so && !e.meta?.emptyNet).sort((x, y) => x.period - y.period || x.seconds - y.seconds || x.seq - y.seq);
    for (const e of timeline) {
      const shooterHome = e.type === "GOAL" ? e.teamId === H : e.teamId !== H;
      const lead = shooterHome ? diff : -diff;
      if (lead < 0) add("shotTrail", 1); else if (lead > 0) add("shotLead", 1);
      if (e.period === 3 && lead === -1) add("t3", 1); else if (e.period === 3 && lead === 1) add("l3", 1);
      if (e.period === 3 && Math.abs(lead) === 1 && e.type === "GOAL") add(lead < 0 ? "t3g" : "l3g", 1);
      if (e.type === "GOAL") diff += e.teamId === H ? 1 : -1;
    }
    // goalie pulls when down exactly 1 in the 3rd: how often the 6-on-5 ties it vs an empty-net goal against
    for (const e of ev.filter((x) => x.type === "GOALIE_PULL" && x.meta?.pulled && x.period === 3)) {
      const before = goals.filter((g) => g.period < 3 || (g.period === 3 && g.seconds <= e.seconds));
      const lead = before.reduce((s, g) => s + (g.teamId === e.teamId ? 1 : -1), 0);
      if (lead !== -1) continue;
      pulls.push(1200 - e.seconds); add("pull1", 1);
      const after = goals.filter((g) => g.period === 3 && g.seconds > e.seconds);
      const first = after[0];
      if (first && first.teamId === e.teamId) add("pullTie", 1);
      if (after.some((g) => g.teamId !== e.teamId && g.meta?.emptyNet)) add("pullEng", 1);
    }
  }
  const g = a.games, pct = (k: string, d = g) => 100 * (a[k] ?? 0) / d, per = (k: string) => (a[k] ?? 0) / g;
  const pg = a.p1 + a.p2 + a.p3 + (a.p4 ?? 0);
  pulls.sort((x, y) => x - y);
  const rows: [string, number, number, string?][] = [
    ["Goals / game", per("goals"), NHL.goals],
    ["Shots on goal / team", per("shots") / 2, NHL.shots],
    ["Save % (no EN)", pct("sv", a.sog), NHL.svp],
    ["Power plays / team", per("ppOpp") / 2, NHL.ppOpp],
    ["Power-play %", pct("ppG", a.ppOpp), NHL.ppPct],
    // team save % talent spread: observed SD minus binomial luck (sqrt(p(1-p)/shots)); NHL 2023-25: 8.2 observed over 82 GP → ≈5.8 talent
    ["Team save % talent spread (SD ×1000, luck removed)", (() => { const v = [...teamSv.values()]; const sv = v.map((t) => 1 - t.ga / t.sa); const m = sv.reduce((a, b) => a + b, 0) / sv.length; const sd2 = sv.reduce((a, b) => a + (b - m) ** 2, 0) / sv.length; const luck = m * (1 - m) / (v.reduce((a, t) => a + t.sa, 0) / v.length); return 1000 * Math.sqrt(Math.max(0, sd2 - luck)); })(), 5.8, `${Math.round(g / 16)} GP per club`],
    ["Icings / game (keep level)", per("icing"), NaN],
    ["PP goals, share of all goals %", pct("ppG", a.allG), 20.0],
    ["SH goals, share of all goals %", pct("shG", a.allG), 2.8],
    ["Penalty-shot goals / game", per("psG"), 0.009],
    ["Games past regulation %", pct("ot"), NHL.ot],
    ["Shootouts % of games", pct("so"), NHL.so],
    ["Home team wins %", pct("home"), NHL.home],
    ["Higher-rated team wins % (accepted ≈62.4)", pct("fav"), 60],
    ["Shutouts / game", per("shutout"), NHL.shutout],
    ["Empty-net goals / game", per("eng"), NHL.eng],
    ["Goals in 1st period %", pct("p1", pg), NHL.p1],
    ["Goals in 2nd period %", pct("p2", pg), NHL.p2],
    ["Goals in 3rd period %", pct("p3", pg), NHL.p3],
    ["Final margin 1 goal %", pct("m1"), NHL.m1],
    ["Final margin 2 goals %", pct("m2"), NHL.m2],
    ["Final margin 3 goals %", pct("m3"), NHL.m3],
    ["Final margin 4+ goals %", pct("m4"), NHL.m4],
    ["Leading after 2 → wins %", pct("lead2win", a.lead2), NHL.lead2win],
    ["…lead of 1 → wins %", pct("lead2win_1", a.lead2_1), 73.8, `${(pct("lead2_1", a.lead2)).toFixed(0)}% of leads`],
    ["…lead of 2 → wins %", pct("lead2win_2", a.lead2_2), 90.7, `${(pct("lead2_2", a.lead2)).toFixed(0)}% of leads`],
    ["…lead of 3+ → wins %", pct("lead2win_3", a.lead2_3), 97.8, `${(pct("lead2_3", a.lead2)).toFixed(0)}% of leads`],
    ["Tied after 2 periods %", 100 - pct("lead2"), 19.8],
    ["Trailing team's share of shots %", 100 * a.shotTrail / (a.shotTrail + a.shotLead), NHL.trailShotShare],
    ["3rd, down 1: share of shots %", 100 * a.t3 / (a.t3 + a.l3), 58],
    ["3rd, 1-goal game: trailing team scores next %", 100 * a.t3g / (a.t3g + a.l3g), 56.3],
    ["Down 1, goalie pulled → tied %", pct("pullTie", a.pull1), 18],
    ["Down 1, goalie pulled → EN goal against %", pct("pullEng", a.pull1), 30],
    ["Goalie pulled (down 1) — median s left", pulls.length ? pulls[pulls.length >> 1] : NaN, NHL.pullSec, `${pulls.length} pulls`],
  ];
  console.log(`\n${g} games (V3 default, every ordered pair of the 32 NHL clubs × ${bases})\n`);
  console.log("| Metric | V3 | NHL ≈ | Δ |\n|---|---:|---:|---:|");
  for (const [l, v, n, note] of rows) console.log(`| ${l} | ${v.toFixed(2)} | ${n} | ${(v - n >= 0 ? "+" : "") + (v - n).toFixed(2)}${note ? ` (${note})` : ""} |`);
  await prisma.$disconnect();
})();
