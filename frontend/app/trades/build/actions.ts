"use server";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getTeamSession, isAdmin, isCommission } from "@/lib/auth";
import { loadSettings } from "@/lib/sim/settings";
import { CURRENT_SEASON_START, money, liveCapHit } from "@/lib/finance";
import { revalidatePath } from "next/cache";
import { clauseBlock, assertOwnership, assertConditionSpec, packageFromTrade, executeAcceptedTrade, createTradeRecord, collectMoveOps, reverseTradeOps, type TradePlayer, type TradePackage } from "@/lib/trade-exec";
import { playerValue, pickValueBySlot, realFormFactor } from "@/lib/trade-value";
import { livePlayerOverall } from "@/lib/player-overall";
import { hasWorthyGoalie } from "@/lib/goalie-rule";
import { displayName } from "@/lib/playerName";
import { getLang } from "@/lib/lang-server";

export type { TradePlayer, TradePackage } from "@/lib/trade-exec";

export type GMAssistItem = {
  type: "PLAYER" | "PICK" | "PROSPECT" | "CASH";
  label: string;
  value: number;
  sub?: string;
  ov?: number;
  pos?: string;
  age?: number;
  retentionPct?: number;
  isGoalie?: boolean;
  year?: number;
  round?: number;
  slot?: number;
  projectedPlayer?: string;
  potential?: number;
  cashAmount?: number;
};

export type GMAssistResult = {
  ok: true;
  fromName: string;
  toName: string;
  fromTeam: { id: number; name: string; code: string | null; logoUrl: string | null };
  toTeam: { id: number; name: string; code: string | null; logoUrl: string | null };
  meGives: number;
  meGets: number;
  verdict: string;
  tilt: "even" | "from" | "to";
  archetype: {
    key: "WIN_NOW" | "REBUILD" | "CAP_RELIEF" | "HOCKEY_TRADE" | "BLOCKBUSTER" | "DEPTH";
    title: string;
    badge: string;
    description: string;
  };
  shares: {
    fromPct: number;
    toPct: number;
    diff: number;
    fairnessScore: number;
  };
  gapCloser: string | null;
  editorialNarrative: string;
  fromItems: GMAssistItem[];
  toItems: GMAssistItem[];
  capAnalysis: {
    fromDelta: number;
    toDelta: number;
    fromFmt: string;
    toFmt: string;
    summary: string;
    retainedCount: number;
  };
  reasoning: string[];
  fit: string[];
};

export type GMAssistResponse = { ok: false; error: string } | GMAssistResult;

// ---- AI GM Assistance: trade analysis -------------------------------------
// player trade-value heuristic (shared with the AI GM) — see lib/trade-value.ts

/** Analyse a proposed trade — value per side, whether it's balanced, and the fit
 *  for each club (cap, age). Pure heuristic (no external AI). Symmetric, so both
 *  the proposing and the reviewing GM see the same read. */
export async function analyzeTradeAction(pkg: TradePackage): Promise<GMAssistResponse> {
  const lang = await getLang().catch(() => "en");
  const [fromTeam, toTeam] = await Promise.all([
    prisma.team.findUnique({ where: { id: pkg.fromTeamId }, select: { id: true, name: true, code: true, logoUrl: true } }),
    prisma.team.findUnique({ where: { id: pkg.toTeamId }, select: { id: true, name: true, code: true, logoUrl: true } }),
  ]);
  if (!fromTeam || !toTeam) return { ok: false, error: "Team not found." };

  const clean = (s: string) => s.replace(/''[A-Za-z]''|\s*\([^)]*\)/g, "").trim();
  const norm = (s: string) => clean(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

  const pidAll = [...pkg.fromPlayers, ...pkg.toPlayers].map((p) => p.playerId);
  const players = await prisma.player.findMany({ where: { id: { in: pidAll } }, select: { id: true, name: true, overall: true, age: true, capHit: true, contractYears: true, position: true, isGoalie: true, lastSeasonGP: true, lastSeasonSvPct: true, goalieRating: { select: { overall: true } }, ck: true, pa: true, sc: true, df: true, curSeasonGP: true, ahlStats: true } });
  const pById = new Map(players.map((p) => [p.id, p]));

  // live rating, not a possibly-stale cached column — a goalie's real overall
  // lives on goalieRating (Player.overall can lag behind it); used everywhere
  // below so GM Assist always values a trade off CURRENT parameters.
  const ovOf = (id: number) => { const p = pById.get(id); return p ? (livePlayerOverall(p) ?? 45) : 45; };
  // real-life NHL vs AHL games this season for the player's REAL counterpart —
  // see realFormFactor in lib/trade-value.ts.
  const ahlGpOf = (p: { ahlStats: unknown }) => ((p.ahlStats as { cur?: { gp?: number } } | null)?.cur?.gp ?? 0);
  const realFormOf = (id: number) => { const p = pById.get(id); if (!p) return 1; return realFormFactor(p.age, p.curSeasonGP, ahlGpOf(p)); };

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
  // --- prospects: value by CEILING (potential) when a scouting-board entry matches -
  const prById = new Map((await prisma.prospect.findMany({ where: { id: { in: [...pkg.fromProspects, ...pkg.toProspects] } }, select: { id: true, name: true, overallPick: true, draftYear: true, position: true } })).map((p) => [p.id, p]));
  const dpAll = await prisma.draftProspect.findMany({ where: { draftYear: { in: [...new Set([...prById.values()].map((p) => p.draftYear).filter((y): y is number => y != null))] } }, select: { name: true, ov: true, potential: true, draftYear: true } });
  const dpByKey = new Map(dpAll.map((d) => [`${d.draftYear}:${norm(d.name)}`, d]));
  const potOf = (p: { name: string; draftYear: number | null }) => (p.draftYear != null ? dpByKey.get(`${p.draftYear}:${norm(p.name)}`) ?? null : null);
  const prospectValueByPot = (pot: number) => Math.round(Math.pow(Math.max(1, pot - 35), 2) * 0.7); // ceiling, bust-discounted

  const yearDisc = (year: number) => Math.max(0.6, 1 - Math.max(0, year - CURRENT_SEASON_START) * 0.08);
  const kv = (id: number) => { const k = kById.get(id); return k ? Math.round(pickValueBySlot(slotOfPick(k)) * yearDisc(k.year)) : 0; };
  const kLabel = (id: number) => { const k = kById.get(id); if (!k) return `Pick #${id}`; const slot = slotOfPick(k); const proj = boards.get(k.year)?.[slot - 1]; return `Pick ${k.year} R${k.round} (${lang === "cs" ? "odhad" : "proj."} #${slot})${proj ? ` → ${clean(proj)}` : ""}`; };
  // 250 (not 100) for a prospect with no scouting-board match AND no known draft
  // slot — a rare gap-data case, but 100 undersold even an unranked/undrafted
  // prospect against picks/players that never fall that low elsewhere.
  const prv = (id: number) => { const p = prById.get(id); if (!p) return 250; const dp = potOf(p); if (dp) return Math.max(60, prospectValueByPot(dp.potential)); return p.overallPick ? Math.max(50, pickValueBySlot(p.overallPick)) : 250; };
  const prLabel = (id: number) => { const p = prById.get(id); if (!p) return `Prospekt #${id}`; const dp = potOf(p); const tail = dp ? ` · ${lang === "cs" ? "potenciál" : "potential"} ${dp.potential}${dp.ov ? `/${dp.ov} OV` : ""}` : p.overallPick ? ` · draft #${p.overallPick}` : ""; return `${lang === "cs" ? "Prospekt" : "Prospect"}: ${clean(p.name)}${p.position ? ` (${p.position})` : ""}${tail}`; };
  const cashV = (c: number) => Math.round((c / 1_000_000) * 30);

  const sideValue = (pls: TradePlayer[], pk: number[], pr: number[], cash: number) =>
    pls.reduce((s, x) => s + playerValue(ovOf(x.playerId), pById.get(x.playerId)?.age ?? null, realFormOf(x.playerId)), 0)
    + pk.reduce((s, id) => s + kv(id), 0) + pr.reduce((s, id) => s + prv(id), 0) + cashV(cash);

  const meGives = sideValue(pkg.fromPlayers, pkg.fromPicks, pkg.fromProspects, pkg.fromCash);
  const meGets = sideValue(pkg.toPlayers, pkg.toPicks, pkg.toProspects, pkg.toCash);

  // itemised breakdown of every selected asset per side with rich typing
  const sideItems = (pls: TradePlayer[], pk: number[], pr: number[], cash: number): GMAssistItem[] => {
    const out: GMAssistItem[] = [];
    for (const x of pls) {
      const p = pById.get(x.playerId);
      const ov = ovOf(x.playerId);
      const retText = x.retentionPct ? ` · ${x.retentionPct}% ret.` : "";
      out.push({
        type: "PLAYER",
        label: `${p ? clean(p.name) : `#${x.playerId}`}${p ? ` (${ov} OV${p.position ? `, ${p.position}` : ""})` : ""}${retText}`,
        value: playerValue(ov, p?.age ?? null, realFormOf(x.playerId)),
        sub: p ? `${p.position ?? "F"} · ${p.age ?? "?"} ${lang === "cs" ? "r." : "yo"}` : undefined,
        ov,
        pos: p?.position ?? undefined,
        age: p?.age ?? undefined,
        retentionPct: x.retentionPct || undefined,
        isGoalie: p?.isGoalie,
      });
    }
    for (const id of pk) {
      const k = kById.get(id);
      const slot = k ? slotOfPick(k) : undefined;
      const proj = k && slot ? boards.get(k.year)?.[slot - 1] : undefined;
      out.push({
        type: "PICK",
        label: kLabel(id),
        value: kv(id),
        year: k?.year,
        round: k?.round,
        slot,
        projectedPlayer: proj ? clean(proj) : undefined,
      });
    }
    for (const id of pr) {
      const p = prById.get(id);
      const dp = p ? potOf(p) : null;
      out.push({
        type: "PROSPECT",
        label: prLabel(id),
        value: prv(id),
        pos: p?.position ?? undefined,
        potential: dp?.potential,
        ov: dp?.ov,
      });
    }
    if (cash > 0) {
      out.push({
        type: "CASH",
        label: `Cash $${cash.toLocaleString("en-US")}`,
        value: cashV(cash),
        cashAmount: cash,
      });
    }
    return out;
  };
  const fromItems = sideItems(pkg.fromPlayers, pkg.fromPicks, pkg.fromProspects, pkg.fromCash);
  const toItems = sideItems(pkg.toPlayers, pkg.toPicks, pkg.toProspects, pkg.toCash);
  const bal = meGets - meGives;
  const pct = bal / Math.max(1, (meGives + meGets) / 2);
  const tilt: "even" | "from" | "to" = Math.abs(pct) < 0.12 ? "even" : bal > 0 ? "from" : "to";
  const winner = tilt === "from" ? fromTeam.name : toTeam.name;
  const verdict = tilt === "even"
    ? (lang === "cs" ? "Vyrovnaná výmena — hodnotovo férová pre oba tímy." : "Fair & Balanced Trade — equal value for both sides.")
    : (lang === "cs"
        ? `${Math.abs(pct) > 0.30 ? "Výrazne" : "Mierne"} v prospech ${winner}.`
        : `${Math.abs(pct) > 0.30 ? "Significantly in favor of" : "Slight edge to"} ${winner}.`);

  // Cap breakdown
  const capOf = (pls: TradePlayer[]) => pls.reduce((s, x) => { const p = pById.get(x.playerId); return s + (p ? liveCapHit(p) : 0); }, 0);
  const capIn = capOf(pkg.toPlayers), capOut = capOf(pkg.fromPlayers);
  const capDelta = capIn - capOut;
  const fmt = (n: number) => `$${Math.abs(Math.round(n)).toLocaleString("en-US")}`;
  const retained = [...pkg.fromPlayers, ...pkg.toPlayers].filter((p) => p.retentionPct > 0);

  // Shares & Balance Meter
  const totalVal = Math.max(1, meGives + meGets);
  const fromShare = Math.round((meGives / totalVal) * 100);
  const toShare = 100 - fromShare;
  const diff = Math.abs(meGives - meGets);
  const fairnessScore = Math.max(0, Math.min(100, Math.round(100 - (diff / Math.max(1, (meGives + meGets) / 2)) * 100)));

  // Archetype
  let archKey: "WIN_NOW" | "REBUILD" | "CAP_RELIEF" | "HOCKEY_TRADE" | "BLOCKBUSTER" | "DEPTH" = "DEPTH";
  let archTitle = lang === "cs" ? "Doplnenie hĺbky kádra" : "Depth Adjustment";
  let archBadge = "🔄 DEPTH";
  let archDesc = lang === "cs" ? "Bežná výmena pre doladenie hĺbky zostavy bez zásadného dopadu na jadro tímov." : "Routine transaction adjusting depth without altering team cores.";

  const maxOv = Math.max(...[...pkg.fromPlayers, ...pkg.toPlayers].map((p) => ovOf(p.playerId)), 0);
  const hasR1Pick = [...pkg.fromPicks, ...pkg.toPicks].some((id) => kById.get(id)?.round === 1);

  if (meGives + meGets >= 1800 || maxOv >= 80 || hasR1Pick) {
    archKey = "BLOCKBUSTER";
    archBadge = "💥 BLOCKBUSTER";
    archTitle = lang === "cs" ? "Veľká výmena (Blockbuster)" : "Blockbuster Trade";
    archDesc = lang === "cs" ? "Masívny obchod s vysokou hodnotou aktív, ktorý výrazne mení tvár oboch tímov." : "High-stakes deal shifting elite assets and altering both franchises.";
  } else if (Math.abs(capDelta) >= 3_500_000 || retained.length > 0) {
    archKey = "CAP_RELIEF";
    archBadge = "📦 SALARY DUMP / RETENTION";
    archTitle = lang === "cs" ? "Platové uvoľnenie (Cap Relief)" : "Salary Cap Maneuver";
    archDesc = lang === "cs" ? "Primárnou motiváciou je flexibilita pod platovým stropom a uvoľnenie financií." : "Move primarily driven by financial cap clearing and flexibility.";
  } else if ((pkg.fromPlayers.some(p => ovOf(p.playerId) >= 74) && pkg.toPicks.length + (pkg.toProspects?.length ?? 0) > 0) ||
             (pkg.toPlayers.some(p => ovOf(p.playerId) >= 74) && pkg.fromPicks.length + (pkg.fromProspects?.length ?? 0) > 0)) {
    archKey = "WIN_NOW";
    archBadge = "🔥 WIN-NOW ACQUISITION";
    archTitle = lang === "cs" ? "Win-Now posilnenie vs Budúcnosť" : "Win-Now vs Future Assets";
    archDesc = lang === "cs" ? "Jeden tím nakupuje okamžitú kvalitu do zostavy na úkor draftového kapitálu." : "One team buys immediate impact in exchange for future draft capital.";
  } else if (pkg.fromPlayers.length > 0 && pkg.toPlayers.length > 0) {
    archKey = "HOCKEY_TRADE";
    archBadge = "⚖️ HOCKEY TRADE";
    archTitle = lang === "cs" ? "Hokejová výmena (Hráč za hráča)" : "Hockey Trade (Player for Player)";
    archDesc = lang === "cs" ? "Priama výmena aktívnych hráčov pre zmenu impulzu alebo riešenie pozičných potrieb." : "Direct exchange of rostered players to address positional needs.";
  }

  // Gap closer suggestion
  let gapCloser: string | null = null;
  if (tilt !== "even" && diff >= 75) {
    const favoredTeam = tilt === "from" ? toTeam.name : fromTeam.name;
    if (diff >= 900) {
      gapCloser = lang === "cs"
        ? `Na dorovnanie rozdielu (~${diff} b.) by ${favoredTeam} mal pridať voľbu v 1. kole draftu alebo etablovaného hráča (~78-82 OV).`
        : `To bridge the ~${diff} pt gap, ${favoredTeam} should add a 1st-round draft pick or top player (~78-82 OV).`;
    } else if (diff >= 400) {
      gapCloser = lang === "cs"
        ? `Na dorovnanie rozdielu (~${diff} b.) by ${favoredTeam} mal priložiť voľbu v 2. kole draftu (odhad ~450-550 b.) alebo špičkového prospekta.`
        : `To bridge the ~${diff} pt gap, ${favoredTeam} should attach a 2nd-round draft pick (~450-550 pts) or top prospect.`;
    } else if (diff >= 180) {
      gapCloser = lang === "cs"
        ? `Na dorovnanie rozdielu (~${diff} b.) by postačila voľba v 3. kole draftu alebo mladík pre farmu.`
        : `To bridge the ~${diff} pt gap, a 3rd-round pick or young depth player would suffice.`;
    } else {
      gapCloser = lang === "cs"
        ? `Mierny rozdiel (~${diff} b.) — postačí neskoršia voľba v drafte (4.-5. kolo) alebo finančná kompenzácia.`
        : `Minor gap (~${diff} pts) — a later draft pick (4th-5th round) or cash adjustment would balance this deal.`;
    }
  }

  // fit reasoning
  const reasoning: string[] = [];
  reasoning.push(lang === "cs"
    ? `Hodnota: <b>${fromTeam.name}</b> dáva ${meGives}, dostáva ${meGets} bodov hodnoty.`
    : `Value: <b>${fromTeam.name}</b> sends ${meGives}, receives ${meGets} value points.`);

  if (capDelta > 0) {
    reasoning.push(lang === "cs"
      ? `Cap: <b>${fromTeam.name}</b> si pridá ${fmt(capDelta)} na plate (${toTeam.name} uvoľní).`
      : `Cap: <b>${fromTeam.name}</b> absorbs ${fmt(capDelta)} in salary (${toTeam.name} frees up space).`);
  } else if (capDelta < 0) {
    reasoning.push(lang === "cs"
      ? `Cap: <b>${fromTeam.name}</b> uvoľní ${fmt(capDelta)} platu (${toTeam.name} prevezme záťaž).`
      : `Cap: <b>${fromTeam.name}</b> sheds ${fmt(capDelta)} in cap hit (${toTeam.name} takes on salary).`);
  }

  const ages = (pls: TradePlayer[]) => { const a = pls.map((x) => pById.get(x.playerId)?.age).filter((x): x is number => x != null); return a.length ? a.reduce((s, x) => s + x, 0) / a.length : null; };
  const ageIn = ages(pkg.toPlayers), ageOut = ages(pkg.fromPlayers);
  if (ageIn != null && ageOut != null) {
    const d = ageIn - ageOut;
    if (Math.abs(d) >= 1.5) {
      reasoning.push(lang === "cs"
        ? `Vek: <b>${fromTeam.name}</b> ${d < 0 ? "omladzuje" : "starne"} (priemer prichádzajúcich ${ageIn.toFixed(1)} vs odchádzajúcich ${ageOut.toFixed(1)}).`
        : `Age: <b>${fromTeam.name}</b> gets ${d < 0 ? "younger" : "older"} (incoming avg ${ageIn.toFixed(1)} vs outgoing ${ageOut.toFixed(1)}).`);
    }
  }
  if (retained.length) {
    reasoning.push(lang === "cs"
      ? `Retencia: ${retained.length} hráč(ov) so zadržaným platom — viaže cap space aj v ďalších rokoch.`
      : `Retention: ${retained.length} player(s) with retained salary — ties up salary cap space over future years.`);
  }

  const skaterParams = (pls: TradePlayer[]) => {
    const rows = pls.map((x) => pById.get(x.playerId)).filter((p): p is NonNullable<typeof p> => !!p && !p.isGoalie && p.ck != null && p.pa != null && p.sc != null && p.df != null);
    if (!rows.length) return null;
    const avg = (k: "ck" | "pa" | "sc" | "df") => rows.reduce((s, p) => s + (p[k] as number), 0) / rows.length;
    return { ck: avg("ck"), pa: avg("pa"), sc: avg("sc"), df: avg("df") };
  };
  const paramsIn = skaterParams(pkg.toPlayers), paramsOut = skaterParams(pkg.fromPlayers);
  if (paramsIn && paramsOut) {
    const parts = (["ck", "pa", "sc", "df"] as const)
      .map((k) => ({ k, v: Math.round(paramsIn[k] - paramsOut[k]) }))
      .filter((x) => Math.abs(x.v) >= 3);
    if (parts.length) {
      reasoning.push(lang === "cs"
        ? `Parametre: <b>${fromTeam.name}</b> mení profil hráčov oproti odchádzajúcim — ${parts.map((x) => `${x.k.toUpperCase()} ${x.v > 0 ? "+" : ""}${x.v}`).join(", ")}.`
        : `Attributes: <b>${fromTeam.name}</b> alters attribute profile — ${parts.map((x) => `${x.k.toUpperCase()} ${x.v > 0 ? "+" : ""}${x.v}`).join(", ")}.`);
    }
  }

  reasoning.push(tilt === "even"
    ? (lang === "cs" ? "Doporučenie: férová výmena, dá sa akceptovať." : "Recommendation: fair trade, safe to accept.")
    : (lang === "cs"
        ? `Doporučenie: ${winner} z nej ťaží — druhá strana by mala pridať hodnotu alebo zvážiť odmietnutie.`
        : `Recommendation: ${winner} benefits most — the other side should seek more value or decline.`));

  // Roster fit analysis
  const grp = (pos: string | null) => { const P = (pos ?? "").toUpperCase(); if (/G/.test(P)) return "G"; if (/(^|\/)D(\/|$)|^D$/.test(P)) return "D"; if (/C/.test(P)) return "C"; return "W"; };
  const [fromRoster0, toRoster0] = await Promise.all([
    prisma.player.findMany({ where: { teamId: pkg.fromTeamId, rosterType: "NHL" }, select: { id: true, overall: true, position: true, isGoalie: true, lastSeasonGP: true, lastSeasonSvPct: true, goalieRating: { select: { overall: true } } } }),
    prisma.player.findMany({ where: { teamId: pkg.toTeamId, rosterType: "NHL" }, select: { id: true, overall: true, position: true, isGoalie: true, lastSeasonGP: true, lastSeasonSvPct: true, goalieRating: { select: { overall: true } } } }),
  ]);
  const fromRoster = fromRoster0.map((r) => ({ ...r, overall: livePlayerOverall(r) }));
  const toRoster = toRoster0.map((r) => ({ ...r, overall: livePlayerOverall(r) }));
  const grpLabel: Record<string, string> = lang === "cs"
    ? { C: "centra", W: "krídla", D: "obrancu", G: "brankára" }
    : { C: "center", W: "winger", D: "defenseman", G: "goalie" };

  const slotFor = (g: string, slot: number) => {
    if (lang === "cs") {
      if (g === "G") return slot === 1 ? "brankársku jednotku" : "brankársku dvojku";
      if (g === "D") return slot <= 2 ? "1. obranný pár" : slot <= 4 ? "top-4 obranu" : slot <= 6 ? "3. obranný pár" : "7. obrancu / farmu";
      return slot <= 3 ? "elitnú lajnu" : slot <= 6 ? "top-6 útok" : slot <= 9 ? "3. lajnu" : slot <= 12 ? "4. lajnu" : "13. útočníka / farmu";
    }
    if (g === "G") return slot === 1 ? "starting goalie" : "backup goalie";
    if (g === "D") return slot <= 2 ? "top pairing D" : slot <= 4 ? "top-4 D" : slot <= 6 ? "bottom pairing D" : "7th D / AHL";
    return slot <= 3 ? "1st line" : slot <= 6 ? "top-6 forward" : slot <= 9 ? "3rd line" : slot <= 12 ? "4th line" : "extra forward / AHL";
  };

  const fit: string[] = [];
  const analyzeFit = (movers: TradePlayer[], destRoster: { overall: number | null; position: string | null; isGoalie: boolean }[], destName: string) => {
    for (const x of movers) {
      const p = pById.get(x.playerId); if (!p) continue;
      const g = grp(p.position); const ov = livePlayerOverall(p) ?? 45;
      const same = destRoster.filter((r) => grp(r.position) === g);
      const better = same.filter((r) => (r.overall ?? 0) > ov).length;
      const goodAt = same.filter((r) => (r.overall ?? 0) >= 55).length;
      const need = (g === "C" && goodAt < 3) || (g === "W" && goodAt < 6) || (g === "D" && goodAt < 5) || (g === "G" && goodAt < 2);
      fit.push(lang === "cs"
        ? `→ <b>${destName}</b>: ${clean(p.name)} (${ov} OV) by obsadil <b>${slotFor(g, better + 1)}</b>${need ? ` — <b>kryje slabšie miesto na poste ${grpLabel[g]}</b>` : ""}.`
        : `→ <b>${destName}</b>: ${clean(p.name)} (${ov} OV) slots as <b>${slotFor(g, better + 1)}</b>${need ? ` — <b>fills a critical need at ${grpLabel[g]}</b>` : ""}.`);
    }
  };

  const analyzeOut = (movers: TradePlayer[], ownRoster: { overall: number | null; position: string | null; isGoalie: boolean }[], teamName: string) => {
    for (const x of movers) {
      const p = pById.get(x.playerId); if (!p) continue;
      const g = grp(p.position); const ov = livePlayerOverall(p) ?? 45;
      const same = ownRoster.filter((r) => grp(r.position) === g);
      const better = same.filter((r) => (r.overall ?? 0) > ov).length;
      const goodLeft = same.filter((r) => (r.overall ?? 0) >= 55).length - (ov >= 55 ? 1 : 0);
      const key = (g === "G" && better === 0) || (g === "D" && better < 4) || ((g === "C" || g === "W") && better < 6);
      const thin = (g === "C" && goodLeft < 2) || (g === "W" && goodLeft < 5) || (g === "D" && goodLeft < 4) || (g === "G" && goodLeft < 1);
      fit.push(lang === "cs"
        ? `← <b>${teamName}</b> stráca ${clean(p.name)} (${ov} OV, ${slotFor(g, better + 1)})${key ? ` — <b>kľúčový hráč, oslabí ${grpLabel[g]}</b>${thin ? " (vznikne diera)" : ""}` : " — hĺbka, odchod výrazne nebolí"}.`
        : `← <b>${teamName}</b> loses ${clean(p.name)} (${ov} OV, ${slotFor(g, better + 1)})${key ? ` — <b>key core asset, weakens ${grpLabel[g]}</b>${thin ? " (leaves a void)" : ""}` : " — depth asset, minimal roster shock"}.`);
    }
  };
  analyzeFit(pkg.fromPlayers, toRoster, toTeam.name);
  analyzeOut(pkg.fromPlayers, fromRoster, fromTeam.name);
  analyzeFit(pkg.toPlayers, fromRoster, fromTeam.name);
  analyzeOut(pkg.toPlayers, toRoster, toTeam.name);

  // Real-world form note
  const realFormNote = (movers: TradePlayer[]) => {
    for (const x of movers) {
      const p = pById.get(x.playerId); if (!p || p.isGoalie || p.age == null || p.age > 23) continue;
      const nhlGp = p.curSeasonGP ?? 0, ahlGp = ahlGpOf(p);
      if (nhlGp + ahlGp < 5) continue;
      const nhlShare = nhlGp / (nhlGp + ahlGp);
      const tag = lang === "cs"
        ? (nhlShare >= 0.6 ? "pravidelne hráva reálnu NHL" : nhlShare <= 0.3 ? "v reálnom živote zatiaľ skôr v AHL" : "delí čas medzi reálnou NHL a AHL")
        : (nhlShare >= 0.6 ? "regular in real NHL" : nhlShare <= 0.3 ? "developing mainly in AHL" : "split minutes between NHL and AHL");
      fit.push(`📡 <b>${clean(p.name)}</b> (${p.age} ${lang === "cs" ? "r." : "yo"}): ${tag} — ${nhlGp} NHL / ${ahlGp} AHL.`);
    }
  };
  realFormNote(pkg.fromPlayers);
  realFormNote(pkg.toPlayers);

  // Worthy goalie advisory rule check
  const outFromIds = new Set(pkg.fromPlayers.map((p) => p.playerId));
  const outToIds = new Set(pkg.toPlayers.map((p) => p.playerId));
  const incomingToFrom = pkg.toPlayers.map((p) => pById.get(p.playerId)).filter((p): p is NonNullable<typeof p> => !!p?.isGoalie);
  const incomingToTo = pkg.fromPlayers.map((p) => pById.get(p.playerId)).filter((p): p is NonNullable<typeof p> => !!p?.isGoalie);
  const postFromGoalies = [...fromRoster.filter((r) => r.isGoalie && !outFromIds.has(r.id)), ...incomingToFrom.map((p) => ({ ...p, overall: livePlayerOverall(p) }))];
  const postToGoalies = [...toRoster.filter((r) => r.isGoalie && !outToIds.has(r.id)), ...incomingToTo.map((p) => ({ ...p, overall: livePlayerOverall(p) }))];
  if (!hasWorthyGoalie(postFromGoalies)) {
    fit.push(lang === "cs"
      ? `⚠️ <b>${fromTeam.name}</b> by po tomto trejde nemal žiadneho dôstojného brankára — súpiska nebude podľa pravidiel pripravená na zápas.`
      : `⚠️ <b>${fromTeam.name}</b> would be left without a starting-caliber goalie — roster violates league readiness rules.`);
  }
  if (!hasWorthyGoalie(postToGoalies)) {
    fit.push(lang === "cs"
      ? `⚠️ <b>${toTeam.name}</b> by po tomto trejde nemal žiadneho dôstojného brankára — súpiska nebude podľa pravidiel pripravená na zápas.`
      : `⚠️ <b>${toTeam.name}</b> would be left without a starting-caliber goalie — roster violates league readiness rules.`);
  }

  // Editorial Narrative Synthesis
  let editorialNarrative = "";
  if (lang === "cs") {
    editorialNarrative = `${archTitle}: Táto výmena jasne odráža rozdielne priority oboch generálnych manažérov. `;
    if (archKey === "WIN_NOW") {
      editorialNarrative += `${winner} vsádza na okamžité posilnenie a získava okamžitú istotu do zostavy, zatiaľ čo protistrana hromadí budúce aktíva. `;
    } else if (archKey === "CAP_RELIEF") {
      editorialNarrative += `Významným motorom je uvoľnenie platového priestoru (${fmt(Math.abs(capDelta))}), ktoré otvára dôležitý manévrovací priestor pod platovým stropom. `;
    } else if (archKey === "BLOCKBUSTER") {
      editorialNarrative += `Ide o prvotriedny blockbuster s masívnym balíkom bodov, ktorý zásadne zmení hierarchiu oboch klubov v divízii. `;
    } else {
      editorialNarrative += `Ide o cielené vyváženie zostavy, kde si oba tímy vymieňajú potrebné diely skladačky. `;
    }
    if (tilt === "even") {
      editorialNarrative += `Z pohľadu ligovej metodiky ide o vyrovnaný a vzájomne prospešný obchod.`;
    } else {
      editorialNarrative += `Hodnotová miska váh je však naklonená na stranu tímu ${winner} (+${diff} b.). ${gapCloser ?? ""}`;
    }
  } else {
    editorialNarrative = `${archTitle}: This proposal reflects distinct institutional priorities for both front offices. `;
    if (archKey === "WIN_NOW") {
      editorialNarrative += `${winner} targets immediate on-ice upgrades for a playoff run, while the counterparty stockpiles long-term capital. `;
    } else if (archKey === "CAP_RELIEF") {
      editorialNarrative += `The primary financial driver is cap relief (${fmt(Math.abs(capDelta))}), creating vital maneuvering room under the ceiling. `;
    } else if (archKey === "BLOCKBUSTER") {
      editorialNarrative += `A franchise-altering blockbuster moving heavyweight assets that reshapes both rosters in the conference. `;
    } else {
      editorialNarrative += `A targeted rebalancing deal where both squads address specific positional depths. `;
    }
    if (tilt === "even") {
      editorialNarrative += `By all quantitative league standards, this is a clean, equitable hockey trade.`;
    } else {
      editorialNarrative += `The numerical leverage firmly rests with ${winner} (+${diff} pts). ${gapCloser ?? ""}`;
    }
  }

  const capSummary = capDelta > 0
    ? (lang === "cs" ? `${fromTeam.name} pridáva +${fmt(capDelta)} na plate` : `${fromTeam.name} absorbs +${fmt(capDelta)} in salary`)
    : capDelta < 0
      ? (lang === "cs" ? `${fromTeam.name} uvoľňuje -${fmt(capDelta)} platu` : `${fromTeam.name} sheds -${fmt(capDelta)} in cap hit`)
      : (lang === "cs" ? "Neutrálny cap dopad ($0)" : "Neutral cap impact ($0)");

  return {
    ok: true,
    fromName: fromTeam.name,
    toName: toTeam.name,
    fromTeam,
    toTeam,
    meGives,
    meGets,
    verdict,
    tilt,
    archetype: {
      key: archKey,
      title: archTitle,
      badge: archBadge,
      description: archDesc,
    },
    shares: {
      fromPct: fromShare,
      toPct: toShare,
      diff,
      fairnessScore,
    },
    gapCloser,
    editorialNarrative,
    fromItems,
    toItems,
    capAnalysis: {
      fromDelta: -capDelta,
      toDelta: capDelta,
      fromFmt: capDelta < 0 ? `+${fmt(capDelta)} uvoľnených` : `-${fmt(capDelta)} absorbovaných`,
      toFmt: capDelta > 0 ? `+${fmt(capDelta)} uvoľnených` : `-${fmt(capDelta)} absorbovaných`,
      summary: capSummary,
      retainedCount: retained.length,
    },
    reasoning,
    fit,
  };
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
  await assertConditionSpec(pkg);

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
        throw new Error(`${displayName(pl.name)} won't waive his clause for free — the agent fee is $${(required / 1e6).toFixed(2)}M, paid by the club dealing him.`);
    };
    for (const p of pkg.fromPlayers) await requireConsent(p.playerId, pkg.toTeamId, pkg.fromTeamId);
    for (const p of pkg.toPlayers) await requireConsent(p.playerId, pkg.fromTeamId, pkg.toTeamId);
  }

  // Dry-run the SAME validated executor accept-time uses (retention cooldown,
  // max retentions per contract, the reacquire ban, retention-floor/cap
  // checks…) so a deal that would fail at accept can't even be proposed —
  // it just throws here, we never use the returned ops. Without this, a
  // trade like "retain again on a contract still inside its 75-day cooldown"
  // sailed straight into the other GM's inbox looking perfectly normal, only
  // to (silently) fail whenever they got around to accepting it.
  await collectMoveOps(pkg);

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
  if (trade.groupId != null) throw new Error("This is a leg of a 3-team trade — respond to the trade group instead.");
  if (trade.status !== "PENDING") throw new Error("This trade is no longer pending.");
  // the receiving GM responds; the commissioner may respond on his behalf (e.g. a GM
  // who couldn't confirm it himself).
  const admin = await isAdmin();
  if (session !== trade.toTeamId && !admin) throw new Error("Only the receiving GM (or the commissioner) can respond to this trade.");

  if (!accept) {
    // tell the proposer privately (a pending proposal is private → no public log)
    const decliner = (await prisma.team.findUnique({ where: { id: trade.toTeamId }, select: { name: true } }))?.name ?? "The other club";
    // the commissioner can decline "on behalf of" the receiving GM (session !== toTeamId,
    // caught by the admin check above) — the badge should say so, not just name the club.
    const declinedBy = session !== trade.toTeamId ? `${decliner} (via Commissioner)` : decliner;
    await prisma.trade.update({ where: { id: tradeId }, data: { status: "DECLINED", respondedAt: new Date(), declinedBy } });
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
  if (trade.groupId != null) throw new Error("This is a leg of a 3-team trade — review the trade group instead.");
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
    const actingName = actingTeamId != null
      ? (await prisma.team.findUnique({ where: { id: actingTeamId }, select: { name: true } }))?.name
      : null;
    const declinedBy = actingName ? `Commission (${actingName})` : "Commission";
    await prisma.trade.update({ where: { id: tradeId }, data: { status: "DECLINED", respondedAt: new Date(), commishNote: note || null, declinedBy } });
    for (const tid of [trade.fromTeamId, trade.toTeamId])
      await prisma.dmMessage.create({ data: { fromTeamId: tid, toTeamId: tid, body: `❌ Commission DECLINED trade #${tradeId}.${note ? ` — ${note}` : ""}`, tradeUrl: `/trades/${tradeId}` } }).catch(() => {});
    revalidatePath("/trades"); revalidatePath("/trades/commish"); revalidatePath("/messages");
    return { status: "DECLINED" as const };
  }
  // modify → back to BOTH clubs to rebalance (resubmitModifiedTrade allows either side
  // to do it, not just the rookie), with the commission's note
  await prisma.trade.update({ where: { id: tradeId }, data: { status: "MODIFY", commishNote: note || null } });
  for (const tid of [trade.fromTeamId, trade.toTeamId])
    await prisma.dmMessage.create({ data: { fromTeamId: tid, toTeamId: tid, body: `✏️ Commission asked to MODIFY trade #${tradeId} (${nameOf(trade.fromTeamId)} ↔ ${nameOf(trade.toTeamId)}).${note ? ` Note: ${note}` : ""} Open it and adjust the assets, then resubmit.`, tradeUrl: `/trades/build?edit=${tradeId}` } }).catch(() => {});
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

  const { ops, fromTeam, toTeam, moved } = await reverseTradeOps(tradeId);
  ops.push(prisma.trade.update({ where: { id: tradeId }, data: { status: "REVERTED", respondedAt: new Date() } }));
  // a reverted deal never happened — pull its "X traded ... to Y" line out of the
  // home page's Trade Tracker (which just reads Transaction, blind to Trade.status)
  ops.push(prisma.transaction.deleteMany({ where: { tradeId, type: "TRADE" } }));
  ops.push(prisma.transaction.create({ data: { type: "TRADE", message: `Commissioner revoked the ${fromTeam.name} ↔ ${toTeam.name} trade — assets returned.` } }));
  await prisma.$transaction(ops);
  for (const p of ["/trades", "/admin/trades", "/salary-cap", "/finance", "/teams", "/"]) revalidatePath(p);
  return { ok: true as const, moved };
}

/** Commissioner deletes a trade entirely (and its assets/conditions). For clearing
 *  spam, duplicates, or a mistaken proposal. An already-applied ACCEPTED trade has
 *  its roster/pick/cash moves undone first (same reversal Revoke uses) and its
 *  Trade Tracker line removed, so Delete on a completed deal behaves like a full
 *  undo rather than just erasing the paperwork while the players stay traded. */
export async function deleteTradeAction(tradeId: number) {
  if (!(await isAdmin())) throw new Error("Only the commissioner can delete trades.");
  const trade = await prisma.trade.findUnique({ where: { id: tradeId }, select: { id: true, status: true } });
  if (!trade) throw new Error("Trade not found.");
  const ops: Prisma.PrismaPromise<unknown>[] = [];
  let moved = 0;
  if (trade.status === "ACCEPTED") {
    const rev = await reverseTradeOps(tradeId);
    ops.push(...rev.ops);
    moved = rev.moved;
    ops.push(prisma.transaction.deleteMany({ where: { tradeId, type: "TRADE" } }));
  }
  ops.push(prisma.tradeAsset.deleteMany({ where: { tradeId } }));
  ops.push(prisma.tradeCondition.deleteMany({ where: { tradeId } }));
  ops.push(prisma.trade.delete({ where: { id: tradeId } }));
  await prisma.$transaction(ops);
  for (const p of ["/trades", "/admin/trades", "/salary-cap", "/finance", "/teams", "/"]) revalidatePath(p);
  return { ok: true, wasStatus: trade.status, moved };
}

/** Commissioner restores a DECLINED trade back to PENDING — for a decline that was a
 *  mistake (wrong button, a commission decline meant for a different deal, ...).
 *  No assets ever moved on a DECLINED trade, so this is a pure status flip; the
 *  receiving club still needs to actually Accept it. Only reachable within
 *  cleanupDeclinedTrades' grace window — past that the trade (and its TradeAsset
 *  rows) is already gone for good. */
export async function restoreDeclinedTradeAction(tradeId: number) {
  if (!(await isAdmin())) return { ok: false as const, error: "Only the commissioner can restore trades." };
  const trade = await prisma.trade.findUnique({ where: { id: tradeId } });
  if (!trade) return { ok: false as const, error: "Trade not found — it may already have been swept for good." };
  if (trade.status !== "DECLINED") return { ok: false as const, error: "Only a declined trade can be restored." };
  await prisma.trade.update({ where: { id: tradeId }, data: { status: "PENDING", respondedAt: null, commishNote: null, declinedBy: null } });
  const [fromTeam, toTeam] = await Promise.all([
    prisma.team.findUnique({ where: { id: trade.fromTeamId }, select: { name: true } }),
    prisma.team.findUnique({ where: { id: trade.toTeamId }, select: { name: true } }),
  ]);
  for (const tid of [trade.fromTeamId, trade.toTeamId])
    await prisma.dmMessage.create({ data: { fromTeamId: tid, toTeamId: tid, body: `↩️ The commissioner restored trade #${tradeId} (${fromTeam?.name ?? "?"} ↔ ${toTeam?.name ?? "?"}) — it's pending again.`, tradeUrl: `/trades/${tradeId}` } }).catch(() => {});
  revalidatePath("/trades"); revalidatePath("/admin/trades"); revalidatePath("/messages");
  return { ok: true as const };
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
  // my side = FROM if I'm the proposer, else TO
  const mySide = iAmFrom ? "FROM" : "TO";
  const describe = (side: string) => {
    const rows = assets.filter((a) => a.side === side);
    const parts: string[] = [];
    for (const a of rows) {
      if (a.assetType === "PLAYER" && a.playerId) parts.push(displayName(nameOf.get(a.playerId) ?? "a player"));
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

export type TradeAnnouncement = {
  id: number;
  respondedAt: Date;
  fromTeam: { name: string; code: string | null; logoUrl: string | null } | null;
  toTeam: { name: string; code: string | null; logoUrl: string | null } | null;
  fromLabels: string[];
  toLabels: string[];
};

/** Every 2-team trade completed league-wide in the last 3 days, EXCLUDING the logged-in
 *  club's own deals (those already get the personal latestTradeCelebrationAction popup) —
 *  powers the site-wide "new trades around the league" announcement. The client remembers
 *  which ids it has dismissed (localStorage), so this just reports what's recent. */
export async function recentTradeAnnouncementsAction(): Promise<TradeAnnouncement[]> {
  const session = await getTeamSession();
  if (session == null) return [];
  const since = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  const trades = await prisma.trade.findMany({
    where: {
      status: "ACCEPTED", respondedAt: { gte: since }, groupId: null,
      NOT: [{ fromTeamId: session }, { toTeamId: session }],
    },
    orderBy: { respondedAt: "desc" },
    take: 15,
  });
  if (!trades.length) return [];
  const teamIds = [...new Set(trades.flatMap((t) => [t.fromTeamId, t.toTeamId]))];
  const assets = await prisma.tradeAsset.findMany({ where: { tradeId: { in: trades.map((t) => t.id) } } });
  const playerIds = assets.filter((a) => a.playerId).map((a) => a.playerId!);
  const prospectIds = assets.filter((a) => a.prospectId).map((a) => a.prospectId!);
  const pickIds = assets.filter((a) => a.draftPickId).map((a) => a.draftPickId!);
  const [teams, players, prospects, picks] = await Promise.all([
    prisma.team.findMany({ where: { id: { in: teamIds } }, select: { id: true, name: true, code: true, logoUrl: true } }),
    prisma.player.findMany({ where: { id: { in: playerIds } }, select: { id: true, name: true } }),
    prisma.prospect.findMany({ where: { id: { in: prospectIds } }, select: { id: true, name: true } }),
    prisma.draftPick.findMany({ where: { id: { in: pickIds } }, select: { id: true, year: true, round: true } }),
  ]);
  const teamById = new Map(teams.map((t) => [t.id, t]));
  const pName = new Map(players.map((p) => [p.id, p.name]));
  const proName = new Map(prospects.map((p) => [p.id, p.name]));
  const pickLabel = new Map(picks.map((p) => [p.id, `${p.year} R${p.round}`]));
  const labelsFor = (tradeId: number, side: "FROM" | "TO") =>
    assets.filter((a) => a.tradeId === tradeId && a.side === side).map((a) => {
      if (a.assetType === "PLAYER") return displayName(pName.get(a.playerId ?? -1) ?? "Player");
      if (a.assetType === "PROSPECT") return `⭐ ${displayName(proName.get(a.prospectId ?? -1) ?? "Prospect")}`;
      if (a.assetType === "PICK") return `🎫 ${pickLabel.get(a.draftPickId ?? -1) ?? "Pick"}`;
      if (a.assetType === "CASH") return `💵 ${money(a.cashAmount ?? 0)}`;
      return a.assetType;
    });
  return trades.map((t) => ({
    id: t.id,
    respondedAt: t.respondedAt!,
    fromTeam: teamById.get(t.fromTeamId) ?? null,
    toTeam: teamById.get(t.toTeamId) ?? null,
    fromLabels: labelsFor(t.id, "FROM"),
    toLabels: labelsFor(t.id, "TO"),
  }));
}
