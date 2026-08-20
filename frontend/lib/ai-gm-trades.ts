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

const STAR_OV = 82;        // a clear top-line / top-pair player — protected
const FRANCHISE_OV = 88;   // a franchise cornerstone — heavily protected
const clean = (s: string) => s.replace(/\s*\([^)]*\)/g, "").trim();
const grp = (pos: string | null) => { const P = (pos ?? "").toUpperCase(); if (/G/.test(P)) return "G"; if (/(^|\/)D(\/|$)|^D$/.test(P)) return "D"; if (/C/.test(P)) return "C"; return "W"; };

type Decision = { action: "accept" | "decline" | "counter"; reason: string; counter?: TradePackage; counterNote?: string };

/** Decide how an advanced-AI receiving club responds to one pending proposal. */
async function decide(tradeId: number, aiTeamId: number, contention: Contention): Promise<Decision> {
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
    prisma.player.findMany({ where: { id: { in: outIds } }, select: { id: true, name: true, overall: true, age: true, position: true } }),
    prisma.player.findMany({ where: { id: { in: inIds } }, select: { id: true, overall: true, age: true, position: true } }),
    prisma.team.findUnique({ where: { id: aiTeamId }, select: { needs: true } }),
  ]);
  const needs = new Set((team?.needs ?? []).map((s) => s.toUpperCase()));
  const avg = (xs: (number | null | undefined)[]) => { const v = xs.filter((x): x is number => x != null); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; };
  const outOv = avg(outP.map((p) => p.overall)), inOv = avg(inP.map((p) => p.overall));
  const outAge = avg(outP.map((p) => p.age)), inAge = avg(inP.map((p) => p.age));
  const givesPicksProspects = pkg.toPicks.length + (pkg.toProspects?.length ?? 0) > 0;
  const getsPicksProspects = pkg.fromPicks.length + (pkg.fromProspects?.length ?? 0) > 0;
  const star = outP.find((p) => (p.overall ?? 0) >= STAR_OV);
  const franchise = outP.find((p) => (p.overall ?? 0) >= FRANCHISE_OV);

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
  const contention = await teamContentionMap().catch(() => new Map());

  const pending = await prisma.trade.findMany({
    where: { status: "PENDING", toTeamId: { in: aiTeams.map((t) => t.id) } },
    orderBy: { createdAt: "asc" },
    select: { id: true, fromTeamId: true, toTeamId: true },
  });

  const details: string[] = [];
  let handled = 0;
  for (const tr of pending) {
    const ai = aiById.get(tr.toTeamId)!;
    const aiName = ai.code ?? ai.name;
    try {
      const d = await decide(tr.id, tr.toTeamId, contention.get(tr.toTeamId) ?? "middle");
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
  return { handled, details };
}
