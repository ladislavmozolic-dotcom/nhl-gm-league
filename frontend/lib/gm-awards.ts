// GM recognition: trade grades (from the shared value model) and an all-time dynasty
// leaderboard (cups / finals / playoff appearances / wins across every season).

import { prisma } from "./prisma";
import { computeStandings } from "./sim/standings";
import { packageFromTrade } from "./trade-exec";
import { analyzeTradeAction } from "@/app/trades/build/actions";

const gradeOf = (ratio: number): string =>
  ratio >= 1.3 ? "A+" : ratio >= 1.15 ? "A" : ratio >= 1.05 ? "B+" : ratio >= 0.97 ? "B" : ratio >= 0.88 ? "C" : ratio >= 0.78 ? "D" : "F";

export type TradeGrade = {
  id: number; fromName: string; toName: string; fromGives: string[]; toGives: string[];
  fromGrade: string; toGrade: string; verdict: string;
};

export async function tradeGrades(limit = 10): Promise<TradeGrade[]> {
  const trades = await prisma.trade.findMany({ where: { status: "ACCEPTED" }, orderBy: [{ respondedAt: "desc" }, { id: "desc" }], take: limit, select: { id: true } });
  const out: TradeGrade[] = [];
  for (const t of trades) {
    try {
      const pkg = await packageFromTrade(t.id);
      const a = await analyzeTradeAction(pkg);
      if (!a.ok) continue;
      const fromRatio = a.meGets / Math.max(1, a.meGives); // from gives meGives, gets meGets
      const toRatio = a.meGives / Math.max(1, a.meGets);
      out.push({ id: t.id, fromName: a.fromName, toName: a.toName, fromGives: a.fromItems.map((i) => i.label), toGives: a.toItems.map((i) => i.label), fromGrade: gradeOf(fromRatio), toGrade: gradeOf(toRatio), verdict: a.verdict });
    } catch { /* skip a trade whose assets moved on */ }
  }
  return out;
}

export type DynastyRow = {
  teamId: number; code: string | null; name: string; slug: string | null; logo: string | null; gm: string; ai: boolean;
  seasons: number; cups: number; finals: number; playoffs: number; wins: number; score: number;
};

export async function dynastyLeaderboard(): Promise<DynastyRow[]> {
  const [stats, teams, live] = await Promise.all([
    prisma.teamSeasonStat.findMany({ where: { league: "NHL" }, select: { teamId: true, wins: true, playoffResult: true } }),
    prisma.team.findMany({ where: { league: "NHL", isAffiliate: false }, select: { id: true, code: true, name: true, slug: true, logoUrl: true, gm: true, gmNickname: true, passwordHash: true } }),
    computeStandings("2026-27", "NHL").catch(() => []),
  ]);
  const liveWins = new Map(live.map((s) => [s.teamId, s.w]));
  const agg = new Map<number, { seasons: number; cups: number; finals: number; playoffs: number; wins: number }>();
  const get = (id: number) => { let a = agg.get(id); if (!a) { a = { seasons: 0, cups: 0, finals: 0, playoffs: 0, wins: 0 }; agg.set(id, a); } return a; };
  for (const s of stats) {
    const a = get(s.teamId);
    a.seasons++; a.wins += s.wins;
    const pr = s.playoffResult ?? "";
    if (pr === "Champion") a.cups++;
    if (pr === "Champion" || pr === "Final") a.finals++;
    if (pr && pr !== "Missed") a.playoffs++;
  }
  // fold in the live season's wins (not a finished season, so no playoff credit)
  for (const t of teams) { const a = get(t.id); a.wins += liveWins.get(t.id) ?? 0; }

  const rows: DynastyRow[] = teams.map((t) => {
    const a = get(t.id);
    const score = a.cups * 100 + a.finals * 35 + a.playoffs * 8 + a.wins * 0.15;
    const ai = !t.passwordHash;
    return { teamId: t.id, code: t.code, name: t.name, slug: t.slug, logo: t.logoUrl, gm: ai ? "AI GM" : (t.gmNickname || t.gm || "GM"), ai, seasons: a.seasons, cups: a.cups, finals: a.finals, playoffs: a.playoffs, wins: a.wins, score: Math.round(score) };
  });
  rows.sort((x, y) => y.score - x.score);
  return rows;
}
