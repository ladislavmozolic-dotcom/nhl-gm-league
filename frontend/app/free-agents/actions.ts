"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { canManageTeam, getTeamSession, isAdmin, isComishTier } from "@/lib/auth";
import { getLeagueClock, getLeagueDate } from "@/lib/calendar-server";
import { addDays } from "@/lib/calendar";
import { CURRENT_SEASON_START, TWO_WAY_AHL_SALARY, capCeilingForPhase, ltirRelief, accruedCapSpace, liveCapHit } from "@/lib/finance";
import { teamCapCommitted } from "@/lib/cap";
import {
  loadMarketPool, teamContentionMap, teamAsk, evaluateTeamOffer, loadLeagueCap, weakestTeams,
} from "@/lib/free-agency-server";
import { MAX_TERM, faPosGroup, willingnessNote, twoWayObjection, type Deployment } from "@/lib/free-agency";
import { loadSettings, saveSettings } from "@/lib/sim/settings";
import { computeELC } from "@/lib/elc";
import { isCommissionOfferEmbargo } from "@/lib/sim-clock";

/** Commissioner-tuned two-way thresholds, shaped for twoWayObjection's opts. */
async function twoWayOpts(): Promise<{
  olderAge: number; gpLimit: number; maxYears: number; relaxRound: number;
  weakOverall: number; weakRound: number; ahlMaxYears: number; fewGpMaxYears: number; maxSalary: number;
  faMode: "full" | "simple";
}> {
  const s = await loadSettings();
  return {
    olderAge: s.faTwoWayOlderAge, gpLimit: s.faTwoWayNhlGpLimit, maxYears: s.faTwoWayMaxYears, relaxRound: s.faTwoWayRelaxRound,
    weakOverall: s.faTwoWayWeakOverall, weakRound: s.faTwoWayWeakRound, ahlMaxYears: s.faTwoWayAhlMaxYears, fewGpMaxYears: s.faTwoWayFewGpMaxYears,
    maxSalary: s.faTwoWayMaxSalary,
    faMode: s.faMode,
  };
}

const FREE = ["NHL", "AHL", "RETIRED", "PROSPECT", "RELEASED", "NONROSTER"]; // not a signable free agent
// In-season UFA market mirrors the summer frenzy in miniature, PER PLAYER: he collects
// offers for a week, then counters the bidders and gives them a few days to match.
const IN_SEASON_COLLECT_DAYS = 7;
const IN_SEASON_MATCH_DAYS = 3;
const ACTIVE = ["PENDING", "COUNTERED", "SHORTLISTED"]; // an offer still in contention
// After a four-day bidding stage, qualified bidders get this many real days to
// submit their best before the Agent judges the field. A player who got no
// offer stays available in the next round.
const FRENZY_IMPROVEMENT_DAYS = 2;
const POST_FRENZY_WINDOW_MS = 24 * 60 * 60 * 1000;

let faPoolTeamIdCache: number | null | undefined;
/** The "Free Agents" holding club — the fixed identity every player's "agent" DM
 *  is sent FROM. A UFA's own `Player.teamId` still points at his last real club
 *  (kept, but ignored, for real-roster placement — see roster-real-gaps notes),
 *  so it must never be used as the DM sender: that misattributes the message into
 *  a thread with whatever club he used to play for instead of the dedicated
 *  "Free Agent Frenzy" thread. */
async function faPoolTeamId(): Promise<number> {
  if (faPoolTeamIdCache !== undefined) return faPoolTeamIdCache as number;
  const t = await prisma.team.findFirst({ where: { league: "FA" }, select: { id: true } });
  faPoolTeamIdCache = t?.id ?? null;
  return faPoolTeamIdCache as number;
}

/** Deep-link straight to a free agent's row (see SortableTable's focusId) so a DM's
 *  "raise your offer" link lands on the exact Interest widget, not a bare page. */
const faFocusUrl = (playerId: number, isGoalie: boolean) => `/free-agents?focus=${playerId}${isGoalie ? "&type=goalies" : ""}`;

const round50k = (v: number) => Math.max(775_000, Math.round(v / 50_000) * 50_000);
/** What a player counters a bidder for, with genuine competition pushing the
 *  price UP: never below what that club already has standing, and — once 2+
 *  offers are genuinely live (same 0.75x band the outclassed check uses) —
 *  never below the field leader's salary × a leverage factor that grows with
 *  how many clubs are seriously in it, so a bidding war raises his ask instead
 *  of a per-offer evaluation occasionally landing BELOW a club's own bid. */
function competitiveAsk(baseAsk: number, myBid: number, list: { salary: number }[]): number {
  const bestOffer = Math.max(...list.map((o) => o.salary));
  const liveCount = list.filter((o) => o.salary >= bestOffer * 0.75).length;
  const leverage = liveCount >= 3 ? 1.10 : liveCount >= 2 ? 1.05 : 1.0;
  return round50k(Math.min(Math.max(baseAsk, bestOffer * leverage, myBid * 1.03), bestOffer * 1.20));
}

/** A team's committed NHL cap hit (+ retention/buyout dead money) and its LTIR
 *  relief (cap hits of skaters injured below CON 90). The effective ceiling is
 *  the phase ceiling + LTIR relief. */
async function teamCapInfo(teamId: number): Promise<{ committed: number; ltir: number }> {
  const [roster, capInfo] = await Promise.all([
    prisma.player.findMany({
      where: { teamId, rosterType: "NHL" }, select: { capHit: true, retainedSalary: true, contractYears: true, injuryDaysLeft: true, condition: true, isGoalie: true },
    }),
    teamCapCommitted(teamId),
  ]);
  const ltirRoster = roster.map((p) => ({ ...p, capHit: Math.max(0, liveCapHit(p) - (p.retainedSalary ?? 0)) }));
  return { committed: capInfo.committed, ltir: ltirRelief(ltirRoster) };
}

/** Interest feedback: what this player wants to sign at a given club right now. */
export async function getInterestAction(playerId: number, teamId: number) {
  const info = await teamAsk(playerId, teamId);
  if (!info) return { ok: false as const, error: "Player not found." };
  const player = await prisma.player.findUnique({ where: { id: playerId }, select: { name: true, faDecisionAt: true } });
  const existing = await prisma.faOffer.findUnique({ where: { playerId_teamId: { playerId, teamId } } });
  const clock = await getLeagueClock();
  const mayStartFresh = existing?.status === "REJECTED" && player?.faDecisionAt == null
    && (clock.postFrenzyOpen || (clock.frenzyStage === "BIDDING" && existing.round < clock.frenzyRound));
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
    round: clock.frenzyRound,
    existing: existing && !mayStartFresh ? {
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

/** Only the commissioner tier can inspect league-wide bids. During the first
 *  24 real hours of a round, they see only their own club's offers. Once that
 *  embargo ends, commissioner and co-commissioner both see the full field. */
async function offerViewMask(): Promise<{ hide: Set<number> } | null> {
  const id = await getTeamSession();
  if (id == null) return null;
  const me = await prisma.team.findUnique({ where: { id }, select: { isAdmin: true, gmRole: true } });
  if (!me || !(me.isAdmin || me.gmRole === "comish" || me.gmRole === "co_comish")) return null;
  const cfg = await prisma.leagueConfig.findUnique({ where: { id: 1 }, select: { faOpen: true, frenzyRoundStartedAt: true, frenzyStage: true } });
  const hide = new Set<number>();
  if (isCommissionOfferEmbargo(cfg, new Date())) {
    const otherTeams = await prisma.team.findMany({ where: { league: "NHL", id: { not: id } }, select: { id: true } });
    for (const t of otherTeams) hide.add(t.id);
  }
  return { hide };
}

/** The market-wide view uses the same complete 24-hour embargo. */
async function offerViewMaskForMarketList(): Promise<{ hide: Set<number>; namesOnly: boolean } | null> {
  const id = await getTeamSession();
  if (id == null) return null;
  const me = await prisma.team.findUnique({ where: { id }, select: { isAdmin: true, gmRole: true } });
  if (!me || !(me.isAdmin || me.gmRole === "comish" || me.gmRole === "co_comish")) return null;
  const cfg = await prisma.leagueConfig.findUnique({ where: { id: 1 }, select: { faOpen: true, frenzyRoundStartedAt: true, frenzyStage: true } });
  const hide = new Set<number>();
  if (isCommissionOfferEmbargo(cfg, new Date())) {
    const otherTeams = await prisma.team.findMany({ where: { league: "NHL", id: { not: id } }, select: { id: true } });
    for (const t of otherTeams) hide.add(t.id);
  }
  return { hide, namesOnly: false };
}

/** Commissioner toggle: lock / unlock UFA signings for ordinary GMs. */
export async function setFaSignLockAction(lock: boolean) {
  if (!(await isAdmin()) && !(await isComishTier())) return { ok: false as const, error: "Commissioner only." };
  const s = await loadSettings();
  await saveSettings({ ...s, faSignLock: lock });
  for (const p of ["/free-agents", "/teams"]) revalidatePath(p);
  return { ok: true as const, locked: lock };
}

/** Commissioner: schedule (or clear, passing null) a one-shot real moment for the
 *  Free Agent Frenzy window to auto-open for every GM — checked every minute by
 *  instrumentation.ts via lib/season-cron.ts autoOpenFrenzyIfDue. Pass a full
 *  ISO datetime (with timezone offset), not just a
 *  date, since this fires at a specific time of day, not once-per-day like the
 *  20:30 sim trigger. */
export async function setFrenzyAutoOpenAction(iso: string | null) {
  if (!(await isAdmin()) && !(await isComishTier())) return { ok: false as const, error: "Commissioner only." };
  const at = iso ? new Date(iso) : null;
  if (iso && (!at || isNaN(at.getTime()))) return { ok: false as const, error: "Invalid date/time." };
  await prisma.leagueConfig.update({ where: { id: 1 }, data: { frenzyAutoOpenAt: at } });
  for (const p of ["/free-agents", "/", "/admin/season"]) revalidatePath(p);
  return { ok: true as const, at };
}

/** All standing offers on a player (open frenzy — GMs can see the competition). */
export async function getPlayerOffersAction(playerId: number) {
  // A plain GM never sees competing bids. The commissioner tier follows the
  // shared 24-hour embargo enforced by offerViewMask.
  const mask = await offerViewMask();
  if (!mask) return [];
  const offers = (await prisma.faOffer.findMany({
    where: { playerId, status: { in: ACTIVE } }, orderBy: { salary: "desc" },
  })).filter((o) => !mask.hide.has(o.teamId));
  if (offers.length === 0) return [];
  const teams = await prisma.team.findMany({
    where: { id: { in: offers.map((o) => o.teamId) } }, select: { id: true, code: true },
  });
  const codeOf = new Map(teams.map((t) => [t.id, t.code]));
  const lastRaisedAt = await lastRaisedAtByTeam(playerId, offers.map((o) => o.teamId));
  return offers.map((o) => ({
    teamId: o.teamId, teamCode: codeOf.get(o.teamId) ?? "?",
    salary: o.salary, years: o.years, line: o.line, pp: o.pp, pk: o.pk,
    placedAt: o.createdAt.toISOString(),   // when the offer first landed
    updatedAt: lastRaisedAt.get(o.teamId) ?? o.createdAt.toISOString(),  // last ACTUAL raise (FaBid log) — o.updatedAt itself also bumps on unrelated status transitions (COUNTERED/SHORTLISTED/REJECTED during round processing), which would falsely flag an untouched offer as "raised"
  }));
}

/** Last time each team actually raised its bid on a player — NOT FaOffer.updatedAt
 *  (Prisma bumps that on every `.update()`, including round-processing status
 *  flips like COUNTERED/SHORTLISTED/REJECTED that never touched a term), and NOT
 *  just the latest FaBid row either — a team can resubmit at the FrenzyRound
 *  boundary with identical money/term (nothing actually raised), which still
 *  appends a FaBid row. Only count it as raised when the logged bids for that
 *  team actually contain more than one distinct (salary, years) pair; otherwise
 *  the offer's placedAt (FaOffer.createdAt, its true original moment) stands. */
async function lastRaisedAtByTeam(playerId: number, teamIds: number[]): Promise<Map<number, string>> {
  const bids = await prisma.faBid.findMany({ where: { playerId, teamId: { in: teamIds } }, orderBy: { id: "asc" }, select: { teamId: true, salary: true, years: true, createdAt: true } });
  const byTeam = new Map<number, typeof bids>();
  for (const b of bids) byTeam.set(b.teamId, [...(byTeam.get(b.teamId) ?? []), b]);
  const m = new Map<number, string>();
  for (const [teamId, list] of byTeam) {
    const distinct = new Set(list.map((b) => `${b.salary}:${b.years}`));
    if (distinct.size > 1) m.set(teamId, list[list.length - 1].createdAt.toISOString());
  }
  return m;
}

/** Full bid history on a player — every offer/raise, oldest first. Commissioner only
 *  (blind bidding: a GM never sees rivals' bids). */
export async function getBidHistoryAction(playerId: number) {
  const mask = await offerViewMask();
  if (!mask) return [];
  const bids = (await prisma.faBid.findMany({ where: { playerId }, orderBy: { id: "asc" } })).filter((b) => !mask.hide.has(b.teamId));
  if (bids.length === 0) return [];
  const teamIds = [...new Set(bids.map((b) => b.teamId))];
  const [teams, offers] = await Promise.all([
    prisma.team.findMany({ where: { id: { in: teamIds } }, select: { id: true, code: true } }),
    prisma.faOffer.findMany({ where: { playerId, teamId: { in: teamIds } }, select: { teamId: true, salary: true, years: true, status: true } }),
  ]);
  const codeOf = new Map(teams.map((t) => [t.id, t.code]));
  const offerByTeam = new Map(offers.map((o) => [o.teamId, o]));
  return bids.map((b) => {
    const offer = offerByTeam.get(b.teamId);
    // The FaOffer row only ever holds a team's LATEST terms. A bid whose
    // (salary, years) no longer matches it was raised over by a later bid
    // from the same team and never itself got a final status.
    const status = offer && offer.salary === b.salary && offer.years === b.years ? offer.status : "SUPERSEDED";
    return { teamCode: codeOf.get(b.teamId) ?? "?", salary: b.salary, years: b.years, at: b.createdAt.toISOString(), status };
  });
}

/** Every free agent currently carrying at least one active offer, with who's
 *  bidding and for what — the commission's full-market view (the on-page
 *  "Weighing offers" list only ever showed in-season deliberators, a narrow
 *  slice; this covers Frenzy round bids and in-season offers alike, since both
 *  write to the same FaOffer table). Comish-tier only, same blind-bidding mask
 *  as every other offer-visibility action. */
export async function getAllActiveOffersAction() {
  const mask = await offerViewMaskForMarketList();
  if (!mask) return { ok: false as const, error: "Commissioner or co-commissioner only." };
  const offers = (await prisma.faOffer.findMany({
    where: { status: { in: ACTIVE } }, orderBy: [{ playerId: "asc" }, { salary: "desc" }],
  })).filter((o) => !mask.hide.has(o.teamId));
  if (offers.length === 0) return { ok: true as const, players: [] };
  const playerIds = [...new Set(offers.map((o) => o.playerId))];
  const teamIds = [...new Set(offers.map((o) => o.teamId))];
  const [players, teams] = await Promise.all([
    prisma.player.findMany({ where: { id: { in: playerIds } }, select: { id: true, name: true, slug: true, position: true, isGoalie: true, photoUrl: true, overall: true } }),
    prisma.team.findMany({ where: { id: { in: teamIds } }, select: { id: true, code: true, logoUrl: true } }),
  ]);
  const pById = new Map(players.map((p) => [p.id, p]));
  const teamById = new Map(teams.map((t) => [t.id, t]));
  const byPlayer = new Map<number, typeof offers>();
  for (const o of offers) byPlayer.set(o.playerId, [...(byPlayer.get(o.playerId) ?? []), o]);
  // last GENUINE raise per player+team — only when the logged bids actually contain
  // more than one distinct (salary, years) pair (see lastRaisedAtByTeam above for why
  // a lone resubmit with identical terms doesn't count).
  const allBids = await prisma.faBid.findMany({ where: { playerId: { in: playerIds } }, orderBy: { id: "asc" }, select: { playerId: true, teamId: true, salary: true, years: true, createdAt: true } });
  const byPair = new Map<string, typeof allBids>();
  for (const b of allBids) { const k = `${b.playerId}:${b.teamId}`; byPair.set(k, [...(byPair.get(k) ?? []), b]); }
  const lastRaisedAt = new Map<string, string>();
  for (const [key, list] of byPair) {
    const distinct = new Set(list.map((b) => `${b.salary}:${b.years}`));
    if (distinct.size > 1) lastRaisedAt.set(key, list[list.length - 1].createdAt.toISOString());
  }
  const result = [...byPlayer.entries()].map(([playerId, os]) => {
    const p = pById.get(playerId);
    return {
      playerId, name: p?.name ?? "?", slug: p?.slug ?? null, position: p?.position ?? "", isGoalie: p?.isGoalie ?? false,
      photoUrl: p?.photoUrl ?? null, overall: p?.overall ?? null,
      offers: os.map((o) => ({
        teamId: o.teamId, teamCode: teamById.get(o.teamId)?.code ?? "?", teamLogo: teamById.get(o.teamId)?.logoUrl ?? null,
        salary: o.salary, years: o.years,
        line: o.line, pp: o.pp, pk: o.pk, round: o.round, status: o.status, twoWay: !!o.twoWay,
        // last ACTUAL raise (FaBid log), not o.updatedAt — that also bumps on
        // round-processing status flips (COUNTERED/SHORTLISTED/REJECTED) that
        // never touched the GM's terms, which would falsely read as "raised"
        placedAt: o.createdAt.toISOString(), updatedAt: lastRaisedAt.get(`${playerId}:${o.teamId}`) ?? o.createdAt.toISOString(),
      })),
    };
  }).filter((p) => p.offers.length > 0);
  result.sort((a, b) => Math.max(...b.offers.map((o) => o.salary ?? 0)) - Math.max(...a.offers.map((o) => o.salary ?? 0)));
  return { ok: true as const, players: result, namesOnly: mask.namesOnly };
}

/** Every active offer the caller's OWN club currently has standing — a plain GM
 *  couldn't see the "All active offers" list (comish-only, blind bidding) so had no
 *  way to review what he'd already bid. This is just his own data, no blind-bidding
 *  concern applies: no masking, open to any logged-in team. */
export async function getMyActiveOffersAction() {
  const teamId = await getTeamSession();
  if (teamId == null) return { ok: false as const, error: "Log in as a team to see your offers." };
  const offers = await prisma.faOffer.findMany({
    where: { teamId, status: { in: ACTIVE } }, orderBy: { updatedAt: "desc" },
  });
  if (offers.length === 0) return { ok: true as const, offers: [] };
  const playerIds = offers.map((o) => o.playerId);
  const players = await prisma.player.findMany({
    where: { id: { in: playerIds } },
    select: { id: true, name: true, slug: true, position: true, isGoalie: true, photoUrl: true, overall: true },
  });
  const pById = new Map(players.map((p) => [p.id, p]));
  const raisedByPlayer = new Map<number, string>();
  const allBids = await prisma.faBid.findMany({ where: { teamId, playerId: { in: playerIds } }, orderBy: { id: "asc" }, select: { playerId: true, salary: true, years: true, createdAt: true } });
  const byPlayerBids = new Map<number, typeof allBids>();
  for (const b of allBids) byPlayerBids.set(b.playerId, [...(byPlayerBids.get(b.playerId) ?? []), b]);
  for (const [playerId, list] of byPlayerBids) {
    const distinct = new Set(list.map((b) => `${b.salary}:${b.years}`));
    if (distinct.size > 1) raisedByPlayer.set(playerId, list[list.length - 1].createdAt.toISOString());
  }
  const result = offers.map((o) => {
    const p = pById.get(o.playerId);
    return {
      playerId: o.playerId, name: p?.name ?? "?", slug: p?.slug ?? null, position: p?.position ?? "", isGoalie: p?.isGoalie ?? false,
      photoUrl: p?.photoUrl ?? null, overall: p?.overall ?? null,
      salary: o.salary, years: o.years, line: o.line, pp: o.pp, pk: o.pk, round: o.round, status: o.status, twoWay: !!o.twoWay,
      counterSalary: o.counterSalary, counterYears: o.counterYears,
      placedAt: o.createdAt.toISOString(), updatedAt: raisedByPlayer.get(o.playerId) ?? o.createdAt.toISOString(),
    };
  });
  return { ok: true as const, offers: result };
}

/** Place or raise a team's standing offer to a free agent (money + term + promised usage). */
export async function submitOfferAction(
  playerId: number, teamId: number, salary: number, years: number, line: number, pp: boolean, pk: boolean,
  grantClause?: string | null, mNtcBreadth?: number | null, offerTwoWay?: boolean,
) {
  if (!(await canManageTeam(teamId))) return { ok: false as const, error: "You don't manage this team." };
  // A commissioner lock closes bidding for every club, including the
  // commissioner offices, so it can never become an unofficial head start.
  const lockSettings = await loadSettings();
  if (lockSettings.faSignLock) {
    return { ok: false as const, error: "🔒 UFA podpisy sú momentálne zamknuté komisárom." };
  }
  const clock = await getLeagueClock();
  let win = clock.faWindow;
  if (!win.open) {
    return { ok: false as const, error: "The free-agent market is closed." };
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
  if (!Number.isFinite(salary) || !Number.isInteger(salary)) return { ok: false as const, error: "Invalid salary." };
  if (salary < 775_000) return { ok: false as const, error: "Below the league minimum salary." };
  if (salary > 16_000_000) return { ok: false as const, error: "The maximum offer is $16.00M per year." };
  if (!Number.isFinite(years)) return { ok: false as const, error: "Invalid contract term." };
  years = Math.max(1, Math.min(MAX_TERM, Math.round(years)));
  // one-way vs two-way: an established player refuses — UNLESS the market has gone
  // cold for him (no round-1 offer at all) and either relaxation round has arrived:
  // an OLDER veteran settles from round `relaxRound` (2); any age, a WEAK/4th-line
  // established player settles from the later round `weakRound` (3) — a genuinely
  // good established player keeps refusing no matter how many rounds pass.
  const twoWay = !!offerTwoWay;
  const tw = await twoWayOpts();
  let relaxOlder = false, relaxWeak = false;
  if (twoWay && clock.frenzyRound >= tw.relaxRound) {
    const r1 = await prisma.faOffer.count({ where: { playerId, round: 1, status: { in: ["PENDING", "COUNTERED", "SHORTLISTED", "ACCEPTED"] } } });
    const cold = r1 === 0;
    relaxOlder = cold;
    relaxWeak = cold && clock.frenzyRound >= tw.weakRound;
  }
  const twoWayErr = twoWayObjection(twoWay, player, years, salary, {
    relaxOlder, relaxWeak, olderAge: tw.olderAge, gpLimit: tw.gpLimit, weakOverall: tw.weakOverall,
    maxYears: tw.maxYears, ahlMaxYears: tw.ahlMaxYears, fewGpMaxYears: tw.fewGpMaxYears, maxSalary: tw.maxSalary,
  });
  if (twoWayErr) return { ok: false as const, error: twoWayErr };

  // cap check — committed cap hit + this offer must stay under the ceiling
  const cap = await loadLeagueCap();
  const { committed, ltir } = await teamCapInfo(teamId);
  const existing = await prisma.faOffer.findUnique({ where: { playerId_teamId: { playerId, teamId } } });
  const wasActiveOffer = !!existing && ACTIVE.includes(existing.status);
  if (existing?.status === "REJECTED" && (player.faDecisionAt != null || clock.frenzyStage === "IMPROVEMENT" || (clock.frenzyOpen && existing.round === clock.frenzyRound))) {
    return { ok: false as const, error: "The player has moved on — he's no longer negotiating with your club." };
  }
  if (clock.frenzyStage === "IMPROVEMENT" && !win.postFrenzy && !wasActiveOffer) {
    return { ok: false as const, error: "New offers are closed for this round — only existing bidders may improve their terms." };
  }
  // Round lock: once the four-day bidding stage ends, the field is closed to
  // new entrants, while an existing bidder can still raise. A player who got
  // no offer remains open in the next round. The regular-season and playoff
  // paths use their separate market rules.
  if (!win.postFrenzy && clock.phase !== "regular" && clock.phase !== "playoffs") {
    if (!existing && player.faDecisionAt != null) {
      return { ok: false as const, error: "He's already deciding among his current suitors — bidding is closed to new clubs." };
    }
    if (clock.frenzyStage === "BIDDING" && existing && existing.round === clock.frenzyRound && existing.status !== "REJECTED") {
      return { ok: false as const, error: "You've already made your offer this round — wait for the next round to change it." };
    }
  }
  // In-season counter phase: once he's countered his suitors, no NEW club may jump in —
  // only clubs already negotiating can raise to match (mirrors the July round-lock).
  if (win.immediate && !win.ownOnly && player.faCountered && !wasActiveOffer) {
    return { ok: false as const, error: "He's already deciding among his current suitors — bidding is closed to new clubs." };
  }
  // Cap is a SOFT gate for offers: we DON'T block a bid that would exceed it — the GM can
  // make it and just gets a heads-up that, IF the player accepts, he'd be over the cap.
  // Projected in-season cap space (banked by staying under the cap) extends the room a club
  // can plan around, so a bid covered by accrued savings warns only lightly.
  const ceiling = capCeilingForPhase(cap.upper, clock.phase) + ltir;
  const gp = await prisma.game.count({ where: { season: "2026-27", status: "FINAL", OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }] } });
  const accrued = accruedCapSpace(Math.max(0, ceiling - committed), gp).actual;
  const projected = ceiling + accrued;
  let capWarning: string | null = null;
  if (committed + salary > projected)
    capWarning = `⚠️ If he accepts, you'd be about ${fmtM(committed + salary - ceiling)} over the cap — even counting projected in-season space (~${fmtM(accrued)}). You'll need to shed salary before he signs.`;
  else if (committed + salary > ceiling)
    capWarning = `Heads up: this uses your projected in-season cap space — ${fmtM(committed + salary - ceiling)} over the current ceiling, covered by ~${fmtM(accrued)} of accrued room.`;

  const clause = grantClause && ["NTC", "NMC", "M_NTC"].includes(grantClause) ? grantClause : null;
  const breadth = clause === "M_NTC" ? ([6, 12, 18, 24].includes(mNtcBreadth ?? 0) ? mNtcBreadth! : 12) : null;
  const dep: Deployment = { line: clampLine(line), pp, pk };
  const evalr = await evaluateTeamOffer(playerId, teamId, salary, years, dep, undefined, undefined, undefined, { clause, breadth });
  // a raise re-enters contention; a shortlisted offer stays shortlisted
  const newStatus = existing?.status === "SHORTLISTED" ? "SHORTLISTED" : "PENDING";
  // A raise during an active decision window keeps the round that opened it.
  // A brand-new offer (no existing row, or the player isn't deciding) always
  // takes the current round — that's genuinely when it was first placed.
  const roundToStamp = win.postFrenzy ? 4 : (existing && player.faDecisionAt != null) ? existing.round : clock.frenzyRound;

  const offer = await prisma.faOffer.upsert({
    where: { playerId_teamId: { playerId, teamId } },
    update: { salary, years, line: dep.line, pp, pk, status: newStatus, round: roundToStamp, counterSalary: null, counterYears: null, grantClause: clause, mNtcBreadth: breadth, twoWay },
    create: { playerId, teamId, salary, years, line: dep.line, pp, pk, round: roundToStamp, grantClause: clause, mNtcBreadth: breadth, twoWay },
  });
  // append every bid/raise to the running log (FaOffer keeps only the latest standing offer)
  await prisma.faBid.create({ data: { playerId, teamId, salary, years, round: roundToStamp } }).catch(() => {});

  // In-season OPEN MARKET: he does NOT sign on the spot. He takes a week to weigh the
  // offers (more clubs can bid in that time); when the window closes he counters the
  // bidders and gives them a few days to match, then signs the best — the summer UFA
  // market in miniature, per player. The standing offer is kept for the resolver.
  if (win.immediate && !win.ownOnly) {
    if (!player.faDecisionAt) {
      const firstDeadline = win.postFrenzy ? new Date(Date.now() + POST_FRENZY_WINDOW_MS) : addDays(await getLeagueDate(), IN_SEASON_COLLECT_DAYS);
      await prisma.player.update({ where: { id: playerId }, data: { faDecisionAt: firstDeadline, faCountered: false } });
    }
    const decideAt = player.faDecisionAt ?? (win.postFrenzy ? new Date(Date.now() + POST_FRENZY_WINDOW_MS) : addDays(await getLeagueDate(), IN_SEASON_COLLECT_DAYS));
    revalidatePath("/free-agents");
    return {
      ok: true as const, deliberating: true as const, raised: wasActiveOffer,
      decisionAt: decideAt.toISOString(), countered: player.faCountered, postFrenzy: win.postFrenzy, capWarning,
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
      return { ok: true as const, signed: true as const, clears: true as const, capWarning };
    }
    await prisma.faOffer.deleteMany({ where: { playerId, teamId } });
    revalidatePath("/free-agents");
    return {
      ok: true as const, signed: false as const, clears: false as const, capWarning,
      floor: evalr?.ask.floorSalary ?? 0,
      askYears: evalr ? { min: evalr.ask.minYears, max: evalr.ask.maxYears } : null,
    };
  }

  revalidatePath("/free-agents");
  return {
    ok: true as const, capWarning,
    raised: wasActiveOffer,
    clears: evalr?.acceptable ?? false,
    floor: evalr?.ask.floorSalary ?? 0,
    askYears: evalr ? { min: evalr.ask.minYears, max: evalr.ask.maxYears } : null,
  };
}

export async function withdrawOfferAction(playerId: number, teamId: number) {
  if (!(await canManageTeam(teamId))) return { ok: false as const, error: "You don't manage this team." };
  const removed = await prisma.faOffer.deleteMany({ where: { playerId, teamId } });
  if (removed.count > 0) {
    // logged (not deleted-without-trace) so the commissioner can later see a bid
    // vanished because the club pulled it, not from a bug — FA_NEGOTIATION is
    // filtered out of the public Transactions feed (TX_NOISE) but is queryable
    // by playerId, e.g. on the admin bidding-trail page.
    const [player, team] = await Promise.all([
      prisma.player.findUnique({ where: { id: playerId }, select: { name: true } }),
      prisma.team.findUnique({ where: { id: teamId }, select: { code: true } }),
    ]);
    await prisma.transaction.create({
      data: { type: "FA_NEGOTIATION", message: `${team?.code ?? "A club"} withdrew their offer on ${player?.name ?? "a free agent"}.`, playerId, teamId },
    }).catch(() => {});
  }
  revalidatePath("/free-agents");
  return { ok: true as const };
}

/** Legacy emergency resolver retained for admin recovery. Normal operation uses
 * processRoundEndAction so the required bidding and improvement stages cannot
 * be skipped from the UI. */
export async function resolveFrenzyAction() {
  if (!(await isAdmin())) return { ok: false as const, error: "Only a league admin can resolve the frenzy." };
  // a manual resolve judges at the CURRENT round (a round-1 resolve keeps the high
  // ask, so nobody signs for a below-ask lowball); the natural window close is round 3.
  const round = (await getLeagueClock()).frenzyRound || 3;
  const result = await resolveFrenzy(round);
  for (const p of ["/free-agents", "/signings", "/teams", "/finance", "/calendar"]) revalidatePath(p);
  return { ok: true as const, ...result };
}

/** Admin: manually advance the current forced Frenzy stage. This uses the same
 * state transitions as the automatic timer and never changes the league date. */
export async function processRoundEndAction() {
  if (!(await isAdmin())) return { ok: false as const, error: "Only a league admin can advance the frenzy." };
  const clock = await getLeagueClock();
  if (!clock.frenzyOpen) return { ok: false as const, error: "The round-based Frenzy is not open." };
  if (clock.frenzyStage === "BIDDING") {
    const now = new Date();
    const decisionAt = new Date(now.getTime() + FRENZY_IMPROVEMENT_DAYS * 86_400_000);
    await prisma.leagueConfig.update({ where: { id: 1 }, data: { frenzyStage: "IMPROVEMENT", frenzyRoundStartedAt: now } });
    let r;
    try {
      r = await processRoundEnd(clock.frenzyRound, decisionAt);
    } catch (e) {
      await prisma.leagueConfig.update({ where: { id: 1 }, data: { frenzyStage: "BIDDING", frenzyRoundStartedAt: clock.frenzyRoundStartedAt ? new Date(clock.frenzyRoundStartedAt) : new Date() } });
      throw e;
    }
    for (const p of ["/free-agents", "/signings", "/calendar", "/"]) revalidatePath(p);
    return { ok: true as const, ...r, round: clock.frenzyRound, stage: "IMPROVEMENT" as const };
  }
  const r = await resolveFrenzyDecisions(new Date(Date.now() + 10 * 86_400_000));
  await rejectActiveFrenzyOffersThroughRound(clock.frenzyRound);
  if (clock.frenzyRound >= 3) {
    await prisma.leagueConfig.update({ where: { id: 1 }, data: { frenzyStage: "CONTINUOUS", frenzyRoundStartedAt: null, frenzyForcedRound: 3 } });
  } else {
    await prisma.leagueConfig.update({ where: { id: 1 }, data: { frenzyStage: "BIDDING", frenzyRoundStartedAt: new Date(), frenzyForcedRound: clock.frenzyRound + 1 } });
  }
  for (const p of ["/free-agents", "/signings", "/calendar", "/"]) revalidatePath(p);
  return { ok: true as const, ...r, decided: 0, eliminated: 0, round: clock.frenzyRound, stage: clock.frenzyRound >= 3 ? "CONTINUOUS" as const : "BIDDING" as const };
}

type FaOfferRow = Awaited<ReturnType<typeof prisma.faOffer.findMany>>[number];

/** Execute a signing: move the player to the club on `o` at (salary × years),
 *  accept that offer, reject the rest, log it. Returns the club code. */
async function signFaOffer(playerId: number, player: { name: string; age: number | null }, o: FaOfferRow, salary: number, years: number, expectedTeamId?: number): Promise<string | null> {
  const twoWay = o.twoWay ?? ((player.age ?? 27) <= 24 && salary <= 3_000_000);
  const expiry = CURRENT_SEASON_START + years;
  const clause = o.grantClause && ["NTC", "NMC", "M_NTC"].includes(o.grantClause) ? o.grantClause : null;
  const noTradeTeams = clause === "M_NTC" ? await weakestTeams(o.mNtcBreadth ?? 12, o.teamId) : [];
  const data = {
    teamId: o.teamId, rosterType: "NHL",
    capHit: salary, contractYears: years, contractExpiry: expiry,
    contractType: twoWay ? "TWO_WAY" : "ONE_WAY",
    ahlSalary: twoWay ? TWO_WAY_AHL_SALARY : null,
    contractText: twoWay
      ? `$${salary.toLocaleString("en-US")} NHL / $${TWO_WAY_AHL_SALARY.toLocaleString("en-US")} AHL × ${years}yr (2-way, through ${expiry})`
      : `$${salary.toLocaleString("en-US")} × ${years}yr (through ${expiry})`,
    signPromiseLine: o.line, signPromisePP: o.pp, signPromisePK: o.pk,
    tradeClause: clause, noTradeTeams,
    disgruntled: false, tradeRequested: false, promiseWarnGame: null,
  };
  return prisma.$transaction(async (tx) => {
    // Snapshot and every resulting write belong to one transaction. The guarded
    // update also makes concurrent automatic/manual resolvers idempotent: only
    // the first one can move a player who is still a signable free agent.
    const [prev, team] = await Promise.all([
      tx.player.findUnique({ where: { id: playerId }, select: { capHit: true, ahlSalary: true, contractYears: true, contractExpiry: true, contractType: true, tradeClause: true, noTradeTeams: true, rosterType: true, teamId: true, contractText: true } }),
      tx.team.findUnique({ where: { id: o.teamId }, select: { code: true } }),
    ]);
    const moved = await tx.player.updateMany({
      where: { id: playerId, rosterType: { notIn: FREE }, ...(expectedTeamId !== undefined ? { teamId: expectedTeamId } : {}) },
      data,
    });
    if (moved.count === 0) return null;
    await tx.faOffer.update({ where: { id: o.id }, data: { status: "ACCEPTED", salary, years } });
    await tx.faOffer.updateMany({ where: { playerId, id: { not: o.id }, status: { in: ACTIVE } }, data: { status: "REJECTED" } });
    await tx.signingLog.create({ data: {
      playerId, playerName: player.name, teamCode: team?.code ?? null, kind: "SIGN", salary, years,
      prevCapHit: prev?.capHit != null ? Math.round(prev.capHit) : null, prevYears: prev?.contractYears ?? null, prevExpiry: prev?.contractExpiry ?? null,
      prevAhlSalary: prev?.ahlSalary != null ? Math.round(prev.ahlSalary) : null,
      prevType: prev?.contractType ?? null, prevClause: prev?.tradeClause ?? null, prevNoTrade: prev?.noTradeTeams ?? [],
      prevRosterType: prev?.rosterType ?? null, prevTeamId: prev?.teamId ?? null, prevContractText: prev?.contractText ?? null,
    } });
    await tx.transaction.create({ data: { type: "SIGNING", message: `${team?.code ?? "?"} signed ${player.name} — $${(salary / 1e6).toFixed(2)}M × ${years}yr` } });
    return team?.code ?? "?";
  });
}

/** Best acceptable offer for a player at `judgeRound`; with `allowSoleFloor`, a lone
 *  suitor whose offer fell short signs at the player's floor (cap-permitting). Signs
 *  and returns a detail string, or null if nobody cleared his bar. */
async function pickAndSign(
  playerId: number, player: { name: string; age: number | null }, offers: FaOfferRow[],
  judgeRound: number, pool: Awaited<ReturnType<typeof loadMarketPool>>, cmap: Awaited<ReturnType<typeof teamContentionMap>>,
  allowSoleFloor: boolean,
): Promise<string | null> {
  const cap = await loadLeagueCap();
  const clockPhase = (await getLeagueClock()).phase;
  let best: { offer: FaOfferRow; salary: number; years: number; utility: number } | null = null;
  let soleEv: Awaited<ReturnType<typeof evaluateTeamOffer>> = null;
  for (const o of offers) {
    const ev = await evaluateTeamOffer(playerId, o.teamId, o.salary, o.years, { line: o.line, pp: o.pp, pk: o.pk }, pool, cmap, judgeRound, { clause: o.grantClause, breadth: o.mNtcBreadth });
    if (offers.length === 1) soleEv = ev;
    // A club already over the cap can still win a signing here — same as real
    // hockey, going over on a signing is legal in the moment; the club just
    // has to get back under the ceiling by the real compliance deadline
    // (trades, buyouts, waivers). Not something this picker enforces.
    if (ev?.acceptable && (!best || ev.utility > best.utility)) best = { offer: o, salary: o.salary, years: o.years, utility: ev.utility };
  }
  if (!best && allowSoleFloor && offers.length === 1 && soleEv) {
    // A lone bidder below his floor still signs him — waiting on nobody-else's
    // competing offer to justify a higher price makes no sense when there IS
    // no competition — but he signs at the CLUB's own bid, not marked up to
    // his full floor ask, as long as that bid isn't an unreasonable lowball
    // (below half his floor). A bid that thin doesn't sign at all; he stays
    // on the market for now (his own ask erodes round over round the longer
    // he goes unsigned, via the usual demand-decay elsewhere).
    const o = offers[0];
    const floorSalary = soleEv.ask.floorSalary;
    if (o.salary >= floorSalary * 0.5) {
      const info = await teamCapInfo(o.teamId);
      const ceiling = capCeilingForPhase(cap.upper, clockPhase) + info.ltir;
      if (info.committed + o.salary <= ceiling) best = { offer: o, salary: o.salary, years: Math.min(Math.max(o.years, soleEv.ask.minYears), soleEv.ask.maxYears), utility: 0 };
    }
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
    select: { id: true, name: true, age: true, faCountered: true, teamId: true, isGoalie: true },
  });
  if (due.length === 0) return { signed: 0, countered: 0, details: [] };
  const pool = await loadMarketPool();
  const cmap = await teamContentionMap();
  const faId = await faPoolTeamId();
  let signed = 0, countered = 0; const details: string[] = [];
  const nice = (s: string) => s.replace(/''[A-Za-z]''|\s*\([^)]*\)/g, "").trim();
  const agentDm = async (toTeamId: number, body: string, playerId: number, isGoalie: boolean) => {
    await prisma.dmMessage.create({ data: { fromTeamId: faId, toTeamId, body, tradeUrl: faFocusUrl(playerId, isGoalie) } }).catch(() => {});
  };
  for (const p of due) {
    const offers = await prisma.faOffer.findMany({ where: { playerId: p.id, status: { in: ACTIVE } } });
    if (offers.length === 0) { await clearFaWindow(p.id); continue; }
    const player = { name: p.name, age: p.age };
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
          await agentDm(o.teamId, `❌ ${nm}'s camp passed on your offer — it wasn't close to his value.`, p.id, p.isGoalie);
        } else {
          // want: at least his value, at least the top bid × leverage, and always a raise
          // over this club's own offer — capped so it stays sane in a bidding war.
          const want = round50k(Math.min(Math.max(ev.ask.salary, bestOffer * leverage, o.salary * 1.03), bestOffer * 1.20));
          await prisma.faOffer.update({ where: { id: o.id }, data: { status: "COUNTERED", counterSalary: want, counterYears: ev.ask.years } });
          countered++; kept++;
          const msg = serious.length >= 2
            ? `📩 ${nm} is weighing multiple offers — he decides in ${IN_SEASON_MATCH_DAYS} days. Put in your BEST offer: he wants about $${(want / 1e6).toFixed(2)}M × ${ev.ask.years}yr (other clubs are also in — bidding is blind). Raise to stay in it.`
            : `📩 ${nm} isn't ready to sign at that price yet — he wants about $${(want / 1e6).toFixed(2)}M × ${ev.ask.years}yr. Raise your offer within ${IN_SEASON_MATCH_DAYS} days to close the deal.`;
          await agentDm(o.teamId, msg, p.id, p.isGoalie);
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
          if (tid === winner) await agentDm(tid, `✅ ${nm} has SIGNED with you! He accepted your offer over the other clubs.`, p.id, p.isGoalie);
          else await agentDm(tid, `🚫 ${nm} signed with ${winnerName} — he passed on your offer.`, p.id, p.isGoalie);
        }
      } else {
        await prisma.faOffer.updateMany({ where: { playerId: p.id, status: { in: ACTIVE } }, data: { status: "REJECTED" } });
        for (const tid of bidders) await agentDm(tid, `${nm} didn't sign anyone — no offer met his ask. He stays on the market.`, p.id, p.isGoalie);
      }
      await clearFaWindow(p.id);
    }
  }
  return { signed, countered, details };
}

/** End-of-bidding processing for the force-opened Frenzy. Hopeless or clearly
 * outclassed bids are removed; every surviving bidder enters the same two-day
 * improvement stage. Players with no offer remain open in the next round. */
export async function processRoundEnd(endedRound: number, sharedDecisionAt = new Date(Date.now() + FRENZY_IMPROVEMENT_DAYS * 86_400_000)): Promise<{ decided: number; eliminated: number; signed: number }> {
  const pool = await loadMarketPool();
  const cmap = await teamContentionMap();
  const faId = await faPoolTeamId();
  const agentDm = async (toTeamId: number, body: string, playerId: number, isGoalie: boolean) => {
    await prisma.dmMessage.create({ data: { fromTeamId: faId, toTeamId, body, tradeUrl: faFocusUrl(playerId, isGoalie) } }).catch(() => {});
  };
  // players already mid-way through a PREVIOUS round's individual decision
  // window are on their own clock — a later round's close must never re-touch
  // their still-active offers.
  const inDecision = await prisma.player.findMany({ where: { faDecisionAt: { not: null } }, select: { id: true } });
  // round: { gte: 1 } — a round=0 offer was placed OUTSIDE the Frenzy (the
  // separate in-season market, where clock.frenzyRound reads 0; see
  // getLeagueClock) or is a stale leftover from before this offer's round was
  // ever properly set. Either way it was never actually part of any Frenzy
  // round and must not get swept into one just because it's still PENDING —
  // that's exactly what mixed an old pre-Frenzy offer into today's round
  // close and confused the field for a completely unrelated new bidder.
  const offers = await prisma.faOffer.findMany({ where: { status: { in: ACTIVE }, round: endedRound, playerId: { notIn: inDecision.map((p) => p.id) } } });
  const byPlayer = new Map<number, typeof offers>();
  for (const o of offers) { const a = byPlayer.get(o.playerId) ?? []; a.push(o); byPlayer.set(o.playerId, a); }

  let decided = 0, eliminated = 0;
  for (const [playerId, list] of byPlayer) {
    const player = await prisma.player.findUnique({ where: { id: playerId }, select: { name: true, rosterType: true, age: true, isGoalie: true } });
    if (!player || (player.rosterType && FREE.includes(player.rosterType))) continue;
    const name = player.name;

    // Value every offer, drop hopeless lowballs, and start one shared
    // two-day window for every surviving bidder.
    const scored = [] as { o: (typeof list)[number]; ev: Awaited<ReturnType<typeof evaluateTeamOffer>> }[];
    for (const o of list) scored.push({ o, ev: await evaluateTeamOffer(playerId, o.teamId, o.salary, o.years, { line: o.line, pp: o.pp, pk: o.pk }, pool, cmap, endedRound, { clause: o.grantClause, breadth: o.mNtcBreadth }) });

    const soleOffer = list.length === 1;
    const bestSalary = Math.max(...list.map((o) => o.salary));
    const closeRace = !soleOffer && list.filter((x) => x.salary >= bestSalary * 0.90).length >= 2;
    let survivors = 0;
    for (const { o, ev } of scored) {
      if (!ev) continue;
      const teamCode = (await prisma.team.findUnique({ where: { id: o.teamId }, select: { code: true } }))?.code ?? "?";
      const outclassed = !soleOffer && o.salary < bestSalary * 0.75;
      if (o.salary < ev.ask.floorSalary * 0.6 || outclassed) {
        await prisma.faOffer.update({ where: { id: o.id }, data: { status: "REJECTED" } });
        const reason = outclassed ? "another club's offer was well ahead of yours" : "it wasn't close to his value";
        await prisma.transaction.create({ data: { type: "FA_NEGOTIATION", message: `${name} passed on ${teamCode}'s offer — ${outclassed ? "another club was well ahead" : "not close to his value"}.` } });
        await agentDm(o.teamId, `❌ ${name}'s camp passed on your offer — ${reason}.`, playerId, player.isGoalie);
        eliminated++;
      } else if (!soleOffer && !closeRace) {
        const isLeader = o.salary === bestSalary;
        await prisma.faOffer.update({ where: { id: o.id }, data: { status: "COUNTERED", counterSalary: null, counterYears: null } });
        survivors++;
        const msg = isLeader
          ? `🥇 Your offer on ${name} is currently the best on the table. You have ${FRENZY_IMPROVEMENT_DAYS} days — raise it if you're worried another club might try to top you.`
          : `📩 Another club has a better offer on ${name} right now. You have ${FRENZY_IMPROVEMENT_DAYS} days to improve yours if you want to stay in it.`;
        await agentDm(o.teamId, msg, playerId, player.isGoalie);
      } else {
        const want = competitiveAsk(ev.ask.salary, o.salary, list);
        await prisma.faOffer.update({ where: { id: o.id }, data: { status: "COUNTERED", counterSalary: want, counterYears: ev.ask.years } });
        survivors++;
        const msg = soleOffer
          ? `📩 ${name} isn't ready to sign at that price yet — he wants about $${(want / 1e6).toFixed(2)}M × ${ev.ask.years}yr. You have ${FRENZY_IMPROVEMENT_DAYS} days to raise your offer.`
          : `📩 ${name} is weighing multiple offers. Put in your BEST offer within ${FRENZY_IMPROVEMENT_DAYS} days: he wants about $${(want / 1e6).toFixed(2)}M × ${ev.ask.years}yr (other clubs are also in — bidding is blind).`;
        await agentDm(o.teamId, msg, playerId, player.isGoalie);
      }
    }
    if (survivors > 0) {
      await prisma.player.update({ where: { id: playerId }, data: { faDecisionAt: sharedDecisionAt, faCountered: true } });
      await prisma.transaction.create({ data: { type: "FA_NEGOTIATION", message: `${name} is deciding between his suitors — the Agent settles it in ${FRENZY_IMPROVEMENT_DAYS} days.` } });
      decided++;
    }
  }
  return { decided, eliminated, signed: 0 };
}

/** Resolves every player when the shared two-day improvement window
 *  (started by processRoundEnd, above) has elapsed. Checked on the same
 *  real-time tick as checkFrenzyRoundCloseIfDue (lib/sim/auto.ts) — NOT the
 *  once-daily calendar cron — so it fires close to the actual deadline
 *  instead of drifting to the next day's sim. Signs the best standing offer
 *  (a lone survivor falls back to his floor, matching resolveFrenzy's own
 *  final-close logic); every other bidder is notified either way. */
export async function resolveFrenzyDecisions(asOf: Date = new Date()): Promise<{ signed: number; unsigned: number }> {
  const due = await prisma.player.findMany({
    where: { faDecisionAt: { not: null, lte: asOf }, rosterType: { notIn: FREE } },
    select: { id: true, name: true, age: true, isGoalie: true },
  });
  if (due.length === 0) return { signed: 0, unsigned: 0 };
  const pool = await loadMarketPool();
  const cmap = await teamContentionMap();
  const faId = await faPoolTeamId();
  const agentDm = async (toTeamId: number, body: string, playerId: number, isGoalie: boolean) => {
    await prisma.dmMessage.create({ data: { fromTeamId: faId, toTeamId, body, tradeUrl: faFocusUrl(playerId, isGoalie) } }).catch(() => {});
  };
  const nice = (s: string) => s.replace(/''[A-Za-z]''|\s*\([^)]*\)/g, "").trim();
  let signed = 0, unsigned = 0;
  for (const p of due) {
    const offers = await prisma.faOffer.findMany({ where: { playerId: p.id, status: { in: ACTIVE } } });
    const nm = nice(p.name);
    if (offers.length === 0) { await prisma.player.update({ where: { id: p.id }, data: { faDecisionAt: null, faCountered: false } }); continue; }
    const bidders = [...new Set(offers.map((o) => o.teamId))];
    const detail = await pickAndSign(p.id, { name: p.name, age: p.age }, offers, 3, pool, cmap, true);
    if (detail) {
      signed++;
      const after = await prisma.player.findUnique({ where: { id: p.id }, select: { teamId: true } });
      const winner = after?.teamId ?? null;
      const winnerTeam = winner != null ? await prisma.team.findUnique({ where: { id: winner }, select: { code: true } }) : null;
      for (const tid of bidders) {
        if (tid === winner) await agentDm(tid, `✅ ${nm} has SIGNED with you!`, p.id, p.isGoalie);
        else await agentDm(tid, `🚫 ${nm} signed with ${winnerTeam?.code ?? "another club"} — your offer is rejected.`, p.id, p.isGoalie);
      }
    } else {
      // Another server process may have signed this player after our initial
      // due-player query. The guarded signing transaction correctly returned
      // null; do not follow it with contradictory rejection messages.
      const current = await prisma.player.findUnique({ where: { id: p.id }, select: { rosterType: true } });
      if (current?.rosterType && FREE.includes(current.rosterType)) continue;
      unsigned++;
      await prisma.faOffer.updateMany({ where: { playerId: p.id, status: { in: ACTIVE } }, data: { status: "REJECTED" } });
      for (const tid of bidders) await agentDm(tid, `${nm} didn't sign anyone — no offer met his ask. He stays on the market.`, p.id, p.isGoalie);
    }
    await prisma.player.update({ where: { id: p.id }, data: { faDecisionAt: null, faCountered: false } });
  }
  return { signed, unsigned };
}

/** Close every still-standing offer from completed Frenzy rounds. A declined
 * offer must not silently carry into the later 24-hour market and win weeks
 * after the GM expected that round to be over. */
export async function rejectActiveFrenzyOffersThroughRound(round: number): Promise<number> {
  const r = await prisma.faOffer.updateMany({
    where: { status: { in: ACTIVE }, round: { gte: 1, lte: round } },
    data: { status: "REJECTED" },
  });
  return r.count;
}

/** Post-round-3 continuous UFA market.
 *  First offer opens a 24-hour window in which any club may join. One bidder is
 *  judged at that deadline. With competition, weak bids are cut and surviving
 *  clubs receive one further 24-hour improvement window before the final choice. */
export async function resolvePostFrenzyWindows(asOf: Date = new Date()): Promise<{ signed: number; unsigned: number; countered: number }> {
  const due = await prisma.player.findMany({
    where: { faDecisionAt: { not: null, lte: asOf }, rosterType: { notIn: FREE } },
    select: { id: true, name: true, age: true, faCountered: true, isGoalie: true },
  });
  if (due.length === 0) return { signed: 0, unsigned: 0, countered: 0 };
  const pool = await loadMarketPool();
  const cmap = await teamContentionMap();
  const faId = await faPoolTeamId();
  const nice = (s: string) => s.replace(/''[A-Za-z]''|\s*\([^)]*\)/g, "").trim();
  const agentDm = async (toTeamId: number, body: string, playerId: number, isGoalie: boolean) => {
    await prisma.dmMessage.create({ data: { fromTeamId: faId, toTeamId, body, tradeUrl: faFocusUrl(playerId, isGoalie) } }).catch(() => {});
  };
  let signed = 0, unsigned = 0, countered = 0;

  for (const p of due) {
    const offers = await prisma.faOffer.findMany({ where: { playerId: p.id, status: { in: ACTIVE }, round: 4 } });
    const nm = nice(p.name);
    if (offers.length === 0) { await clearFaWindow(p.id); continue; }
    const bidders = [...new Set(offers.map((o) => o.teamId))];

    if (!p.faCountered && offers.length > 1) {
      const scored = [] as { o: (typeof offers)[number]; ev: Awaited<ReturnType<typeof evaluateTeamOffer>> }[];
      for (const o of offers) scored.push({ o, ev: await evaluateTeamOffer(p.id, o.teamId, o.salary, o.years, { line: o.line, pp: o.pp, pk: o.pk }, pool, cmap, 3, { clause: o.grantClause, breadth: o.mNtcBreadth }) });
      const bestSalary = Math.max(...offers.map((o) => o.salary));
      const closeRace = offers.filter((o) => o.salary >= bestSalary * 0.90).length >= 2;
      let survivors = 0;
      for (const { o, ev } of scored) {
        if (!ev) continue;
        const outclassed = o.salary < bestSalary * 0.75;
        if (o.salary < ev.ask.floorSalary * 0.6 || outclassed) {
          await prisma.faOffer.update({ where: { id: o.id }, data: { status: "REJECTED" } });
          await agentDm(o.teamId, `❌ ${nm}'s camp passed on your offer — ${outclassed ? "another club was well ahead" : "it wasn't close to his value"}.`, p.id, p.isGoalie);
          continue;
        }
        const want = closeRace ? competitiveAsk(ev.ask.salary, o.salary, offers) : null;
        await prisma.faOffer.update({ where: { id: o.id }, data: { status: "COUNTERED", counterSalary: want, counterYears: want == null ? null : ev.ask.years } });
        const isLeader = o.salary === bestSalary;
        const msg = want != null
          ? `📩 ${nm} is weighing multiple offers. Put in your BEST offer within 24 hours: he wants about $${(want / 1e6).toFixed(2)}M × ${ev.ask.years}yr (bidding remains blind).`
          : isLeader
            ? `🥇 Your offer on ${nm} is currently the best. You have 24 hours to improve it before he decides.`
            : `📩 Another club has a better offer on ${nm}. You have 24 hours to improve yours.`;
        await agentDm(o.teamId, msg, p.id, p.isGoalie);
        survivors++;
      }
      if (survivors > 0) {
        await prisma.player.update({ where: { id: p.id }, data: { faCountered: true, faDecisionAt: new Date(asOf.getTime() + POST_FRENZY_WINDOW_MS) } });
        await prisma.transaction.create({ data: { type: "FA_NEGOTIATION", message: `${nm} has multiple offers — his remaining suitors have 24 hours to improve them.` } });
        countered++;
      } else {
        await clearFaWindow(p.id);
        unsigned++;
      }
      continue;
    }

    const detail = await pickAndSign(p.id, { name: p.name, age: p.age }, offers, 3, pool, cmap, true);
    if (detail) {
      signed++;
      const after = await prisma.player.findUnique({ where: { id: p.id }, select: { teamId: true } });
      const winner = after?.teamId ?? null;
      const winnerTeam = winner != null ? await prisma.team.findUnique({ where: { id: winner }, select: { code: true } }) : null;
      for (const tid of bidders) {
        await agentDm(tid, tid === winner ? `✅ ${nm} has SIGNED with you!` : `🚫 ${nm} signed with ${winnerTeam?.code ?? "another club"} — your offer is rejected.`, p.id, p.isGoalie);
      }
    } else {
      // A concurrent resolver may already have completed the signing.
      const current = await prisma.player.findUnique({ where: { id: p.id }, select: { rosterType: true } });
      if (current?.rosterType && FREE.includes(current.rosterType)) continue;
      unsigned++;
      await prisma.faOffer.updateMany({ where: { playerId: p.id, status: { in: ACTIVE }, round: 4 }, data: { status: "REJECTED" } });
      for (const tid of bidders) await agentDm(tid, `${nm} didn't sign anyone — no offer met his ask. He stays available on the market.`, p.id, p.isGoalie);
    }
    await clearFaWindow(p.id);
  }
  return { signed, unsigned, countered };
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
      ahlSalary: TWO_WAY_AHL_SALARY,
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
        ahlSalary: TWO_WAY_AHL_SALARY,
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
    where: { id: playerId }, select: { teamId: true, contractYears: true, capHit: true, ahlSalary: true, contractExpiry: true, contractType: true, tradeClause: true, noTradeTeams: true, contractText: true, age: true, name: true, lastSeasonGP: true, resignRound: true, resignStatus: true, resignOfferSalary: true, rosterType: true, franchiseTag: true, overall: true, realFarmTeamId: true },
  });
  if (!player) return { ok: false as const, error: "Player not found." };
  // the club may re-sign its own NHL players AND its farm (AHL affiliate) players
  const org = await prisma.team.findUnique({ where: { id: teamId }, select: { affiliateTeams: { select: { id: true } } } });
  const orgIds = [teamId, ...(org?.affiliateTeams.map((a) => a.id) ?? [])];
  if (!orgIds.includes(player.teamId)) return { ok: false as const, error: "That player isn't in your organization." };
  if ((player.contractYears ?? 99) > 1) return { ok: false as const, error: "He's not in the final year of his deal yet." };
  // A club can negotiate its own pending UFA/RFA any time except during the Free
  // Agent Frenzy itself, which has its own dedicated offer/counter flow for players
  // who've actually reached the open market.
  const phase = (await getLeagueClock()).phase;
  if (phase === "frenzy") {
    return { ok: false as const, error: "Extensions are closed during the Free Agent Frenzy — use the market offer flow instead." };
  }
  // A "1 year left" deal only means something once a real season is underway — before
  // regular season starts, only already-expired (0-year) deals are up for renewal.
  // Matches the same gate ContractSection uses to decide who's shown in the list.
  if (player.contractYears === 1 && phase !== "regular" && phase !== "playoffs") {
    return { ok: false as const, error: "Final-year extensions open once the regular season starts." };
  }
  if (salary < 775_000) return { ok: false as const, error: "Below the league minimum salary." };
  years = Math.max(1, Math.min(MAX_TERM, Math.round(years)));
  // one-way vs two-way: an AHL-caliber player is fine on a two-way; an NHL regular
  // won't accept one, a two-way is only ever a one-year deal, and a player past 25
  // would rather test the market than take a two-way.
  const twoWay = !!offerTwoWay;
  const tw = await twoWayOpts();
  // no round-based relaxation here — re-signing your own player isn't a market-round
  // negotiation, so an established player (older or weak) still just refuses outright;
  // the AHL-only/few-games tiers still apply for a not-yet-established player.
  const twoWayErr = twoWayObjection(twoWay, player, years, salary, {
    olderAge: tw.olderAge, gpLimit: tw.gpLimit, weakOverall: tw.weakOverall,
    maxYears: tw.maxYears, ahlMaxYears: tw.ahlMaxYears, fewGpMaxYears: tw.fewGpMaxYears, maxSalary: tw.maxSalary,
  });
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
    const committed = info.committed - liveCapHit(player);
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

  // The new deal replaces the current one immediately — salary/term update the
  // moment the offer is accepted, same as any other signing (no deferred-extension
  // delay to next season's rollover).
  const expiry = CURRENT_SEASON_START + years;
  const noTradeTeams = clause === "M_NTC" ? await weakestTeams(breadth ?? 12, teamId) : [];
  const contractText = twoWay
    ? `$${salary.toLocaleString("en-US")} NHL / $${TWO_WAY_AHL_SALARY.toLocaleString("en-US")} AHL × ${years}yr (2-way, through ${expiry})`
    : `$${salary.toLocaleString("en-US")} × ${years}yr (through ${expiry})`;
  // Non-roster release: an RFA benched at regular-season opening day for staying
  // unsigned (sweepUnsignedRfasToNonRoster) is usable again the moment his own club
  // actually re-signs him — back onto the active NHL roster (a GM can send him to
  // the farm afterward via the roster mover like any other player, same as a fresh
  // signing would be).
  const releaseNonRoster = player.rosterType === "NONROSTER" ? { rosterType: "NHL" } : {};
  await prisma.player.update({
    where: { id: playerId },
    data: {
      ...releaseNonRoster,
      capHit: salary, contractYears: years, contractExpiry: expiry,
      contractType: twoWay ? "TWO_WAY" : "ONE_WAY", tradeClause: clause, noTradeTeams, contractText,
      ahlSalary: twoWay ? TWO_WAY_AHL_SALARY : null,
      extCapHit: null, extYears: null, extContractType: null, extClause: null, extNoTradeTeams: [], extText: null,
      signPromiseLine: dep.line, signPromisePP: pp, signPromisePK: pk,
      resignRound: 0, resignStatus: null, resignCounterSalary: null, resignCounterYears: null,
      disgruntled: false, tradeRequested: false, promiseWarnGame: null,
    },
  });
  await prisma.transaction.create({
    data: { type: "SIGNING", message: `${team?.code ?? "?"} re-signed ${player.name} — $${(salary / 1e6).toFixed(2)}M × ${years}yr` },
  });
  // revertible record — restores the exact prior contract snapshot on revert
  await prisma.signingLog.create({ data: {
    playerId, playerName: player.name, teamCode: team?.code ?? null, kind: "EXTEND", salary, years,
    prevCapHit: player.capHit, prevYears: player.contractYears, prevExpiry: player.contractExpiry,
    prevAhlSalary: player.ahlSalary != null ? Math.round(player.ahlSalary) : null,
    prevType: player.contractType, prevClause: player.tradeClause, prevNoTrade: player.noTradeTeams,
    prevRosterType: player.rosterType, prevTeamId: player.teamId, prevContractText: player.contractText,
  } });
  // no revalidatePath — it would unmount the confirmation modal; client refreshes on Done.
  return { ok: true as const, signed: true, salary, years, name: player.name };
}
