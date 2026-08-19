"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { canManageTeam, getTeamSession, isAdmin, isComishTier } from "@/lib/auth";
import { getLeagueClock, getLeagueDate } from "@/lib/calendar-server";
import { addDays } from "@/lib/calendar";
import { CURRENT_SEASON_START, capCeilingForPhase, ltirRelief } from "@/lib/finance";
import {
  loadMarketPool, teamContentionMap, teamAsk, evaluateTeamOffer, loadLeagueCap, weakestTeams,
} from "@/lib/free-agency-server";
import { MAX_TERM, faPosGroup, willingnessNote, twoWayObjection, type Deployment } from "@/lib/free-agency";
import { loadSettings } from "@/lib/sim/settings";
import { computeELC } from "@/lib/elc";

/** Commissioner-tuned two-way thresholds, shaped for twoWayObjection's opts. */
async function twoWayOpts(): Promise<{ olderAge: number; gpLimit: number; maxYears: number; relaxRound: number; faMode: "full" | "simple" }> {
  const s = await loadSettings();
  return { olderAge: s.faTwoWayOlderAge, gpLimit: s.faTwoWayNhlGpLimit, maxYears: s.faTwoWayMaxYears, relaxRound: s.faTwoWayRelaxRound, faMode: s.faMode };
}

const FREE = ["NHL", "AHL", "RETIRED", "PROSPECT", "RELEASED"]; // not a signable free agent
// In-season UFA market mirrors the summer frenzy in miniature, PER PLAYER: he collects
// offers for a week, then counters the bidders and gives them a few days to match.
const IN_SEASON_COLLECT_DAYS = 7;
const IN_SEASON_MATCH_DAYS = 3;
const ACTIVE = ["PENDING", "COUNTERED", "SHORTLISTED"]; // an offer still in contention
const SHORTLIST_SIZE = 3; // how many suitors a player keeps into the final week

/** A team's committed NHL cap hit (+ retention/buyout dead money) and its LTIR
 *  relief (cap hits of skaters injured below CON 90). The effective ceiling is
 *  the phase ceiling + LTIR relief. */
async function teamCapInfo(teamId: number): Promise<{ committed: number; ltir: number }> {
  const roster = await prisma.player.findMany({
    where: { teamId, rosterType: "NHL" }, select: { capHit: true, injuryDaysLeft: true, condition: true, isGoalie: true },
  });
  const salaries = roster.reduce((t, p) => t + (p.capHit ?? 0), 0);
  const team = await prisma.team.findUnique({ where: { id: teamId }, select: { retainsBuyouts: true } });
  return { committed: salaries + (team?.retainsBuyouts ?? 0), ltir: ltirRelief(roster) };
}

/** Interest feedback: what this player wants to sign at a given club right now. */
export async function getInterestAction(playerId: number, teamId: number) {
  const info = await teamAsk(playerId, teamId);
  if (!info) return { ok: false as const, error: "Player not found." };
  const player = await prisma.player.findUnique({ where: { id: playerId }, select: { name: true } });
  const existing = await prisma.faOffer.findUnique({ where: { playerId_teamId: { playerId, teamId } } });
  return {
    ok: true as const,
    name: player?.name ?? "",
    grp: info.grp,
    slot: info.slot,
    line: info.line,
    contention: info.contention,
    wantPP: info.desired.wantPP,
    wantPK: info.desired.wantPK,
    askSalary: info.ask.salary,
    askYears: info.ask.years,
    floor: info.ask.floorSalary,
    minYears: info.ask.minYears,
    maxYears: info.ask.maxYears,
    moraleNote: willingnessNote(info.ask.willingness),
    round: (await getLeagueClock()).frenzyRound,
    existing: existing ? {
      salary: existing.salary, years: existing.years, line: existing.line, pp: existing.pp, pk: existing.pk,
      status: existing.status, counterSalary: existing.counterSalary, counterYears: existing.counterYears,
    } : null,
  };
}

/** The player's ask at a SPECIFIC promised deployment (line + PP/PK) — a worse
 *  role / stripped special-teams raises it. Used to live-update the offer modal. */
export async function getAskAtAction(playerId: number, teamId: number, line: number, pp: boolean, pk: boolean, grantClause?: string | null, mNtcBreadth?: number | null) {
  const clause = grantClause && ["NTC", "NMC", "M_NTC"].includes(grantClause) ? grantClause : null;
  const breadth = clause === "M_NTC" ? ([6, 12, 18, 24].includes(mNtcBreadth ?? 0) ? mNtcBreadth! : 12) : null;
  const ev = await evaluateTeamOffer(playerId, teamId, 0, 1, { line: clampLine(line), pp, pk }, undefined, undefined, undefined, { clause, breadth });
  if (!ev) return null;
  return { askSalary: ev.ask.salary, askYears: ev.ask.years, floor: ev.ask.floorSalary, minYears: ev.ask.minYears, maxYears: ev.ask.maxYears };
}

/** All standing offers on a player (open frenzy — GMs can see the competition). */
export async function getPlayerOffersAction(playerId: number) {
  // blind bidding: only the commissioner sees the competing offers; a GM never
  // sees what other clubs have bid.
  if (!(await isAdmin())) return [];
  const offers = await prisma.faOffer.findMany({
    where: { playerId, status: { in: ACTIVE } }, orderBy: { salary: "desc" },
  });
  if (offers.length === 0) return [];
  const teams = await prisma.team.findMany({
    where: { id: { in: offers.map((o) => o.teamId) } }, select: { id: true, code: true },
  });
  const codeOf = new Map(teams.map((t) => [t.id, t.code]));
  return offers.map((o) => ({
    teamId: o.teamId, teamCode: codeOf.get(o.teamId) ?? "?",
    salary: o.salary, years: o.years, line: o.line, pp: o.pp, pk: o.pk,
    placedAt: o.createdAt.toISOString(),   // when the offer first landed
    updatedAt: o.updatedAt.toISOString(),  // last raised/changed
  }));
}

/** Place or raise a team's standing offer to a free agent (money + term + promised usage). */
export async function submitOfferAction(
  playerId: number, teamId: number, salary: number, years: number, line: number, pp: boolean, pk: boolean,
  grantClause?: string | null, mNtcBreadth?: number | null, offerTwoWay?: boolean,
) {
  if (!(await canManageTeam(teamId))) return { ok: false as const, error: "You don't manage this team." };
  const clock = await getLeagueClock();
  const win = clock.faWindow;
  if (!win.open) return { ok: false as const, error: "The free-agent market is closed." };
  // comish-tier head-start (July Frenzy only): the first day of each round is the
  // commissioner's office only (they bid before they can see anything), GMs join day 2.
  if (!win.immediate) {
    const dayInRound = clock.frenzyDay >= 1 ? ((clock.frenzyDay - 1) % 7) + 1 : 1;
    if (dayInRound === 1 && !(await isComishTier())) {
      return { ok: false as const, error: "This round opens for GMs tomorrow — the commissioner's office gets the first day." };
    }
  }

  const player = await prisma.player.findUnique({ where: { id: playerId }, select: { name: true, rosterType: true, overall: true, realFarmTeamId: true, age: true, lastSeasonGP: true, teamId: true, faDecisionAt: true, faCountered: true } });
  if (!player) return { ok: false as const, error: "Player not found." };
  if (player.rosterType && FREE.includes(player.rosterType)) {
    return { ok: false as const, error: "This player is not a free agent." };
  }
  // playoffs: a club may only re-sign its OWN pending UFAs, not shop the market.
  if (win.ownOnly && player.teamId !== teamId) {
    return { ok: false as const, error: "During the playoffs you can only re-sign your own UFAs — the open market is closed." };
  }
  if (salary < 775_000) return { ok: false as const, error: "Below the league minimum salary." };
  years = Math.max(1, Math.min(MAX_TERM, Math.round(years)));
  // one-way vs two-way: an established older player refuses — UNLESS the market has
  // gone cold for him (round 2+ and he drew no round-1 offer), when he'll settle.
  const twoWay = !!offerTwoWay;
  const tw = await twoWayOpts();
  let relaxOlder = false;
  if (twoWay && clock.frenzyRound >= tw.relaxRound) {
    const r1 = await prisma.faOffer.count({ where: { playerId, round: 1, status: { in: ["PENDING", "COUNTERED", "SHORTLISTED", "ACCEPTED"] } } });
    relaxOlder = r1 === 0;
  }
  const twoWayErr = twoWayObjection(twoWay, player, years, { relaxOlder, olderAge: tw.olderAge, gpLimit: tw.gpLimit, maxYears: tw.maxYears });
  if (twoWayErr) return { ok: false as const, error: twoWayErr };

  // cap check — committed cap hit + this offer must stay under the ceiling
  const cap = await loadLeagueCap();
  const { committed, ltir } = await teamCapInfo(teamId);
  const existing = await prisma.faOffer.findUnique({ where: { playerId_teamId: { playerId, teamId } } });
  if (existing && existing.status === "REJECTED") {
    return { ok: false as const, error: "The player has moved on — he's no longer negotiating with your club." };
  }
  // round-lock (July Frenzy only): only clubs already in the negotiation (an offer
  // placed in round 1) may continue; nobody new joins from round 2 onward. In-season
  // signing is immediate, so there are no rounds to lock.
  if (!win.immediate) {
    if (!existing && clock.frenzyRound > 1) {
      return { ok: false as const, error: "Bidding on this player closed after round 1 — only clubs already negotiating can raise their offer." };
    }
    if (existing && existing.round === clock.frenzyRound && existing.status !== "REJECTED") {
      return { ok: false as const, error: "You've already made your offer this round — wait for the next round to change it." };
    }
  }
  // In-season counter phase: once he's countered his suitors, no NEW club may jump in —
  // only clubs already negotiating can raise to match (mirrors the July round-lock).
  if (win.immediate && !win.ownOnly && player.faCountered && !existing) {
    return { ok: false as const, error: "He's already deciding among his current suitors — bidding is closed to new clubs." };
  }
  const ceiling = capCeilingForPhase(cap.upper, clock.phase) + ltir;
  if (committed + salary > ceiling) {
    const overSeason = clock.phase === "regular" || clock.phase === "playoffs";
    return { ok: false as const, error: overSeason
      ? `Over the cap — you have ${fmtM(cap.upper - committed)} of space, this offer is ${fmtM(salary)}.`
      : `Over the off-season ceiling (cap +10%) — ${fmtM(ceiling - committed)} of room left, this offer is ${fmtM(salary)}. You must be cap-compliant by opening day.` };
  }

  const clause = grantClause && ["NTC", "NMC", "M_NTC"].includes(grantClause) ? grantClause : null;
  const breadth = clause === "M_NTC" ? ([6, 12, 18, 24].includes(mNtcBreadth ?? 0) ? mNtcBreadth! : 12) : null;
  const dep: Deployment = { line: clampLine(line), pp, pk };
  const evalr = await evaluateTeamOffer(playerId, teamId, salary, years, dep, undefined, undefined, undefined, { clause, breadth });
  // a raise re-enters contention; a shortlisted offer stays shortlisted
  const newStatus = existing?.status === "SHORTLISTED" ? "SHORTLISTED" : "PENDING";

  const offer = await prisma.faOffer.upsert({
    where: { playerId_teamId: { playerId, teamId } },
    update: { salary, years, line: dep.line, pp, pk, status: newStatus, round: clock.frenzyRound, grantClause: clause, mNtcBreadth: breadth, twoWay },
    create: { playerId, teamId, salary, years, line: dep.line, pp, pk, round: clock.frenzyRound, grantClause: clause, mNtcBreadth: breadth, twoWay },
  });

  // In-season OPEN MARKET: he does NOT sign on the spot. He takes a week to weigh the
  // offers (more clubs can bid in that time); when the window closes he counters the
  // bidders and gives them a few days to match, then signs the best — the summer UFA
  // market in miniature, per player. The standing offer is kept for the resolver.
  if (win.immediate && !win.ownOnly) {
    if (!player.faDecisionAt) {
      await prisma.player.update({ where: { id: playerId }, data: { faDecisionAt: addDays(await getLeagueDate(), IN_SEASON_COLLECT_DAYS), faCountered: false } });
    }
    const decideAt = player.faDecisionAt ?? addDays(await getLeagueDate(), IN_SEASON_COLLECT_DAYS);
    revalidatePath("/free-agents");
    return {
      ok: true as const, deliberating: true as const, raised: !!existing,
      decisionAt: decideAt.toISOString(), countered: player.faCountered,
      clears: evalr?.acceptable ?? false,
      floor: evalr?.ask.floorSalary ?? 0,
      askYears: evalr ? { min: evalr.ask.minYears, max: evalr.ask.maxYears } : null,
    };
  }

  // Playoffs "own UFAs only" re-sign: immediate — it's your own player, no competition.
  if (win.immediate) {
    if (evalr?.acceptable) {
      const code = await signFaOffer(playerId, { name: player.name, age: player.age }, offer, salary, years, player.teamId ?? undefined);
      if (code === null) {
        await prisma.faOffer.deleteMany({ where: { playerId, teamId } });
        return { ok: false as const, error: "Another club just signed this player." };
      }
      revalidatePath("/free-agents");
      revalidatePath(`/teams`);
      return { ok: true as const, signed: true as const, clears: true as const };
    }
    await prisma.faOffer.deleteMany({ where: { playerId, teamId } });
    revalidatePath("/free-agents");
    return {
      ok: true as const, signed: false as const, clears: false as const,
      floor: evalr?.ask.floorSalary ?? 0,
      askYears: evalr ? { min: evalr.ask.minYears, max: evalr.ask.maxYears } : null,
    };
  }

  revalidatePath("/free-agents");
  return {
    ok: true as const,
    raised: !!existing,
    clears: evalr?.acceptable ?? false,
    floor: evalr?.ask.floorSalary ?? 0,
    askYears: evalr ? { min: evalr.ask.minYears, max: evalr.ask.maxYears } : null,
  };
}

export async function withdrawOfferAction(playerId: number, teamId: number) {
  if (!(await canManageTeam(teamId))) return { ok: false as const, error: "You don't manage this team." };
  await prisma.faOffer.deleteMany({ where: { playerId, teamId } });
  revalidatePath("/free-agents");
  return { ok: true as const };
}

/** Resolve the frenzy: every unsigned FA with pending offers signs the best one
 *  (highest utility that clears his team-specific floor + term). Called when the
 *  7-day window closes, or manually by an admin. */
export async function resolveFrenzyAction() {
  if (!(await isAdmin())) return { ok: false as const, error: "Only a league admin can resolve the frenzy." };
  // a manual resolve judges at the CURRENT round (a round-1 resolve keeps the high
  // ask, so nobody signs for a below-ask lowball); the natural window close is round 3.
  const round = (await getLeagueClock()).frenzyRound || 3;
  const result = await resolveFrenzy(round);
  for (const p of ["/free-agents", "/signings", "/teams", "/finance", "/calendar"]) revalidatePath(p);
  return { ok: true as const, ...result };
}

/** Admin: manually run the current negotiation round's end (counters after R1,
 *  shortlisting after R2) without waiting for the calendar to cross the week. */
export async function processRoundEndAction() {
  if (!(await isAdmin())) return { ok: false as const, error: "Only a league admin can advance the frenzy." };
  const clock = await getLeagueClock();
  if (!clock.frenzyOpen || clock.frenzyRound >= 3) return { ok: false as const, error: "Rounds run in weeks 1 and 2 — the final week resolves by signing." };
  const r = await processRoundEnd(clock.frenzyRound);
  // the round is calendar-driven (a week each) — advance the clock a week so the
  // frenzy visibly moves to the next round (off-season: no games to sim).
  const { addDays } = await import("@/lib/calendar");
  const { getLeagueDate } = await import("@/lib/calendar-server");
  const next = addDays(await getLeagueDate(), 7);
  await prisma.leagueConfig.upsert({ where: { id: 1 }, update: { leagueDate: next }, create: { id: 1, leagueDate: next } });
  for (const p of ["/free-agents", "/signings", "/calendar", "/"]) revalidatePath(p);
  return { ok: true as const, ...r, round: clock.frenzyRound };
}

type FaOfferRow = Awaited<ReturnType<typeof prisma.faOffer.findMany>>[number];

/** Execute a signing: move the player to the club on `o` at (salary × years),
 *  accept that offer, reject the rest, log it. Returns the club code. */
async function signFaOffer(playerId: number, player: { name: string; age: number | null }, o: FaOfferRow, salary: number, years: number, expectedTeamId?: number): Promise<string | null> {
  const twoWay = o.twoWay ?? ((player.age ?? 27) <= 24 && salary <= 3_000_000);
  const expiry = CURRENT_SEASON_START + years;
  const clause = o.grantClause && ["NTC", "NMC", "M_NTC"].includes(o.grantClause) ? o.grantClause : null;
  const noTradeTeams = clause === "M_NTC" ? await weakestTeams(o.mNtcBreadth ?? 12, o.teamId) : [];
  // snapshot the pre-signing contract so an admin can revert this signing later
  const prev = await prisma.player.findUnique({ where: { id: playerId }, select: { capHit: true, contractYears: true, contractExpiry: true, contractType: true, tradeClause: true, noTradeTeams: true, rosterType: true, teamId: true, contractText: true } });
  const data = {
    teamId: o.teamId, rosterType: "NHL",
    capHit: salary, contractYears: years, contractExpiry: expiry,
    contractType: twoWay ? "TWO_WAY" : "ONE_WAY",
    contractText: `$${salary.toLocaleString("en-US")} × ${years}yr (through ${expiry})`,
    signPromiseLine: o.line, signPromisePP: o.pp, signPromisePK: o.pk,
    tradeClause: clause, noTradeTeams,
    disgruntled: false, tradeRequested: false, promiseWarnGame: null,
  };
  // race guard (in-season immediate path): only sign if the player is still where he
  // was when we evaluated — a simultaneous signing by another club would have moved him.
  if (expectedTeamId !== undefined) {
    const res = await prisma.player.updateMany({ where: { id: playerId, teamId: expectedTeamId }, data });
    if (res.count === 0) return null; // lost the race — already signed elsewhere
  } else {
    await prisma.player.update({ where: { id: playerId }, data });
  }
  // keep the signed round on the accepted offer (its `round`) for the signings report
  await prisma.faOffer.update({ where: { id: o.id }, data: { status: "ACCEPTED", salary, years } });
  await prisma.faOffer.updateMany({ where: { playerId, id: { not: o.id }, status: { in: ACTIVE } }, data: { status: "REJECTED" } });
  const team = await prisma.team.findUnique({ where: { id: o.teamId }, select: { code: true } });
  await prisma.signingLog.create({ data: {
    playerId, playerName: player.name, teamCode: team?.code ?? null, kind: "SIGN", salary, years,
    prevCapHit: prev?.capHit != null ? Math.round(prev.capHit) : null, prevYears: prev?.contractYears ?? null, prevExpiry: prev?.contractExpiry ?? null,
    prevType: prev?.contractType ?? null, prevClause: prev?.tradeClause ?? null, prevNoTrade: prev?.noTradeTeams ?? [],
    prevRosterType: prev?.rosterType ?? null, prevTeamId: prev?.teamId ?? null, prevContractText: prev?.contractText ?? null,
  } });
  await prisma.transaction.create({
    data: { type: "SIGNING", message: `${team?.code ?? "?"} signed ${player.name} — $${(salary / 1e6).toFixed(2)}M × ${years}yr` },
  });
  return team?.code ?? "?";
}

/** Best acceptable offer for a player at `judgeRound`; with `allowSoleFloor`, a lone
 *  suitor whose offer fell short signs at the player's floor (cap-permitting). Signs
 *  and returns a detail string, or null if nobody cleared his bar. */
async function pickAndSign(
  playerId: number, player: { name: string; age: number | null }, offers: FaOfferRow[],
  judgeRound: number, pool: Awaited<ReturnType<typeof loadMarketPool>>, cmap: Awaited<ReturnType<typeof teamContentionMap>>,
  allowSoleFloor: boolean,
): Promise<string | null> {
  let best: { offer: FaOfferRow; salary: number; years: number; utility: number } | null = null;
  let soleEv: Awaited<ReturnType<typeof evaluateTeamOffer>> = null;
  for (const o of offers) {
    const ev = await evaluateTeamOffer(playerId, o.teamId, o.salary, o.years, { line: o.line, pp: o.pp, pk: o.pk }, pool, cmap, judgeRound, { clause: o.grantClause, breadth: o.mNtcBreadth });
    if (offers.length === 1) soleEv = ev;
    if (ev?.acceptable && (!best || ev.utility > best.utility)) best = { offer: o, salary: o.salary, years: o.years, utility: ev.utility };
  }
  if (!best && allowSoleFloor && offers.length === 1 && soleEv) {
    const o = offers[0];
    const askSalary = soleEv.ask.floorSalary;
    const info = await teamCapInfo(o.teamId);
    const cap = await loadLeagueCap();
    const ceiling = capCeilingForPhase(cap.upper, (await getLeagueClock()).phase) + info.ltir;
    if (info.committed + askSalary <= ceiling) best = { offer: o, salary: askSalary, years: Math.min(Math.max(o.years, soleEv.ask.minYears), soleEv.ask.maxYears), utility: 0 };
  }
  if (!best) return null;
  const code = await signFaOffer(playerId, player, best.offer, best.salary, best.years);
  if (code === null) return null; // already signed elsewhere (shouldn't happen in the single-threaded resolver)
  return `${player.name} → ${code} ($${(best.salary / 1e6).toFixed(2)}M × ${best.years}yr)`;
}

/** Shared resolution used by the admin button and by the calendar when the window closes. */
export async function resolveFrenzy(judgeRound = 3): Promise<{ signed: number; details: string[] }> {
  const pool = await loadMarketPool();
  const cmap = await teamContentionMap();
  const pending = await prisma.faOffer.findMany({ where: { status: { in: ACTIVE } } });

  const byPlayer = new Map<number, typeof pending>();
  for (const o of pending) {
    const arr = byPlayer.get(o.playerId) ?? [];
    arr.push(o); byPlayer.set(o.playerId, arr);
  }

  const details: string[] = [];
  let signed = 0;

  for (const [playerId, offers] of byPlayer) {
    const player = await prisma.player.findUnique({ where: { id: playerId }, select: { name: true, rosterType: true, age: true } });
    if (!player || (player.rosterType && ["NHL", "AHL", "RETIRED"].includes(player.rosterType))) continue; // already signed / retired
    // best acceptable at the round being resolved; a lone suitor falls back to his floor
    const detail = await pickAndSign(playerId, player, offers, judgeRound, pool, cmap, true);
    if (detail) { details.push(detail); signed++; }
  }
  return { signed, details };
}

async function clearFaWindow(playerId: number) {
  await prisma.player.update({ where: { id: playerId }, data: { faDecisionAt: null, faCountered: false } });
}

/** In-season UFA market resolver — runs on each day advance. For every free agent whose
 *  deliberation window has closed:
 *   • phase 1 (collected offers for a week): he does NOT sign yet — he COUNTERS every
 *     serious bidder (asks for their best) and opens the match window; hopeless lowballs
 *     are dropped. Each bidder is DM'd his counter.
 *   • phase 2 (match window elapsed): sign the best offer (a lone suitor falls back to his
 *     floor); the winning GM + every other bidder are notified by DM. If nobody met his
 *     ask, he stays on the market.
 *  Only human-GM offers exist here — AI clubs don't bid the in-season market. */
export async function resolveInSeasonWindows(asOf: Date): Promise<{ signed: number; countered: number; details: string[] }> {
  const due = await prisma.player.findMany({
    where: { faDecisionAt: { not: null, lte: asOf }, rosterType: { notIn: FREE } },
    select: { id: true, name: true, age: true, faCountered: true, teamId: true },
  });
  if (due.length === 0) return { signed: 0, countered: 0, details: [] };
  const pool = await loadMarketPool();
  const cmap = await teamContentionMap();
  let signed = 0, countered = 0; const details: string[] = [];
  const nice = (s: string) => s.replace(/''[A-Za-z]''|\s*\([^)]*\)/g, "").trim();
  const agentDm = async (fromFa: number, toTeamId: number, body: string) => {
    await prisma.dmMessage.create({ data: { fromTeamId: fromFa, toTeamId, body, tradeUrl: "/free-agents" } }).catch(() => {});
  };
  for (const p of due) {
    const offers = await prisma.faOffer.findMany({ where: { playerId: p.id, status: { in: ACTIVE } } });
    if (offers.length === 0) { await clearFaWindow(p.id); continue; }
    const player = { name: p.name, age: p.age };
    const faId = p.teamId; // "Free Agents" holding club → the agent's DM sender
    const nm = nice(p.name);
    if (!p.faCountered) {
      // Phase 1 — the player does NOT sign on the spot even if an offer clears. He counters
      // every serious bidder ("submit your best") and gives them the match window; hopeless
      // lowballs are dropped. This guarantees a real second round.
      // Evaluate all offers first, then leverage the competition: with multiple bids the
      // counter is anchored ABOVE the best standing offer (never below it) — a bidding war
      // pushes his price UP, it never asks for less than someone already offered.
      const round50k = (v: number) => Math.max(775_000, Math.round(v / 50_000) * 50_000);
      const evd = [] as { o: (typeof offers)[number]; ev: Awaited<ReturnType<typeof evaluateTeamOffer>> }[];
      for (const o of offers) evd.push({ o, ev: await evaluateTeamOffer(p.id, o.teamId, o.salary, o.years, { line: o.line, pp: o.pp, pk: o.pk }, pool, cmap, 2, { clause: o.grantClause, breadth: o.mNtcBreadth }) });
      const serious = evd.filter((x) => x.ev && x.o.salary >= x.ev.ask.floorSalary * 0.6);
      const bestOffer = serious.reduce((m, x) => Math.max(m, x.o.salary), 0);
      const leverage = serious.length >= 3 ? 1.10 : serious.length >= 2 ? 1.05 : 1.0; // more suitors → push higher
      let kept = 0;
      for (const { o, ev } of evd) {
        if (!ev) continue;
        if (o.salary < ev.ask.floorSalary * 0.6) {
          await prisma.faOffer.update({ where: { id: o.id }, data: { status: "REJECTED" } });
          await agentDm(faId, o.teamId, `❌ ${nm}'s camp passed on your offer — it wasn't close to his value.`);
        } else {
          // want: at least his value, at least the top bid × leverage, and always a raise
          // over this club's own offer — capped so it stays sane in a bidding war.
          const want = round50k(Math.min(Math.max(ev.ask.salary, bestOffer * leverage, o.salary * 1.03), bestOffer * 1.20));
          await prisma.faOffer.update({ where: { id: o.id }, data: { status: "COUNTERED", counterSalary: want, counterYears: ev.ask.years } });
          countered++; kept++;
          await agentDm(faId, o.teamId, `📩 ${nm} is weighing multiple offers — he decides in ${IN_SEASON_MATCH_DAYS} days. Put in your BEST offer: he wants about $${(want / 1e6).toFixed(2)}M × ${ev.ask.years}yr${serious.length >= 2 ? " (other clubs are also in — bidding is blind)" : ""}. Raise to stay in it.`);
        }
      }
      if (kept > 0) {
        await prisma.player.update({ where: { id: p.id }, data: { faCountered: true, faDecisionAt: addDays(asOf, IN_SEASON_MATCH_DAYS) } });
        await prisma.transaction.create({ data: { type: "FA_NEGOTIATION", message: `${nm} is deciding between multiple offers — his suitors have ${IN_SEASON_MATCH_DAYS} days to submit their best.` } });
      } else await clearFaWindow(p.id);
    } else {
      // Phase 2 — match window closed: he signs the best (a lone suitor → his floor). Notify
      // the winning GM (a message that pops on their screen) and every other bidder.
      const bidders = [...new Set(offers.map((o) => o.teamId))];
      const detail = await pickAndSign(p.id, player, offers, 3, pool, cmap, true);
      if (detail) {
        details.push(detail); signed++;
        const after = await prisma.player.findUnique({ where: { id: p.id }, select: { teamId: true } });
        const winner = after?.teamId ?? null;
        const names = new Map((await prisma.team.findMany({ where: { id: { in: [...bidders, winner ?? -1] } }, select: { id: true, name: true } })).map((t) => [t.id, t.name]));
        const winnerName = (winner != null && names.get(winner)) || "his new club";
        for (const tid of bidders) {
          if (tid === winner) await agentDm(faId, tid, `✅ ${nm} has SIGNED with you! He accepted your offer over the other clubs.`);
          else await agentDm(faId, tid, `🚫 ${nm} signed with ${winnerName} — he passed on your offer.`);
        }
      } else {
        await prisma.faOffer.updateMany({ where: { playerId: p.id, status: { in: ACTIVE } }, data: { status: "REJECTED" } });
        for (const tid of bidders) await agentDm(faId, tid, `${nm} didn't sign anyone — no offer met his ask. He stays on the market.`);
      }
      await clearFaWindow(p.id);
    }
  }
  return { signed, countered, details };
}

/** End-of-round processing for the multi-week frenzy. Called when the calendar
 *  crosses a weekly round boundary (or by the admin button).
 *  - after round 1: the player COUNTERS each standing offer (what he wants from
 *    that club at round-2 value) and drops hopeless lowballs.
 *  - after round 2: he SHORTLISTS his best suitors and tells the rest he's moving on.
 *  Round 3 ends by `resolveFrenzy` signing the best shortlisted offer. */
export async function processRoundEnd(endedRound: number): Promise<{ countered: number; eliminated: number; shortlisted: number; signed: number }> {
  const pool = await loadMarketPool();
  const cmap = await teamContentionMap();
  const nextRound = endedRound + 1;
  const offers = await prisma.faOffer.findMany({ where: { status: { in: ACTIVE } } });
  const byPlayer = new Map<number, typeof offers>();
  for (const o of offers) { const a = byPlayer.get(o.playerId) ?? []; a.push(o); byPlayer.set(o.playerId, a); }

  let countered = 0, eliminated = 0, shortlisted = 0, signedNow = 0;
  for (const [playerId, list] of byPlayer) {
    const player = await prisma.player.findUnique({ where: { id: playerId }, select: { name: true, rosterType: true, age: true } });
    if (!player || (player.rosterType && FREE.includes(player.rosterType))) continue;
    const name = player.name;

    // if a standing offer already meets his ask at THIS round, he signs now
    // (real 1st- / 2nd-round signings) — no waiting for the final week.
    const signDetail = await pickAndSign(playerId, player, list, endedRound, pool, cmap, false);
    if (signDetail) { signedNow++; continue; }

    // value every offer at the UPCOMING round
    const scored = [] as { o: (typeof list)[number]; ev: Awaited<ReturnType<typeof evaluateTeamOffer>> }[];
    for (const o of list) scored.push({ o, ev: await evaluateTeamOffer(playerId, o.teamId, o.salary, o.years, { line: o.line, pp: o.pp, pk: o.pk }, pool, cmap, nextRound, { clause: o.grantClause, breadth: o.mNtcBreadth }) });

    if (endedRound === 1) {
      // counter each team; drop the hopeless lowballs
      for (const { o, ev } of scored) {
        if (!ev) continue;
        const teamCode = (await prisma.team.findUnique({ where: { id: o.teamId }, select: { code: true } }))?.code ?? "?";
        if (o.salary < ev.ask.floorSalary * 0.6) {
          await prisma.faOffer.update({ where: { id: o.id }, data: { status: "REJECTED" } });
          await prisma.transaction.create({ data: { type: "FA_NEGOTIATION", message: `${name} passed on ${teamCode}'s offer — not close to his value.` } });
          eliminated++;
        } else {
          await prisma.faOffer.update({ where: { id: o.id }, data: { status: "COUNTERED", counterSalary: ev.ask.salary, counterYears: ev.ask.years } });
          countered++;
        }
      }
    } else if (endedRound === 2) {
      // a club "reacted" if it raised its offer in round 2 (a raise re-enters as
      // PENDING / round≥2); one left untouched stays COUNTERED from round 1.
      const reacted = (o: (typeof list)[number]) => o.status === "PENDING" || o.round >= 2;
      const anyReacted = list.some(reacted);
      // if ANYONE engaged, the clubs that ignored his counter are OUT; if nobody
      // engaged, they all carry into round 3 (he has no one better to turn to).
      const alive = anyReacted ? scored.filter((s) => reacted(s.o)) : scored;
      if (anyReacted) {
        for (const { o } of scored.filter((s) => !reacted(s.o))) {
          const teamCode = (await prisma.team.findUnique({ where: { id: o.teamId }, select: { code: true } }))?.code ?? "?";
          await prisma.faOffer.update({ where: { id: o.id }, data: { status: "REJECTED" } });
          await prisma.transaction.create({ data: { type: "FA_NEGOTIATION", message: `${name} moved on — ${teamCode} didn't respond to his counter.` } });
          eliminated++;
        }
      }
      // shortlist the best of the clubs still in
      const ranked = alive.filter((s) => s.ev).sort((a, b) => (b.ev!.utility) - (a.ev!.utility));
      const keep = new Set(ranked.slice(0, SHORTLIST_SIZE).map((s) => s.o.id));
      for (const { o } of alive) {
        if (keep.has(o.id)) { await prisma.faOffer.update({ where: { id: o.id }, data: { status: "SHORTLISTED" } }); shortlisted++; }
        else {
          const teamCode = (await prisma.team.findUnique({ where: { id: o.teamId }, select: { code: true } }))?.code ?? "?";
          await prisma.faOffer.update({ where: { id: o.id }, data: { status: "REJECTED" } });
          await prisma.transaction.create({ data: { type: "FA_NEGOTIATION", message: `${name} is continuing with other clubs — ${teamCode} is out.` } });
          eliminated++;
        }
      }
    }
  }
  return { countered, eliminated, shortlisted, signed: signedNow };
}

/** Compute + apply a player's Entry-Level Contract from the auto-formula
 *  (base by pedigree + performance bonus from last season, term by age). */
export async function applyElcAction(playerId: number) {
  const p = await prisma.player.findUnique({
    where: { id: playerId },
    select: { name: true, teamId: true, age: true, position: true, isGoalie: true, df: true, lastSeasonGP: true, lastSeasonPts: true, lastSeasonSvPct: true },
  });
  if (!p) return { ok: false as const, error: "Player not found." };
  if (!(await canManageTeam(p.teamId))) return { ok: false as const, error: "You don't manage this team." };
  const pos = p.isGoalie ? "G" : faPosGroup(p.position, false);
  const c = computeELC({ pos, age: p.age, df: p.df, lastSeasonGP: p.lastSeasonGP, lastSeasonPts: p.lastSeasonPts, lastSeasonSvPct: p.lastSeasonSvPct });
  if (!c.eligible) return { ok: false as const, error: `${p.name} played only ${p.lastSeasonGP ?? 0} games last season — a minimum of 10 is needed to sign an ELC.` };
  const expiry = CURRENT_SEASON_START + c.years;
  await prisma.player.update({
    where: { id: playerId },
    data: {
      capHit: c.capHit, contractYears: c.years, contractExpiry: expiry, contractType: "TWO_WAY",
      contractText: `$${c.base.toLocaleString("en-US")} + $${c.bonus.toLocaleString("en-US")} bonus × ${c.years}yr (ELC, through ${expiry})`,
    },
  });
  const team = await prisma.team.findUnique({ where: { id: p.teamId }, select: { code: true, slug: true } });
  await prisma.transaction.create({ data: { type: "SIGNING", message: `${team?.code ?? "?"} signed ${p.name} to an ELC — ${fmtM(c.capHit)} × ${c.years}yr` } });
  if (team?.slug) revalidatePath(`/teams/${team.slug}/salary`);
  return { ok: true as const, capHit: c.capHit, base: c.base, bonus: c.bonus, years: c.years };
}

/** League-wide ELC preview — every entry-level-age player who played enough to
 *  be signed, with his auto-computed deal (for the admin to review before applying). */
export async function previewLeagueElc() {
  const players = await prisma.player.findMany({
    where: { age: { lte: 23, gte: 16 }, rosterType: { in: ["NHL", "AHL"] }, lastSeasonGP: { gte: 10 } },
    select: {
      id: true, name: true, age: true, position: true, isGoalie: true, df: true, capHit: true,
      lastSeasonGP: true, lastSeasonPts: true, lastSeasonSvPct: true,
      team: { select: { code: true } },
    },
  });
  return players.map((p) => {
    const pos = p.isGoalie ? ("G" as const) : faPosGroup(p.position, false);
    const c = computeELC({ pos, age: p.age, df: p.df, lastSeasonGP: p.lastSeasonGP, lastSeasonPts: p.lastSeasonPts, lastSeasonSvPct: p.lastSeasonSvPct });
    return {
      id: p.id, name: p.name, teamCode: p.team?.code ?? "?", age: p.age, pos, currentCapHit: p.capHit,
      gp: p.lastSeasonGP ?? 0, ppg: c.ppg, svPct: p.lastSeasonSvPct,
      base: c.base, bonus: c.bonus, capHit: c.capHit, years: c.years, bonusEligible: c.bonusEligible,
    };
  }).sort((a, b) => b.capHit - a.capHit);
}

/** Admin: apply the ELC auto-formula to every previewed rookie at once (July 1). */
export async function applyAllElcAction() {
  if (!(await isAdmin())) return { ok: false as const, error: "Only a league admin can auto-sign the rookie class." };
  const list = await previewLeagueElc();
  let signed = 0;
  for (const r of list) {
    const expiry = CURRENT_SEASON_START + r.years;
    await prisma.player.update({
      where: { id: r.id },
      data: {
        capHit: r.capHit, contractYears: r.years, contractExpiry: expiry, contractType: "TWO_WAY",
        contractText: `$${r.base.toLocaleString("en-US")} + $${r.bonus.toLocaleString("en-US")} bonus × ${r.years}yr (ELC, through ${expiry})`,
      },
    });
    signed++;
  }
  await prisma.transaction.create({ data: { type: "SIGNING", message: `League office: ${signed} entry-level contracts auto-assigned for the new season.` } });
  for (const p of ["/free-agents", "/signings", "/finance", "/admin/elc"]) revalidatePath(p);
  return { ok: true as const, signed };
}

const clampLine = (n: number) => Math.max(1, Math.min(4, Math.round(n)));
const fmtM = (n: number) => `$${(n / 1e6).toFixed(2)}M`;

/** Tag / untag an RFA as the club's Franchise player (1 per team). A franchise RFA
 *  gets 2 re-sign rounds before he's exposed to offer sheets. Regular season only. */
export async function setFranchiseTagAction(playerId: number, teamId: number, on: boolean) {
  if (!(await canManageTeam(teamId))) return { ok: false as const, error: "You don't manage this team." };
  const settings = await loadSettings();
  if (settings.faMode === "simple") return { ok: false as const, error: "This league runs the simple free-agency system — no franchise tags or offer sheets." };
  const p = await prisma.player.findUnique({ where: { id: playerId }, select: { teamId: true, age: true } });
  if (!p) return { ok: false as const, error: "Player not found." };
  const org = await prisma.team.findUnique({ where: { id: teamId }, select: { affiliateTeams: { select: { id: true } } } });
  const orgIds = [teamId, ...(org?.affiliateTeams.map((a) => a.id) ?? [])];
  if (!orgIds.includes(p.teamId)) return { ok: false as const, error: "That player isn't in your organization." };
  if ((p.age ?? 27) > settings.rfaMaxAge) return { ok: false as const, error: `Only an RFA (${settings.rfaMaxAge} or younger) can be franchise-tagged.` };
  if (on) {
    await prisma.player.updateMany({ where: { teamId: { in: orgIds }, franchiseTag: true }, data: { franchiseTag: false } }); // one per club
    await prisma.player.update({ where: { id: playerId }, data: { franchiseTag: true } });
  } else {
    await prisma.player.update({ where: { id: playerId }, data: { franchiseTag: false } });
  }
  revalidatePath(`/teams`);
  return { ok: true as const };
}

/** Re-sign one of your OWN expiring players (contract up for renewal). Same engine
 *  as the frenzy, but a direct one-on-one negotiation: the player accepts if the
 *  offer clears his team-specific floor + term, otherwise he counters with why. */
export async function extendContractAction(
  playerId: number, teamId: number, salary: number, years: number, line: number, pp: boolean, pk: boolean,
  grantClause?: string | null, mNtcBreadth?: number | null, offerTwoWay?: boolean,
) {
  if (!(await canManageTeam(teamId))) return { ok: false as const, error: "You don't manage this team." };
  const player = await prisma.player.findUnique({
    where: { id: playerId }, select: { teamId: true, contractYears: true, capHit: true, age: true, name: true, lastSeasonGP: true, resignRound: true, resignStatus: true, resignOfferSalary: true, rosterType: true, franchiseTag: true, overall: true, realFarmTeamId: true },
  });
  if (!player) return { ok: false as const, error: "Player not found." };
  // the club may re-sign its own NHL players AND its farm (AHL affiliate) players
  const org = await prisma.team.findUnique({ where: { id: teamId }, select: { affiliateTeams: { select: { id: true } } } });
  const orgIds = [teamId, ...(org?.affiliateTeams.map((a) => a.id) ?? [])];
  if (!orgIds.includes(player.teamId)) return { ok: false as const, error: "That player isn't in your organization." };
  if ((player.contractYears ?? 99) > 1) return { ok: false as const, error: "He's not in the final year of his deal yet." };
  // you can only negotiate an extension once the regular season is underway (his
  // deal expires at the end of THIS season).
  const phase = (await getLeagueClock()).phase;
  if (phase !== "regular" && phase !== "playoffs") {
    return { ok: false as const, error: "Extensions open once the regular season starts — his deal expires at season's end." };
  }
  if (salary < 775_000) return { ok: false as const, error: "Below the league minimum salary." };
  years = Math.max(1, Math.min(MAX_TERM, Math.round(years)));
  // one-way vs two-way: an AHL-caliber player is fine on a two-way; an NHL regular
  // won't accept one, a two-way is only ever a one-year deal, and a player past 25
  // would rather test the market than take a two-way.
  const twoWay = !!offerTwoWay;
  const tw = await twoWayOpts();
  const twoWayErr = twoWayObjection(twoWay, player, years, { olderAge: tw.olderAge, gpLimit: tw.gpLimit, maxYears: tw.maxYears });
  if (twoWayErr) return { ok: false as const, error: twoWayErr };

  // negotiations may already be closed (walked to FA, or turned down → offer sheets)
  if (player.resignStatus === "walkedToUFA") return { ok: false as const, closed: true, error: "He's testing free agency now — negotiations are over for this window." };
  if (player.resignStatus === "osEligible") return { ok: false as const, closed: true, error: "He turned down your extension — after the season other clubs can submit offer sheets." };

  // cap check — replace his current hit with the new one (off-season +10% cushion, + LTIR
  // relief). Skipped for a FARM player: his deal sits on the AHL, off the NHL cap.
  const onFarm = player.rosterType === "AHL";
  if (!onFarm) {
    const cap = await loadLeagueCap();
    const info = await teamCapInfo(teamId);
    const committed = info.committed - (player.capHit ?? 0);
    const ceiling = capCeilingForPhase(cap.upper, (await getLeagueClock()).phase) + info.ltir;
    if (committed + salary > ceiling) {
      return { ok: false as const, error: `Over the ceiling — you'd have ${fmtM(ceiling - committed)} of room, this deal is ${fmtM(salary)}.` };
    }
  }

  const clause = grantClause && ["NTC", "NMC", "M_NTC"].includes(grantClause) ? grantClause : null;
  const breadth = clause === "M_NTC" ? ([6, 12, 18, 24].includes(mNtcBreadth ?? 0) ? mNtcBreadth! : 12) : null;
  const dep: Deployment = { line: clampLine(line), pp, pk };
  const ev = await evaluateTeamOffer(playerId, teamId, salary, years, dep, undefined, undefined, undefined, { clause, breadth });
  if (!ev) return { ok: false as const, error: "Could not value the player." };
  const team = await prisma.team.findUnique({ where: { id: teamId }, select: { code: true, slug: true } });

  if (!ev.acceptable) {
    // structured re-sign: you get 2 rounds. He counters after round 1; if the deal's
    // still not there after round 2 — or he's a little-used/older player who'd rather
    // test the market off a lowball — he walks (UFA → free agency, RFA → offer sheets).
    const round = player.resignRound ?? 0;
    const nextRound = round + 1;
    // in the simple system there are no RFA rights — everyone tests free agency.
    const isUFA = tw.faMode === "simple" || (player.age ?? 27) >= 27;
    const isRFA = !isUFA;
    // an RFA gets ONE round unless he's the club's Franchise tag (then 2); a UFA gets 2.
    const maxRounds = isRFA && !player.franchiseTag ? 1 : 2;
    const lowIce = player.lastSeasonGP != null && player.lastSeasonGP < 40;
    const bigLowball = salary < ev.ask.floorSalary * 0.82;
    const walk = nextRound > maxRounds || (round === 0 && bigLowball && (lowIce || isUFA));
    if (walk) {
      // RFA → offer-sheet eligible; UFA → tests free agency. Record the club's best
      // standing offer — that's the number a rival's offer sheet must beat.
      const status = isRFA ? "osEligible" : "walkedToUFA";
      const bestOffer = Math.max(salary, player.resignOfferSalary ?? 0);
      await prisma.player.update({ where: { id: playerId }, data: { resignStatus: status, resignRound: nextRound, resignOfferSalary: bestOffer } });
      // no revalidatePath here — it would tear down the open modal before its notice
      // shows; the client refreshes on Close.
      return {
        ok: false as const, walked: true, toUFA: !isRFA,
        reason: isRFA
          ? (player.franchiseTag ? "Two rounds and no deal — as your franchise RFA he's now open to offer sheets." : "No deal — negotiations pause; he'll be open to offer sheets, and further rounds resume after that period.")
          : nextRound > maxRounds ? "Two rounds and no deal — he'll test the market when the season ends." : "That's well short — he'd rather test free agency than take it.",
      };
    }
    // he counters (kept fuzzy — you don't see his exact number, just a range)
    const counterSalary = ev.ask.floorSalary;
    const counterYears = Math.min(Math.max(years, ev.ask.minYears), ev.ask.maxYears);
    const bestOffer = Math.max(salary, player.resignOfferSalary ?? 0);
    await prisma.player.update({ where: { id: playerId }, data: { resignRound: nextRound, resignStatus: "countered", resignCounterSalary: counterSalary, resignCounterYears: counterYears, resignOfferSalary: bestOffer } });
    return {
      ok: false as const, rejected: true, round: nextRound,
      reason: `Round ${nextRound} of ${maxRounds} — he's countering around ${fmtM(counterSalary * 0.97)}–${fmtM(counterSalary * 1.06)} over ${counterYears}yr.${nextRound >= maxRounds ? " Last round before he walks." : ""}`,
      floor: ev.ask.floorSalary, minYears: ev.ask.minYears, maxYears: ev.ask.maxYears,
    };
  }

  // A re-signed pending-UFA finishes THIS season on his current (old) cap hit; the new
  // deal is a deferred EXTENSION that activates at the next-season rollover. So we do
  // NOT touch capHit/contractYears/contractExpiry now — only store the extension.
  const fromSeason = CURRENT_SEASON_START + 1;
  const noTradeTeams = clause === "M_NTC" ? await weakestTeams(breadth ?? 12, teamId) : [];
  await prisma.player.update({
    where: { id: playerId },
    data: {
      extCapHit: salary, extYears: years, extContractType: twoWay ? "TWO_WAY" : "ONE_WAY",
      extClause: clause, extNoTradeTeams: noTradeTeams,
      extText: `$${salary.toLocaleString("en-US")} × ${years}yr — extension from ${fromSeason}`,
      signPromiseLine: dep.line, signPromisePP: pp, signPromisePK: pk,
      resignRound: 0, resignStatus: "extended", resignCounterSalary: null, resignCounterYears: null,
      disgruntled: false, tradeRequested: false, promiseWarnGame: null,
    },
  });
  await prisma.transaction.create({
    data: { type: "SIGNING", message: `${team?.code ?? "?"} extended ${player.name} — $${(salary / 1e6).toFixed(2)}M × ${years}yr (from ${fromSeason})` },
  });
  // revertible record — an EXTEND revert just clears the ext fields (current deal untouched)
  await prisma.signingLog.create({ data: { playerId, playerName: player.name, teamCode: team?.code ?? null, kind: "EXTEND", salary, years } });
  // no revalidatePath — it would unmount the confirmation modal; client refreshes on Done.
  return { ok: true as const, signed: true, salary, years, name: player.name };
}
