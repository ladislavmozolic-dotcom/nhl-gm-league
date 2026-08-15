// Phase 5 — the Calibration Lab. One reusable, DB-free pass that sims a full
// in-memory double round-robin and grades every engine metric against its NHL
// target: core rates, competitive balance (does quality win?), distribution
// shape, and the next-gen layers (xG, EDGE tracking, hits, injuries, tactics).
// Used by scripts/calibration-lab.ts and the /admin/calibration page.

import { loadSimTeam } from "./index";
import { simulateGame } from "./engine";
import { loadSettings, type EngineSettings } from "./settings";
import { prisma } from "../prisma";
import type { SimTeam } from "./types";

export type CalStatus = "ok" | "warn" | "fail";
export type CalMetric = {
  group: string; label: string; value: string; target: string; status: CalStatus; hint?: string;
};
export type CalReport = { metrics: CalMetric[]; games: number; teams: number; ms: number; season: string };

// Spearman rank correlation between two equal-length numeric arrays.
function spearman(a: number[], b: number[]): number {
  const rank = (arr: number[]) => {
    const idx = arr.map((v, i) => [v, i] as const).sort((x, y) => x[0] - y[0]);
    const r = new Array(arr.length);
    for (let i = 0; i < idx.length; i++) r[idx[i][1]] = i;
    return r;
  };
  const ra = rank(a), rb = rank(b), n = a.length;
  let d2 = 0;
  for (let i = 0; i < n; i++) d2 += (ra[i] - rb[i]) ** 2;
  return 1 - (6 * d2) / (n * (n * n - 1));
}

const grade = (v: number, ok: [number, number], warn: [number, number]): CalStatus =>
  v >= ok[0] && v <= ok[1] ? "ok" : v >= warn[0] && v <= warn[1] ? "warn" : "fail";

export async function runCalibration(opts?: { settings?: EngineSettings; season?: string }): Promise<CalReport> {
  const t0 = Date.now();
  const settings = opts?.settings ?? (await loadSettings());
  const season = opts?.season ?? "2026-27";

  const teamRows = await prisma.team.findMany({ where: { league: "NHL" }, select: { id: true } });
  const teams: SimTeam[] = [];
  for (const t of teamRows) teams.push(await loadSimTeam(t.id));
  const N = teams.length;

  // accumulators
  let games = 0, homeWins = 0, extra = 0, goals = 0, shots = 0, saves = 0, shotsAg = 0;
  let xgF = 0, hd = 0, gsaxSum = 0, gsaxN = 0, oz = 0, znTot = 0, hits = 0;
  let inj = 0; const injMech: Record<string, number> = {};
  let pim = 0, blowouts = 0, upsetGames = 0, upsets = 0;
  const points: Record<number, number> = {};
  const strength: Record<number, number> = {};
  const scorer: Record<number, number> = {};
  for (const t of teams) { points[t.id] = 0; strength[t.id] = t.avgOV; }

  // double round-robin (home + away)
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    if (i === j) continue;
    const home = teams[i], away = teams[j];
    const r = simulateGame(home, away, { settings, seed: 90000 + i * 100 + j });
    games++;
    const hg = r.home.goals, ag = r.away.goals;
    if (r.winner === home.id) homeWins++;
    if (r.endedIn !== "REG") extra++;
    goals += hg + ag; shots += r.home.shots + r.away.shots;
    saves += r.home.goalie.saves + r.away.goalie.saves;
    shotsAg += r.home.goalie.shotsAgainst + r.away.goalie.shotsAgainst;
    xgF += r.home.xgFor + r.away.xgFor; hd += r.home.hdFor + r.away.hdFor;
    for (const b of [r.home, r.away]) {
      const g = b.goalie; if (g.shotsAgainst > 0) { gsaxSum += g.xga - g.goalsAgainst; gsaxN++; }
      const zt = b.ozTime + b.nzTime + b.dzTime; oz += b.ozTime; znTot += zt;
      hits += b.hits; pim += b.pim;
      for (const s of b.skaters) scorer[s.id] = (scorer[s.id] ?? 0) + s.points;
    }
    for (const x of r.injuries) { inj++; injMech[x.mechanism] = (injMech[x.mechanism] ?? 0) + 1; }
    if (Math.abs(hg - ag) >= 4) blowouts++;
    // points (2/1/0)
    const win = r.winner, lose = r.loser;
    points[win] += 2; if (r.endedIn !== "REG") points[lose] += 1;
    // upset: the clearly weaker team (>=3 OV gap) won
    const gap = strength[home.id] - strength[away.id];
    if (Math.abs(gap) >= 3) { upsetGames++; const favWon = (gap > 0 && win === home.id) || (gap < 0 && win === away.id); if (!favWon) upsets++; }
  }

  const perTeamGame = (n: number) => n / games / 2;
  const gpPerTeam = (N - 1) * 2;
  const scale82 = 82 / gpPerTeam;

  // competitive balance
  const ids = teams.map((t) => t.id);
  const rho = spearman(ids.map((id) => strength[id]), ids.map((id) => points[id]));
  const byStrength = [...ids].sort((a, b) => strength[b] - strength[a]);
  const ptsScaled = (id: number) => points[id] * scale82;
  const top8 = byStrength.slice(0, 8).reduce((s, id) => s + ptsScaled(id), 0) / 8;
  const bot8 = byStrength.slice(-8).reduce((s, id) => s + ptsScaled(id), 0) / 8;
  const topScorer = Math.max(...Object.values(scorer)) * scale82;

  const gpg = perTeamGame(goals);
  const svp = shotsAg ? saves / shotsAg : 0;
  const gf = perTeamGame(goals);
  const xgf = perTeamGame(xgF);
  const hdPct = shots ? (hd / shots) * 100 : 0;
  const gsax = gsaxN ? gsaxSum / gsaxN : 0;
  const ozPct = znTot ? (oz / znTot) * 100 : 0;
  const injPerGame = perTeamGame(inj);
  const topMech = Object.entries(injMech).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";

  const m: CalMetric[] = [
    // core
    { group: "Core rates", label: "Goals / team / game", value: gpg.toFixed(2), target: "2.9 – 3.15", status: grade(gpg, [2.9, 3.15], [2.7, 3.4]) },
    { group: "Core rates", label: "Shots / team / game", value: perTeamGame(shots).toFixed(1), target: "28 – 32", status: grade(perTeamGame(shots), [28, 32], [26, 34]) },
    { group: "Core rates", label: "Save %", value: svp.toFixed(3), target: ".900 – .910", status: grade(svp, [0.9, 0.91], [0.895, 0.915]) },
    { group: "Core rates", label: "Home win %", value: (homeWins / games * 100).toFixed(1) + "%", target: "52 – 56%", status: grade(homeWins / games * 100, [51, 57], [48, 60]) },
    { group: "Core rates", label: "OT / SO games", value: (extra / games * 100).toFixed(1) + "%", target: "20 – 26%", status: grade(extra / games * 100, [19, 27], [15, 32]) },
    { group: "Core rates", label: "PIM / team / game", value: perTeamGame(pim).toFixed(1), target: "7 – 12", status: grade(perTeamGame(pim), [7, 12], [5, 15]) },
    // balance
    { group: "Competitive balance", label: "Quality → points (Spearman)", value: rho.toFixed(3), target: "> 0.85", status: grade(rho, [0.85, 1], [0.75, 1]), hint: "does the higher-rated team win over a season?" },
    { group: "Competitive balance", label: "Top-8 vs bottom-8 gap (pts/82)", value: (top8 - bot8).toFixed(0), target: "> 30", status: grade(top8 - bot8, [30, 200], [20, 200]) },
    { group: "Competitive balance", label: "Upset rate (≥3 OV gap)", value: (upsetGames ? upsets / upsetGames * 100 : 0).toFixed(0) + "%", target: "28 – 45%", status: grade(upsetGames ? upsets / upsetGames * 100 : 0, [26, 46], [18, 55]), hint: "healthy randomness — not a coin flip, not chalk" },
    { group: "Competitive balance", label: "Blowouts (≥4 goals)", value: (blowouts / games * 100).toFixed(1) + "%", target: "8 – 14%", status: grade(blowouts / games * 100, [7, 15], [4, 20]) },
    { group: "Competitive balance", label: "Top scorer (pts/82)", value: topScorer.toFixed(0), target: "105 – 130", status: grade(topScorer, [102, 135], [90, 150]) },
    // shot quality
    { group: "Shot quality (xG)", label: "xGF vs GF / team", value: `${xgf.toFixed(2)} vs ${gf.toFixed(2)}`, target: "within ~8%", status: grade(gf ? xgf / gf : 1, [0.9, 1.1], [0.82, 1.2]), hint: "expected goals should track real goals" },
    { group: "Shot quality (xG)", label: "High-danger shot %", value: hdPct.toFixed(0) + "%", target: "28 – 38%", status: grade(hdPct, [28, 38], [22, 44]) },
    { group: "Shot quality (xG)", label: "Avg starter GSAx / game", value: (gsax >= 0 ? "+" : "") + gsax.toFixed(2), target: "≈ 0 (±0.3)", status: grade(gsax, [-0.35, 0.35], [-0.7, 0.7]), hint: "goals saved above expected centres on zero league-wide" },
    // EDGE tracking
    { group: "EDGE tracking", label: "Offensive-zone time %", value: ozPct.toFixed(1) + "%", target: "32 – 39%", status: grade(ozPct, [32, 39], [28, 43]) },
    { group: "EDGE tracking", label: "Hits / team / game", value: perTeamGame(hits).toFixed(1), target: "18 – 24", status: grade(perTeamGame(hits), [18, 24], [15, 28]) },
    // injuries
    { group: "Injuries", label: "Injuries / team / game", value: injPerGame.toFixed(3), target: "0.45 – 0.62", status: grade(injPerGame, [0.45, 0.62], [0.38, 0.72]), hint: `~${(injPerGame * 82).toFixed(0)}/team/season · most common: ${topMech}` },
  ];

  return { metrics: m, games, teams: N, ms: Date.now() - t0, season };
}
