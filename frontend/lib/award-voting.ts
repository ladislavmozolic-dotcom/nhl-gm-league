import { prisma } from "@/lib/prisma";
import { computeStandings } from "@/lib/sim/standings";
import { skaterTotals, goalieTotals } from "@/lib/stats-server";
import { computeSeasonFinalists, type SeasonFinalists, type Finalist } from "@/lib/awards";

export type AwardKind = "skater" | "dman" | "goalie" | "rookie" | "selke" | "byng" | "playoff" | "coach" | "gm";
export type VotedAward = { key: string; label: string; subtitle: string; icon: string; kind: AwardKind; ballot: number; picks: number };

/** Trophies decided by a GM ballot. TOP-`ballot` candidates; each GM ranks `picks`. */
export const VOTED_AWARDS: VotedAward[] = [
  { key: "Hart", label: "Hart Memorial", subtitle: "Most Valuable Player", icon: "🏆", kind: "skater", ballot: 10, picks: 5 },
  { key: "Ted Lindsay", label: "Ted Lindsay", subtitle: "Most outstanding player", icon: "⭐", kind: "skater", ballot: 10, picks: 5 },
  { key: "Norris", label: "Norris", subtitle: "Best defenseman", icon: "🛡️", kind: "dman", ballot: 10, picks: 5 },
  { key: "Vezina", label: "Vezina", subtitle: "Best goaltender", icon: "🧤", kind: "goalie", ballot: 10, picks: 5 },
  { key: "Calder", label: "Calder", subtitle: "Top rookie", icon: "🌟", kind: "rookie", ballot: 10, picks: 5 },
  { key: "Selke", label: "Selke", subtitle: "Best defensive forward", icon: "🔒", kind: "selke", ballot: 10, picks: 5 },
  { key: "Lady Byng", label: "Lady Byng", subtitle: "Skill & sportsmanship", icon: "🕊️", kind: "byng", ballot: 10, picks: 5 },
  { key: "Conn Smythe", label: "Conn Smythe", subtitle: "Playoff MVP", icon: "👑", kind: "playoff", ballot: 5, picks: 3 },
  { key: "Jack Adams", label: "Jack Adams", subtitle: "Coach of the year", icon: "📋", kind: "coach", ballot: 5, picks: 3 },
  { key: "GM of the Year", label: "GM of the Year", subtitle: "Best general manager", icon: "🧠", kind: "gm", ballot: 5, picks: 3 },
];
/** Automatic (stat) trophies — awarded immediately, never voted. */
export const AUTO_AWARDS = ["Art Ross", "Rocket Richard"] as const;

export const awardByKey = (key: string) => VOTED_AWARDS.find((a) => a.key === key);
export function pointsForPicks(picks: number): number[] {
  return picks === 3 ? [3, 2, 1] : [5, 4, 3, 2, 1];
}

const isDef = (pos = "") => pos.includes("D") && !(pos.includes("C") || pos.includes("W") || pos.includes("F"));
const isFwd = (pos = "") => !isDef(pos) && pos !== "G" && pos !== "—";

export type Candidate = {
  key: string;            // stable ballot key: `p<playerId>` or `t<teamId>`
  kind: "player" | "team";
  playerId?: number;
  teamId?: number;        // subject team (player's club, or coach/GM club)
  name: string;           // player / coach / GM name
  subline: string;        // team name for players, "GM · TEAM" etc.
  detail: string;         // stat line (points, SV%, record…)
  photoUrl?: string | null;
  logoUrl?: string | null;
};

/** Build the TOP-N ballot candidate list for every voted award. */
export async function buildBallots(season: string, league = "NHL"): Promise<Record<string, Candidate[]>> {
  const [standings, skaters, goalies, poSkaters, teams] = await Promise.all([
    computeStandings(season, league),
    skaterTotals(season, league),
    goalieTotals(season, league),
    skaterTotals(season, league, true),
    prisma.team.findMany({ where: { league, isAffiliate: false }, select: { id: true, name: true, slug: true, logoUrl: true, coach: true, gm: true } }),
  ]);
  const teamById = new Map(teams.map((t) => [t.id, t]));
  const photoIds = [...new Set([...skaters, ...goalies, ...poSkaters].map((p) => p.playerId))];
  const photos = await prisma.player.findMany({ where: { id: { in: photoIds } }, select: { id: true, photoUrl: true } });
  const photoOf = new Map(photos.map((p) => [p.id, p.photoUrl]));

  type S = (typeof skaters)[number];
  type G = (typeof goalies)[number];
  const teamName = (id?: number | null) => (id ? teamById.get(id)?.name ?? "" : "");
  const pCand = (s: S | G, detail: string): Candidate => ({
    key: `p${s.playerId}`, kind: "player", playerId: s.playerId, teamId: s.teamId ?? undefined,
    name: s.name, subline: teamName(s.teamId), detail, photoUrl: photoOf.get(s.playerId) ?? null, logoUrl: s.teamId ? teamById.get(s.teamId)?.logoUrl : null,
  });

  const byPoints = [...skaters].sort((a, b) => b.points - a.points || b.goals - a.goals);
  const byGoals = [...skaters].sort((a, b) => b.goals - a.goals);
  const workhorses = goalies.filter((g) => g.shotsAgainst >= 1500);
  const vezPool = [...(workhorses.length ? workhorses : goalies)].sort((a, b) => b.svPct - a.svPct || a.gaa - b.gaa);
  const selkeScore = (s: S) => s.plusMinus * 2 + s.shGoals * 4 + s.blocks * 0.5 + s.hits * 0.25 + s.points * 0.15;
  const selkePool = skaters.filter((s) => isFwd(s.position) && s.points >= 25).sort((a, b) => selkeScore(b) - selkeScore(a));
  const byngPool = skaters.filter((s) => s.points >= 40).sort((a, b) => a.pim - b.pim || b.points - a.points);
  const smythePool = [...poSkaters].filter((s) => s.gp > 0).sort((a, b) => b.points - a.points || b.goals - a.goals);

  const out: Record<string, Candidate[]> = {};
  for (const a of VOTED_AWARDS) {
    const N = a.ballot;
    switch (a.kind) {
      case "skater": out[a.key] = byPoints.slice(0, N).map((s) => pCand(s, `${s.points} pts`)); break;
      case "dman": out[a.key] = byPoints.filter((s) => isDef(s.position)).slice(0, N).map((s) => pCand(s, `${s.points} pts`)); break;
      case "goalie": out[a.key] = vezPool.slice(0, N).map((g) => pCand(g, `${(g.svPct * 100).toFixed(1)}% SV%, ${g.gaa.toFixed(2)} GAA`)); break;
      case "rookie": out[a.key] = byPoints.filter((s) => s.rookie).slice(0, N).map((s) => pCand(s, `${s.points} pts`)); break;
      case "selke": out[a.key] = selkePool.slice(0, N).map((s) => pCand(s, `+${s.plusMinus}, ${s.shGoals} SHG, ${s.blocks} BLK`)); break;
      case "byng": out[a.key] = byngPool.slice(0, N).map((s) => pCand(s, `${s.points} pts, ${s.pim} PIM`)); break;
      case "playoff": out[a.key] = smythePool.slice(0, N).map((s) => pCand(s, `${s.points} pts (${s.gp} GP)`)); break;
      case "coach": {
        out[a.key] = standings.slice(0, N).map((st) => {
          const t = teamById.get(st.teamId);
          return { key: `t${st.teamId}`, kind: "team" as const, teamId: st.teamId, name: t?.coach || "—", subline: t?.name ?? "", detail: `${st.points} pts`, logoUrl: t?.logoUrl };
        }).filter((c) => c.name !== "—");
        break;
      }
      case "gm": {
        out[a.key] = standings.slice(0, N).map((st) => {
          const t = teamById.get(st.teamId);
          return { key: `t${st.teamId}`, kind: "team" as const, teamId: st.teamId, name: t?.gm || t?.name || "—", subline: t?.name ?? "", detail: `${st.points} pts`, logoUrl: t?.logoUrl };
        });
        break;
      }
    }
  }
  return out;
}

/** Deterministic-ish AI ballot: merit order + per-team noise so the field disagrees
 *  realistically (the true leader usually wins, not 32-0). Only fills categories a
 *  team hasn't voted yet — never overwrites a human GM's ballot. */
export async function generateAiBallots(season: string, league = "NHL") {
  const [ballots, voters, existing] = await Promise.all([
    buildBallots(season, league),
    prisma.team.findMany({ where: { league, isAffiliate: false }, select: { id: true } }),
    prisma.awardVote.findMany({ where: { season, league }, select: { category: true, voterTeamId: true } }),
  ]);
  const done = new Set(existing.map((v) => `${v.category}::${v.voterTeamId}`));
  const rows: { season: string; league: string; category: string; voterTeamId: number; rank: number; points: number; playerId?: number; teamId?: number; isAi: boolean }[] = [];

  for (const a of VOTED_AWARDS) {
    const cands = ballots[a.key] ?? [];
    if (cands.length === 0) continue;
    const pts = pointsForPicks(a.picks);
    const noise = a.ballot * 0.35;
    for (const v of voters) {
      if (done.has(`${a.key}::${v.id}`)) continue;
      const scored = cands.map((c, i) => ({ c, s: (a.ballot - i) + Math.random() * noise }));
      scored.sort((x, y) => y.s - x.s);
      scored.slice(0, a.picks).forEach((sc, i) => {
        rows.push({ season, league, category: a.key, voterTeamId: v.id, rank: i + 1, points: pts[i], playerId: sc.c.playerId, teamId: sc.c.kind === "team" ? sc.c.teamId : undefined, isAi: true });
      });
    }
  }
  if (rows.length) await prisma.awardVote.createMany({ data: rows });
  return { created: rows.length };
}

export type TallyRow = { key: string; playerId?: number; teamId?: number; points: number; firsts: number; ballots: number };
/** Sum ballot points per candidate for each voted category. */
export async function tallyVotes(season: string, league = "NHL"): Promise<Record<string, TallyRow[]>> {
  const votes = await prisma.awardVote.findMany({ where: { season, league }, select: { category: true, playerId: true, teamId: true, points: true, rank: true } });
  const acc: Record<string, Map<string, TallyRow>> = {};
  for (const v of votes) {
    const key = v.playerId ? `p${v.playerId}` : `t${v.teamId}`;
    (acc[v.category] ??= new Map());
    const row = acc[v.category].get(key) ?? { key, playerId: v.playerId ?? undefined, teamId: v.teamId ?? undefined, points: 0, firsts: 0, ballots: 0 };
    row.points += v.points; row.ballots += 1; if (v.rank === 1) row.firsts += 1;
    acc[v.category].set(key, row);
  }
  const out: Record<string, TallyRow[]> = {};
  for (const cat of Object.keys(acc)) out[cat] = [...acc[cat].values()].sort((a, b) => b.points - a.points || b.firsts - a.firsts);
  return out;
}

/** Ceremony category order (voted + auto trophies interleaved as a real show). */
const CEREMONY_ORDER = [
  "Hart", "Ted Lindsay", "Art Ross", "Rocket Richard", "Norris", "Vezina",
  "Calder", "Selke", "Lady Byng", "Conn Smythe", "Jack Adams", "GM of the Year",
];

/** Ceremony data: voted categories resolved from the GM ballot (top-3 by points),
 *  auto trophies + team honours from the stat engine. Before any votes exist the
 *  voted-only trophies (Ted Lindsay, GM of the Year) show their ballot as nominees. */
export async function ceremonyFinalists(season: string, league = "NHL", opts: { reveal?: boolean } = {}): Promise<SeasonFinalists & { voted: boolean }> {
  const [stat, tally, ballots, voting] = await Promise.all([
    computeSeasonFinalists(season, league),
    tallyVotes(season, league),
    buildBallots(season, league).catch(() => ({} as Record<string, Candidate[]>)),
    prisma.awardVoting.findUnique({ where: { season_league: { season, league } }, select: { status: true } }),
  ]);
  // The running tally is secret until the admin RESOLVES — before that the ceremony
  // shows nominees only, never who's leading (GMs must not see the standings).
  // resolveAwardVoting passes reveal:true to read the tally as it writes RESOLVED.
  const reveal = opts.reveal ?? voting?.status === "RESOLVED";
  const hasVotes = reveal && Object.keys(tally).length > 0;
  const votedKeys = new Set(VOTED_AWARDS.map((a) => a.key));
  const statByCat = new Map(stat.categories.map((c) => [c.category, c]));
  const candIndex = new Map<string, Candidate>();
  for (const list of Object.values(ballots)) for (const c of list) candIndex.set(c.key, c);

  const fromTally = (cat: string): Finalist[] | null => {
    const rows = tally[cat];
    if (!rows || rows.length === 0) return null;
    return rows.slice(0, 3).map((r) => {
      const cand = candIndex.get(r.key);
      return { playerId: r.playerId, playerName: cand?.name ?? "—", teamId: r.teamId ?? cand?.teamId, detail: `${r.points} pts · ${r.firsts} × 1st` };
    });
  };
  const fromBallot = (cat: string): Finalist[] | null => {
    const cands = ballots[cat];
    if (!cands || cands.length === 0) return null;
    return cands.slice(0, 3).map((c) => ({ playerId: c.playerId, playerName: c.name, teamId: c.teamId, detail: c.detail }));
  };

  const categories: { category: string; finalists: Finalist[] }[] = [];
  for (const cat of CEREMONY_ORDER) {
    let finalists: Finalist[] | null = null;
    if (votedKeys.has(cat)) finalists = fromTally(cat) ?? statByCat.get(cat)?.finalists ?? fromBallot(cat);
    else finalists = statByCat.get(cat)?.finalists ?? null; // auto award
    if (finalists && finalists.length) categories.push({ category: cat, finalists });
  }
  return { championTeamId: stat.championTeamId, runnerUpTeamId: stat.runnerUpTeamId, presidentsTeamId: stat.presidentsTeamId, categories, voted: hasVotes };
}

/** Resolve the vote into official winners and archive the season. */
export async function resolveAwardVoting(season: string, league = "NHL") {
  const [f, ballots] = await Promise.all([ceremonyFinalists(season, league, { reveal: true }), buildBallots(season, league).catch(() => ({} as Record<string, Candidate[]>))]);
  const candIndex = new Map<string, Candidate>();
  for (const list of Object.values(ballots)) for (const c of list) candIndex.set(c.key, c);

  const awards = f.categories.map((c) => {
    const w = c.finalists[0];
    return { category: c.category, playerId: w?.playerId, playerName: w?.playerName, teamId: w?.teamId, detail: w?.detail };
  });

  await prisma.$transaction([
    prisma.seasonAward.deleteMany({ where: { season, league } }),
    prisma.seasonRecord.upsert({
      where: { season_league: { season, league } },
      update: { championTeamId: f.championTeamId, runnerUpTeamId: f.runnerUpTeamId, presidentsTeamId: f.presidentsTeamId },
      create: { season, league, championTeamId: f.championTeamId, runnerUpTeamId: f.runnerUpTeamId, presidentsTeamId: f.presidentsTeamId },
    }),
    prisma.seasonAward.createMany({ data: awards.map((w) => ({ season, league, category: w.category, playerId: w.playerId, playerName: w.playerName, teamId: w.teamId, detail: w.detail })) }),
    prisma.awardVoting.upsert({ where: { season_league: { season, league } }, update: { status: "RESOLVED" }, create: { season, league, status: "RESOLVED" } }),
  ]);
  return { awards: awards.length };
}
