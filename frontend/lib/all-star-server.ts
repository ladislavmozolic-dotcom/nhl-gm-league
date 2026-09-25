// All-Star Weekend — voting, roster building, the Skills Competition and the game.
// Planned by the commissioner at /admin/all-star; runs itself at `eventAt` from the
// advance-day cron (runAllStarIfDue) or on demand. Side "A" = Eastern Conference,
// side "B" = Western Conference.
import { prisma } from "./prisma";
import { REGULAR_SEASON } from "./phase";
import { cleanName } from "./playerName";
import { skaterAttrs, goalieAttrs, simulateGame } from "./sim";
import { buildSkater, buildGoalie, buildTeam, goalieQuality } from "./sim/ratings";
import { autoLines } from "./sim/lines";
import { loadSettings } from "./sim/settings";
import { skaterTotals, goalieTotals } from "./stats-server";
import { runSkills, type SkillsEntrant, type SkillsResult } from "./all-star";

export type Side = "A" | "B";
export type Slot = "F" | "D" | "G";
export const SIDE_CONF: Record<Side, string> = { A: "Eastern Conference", B: "Western Conference" };
export const BALLOT: Record<Slot, number> = { F: 3, D: 2, G: 1 };        // picks per conference = starters
export const ROSTER: Record<Slot, number> = { F: 12, D: 6, G: 2 };        // full All-Star roster per side
export type SideRoster = { F: number[]; D: number[]; G: number[]; starters: number[] };
export type Rosters = { A: SideRoster; B: SideRoster };
export type Ballot = Record<Side, Record<Slot, number[]>>;

export type AllStarGoal = { period: number; time: string; side: Side; scorer: string; scorerId: number; assists: string[] };
export type AllStarSkaterLine = { id: number; name: string; side: Side; teamCode: string | null; g: number; a: number; p: number; shots: number };
export type AllStarGameResult = {
  scoreA: number; scoreB: number; endedIn: string; shotsA: number; shotsB: number;
  goals: AllStarGoal[]; skaters: AllStarSkaterLine[];
  goalies: { id: number; name: string; side: Side; sa: number; sv: number }[];
  mvp: AllStarSkaterLine | null; stars: AllStarSkaterLine[]; seed: number;
};

const isD = (pos: string | null) => /(^|\/)D(\/|$)/.test(pos ?? "") || pos === "D";
export const slotOf = (p: { isGoalie: boolean; position: string | null }): Slot => (p.isGoalie ? "G" : isD(p.position) ? "D" : "F");

export async function latestEvent() {
  return prisma.allStarEvent.findFirst({ where: { season: REGULAR_SEASON }, orderBy: { eventAt: "desc" } });
}

export type VotingState = "none" | "upcoming" | "open" | "closed";
export function votingState(ev: { votingOpensAt: Date | null; votingClosesAt: Date | null } | null, now = new Date()): VotingState {
  if (!ev?.votingOpensAt || !ev.votingClosesAt) return "none";
  if (now < ev.votingOpensAt) return "upcoming";
  if (now < ev.votingClosesAt) return "open";
  return "closed";
}

export type EligiblePlayer = { id: number; name: string; slug: string | null; side: Side; slot: Slot; teamId: number; teamCode: string | null; teamLogo: string | null; line: string };

/** Everyone on an NHL roster, split by conference + slot, with a season stat line. */
export async function eligiblePlayers(): Promise<EligiblePlayer[]> {
  const [players, sk, gk] = await Promise.all([
    prisma.player.findMany({
      where: { rosterType: "NHL", team: { league: "NHL", isAffiliate: false, conference: { in: Object.values(SIDE_CONF) } } },
      select: { id: true, name: true, slug: true, position: true, isGoalie: true, overall: true, teamId: true, team: { select: { code: true, logoUrl: true, conference: true } } },
    }),
    skaterTotals(REGULAR_SEASON, "NHL").catch(() => []),
    goalieTotals(REGULAR_SEASON, "NHL").catch(() => []),
  ]);
  const skBy = new Map<number, { gp: number; g: number; a: number; p: number }>();
  for (const s of sk) { const r = skBy.get(s.playerId) ?? { gp: 0, g: 0, a: 0, p: 0 }; r.gp += s.gp; r.g += s.goals; r.a += s.assists; r.p += s.points; skBy.set(s.playerId, r); }
  const gkBy = new Map(gk.map((g) => [g.playerId, g]));
  return players.map((p) => {
    const side: Side = p.team?.conference === SIDE_CONF.A ? "A" : "B";
    const slot = slotOf(p);
    const s = skBy.get(p.id), g = gkBy.get(p.id);
    const line = slot === "G"
      ? (g ? `${g.gp} GP · ${g.svPct.toFixed(3).replace(/^0/, "")} SV%` : `OV ${p.overall ?? "—"}`)
      : (s ? `${s.gp} GP · ${s.g}G ${s.a}A ${s.p}P` : `OV ${p.overall ?? "—"}`);
    return { id: p.id, name: cleanName(p.name), slug: p.slug, side, slot, teamId: p.teamId!, teamCode: p.team?.code ?? null, teamLogo: p.team?.logoUrl ?? null, line };
  }).sort((a, b) => a.name.localeCompare(b.name));
}

/** Replace a voter's whole ballot (fans + GMs can change it until voting closes). */
export async function saveBallot(eventId: number, voterKey: string, isGm: boolean, ballot: Ballot): Promise<void> {
  const eligible = new Map((await eligiblePlayers()).map((p) => [p.id, p]));
  const rows: { eventId: number; voterKey: string; isGm: boolean; playerId: number; side: string; slot: string }[] = [];
  for (const side of ["A", "B"] as const) for (const slot of ["F", "D", "G"] as const) {
    const ids = [...new Set(ballot[side]?.[slot] ?? [])];
    if (ids.length > BALLOT[slot]) throw new Error(`Pick at most ${BALLOT[slot]} ${slot === "F" ? "forwards" : slot === "D" ? "defensemen" : "goalie"} per conference.`);
    for (const id of ids) {
      const p = eligible.get(id);
      if (!p || p.side !== side || p.slot !== slot) throw new Error("One of your picks isn't eligible for that spot.");
      rows.push({ eventId, voterKey, isGm, playerId: id, side, slot });
    }
  }
  await prisma.$transaction([
    prisma.allStarVote.deleteMany({ where: { eventId, voterKey } }),
    prisma.allStarVote.createMany({ data: rows }),
  ]);
}

export async function ballotOf(eventId: number, voterKey: string): Promise<Ballot> {
  const b: Ballot = { A: { F: [], D: [], G: [] }, B: { F: [], D: [], G: [] } };
  for (const v of await prisma.allStarVote.findMany({ where: { eventId, voterKey } })) b[v.side as Side][v.slot as Slot].push(v.playerId);
  return b;
}

export type Standing = { playerId: number; side: Side; slot: Slot; fanVotes: number; gmVotes: number; score: number };

/** Weighted score: fan share of fan ballots × w + GM share of GM ballots × (1 − w). */
export async function voteStandings(ev: { id: number; fanWeightPct: number }): Promise<Standing[]> {
  const votes = await prisma.allStarVote.findMany({ where: { eventId: ev.id }, select: { voterKey: true, isGm: true, playerId: true, side: true, slot: true } });
  const fanBallots = new Set(votes.filter((v) => !v.isGm).map((v) => v.voterKey)).size;
  const gmBallots = new Set(votes.filter((v) => v.isGm).map((v) => v.voterKey)).size;
  const by = new Map<number, Standing>();
  for (const v of votes) {
    const s = by.get(v.playerId) ?? { playerId: v.playerId, side: v.side as Side, slot: v.slot as Slot, fanVotes: 0, gmVotes: 0, score: 0 };
    if (v.isGm) s.gmVotes++; else s.fanVotes++;
    by.set(v.playerId, s);
  }
  const w = Math.max(0, Math.min(100, ev.fanWeightPct)) / 100;
  // no GM ballots at all → fans decide alone (and vice versa)
  const wf = gmBallots === 0 ? 1 : fanBallots === 0 ? 0 : w;
  for (const s of by.values()) s.score = wf * (fanBallots ? s.fanVotes / fanBallots : 0) + (1 - wf) * (gmBallots ? s.gmVotes / gmBallots : 0);
  return [...by.values()].sort((a, b) => b.score - a.score || b.fanVotes + b.gmVotes - (a.fanVotes + a.gmVotes));
}

/** Starters from the vote; the rest by season performance, with every club in the
 *  conference guaranteed at least one All-Star (NHL rule). */
export async function buildRosters(ev: { id: number; fanWeightPct: number }): Promise<Rosters> {
  const [standings, eligible, sk, gk, players] = await Promise.all([
    voteStandings(ev), eligiblePlayers(),
    skaterTotals(REGULAR_SEASON, "NHL").catch(() => []), goalieTotals(REGULAR_SEASON, "NHL").catch(() => []),
    prisma.player.findMany({ where: { rosterType: "NHL" }, select: { id: true, overall: true, injuryDaysLeft: true } }),
  ]);
  const ov = new Map(players.map((p) => [p.id, p.overall ?? 50]));
  const hurt = new Set(players.filter((p) => p.injuryDaysLeft > 0).map((p) => p.id));
  // performance: points/GP (min 5 GP) for skaters, SV% (min 3 GP) for goalies — overall as a fallback before the season
  const perf = new Map<number, number>();
  for (const s of sk) if (s.gp >= 5) perf.set(s.playerId, Math.max(perf.get(s.playerId) ?? 0, s.points / s.gp + (ov.get(s.playerId) ?? 50) / 1000));
  for (const g of gk) if (g.gp >= 3) perf.set(g.playerId, g.svPct + (ov.get(g.playerId) ?? 50) / 10000);
  const perfOf = (id: number) => perf.get(id) ?? (ov.get(id) ?? 50) / 1000 - 1; // no sample → below everyone who has one

  const out = {} as Rosters;
  for (const side of ["A", "B"] as const) {
    const pool = eligible.filter((p) => p.side === side && !hurt.has(p.id));
    const chosen: SideRoster = { F: [], D: [], G: [], starters: [] };
    const taken = new Set<number>();
    const add = (p: EligiblePlayer, starter = false) => { chosen[p.slot].push(p.id); taken.add(p.id); if (starter) chosen.starters.push(p.id); };
    const byId = new Map(pool.map((p) => [p.id, p]));
    // 1) starters from the vote
    for (const slot of ["F", "D", "G"] as const) {
      for (const s of standings.filter((x) => x.side === side && x.slot === slot && byId.has(x.playerId)).slice(0, BALLOT[slot])) add(byId.get(s.playerId)!, true);
    }
    const room = (slot: Slot) => chosen[slot].length < ROSTER[slot];
    // 2) every club represented — its best performer in a slot that still has room
    const clubs = [...new Set(pool.map((p) => p.teamId))];
    for (const club of clubs) {
      if (pool.some((p) => p.teamId === club && taken.has(p.id))) continue;
      const best = pool.filter((p) => p.teamId === club && !taken.has(p.id) && room(p.slot)).sort((a, b) => perfOf(b.id) - perfOf(a.id))[0];
      if (best) add(best);
    }
    // 3) fill the rest by performance
    for (const slot of ["F", "D", "G"] as const) {
      for (const p of pool.filter((x) => x.slot === slot && !taken.has(x.id)).sort((a, b) => perfOf(b.id) - perfOf(a.id))) { if (!room(slot)) break; add(p); }
    }
    out[side] = chosen;
  }
  await prisma.allStarEvent.update({ where: { id: ev.id }, data: { rosters: out as object } });
  return out;
}

const playerSelect = {
  id: true, name: true, position: true, isGoalie: true, overall: true, shoots: true, weight: true, df: true,
  ck: true, fg: true, di: true, sk: true, st: true, en: true, du: true, ph: true, fo: true, pa: true, sc: true, ps: true, ex: true, ld: true, mo: true,
  goalieRating: true, team: { select: { code: true } },
} as const;

/** Run (or re-run) the Skills Competition and the game for an event. */
export async function runAllStar(eventId: number, opts: { publish?: boolean } = {}): Promise<{ skills: SkillsResult; game: AllStarGameResult }> {
  const ev = await prisma.allStarEvent.findUnique({ where: { id: eventId } });
  if (!ev) throw new Error("All-Star event not found.");
  const rosters = (ev.rosters as Rosters | null) ?? (await buildRosters(ev));
  const ids = (["A", "B"] as const).flatMap((s) => [...rosters[s].F, ...rosters[s].D, ...rosters[s].G]);
  const rows = await prisma.player.findMany({ where: { id: { in: ids } }, select: playerSelect });
  const byId = new Map(rows.map((r) => [r.id, r]));
  const sideOf = new Map<number, Side>();
  for (const s of ["A", "B"] as const) for (const id of [...rosters[s].F, ...rosters[s].D, ...rosters[s].G]) sideOf.set(id, s);
  const seed = (ev.id * 7919 + ev.eventAt.getTime() / 60000) >>> 0;

  // ---- Skills ----
  const entrants: SkillsEntrant[] = rows.map((p) => {
    const ga = goalieAttrs(p.goalieRating ?? p);
    return {
      id: p.id, name: cleanName(p.name), side: sideOf.get(p.id)!, teamCode: p.team?.code ?? null, isGoalie: p.isGoalie,
      sk: p.sk ?? 50, sc: p.sc ?? 50, st: p.st ?? 50, pa: p.pa ?? 50, di: p.di ?? 50,
      gq: p.isGoalie ? goalieQuality(ga, p.overall ?? 50) : 0,
    };
  });
  const skills = runSkills(entrants, seed);

  // ---- Game ----
  const settings = await loadSettings();
  const teamFor = (side: Side, simId: number, name: string) => {
    const r = rosters[side];
    const sks = [...r.F, ...r.D].map((id) => byId.get(id)).filter((p): p is NonNullable<typeof p> => !!p);
    const gs = r.G.map((id) => byId.get(id)).filter((p): p is NonNullable<typeof p> => !!p);
    // All-Star hockey: nobody back-checks or hits, goalies see odd-man rushes all night
    const soft = (a: ReturnType<typeof skaterAttrs>) => (ev.lowDefense ? { ...a, df: Math.round(a.df * 0.45), ph: Math.round(a.ph * 0.3) } : a);
    const softG = (a: ReturnType<typeof goalieAttrs>) => (ev.lowDefense ? Object.fromEntries(Object.entries(a).map(([k, v]) => [k, Math.round((v as number) * 0.88)])) as typeof a : a);
    const skaters = sks.map((p) => buildSkater({ id: p.id, name: p.name, position: p.position ?? "C", overall: p.overall, attrs: soft(skaterAttrs(p)), con: 100, morale: 90, weight: p.weight ?? 200, shoots: p.shoots }));
    const goalies = gs.map((g) => buildGoalie({ id: g.id, name: g.name, overall: g.overall, attrs: softG(goalieAttrs(g.goalieRating ?? g)), con: 100, morale: 90 }));
    const lines = autoLines(sks.map((p) => ({ id: p.id, position: p.position ?? "C", overall: p.overall ?? 50, shoots: p.shoots, df: p.df })), gs.map((g) => ({ id: g.id, overall: g.overall ?? 50 })));
    return buildTeam({ id: simId, name, code: side === "A" ? "EAS" : "WES", skaters, goalies, lines, chemBase: 100 });
  };
  const home = teamFor("A", -1, ev.teamAName), away = teamFor("B", -2, ev.teamBName);
  // All-Star night: run-and-gun, almost no whistles, and no goalie pull-for-extra-attacker games
  const asSettings = ev.lowDefense
    ? { ...settings, goalsPct: Math.round(settings.goalsPct * 1.45), shotsPct: Math.round(settings.shotsPct * 1.2), penaltiesPct: 10, pullGoalieEnabled: false }
    : settings;
  const res = simulateGame(home, away, { seed, settings: asSettings });
  const sideOfTeam = (id: number): Side => (id === -1 ? "A" : "B");
  const nameOf = (id: number) => cleanName(byId.get(id)?.name ?? "?");
  const skatersOut: AllStarSkaterLine[] = [...res.home.skaters, ...res.away.skaters].map((l) => ({
    id: l.id, name: cleanName(l.name), side: sideOf.get(l.id) ?? "A", teamCode: byId.get(l.id)?.team?.code ?? null, g: l.goals, a: l.assists, p: l.points, shots: l.shots,
  })).sort((a, b) => b.p - a.p || b.g - a.g || b.shots - a.shots);
  const winnerSide = sideOfTeam(res.winner);
  const mvp = skatersOut.find((s) => s.side === winnerSide) ?? skatersOut[0] ?? null;
  const game: AllStarGameResult = {
    scoreA: res.home.goals, scoreB: res.away.goals, endedIn: res.endedIn, shotsA: res.home.shots, shotsB: res.away.shots,
    goals: res.goals.map((g) => ({ period: g.period, time: g.time, side: sideOfTeam(g.team), scorer: nameOf(g.scorer), scorerId: g.scorer, assists: g.assists.map(nameOf) })),
    skaters: skatersOut,
    goalies: [res.home.goalie, res.home.backupGoalie, res.away.goalie, res.away.backupGoalie].filter((g): g is NonNullable<typeof g> => !!g && g.started)
      .map((g) => ({ id: g.id, name: cleanName(g.name), side: sideOf.get(g.id) ?? "A", sa: g.shotsAgainst, sv: g.saves })),
    mvp, stars: skatersOut.slice(0, 3), seed,
  };

  await prisma.allStarEvent.update({ where: { id: ev.id }, data: { skills: skills as object, game: game as object, status: "DONE", rosters: rosters as object } });
  if (opts.publish !== false && !ev.resultsPublished) await publishResults(ev.id);
  return { skills, game };
}

async function publishResults(eventId: number) {
  const ev = await prisma.allStarEvent.findUnique({ where: { id: eventId } });
  if (!ev?.game) return;
  const g = ev.game as AllStarGameResult;
  const s = ev.skills as SkillsResult | null;
  const winner = g.scoreA > g.scoreB ? ev.teamAName : ev.teamBName;
  const esc = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const body = [
    `<p><b>${esc(winner)}</b> win the All-Star Game ${Math.max(g.scoreA, g.scoreB)}–${Math.min(g.scoreA, g.scoreB)}${g.endedIn !== "REG" ? ` (${g.endedIn})` : ""}.</p>`,
    g.mvp ? `<h2>🏆 MVP</h2><p>${esc(g.mvp.name)} (${esc(g.mvp.teamCode ?? "")}) — ${g.mvp.g}G ${g.mvp.a}A</p>` : "",
    s ? `<h2>🎯 Skills Competition</h2><ul>${s.events.map((e) => `<li><b>${esc(e.title)}:</b> ${e.winner ? `${esc(e.winner.name)} (${esc(e.winner.teamCode ?? "")}) — ${esc(e.winner.display)}` : "—"}</li>`).join("")}</ul>` : "",
    `<p>Full results on the <a href="/all-star">All-Star page</a>.</p>`,
  ].join("");
  const author = await prisma.team.findFirst({ where: { isAdmin: true }, orderBy: { id: "asc" }, select: { id: true } });
  if (author) await prisma.newsArticle.create({ data: { authorTeamId: author.id, title: `⭐ ${ev.title} — results`, bodyHtml: body } });
  await prisma.transaction.create({ data: { type: "NEWS", message: `⭐ All-Star Game: ${winner} win ${Math.max(g.scoreA, g.scoreB)}–${Math.min(g.scoreA, g.scoreB)}${g.mvp ? ` — MVP ${g.mvp.name}` : ""}. → /all-star` } });
  await prisma.allStarEvent.update({ where: { id: eventId }, data: { resultsPublished: true } });
}

/** Cron hook (every ~5 min): announce voting when it opens, freeze rosters when it
 *  closes, and play the event once `eventAt` passes. Idempotent. */
export async function runAllStarIfDue(now = new Date()): Promise<string | null> {
  const ev = await latestEvent().catch(() => null);
  if (!ev || ev.status === "DONE") return null;
  const vs = votingState(ev, now);
  if (vs === "open" && !ev.votingAnnounced) {
    await prisma.commissionerAnnouncement.create({ data: { body: `⭐ All-Star voting is open until ${ev.votingClosesAt!.toLocaleString("sk-SK", { timeZone: "Europe/Bratislava", dateStyle: "medium", timeStyle: "short" })} — pick your starters!`, linkUrl: "/all-star", linkLabel: "Vote now", active: true } }).catch(() => {});
    await prisma.allStarEvent.update({ where: { id: ev.id }, data: { votingAnnounced: true } });
    return "voting announced";
  }
  if (vs === "closed" && !ev.rosters) { await buildRosters(ev); return "rosters built"; }
  if (now >= ev.eventAt) { await runAllStar(ev.id); return "event played"; }
  return null;
}
