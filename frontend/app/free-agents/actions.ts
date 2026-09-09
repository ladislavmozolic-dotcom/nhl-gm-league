"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { canManageTeam, getTeamSession, isAdmin, isComishTier } from "@/lib/auth";
import { getLeagueClock, getLeagueDate } from "@/lib/calendar-server";
import { addDays } from "@/lib/calendar";
import { CURRENT_SEASON_START, capCeilingForPhase, ltirRelief, accruedCapSpace } from "@/lib/finance";
import { teamCapCommitted } from "@/lib/cap";
import {
  loadMarketPool, teamContentionMap, teamAsk, evaluateTeamOffer, loadLeagueCap, weakestTeams,
} from "@/lib/free-agency-server";
import { MAX_TERM, faPosGroup, willingnessNote, twoWayObjection, type Deployment } from "@/lib/free-agency";
import { loadSettings, saveSettings } from "@/lib/sim/settings";
import { computeELC } from "@/lib/elc";

/** Commissioner-tuned two-way thresholds, shaped for twoWayObjection's opts. */
async function twoWayOpts(): Promise<{
  olderAge: number; gpLimit: number; maxYears: number; relaxRound: number;
  weakOverall: number; weakRound: number; ahlMaxYears: number; fewGpMaxYears: number;
  faMode: "full" | "simple";
}> {
  const s = await loadSettings();
  return {
    olderAge: s.faTwoWayOlderAge, gpLimit: s.faTwoWayNhlGpLimit, maxYears: s.faTwoWayMaxYears, relaxRound: s.faTwoWayRelaxRound,
    weakOverall: s.faTwoWayWeakOverall, weakRound: s.faTwoWayWeakRound, ahlMaxYears: s.faTwoWayAhlMaxYears, fewGpMaxYears: s.faTwoWayFewGpMaxYears,
    faMode: s.faMode,
  };
}

const FREE = ["NHL", "AHL", "RETIRED", "PROSPECT", "RELEASED", "NONROSTER"]; // not a signable free agent
// In-season UFA market mirrors the summer frenzy in miniature, PER PLAYER: he collects
// offers for a week, then counters the bidders and gives them a few days to match.
const IN_SEASON_COLLECT_DAYS = 7;
const IN_SEASON_MATCH_DAYS = 3;
const ACTIVE = ["PENDING", "COUNTERED", "SHORTLISTED"]; // an offer still in contention
// A Frenzy round no longer cascades a bid player into the NEXT weekly round —
// the moment he gets his first offer, his suitors get this many real days to
// submit their best before the Agent judges the field and signs him. Only a
// player who got NO offer at all this round remains open for a future round.
const FRENZY_DECISION_DAYS = 3;

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
      where: { teamId, rosterType: "NHL" }, select: { capHit: true, retainedSalary: true, injuryDaysLeft: true, condition: true, isGoalie: true },
    }),
    teamCapCommitted(teamId),
  ]);
  const ltirRoster = roster.map((p) => ({ ...p, capHit: Math.max(0, (p.capHit ?? 0) - (p.retainedSalary ?? 0)) }));
  return { committed: capInfo.committed, ltir: ltirRelief(ltirRoster) };
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

/** Who (if anyone) may see the competing offers, and whose offers stay hidden from them.
 *  Only admin-tier (commissioner / co-commissioner) see the blind market. The TOP
 *  commissioner sees everything; a co-commissioner sees every offer EXCEPT the
 *  commissioner's own bid (his own club's offers are always visible to himself). */
async function offerViewMask(playerId?: number): Promise<{ hide: Set<number> } | null> {
  const id = await getTeamSession();
  if (id == null) return null;
  const me = await prisma.team.findUnique({ where: { id }, select: { isAdmin: true, gmRole: true } });
  if (!me || !(me.isAdmin || me.gmRole === "comish" || me.gmRole === "co_comish")) return null;
  // Fresh-round blackout: for the first 24 REAL hours after a force-opened
  // round starts, the commissioner's office sees NOTHING at all through this
  // per-player admin view — not even on a player they have no stake in.
  // Without this, a comish/co-comish could open a player's Interest widget
  // before placing their own bid and simply read off what everyone else is
  // offering, using their day-1 head start (submitOfferAction's
  // dayInRound===1 gate) to scout the field risk-free. Only meaningful for a
  // force-opened market (faOpen) — a calendar-driven round has no real-time
  // start to measure. (The market-wide "All Active Offers" list has its own,
  // milder blackout — see offerViewMaskForMarketList below — since showing
  // WHICH players/teams are in play there, without dollar figures, isn't the
  // same information leak as a per-player breakdown.)
  const cfg = await prisma.leagueConfig.findUnique({ where: { id: 1 }, select: { faOpen: true, frenzyRoundStartedAt: true } });
  if (cfg?.faOpen && cfg.frenzyRoundStartedAt && Date.now() - cfg.frenzyRoundStartedAt.getTime() < 24 * 60 * 60 * 1000) {
    return null;
  }
  // Conflict of interest: a commish/co-commish who is ALSO bidding on this exact
  // player (as a club) loses the admin view of it entirely — bidding stays blind
  // for them here too, same as an ordinary GM, so their office can't use the
  // full-market view to see what they're up against on a player they themselves
  // want. This check is per-player and only kicks in when one is given.
  if (playerId != null) {
    const ownBid = await prisma.faOffer.findFirst({ where: { playerId, teamId: id, status: { in: ACTIVE } }, select: { id: true } });
    if (ownBid) return null;
  }
  const hide = new Set<number>();
  if (me.gmRole !== "comish") { // co-commissioner: the commissioner's own bid is hidden
    const comish = await prisma.team.findMany({ where: { gmRole: "comish" }, select: { id: true } });
    for (const t of comish) if (t.id !== id) hide.add(t.id);
  }
  return { hide };
}

/** Same admin/comish-tier gate and comish-vs-co-comish hide-set as offerViewMask,
 *  but for the market-wide "All Active Offers" list only — during the first 24h
 *  fresh-round blackout, instead of hiding everything, it flags `namesOnly` so
 *  getAllActiveOffersAction still returns which players/teams have an offer in
 *  (real market activity, not exploitable on its own) while stripping every
 *  dollar figure. Regular blind-bidding conflict-of-interest still applies —
 *  the caller's own actively-bid-on players are filtered out by the caller. */
async function offerViewMaskForMarketList(): Promise<{ hide: Set<number>; namesOnly: boolean; blackoutRound: number | null } | null> {
  const id = await getTeamSession();
  if (id == null) return null;
  const me = await prisma.team.findUnique({ where: { id }, select: { isAdmin: true, gmRole: true } });
  if (!me || !(me.isAdmin || me.gmRole === "comish" || me.gmRole === "co_comish")) return null;
  const cfg = await prisma.leagueConfig.findUnique({ where: { id: 1 }, select: { faOpen: true, frenzyRoundStartedAt: true, frenzyForcedRound: true } });
  const namesOnly = !!(cfg?.faOpen && cfg.frenzyRoundStartedAt && Date.now() - cfg.frenzyRoundStartedAt.getTime() < 24 * 60 * 60 * 1000);
  const hide = new Set<number>();
  if (me.gmRole !== "comish") {
    const comish = await prisma.team.findMany({ where: { gmRole: "comish" }, select: { id: true } });
    for (const t of comish) if (t.id !== id) hide.add(t.id);
  }
  // the blackout only ever meant "the round that just opened, before the comish's
  // day-1 head start turns into everyone else's fair market info" — it must NOT
  // blanket-hide an EARLIER, already-CLOSED round's numbers just because a new
  // round happens to be inside its own first 24h. Only offers actually placed
  // in that current round get their $ withheld; a resolved prior round's offers
  // (COUNTERED, still inside their own decision window or not) show normally.
  return { hide, namesOnly, blackoutRound: namesOnly ? (cfg?.frenzyForcedRound ?? null) : null };
}

/** Commissioner toggle: lock / unlock UFA signings for ordinary GMs. */
export async function setFaSignLockAction(lock: boolean) {
  if (!(await isAdmin()) && !(await isComishTier())) return { ok: false as const, error: "Commissioner only." };
  const s = await loadSettings();
  await saveSettings({ ...s, faSignLock: lock });
  for (const p of ["/free-agents", "/teams"]) revalidatePath(p);
  return { ok: true as const, locked: lock };
}

/** Commissioner toggle: let comish-tier submit UFA-market offers even while the
 *  market is closed to everyone else — a manual head start for leagues that pin
 *  the phase by hand rather than following the real calendar (where the
 *  date-driven preview in getLeagueClock never has a "tomorrow" to look ahead to). */
export async function setFaEarlyAccessAction(on: boolean) {
  if (!(await isAdmin()) && !(await isComishTier())) return { ok: false as const, error: "Commissioner only." };
  const s = await loadSettings();
  await saveSettings({ ...s, faEarlyAccess: on });
  for (const p of ["/free-agents", "/teams"]) revalidatePath(p);
  return { ok: true as const, on };
}

/** Commissioner: schedule (or clear, passing null) a one-shot real moment for the
 *  Free Agent Frenzy window to auto-open for every GM — checked every ~5 minutes by
 *  the same cron that drives the daily league-day advance (lib/season-cron.ts
 *  autoOpenFrenzyIfDue). Pass a full ISO datetime (with timezone offset), not just a
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
  // blind bidding: only the commissioner tier sees the competing offers; a plain GM never
  // sees what other clubs have bid, and a co-commissioner can't see the commissioner's bid.
  const mask = await offerViewMask(playerId);
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
  const mask = await offerViewMask(playerId);
  if (!mask) return [];
  const bids = (await prisma.faBid.findMany({ where: { playerId }, orderBy: { id: "asc" } })).filter((b) => !mask.hide.has(b.teamId));
  if (bids.length === 0) return [];
  const teams = await prisma.team.findMany({ where: { id: { in: [...new Set(bids.map((b) => b.teamId))] } }, select: { id: true, code: true } });
  const codeOf = new Map(teams.map((t) => [t.id, t.code]));
  return bids.map((b) => ({ teamCode: codeOf.get(b.teamId) ?? "?", salary: b.salary, years: b.years, at: b.createdAt.toISOString() }));
}

/** Every free agent currently carrying at least one active offer, with who's
 *  bidding and for what — the commission's full-market view (the on-page
 *  "Weighing offers" list only ever showed in-season deliberators, a narrow
 *  slice; this covers Frenzy round bids and in-season offers alike, since both
 *  write to the same FaOffer table). Comish-tier only, same blind-bidding mask
 *  as every other offer-visibility action (a co-commissioner never sees the
 *  commissioner's own bid). */
export async function getAllActiveOffersAction() {
  const mask = await offerViewMaskForMarketList();
  if (!mask) return { ok: false as const, error: "Commissioner or co-commissioner only." };
  // conflict of interest, market-wide: drop every player the viewer's own club is
  // ALSO bidding on — same rule getPlayerOffersAction applies per-player, so the
  // full-market view can't be used to peek at competition on a player they want.
  const myTeamId = await getTeamSession();
  const myBidPlayerIds = myTeamId != null
    ? new Set((await prisma.faOffer.findMany({ where: { teamId: myTeamId, status: { in: ACTIVE } }, select: { playerId: true } })).map((o) => o.playerId))
    : new Set<number>();
  const offers = (await prisma.faOffer.findMany({
    where: { status: { in: ACTIVE } }, orderBy: [{ playerId: "asc" }, { salary: "desc" }],
  })).filter((o) => !mask.hide.has(o.teamId) && !myBidPlayerIds.has(o.playerId));
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
      offers: os.map((o) => {
        // fresh-round blackout: dollar figures are withheld for the first 24h,
        // but only for offers actually placed IN that fresh round — an already-
        // closed prior round's numbers aren't live information the comish's
        // day-1 head start could exploit, so they show normally regardless.
        const hideValue = mask.blackoutRound != null && o.round === mask.blackoutRound;
        return {
        teamId: o.teamId, teamCode: teamById.get(o.teamId)?.code ?? "?", teamLogo: teamById.get(o.teamId)?.logoUrl ?? null,
        salary: hideValue ? null : o.salary, years: hideValue ? null : o.years,
        line: o.line, pp: o.pp, pk: o.pk, round: o.round, status: o.status, twoWay: !!o.twoWay,
        // last ACTUAL raise (FaBid log), not o.updatedAt — that also bumps on
        // round-processing status flips (COUNTERED/SHORTLISTED/REJECTED) that
        // never touched the GM's terms, which would falsely read as "raised"
        placedAt: o.createdAt.toISOString(), updatedAt: lastRaisedAt.get(`${playerId}:${o.teamId}`) ?? o.createdAt.toISOString(),
        };
      }),
    };
  }).filter((p) => p.offers.length > 0); // a hidden comish-only offer can leave a co-comish's view empty for that player
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

/** Comish-tier only, READ-ONLY: DMs the caller's own team what round 1 WOULD do
 *  to each of its standing offers if it closed right now — sign / counter (with
 *  the amount) / pass. Nothing is written: no FaOffer status changes, no
 *  signings, no eliminations, for the caller OR anyone else, and no other
 *  bidder is notified. This exists because a comish/co-comish gets a one-day
 *  head start PLACING offers ahead of ordinary GMs (see the round-lock in
 *  submitOfferAction) — without this they'd have no way to know where they
 *  stand until the real close, a day after everyone else finds out. The actual
 *  binding round close (processRoundEnd) still runs for the whole league
 *  together at its normal time; this only lets the two commissioner offices
 *  see the outcome early so they can raise before then — it changes nothing
 *  about what the real close decides, or when anyone else's offers resolve. */
export async function previewMyRoundOutcomeAction() {
  const id = await getTeamSession();
  if (id == null) return { ok: false as const, error: "Sign in first." };
  const me = await prisma.team.findUnique({ where: { id }, select: { isAdmin: true, gmRole: true } });
  if (!me || !(me.isAdmin || me.gmRole === "comish" || me.gmRole === "co_comish")) {
    return { ok: false as const, error: "Commissioner or co-commissioner only." };
  }
  const clock = await getLeagueClock();
  if (!clock.frenzyOpen || clock.frenzyRound !== 1) return { ok: false as const, error: "Only meaningful during round 1." };
  const previewed = await previewRoundOutcomeForTeam(id);
  return { ok: true as const, previewed };
}

/** The actual read-only preview logic behind previewMyRoundOutcomeAction, split
 *  out so it can run for a specific team id (e.g. both commissioner offices at
 *  once) without a live session. */
export async function previewRoundOutcomeForTeam(id: number): Promise<number> {
  const myOffers = await prisma.faOffer.findMany({ where: { teamId: id, status: { in: ACTIVE } } });
  if (myOffers.length === 0) return 0;

  const pool = await loadMarketPool();
  const cmap = await teamContentionMap();
  const faId = await faPoolTeamId();
  const clock = await getLeagueClock();
  const cap = await loadLeagueCap();
  const nice = (s: string) => s.replace(/''[A-Za-z]''|\s*\([^)]*\)/g, "").trim();
  let previewed = 0;
  for (const my of myOffers) {
    const player = await prisma.player.findUnique({ where: { id: my.playerId }, select: { name: true, isGoalie: true, rosterType: true } });
    if (!player || (player.rosterType && FREE.includes(player.rosterType))) continue;
    const list = await prisma.faOffer.findMany({ where: { playerId: my.playerId, status: { in: ACTIVE } } });
    const nm = nice(player.name);
    const url = faFocusUrl(my.playerId, player.isGoalie);

    // would he sign right now? Same test pickAndSign uses at round close: best
    // acceptable offer wins; failing that, a genuinely UNCONTESTED player (one
    // standing offer, period) still signs at his floor — round-lock means no
    // new club can join once this round closes, so there's nobody left to wait
    // for (matches processRoundEnd's allowSoleFloor=true). But if 2+ offers are
    // genuinely close (same 0.75x band as the outclassed check below), that's
    // real competition, not a snap decision — predict a counter instead of a
    // sign, matching processRoundEnd's own liveCount gate.
    const liveSalary = Math.max(...list.map((o) => o.salary));
    const liveCount = list.filter((o) => o.salary >= liveSalary * 0.75).length;
    let bestAcceptable: { teamId: number; utility: number } | null = null;
    if (liveCount < 2) for (const o of list) {
      const ev = await evaluateTeamOffer(my.playerId, o.teamId, o.salary, o.years, { line: o.line, pp: o.pp, pk: o.pk }, pool, cmap, 1, { clause: o.grantClause, breadth: o.mNtcBreadth });
      if (ev?.acceptable && (!bestAcceptable || ev.utility > bestAcceptable.utility)) bestAcceptable = { teamId: o.teamId, utility: ev.utility };
    }
    if (!bestAcceptable && list.length === 1) {
      const soleEv = await evaluateTeamOffer(my.playerId, id, my.salary, my.years, { line: my.line, pp: my.pp, pk: my.pk }, pool, cmap, 1, { clause: my.grantClause, breadth: my.mNtcBreadth });
      if (soleEv) {
        const info = await teamCapInfo(id);
        const ceiling = capCeilingForPhase(cap.upper, clock.phase) + info.ltir;
        if (info.committed + soleEv.ask.floorSalary <= ceiling) bestAcceptable = { teamId: id, utility: 0 };
      }
    }
    if (bestAcceptable) {
      const body = bestAcceptable.teamId === id
        ? `👀 Preview (round 1 hasn't closed yet): ${nm} would SIGN with you right now${list.length === 1 ? " — you're his only offer" : ""}.`
        : `👀 Preview (round 1 hasn't closed yet): ${nm} would sign elsewhere right now — your offer would be rejected.`;
      await prisma.dmMessage.create({ data: { fromTeamId: faId, toTeamId: id, body, tradeUrl: url } }).catch(() => {});
      previewed++;
      continue;
    }

    // not an outright sign — would he counter, or cut this offer as outclassed?
    const ev = await evaluateTeamOffer(my.playerId, id, my.salary, my.years, { line: my.line, pp: my.pp, pk: my.pk }, pool, cmap, 2, { clause: my.grantClause, breadth: my.mNtcBreadth });
    if (!ev) continue;
    const bestSalary = Math.max(...list.map((o) => o.salary));
    const soleOffer = list.length === 1;
    const outclassed = !soleOffer && my.salary < bestSalary * 0.75;
    const closeRace = !soleOffer && list.filter((x) => x.salary >= bestSalary * 0.90).length >= 2;
    let body: string;
    if (my.salary < ev.ask.floorSalary * 0.6 || outclassed) {
      body = `👀 Preview (round 1 hasn't closed yet): ${nm} would pass on your offer right now — ${outclassed ? "another club's offer is well ahead of yours" : "it isn't close to his value"}.`;
    } else if (!soleOffer && !closeRace) {
      const isLeader = my.salary === bestSalary;
      body = isLeader
        ? `👀 Preview (round 1 hasn't closed yet): your offer on ${nm} is currently the best on the table. You can wait for his decision, or raise it if you're worried another club might try to top you.`
        : `👀 Preview (round 1 hasn't closed yet): another club has a better offer on ${nm} right now. You have room to improve yours if you want to stay in it.`;
    } else {
      const want = competitiveAsk(ev.ask.salary, my.salary, list);
      body = `👀 Preview (round 1 hasn't closed yet): ${nm} would counter — he wants about $${(want / 1e6).toFixed(2)}M × ${ev.ask.years}yr${soleOffer ? "" : " (other clubs are also in)"}. You have time to raise before the real close.`;
    }
    await prisma.dmMessage.create({ data: { fromTeamId: faId, toTeamId: id, body, tradeUrl: url } }).catch(() => {});
    previewed++;
  }
  revalidatePath("/free-agents");
  return previewed;
}

/** Place or raise a team's standing offer to a free agent (money + term + promised usage). */
export async function submitOfferAction(
  playerId: number, teamId: number, salary: number, years: number, line: number, pp: boolean, pk: boolean,
  grantClause?: string | null, mNtcBreadth?: number | null, offerTwoWay?: boolean,
) {
  if (!(await canManageTeam(teamId))) return { ok: false as const, error: "You don't manage this team." };
  // commissioner lock: UFA signings can be temporarily closed to ordinary GMs
  const lockSettings = await loadSettings();
  if (lockSettings.faSignLock && !(await isAdmin()) && !(await isComishTier())) {
    return { ok: false as const, error: "🔒 UFA podpisy sú momentálne zamknuté komisárom." };
  }
  const clock = await getLeagueClock();
  let win = clock.faWindow;
  if (!win.open) {
    // Manual comish head start (faEarlyAccess) — for leagues that pin the phase by
    // hand rather than following the real calendar, where getLeagueClock's date-driven
    // "tomorrow" preview has nothing to look ahead to. Comish-tier acts as if the
    // standard in-season market were already open; everyone else stays locked out.
    if (lockSettings.faEarlyAccess && (await isComishTier())) {
      win = { open: true, immediate: true, ownOnly: false, previewOnly: true };
    } else {
      return { ok: false as const, error: "The free-agent market is closed." };
    }
  }
  // comish-tier head-start: the market opens for everyone tomorrow — the commissioner's
  // office may already act on it today, since they already see the whole field of offers.
  if (win.previewOnly && !(await isComishTier())) {
    return { ok: false as const, error: "The market opens tomorrow — the commissioner's office gets today." };
  }
  // comish-tier head-start (July Frenzy only): the first day of each round is the
  // commissioner's office only (they bid before they can see anything), GMs join day 2.
  // This is purely a real-calendar-day head start, so it's skipped entirely when the
  // market was FORCE-opened (clock.faForced, e.g. frenzyAutoOpenAt on a league that
  // doesn't run on the real July dates) — the real calendar day never advances in
  // that case, so `dayInRound` would read as "day 1" forever, permanently locking
  // every ordinary GM out of a market the commissioner deliberately opened for them.
  if (!win.immediate && !clock.faForced) {
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
  const twoWayErr = twoWayObjection(twoWay, player, years, {
    relaxOlder, relaxWeak, olderAge: tw.olderAge, gpLimit: tw.gpLimit, weakOverall: tw.weakOverall,
    maxYears: tw.maxYears, ahlMaxYears: tw.ahlMaxYears, fewGpMaxYears: tw.fewGpMaxYears,
  });
  if (twoWayErr) return { ok: false as const, error: twoWayErr };

  // cap check — committed cap hit + this offer must stay under the ceiling
  const cap = await loadLeagueCap();
  const { committed, ltir } = await teamCapInfo(teamId);
  const existing = await prisma.faOffer.findUnique({ where: { playerId_teamId: { playerId, teamId } } });
  if (existing && existing.status === "REJECTED") {
    return { ok: false as const, error: "The player has moved on — he's no longer negotiating with your club." };
  }
  // round-lock (July Frenzy only): once a player has AT LEAST ONE standing
  // offer, he's in his own individual FRENZY_DECISION_DAYS-day window
  // (Player.faDecisionAt — see processRoundEnd) and the field is closed to
  // new entrants, though an existing bidder can still raise. A player who's
  // never had any offer stays open to a fresh bid in ANY round — he only
  // ever carries forward because nobody's bid on him yet, so there's no
  // negotiation in progress to protect. Keyed off the game PHASE, not
  // win.immediate — the commissioner's faEarlyAccess head start (see above)
  // also sets win.immediate=true to get past the "market closed" wall, but
  // it's still round-based Frenzy negotiation underneath. Only the regular-
  // season / playoffs immediate market is genuinely round-less (continuous
  // re-negotiation is the intended behavior there).
  if (clock.phase !== "regular" && clock.phase !== "playoffs") {
    if (!existing && player.faDecisionAt != null) {
      return { ok: false as const, error: "He's already deciding among his current suitors — bidding is closed to new clubs." };
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
  // A raise on a player ALREADY in his individual decision window keeps the
  // round that actually opened that window (existing.round) instead of
  // whatever weekly round happens to be current — the 3-day window is
  // deliberately decoupled from the round clock (submitOfferAction's own
  // round-lock comment above), so a raise made an hour after the NEXT round
  // opened is still part of the round-1 process, not a fresh round-2 entry.
  // A brand-new offer (no existing row, or the player isn't deciding) always
  // takes the current round — that's genuinely when it was first placed.
  const roundToStamp = (existing && player.faDecisionAt != null) ? existing.round : clock.frenzyRound;

  const offer = await prisma.faOffer.upsert({
    where: { playerId_teamId: { playerId, teamId } },
    update: { salary, years, line: dep.line, pp, pk, status: newStatus, round: roundToStamp, grantClause: clause, mNtcBreadth: breadth, twoWay },
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
      await prisma.player.update({ where: { id: playerId }, data: { faDecisionAt: addDays(await getLeagueDate(), IN_SEASON_COLLECT_DAYS), faCountered: false } });
    }
    const decideAt = player.faDecisionAt ?? addDays(await getLeagueDate(), IN_SEASON_COLLECT_DAYS);
    revalidatePath("/free-agents");
    return {
      ok: true as const, deliberating: true as const, raised: !!existing,
      decisionAt: decideAt.toISOString(), countered: player.faCountered, capWarning,
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
  // reset the real-time round-close countdown, and advance the tracked round
  // number too — both matter when the market is force-opened (clock.frenzyOpen
  // via faOpen, not the real July calendar), where getLeagueClock has no
  // calendar day to derive either from.
  await prisma.leagueConfig.upsert({
    where: { id: 1 },
    update: { leagueDate: next, frenzyRoundStartedAt: new Date(), frenzyForcedRound: { increment: 1 } },
    create: { id: 1, leagueDate: next, frenzyRoundStartedAt: new Date(), frenzyForcedRound: 2 },
  });
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

/** End-of-round processing for the force-opened frenzy. Called when a round's
 *  real-time clock elapses (or by the admin button). A player who gets AT
 *  LEAST ONE offer this round does NOT cascade into the next weekly round —
 *  hopeless/outclassed offers are cut immediately, and every surviving offer
 *  starts a shared FRENZY_DECISION_DAYS-day window (Player.faDecisionAt),
 *  judged individually by resolveFrenzyDecisions once it elapses. Only a
 *  player who got NO offer at all this round stays open and carries into the
 *  next round (see submitOfferAction's round-lock: a fresh club may bid on an
 *  untouched player any round; once he has a faDecisionAt, new entrants are
 *  shut out — existing bidders can still raise). */
export async function processRoundEnd(endedRound: number): Promise<{ decided: number; eliminated: number; signed: number }> {
  const pool = await loadMarketPool();
  const cmap = await teamContentionMap();
  const faId = await faPoolTeamId();
  const agentDm = async (toTeamId: number, body: string, playerId: number, isGoalie: boolean) => {
    await prisma.dmMessage.create({ data: { fromTeamId: faId, toTeamId, body, tradeUrl: faFocusUrl(playerId, isGoalie) } }).catch(() => {});
  };
  const nextRound = endedRound + 1;
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
  const offers = await prisma.faOffer.findMany({ where: { status: { in: ACTIVE }, round: { gte: 1 }, playerId: { notIn: inDecision.map((p) => p.id) } } });
  const byPlayer = new Map<number, typeof offers>();
  for (const o of offers) { const a = byPlayer.get(o.playerId) ?? []; a.push(o); byPlayer.set(o.playerId, a); }

  let decided = 0, eliminated = 0, signedNow = 0;
  for (const [playerId, list] of byPlayer) {
    const player = await prisma.player.findUnique({ where: { id: playerId }, select: { name: true, rosterType: true, age: true, isGoalie: true } });
    if (!player || (player.rosterType && FREE.includes(player.rosterType))) continue;
    const name = player.name;

    // if a standing offer already meets his ask at THIS round, he signs now —
    // no waiting on a decision window for something that's already a clear
    // yes. A sole/dominant bidder (liveCount<2) gets allowSoleFloor=true (at
    // his floor if the bid undercuts it); 2+ genuinely live offers skip
    // straight to the shared decision window below instead of an instant
    // utility tiebreak deciding real competition on the spot.
    const liveSalary = Math.max(...list.map((o) => o.salary));
    const liveCount = list.filter((o) => o.salary >= liveSalary * 0.75).length;
    const signDetail = liveCount >= 2 ? null : await pickAndSign(playerId, player, list, endedRound, pool, cmap, true);
    if (signDetail) {
      signedNow++;
      const after = await prisma.player.findUnique({ where: { id: playerId }, select: { teamId: true } });
      const winner = after?.teamId ?? null;
      const bidders = [...new Set(list.map((o) => o.teamId))];
      const winnerTeam = winner != null ? await prisma.team.findUnique({ where: { id: winner }, select: { code: true } }) : null;
      for (const tid of bidders) {
        if (tid === winner) await agentDm(tid, `✅ ${name} has SIGNED with you!`, playerId, player.isGoalie);
        else await agentDm(tid, `🚫 ${name} signed with ${winnerTeam?.code ?? "another club"} — your offer is rejected.`, playerId, player.isGoalie);
      }
      continue;
    }

    // value every offer, drop the hopeless lowballs, and start a shared
    // FRENZY_DECISION_DAYS-day window for everyone who survives instead of
    // waiting for a future round — resolveFrenzyDecisions judges the field
    // the moment it elapses.
    const scored = [] as { o: (typeof list)[number]; ev: Awaited<ReturnType<typeof evaluateTeamOffer>> }[];
    for (const o of list) scored.push({ o, ev: await evaluateTeamOffer(playerId, o.teamId, o.salary, o.years, { line: o.line, pp: o.pp, pk: o.pk }, pool, cmap, nextRound, { clause: o.grantClause, breadth: o.mNtcBreadth }) });

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
          ? `🥇 Your offer on ${name} is currently the best on the table. You have ${FRENZY_DECISION_DAYS} days — raise it if you're worried another club might try to top you.`
          : `📩 Another club has a better offer on ${name} right now. You have ${FRENZY_DECISION_DAYS} days to improve yours if you want to stay in it.`;
        await agentDm(o.teamId, msg, playerId, player.isGoalie);
      } else {
        const want = competitiveAsk(ev.ask.salary, o.salary, list);
        await prisma.faOffer.update({ where: { id: o.id }, data: { status: "COUNTERED", counterSalary: want, counterYears: ev.ask.years } });
        survivors++;
        const msg = soleOffer
          ? `📩 ${name} isn't ready to sign at that price yet — he wants about $${(want / 1e6).toFixed(2)}M × ${ev.ask.years}yr. You have ${FRENZY_DECISION_DAYS} days to raise your offer.`
          : `📩 ${name} is weighing multiple offers. Put in your BEST offer within ${FRENZY_DECISION_DAYS} days: he wants about $${(want / 1e6).toFixed(2)}M × ${ev.ask.years}yr (other clubs are also in — bidding is blind).`;
        await agentDm(o.teamId, msg, playerId, player.isGoalie);
      }
    }
    if (survivors > 0) {
      await prisma.player.update({ where: { id: playerId }, data: { faDecisionAt: new Date(Date.now() + FRENZY_DECISION_DAYS * 86_400_000), faCountered: true } });
      await prisma.transaction.create({ data: { type: "FA_NEGOTIATION", message: `${name} is deciding between his suitors — the Agent settles it in ${FRENZY_DECISION_DAYS} days.` } });
      decided++;
    }
  }
  return { decided, eliminated, signed: signedNow };
}

/** Resolves every player whose individual FRENZY_DECISION_DAYS-day window
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
      unsigned++;
      await prisma.faOffer.updateMany({ where: { playerId: p.id, status: { in: ACTIVE } }, data: { status: "REJECTED" } });
      for (const tid of bidders) await agentDm(tid, `${nm} didn't sign anyone — no offer met his ask. He stays on the market.`, p.id, p.isGoalie);
    }
    await prisma.player.update({ where: { id: p.id }, data: { faDecisionAt: null, faCountered: false } });
  }
  return { signed, unsigned };
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
    where: { id: playerId }, select: { teamId: true, contractYears: true, capHit: true, contractExpiry: true, contractType: true, tradeClause: true, noTradeTeams: true, contractText: true, age: true, name: true, lastSeasonGP: true, resignRound: true, resignStatus: true, resignOfferSalary: true, rosterType: true, franchiseTag: true, overall: true, realFarmTeamId: true },
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
  const twoWayErr = twoWayObjection(twoWay, player, years, {
    olderAge: tw.olderAge, gpLimit: tw.gpLimit, weakOverall: tw.weakOverall,
    maxYears: tw.maxYears, ahlMaxYears: tw.ahlMaxYears, fewGpMaxYears: tw.fewGpMaxYears,
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

  // The new deal replaces the current one immediately — salary/term update the
  // moment the offer is accepted, same as any other signing (no deferred-extension
  // delay to next season's rollover).
  const expiry = CURRENT_SEASON_START + years;
  const noTradeTeams = clause === "M_NTC" ? await weakestTeams(breadth ?? 12, teamId) : [];
  const contractText = `$${salary.toLocaleString("en-US")} × ${years}yr (through ${expiry})`;
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
    prevType: player.contractType, prevClause: player.tradeClause, prevNoTrade: player.noTradeTeams,
    prevRosterType: player.rosterType, prevTeamId: player.teamId, prevContractText: player.contractText,
  } });
  // no revalidatePath — it would unmount the confirmation modal; client refreshes on Done.
  return { ok: true as const, signed: true, salary, years, name: player.name };
}
