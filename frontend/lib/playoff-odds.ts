// Playoff odds — a Monte Carlo of the rest of the season, run every night after
// the sim (and on demand). Transparent model, shown on the page:
//   • team strength = today's win-% and goal-differential (Pythagorean), blended
//     with a roster prior (dressed-lineup ratings) that fades as games are played
//     (prior weight = 25 games, so by ~game 25 results count half);
//   • each remaining game: logistic win probability from the strength gap + home
//     ice; 23 % of games reach overtime (loser takes a point);
//   • standings → NHL format (top 3 per division + 2 wild cards per conference,
//     tiebreaks points → RW → ROW → W), then the playoff bracket (division winners
//     vs wild cards, best-of-7 with 2-2-1-1-1 home ice) and the real draft lottery
//     draw (lib/draft-lottery.ts drawLottery) for the non-playoff clubs.
import { prisma } from "./prisma";
import { REGULAR_SEASON } from "./phase";
import { computeStandings, type TeamStanding } from "./sim/standings";
import { drawLottery } from "./draft-lottery";

export const ODDS_SIMS = 5000;
const PRIOR_GAMES = 25;
const HOME_LOGIT = 0.18;   // ≈ 54.5 % home win rate between equal teams
const OT_RATE = 0.23;
const SPREAD = 1.0;        // logit units per unit of logit(strength)

export type OddsRow = {
  teamId: number; code: string | null; name: string; conference: string | null; division: string | null;
  gp: number; points: number; projPoints: number; strength: number; // strength = est. win-% vs an average team
  playoffPct: number; divisionPct: number; presidentsPct: number;
  round2Pct: number; confFinalPct: number; finalPct: number; cupPct: number;
  firstPickPct: number; top3PickPct: number;
};
export type OddsSnapshotData = { at: string; sims: number; remaining: number; rows: OddsRow[] };

const logit = (p: number) => Math.log(p / (1 - p));
const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

/** Roster prior: z-score of each club's dressed-lineup rating (top 12 F, 6 D, best G) → win-% ≈ 0.5 ± 0.06·z. */
async function rosterPrior(teamIds: number[]): Promise<Map<number, number>> {
  const players = await prisma.player.findMany({
    where: { teamId: { in: teamIds }, rosterType: "NHL" },
    select: { teamId: true, position: true, isGoalie: true, overall: true, goalieRating: { select: { overall: true } } },
  });
  const by = new Map<number, { f: number[]; d: number[]; g: number[] }>();
  for (const p of players) {
    const r = by.get(p.teamId!) ?? { f: [], d: [], g: [] };
    if (p.isGoalie) r.g.push(p.goalieRating?.overall ?? p.overall ?? 60);
    else if (/(^|\/)D(\/|$)/.test(p.position ?? "")) r.d.push(p.overall ?? 60);
    else r.f.push(p.overall ?? 60);
    by.set(p.teamId!, r);
  }
  const top = (a: number[], n: number) => { const s = [...a].sort((x, y) => y - x).slice(0, n); while (s.length < n) s.push(50); return s.reduce((t, x) => t + x, 0) / n; };
  const raw = new Map(teamIds.map((id) => { const r = by.get(id) ?? { f: [], d: [], g: [] }; return [id, top(r.f, 12) * 0.5 + top(r.d, 6) * 0.3 + top(r.g, 1) * 0.2]; }));
  const vals = [...raw.values()];
  const mean = vals.reduce((t, x) => t + x, 0) / Math.max(1, vals.length);
  const sd = Math.sqrt(vals.reduce((t, x) => t + (x - mean) ** 2, 0) / Math.max(1, vals.length)) || 1;
  return new Map([...raw].map(([id, v]) => [id, Math.min(0.68, Math.max(0.32, 0.5 + 0.06 * (v - mean) / sd))]));
}

function strengthOf(s: TeamStanding, prior: number): number {
  if (!s.gp) return prior;
  const winPct = s.w / s.gp;
  const pyth = s.gf + s.ga > 0 ? (s.gf ** 2) / (s.gf ** 2 + s.ga ** 2) : 0.5;
  const observed = 0.5 * winPct + 0.5 * pyth;
  return Math.min(0.75, Math.max(0.25, (prior * PRIOR_GAMES + observed * s.gp) / (PRIOR_GAMES + s.gp)));
}

type Rec = { pts: number; rw: number; row: number; w: number };

/** The NHL's 16-team bracket for one conference: returns the 4 first-round pairings (higher seed first). */
function conferenceBracket(conf: number[], divOf: Map<number, string>, rank: (a: number, b: number) => number): [number, number][] | null {
  const divs = [...new Set(conf.map((t) => divOf.get(t)!))];
  if (divs.length !== 2) return null;
  const sorted = [...conf].sort(rank);
  const byDiv = divs.map((d) => sorted.filter((t) => divOf.get(t) === d));
  const top3 = byDiv.map((d) => d.slice(0, 3));
  const inTop = new Set(top3.flat());
  const wc = sorted.filter((t) => !inTop.has(t)).slice(0, 2);
  if (wc.length < 2 || top3.some((d) => d.length < 3)) return null;
  // the better division winner plays the 2nd wild card
  const [a, b] = rank(top3[0][0], top3[1][0]) <= 0 ? [0, 1] : [1, 0];
  return [[top3[a][0], wc[1]], [top3[a][1], top3[a][2]], [top3[b][0], wc[0]], [top3[b][1], top3[b][2]]];
}

export async function computePlayoffOdds(season = REGULAR_SEASON, sims = ODDS_SIMS): Promise<OddsSnapshotData> {
  const standings = await computeStandings(season, "NHL");
  const ids = standings.map((s) => s.teamId);
  const prior = await rosterPrior(ids);
  const remaining = await prisma.game.findMany({ where: { season, league: "NHL", seriesId: null, status: "SCHEDULED" }, select: { homeTeamId: true, awayTeamId: true } });

  const idx = new Map(ids.map((id, i) => [id, i]));
  const r = standings.map((s) => SPREAD * logit(strengthOf(s, prior.get(s.teamId) ?? 0.5)));
  const divOf = new Map(standings.map((s) => [s.teamId, s.division ?? "?"]));
  const confOf = new Map(standings.map((s) => [s.teamId, s.conference ?? "?"]));
  const confs = [...new Set(standings.map((s) => s.conference ?? "?"))];
  const n = ids.length;
  const cnt = { po: new Float64Array(n), div: new Float64Array(n), pres: new Float64Array(n), r2: new Float64Array(n), cf: new Float64Array(n), f: new Float64Array(n), cup: new Float64Array(n), pick1: new Float64Array(n), top3: new Float64Array(n), pts: new Float64Array(n) };
  const games = remaining.map((g) => [idx.get(g.homeTeamId) ?? -1, idx.get(g.awayTeamId) ?? -1]).filter(([h, a]) => h >= 0 && a >= 0);

  const series7 = (hi: number, lo: number): number => { // team ids; hi has home ice
    const rh = r[idx.get(hi)!], rl = r[idx.get(lo)!];
    let wh = 0, wl = 0, g = 0;
    while (wh < 4 && wl < 4) {
      const hiHome = g < 2 || g === 4 || g === 6;
      const p = sigmoid(rh - rl + (hiHome ? HOME_LOGIT : -HOME_LOGIT));
      if (Math.random() < p) wh++; else wl++;
      g++;
    }
    return wh === 4 ? hi : lo;
  };

  for (let k = 0; k < sims; k++) {
    const rec: Rec[] = standings.map((s) => ({ pts: s.points, rw: s.rw, row: s.row, w: s.w }));
    for (const [h, a] of games) {
      const homeWins = Math.random() < sigmoid(r[h] - r[a] + HOME_LOGIT);
      const ot = Math.random() < OT_RATE;
      const [wn, ls] = homeWins ? [h, a] : [a, h];
      rec[wn].pts += 2; rec[wn].w++;
      if (ot) { rec[ls].pts += 1; if (Math.random() < 0.6) rec[wn].row++; }
      else { rec[wn].rw++; rec[wn].row++; }
    }
    const tie = Math.random; // final random tiebreak
    const jitter = rec.map(() => tie());
    const rank = (x: number, y: number) => { const a = rec[idx.get(x)!], b = rec[idx.get(y)!]; return b.pts - a.pts || b.rw - a.rw || b.row - a.row || b.w - a.w || jitter[idx.get(y)!] - jitter[idx.get(x)!]; };
    const all = [...ids].sort(rank);
    cnt.pres[idx.get(all[0])!]++;
    for (const i of ids.keys()) cnt.pts[i] += rec[i].pts;

    const playoffSet = new Set<number>();
    const confChamps: number[] = [];
    for (const c of confs) {
      const conf = ids.filter((t) => confOf.get(t) === c);
      const bracket = conferenceBracket(conf, divOf, rank);
      if (!bracket) continue;
      for (const [x, y] of bracket) { playoffSet.add(x); playoffSet.add(y); cnt.po[idx.get(x)!]++; cnt.po[idx.get(y)!]++; }
      cnt.div[idx.get(bracket[0][0])!]++; cnt.div[idx.get(bracket[2][0])!]++;
      const seedHi = (x: number, y: number): [number, number] => (rank(x, y) <= 0 ? [x, y] : [y, x]);
      const w1 = bracket.map(([x, y]) => series7(x, y));
      w1.forEach((t) => cnt.r2[idx.get(t)!]++);
      const w2 = [series7(...seedHi(w1[0], w1[1])), series7(...seedHi(w1[2], w1[3]))];
      w2.forEach((t) => cnt.cf[idx.get(t)!]++);
      const champ = series7(...seedHi(w2[0], w2[1]));
      cnt.f[idx.get(champ)!]++;
      confChamps.push(champ);
    }
    if (confChamps.length === 2) cnt.cup[idx.get(series7(...(rank(confChamps[0], confChamps[1]) <= 0 ? [confChamps[0], confChamps[1]] : [confChamps[1], confChamps[0]]) as [number, number]))!]++;
    // draft lottery among the non-playoff clubs (worst first)
    const nonPo = all.filter((t) => !playoffSet.has(t)).reverse();
    if (nonPo.length >= 2) {
      const order = drawLottery(nonPo).order;
      cnt.pick1[idx.get(order[0])!]++;
      for (const t of order.slice(0, 3)) cnt.top3[idx.get(t)!]++;
    }
  }

  const pct = (v: number) => Math.round((v / sims) * 1000) / 10;
  const rows: OddsRow[] = standings.map((s, i) => ({
    teamId: s.teamId, code: s.code, name: s.name, conference: s.conference, division: s.division,
    gp: s.gp, points: s.points, projPoints: Math.round(cnt.pts[i] / sims), strength: Math.round(sigmoid(r[i] / SPREAD) * 1000) / 1000,
    playoffPct: pct(cnt.po[i]), divisionPct: pct(cnt.div[i]), presidentsPct: pct(cnt.pres[i]),
    round2Pct: pct(cnt.r2[i]), confFinalPct: pct(cnt.cf[i]), finalPct: pct(cnt.f[i]), cupPct: pct(cnt.cup[i]),
    firstPickPct: pct(cnt.pick1[i]), top3PickPct: pct(cnt.top3[i]),
  })).sort((a, b) => b.cupPct - a.cupPct || b.playoffPct - a.playoffPct || b.projPoints - a.projPoints);
  return { at: new Date().toISOString(), sims, remaining: games.length, rows };
}

/** Compute + store today's snapshot (one row per league day; re-running replaces it). */
export async function refreshPlayoffOdds(day: Date, season = REGULAR_SEASON): Promise<OddsSnapshotData | null> {
  const remaining = await prisma.game.count({ where: { season, league: "NHL", seriesId: null, status: "SCHEDULED" } });
  const playoffsStarted = await prisma.playoffSeries.count({ where: { season, league: "NHL" } });
  if (remaining === 0 || playoffsStarted > 0) return null; // regular season over — the bracket speaks for itself
  const data = await computePlayoffOdds(season);
  const d = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()));
  await prisma.oddsSnapshot.upsert({ where: { season_day: { season, day: d } }, update: { data: data as object }, create: { season, day: d, data: data as object } });
  return data;
}

export async function latestOdds(season = REGULAR_SEASON): Promise<{ day: Date; data: OddsSnapshotData } | null> {
  const s = await prisma.oddsSnapshot.findFirst({ where: { season }, orderBy: { day: "desc" } });
  return s ? { day: s.day, data: s.data as unknown as OddsSnapshotData } : null;
}

/** Playoff-% history of one club (for a sparkline on its page). */
export async function oddsHistory(teamId: number, season = REGULAR_SEASON): Promise<{ day: Date; playoffPct: number; cupPct: number }[]> {
  const snaps = await prisma.oddsSnapshot.findMany({ where: { season }, orderBy: { day: "asc" }, select: { day: true, data: true } });
  return snaps.map((s) => { const row = (s.data as unknown as OddsSnapshotData).rows.find((r) => r.teamId === teamId); return { day: s.day, playoffPct: row?.playoffPct ?? 0, cupPct: row?.cupPct ?? 0 }; });
}
