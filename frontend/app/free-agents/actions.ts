"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { canManageTeam, getTeamSession, isAdmin } from "@/lib/auth";
import { getLeagueClock } from "@/lib/calendar-server";
import { CURRENT_SEASON_START, capCeilingForPhase, ltirRelief } from "@/lib/finance";
import {
  loadMarketPool, teamContentionMap, teamAsk, evaluateTeamOffer, loadLeagueCap,
} from "@/lib/free-agency-server";
import { MAX_TERM, faPosGroup, willingnessNote, type Deployment } from "@/lib/free-agency";
import { computeELC } from "@/lib/elc";

const FREE = ["NHL", "AHL", "RETIRED", "PROSPECT", "RELEASED"]; // not a signable free agent
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
export async function getAskAtAction(playerId: number, teamId: number, line: number, pp: boolean, pk: boolean) {
  const ev = await evaluateTeamOffer(playerId, teamId, 0, 1, { line: clampLine(line), pp, pk });
  if (!ev) return null;
  return { askSalary: ev.ask.salary, askYears: ev.ask.years, floor: ev.ask.floorSalary, minYears: ev.ask.minYears, maxYears: ev.ask.maxYears };
}

/** All standing offers on a player (open frenzy — GMs can see the competition). */
export async function getPlayerOffersAction(playerId: number) {
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
  }));
}

/** Place or raise a team's standing offer to a free agent (money + term + promised usage). */
export async function submitOfferAction(
  playerId: number, teamId: number, salary: number, years: number, line: number, pp: boolean, pk: boolean,
) {
  if (!(await canManageTeam(teamId))) return { ok: false as const, error: "You don't manage this team." };
  const clock = await getLeagueClock();
  if (!clock.frenzyOpen) return { ok: false as const, error: "The free-agent market is closed." };

  const player = await prisma.player.findUnique({ where: { id: playerId }, select: { rosterType: true } });
  if (!player) return { ok: false as const, error: "Player not found." };
  if (player.rosterType && FREE.includes(player.rosterType)) {
    return { ok: false as const, error: "This player is not a free agent." };
  }
  if (salary < 775_000) return { ok: false as const, error: "Below the league minimum salary." };
  years = Math.max(1, Math.min(MAX_TERM, Math.round(years)));

  // cap check — committed cap hit + this offer must stay under the ceiling
  const cap = await loadLeagueCap();
  const { committed, ltir } = await teamCapInfo(teamId);
  const existing = await prisma.faOffer.findUnique({ where: { playerId_teamId: { playerId, teamId } } });
  if (existing && existing.status === "REJECTED") {
    return { ok: false as const, error: "The player has moved on — he's no longer negotiating with your club." };
  }
  const ceiling = capCeilingForPhase(cap.upper, clock.phase) + ltir;
  if (committed + salary > ceiling) {
    const overSeason = clock.phase === "regular" || clock.phase === "playoffs";
    return { ok: false as const, error: overSeason
      ? `Over the cap — you have ${fmtM(cap.upper - committed)} of space, this offer is ${fmtM(salary)}.`
      : `Over the off-season ceiling (cap +10%) — ${fmtM(ceiling - committed)} of room left, this offer is ${fmtM(salary)}. You must be cap-compliant by opening day.` };
  }

  const dep: Deployment = { line: clampLine(line), pp, pk };
  const evalr = await evaluateTeamOffer(playerId, teamId, salary, years, dep);
  // a raise re-enters contention; a shortlisted offer stays shortlisted
  const newStatus = existing?.status === "SHORTLISTED" ? "SHORTLISTED" : "PENDING";

  await prisma.faOffer.upsert({
    where: { playerId_teamId: { playerId, teamId } },
    update: { salary, years, line: dep.line, pp, pk, status: newStatus, round: clock.frenzyRound },
    create: { playerId, teamId, salary, years, line: dep.line, pp, pk, round: clock.frenzyRound },
  });
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
  const result = await resolveFrenzy();
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
  for (const p of ["/free-agents", "/signings"]) revalidatePath(p);
  return { ok: true as const, ...r, round: clock.frenzyRound };
}

/** Shared resolution used by the admin button and by the calendar when the window closes. */
export async function resolveFrenzy(): Promise<{ signed: number; details: string[] }> {
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

    let best: { offer: (typeof offers)[number]; utility: number } | null = null;
    for (const o of offers) {
      // final week → he judges every offer at fair (round-3) value
      const ev = await evaluateTeamOffer(playerId, o.teamId, o.salary, o.years, { line: o.line, pp: o.pp, pk: o.pk }, pool, cmap, 3);
      if (ev?.acceptable && (!best || ev.utility > best.utility)) best = { offer: o, utility: ev.utility };
    }

    if (!best) continue; // holdout — no offer cleared his bar; offers stay pending

    const o = best.offer;
    const twoWay = (player.age ?? 27) <= 24 && o.salary <= 3_000_000;
    const expiry = CURRENT_SEASON_START + o.years;
    await prisma.player.update({
      where: { id: playerId },
      data: {
        teamId: o.teamId, rosterType: "NHL",
        capHit: o.salary, contractYears: o.years, contractExpiry: expiry,
        contractType: twoWay ? "TWO_WAY" : "ONE_WAY",
        contractText: `$${o.salary.toLocaleString("en-US")} × ${o.years}yr (through ${expiry})`,
        signPromiseLine: o.line, signPromisePP: o.pp, signPromisePK: o.pk,
        disgruntled: false, tradeRequested: false, promiseWarnGame: null,
      },
    });
    await prisma.faOffer.update({ where: { id: o.id }, data: { status: "ACCEPTED" } });
    await prisma.faOffer.updateMany({ where: { playerId, id: { not: o.id }, status: { in: ACTIVE } }, data: { status: "REJECTED" } });
    const team = await prisma.team.findUnique({ where: { id: o.teamId }, select: { code: true } });
    await prisma.transaction.create({
      data: { type: "SIGNING", message: `${team?.code ?? "?"} signed ${player.name} — $${(o.salary / 1e6).toFixed(2)}M × ${o.years}yr` },
    });
    details.push(`${player.name} → ${team?.code} ($${(o.salary / 1e6).toFixed(2)}M × ${o.years}yr)`);
    signed++;
  }
  return { signed, details };
}

/** End-of-round processing for the multi-week frenzy. Called when the calendar
 *  crosses a weekly round boundary (or by the admin button).
 *  - after round 1: the player COUNTERS each standing offer (what he wants from
 *    that club at round-2 value) and drops hopeless lowballs.
 *  - after round 2: he SHORTLISTS his best suitors and tells the rest he's moving on.
 *  Round 3 ends by `resolveFrenzy` signing the best shortlisted offer. */
export async function processRoundEnd(endedRound: number): Promise<{ countered: number; eliminated: number; shortlisted: number }> {
  const pool = await loadMarketPool();
  const cmap = await teamContentionMap();
  const nextRound = endedRound + 1;
  const offers = await prisma.faOffer.findMany({ where: { status: { in: ACTIVE } } });
  const byPlayer = new Map<number, typeof offers>();
  for (const o of offers) { const a = byPlayer.get(o.playerId) ?? []; a.push(o); byPlayer.set(o.playerId, a); }

  let countered = 0, eliminated = 0, shortlisted = 0;
  for (const [playerId, list] of byPlayer) {
    const player = await prisma.player.findUnique({ where: { id: playerId }, select: { name: true, rosterType: true } });
    if (!player || (player.rosterType && FREE.includes(player.rosterType))) continue;
    const name = player.name;

    // value every offer at the UPCOMING round
    const scored = [] as { o: (typeof list)[number]; ev: Awaited<ReturnType<typeof evaluateTeamOffer>> }[];
    for (const o of list) scored.push({ o, ev: await evaluateTeamOffer(playerId, o.teamId, o.salary, o.years, { line: o.line, pp: o.pp, pk: o.pk }, pool, cmap, nextRound) });

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
      // keep the top suitors by utility (must still clear his bar), drop the rest
      const ranked = scored.filter((s) => s.ev).sort((a, b) => (b.ev!.utility) - (a.ev!.utility));
      const keep = new Set(ranked.slice(0, SHORTLIST_SIZE).map((s) => s.o.id));
      for (const { o } of scored) {
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
  return { countered, eliminated, shortlisted };
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

/** Re-sign one of your OWN expiring players (contract up for renewal). Same engine
 *  as the frenzy, but a direct one-on-one negotiation: the player accepts if the
 *  offer clears his team-specific floor + term, otherwise he counters with why. */
export async function extendContractAction(
  playerId: number, teamId: number, salary: number, years: number, line: number, pp: boolean, pk: boolean,
) {
  if (!(await canManageTeam(teamId))) return { ok: false as const, error: "You don't manage this team." };
  const player = await prisma.player.findUnique({
    where: { id: playerId }, select: { teamId: true, contractYears: true, capHit: true, age: true, name: true },
  });
  if (!player) return { ok: false as const, error: "Player not found." };
  if (player.teamId !== teamId) return { ok: false as const, error: "That player isn't on your team." };
  if ((player.contractYears ?? 0) > 1) return { ok: false as const, error: "This contract isn't up for renewal yet." };
  if (salary < 775_000) return { ok: false as const, error: "Below the league minimum salary." };
  years = Math.max(1, Math.min(MAX_TERM, Math.round(years)));

  // cap check — replace his current hit with the new one (off-season +10% cushion, + LTIR relief)
  const cap = await loadLeagueCap();
  const info = await teamCapInfo(teamId);
  const committed = info.committed - (player.capHit ?? 0);
  const ceiling = capCeilingForPhase(cap.upper, (await getLeagueClock()).phase) + info.ltir;
  if (committed + salary > ceiling) {
    return { ok: false as const, error: `Over the ceiling — you'd have ${fmtM(ceiling - committed)} of room, this deal is ${fmtM(salary)}.` };
  }

  const dep: Deployment = { line: clampLine(line), pp, pk };
  const ev = await evaluateTeamOffer(playerId, teamId, salary, years, dep);
  if (!ev) return { ok: false as const, error: "Could not value the player." };
  if (!ev.acceptable) {
    let reason: string;
    const moneyOk = salary >= ev.ask.floorSalary;
    if (!moneyOk && (years < ev.ask.minYears || years > ev.ask.maxYears)) reason = `He wants more — around ${fmtM(ev.ask.floorSalary)} over ${ev.ask.minYears}-${ev.ask.maxYears}yr.`;
    else if (!moneyOk) reason = `He wants more money — around ${fmtM(ev.ask.floorSalary)}.`;
    else if (years > ev.ask.maxYears) reason = `He won't commit that long — ${ev.ask.maxYears}yr max at this role.`;
    else reason = `He wants more security — at least ${ev.ask.minYears}yr.`;
    return { ok: false as const, rejected: true, reason, floor: ev.ask.floorSalary, minYears: ev.ask.minYears, maxYears: ev.ask.maxYears };
  }

  const expiry = CURRENT_SEASON_START + years;
  const twoWay = (player.age ?? 27) <= 24 && salary <= 3_000_000;
  await prisma.player.update({
    where: { id: playerId },
    data: {
      capHit: salary, contractYears: years, contractExpiry: expiry,
      contractType: twoWay ? "TWO_WAY" : "ONE_WAY",
      contractText: `$${salary.toLocaleString("en-US")} × ${years}yr (through ${expiry})`,
      signPromiseLine: dep.line, signPromisePP: pp, signPromisePK: pk,
      disgruntled: false, tradeRequested: false, promiseWarnGame: null,
    },
  });
  const team = await prisma.team.findUnique({ where: { id: teamId }, select: { code: true, slug: true } });
  await prisma.transaction.create({
    data: { type: "SIGNING", message: `${team?.code ?? "?"} re-signed ${player.name} — $${(salary / 1e6).toFixed(2)}M × ${years}yr` },
  });
  if (team?.slug) revalidatePath(`/teams/${team.slug}/roster`);
  for (const p of ["/signings", "/finance"]) revalidatePath(p);
  return { ok: true as const, salary, years };
}
