// Advanced AI GM — trade negotiation. Runs on Sim Day for GM-less clubs whose
// aiMode is "advanced". It evaluates trade proposals HUMAN GMs sent it and either
// accepts (fair/favourable + fits its concept), declines, or sends a COUNTER-OFFER
// that asks the other club to sweeten the deal. It will not give up a star for a
// weaker return, and it weighs its contention window (contender vs rebuild) and
// roster needs — like a video-game GM.

import { prisma } from "./prisma";
import { loadSettings } from "./sim/settings";
import { teamContentionMap } from "./free-agency-server";
import type { Contention } from "./free-agency";
import { packageFromTrade, executeAcceptedTrade, createTradeRecord, type TradePackage } from "./trade-exec";
import { analyzeTradeAction } from "@/app/trades/build/actions";
import { getLeagueDate } from "./calendar-server";
import { roundForDate } from "./calendar";

const clean = (s: string) => s.replace(/\s*\([^)]*\)/g, "").trim();
const grp = (pos: string | null) => { const P = (pos ?? "").toUpperCase(); if (/G/.test(P)) return "G"; if (/(^|\/)D(\/|$)|^D$/.test(P)) return "D"; if (/C/.test(P)) return "C"; return "W"; };

// "Star" / "franchise" are RELATIVE to this league's own OV spread (our overalls top
// out far below the 82/88 of a real-NHL scale), computed from percentiles, and
// separately for skaters vs goalies (goalies sit on a higher OV band).
type Thresholds = { skStar: number; skFranchise: number; gkStar: number; gkFranchise: number };
async function computeThresholds(): Promise<Thresholds> {
  const pull = async (isGoalie: boolean) => (await prisma.player.findMany({ where: { rosterType: "NHL", isGoalie, overall: { not: null } }, select: { overall: true } }))
    .map((x) => x.overall ?? 0).filter(Boolean).sort((a, b) => b - a);
  const at = (arr: number[], q: number) => arr.length ? arr[Math.min(arr.length - 1, Math.floor(arr.length * q))] : 999;
  const sk = await pull(false), gk = await pull(true);
  return {
    skStar: at(sk, 0.06),       // top ~6% of skaters = a star
    skFranchise: at(sk, 0.015), // top ~1.5% = a franchise cornerstone
    gkStar: at(gk, 0.10),       // fewer goalies → top ~10% = a star starter
    gkFranchise: at(gk, 0.03),
  };
}
const isStar = (ov: number, isGoalie: boolean, th: Thresholds) => ov >= (isGoalie ? th.gkStar : th.skStar);
const isFranchise = (ov: number, isGoalie: boolean, th: Thresholds) => ov >= (isGoalie ? th.gkFranchise : th.skFranchise);

type Decision = { action: "accept" | "decline" | "counter"; reason: string; counter?: TradePackage; counterNote?: string };

/** Decide how an advanced-AI receiving club responds to one pending proposal. */
async function decide(tradeId: number, aiTeamId: number, contention: Contention, th: Thresholds): Promise<Decision> {
  const pkg = await packageFromTrade(tradeId);
  if (pkg.toTeamId !== aiTeamId) return { action: "decline", reason: "not addressed to this club" };

  const analysis = await analyzeTradeAction(pkg);
  if (!analysis.ok) return { action: "decline", reason: "could not evaluate" };
  // AI is the "to" team: it RECEIVES the from-side (analysis.meGives) and GIVES the
  // to-side (analysis.meGets).
  const aiGets = analysis.meGives;
  const aiGives = analysis.meGets;
  const ratio = aiGets / Math.max(1, aiGives);

  // player context for the assets AI would send / receive
  const outIds = pkg.toPlayers.map((p) => p.playerId);
  const inIds = pkg.fromPlayers.map((p) => p.playerId);
  const [outP, inP, team] = await Promise.all([
    prisma.player.findMany({ where: { id: { in: outIds } }, select: { id: true, name: true, overall: true, age: true, position: true, isGoalie: true } }),
    prisma.player.findMany({ where: { id: { in: inIds } }, select: { id: true, overall: true, age: true, position: true } }),
    prisma.team.findUnique({ where: { id: aiTeamId }, select: { needs: true } }),
  ]);
  const needs = new Set((team?.needs ?? []).map((s) => s.toUpperCase()));
  const avg = (xs: (number | null | undefined)[]) => { const v = xs.filter((x): x is number => x != null); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; };
  const outOv = avg(outP.map((p) => p.overall)), inOv = avg(inP.map((p) => p.overall));
  const outAge = avg(outP.map((p) => p.age)), inAge = avg(inP.map((p) => p.age));
  const givesPicksProspects = pkg.toPicks.length + (pkg.toProspects?.length ?? 0) > 0;
  const getsPicksProspects = pkg.fromPicks.length + (pkg.fromProspects?.length ?? 0) > 0;
  const star = outP.find((p) => isStar(p.overall ?? 0, p.isGoalie, th));
  const franchise = outP.find((p) => isFranchise(p.overall ?? 0, p.isGoalie, th));

  // --- required value ratio (T): the AI wants at least T× value back ------------
  let T = 1.05; // baseline: a small win, so it never gets fleeced
  if (contention === "contender") {
    T = 1.02;
    if (inAge != null && outAge != null && inAge >= 27 && (inOv ?? 0) >= (outOv ?? 0)) T = 0.94; // win-now talent in
    if (outAge != null && outAge <= 24) T = Math.max(T, 1.18);   // giving up youth → wants a premium
    if (getsPicksProspects && !inP.length) T = Math.max(T, 1.15); // just picks back → not interested cheaply
  } else if (contention === "rebuild") {
    T = 1.02;
    if (getsPicksProspects || (inAge != null && inAge <= 24)) T = 0.94; // youth/picks in → welcome
    if (givesPicksProspects || (outAge != null && outAge <= 24)) T = Math.max(T, 1.18); // giving up futures → premium
  }
  // star protection: never move a star without a real overpay
  if (franchise) T *= 1.25;
  else if (star) T *= 1.12;
  // needs: incoming fills a hole → a touch more willing
  const fillsNeed = inP.some((p) => needs.has(grp(p.position)));
  if (fillsNeed) T -= 0.05;
  T = Math.max(0.9, T);

  if (ratio >= T) return { action: "accept", reason: `value ${aiGets} vs ${aiGives} (×${ratio.toFixed(2)} ≥ ${T.toFixed(2)})` };

  // Close but short → counter (ask them to add a pick), unless a star is involved and
  // the gap is large (then just decline — the AI holds firm on its core).
  const closeEnough = ratio >= T * 0.78;
  if (closeEnough && !(franchise && ratio < T * 0.9)) {
    const counter = await buildCounter(pkg, aiGives * T - aiGets);
    if (counter) return { action: "counter", reason: `short (×${ratio.toFixed(2)} < ${T.toFixed(2)}) — counter for more`, counter, counterNote: star ? `${clean(star.name)} is a core piece — the ask has to be higher.` : "Close, but the value needs to come up a touch." };
  }
  return { action: "decline", reason: `too light (×${ratio.toFixed(2)} < ${T.toFixed(2)})` };
}

/** Build a counter: keep the same swap, but ask the OTHER club to add one draft pick
 *  that best covers the value gap. Returns null if they have no spare pick. */
async function buildCounter(orig: TradePackage, gapValue: number): Promise<TradePackage | null> {
  const human = orig.fromTeamId; // the club that proposed (AI is orig.toTeamId)
  const humanTeam = await prisma.team.findUnique({ where: { id: human }, select: { affiliateTeams: { select: { id: true } } } });
  const orgIds = [human, ...(humanTeam?.affiliateTeams.map((a) => a.id) ?? [])];
  const owned = await prisma.draftPick.findMany({ where: { teamId: { in: orgIds }, id: { notIn: orig.fromPicks } }, select: { id: true, round: true } });
  if (!owned.length) return null;
  // rough value: earlier rounds worth more; pick the smallest pick that covers the gap,
  // else the most valuable available.
  const roughVal = (round: number) => Math.round(1000 * Math.exp(-((round - 1) * 32 + 16) / 42));
  const sorted = owned.map((p) => ({ id: p.id, v: roughVal(p.round) })).sort((a, b) => a.v - b.v);
  const pick = sorted.find((p) => p.v >= gapValue) ?? sorted[sorted.length - 1];
  // Counter = AI proposes: AI gives its original outgoing, asks for the human's original
  // outgoing PLUS the extra pick. Sides flip (AI becomes the "from" proposer).
  return {
    fromTeamId: orig.toTeamId, toTeamId: orig.fromTeamId,
    fromPlayers: orig.toPlayers, toPlayers: orig.fromPlayers,
    fromPicks: orig.toPicks, toPicks: [...orig.fromPicks, pick.id],
    fromProspects: orig.toProspects ?? [], toProspects: orig.fromProspects ?? [],
    fromCash: orig.toCash, toCash: orig.fromCash,
    condition: "",
  };
}

/** The daily Advanced-AI trade pass. For every advanced-AI club, work through the
 *  proposals humans sent it and accept / decline / counter. Returns a short log. */
export async function aiGmTradesDaily(): Promise<{ handled: number; details: string[] }> {
  const settings = await loadSettings();
  if (!settings.aiTradesEnabled) return { handled: 0, details: [] };

  const aiTeams = await prisma.team.findMany({
    where: { passwordHash: null, aiMode: "advanced", league: "NHL", isAffiliate: false },
    select: { id: true, name: true, code: true },
  });
  if (!aiTeams.length) return { handled: 0, details: [] };
  const aiById = new Map(aiTeams.map((t) => [t.id, t]));
  const contention = await teamContentionMap().catch(() => new Map<number, Contention>());
  const th = await computeThresholds();

  // AI GMs only deal with REAL (human) GMs — never with each other. Skip any
  // incoming proposal whose sender is itself an AI-run club (defensive).
  const aiAll = new Set((await prisma.team.findMany({ where: { passwordHash: null }, select: { id: true } })).map((t) => t.id));
  const pending = (await prisma.trade.findMany({
    where: { status: "PENDING", toTeamId: { in: aiTeams.map((t) => t.id) } },
    orderBy: { createdAt: "asc" },
    select: { id: true, fromTeamId: true, toTeamId: true },
  })).filter((t) => !aiAll.has(t.fromTeamId));

  const details: string[] = [];
  let handled = 0;
  for (const tr of pending) {
    const ai = aiById.get(tr.toTeamId)!;
    const aiName = ai.code ?? ai.name;
    try {
      const d = await decide(tr.id, tr.toTeamId, contention.get(tr.toTeamId) ?? "middle", th);
      const humanName = (await prisma.team.findUnique({ where: { id: tr.fromTeamId }, select: { name: true } }))?.name ?? "the other club";
      if (d.action === "accept") {
        const { fromTeam, toTeam, fromNames, toNames } = await executeAcceptedTrade(tr.id);
        await prisma.dmMessage.create({ data: { fromTeamId: tr.toTeamId, toTeamId: tr.fromTeamId, body: `✅ ${toTeam.name} accepted your trade (#${tr.id}) — ${fromTeam.name} gets ${toNames.join(", ") || "assets"}, you get ${fromNames.join(", ") || "assets"}. It's done.`, tradeUrl: `/trades/${tr.id}` } }).catch(() => {});
        details.push(`${aiName} ACCEPTED #${tr.id} (${d.reason})`);
      } else if (d.action === "counter" && d.counter) {
        await prisma.trade.update({ where: { id: tr.id }, data: { status: "DECLINED", respondedAt: new Date() } });
        const { tradeId } = await createTradeRecord(d.counter, { fromName: ai.name, toName: humanName, dmBody: `🔄 ${ai.name} countered your offer (was #${tr.id}). ${d.counterNote ?? ""} Open the new proposal to review.` });
        details.push(`${aiName} COUNTERED #${tr.id} → #${tradeId} (${d.reason})`);
      } else {
        await prisma.trade.update({ where: { id: tr.id }, data: { status: "DECLINED", respondedAt: new Date() } });
        await prisma.dmMessage.create({ data: { fromTeamId: tr.toTeamId, toTeamId: tr.fromTeamId, body: `❌ ${ai.name} declined your trade proposal (#${tr.id}) — the return didn't fit what they're looking for.`, tradeUrl: `/trades/${tr.id}` } }).catch(() => {});
        details.push(`${aiName} DECLINED #${tr.id} (${d.reason})`);
      }
      handled++;
    } catch (e) {
      // a hard violation (clause/ownership/stale asset) → decline cleanly so it doesn't loop
      await prisma.trade.update({ where: { id: tr.id }, data: { status: "DECLINED", respondedAt: new Date() } }).catch(() => {});
      details.push(`${aiName} could not process #${tr.id}: ${(e as Error).message}`);
    }
  }

  // Proactive offers (opt-in) — Advanced-AI clubs shop their needs to HUMAN clubs.
  if (settings.aiInitiateTrades) {
    try {
      const today = roundForDate(await getLeagueDate());
      const init = await aiGmInitiateTrades(aiTeams, contention, th, today);
      details.push(...init);
      handled += init.length;
    } catch { /* best-effort */ }
  }
  return { handled, details };
}

// ---- Stage 2: proactive AI-initiated offers to HUMAN clubs -------------------
const playerValue = (overall: number, age: number | null) => {
  let v = Math.pow(Math.max(1, overall - 35), 2);
  const a = age ?? 27;
  v *= a <= 23 ? 1.15 : a <= 28 ? 1.0 : a <= 32 ? 0.85 : 0.68;
  return Math.round(v);
};
const GOOD_OV = 55;
const NEED_THRESH: Record<string, number> = { C: 3, W: 6, D: 5, G: 2 };

type RosterP = { id: number; name: string; overall: number | null; age: number | null; position: string | null; injuryDaysLeft: number; tradeClause: string | null; rosterType: string | null };

/** For each advanced-AI club: find its biggest positional NEED, find a fair, clause-
 *  clean player on a HUMAN club that fills it, and offer surplus + a spare pick of
 *  matching value. One offer per club per run; skips clubs it's already courting. */
async function aiGmInitiateTrades(aiTeams: { id: number; name: string; code: string | null }[], contention: Map<number, Contention>, th: Thresholds, today: number): Promise<string[]> {
  const out: string[] = [];
  const humanTeams = await prisma.team.findMany({ where: { passwordHash: { not: null }, league: "NHL", isAffiliate: false }, select: { id: true, name: true } });
  if (!humanTeams.length) return out; // nobody to trade with

  const MIN_GAP = 7;     // never offer more than once a week per club…
  const NORMAL_GAP = 14; // …and only every 2 weeks unless the target is on the Trade Block
  const SUPPRESS = 30;   // don't re-offer the same player for 30 days (covers "declined → don't resend")

  for (const ai of aiTeams) {
    try {
      // outstanding cap: at most 1 open AI-initiated proposal, one courtship per human
      const mine = await prisma.trade.findMany({ where: { fromTeamId: ai.id }, select: { status: true, leagueDay: true, id: true } });
      const openPending = mine.filter((t) => t.status === "PENDING");
      if (openPending.length >= 1) continue; // one live offer at a time
      const courting = new Set<number>(); // (kept for the per-target guard below)

      // TIME THROTTLE — how long since this club last SENT an offer (league-days)
      const lastInit = Math.max(-999, ...mine.map((t) => t.leagueDay ?? -999));
      const sinceLast = today - lastInit;
      if (lastInit > -999 && sinceLast < MIN_GAP) continue; // sent one within the last week → hush

      // DECLINE / RECENT-OFFER SUPPRESSION — players this club offered on recently
      const recentIds = mine.filter((t) => (t.leagueDay ?? -999) > today - SUPPRESS).map((t) => t.id);
      const suppressed = new Set<number>();
      if (recentIds.length) {
        const past = await prisma.tradeAsset.findMany({ where: { tradeId: { in: recentIds }, side: "TO", assetType: "PLAYER" }, select: { playerId: true } });
        for (const a of past) if (a.playerId) suppressed.add(a.playerId);
      }
      const canOfferOutsideBlock = lastInit === -999 || sinceLast >= NORMAL_GAP; // else only Trade-Block targets

      const roster: RosterP[] = await prisma.player.findMany({ where: { teamId: ai.id, rosterType: "NHL" }, select: { id: true, name: true, overall: true, age: true, position: true, injuryDaysLeft: true, tradeClause: true, rosterType: true } });
      const good = (g: string) => roster.filter((p) => grp(p.position) === g && (p.overall ?? 0) >= GOOD_OV);
      // biggest need
      let needPos: string | null = null, worst = 0;
      for (const g of ["C", "W", "D", "G"]) { const def = NEED_THRESH[g] - good(g).length; if (def > worst) { worst = def; needPos = g; } }
      if (!needPos) continue; // roster is full at every position → no shopping

      // AI's tradeable surplus: extra bodies at DEEP positions (never a clause/star piece)
      const surplus = roster
        .filter((p) => p.injuryDaysLeft <= 0 && !p.tradeClause && !isStar(p.overall ?? 0, grp(p.position) === "G", th) && good(grp(p.position)).length > NEED_THRESH[grp(p.position)])
        .sort((a, b) => (a.overall ?? 0) - (b.overall ?? 0));
      if (!surplus.length) continue;
      const chip = surplus[surplus.length - 1]; // best surplus piece as the centrepiece
      const chipVal = playerValue(chip.overall ?? 45, chip.age);

      // a spare late pick to sweeten (least valuable owned pick)
      const picks = await prisma.draftPick.findMany({ where: { teamId: ai.id }, select: { id: true, round: true } });
      const roughPick = (round: number) => Math.round(1000 * Math.exp(-((round - 1) * 32 + 16) / 42));
      const sparePick = picks.map((p) => ({ id: p.id, v: roughPick(p.round) })).sort((a, b) => a.v - b.v)[0] ?? null;
      const capacity = chipVal + (sparePick?.v ?? 0);

      // find the best clause-clean target at the need position on a human club we can afford
      let best: { target: RosterP & { onBlock?: boolean }; humanId: number; humanName: string; val: number } | null = null;
      for (const h of humanTeams) {
        if (courting.has(h.id)) continue;
        const cand = await prisma.player.findMany({ where: { teamId: h.id, rosterType: "NHL", injuryDaysLeft: { lte: 0 }, tradeClause: null }, select: { id: true, name: true, overall: true, age: true, position: true, injuryDaysLeft: true, tradeClause: true, rosterType: true, onBlock: true } });
        for (const c of cand) {
          if (grp(c.position) !== needPos) continue;
          if (suppressed.has(c.id)) continue;                     // recently offered / declined → don't re-send
          if (!c.onBlock && !canOfferOutsideBlock) continue;      // outside the 2-week window only Trade-Block players
          const ov = c.overall ?? 0;
          if (ov < GOOD_OV || isFranchise(ov, needPos === "G", th)) continue; // real upgrade, not an untouchable
          if (ov <= (good(needPos)[0]?.overall ?? 0)) continue;   // must beat our best there
          const val = playerValue(ov, c.age);
          if (val > capacity * 1.15) continue;                    // can't afford a fair offer
          // prefer a Trade-Block target, then the best available
          if (!best || (c.onBlock && !best.target.onBlock) || ((c.onBlock === !!best.target.onBlock) && ov > (best.target.overall ?? 0))) best = { target: c, humanId: h.id, humanName: h.name, val };
        }
      }
      if (!best) continue;

      // assemble a fair package: chip, plus the spare pick if it meaningfully closes the gap
      const givePicks = sparePick && chipVal < best.val * 0.92 ? [sparePick.id] : [];
      const pkg: TradePackage = {
        fromTeamId: ai.id, toTeamId: best.humanId,
        fromPlayers: [{ playerId: chip.id, retentionPct: 0 }], toPlayers: [{ playerId: best.target.id, retentionPct: 0 }],
        fromPicks: givePicks, toPicks: [], fromProspects: [], toProspects: [], fromCash: 0, toCash: 0, condition: "",
      };
      // fairness gate: AI gives roughly target value (fair..slightly generous), never a big overpay
      const analysis = await analyzeTradeAction(pkg);
      if (!analysis.ok) continue;
      const aiGives = analysis.meGives, human = analysis.meGets; // AI is "from"
      if (aiGives < human * 0.95 || aiGives > human * 1.2) continue;

      const concept = contention.get(ai.id) ?? "middle";
      const note = concept === "contender" ? "We're pushing for a Cup run and need help down the middle/back." : concept === "rebuild" ? "We're building for the future and like your player's fit." : "We think this is a fair hockey trade for both clubs.";
      const { tradeId } = await createTradeRecord(pkg, { fromName: ai.name, toName: best.humanName, leagueDay: today, dmBody: `📨 ${ai.name} wants to make a deal — they're offering ${clean(chip.name)}${givePicks.length ? " + a pick" : ""} for ${clean(best.target.name)}. ${note} Open to review, then Accept / Decline / counter.` });
      out.push(`${ai.code ?? ai.name} OFFERED ${clean(chip.name)}→${best.humanName} for ${clean(best.target.name)} (#${tradeId})`);
    } catch { /* skip this club on any error */ }
  }
  return out;
}
