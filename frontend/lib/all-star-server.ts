// All-Star Weekend — real NHL format (2016-2024): four division teams, 3-on-3.
//
//   1. NOMINATIONS  votingOpensAt → votingClosesAt (default T-7d → T-2d)
//      Every club's GM gets a League Notifications message with an inline form and
//      nominates 3 F / 2 D / 1 G from his OWN roster. Clubs that don't (AI clubs,
//      late GMs) are auto-nominated at the deadline from season performance.
//   2. COACHES      votingClosesAt → coachDeadlineAt (default T-2d → T)
//      Each division team is coached by a GM the commissioner assigns. He picks
//      6 F / 3 D / 2 G from his division's nominees — every club in the division
//      needs at least one All-Star — and sets three 3-on-3 trios, the starting
//      goalie (the other plays the 2nd half) and the shootout order.
//   3. EVENT        eventAt — Skills Competition, then semis (Atlantic–Metropolitan,
//      Central–Pacific) and the final: 2 × 10:00 of 3-on-3, shootout if tied.
//      The MVP's club gets a bonus draft pick (mvpBonusRound, default round 8).
// Everything is driven by the advance-day cron (runAllStarIfDue), idempotently.
import { prisma } from "./prisma";
import { REGULAR_SEASON } from "./phase";
import { cleanName } from "./playerName";
import { skaterAttrs, goalieAttrs, simulateGame } from "./sim";
import { buildSkater, buildGoalie, buildTeam, goalieQuality } from "./sim/ratings";
import { autoLines } from "./sim/lines";
import { loadSettings } from "./sim/settings";
import { skaterTotals, goalieTotals } from "./stats-server";
import { currentDraftYear } from "./draft-class-import";
import { runSkills, type SkillsEntrant, type SkillsResult } from "./all-star";

export type DivKey = "ATL" | "MET" | "CEN" | "PAC";
export type Slot = "F" | "D" | "G";
export const DIVS: { key: DivKey; division: string; name: string; conf: "East" | "West" }[] = [
  { key: "ATL", division: "Atlantic Division", name: "Team Atlantic", conf: "East" },
  { key: "MET", division: "Metropolitan Division", name: "Team Metropolitan", conf: "East" },
  { key: "CEN", division: "Central Division", name: "Team Central", conf: "West" },
  { key: "PAC", division: "Pacific Division", name: "Team Pacific", conf: "West" },
];
export const NOMINATE: Record<Slot, number> = { F: 3, D: 2, G: 1 }; // per club
export const ROSTER: Record<Slot, number> = { F: 6, D: 3, G: 2 };   // per All-Star team (11, as in the NHL)
export const UNITS = 3;                                              // 3-on-3 trios: 2 F + 1 D
const HALF_SECONDS = 600;                                            // two 10:00 halves = a 20-minute game

export type AsRoster = { F: number[]; D: number[]; G: number[] };
export type AsTeam = {
  key: DivKey; name: string; coachTeamId: number | null;
  roster: AsRoster | null; units: number[][] | null; starter: number | null; shootout: number[];
  submittedAt: string | null; auto: boolean;
};
export type AsSkaterLine = { id: number; name: string; team: DivKey; g: number; a: number; p: number };
export type AsGame = {
  round: "SF1" | "SF2" | "F"; a: DivKey; b: DivKey; scoreA: number; scoreB: number; endedIn: string; shotsA: number; shotsB: number;
  winner: DivKey; goals: { period: number; time: string; team: DivKey; scorer: string; scorerId: number; assists: string[] }[];
  shootout: { team: DivKey; shooter: string; result: string }[];
  skaters: AsSkaterLine[];
  goalies: { id: number; name: string; team: DivKey; sa: number; sv: number }[];
};
export type AllStarTournament = { games: AsGame[]; champion: DivKey; mvp: (AsSkaterLine & { clubCode: string | null }) | null; mvpPick: { year: number; round: number; clubCode: string | null } | null; seed: number };

const isD = (pos: string | null) => /(^|\/)D(\/|$)/.test(pos ?? "") || pos === "D";
export const slotOf = (p: { isGoalie: boolean; position: string | null }): Slot => (p.isGoalie ? "G" : isD(p.position) ? "D" : "F");
export const divOf = (division: string | null | undefined): DivKey | null => DIVS.find((d) => d.division === division)?.key ?? null;

export async function latestEvent() {
  return prisma.allStarEvent.findFirst({ where: { season: REGULAR_SEASON }, orderBy: { eventAt: "desc" } });
}
export type Ev = NonNullable<Awaited<ReturnType<typeof latestEvent>>>;

export function teamsOf(ev: Pick<Ev, "teams">): AsTeam[] {
  const saved = (ev.teams as AsTeam[] | null) ?? [];
  return DIVS.map((d) => saved.find((t) => t.key === d.key) ?? { key: d.key, name: d.name, coachTeamId: null, roster: null, units: null, starter: null, shootout: [], submittedAt: null, auto: false });
}
export const coachDeadline = (ev: Pick<Ev, "coachDeadlineAt" | "eventAt">) => ev.coachDeadlineAt ?? ev.eventAt;

export type Phase = "planned" | "nominations" | "coaches" | "ready" | "done";
export function phaseOf(ev: Ev, now = new Date()): Phase {
  if (ev.status === "DONE") return "done";
  if (ev.votingOpensAt && now < ev.votingOpensAt) return "planned";
  if (ev.votingClosesAt && now < ev.votingClosesAt) return "nominations";
  if (now < coachDeadline(ev)) return "coaches";
  return "ready";
}

// ---------------------------------------------------------------------------
// players, performance
// ---------------------------------------------------------------------------

export type AsPlayer = { id: number; name: string; slug: string | null; slot: Slot; teamId: number; teamCode: string | null; teamLogo: string | null; div: DivKey; line: string; perf: number; hurt: boolean };

/** Every NHL-rostered player on a club in one of the four divisions. */
export async function leaguePlayers(): Promise<AsPlayer[]> {
  const [players, sk, gk] = await Promise.all([
    prisma.player.findMany({
      where: { rosterType: "NHL", team: { league: "NHL", isAffiliate: false, division: { in: DIVS.map((d) => d.division) } } },
      select: { id: true, name: true, slug: true, position: true, isGoalie: true, overall: true, teamId: true, injuryDaysLeft: true, team: { select: { code: true, logoUrl: true, division: true } } },
    }),
    skaterTotals(REGULAR_SEASON, "NHL").catch(() => []),
    goalieTotals(REGULAR_SEASON, "NHL").catch(() => []),
  ]);
  const skBy = new Map<number, { gp: number; g: number; a: number; p: number }>();
  for (const s of sk) { const r = skBy.get(s.playerId) ?? { gp: 0, g: 0, a: 0, p: 0 }; r.gp += s.gp; r.g += s.goals; r.a += s.assists; r.p += s.points; skBy.set(s.playerId, r); }
  const gkBy = new Map(gk.map((g) => [g.playerId, g]));
  return players.map((p) => {
    const slot = slotOf(p);
    const s = skBy.get(p.id), g = gkBy.get(p.id);
    const ov = (p.overall ?? 50) / 1000;
    // performance: P/GP (≥5 GP) for skaters, SV% (≥3 GP) for goalies; before that, overall
    const perf = slot === "G" ? (g && g.gp >= 3 ? g.svPct + ov / 10 : ov - 1) : (s && s.gp >= 5 ? s.p / s.gp + ov : ov - 1);
    const line = slot === "G"
      ? (g ? `${g.gp} GP · ${g.svPct.toFixed(3).replace(/^0/, "")}` : `OV ${p.overall ?? "—"}`)
      : (s ? `${s.gp} GP · ${s.g}G ${s.a}A ${s.p}P` : `OV ${p.overall ?? "—"}`);
    return { id: p.id, name: cleanName(p.name), slug: p.slug, slot, teamId: p.teamId!, teamCode: p.team?.code ?? null, teamLogo: p.team?.logoUrl ?? null, div: divOf(p.team?.division)!, line, perf, hurt: p.injuryDaysLeft > 0 };
  });
}

// ---------------------------------------------------------------------------
// 1. nominations
// ---------------------------------------------------------------------------

export type Nomination = { teamId: number; auto: boolean; F: number[]; D: number[]; G: number[] };

export async function nominations(eventId: number): Promise<Map<number, Nomination>> {
  const rows = await prisma.allStarVote.findMany({ where: { eventId }, select: { voterKey: true, playerId: true, slot: true } });
  const out = new Map<number, Nomination>();
  for (const r of rows) {
    const [kind, id] = r.voterKey.split(":");
    const teamId = Number(id);
    const n = out.get(teamId) ?? { teamId, auto: kind === "auto", F: [], D: [], G: [] };
    n[r.slot as Slot].push(r.playerId);
    out.set(teamId, n);
  }
  return out;
}

async function writeNomination(eventId: number, teamId: number, picks: AsRoster, auto: boolean, all: AsPlayer[]) {
  const byId = new Map(all.map((p) => [p.id, p]));
  const rows: { eventId: number; voterKey: string; isGm: boolean; playerId: number; side: string; slot: string }[] = [];
  for (const slot of ["F", "D", "G"] as const) {
    const ids = [...new Set(picks[slot] ?? [])];
    if (ids.length !== NOMINATE[slot]) throw new Error(`Nominate exactly ${NOMINATE.F} forwards, ${NOMINATE.D} defensemen and ${NOMINATE.G} goalie.`);
    for (const id of ids) {
      const p = byId.get(id);
      if (!p || p.teamId !== teamId || p.slot !== slot) throw new Error("You can only nominate players from your own NHL roster, in their own position.");
      rows.push({ eventId, voterKey: `${auto ? "auto" : "gm"}:${teamId}`, isGm: !auto, playerId: id, side: p.div, slot });
    }
  }
  await prisma.$transaction([
    prisma.allStarVote.deleteMany({ where: { eventId, voterKey: { in: [`gm:${teamId}`, `auto:${teamId}`] } } }),
    prisma.allStarVote.createMany({ data: rows }),
  ]);
}

/** A GM sends (or changes) his club's nomination while the window is open. */
export async function submitNomination(eventId: number, teamId: number, picks: AsRoster): Promise<void> {
  const ev = await prisma.allStarEvent.findUnique({ where: { id: eventId } });
  if (!ev) throw new Error("Event not found.");
  if (phaseOf(ev) !== "nominations") throw new Error("Nominations aren't open right now.");
  await writeNomination(eventId, teamId, picks, false, await leaguePlayers());
}

/** Best 3F / 2D / 1G of a club by season performance (healthy first). */
function bestOfClub(all: AsPlayer[], teamId: number): AsRoster {
  const pick = (slot: Slot) => all.filter((p) => p.teamId === teamId && p.slot === slot).sort((a, b) => Number(a.hurt) - Number(b.hurt) || b.perf - a.perf).slice(0, NOMINATE[slot]).map((p) => p.id);
  return { F: pick("F"), D: pick("D"), G: pick("G") };
}

/** Deadline: every club without a nomination gets an automatic one. */
export async function closeNominations(eventId: number): Promise<number> {
  const [all, noms, clubs] = await Promise.all([
    leaguePlayers(), nominations(eventId),
    prisma.team.findMany({ where: { league: "NHL", isAffiliate: false, division: { in: DIVS.map((d) => d.division) } }, select: { id: true } }),
  ]);
  let filled = 0;
  for (const c of clubs) {
    if (noms.has(c.id)) continue;
    const best = bestOfClub(all, c.id);
    if (best.F.length === NOMINATE.F && best.D.length === NOMINATE.D && best.G.length === NOMINATE.G) { await writeNomination(eventId, c.id, best, true, all); filled++; }
  }
  await prisma.allStarEvent.update({ where: { id: eventId }, data: { nominationsClosed: true } });
  return filled;
}

// ---------------------------------------------------------------------------
// 2. coaches: roster + lines
// ---------------------------------------------------------------------------

export async function nomineesOf(eventId: number, div: DivKey): Promise<AsPlayer[]> {
  const [all, rows] = await Promise.all([leaguePlayers(), prisma.allStarVote.findMany({ where: { eventId, side: div }, select: { playerId: true } })]);
  const ids = new Set(rows.map((r) => r.playerId));
  return all.filter((p) => ids.has(p.id));
}

export type Lineup = { roster: AsRoster; units: number[][]; starter: number; shootout: number[] };

/** Validate a coach's (or the auto) lineup against the division's nominees. */
export function validateLineup(l: Lineup, nominees: AsPlayer[]): string | null {
  const byId = new Map(nominees.map((p) => [p.id, p]));
  for (const slot of ["F", "D", "G"] as const) {
    const ids = [...new Set(l.roster[slot])];
    if (ids.length !== ROSTER[slot]) return `Pick exactly ${ROSTER.F} forwards, ${ROSTER.D} defensemen and ${ROSTER.G} goalies.`;
    if (ids.some((id) => byId.get(id)?.slot !== slot)) return "Every pick must be a nominee of your division, in his own position.";
  }
  const all = new Set([...l.roster.F, ...l.roster.D, ...l.roster.G]);
  const clubs = new Set(nominees.map((p) => p.teamId));
  const repped = new Set([...all].map((id) => byId.get(id)!.teamId));
  const missing = [...clubs].filter((c) => !repped.has(c));
  if (missing.length) return `Every club in the division needs at least one All-Star — missing: ${missing.map((c) => nominees.find((p) => p.teamId === c)?.teamCode).join(", ")}.`;
  if (l.units.length !== UNITS) return `Set ${UNITS} three-on-three units.`;
  const F = new Set(l.roster.F), D = new Set(l.roster.D);
  for (const u of l.units) {
    if (u.length !== 3 || new Set(u).size !== 3) return "Each unit is 3 different players: 2 forwards + 1 defenseman.";
    if (u.filter((id) => F.has(id)).length !== 2 || u.filter((id) => D.has(id)).length !== 1) return "Each unit is 2 forwards + 1 defenseman from your roster.";
  }
  if (!l.roster.G.includes(l.starter)) return "The starting goalie must be one of your two goalies.";
  if (l.shootout.length < 3 || l.shootout.some((id) => !F.has(id) && !D.has(id)) || new Set(l.shootout).size !== l.shootout.length) return "Pick 3 different skaters for the shootout.";
  return null;
}

/** Best legal lineup for a division: one per club first, then by performance. */
export function autoLineup(nominees: AsPlayer[]): Lineup {
  const sorted = [...nominees].sort((a, b) => Number(a.hurt) - Number(b.hurt) || b.perf - a.perf);
  const roster: AsRoster = { F: [], D: [], G: [] };
  const taken = new Set<number>();
  const room = (s: Slot) => roster[s].length < ROSTER[s];
  const add = (p: AsPlayer) => { roster[p.slot].push(p.id); taken.add(p.id); };
  for (const club of [...new Set(sorted.map((p) => p.teamId))]) {
    const best = sorted.find((p) => p.teamId === club && room(p.slot) && !taken.has(p.id));
    if (best) add(best);
  }
  for (const p of sorted) if (!taken.has(p.id) && room(p.slot)) add(p);
  const perfOf = new Map(nominees.map((p) => [p.id, p.perf]));
  const byPerf = (a: number, b: number) => (perfOf.get(b) ?? 0) - (perfOf.get(a) ?? 0);
  const F = [...roster.F].sort(byPerf), D = [...roster.D].sort(byPerf), G = [...roster.G].sort(byPerf);
  const units = [0, 1, 2].map((i) => [F[i * 2], F[i * 2 + 1], D[i]].filter((x) => x != null));
  return { roster, units, starter: G[0], shootout: F.slice(0, 3) };
}

async function saveTeams(eventId: number, teams: AsTeam[]) {
  await prisma.allStarEvent.update({ where: { id: eventId }, data: { teams: teams as object } });
}

/** A coach submits his All-Star lineup (the admin may do it for any team, any time before the event). */
export async function submitLineup(eventId: number, coachTeamId: number | null, div: DivKey, l: Lineup, opts: { asAdmin?: boolean } = {}): Promise<void> {
  const ev = await prisma.allStarEvent.findUnique({ where: { id: eventId } });
  if (!ev) throw new Error("Event not found.");
  if (ev.status === "DONE") throw new Error("The event has already been played.");
  const teams = teamsOf(ev);
  const t = teams.find((x) => x.key === div)!;
  if (!opts.asAdmin) {
    if (t.coachTeamId == null || t.coachTeamId !== coachTeamId) throw new Error("You're not the coach of this All-Star team.");
    if (phaseOf(ev) !== "coaches") throw new Error("The coaches' window isn't open.");
  }
  const err = validateLineup(l, await nomineesOf(eventId, div));
  if (err) throw new Error(err);
  Object.assign(t, { roster: l.roster, units: l.units, starter: l.starter, shootout: l.shootout.slice(0, 5), submittedAt: new Date().toISOString(), auto: false });
  await saveTeams(eventId, teams);
}

/** Fill every team that has no lineup yet (or, with `only`, rebuild that one) automatically. */
export async function autoFillTeams(eventId: number, only?: DivKey): Promise<number> {
  const ev = await prisma.allStarEvent.findUnique({ where: { id: eventId } });
  if (!ev) return 0;
  const teams = teamsOf(ev);
  let n = 0;
  for (const t of teams) {
    if (only ? t.key !== only : !!t.roster) continue;
    const l = autoLineup(await nomineesOf(eventId, t.key));
    Object.assign(t, { roster: l.roster, units: l.units, starter: l.starter, shootout: l.shootout, submittedAt: new Date().toISOString(), auto: true });
    n++;
  }
  await saveTeams(eventId, teams);
  return n;
}

/** Commissioner: name / coach of one division team. */
export async function setTeamMeta(eventId: number, div: DivKey, meta: { name?: string; coachTeamId?: number | null }): Promise<void> {
  const ev = await prisma.allStarEvent.findUnique({ where: { id: eventId } });
  if (!ev) throw new Error("Event not found.");
  const teams = teamsOf(ev);
  const t = teams.find((x) => x.key === div)!;
  if (meta.name !== undefined) t.name = meta.name.trim().slice(0, 40) || DIVS.find((d) => d.key === div)!.name;
  if (meta.coachTeamId !== undefined) t.coachTeamId = meta.coachTeamId;
  await saveTeams(eventId, teams);
}

// ---------------------------------------------------------------------------
// 3. the event
// ---------------------------------------------------------------------------

const playerSelect = {
  id: true, name: true, position: true, isGoalie: true, overall: true, shoots: true, weight: true, df: true,
  ck: true, fg: true, di: true, sk: true, st: true, en: true, du: true, ph: true, fo: true, pa: true, sc: true, ps: true, ex: true, ld: true, mo: true,
  goalieRating: true, teamId: true, team: { select: { code: true, isAffiliate: true, parentTeamId: true, parentTeam: { select: { code: true } } } },
} as const;

export async function runAllStar(eventId: number, opts: { publish?: boolean } = {}): Promise<AllStarTournament> {
  let ev = await prisma.allStarEvent.findUnique({ where: { id: eventId } });
  if (!ev) throw new Error("All-Star event not found.");
  if (!ev.nominationsClosed) await closeNominations(eventId);
  await autoFillTeams(eventId);
  ev = (await prisma.allStarEvent.findUnique({ where: { id: eventId } }))!;
  const teams = teamsOf(ev);
  const ids = teams.flatMap((t) => [...t.roster!.F, ...t.roster!.D, ...t.roster!.G]);
  const rows = await prisma.player.findMany({ where: { id: { in: ids } }, select: playerSelect });
  const byId = new Map(rows.map((r) => [r.id, r]));
  const teamOf = new Map<number, DivKey>();
  for (const t of teams) for (const id of [...t.roster!.F, ...t.roster!.D, ...t.roster!.G]) teamOf.set(id, t.key);
  const seed = (ev.id * 7919 + Math.floor(ev.eventAt.getTime() / 60000)) >>> 0;

  // ---- Skills Competition: each All-Star team sends its 2 best per event ----
  const entrants: SkillsEntrant[] = rows.map((p) => {
    const ga = goalieAttrs(p.goalieRating ?? p);
    return { id: p.id, name: cleanName(p.name), side: teamOf.get(p.id)!, teamCode: p.team?.code ?? null, isGoalie: p.isGoalie,
      sk: p.sk ?? 50, sc: p.sc ?? 50, st: p.st ?? 50, pa: p.pa ?? 50, di: p.di ?? 50, gq: p.isGoalie ? goalieQuality(ga, p.overall ?? 50) : 0 };
  });
  const skills = runSkills(entrants, seed);

  // ---- 3-on-3 tournament: 2 × 10:00, goalies swap at the break, shootout if tied ----
  const settings = await loadSettings();
  const asSettings = ev.lowDefense ? { ...settings, penaltiesPct: 0, penaltiesEnabled: false, pullGoalieEnabled: false } : settings;
  const lowD = ev.lowDefense;
  const soft = (a: ReturnType<typeof skaterAttrs>) => (lowD ? { ...a, df: Math.round(a.df * 0.6), ph: Math.round(a.ph * 0.3) } : a);
  const simTeamOf = (t: AsTeam, simId: number) => {
    const r = t.roster!;
    const sks = [...r.F, ...r.D].map((id) => byId.get(id)).filter((p): p is NonNullable<typeof p> => !!p);
    const gs = [t.starter!, ...r.G.filter((g) => g !== t.starter)].map((id) => byId.get(id)).filter((p): p is NonNullable<typeof p> => !!p);
    const pos = (p: (typeof sks)[number]) => (r.D.includes(p.id) ? "D" : (p.position && !isD(p.position) ? p.position : "C"));
    const skaters = sks.map((p) => buildSkater({ id: p.id, name: p.name, position: pos(p), overall: p.overall, attrs: soft(skaterAttrs(p)), con: 100, morale: 90, weight: p.weight ?? 200, shoots: p.shoots }));
    const goalies = gs.map((g) => buildGoalie({ id: g.id, name: g.name, overall: g.overall, attrs: goalieAttrs(g.goalieRating ?? g), con: 100, morale: 90 }));
    // an 11-man roster only uses its 3-on-3 units, goalies and shootout order
    const lines = autoLines(sks.map((p) => ({ id: p.id, position: pos(p), overall: p.overall ?? 50, shoots: p.shoots, df: p.df })), gs.map((g) => ({ id: g.id, overall: g.overall ?? 50 })));
    lines.situations.overtime = t.units!.map((u, i) => ({ players: u, timePct: [40, 33, 27][i] ?? 30 }));
    lines.situations.others.starter = gs[0]?.id ?? null;
    lines.situations.others.backup = gs[1]?.id ?? null;
    lines.situations.others.shootout = [...t.shootout, null, null, null, null, null].slice(0, 5);
    return buildTeam({ id: simId, name: t.name, code: t.key, skaters, goalies, lines, chemBase: 100 });
  };
  const idOf: Record<DivKey, number> = { ATL: -1, MET: -2, CEN: -3, PAC: -4 };
  const keyOfId = (id: number) => (Object.entries(idOf).find(([, v]) => v === id)![0] as DivKey);
  const nm = (id: number) => cleanName(byId.get(id)?.name ?? "?");
  const play = (round: AsGame["round"], a: DivKey, b: DivKey, gameSeed: number): AsGame => {
    const ta = teams.find((t) => t.key === a)!, tb = teams.find((t) => t.key === b)!;
    const res = simulateGame(simTeamOf(ta, idOf[a]), simTeamOf(tb, idOf[b]), { seed: gameSeed, settings: asSettings, threeOnThree: { periods: 2, periodSeconds: HALF_SECONDS, ...(lowD ? { chanceMult: 3, finishMult: 1.4 } : { chanceMult: 2 }) } });
    return {
      round, a, b, scoreA: res.home.goals, scoreB: res.away.goals, endedIn: res.endedIn, shotsA: res.home.shots, shotsB: res.away.shots, winner: keyOfId(res.winner),
      goals: res.goals.filter((g) => g.strength !== "SO").map((g) => ({ period: g.period, time: g.time, team: keyOfId(g.team), scorer: nm(g.scorer), scorerId: g.scorer, assists: g.assists.map(nm) })),
      shootout: res.shootout.map((s) => ({ team: keyOfId(s.teamId), shooter: cleanName(s.shooterName), result: s.result })),
      skaters: [...res.home.skaters, ...res.away.skaters].map((l) => ({ id: l.id, name: cleanName(l.name), team: teamOf.get(l.id)!, g: l.goals, a: l.assists, p: l.points })),
      goalies: [res.home.goalie, res.home.backupGoalie, res.away.goalie, res.away.backupGoalie].filter((g): g is NonNullable<typeof g> => !!g && g.started).map((g) => ({ id: g.id, name: cleanName(g.name), team: teamOf.get(g.id)!, sa: g.shotsAgainst, sv: g.saves })),
    };
  };
  const sf1 = play("SF1", "ATL", "MET", seed + 1);
  const sf2 = play("SF2", "CEN", "PAC", seed + 2);
  const fin = play("F", sf1.winner, sf2.winner, seed + 3);

  // MVP: the champions' top scorer over the tournament (goals, then final-game points break ties)
  const tot = new Map<number, AsSkaterLine>();
  for (const g of [sf1, sf2, fin]) for (const s of g.skaters) { const t = tot.get(s.id) ?? { ...s, g: 0, a: 0, p: 0 }; t.g += s.g; t.a += s.a; t.p += s.p; tot.set(s.id, t); }
  const finalPts = new Map(fin.skaters.map((s) => [s.id, s.p]));
  const best = [...tot.values()].filter((s) => s.team === fin.winner).sort((x, y) => y.p - x.p || y.g - x.g || (finalPts.get(y.id) ?? 0) - (finalPts.get(x.id) ?? 0))[0] ?? null;
  const mvpRow = best ? byId.get(best.id) : null;
  const mvpClubCode = mvpRow?.team?.isAffiliate ? (mvpRow.team.parentTeam?.code ?? null) : (mvpRow?.team?.code ?? null);
  const tournament: AllStarTournament = { games: [sf1, sf2, fin], champion: fin.winner, mvp: best ? { ...best, clubCode: mvpClubCode } : null, mvpPick: null, seed };

  // MVP bonus pick for his (NHL) club — replaces any pick an earlier run of this event created
  if (ev.mvpBonusPickId) await prisma.draftBonusPick.deleteMany({ where: { id: ev.mvpBonusPickId } });
  let mvpBonusPickId: number | null = null;
  if (best && mvpRow && ev.mvpBonusRound >= 8) {
    const clubId = mvpRow.team?.isAffiliate ? mvpRow.team.parentTeamId : mvpRow.teamId;
    if (clubId) {
      const year = await currentDraftYear();
      const cfg = await prisma.leagueConfig.findUnique({ where: { id: 1 }, select: { rosterMode: true } });
      const pick = await prisma.draftBonusPick.create({ data: { year, round: ev.mvpBonusRound, teamId: clubId, reason: `All-Star MVP — ${best.name}`.slice(0, 120), source: cfg?.rosterMode === "real" ? "real" : "profinhl" } });
      mvpBonusPickId = pick.id;
      tournament.mvpPick = { year, round: ev.mvpBonusRound, clubCode: mvpClubCode };
    }
  }

  await prisma.allStarEvent.update({ where: { id: ev.id }, data: { skills: skills as object, game: tournament as object, status: "DONE", mvpBonusPickId } });
  if (opts.publish !== false && !ev.resultsPublished) await publishResults(ev.id);
  return tournament;
}

export const nameOfDiv = (teams: AsTeam[], k: DivKey) => teams.find((t) => t.key === k)?.name ?? k;

async function publishResults(eventId: number) {
  const ev = await prisma.allStarEvent.findUnique({ where: { id: eventId } });
  if (!ev?.game) return;
  const g = ev.game as AllStarTournament;
  const s = ev.skills as SkillsResult | null;
  const teams = teamsOf(ev);
  const esc = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const line = (x: AsGame) => `${nameOfDiv(teams, x.a)} ${x.scoreA}–${x.scoreB} ${nameOfDiv(teams, x.b)}${x.endedIn === "SO" ? " (SO)" : ""}`;
  const fin = g.games.find((x) => x.round === "F")!;
  const body = [
    `<p><b>${esc(nameOfDiv(teams, g.champion))}</b> win the ${esc(ev.title)}!</p>`,
    `<h2>🏒 3-on-3 tournament</h2><ul>${g.games.map((x) => `<li>${x.round === "F" ? "<b>Final:</b> " : "Semi-final: "}${esc(line(x))}</li>`).join("")}</ul>`,
    g.mvp ? `<h2>🏆 MVP</h2><p>${esc(g.mvp.name)} (${esc(g.mvp.clubCode ?? "")}) — ${g.mvp.g}G ${g.mvp.a}A over the tournament.${g.mvpPick ? ` ${esc(g.mvpPick.clubCode ?? "His club")} earns a bonus round-${g.mvpPick.round} pick in the ${g.mvpPick.year} draft.` : ""}</p>` : "",
    s ? `<h2>🎯 Skills Competition</h2><ul>${s.events.map((e) => `<li><b>${esc(e.title)}:</b> ${e.winner ? `${esc(e.winner.name)} (${esc(e.winner.teamCode ?? "")}) — ${esc(e.winner.display)}` : "—"}</li>`).join("")}</ul>` : "",
    `<p>Full results on the <a href="/all-star">All-Star page</a>.</p>`,
  ].join("");
  const author = await prisma.team.findFirst({ where: { isAdmin: true }, orderBy: { id: "asc" }, select: { id: true } });
  if (author) await prisma.newsArticle.create({ data: { authorTeamId: author.id, title: `⭐ ${ev.title} — results`, bodyHtml: body } });
  await prisma.transaction.create({ data: { type: "NEWS", message: `⭐ All-Star: ${nameOfDiv(teams, g.champion)} win it all — final ${line(fin)}${g.mvp ? `, MVP ${g.mvp.name}${g.mvpPick ? ` (${g.mvpPick.clubCode} gets a round-${g.mvpPick.round} bonus pick)` : ""}` : ""}. → /all-star` } });
  await prisma.allStarEvent.update({ where: { id: eventId }, data: { resultsPublished: true } });
}

/** Clear results (keeps nominations + lineups) and take back the MVP bonus pick. */
export async function clearResults(eventId: number): Promise<void> {
  const ev = await prisma.allStarEvent.findUnique({ where: { id: eventId } });
  if (!ev) return;
  if (ev.mvpBonusPickId) await prisma.draftBonusPick.deleteMany({ where: { id: ev.mvpBonusPickId } });
  const { Prisma } = await import("@prisma/client");
  await prisma.allStarEvent.update({ where: { id: eventId }, data: { skills: Prisma.DbNull, game: Prisma.DbNull, status: "SCHEDULED", resultsPublished: false, mvpBonusPickId: null } });
}

// ---------------------------------------------------------------------------
// messages + cron
// ---------------------------------------------------------------------------

const fmt = (d: Date) => d.toLocaleString("sk-SK", { timeZone: "Europe/Bratislava", dateStyle: "medium", timeStyle: "short" });
async function notify(teamId: number, body: string, url: string) {
  await prisma.dmMessage.create({ data: { fromTeamId: teamId, toTeamId: teamId, body, tradeUrl: url } }).catch(() => {});
}

/** Message every human-run club: nominate 3F/2D/1G (the message carries the form). */
export async function sendNominationMessages(eventId: number): Promise<number> {
  const ev = await prisma.allStarEvent.findUnique({ where: { id: eventId } });
  if (!ev) return 0;
  const clubs = await prisma.team.findMany({ where: { league: "NHL", isAffiliate: false, passwordHash: { not: null } }, select: { id: true } });
  for (const c of clubs) await notify(c.id, `⭐ ${ev.title} — nominate your All-Stars! Pick 3 forwards, 2 defensemen and 1 goalie from your roster by ${fmt(ev.votingClosesAt ?? ev.eventAt)}. Each division's coach-GM then picks an 11-man team for the 3-on-3 tournament on ${fmt(ev.eventAt)}.`, "/all-star/nominate");
  await prisma.allStarEvent.update({ where: { id: eventId }, data: { votingAnnounced: true } });
  await prisma.commissionerAnnouncement.create({ data: { body: `⭐ All-Star nominations are open until ${fmt(ev.votingClosesAt ?? ev.eventAt)} — every GM nominates 3F / 2D / 1G from his roster.`, linkUrl: "/all-star/nominate", linkLabel: "Nominate", active: true } }).catch(() => {});
  return clubs.length;
}

export async function notifyCoaches(ev: Ev): Promise<number> {
  let n = 0;
  for (const t of teamsOf(ev)) {
    if (!t.coachTeamId) continue;
    await notify(t.coachTeamId, `📋 You're coaching ${t.name} at the ${ev.title}! Pick 6 F / 3 D / 2 G from your division's nominees (every club needs at least one All-Star), set three 3-on-3 units, your starting goalie and the shootout order by ${fmt(coachDeadline(ev))}. Anything left unset is filled in automatically.`, "/all-star/coach");
    n++;
  }
  return n;
}

/** Cron hook (every ~5 min). Idempotent: each stage fires once. */
export async function runAllStarIfDue(now = new Date()): Promise<string | null> {
  const ev = await latestEvent().catch(() => null);
  if (!ev || ev.status === "DONE") return null;
  const ph = phaseOf(ev, now);
  if (ph === "nominations" && !ev.votingAnnounced) { const n = await sendNominationMessages(ev.id); return `nomination messages sent (${n})`; }
  if ((ph === "coaches" || ph === "ready") && !ev.nominationsClosed) {
    const n = await closeNominations(ev.id);
    await notifyCoaches(ev);
    return `nominations closed (${n} auto-filled), coaches notified`;
  }
  if (now >= ev.eventAt) { await runAllStar(ev.id); return "event played"; }
  return null;
}
