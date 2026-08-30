"use server";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getTeamSession, isAdmin, isCommission } from "@/lib/auth";
import { loadSettings } from "@/lib/sim/settings";
import { CURRENT_SEASON_START } from "@/lib/finance";
import { revalidatePath } from "next/cache";
import { clauseBlock, assertOwnership, packageFromTrade, executeAcceptedTrade, createTradeRecord, type TradePlayer, type TradePackage } from "@/lib/trade-exec";
import { playerValue } from "@/lib/trade-value";

export type { TradePlayer, TradePackage } from "@/lib/trade-exec";

// ---- AI GM Assistance: trade analysis -------------------------------------
// player trade-value heuristic (shared with the AI GM) — see lib/trade-value.ts

/** Analyse a proposed trade — value per side, whether it's balanced, and the fit
 *  for each club (cap, age). Pure heuristic (no external AI). Symmetric, so both
 *  the proposing and the reviewing GM see the same read. */
export async function analyzeTradeAction(pkg: TradePackage): Promise<
  { ok: false; error: string } | { ok: true; fromName: string; toName: string; meGives: number; meGets: number; verdict: string; tilt: "even" | "from" | "to"; reasoning: string[]; fromItems: { label: string; value: number }[]; toItems: { label: string; value: number }[]; fit: string[] }
> {
  const [fromTeam, toTeam] = await Promise.all([
    prisma.team.findUnique({ where: { id: pkg.fromTeamId }, select: { name: true } }),
    prisma.team.findUnique({ where: { id: pkg.toTeamId }, select: { name: true } }),
  ]);
  if (!fromTeam || !toTeam) return { ok: false, error: "Team not found." };

  const clean = (s: string) => s.replace(/''[A-Za-z]''|\s*\([^)]*\)/g, "").trim();
  const norm = (s: string) => clean(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

  const pidAll = [...pkg.fromPlayers, ...pkg.toPlayers].map((p) => p.playerId);
  const players = await prisma.player.findMany({ where: { id: { in: pidAll } }, select: { id: true, name: true, overall: true, age: true, capHit: true, position: true } });
  const pById = new Map(players.map((p) => [p.id, p]));

  // --- draft-order-aware picks: value follows the estimated slot the pick lands at,
  //     and (if we have a board for that year) the name likely picked there. ------
  const { reverseStandingsOrder } = await import("@/lib/draft-order");
  const order = await reverseStandingsOrder().catch(() => [] as number[]);
  const N = order.length || 32;
  const slotOfTeam = new Map<number, number>();           // teamId -> slot in a round (worst = 1)
  order.forEach((tid, i) => slotOfTeam.set(tid, i + 1));
  const kById = new Map((await prisma.draftPick.findMany({ where: { id: { in: [...pkg.fromPicks, ...pkg.toPicks] } }, select: { id: true, year: true, round: true, ownerLogoId: true } })).map((k) => [k.id, k]));
  const teamByLogo = new Map((await prisma.team.findMany({ where: { profinhlLogoId: { in: [...kById.values()].map((k) => k.ownerLogoId).filter(Boolean) } }, select: { id: true, profinhlLogoId: true } })).map((t) => [t.profinhlLogoId!, t.id]));
  const boards = new Map<number, string[]>();             // draftYear -> names by projected overall slot
  for (const y of [...new Set([...kById.values()].map((k) => k.year))]) {
    const b = await prisma.draftProspect.findMany({ where: { draftYear: y }, orderBy: [{ ov: "desc" }, { potential: "desc" }], select: { name: true } });
    if (b.length) boards.set(y, b.map((x) => x.name));
  }
  const slotOfPick = (k: { round: number; ownerLogoId: number }) => {
    const inRound = (teamByLogo.get(k.ownerLogoId) && slotOfTeam.get(teamByLogo.get(k.ownerLogoId)!)) || Math.ceil(N / 2);
    return (k.round - 1) * N + inRound;
  };
  // Decay of 60 (not 42) so the first 3 rounds hold real trade value — user feedback:
  // GM Assist was undervaluing rounds 2-3 (a 2nd-rounder showed ~similar to a mid-3rd).
  const pickValueBySlot = (slot: number) => Math.round(1000 * Math.exp(-slot / 60)); // #1≈983, #16≈766, R1end≈587, R2≈344-577, R3≈202-338

  // --- prospects: value by CEILING (potential) when a scouting-board entry matches -
  const prById = new Map((await prisma.prospect.findMany({ where: { id: { in: [...pkg.fromProspects, ...pkg.toProspects] } }, select: { id: true, name: true, overallPick: true, draftYear: true, position: true } })).map((p) => [p.id, p]));
  const dpAll = await prisma.draftProspect.findMany({ where: { draftYear: { in: [...new Set([...prById.values()].map((p) => p.draftYear).filter((y): y is number => y != null))] } }, select: { name: true, ov: true, potential: true, draftYear: true } });
  const dpByKey = new Map(dpAll.map((d) => [`${d.draftYear}:${norm(d.name)}`, d]));
  const potOf = (p: { name: string; draftYear: number | null }) => (p.draftYear != null ? dpByKey.get(`${p.draftYear}:${norm(p.name)}`) ?? null : null);
  const prospectValueByPot = (pot: number) => Math.round(Math.pow(Math.max(1, pot - 35), 2) * 0.7); // ceiling, bust-discounted

  const yearDisc = (year: number) => Math.max(0.6, 1 - Math.max(0, year - CURRENT_SEASON_START) * 0.08);
  const kv = (id: number) => { const k = kById.get(id); return k ? Math.round(pickValueBySlot(slotOfPick(k)) * yearDisc(k.year)) : 0; };
  const kLabel = (id: number) => { const k = kById.get(id); if (!k) return `Pick #${id}`; const slot = slotOfPick(k); const proj = boards.get(k.year)?.[slot - 1]; return `Pick ${k.year} R${k.round} (odhad #${slot})${proj ? ` → ${clean(proj)}` : ""}`; };
  // 250 (not 100) for a prospect with no scouting-board match AND no known draft
  // slot — a rare gap-data case, but 100 undersold even an unranked/undrafted
  // prospect against picks/players that never fall that low elsewhere.
  const prv = (id: number) => { const p = prById.get(id); if (!p) return 250; const dp = potOf(p); if (dp) return Math.max(60, prospectValueByPot(dp.potential)); return p.overallPick ? Math.max(50, pickValueBySlot(p.overallPick)) : 250; };
  const prLabel = (id: number) => { const p = prById.get(id); if (!p) return `Prospekt #${id}`; const dp = potOf(p); const tail = dp ? ` · potenciál ${dp.potential}${dp.ov ? `/${dp.ov} OV` : ""}` : p.overallPick ? ` · draft #${p.overallPick}` : ""; return `Prospekt: ${clean(p.name)}${p.position ? ` (${p.position})` : ""}${tail}`; };
  const cashV = (c: number) => Math.round((c / 1_000_000) * 30);

  const sideValue = (pls: TradePlayer[], pk: number[], pr: number[], cash: number) =>
    pls.reduce((s, x) => s + playerValue(pById.get(x.playerId)?.overall ?? 45, pById.get(x.playerId)?.age ?? null), 0)
    + pk.reduce((s, id) => s + kv(id), 0) + pr.reduce((s, id) => s + prv(id), 0) + cashV(cash);

  const meGives = sideValue(pkg.fromPlayers, pkg.fromPicks, pkg.fromProspects, pkg.fromCash);
  const meGets = sideValue(pkg.toPlayers, pkg.toPicks, pkg.toProspects, pkg.toCash);

  // itemised breakdown of every selected asset per side
  const sideItems = (pls: TradePlayer[], pk: number[], pr: number[], cash: number): { label: string; value: number }[] => {
    const out: { label: string; value: number }[] = [];
    for (const x of pls) { const p = pById.get(x.playerId); out.push({ label: `${p ? clean(p.name) : `#${x.playerId}`}${p?.overall ? ` (${p.overall} OV${p.position ? `, ${p.position}` : ""})` : ""}${x.retentionPct ? ` · ${x.retentionPct}% ret.` : ""}`, value: playerValue(p?.overall ?? 45, p?.age ?? null) }); }
    for (const id of pk) out.push({ label: kLabel(id), value: kv(id) });
    for (const id of pr) out.push({ label: prLabel(id), value: prv(id) });
    if (cash > 0) out.push({ label: `Cash $${cash.toLocaleString("en-US")}`, value: cashV(cash) });
    return out;
  };
  const fromItems = sideItems(pkg.fromPlayers, pkg.fromPicks, pkg.fromProspects, pkg.fromCash);
  const toItems = sideItems(pkg.toPlayers, pkg.toPicks, pkg.toProspects, pkg.toCash);
  const bal = meGets - meGives;
  const pct = bal / Math.max(1, (meGives + meGets) / 2);
  const tilt: "even" | "from" | "to" = Math.abs(pct) < 0.12 ? "even" : bal > 0 ? "from" : "to";
  const winner = tilt === "from" ? fromTeam.name : toTeam.name;
  const verdict = tilt === "even" ? "Vyrovnaná výmena — hodnotovo férová pre oba tímy."
    : `${Math.abs(pct) > 0.30 ? "Výrazne" : "Mierne"} v prospech ${winner}.`;

  // fit reasoning
  const reasoning: string[] = [];
  const capOf = (pls: TradePlayer[]) => pls.reduce((s, x) => s + (pById.get(x.playerId)?.capHit ?? 0), 0);
  const capIn = capOf(pkg.toPlayers), capOut = capOf(pkg.fromPlayers);
  const capDelta = capIn - capOut;
  const fmt = (n: number) => `$${Math.abs(Math.round(n)).toLocaleString("en-US")}`;
  reasoning.push(`Hodnota: <b>${fromTeam.name}</b> dáva ${meGives}, dostáva ${meGets} bodov hodnoty.`);
  if (capDelta > 0) reasoning.push(`Cap: <b>${fromTeam.name}</b> si pridá ${fmt(capDelta)} na plate (${toTeam.name} uvoľní).`);
  else if (capDelta < 0) reasoning.push(`Cap: <b>${fromTeam.name}</b> uvoľní ${fmt(capDelta)} platu.`);
  const ages = (pls: TradePlayer[]) => { const a = pls.map((x) => pById.get(x.playerId)?.age).filter((x): x is number => x != null); return a.length ? a.reduce((s, x) => s + x, 0) / a.length : null; };
  const ageIn = ages(pkg.toPlayers), ageOut = ages(pkg.fromPlayers);
  if (ageIn != null && ageOut != null) {
    const d = ageIn - ageOut;
    if (Math.abs(d) >= 1.5) reasoning.push(`Vek: <b>${fromTeam.name}</b> ${d < 0 ? "omladzuje" : "starne"} (priemer prichádzajúcich ${ageIn.toFixed(1)} vs odchádzajúcich ${ageOut.toFixed(1)}).`);
  }
  const retained = [...pkg.fromPlayers, ...pkg.toPlayers].filter((p) => p.retentionPct > 0);
  if (retained.length) reasoning.push(`Retencia: ${retained.length} hráč(ov) so zadržaným platom — mení reálny cap náklad.`);
  reasoning.push(tilt === "even" ? "Doporučenie: férová výmena, dá sa akceptovať." : `Doporučenie: ${winner} z nej ťaží — druhá strana by mala pridať hodnotu alebo zvážiť odmietnutie.`);

  // roster-fit: where would each incoming player slot on his NEW club, and does he
  // fill a need there? (fromPlayers go TO toTeam; toPlayers go TO fromTeam)
  const grp = (pos: string | null) => { const P = (pos ?? "").toUpperCase(); if (/G/.test(P)) return "G"; if (/(^|\/)D(\/|$)|^D$/.test(P)) return "D"; if (/C/.test(P)) return "C"; return "W"; };
  const [fromRoster, toRoster] = await Promise.all([
    prisma.player.findMany({ where: { teamId: pkg.fromTeamId, rosterType: "NHL" }, select: { overall: true, position: true, isGoalie: true } }),
    prisma.player.findMany({ where: { teamId: pkg.toTeamId, rosterType: "NHL" }, select: { overall: true, position: true, isGoalie: true } }),
  ]);
  const grpLabel: Record<string, string> = { C: "centra", W: "krídla", D: "obrancu", G: "brankára" };
  const slotFor = (g: string, slot: number) => {
    if (g === "G") return slot === 1 ? "brankársku jednotku" : "brankársku dvojku";
    if (g === "D") return slot <= 2 ? "1. obranný pár" : slot <= 4 ? "top-4 obranu" : slot <= 6 ? "3. obranný pár" : "7. obrancu / farmu";
    return slot <= 3 ? "elitnú lajnu" : slot <= 6 ? "top-6 útok" : slot <= 9 ? "3. lajnu" : slot <= 12 ? "4. lajnu" : "13. útočníka / farmu";
  };
  const fit: string[] = [];
  const analyzeFit = (movers: TradePlayer[], destRoster: { overall: number | null; position: string | null; isGoalie: boolean }[], destName: string) => {
    for (const x of movers) {
      const p = pById.get(x.playerId); if (!p) continue;
      const g = grp(p.position); const ov = p.overall ?? 45;
      const same = destRoster.filter((r) => grp(r.position) === g);
      const better = same.filter((r) => (r.overall ?? 0) > ov).length;
      const goodAt = same.filter((r) => (r.overall ?? 0) >= 55).length;
      const need = (g === "C" && goodAt < 3) || (g === "W" && goodAt < 6) || (g === "D" && goodAt < 5) || (g === "G" && goodAt < 2);
      fit.push(`→ <b>${destName}</b>: ${clean(p.name)} (${ov} OV) by obsadil <b>${slotFor(g, better + 1)}</b>${need ? ` — <b>kryje slabšie miesto na poste ${grpLabel[g]}</b>` : ""}.`);
    }
  };
  // outgoing impact: what does a club LOSE by dealing this player away? (his roster
  // still includes him, so his slot there tells us if he was a key piece or depth.)
  const analyzeOut = (movers: TradePlayer[], ownRoster: { overall: number | null; position: string | null; isGoalie: boolean }[], teamName: string) => {
    for (const x of movers) {
      const p = pById.get(x.playerId); if (!p) continue;
      const g = grp(p.position); const ov = p.overall ?? 45;
      const same = ownRoster.filter((r) => grp(r.position) === g);
      const better = same.filter((r) => (r.overall ?? 0) > ov).length;
      const goodLeft = same.filter((r) => (r.overall ?? 0) >= 55).length - (ov >= 55 ? 1 : 0);
      const key = (g === "G" && better === 0) || (g === "D" && better < 4) || ((g === "C" || g === "W") && better < 6);
      const thin = (g === "C" && goodLeft < 2) || (g === "W" && goodLeft < 5) || (g === "D" && goodLeft < 4) || (g === "G" && goodLeft < 1);
      fit.push(`← <b>${teamName}</b> stráca ${clean(p.name)} (${ov} OV, ${slotFor(g, better + 1)})${key ? ` — <b>kľúčový hráč, oslabí ${grpLabel[g]}</b>${thin ? " (vznikne diera)" : ""}` : " — hĺbka, odchod výrazne nebolí"}.`);
    }
  };
  analyzeFit(pkg.fromPlayers, toRoster, toTeam.name);
  analyzeOut(pkg.fromPlayers, fromRoster, fromTeam.name);
  analyzeFit(pkg.toPlayers, fromRoster, fromTeam.name);
  analyzeOut(pkg.toPlayers, toRoster, toTeam.name);

  return { ok: true, fromName: fromTeam.name, toName: toTeam.name, meGives, meGets, verdict, tilt, reasoning, fromItems, toItems, fit };
}

/** Analyse an already-proposed trade by id — so the reviewing GM can verify it
 *  before accepting. Reconstructs the package from the stored assets. */
export async function analyzeTradeByIdAction(tradeId: number) {
  const trade = await prisma.trade.findUnique({ where: { id: tradeId }, select: { fromTeamId: true, toTeamId: true, condition: true } });
  if (!trade) return { ok: false as const, error: "Trade not found." };
  const assets = await prisma.tradeAsset.findMany({ where: { tradeId } });
  const F = (s: string) => assets.filter((a) => a.side === s);
  const pkg: TradePackage = {
    fromTeamId: trade.fromTeamId, toTeamId: trade.toTeamId,
    fromPlayers: F("FROM").filter((a) => a.playerId).map((a) => ({ playerId: a.playerId!, retentionPct: a.retentionPct ?? 0 })),
    toPlayers: F("TO").filter((a) => a.playerId).map((a) => ({ playerId: a.playerId!, retentionPct: a.retentionPct ?? 0 })),
    fromPicks: F("FROM").filter((a) => a.draftPickId).map((a) => a.draftPickId!),
    toPicks: F("TO").filter((a) => a.draftPickId).map((a) => a.draftPickId!),
    fromProspects: F("FROM").filter((a) => a.prospectId).map((a) => a.prospectId!),
    toProspects: F("TO").filter((a) => a.prospectId).map((a) => a.prospectId!),
    fromCash: F("FROM").reduce((s, a) => s + (a.cashAmount ?? 0), 0),
    toCash: F("TO").reduce((s, a) => s + (a.cashAmount ?? 0), 0),
    condition: trade.condition ?? "",
  };
  return analyzeTradeAction(pkg);
}

/**
 * GM A proposes a trade. Nothing moves yet — a PENDING Trade + its TradeAssets
 * are stored, and GM B must accept before it executes.
 */
export async function proposeTrade(pkg: TradePackage) {
  const session = await getTeamSession();
  if (session !== pkg.fromTeamId) throw new Error("You can only propose trades as your own team.");
  if (pkg.fromTeamId === pkg.toTeamId) throw new Error("Pick a different team.");
  const hasAssets = pkg.fromPlayers.length || pkg.toPlayers.length || pkg.fromPicks.length || pkg.toPicks.length || (pkg.fromProspects?.length ?? 0) || (pkg.toProspects?.length ?? 0) || pkg.fromCash || pkg.toCash;
  if (!hasAssets) throw new Error("Add at least one asset.");

  const { fromTeam, toTeam } = await assertOwnership(pkg);

  // NTC / NMC / M-NTC: a protected player can't be moved unless his clause is waived.
  const settings = await loadSettings();
  if (settings.clausesEnabled) {
    const cp = await prisma.player.findMany({ where: { id: { in: [...pkg.fromPlayers, ...pkg.toPlayers].map((p) => p.playerId) } }, select: { id: true, name: true, tradeClause: true, noTradeTeams: true } });
    const byId = new Map(cp.map((p) => [p.id, p]));
    const waived = new Set([...(pkg.waived ?? []), ...(pkg.clauseFees ?? []).map((f) => f.playerId)]);
    for (const p of pkg.fromPlayers) { const pl = byId.get(p.playerId); const b = pl && clauseBlock(pl, pkg.toTeamId, waived, true); if (b) throw new Error(b); }
    for (const p of pkg.toPlayers) { const pl = byId.get(p.playerId); const b = pl && clauseBlock(pl, pkg.fromTeamId, waived, true); if (b) throw new Error(b); }

    // A waived clause must actually be CONSENTED/PAID for — the server recomputes the
    // agent fee so a crafted payload can't waive a clause for free. Only blocking
    // destinations need consent; a fee of 0 (a clear step up) waives for nothing.
    const { clauseTerms } = await import("@/lib/clause-agent-server");
    const feeBy = new Map((pkg.clauseFees ?? []).map((f) => [f.playerId, f]));
    const requireConsent = async (playerId: number, destTeamId: number, giverTeamId: number) => {
      const pl = byId.get(playerId);
      if (!pl?.tradeClause) return;
      const blocks = pl.tradeClause === "M_NTC" ? (pl.noTradeTeams ?? []).includes(destTeamId) : true;
      if (!blocks) return; // clause doesn't touch this destination → no waiver needed
      const terms = await clauseTerms(playerId, destTeamId);
      const required = terms?.feeAmount ?? 0;
      if (required <= 0) return; // he waives for free
      const paid = feeBy.get(playerId);
      if (!paid || paid.feeAmount < required || paid.payTeamId !== giverTeamId)
        throw new Error(`${pl.name} won't waive his clause for free — the agent fee is $${(required / 1e6).toFixed(2)}M, paid by the club dealing him.`);
    };
    for (const p of pkg.fromPlayers) await requireConsent(p.playerId, pkg.toTeamId, pkg.fromTeamId);
    for (const p of pkg.toPlayers) await requireConsent(p.playerId, pkg.fromTeamId, pkg.toTeamId);
  }

  const { tradeId } = await createTradeRecord(pkg, { fromName: fromTeam.name, toName: toTeam.name });
  // Rookie-GM oversight: let the commission know a rookie-involving trade exists the
  // moment it's proposed, not just once it's accepted — early visibility, nothing to
  // act on yet (the other GM still has to respond first).
  const rookieClubs = await prisma.team.findMany({ where: { id: { in: [pkg.fromTeamId, pkg.toTeamId] }, rookieGm: true }, select: { id: true } });
  if (rookieClubs.length) {
    await notifyCommission(`👀 Trade #${tradeId} (${fromTeam.name} ↔ ${toTeam.name}) was just proposed — a rookie GM is involved. No action yet, just visible on Trade Commission.`, tradeId);
  }
  revalidatePath("/trades"); revalidatePath("/trades/commish"); revalidatePath("/messages");
  return { tradeId };
}

/** GM B accepts or declines a pending trade. Accepting executes the moves. */
export async function respondToTrade(tradeId: number, accept: boolean) {
  const session = await getTeamSession();
  const trade = await prisma.trade.findUnique({ where: { id: tradeId } });
  if (!trade) throw new Error("Trade not found");
  if (trade.status !== "PENDING") throw new Error("This trade is no longer pending.");
  // the receiving GM responds; the commissioner may respond on his behalf (e.g. a GM
  // who couldn't confirm it himself).
  const admin = await isAdmin();
  if (session !== trade.toTeamId && !admin) throw new Error("Only the receiving GM (or the commissioner) can respond to this trade.");

  if (!accept) {
    await prisma.trade.update({ where: { id: tradeId }, data: { status: "DECLINED", respondedAt: new Date() } });
    // tell the proposer privately (a pending proposal is private → no public log)
    const decliner = (await prisma.team.findUnique({ where: { id: trade.toTeamId }, select: { name: true } }))?.name ?? "The other club";
    await prisma.dmMessage.create({ data: { fromTeamId: trade.toTeamId, toTeamId: trade.fromTeamId, body: `❌ ${decliner} declined your trade proposal (#${tradeId}).`, tradeUrl: `/trades/${tradeId}` } }).catch(() => {});
    revalidatePath("/trades"); revalidatePath("/messages");
    return { status: "DECLINED" as const };
  }

  // ROOKIE OVERSIGHT: if either club is a rookie GM, the accepted deal doesn't execute —
  // it goes to the commission for Accept / Decline / Modify.
  const clubs = await prisma.team.findMany({ where: { id: { in: [trade.fromTeamId, trade.toTeamId] } }, select: { id: true, name: true, rookieGm: true } });
  if (clubs.some((c) => c.rookieGm)) {
    await prisma.trade.update({ where: { id: tradeId }, data: { status: "AWAITING_COMMISH", respondedAt: new Date() } });
    await notifyCommission(`🕵️ Trade #${tradeId} (${clubs.map((c) => c.name).join(" ↔ ")}) — a rookie GM deal is awaiting commission review.`, tradeId);
    const fromName = clubs.find((c) => c.id === trade.fromTeamId)?.name ?? "?";
    for (const tid of [trade.fromTeamId, trade.toTeamId])
      await prisma.dmMessage.create({ data: { fromTeamId: trade.toTeamId, toTeamId: tid, body: `🕵️ Trade #${tradeId} was agreed and sent to the commission for approval (rookie-GM oversight).`, tradeUrl: `/trades/${tradeId}` } }).catch(() => {});
    void fromName;
    revalidatePath("/trades"); revalidatePath("/trades/commish"); revalidatePath("/messages");
    return { status: "AWAITING_COMMISH" as const };
  }

  const { fromTeam, toTeam } = await executeAcceptedTrade(tradeId);
  // let the proposer know their deal went through
  await prisma.dmMessage.create({ data: { fromTeamId: trade.toTeamId, toTeamId: trade.fromTeamId, body: `✅ ${toTeam.name} accepted your trade (#${tradeId}) — it's done.`, tradeUrl: `/trades/${tradeId}` } }).catch(() => {});
  revalidatePath("/trades"); revalidatePath("/salary-cap"); revalidatePath("/finance"); revalidatePath("/messages");
  return { status: "ACCEPTED" as const };
}

/** DM every commission member (comish/co-comish + admin GMs) about a rookie trade. */
async function notifyCommission(body: string, tradeId: number) {
  const comishTeams = await prisma.team.findMany({
    where: { OR: [{ isAdmin: true }, { gmRole: { in: ["comish", "co_comish", "trade_comish"] } }], passwordHash: { not: null } },
    select: { id: true },
  });
  for (const c of comishTeams)
    await prisma.dmMessage.create({ data: { fromTeamId: c.id, toTeamId: c.id, body, tradeUrl: `/trades/${tradeId}` } }).catch(() => {});
}

/** Commission reviews a rookie trade: accept (execute), decline (kill), or modify (send
 *  it back to the rookie to rebalance). Comish / co-comish / admin only. */
export async function commishRespondTrade(tradeId: number, action: "accept" | "decline" | "modify", note?: string) {
  if (!(await isCommission())) throw new Error("Only a commission member can review rookie trades.");
  const trade = await prisma.trade.findUnique({ where: { id: tradeId } });
  if (!trade) throw new Error("Trade not found.");
  if (!["AWAITING_COMMISH", "MODIFIED"].includes(trade.status)) throw new Error("This trade isn't awaiting commission review.");
  // Conflict of interest: a commission member on ONE SIDE of this trade can't be the
  // one who approves/declines/modifies it — needs a different commission member.
  const actingTeamId = await getTeamSession();
  if (actingTeamId != null && (actingTeamId === trade.fromTeamId || actingTeamId === trade.toTeamId)) {
    throw new Error("You're a club on this trade — a different Trade Comish member has to review it.");
  }
  const clubs = await prisma.team.findMany({ where: { id: { in: [trade.fromTeamId, trade.toTeamId] } }, select: { id: true, name: true, rookieGm: true } });
  const nameOf = (id: number) => clubs.find((c) => c.id === id)?.name ?? "?";

  if (action === "accept") {
    const { fromTeam, toTeam } = await executeAcceptedTrade(tradeId);
    for (const tid of [trade.fromTeamId, trade.toTeamId])
      await prisma.dmMessage.create({ data: { fromTeamId: tid, toTeamId: tid, body: `✅ Commission APPROVED trade #${tradeId} — ${fromTeam.name} ↔ ${toTeam.name} is done.`, tradeUrl: `/trades/${tradeId}` } }).catch(() => {});
    revalidatePath("/trades"); revalidatePath("/trades/commish"); revalidatePath("/salary-cap"); revalidatePath("/finance"); revalidatePath("/messages");
    return { status: "ACCEPTED" as const };
  }
  if (action === "decline") {
    await prisma.trade.update({ where: { id: tradeId }, data: { status: "DECLINED", respondedAt: new Date(), commishNote: note || null } });
    for (const tid of [trade.fromTeamId, trade.toTeamId])
      await prisma.dmMessage.create({ data: { fromTeamId: tid, toTeamId: tid, body: `❌ Commission DECLINED trade #${tradeId}.${note ? ` — ${note}` : ""}`, tradeUrl: `/trades/${tradeId}` } }).catch(() => {});
    revalidatePath("/trades"); revalidatePath("/trades/commish"); revalidatePath("/messages");
    return { status: "DECLINED" as const };
  }
  // modify → back to the rookie GM(s) to rebalance, with the commission's note
  await prisma.trade.update({ where: { id: tradeId }, data: { status: "MODIFY", commishNote: note || null } });
  const rookieClub = clubs.find((c) => c.rookieGm) ?? clubs.find((c) => c.id === trade.fromTeamId)!;
  await prisma.dmMessage.create({ data: { fromTeamId: rookieClub.id, toTeamId: rookieClub.id, body: `✏️ Commission asked to MODIFY trade #${tradeId} (${nameOf(trade.fromTeamId)} ↔ ${nameOf(trade.toTeamId)}).${note ? ` Note: ${note}` : ""} Open it and adjust the assets, then resubmit.`, tradeUrl: `/trades/build?edit=${tradeId}` } }).catch(() => {});
  revalidatePath("/trades"); revalidatePath("/trades/commish"); revalidatePath("/messages");
  return { status: "MODIFY" as const };
}

/** A rookie GM resubmits a trade the commission asked to modify — replaces the assets on
 *  the SAME trade record and marks it MODIFIED (back to the commission for Accept/Decline). */
export async function resubmitModifiedTrade(pkg: TradePackage, tradeId: number) {
  const session = await getTeamSession();
  const trade = await prisma.trade.findUnique({ where: { id: tradeId } });
  if (!trade) throw new Error("Trade not found.");
  if (trade.status !== "MODIFY") throw new Error("This trade isn't open for modification.");
  if (session !== trade.fromTeamId && session !== trade.toTeamId) throw new Error("Only a club on this trade can modify it.");
  if (pkg.fromTeamId !== trade.fromTeamId || pkg.toTeamId !== trade.toTeamId) throw new Error("Trade teams can't change.");
  const hasAssets = pkg.fromPlayers.length || pkg.toPlayers.length || pkg.fromPicks.length || pkg.toPicks.length || (pkg.fromProspects?.length ?? 0) || (pkg.toProspects?.length ?? 0) || pkg.fromCash || pkg.toCash;
  if (!hasAssets) throw new Error("Add at least one asset.");
  await assertOwnership(pkg);

  // clause consent (same as proposeTrade)
  const settings = await loadSettings();
  if (settings.clausesEnabled) {
    const cp = await prisma.player.findMany({ where: { id: { in: [...pkg.fromPlayers, ...pkg.toPlayers].map((p) => p.playerId) } }, select: { id: true, name: true, tradeClause: true, noTradeTeams: true } });
    const byId = new Map(cp.map((p) => [p.id, p]));
    const waived = new Set([...(pkg.waived ?? []), ...(pkg.clauseFees ?? []).map((f) => f.playerId)]);
    for (const p of pkg.fromPlayers) { const pl = byId.get(p.playerId); const b = pl && clauseBlock(pl, pkg.toTeamId, waived, true); if (b) throw new Error(b); }
    for (const p of pkg.toPlayers) { const pl = byId.get(p.playerId); const b = pl && clauseBlock(pl, pkg.fromTeamId, waived, true); if (b) throw new Error(b); }
  }

  // replace the stored assets on the same record
  const rows: Array<{ tradeId: number; assetType: string; side: string; playerId?: number; prospectId?: number; draftPickId?: number; cashAmount?: number; retentionPct?: number }> = [];
  for (const p of pkg.fromPlayers) rows.push({ tradeId, assetType: "PLAYER", side: "FROM", playerId: p.playerId, retentionPct: p.retentionPct || undefined });
  for (const p of pkg.toPlayers) rows.push({ tradeId, assetType: "PLAYER", side: "TO", playerId: p.playerId, retentionPct: p.retentionPct || undefined });
  for (const id of pkg.fromProspects ?? []) rows.push({ tradeId, assetType: "PROSPECT", side: "FROM", prospectId: id });
  for (const id of pkg.toProspects ?? []) rows.push({ tradeId, assetType: "PROSPECT", side: "TO", prospectId: id });
  for (const id of pkg.fromPicks) rows.push({ tradeId, assetType: "PICK", side: "FROM", draftPickId: id });
  for (const id of pkg.toPicks) rows.push({ tradeId, assetType: "PICK", side: "TO", draftPickId: id });
  if (pkg.fromCash) rows.push({ tradeId, assetType: "CASH", side: "FROM", cashAmount: pkg.fromCash });
  if (pkg.toCash) rows.push({ tradeId, assetType: "CASH", side: "TO", cashAmount: pkg.toCash });
  await prisma.$transaction([
    prisma.tradeAsset.deleteMany({ where: { tradeId } }),
    prisma.tradeAsset.createMany({ data: rows }),
    prisma.trade.update({ where: { id: tradeId }, data: {
      status: "MODIFIED", condition: pkg.condition || null,
      waivedClauses: [...(pkg.waived ?? []), ...(pkg.clauseFees ?? []).map((f) => f.playerId)],
      clauseFees: (pkg.clauseFees ?? []) as object,
    } }),
  ]);
  await notifyCommission(`✏️ Trade #${tradeId} was MODIFIED by the GM and is back for commission review.`, tradeId);
  revalidatePath("/trades"); revalidatePath("/trades/commish"); revalidatePath("/messages");
  return { tradeId, status: "MODIFIED" as const };
}

/** Commissioner REVOKES a completed (ACCEPTED) trade — reverses the asset moves:
 *  every player / pick / prospect goes back to its original club and the cash is
 *  returned, then the trade is marked REVERTED. Best-effort: salary retention created
 *  by the deal isn't unwound, and an asset already moved on since can't be pulled back
 *  (it's skipped). */
export async function revokeTradeAction(tradeId: number) {
  if (!(await isAdmin())) return { ok: false as const, error: "Only the commissioner can revoke trades." };
  const trade = await prisma.trade.findUnique({ where: { id: tradeId } });
  if (!trade) return { ok: false as const, error: "Trade not found." };
  if (trade.status !== "ACCEPTED") return { ok: false as const, error: "Only a completed (accepted) trade can be revoked." };

  const [fromTeam, toTeam] = await Promise.all([
    prisma.team.findUnique({ where: { id: trade.fromTeamId }, select: { id: true, name: true, affiliateTeams: { select: { id: true } } } }),
    prisma.team.findUnique({ where: { id: trade.toTeamId }, select: { id: true, name: true, affiliateTeams: { select: { id: true } } } }),
  ]);
  if (!fromTeam || !toTeam) return { ok: false as const, error: "Team not found." };
  const affOf = (t: typeof fromTeam) => t.affiliateTeams[0]?.id ?? t.id;
  const assets = await prisma.tradeAsset.findMany({ where: { tradeId } });
  const ops: Prisma.PrismaPromise<unknown>[] = [];
  let moved = 0;

  // FROM assets went to `to` — send them back to `from`; TO assets went to `from` — back to `to`.
  for (const a of assets) {
    const home = a.side === "FROM" ? fromTeam : toTeam;   // original owner
    if (a.assetType === "PLAYER" && a.playerId) {
      const pl = await prisma.player.findUnique({ where: { id: a.playerId }, select: { rosterType: true } });
      if (!pl) continue;
      const destId = pl.rosterType === "AHL" ? affOf(home) : home.id;
      ops.push(prisma.player.update({ where: { id: a.playerId }, data: { teamId: destId, captaincy: null } }));
      moved++;
    } else if (a.assetType === "PICK" && a.draftPickId) {
      ops.push(prisma.draftPick.update({ where: { id: a.draftPickId }, data: { teamId: home.id } })); moved++;
    } else if (a.assetType === "PROSPECT" && a.prospectId) {
      ops.push(prisma.prospect.update({ where: { id: a.prospectId }, data: { teamId: home.id } })); moved++;
    }
  }
  // reverse the cash (from paid net to `to`)
  const net = (assets.filter((a) => a.side === "FROM").reduce((s, a) => s + (a.cashAmount ?? 0), 0))
            - (assets.filter((a) => a.side === "TO").reduce((s, a) => s + (a.cashAmount ?? 0), 0));
  if (net !== 0) {
    ops.push(prisma.team.update({ where: { id: trade.fromTeamId }, data: { bankAccount: { increment: net }, ledgerAdj: { increment: net } } }));
    ops.push(prisma.team.update({ where: { id: trade.toTeamId }, data: { bankAccount: { decrement: net }, ledgerAdj: { decrement: net } } }));
  }
  ops.push(prisma.trade.update({ where: { id: tradeId }, data: { status: "REVERTED", respondedAt: new Date() } }));
  ops.push(prisma.transaction.create({ data: { type: "TRADE", message: `Commissioner revoked the ${fromTeam.name} ↔ ${toTeam.name} trade — assets returned.` } }));
  await prisma.$transaction(ops);
  for (const p of ["/trades", "/admin/trades", "/salary-cap", "/finance", "/teams"]) revalidatePath(p);
  return { ok: true as const, moved };
}

/** Commissioner deletes a trade entirely (and its assets/conditions). For clearing
 *  spam, duplicates, or a mistaken proposal. Does NOT reverse an already-applied
 *  ACCEPTED trade's roster moves — it only removes the record. */
export async function deleteTradeAction(tradeId: number) {
  if (!(await isAdmin())) throw new Error("Only the commissioner can delete trades.");
  const trade = await prisma.trade.findUnique({ where: { id: tradeId }, select: { id: true, status: true } });
  if (!trade) throw new Error("Trade not found.");
  await prisma.$transaction([
    prisma.tradeAsset.deleteMany({ where: { tradeId } }),
    prisma.tradeCondition.deleteMany({ where: { tradeId } }),
    prisma.trade.delete({ where: { id: tradeId } }),
  ]);
  revalidatePath("/trades");
  return { ok: true, wasStatus: trade.status };
}

/** The most recent completed (ACCEPTED) trade involving the logged-in club, within
 *  the last 2 days — powers the full-screen "trade complete" celebration. The client
 *  remembers which ids it has dismissed (localStorage), so this just reports the latest. */
export async function latestTradeCelebrationAction() {
  const session = await getTeamSession();
  if (session == null) return null;
  const since = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
  const trade = await prisma.trade.findFirst({
    where: { status: "ACCEPTED", respondedAt: { gte: since }, OR: [{ fromTeamId: session }, { toTeamId: session }] },
    orderBy: { respondedAt: "desc" },
    select: { id: true, fromTeamId: true, toTeamId: true },
  });
  if (!trade) return null;
  const iAmFrom = trade.fromTeamId === session;
  const otherId = iAmFrom ? trade.toTeamId : trade.fromTeamId;
  const [assets, other] = await Promise.all([
    prisma.tradeAsset.findMany({ where: { tradeId: trade.id } }),
    prisma.team.findUnique({ where: { id: otherId }, select: { name: true, logoUrl: true } }),
  ]);
  const pIds = assets.filter((a) => a.playerId).map((a) => a.playerId!);
  const players = await prisma.player.findMany({ where: { id: { in: pIds } }, select: { id: true, name: true } });
  const nameOf = new Map(players.map((p) => [p.id, p.name]));
  const clean = (s: string) => s.replace(/\s*\([^)]*\)/g, "").trim();
  // my side = FROM if I'm the proposer, else TO
  const mySide = iAmFrom ? "FROM" : "TO";
  const describe = (side: string) => {
    const rows = assets.filter((a) => a.side === side);
    const parts: string[] = [];
    for (const a of rows) {
      if (a.assetType === "PLAYER" && a.playerId) parts.push(clean(nameOf.get(a.playerId) ?? "a player"));
      else if (a.assetType === "PICK") parts.push("a draft pick");
      else if (a.assetType === "PROSPECT") parts.push("a prospect");
      else if (a.assetType === "CASH" && a.cashAmount) parts.push(`$${(a.cashAmount / 1e6).toFixed(1)}M`);
    }
    return parts;
  };
  const acquired = describe(iAmFrom ? "TO" : "FROM"); // what came to me
  const sent = describe(mySide);                       // what I gave up
  return { id: trade.id, otherTeam: other?.name ?? "another club", otherLogo: other?.logoUrl ?? null, acquired, sent };
}

/** The clause agent's terms for moving `playerId` to `toTeamId` (fee to waive). */
export async function clauseTermsAction(playerId: number, toTeamId: number) {
  const settings = await loadSettings();
  if (!settings.clausesEnabled) return null;
  const { clauseTerms } = await import("@/lib/clause-agent-server");
  return clauseTerms(playerId, toTeamId);
}

/** GM A cancels their own still-pending proposal. */
export async function cancelTrade(tradeId: number) {
  const session = await getTeamSession();
  const trade = await prisma.trade.findUnique({ where: { id: tradeId } });
  if (!trade) throw new Error("Trade not found");
  if (trade.status !== "PENDING") throw new Error("This trade is no longer pending.");
  if (session !== trade.fromTeamId) throw new Error("Only the proposing GM can cancel this trade.");
  await prisma.trade.update({ where: { id: tradeId }, data: { status: "CANCELLED", respondedAt: new Date() } });
  revalidatePath("/trades");
  return { status: "CANCELLED" as const };
}
