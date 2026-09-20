"use server";

// Import advanced goalie metrics from MoneyPuck (GSAx + high/med/low-danger save
// splits + rebound control) for the Edge goalie engine. Two seasons: 2025-26 (cur,
// 80%) and 2024-25 (last, 20%). Stored as Player.goalieAdvanced = { cur, last }.

import { prisma } from "./prisma";
import { cleanName } from "./playerName";

const CSV = (season: number) => `https://moneypuck.com/moneypuck/playerData/seasonSummary/${season}/regular/goalies.csv`;
const key = (name: string) => name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z]/g, "");

export type GoalieMetrics = {
  gp: number;
  shots: number;
  icetime: number;
  goals: number;
  xGoals: number;
  gaa: number;
  gsax: number;
  gsax60: number;
  svPct: number;
  hdSv: number;
  mdSv: number;
  ldSv: number;
  hdGsax: number;
  rebCtrl: number;
  rebounds: number;
  xRebounds: number;
  freeze: number;
  xFreeze: number;
  freezePct: number;
  penalties: number;
  pim: number;
  flurryAxg: number;
  unblockedShots: number;
};

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/);
  const head = lines[0].split(",");
  return lines.slice(1).map((l) => {
    const cells = l.split(",");
    const o: Record<string, string> = {};
    head.forEach((h, i) => (o[h] = cells[i]));
    return o;
  });
}

function metricsFromRow(r: Record<string, string>): GoalieMetrics {
  const n = (k: string) => Number(r[k] ?? 0) || 0;
  const shots = n("ongoal"), goals = n("goals"), toiSec = n("icetime");
  const xGoals = n("xGoals");
  const gsax = xGoals - goals;
  const gsax60 = toiSec > 0 ? (gsax / toiSec) * 3600 : 0;
  const gaa = toiSec > 0 ? (goals / toiSec) * 3600 : 0;
  const hdS = n("highDangerShots"), hdG = n("highDangerGoals");
  const mdS = n("mediumDangerShots"), mdG = n("mediumDangerGoals");
  const ldS = n("lowDangerShots"), ldG = n("lowDangerGoals");
  const sv = (s: number, g: number) => (s > 0 ? 1 - g / s : 0);
  const rebounds = n("rebounds"), xRebounds = n("xRebounds");
  const freeze = n("freeze"), xFreeze = n("xFreeze");
  const rebCtrl = (xRebounds - rebounds) / Math.max(1, shots);
  const freezePct = shots > 0 ? freeze / shots : 0;

  return {
    gp: n("games_played"),
    shots,
    icetime: toiSec,
    goals,
    xGoals,
    gaa,
    gsax,
    gsax60,
    svPct: sv(shots, goals),
    hdSv: sv(hdS, hdG),
    mdSv: sv(mdS, mdG),
    ldSv: sv(ldS, ldG),
    hdGsax: n("highDangerxGoals") - hdG,
    rebCtrl,
    rebounds,
    xRebounds,
    freeze,
    xFreeze,
    freezePct,
    penalties: n("penalties"),
    pim: n("penalityMinutes"),
    flurryAxg: n("flurryAdjustedxGoals"),
    unblockedShots: n("unblocked_shot_attempts"),
  };
}

async function fetchSeason(season: number): Promise<Map<string, GoalieMetrics>> {
  const text = await (await fetch(CSV(season), { headers: { "User-Agent": "Mozilla/5.0" } })).text();
  const out = new Map<string, GoalieMetrics>();
  for (const r of parseCsv(text)) {
    if (r.situation !== "all" || !r.name) continue;
    out.set(key(r.name), metricsFromRow(r));
  }
  return out;
}

export async function importMoneyPuckGoalies(): Promise<{ matched: number; total: number }> {
  const [cur, last] = await Promise.all([fetchSeason(2025), fetchSeason(2024)]);
  const goalies = await prisma.player.findMany({ where: { isGoalie: true }, select: { id: true, name: true } });
  let matched = 0;
  for (const g of goalies) {
    const k = key(cleanName(g.name));
    const c = cur.get(k), l = last.get(k);
    if (!c && !l) continue;
    await prisma.player.update({ where: { id: g.id }, data: { goalieAdvanced: { cur: c ?? null, last: l ?? null } as object } });
    matched++;
  }
  return { matched, total: goalies.length };
}
