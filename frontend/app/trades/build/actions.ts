"use server";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getTeamSession, isAdmin } from "@/lib/auth";
import { loadSettings } from "@/lib/sim/settings";
import { CURRENT_SEASON_START } from "@/lib/finance";
import { revalidatePath } from "next/cache";

export type TradePlayer = { playerId: number; retentionPct: number };
export type TradePackage = {
  fromTeamId: number; toTeamId: number;
  fromPlayers: TradePlayer[]; toPlayers: TradePlayer[];
  fromPicks: number[]; toPicks: number[];
  fromProspects: number[]; toProspects: number[];
  fromCash: number; toCash: number;
  condition: string;
  waived?: number[]; // player ids whose NTC/NMC/M-NTC clause is waived for this deal
  clauseFees?: { playerId: number; feeAmount: number; payTeamId: number }[]; // agent waiver fees the giving team pays
};

// ---- AI GM Assistance: trade analysis -------------------------------------
const playerValue = (overall: number, age: number | null) => {
  let v = Math.pow(Math.max(1, overall - 35), 2);            // 40→25, 55→400, 70→1225, 85→2500
  const a = age ?? 27;
  v *= a <= 23 ? 1.15 : a <= 28 ? 1.0 : a <= 32 ? 0.85 : 0.68; // youth premium, veteran discount
  return Math.round(v);
};

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
  const pickValueBySlot = (slot: number) => Math.round(1000 * Math.exp(-slot / 42)); // #1≈976, #16≈684, R2≈316, R3≈147

  // --- prospects: value by CEILING (potential) when a scouting-board entry matches -
  const prById = new Map((await prisma.prospect.findMany({ where: { id: { in: [...pkg.fromProspects, ...pkg.toProspects] } }, select: { id: true, name: true, overallPick: true, draftYear: true, position: true } })).map((p) => [p.id, p]));
  const dpAll = await prisma.draftProspect.findMany({ where: { draftYear: { in: [...new Set([...prById.values()].map((p) => p.draftYear).filter((y): y is number => y != null))] } }, select: { name: true, ov: true, potential: true, draftYear: true } });
  const dpByKey = new Map(dpAll.map((d) => [`${d.draftYear}:${norm(d.name)}`, d]));
  const potOf = (p: { name: string; draftYear: number | null }) => (p.draftYear != null ? dpByKey.get(`${p.draftYear}:${norm(p.name)}`) ?? null : null);
  const prospectValueByPot = (pot: number) => Math.round(Math.pow(Math.max(1, pot - 35), 2) * 0.7); // ceiling, bust-discounted

  const yearDisc = (year: number) => Math.max(0.6, 1 - Math.max(0, year - CURRENT_SEASON_START) * 0.08);
  const kv = (id: number) => { const k = kById.get(id); return k ? Math.round(pickValueBySlot(slotOfPick(k)) * yearDisc(k.year)) : 0; };
  const kLabel = (id: number) => { const k = kById.get(id); if (!k) return `Pick #${id}`; const slot = slotOfPick(k); const proj = boards.get(k.year)?.[slot - 1]; return `Pick ${k.year} R${k.round} (odhad #${slot})${proj ? ` → ${clean(proj)}` : ""}`; };
  const prv = (id: number) => { const p = prById.get(id); if (!p) return 100; const dp = potOf(p); if (dp) return Math.max(60, prospectValueByPot(dp.potential)); return p.overallPick ? Math.max(50, pickValueBySlot(p.overallPick)) : 100; };
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

type ClausePlayer = { id: number; name: string; tradeClause: string | null; noTradeTeams: number[] };
/** A blocking reason if this player's clause forbids a move to `destTeamId`, else null. */
function clauseBlock(pl: ClausePlayer, destTeamId: number, waived: Set<number>, enabled: boolean): string | null {
  if (!enabled || !pl.tradeClause || waived.has(pl.id)) return null;
  if (pl.tradeClause === "M_NTC")
    return (pl.noTradeTeams ?? []).includes(destTeamId) ? `${pl.name} has a modified no-trade clause that blocks a deal to that team — he must waive it.` : null;
  return `${pl.name} has a ${pl.tradeClause === "NMC" ? "no-movement" : "no-trade"} clause — he must waive it to be dealt.`;
}

type OrgTeam = { id: number; name: string; bankAccount: number; affiliateTeams: { id: number }[] };

const orgIds = (t: OrgTeam) => [t.id, ...t.affiliateTeams.map((a) => a.id)];

/**
 * Build the prisma ops that actually execute a trade (move players/picks/
 * prospects, transfer cash, apply salary retention). Validates ownership and
 * retention rules — throws on any violation. Shared by accept-time execution.
 */
async function collectMoveOps(pkg: TradePackage) {
  const [fromTeam, toTeam, settings] = await Promise.all([
    prisma.team.findUnique({ where: { id: pkg.fromTeamId }, select: { id: true, name: true, bankAccount: true, affiliateTeams: { select: { id: true } } } }),
    prisma.team.findUnique({ where: { id: pkg.toTeamId }, select: { id: true, name: true, bankAccount: true, affiliateTeams: { select: { id: true } } } }),
    loadSettings(),
  ]);
  if (!fromTeam || !toTeam) throw new Error("Team not found");
  const fromAff = fromTeam.affiliateTeams[0]?.id ?? null;
  const toAff = toTeam.affiliateTeams[0]?.id ?? null;

  const allPlayerIds = [...pkg.fromPlayers, ...pkg.toPlayers].map((p) => p.playerId);
  const players = await prisma.player.findMany({
    where: { id: { in: allPlayerIds } },
    select: { id: true, name: true, teamId: true, rosterType: true, capHit: true, contractYears: true, tradeClause: true, noTradeTeams: true },
  });
  const pById = new Map(players.map((p) => [p.id, p]));
  const waived = new Set([...(pkg.waived ?? []), ...(pkg.clauseFees ?? []).map((f) => f.playerId)]);

  const maxPct = settings.retentionMaxPct;
  const retainedCount = [...pkg.fromPlayers, ...pkg.toPlayers].filter((p) => p.retentionPct > 0).length;
  if (retainedCount > settings.retentionMaxPlayers) throw new Error(`Max ${settings.retentionMaxPlayers} retained players per trade.`);

  const ops: Prisma.PrismaPromise<unknown>[] = [];
  const retentionRecords: Array<{ teamId: number; playerName: string; perYear: number; years: number }> = [];

  const movePlayers = (list: TradePlayer[], fromOrg: OrgTeam, toNhlId: number, toAffId: number | null) => {
    const fromOrgIds = orgIds(fromOrg);
    for (const tp of list) {
      const pl = pById.get(tp.playerId);
      if (!pl || !fromOrgIds.includes(pl.teamId ?? -1)) throw new Error("A player is no longer on the expected team.");
      const block = clauseBlock(pl, toNhlId, waived, settings.clausesEnabled);
      if (block) throw new Error(block);
      const toFarm = pl.rosterType === "AHL";
      const destId = toFarm ? (toAffId ?? toNhlId) : toNhlId;
      const destRoster = toFarm && toAffId ? "AHL" : "NHL";
      let capHit = pl.capHit ?? 0;
      if (tp.retentionPct > 0 && capHit) {
        const pct = Math.min(maxPct, tp.retentionPct);
        const retained = Math.round((capHit * pct / 100) / 50000) * 50000; // 50k granularity (½ of 8.1M = 4.05M)
        const newCap = capHit - retained;
        if (newCap < settings.retentionMinSalary) throw new Error(`Retention would drop ${pl.name} below the ${settings.retentionMinSalary.toLocaleString()} floor.`);
        capHit = newCap;
        retentionRecords.push({ teamId: fromOrg.id, playerName: `${pl.name} (retained)`, perYear: retained, years: Math.max(1, pl.contractYears ?? 1) });
      }
      ops.push(prisma.player.update({ where: { id: pl.id }, data: { teamId: destId, rosterType: destRoster, capHit, captaincy: null } }));
    }
  };
  movePlayers(pkg.fromPlayers, fromTeam, pkg.toTeamId, toAff);
  movePlayers(pkg.toPlayers, toTeam, pkg.fromTeamId, fromAff);

  // Ownership guard for picks & prospects — re-checked HERE at accept time so an asset
  // that changed hands since the proposal can't be yanked out of its current owner.
  // (Players are already guarded in movePlayers above.)
  const fromOrgIds = orgIds(fromTeam), toOrgIds = orgIds(toTeam);
  const allPickIds = [...pkg.fromPicks, ...pkg.toPicks];
  if (allPickIds.length) {
    const picks = await prisma.draftPick.findMany({ where: { id: { in: allPickIds } }, select: { id: true, teamId: true } });
    const pkById = new Map(picks.map((p) => [p.id, p]));
    for (const id of pkg.fromPicks) { const pk = pkById.get(id); if (!pk || !fromOrgIds.includes(pk.teamId)) throw new Error("A draft pick in this trade is no longer owned by the offering team."); }
    for (const id of pkg.toPicks) { const pk = pkById.get(id); if (!pk || !toOrgIds.includes(pk.teamId)) throw new Error("A requested draft pick is no longer owned by the other team."); }
  }
  const allProspectIds = [...(pkg.fromProspects ?? []), ...(pkg.toProspects ?? [])];
  if (allProspectIds.length) {
    const pros = await prisma.prospect.findMany({ where: { id: { in: allProspectIds } }, select: { id: true, teamId: true } });
    const prById = new Map(pros.map((p) => [p.id, p]));
    for (const id of pkg.fromProspects ?? []) { const pr = prById.get(id); if (!pr || !fromOrgIds.includes(pr.teamId)) throw new Error("A prospect in this trade is no longer owned by the offering team."); }
    for (const id of pkg.toProspects ?? []) { const pr = prById.get(id); if (!pr || !toOrgIds.includes(pr.teamId)) throw new Error("A requested prospect is no longer owned by the other team."); }
  }

  for (const id of pkg.fromPicks) ops.push(prisma.draftPick.update({ where: { id }, data: { teamId: pkg.toTeamId } }));
  for (const id of pkg.toPicks) ops.push(prisma.draftPick.update({ where: { id }, data: { teamId: pkg.fromTeamId } }));
  for (const id of pkg.fromProspects ?? []) ops.push(prisma.prospect.update({ where: { id }, data: { teamId: pkg.toTeamId } }));
  for (const id of pkg.toProspects ?? []) ops.push(prisma.prospect.update({ where: { id }, data: { teamId: pkg.fromTeamId } }));

  const net = (pkg.fromCash || 0) - (pkg.toCash || 0); // from pays net to `to`
  if (net !== 0) {
    // hit both bankAccount (live display) and ledgerAdj (survives processFinances recompute)
    ops.push(prisma.team.update({ where: { id: pkg.fromTeamId }, data: { bankAccount: { decrement: net }, ledgerAdj: { decrement: net } } }));
    ops.push(prisma.team.update({ where: { id: pkg.toTeamId }, data: { bankAccount: { increment: net }, ledgerAdj: { increment: net } } }));
  }

  for (const r of retentionRecords)
    ops.push(prisma.buyout.create({ data: { teamId: r.teamId, playerName: r.playerName, perYear: r.perYear, years: r.years, startYear: CURRENT_SEASON_START, totalCost: 0, inSeason: true } }));

  // clause waiver fees — the player's OLD team pays him to waive his NTC/NMC/M-NTC.
  // A bank/Finance hit only (NOT a cap hit); the new team still carries his full
  // cap + salary, so he's effectively paid twice this season.
  for (const f of pkg.clauseFees ?? []) {
    if (!f.feeAmount) continue;
    const pl = pById.get(f.playerId);
    ops.push(prisma.team.update({ where: { id: f.payTeamId }, data: { bankAccount: { decrement: f.feeAmount }, ledgerAdj: { decrement: f.feeAmount } } }));
    ops.push(prisma.transaction.create({ data: { type: "CLAUSE_WAIVER", message: `Paid ${pl?.name ?? "a player"} ${(f.feeAmount / 1_000_000).toFixed(2)}M to waive his no-trade clause.` } }));
  }

  const fromNames = pkg.fromPlayers.map((p) => pById.get(p.playerId)?.name).filter(Boolean);
  const toNames = pkg.toPlayers.map((p) => pById.get(p.playerId)?.name).filter(Boolean);
  return { ops, fromTeam, toTeam, fromNames, toNames };
}

/** Verify the session GM owns every asset on the `from` side they're offering. */
async function assertOwnership(pkg: TradePackage) {
  const [fromTeam, toTeam] = await Promise.all([
    prisma.team.findUnique({ where: { id: pkg.fromTeamId }, select: { id: true, name: true, bankAccount: true, affiliateTeams: { select: { id: true } } } }),
    prisma.team.findUnique({ where: { id: pkg.toTeamId }, select: { id: true, name: true, bankAccount: true, affiliateTeams: { select: { id: true } } } }),
  ]);
  if (!fromTeam || !toTeam) throw new Error("Team not found");
  const fromOrg = orgIds(fromTeam), toOrg = orgIds(toTeam);

  const players = await prisma.player.findMany({ where: { id: { in: [...pkg.fromPlayers, ...pkg.toPlayers].map((p) => p.playerId) } }, select: { id: true, teamId: true } });
  for (const p of pkg.fromPlayers) { const pl = players.find((x) => x.id === p.playerId); if (!pl || !fromOrg.includes(pl.teamId ?? -1)) throw new Error("A player you offered is not on your team."); }
  for (const p of pkg.toPlayers) { const pl = players.find((x) => x.id === p.playerId); if (!pl || !toOrg.includes(pl.teamId ?? -1)) throw new Error("A requested player is not on the other team."); }

  const pickIds = [...pkg.fromPicks, ...pkg.toPicks];
  if (pickIds.length) {
    const picks = await prisma.draftPick.findMany({ where: { id: { in: pickIds } }, select: { id: true, teamId: true } });
    for (const id of pkg.fromPicks) { const pk = picks.find((x) => x.id === id); if (!pk || !fromOrg.includes(pk.teamId)) throw new Error("A draft pick you offered is not owned by your team."); }
    for (const id of pkg.toPicks) { const pk = picks.find((x) => x.id === id); if (!pk || !toOrg.includes(pk.teamId)) throw new Error("A requested draft pick is not owned by the other team."); }
  }
  const prospectIds = [...(pkg.fromProspects ?? []), ...(pkg.toProspects ?? [])];
  if (prospectIds.length) {
    const pros = await prisma.prospect.findMany({ where: { id: { in: prospectIds } }, select: { id: true, teamId: true } });
    for (const id of pkg.fromProspects ?? []) { const pr = pros.find((x) => x.id === id); if (!pr || !fromOrg.includes(pr.teamId)) throw new Error("A prospect you offered is not owned by your team."); }
    for (const id of pkg.toProspects ?? []) { const pr = pros.find((x) => x.id === id); if (!pr || !toOrg.includes(pr.teamId)) throw new Error("A requested prospect is not owned by the other team."); }
  }
  return { fromTeam, toTeam };
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

  const trade = await prisma.trade.create({ data: { fromTeamId: pkg.fromTeamId, toTeamId: pkg.toTeamId, status: "PENDING", condition: pkg.condition || null, waivedClauses: [...(pkg.waived ?? []), ...(pkg.clauseFees ?? []).map((f) => f.playerId)], clauseFees: (pkg.clauseFees ?? []) as object } });
  const rows: Array<{ tradeId: number; assetType: string; side: string; playerId?: number; prospectId?: number; draftPickId?: number; cashAmount?: number; retentionPct?: number }> = [];
  for (const p of pkg.fromPlayers) rows.push({ tradeId: trade.id, assetType: "PLAYER", side: "FROM", playerId: p.playerId, retentionPct: p.retentionPct || undefined });
  for (const p of pkg.toPlayers) rows.push({ tradeId: trade.id, assetType: "PLAYER", side: "TO", playerId: p.playerId, retentionPct: p.retentionPct || undefined });
  for (const id of pkg.fromProspects ?? []) rows.push({ tradeId: trade.id, assetType: "PROSPECT", side: "FROM", prospectId: id });
  for (const id of pkg.toProspects ?? []) rows.push({ tradeId: trade.id, assetType: "PROSPECT", side: "TO", prospectId: id });
  for (const id of pkg.fromPicks) rows.push({ tradeId: trade.id, assetType: "PICK", side: "FROM", draftPickId: id });
  for (const id of pkg.toPicks) rows.push({ tradeId: trade.id, assetType: "PICK", side: "TO", draftPickId: id });
  if (pkg.fromCash) rows.push({ tradeId: trade.id, assetType: "CASH", side: "FROM", cashAmount: pkg.fromCash });
  if (pkg.toCash) rows.push({ tradeId: trade.id, assetType: "CASH", side: "TO", cashAmount: pkg.toCash });

  await prisma.tradeAsset.createMany({ data: rows });
  if (pkg.condition?.trim())
    await prisma.tradeCondition.create({ data: { tradeId: trade.id, fromTeamId: pkg.fromTeamId, toTeamId: pkg.toTeamId, description: pkg.condition.trim(), status: "PENDING" } });
  await prisma.transaction.create({ data: { type: "TRADE", message: `${fromTeam.name} proposed a trade to ${toTeam.name}. Awaiting response.` } });
  revalidatePath("/trades");
  return { tradeId: trade.id };
}

/** Rebuild the TradePackage from stored TradeAssets. */
async function packageFromTrade(tradeId: number): Promise<TradePackage> {
  const trade = await prisma.trade.findUnique({ where: { id: tradeId } });
  if (!trade) throw new Error("Trade not found");
  const assets = await prisma.tradeAsset.findMany({ where: { tradeId } });
  const pkg: TradePackage = {
    fromTeamId: trade.fromTeamId, toTeamId: trade.toTeamId,
    fromPlayers: [], toPlayers: [], fromPicks: [], toPicks: [], fromProspects: [], toProspects: [],
    fromCash: 0, toCash: 0, condition: trade.condition ?? "",
  };
  for (const a of assets) {
    const from = a.side === "FROM";
    if (a.assetType === "PLAYER" && a.playerId) (from ? pkg.fromPlayers : pkg.toPlayers).push({ playerId: a.playerId, retentionPct: a.retentionPct ?? 0 });
    else if (a.assetType === "PROSPECT" && a.prospectId) (from ? pkg.fromProspects : pkg.toProspects).push(a.prospectId);
    else if (a.assetType === "PICK" && a.draftPickId) (from ? pkg.fromPicks : pkg.toPicks).push(a.draftPickId);
    else if (a.assetType === "CASH" && a.cashAmount) { if (from) pkg.fromCash = a.cashAmount; else pkg.toCash = a.cashAmount; }
  }
  return pkg;
}

/** GM B accepts or declines a pending trade. Accepting executes the moves. */
export async function respondToTrade(tradeId: number, accept: boolean) {
  const session = await getTeamSession();
  const trade = await prisma.trade.findUnique({ where: { id: tradeId } });
  if (!trade) throw new Error("Trade not found");
  if (trade.status !== "PENDING") throw new Error("This trade is no longer pending.");
  if (session !== trade.toTeamId) throw new Error("Only the receiving GM can respond to this trade.");

  if (!accept) {
    await prisma.trade.update({ where: { id: tradeId }, data: { status: "DECLINED", respondedAt: new Date() } });
    await prisma.transaction.create({ data: { type: "TRADE", message: `Trade #${tradeId} was declined.` } });
    revalidatePath("/trades");
    return { status: "DECLINED" as const };
  }

  const pkg = await packageFromTrade(tradeId);
  pkg.waived = trade.waivedClauses ?? []; // carry the waivers agreed at proposal time
  pkg.clauseFees = (trade.clauseFees as TradePackage["clauseFees"]) ?? [];
  const { ops, fromTeam, toTeam, fromNames, toNames } = await collectMoveOps(pkg);
  ops.push(prisma.trade.update({ where: { id: tradeId }, data: { status: "ACCEPTED", respondedAt: new Date() } }));
  ops.push(prisma.transaction.create({
    data: { type: "TRADE", message: `${fromTeam.name} traded ${fromNames.join(", ") || "assets"} to ${toTeam.name} for ${toNames.join(", ") || "assets"}.` },
  }));
  await prisma.$transaction(ops);
  revalidatePath("/trades"); revalidatePath("/salary-cap"); revalidatePath("/finance");
  return { status: "ACCEPTED" as const };
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
