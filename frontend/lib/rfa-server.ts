import "server-only";

import { prisma } from "@/lib/prisma";
import { getLeagueDate, getLeagueClock } from "@/lib/calendar-server";
import { loadSettings } from "@/lib/sim/settings";
import { ufaAtExpiry } from "@/lib/free-agency-server";
import { CURRENT_SEASON_START } from "@/lib/finance";
import { twoWayObjection } from "@/lib/free-agency";

export const RFA_OPEN_STATUSES = ["QO_DUE", "QO_TENDERED", "NEGOTIATING", "ARB_FILED", "AWARDED", "OS_ELIGIBLE"];

function expirySeason(p: { contractExpiry: number | null; contractYears: number | null }) {
  return p.contractExpiry ?? (CURRENT_SEASON_START + Math.max(0, p.contractYears ?? 0));
}

export function qoDueDate(season: number, day: number) {
  return new Date(Date.UTC(season, 5, Math.max(1, Math.min(30, day))));
}

/** Creates missing cases idempotently. This lets the feature roll out to live leagues
 * without requiring a one-off data migration before the first dashboard visit. */
export async function ensureRfaCases(teamId?: number) {
  const settings = await loadSettings();
  if (settings.faMode === "simple") return 0;
  const players = await prisma.player.findMany({
    where: {
      ...(teamId ? { teamId } : {}), rosterType: { in: ["NHL", "AHL", "NONROSTER"] },
      contractYears: { not: null, lte: 1 }, NOT: { capHit: 100_000 },
    },
    select: { id: true, teamId: true, capHit: true, contractExpiry: true, contractYears: true, age: true, birthDate: true, rightsReleased: true, lastSeasonGP: true },
  });
  let created = 0;
  const today = await getLeagueDate();
  for (const p of players) {
    if (ufaAtExpiry(p)) continue;
    const season = expirySeason(p);
    // The qualifying-offer window is an off-season deadline. If the league is already past it
    // (e.g. this feature went live mid-season), opening a case now would hand every club an
    // already-overdue QO and the next deadline sweep would cut its RFAs loose — so no case.
    if (qoDueDate(season, settings.rfaQoDeadlineDay) < today) continue;
    const qo = Math.max(settings.rfaQoMin, Math.round(((p.capHit ?? 0) * settings.rfaQoPct) / 100 / 50_000) * 50_000);
    const eligible = (p.age ?? 0) >= settings.arbMinAge || (p.lastSeasonGP ?? 0) >= settings.arbMinLastSeasonGp;
    const r = await prisma.rfaCase.upsert({
      where: { playerId_season: { playerId: p.id, season } },
      update: { teamId: p.teamId, qoAmount: qo, qoDueAt: qoDueDate(season, settings.rfaQoDeadlineDay), arbEligible: eligible },
      create: { playerId: p.id, teamId: p.teamId, season, qoAmount: qo, qoDueAt: qoDueDate(season, settings.rfaQoDeadlineDay), arbEligible: eligible },
    });
    if (r.createdAt.getTime() === r.updatedAt.getTime()) created++;
  }
  return created;
}

/** A missed QO relinquishes rights. An expired player becomes a normal UFA now;
 * a final-year player is marked for release when his contract runs out. */
export async function resolveExpiredQODueDates(now?: Date) {
  const effectiveNow = now ?? await getLeagueDate();
  const stale = await prisma.rfaCase.findMany({
    where: { status: "QO_DUE", qoDueAt: { lt: effectiveNow } },
    include: { player: { select: { contractYears: true } } },
  });
  for (const c of stale) {
    // a case opened AFTER its own deadline never gave the club a chance to tender — leave it be
    if (c.createdAt > c.qoDueAt) continue;
    await prisma.$transaction([
      prisma.rfaCase.update({ where: { id: c.id }, data: { status: "UFA", resolvedAt: effectiveNow } }),
      prisma.player.update({ where: { id: c.playerId }, data: { rightsReleased: true, franchiseTag: false, resignStatus: "walkedToUFA", ...(c.player.contractYears === 0 ? { rosterType: "UFA" } : {}) } }),
    ]);
  }
  return stale.length;
}

export async function arbitrationComparables(playerId: number) {
  const p = await prisma.player.findUnique({ where: { id: playerId }, select: { position: true, isGoalie: true, age: true, overall: true, capHit: true } });
  if (!p) return [];
  const peers = await prisma.player.findMany({
    where: { id: { not: playerId }, rosterType: { in: ["NHL", "AHL"] }, contractYears: { gt: 0 }, capHit: { gt: 0 }, isGoalie: p.isGoalie },
    select: { id: true, name: true, position: true, age: true, overall: true, capHit: true, contractYears: true, lastSeasonGP: true, lastSeasonPts: true, lastSeasonSvPct: true },
    take: 120,
  });
  return peers
    .filter((x) => p.isGoalie || x.position === p.position)
    .sort((a, b) => {
      const da = Math.abs((a.overall ?? 0) - (p.overall ?? 0)) * 3 + Math.abs((a.age ?? 0) - (p.age ?? 0));
      const db = Math.abs((b.overall ?? 0) - (p.overall ?? 0)) * 3 + Math.abs((b.age ?? 0) - (p.age ?? 0));
      return da - db;
    }).slice(0, 6);
}

export async function arbitrationRange(playerId: number, qo: number) {
  const comps = await arbitrationComparables(playerId);
  const salaries = comps.map((p) => p.capHit ?? 0).filter(Boolean).sort((a, b) => a - b);
  const median = salaries.length ? salaries[Math.floor(salaries.length / 2)] : qo;
  return { comps, low: Math.max(qo, Math.round(median * 0.80 / 50_000) * 50_000), high: Math.max(qo, Math.round(median * 1.20 / 50_000) * 50_000) };
}

// ── CBA rule: when must a QO be one-way? ──────────────────────────────────────
// A club MUST tender a one-way QO to a player who, simultaneously, (1) played 180+ NHL
// games over the last 3 seasons, (2) played 60+ NHL games last season and (3) was not
// on waivers since the start of camp. Anyone else may get a two-way QO.
export const QO_ONE_WAY_GP_3Y = 180;
export const QO_ONE_WAY_GP_LAST = 60;

export type QoFormInfo = {
  oneWayRequired: boolean;
  gp3: number;
  gpLast: number;
  waived: boolean;
  isGoalie: boolean;
  gpStartedLast?: number;
};

export type QoFormPlayer = {
  id: number;
  lastSeasonGP: number | null;
  lastSeasonAhlGP?: number | null;
  isGoalie?: boolean | null;
  rosterType?: string | null;
  mpSkater?: unknown;
  careerGP?: unknown;
};

/** Games over the last 3 seasons: MoneyPuck per-season totals when present; goalies/others
 *  without them fall back to career regular-season games (an upper bound), then last season. */
function gamesLast3(p: QoFormPlayer): number {
  const last = p.lastSeasonGP ?? 0;
  const mp = p.mpSkater as Record<string, { gp?: number }> | null;
  if (mp && typeof mp === "object") {
    const seasons = Object.keys(mp).map(Number).filter(Number.isFinite).sort((a, b) => b - a).slice(0, 3);
    if (seasons.length) return Math.max(last, seasons.reduce((n, y) => n + (mp[String(y)]?.gp ?? 0), 0));
  }
  const career = (p.careerGP as { reg?: number } | null)?.reg;
  return Math.max(last, typeof career === "number" ? career : 0);
}

/** CBA Goaltender dressed rule:
 *  For goalies, CBA counts games DRESSED (starter OR backup on the bench).
 *  An established NHL tandem goalie (25+ starts, no farm stint) was dressed for almost all ~82 games.
 *  A farm call-up (under 15 starts, AHL GP) was only dressed for a fraction. */
function goalieDressedEstimates(p: QoFormPlayer): { dressedLast: number; dressed3y: number; startedLast: number } {
  const startedLast = p.lastSeasonGP ?? 0;
  const ahlGP = p.lastSeasonAhlGP ?? 0;
  const career = (p.careerGP as { reg?: number; po?: number } | null)?.reg ?? startedLast;

  let dressedLast = startedLast;
  if (startedLast >= 60) {
    dressedLast = startedLast;
  } else if (startedLast >= 25 && ahlGP <= 5) {
    dressedLast = Math.min(82, Math.round(startedLast + (82 - startedLast) * 0.8));
  } else if (startedLast > 0 && ahlGP <= 15) {
    dressedLast = Math.min(82, Math.round(startedLast * 1.5));
  } else {
    dressedLast = startedLast;
  }

  let dressed3y = dressedLast;
  if (career >= 80 && ahlGP <= 10) {
    dressed3y = Math.min(246, Math.round(career * 1.8));
  } else {
    dressed3y = Math.min(246, Math.round(career * 1.3));
  }

  return { dressedLast, dressed3y, startedLast };
}

/** Batch version — one waiver query for all players. "Since camp" is approximated by the
 *  last 365 days of recorded waiver placements. */
export async function qoFormInfo(players: QoFormPlayer[]): Promise<Map<number, QoFormInfo>> {
  const since = new Date(Date.now() - 365 * 24 * 3600 * 1000);
  const waivers = players.length ? await prisma.transaction.findMany({
    where: { type: "WAIVER", playerId: { in: players.map((p) => p.id) }, createdAt: { gte: since }, message: { contains: "placed on waivers" } },
    select: { playerId: true },
  }) : [];
  const waived = new Set(waivers.map((w) => w.playerId));

  const goalieIds = players.filter((p) => p.isGoalie).map((p) => p.id);
  const goalieStatsCount = new Map<number, number>();
  if (goalieIds.length) {
    const rows = await prisma.goalieGameStat.groupBy({
      by: ["playerId"],
      where: { playerId: { in: goalieIds } },
      _count: { gameId: true },
    });
    for (const r of rows) {
      goalieStatsCount.set(r.playerId, r._count.gameId);
    }
  }

  return new Map<number, QoFormInfo>(players.map((p) => {
    const isGoalie = !!p.isGoalie;
    const w = waived.has(p.id);

    if (isGoalie) {
      const gSim = goalieStatsCount.get(p.id);
      const est = goalieDressedEstimates(p);
      const gpLast = gSim && gSim >= est.dressedLast ? gSim : est.dressedLast;
      const gp3 = Math.max(gpLast, est.dressed3y);
      const oneWayRequired = gp3 >= QO_ONE_WAY_GP_3Y && gpLast >= QO_ONE_WAY_GP_LAST && !w;
      return [p.id, {
        oneWayRequired,
        gp3,
        gpLast,
        waived: w,
        isGoalie: true,
        gpStartedLast: est.startedLast,
      }];
    }

    const gp3 = gamesLast3(p);
    const gpLast = p.lastSeasonGP ?? 0;
    const oneWayRequired = gp3 >= QO_ONE_WAY_GP_3Y && gpLast >= QO_ONE_WAY_GP_LAST && !w;
    return [p.id, {
      oneWayRequired,
      gp3,
      gpLast,
      waived: w,
      isGoalie: false,
    }];
  }));
}

export function qoOneWayMessage(i: QoFormInfo) {
  if (i.isGoalie) {
    return `The CBA requires a one-way QO for this goaltender: ~${i.gp3} NHL games dressed/backup in the last 3 seasons (180+), ~${i.gpLast} last season (60+, ${i.gpStartedLast ?? 0} started), no waivers. A two-way is only possible for goalies who miss one of these.`;
  }
  return `The CBA requires a one-way QO for him: ${i.gp3} NHL games in the last 3 seasons (180+), ${i.gpLast} last season (60+), no waivers. A two-way is only possible for players who miss one of these.`;
}



export const ARBITRATION_VERDICT_HOURS = 48;

/** Deliver one arbitration verdict. The arbitrator picks a salary inside the comparables range
 *  (midpoint of the club's and the player's submissions — by default the range's low and high),
 *  and the term (1 or 2 years) is chosen by the side that did NOT start the arbitration: a
 *  club filing hands the player the choice (he bets on himself: 1 year), a player filing hands
 *  the club the choice (2 years of cost certainty — 1 if the award is walk-away money). The
 *  club then has 48h to sign it or, at/above the walk-away threshold, walk. */
export async function issueArbitrationVerdict(caseId: number): Promise<{ ok: boolean; award?: number; term?: number; error?: string }> {
  const c = await prisma.rfaCase.findUnique({ where: { id: caseId }, include: { player: true, team: { select: { id: true, parentTeam: { select: { id: true } } } } } });
  if (!c || c.status !== "ARB_FILED") return { ok: false, error: "No open arbitration hearing." };
  const s = await loadSettings();
  const range = await arbitrationRange(c.playerId, c.qoAmount);
  const r50 = (v: number) => Math.round(v / 50_000) * 50_000;
  const clubAsk = c.clubAskAav ?? range.low;
  const playerAsk = c.playerAskAav ?? range.high;
  const award = Math.max(range.low, Math.min(range.high, r50((clubAsk + playerAsk) / 2)));
  const playerPicks = c.arbFiledBy !== "PLAYER"; // the side that did not file chooses the term
  let term = playerPicks ? 1 : (award >= s.arbWalkAwayThreshold ? 1 : 2);
  const twoWayOpts = {
    olderAge: s.faTwoWayOlderAge, gpLimit: s.faTwoWayNhlGpLimit, weakOverall: s.faTwoWayWeakOverall,
    maxYears: s.faTwoWayMaxYears, ahlMaxYears: s.faTwoWayAhlMaxYears, fewGpMaxYears: s.faTwoWayFewGpMaxYears, maxSalary: s.faTwoWayMaxSalary,
  };
  let type: "ONE_WAY" | "TWO_WAY" = "ONE_WAY";
  if (c.player.contractType === "TWO_WAY") {
    // a two-way player stays two-way when the award and term are allowed for one (else one-way)
    if (!twoWayObjection(true, c.player, term, award, twoWayOpts)) type = "TWO_WAY";
    else if (term > 1 && !twoWayObjection(true, c.player, 1, award, twoWayOpts)) { term = 1; type = "TWO_WAY"; }
  }
  const now = new Date();
  await prisma.rfaCase.update({ where: { id: caseId }, data: {
    status: "AWARDED", clubAskAav: Math.round(clubAsk), clubAskTerm: c.clubAskTerm ?? 2, playerAskAav: Math.round(playerAsk), playerAskTerm: c.playerAskTerm ?? 1,
    awardAav: award, awardTerm: term, awardContractType: type, walkAwayThreshold: s.arbWalkAwayThreshold,
    walkAwayDeadline: new Date(now.getTime() + 48 * 60 * 60 * 1000),
  } });
  // tell the club (DM from the Free Agents holding club — same sender as the agent messages)
  const fa = await prisma.team.findFirst({ where: { league: "FA" }, select: { id: true } });
  const clubId = c.team.parentTeam?.id ?? c.team.id;
  const M = (v: number) => `$${(v / 1e6).toFixed(2)}M`;
  if (fa) {
    await prisma.dmMessage.create({ data: { fromTeamId: fa.id, toTeamId: clubId, body:
      `⚖️ Arbitration verdict for ${c.player.name}: ${M(award)} × ${term}yr (${type === "TWO_WAY" ? "two-way" : "one-way"}), term chosen by the ${playerPicks ? "player" : "club"}. `
      + (award >= s.arbWalkAwayThreshold ? `It is at/above the ${M(s.arbWalkAwayThreshold)} walk-away line — you have 48 hours to sign it or walk away (he becomes a UFA).` : `It is below the ${M(s.arbWalkAwayThreshold)} walk-away line — you must sign it.`),
      tradeUrl: "/rfa" } }).catch(() => {});
  }
  return { ok: true, award, term };
}

/** The arbitrator rules within 48 hours of the filing — nobody has to click anything. */
export async function resolveArbitrationVerdicts(now?: Date) {
  const effectiveNow = now ?? new Date();
  const due = await prisma.rfaCase.findMany({ where: { status: "ARB_FILED", arbFiledAt: { lte: new Date(effectiveNow.getTime() - ARBITRATION_VERDICT_HOURS * 3_600_000) } }, select: { id: true } });
  let n = 0;
  for (const c of due) { const r = await issueArbitrationVerdict(c.id).catch(() => ({ ok: false })); if (r.ok) n++; }
  return n;
}


/** Opening negotiations with an RFA tenders his qualifying offer for the club. A club that is
 *  already talking to him must not lose his rights to the QO deadline, and a QO is also what
 *  makes him reachable by offer sheets afterwards. Cases that were opened AFTER their own
 *  deadline (the club never had a window) are tendered too. Idempotent. */
export async function autoTenderQo(playerId: number) {
  const c = await prisma.rfaCase.findFirst({ where: { playerId, status: "QO_DUE" } });
  if (!c) return false;
  const today = await getLeagueDate();
  if (c.qoDueAt < today && c.createdAt <= c.qoDueAt) return false; // a genuinely missed deadline is not undone here
  await prisma.rfaCase.update({ where: { id: c.id }, data: { status: "QO_TENDERED", qoTenderedAt: new Date() } });
  return true;
}

/** A week before the QO deadline: tell each club (once a day) which RFAs still have no QO. */
export async function warnMissingQo(now?: Date) {
  const today = now ?? await getLeagueDate();
  const horizon = new Date(today.getTime() + 7 * 86_400_000);
  const due = await prisma.rfaCase.findMany({
    where: { status: "QO_DUE", qoDueAt: { gte: today, lte: horizon } },
    include: { player: { select: { name: true } }, team: { select: { id: true, parentTeam: { select: { id: true } } } } },
  });
  if (!due.length) return 0;
  const fa = await prisma.team.findFirst({ where: { league: "FA" }, select: { id: true } });
  if (!fa) return 0;
  const byClub = new Map<number, { names: string[]; due: Date }>();
  for (const c of due) {
    const club = c.team.parentTeam?.id ?? c.team.id;
    const e = byClub.get(club) ?? { names: [], due: c.qoDueAt };
    e.names.push(c.player.name); if (c.qoDueAt < e.due) e.due = c.qoDueAt;
    byClub.set(club, e);
  }
  const since = new Date(Date.now() - 20 * 3_600_000);
  let sent = 0;
  for (const [clubId, e] of byClub) {
    const recent = await prisma.dmMessage.findFirst({ where: { fromTeamId: fa.id, toTeamId: clubId, body: { startsWith: "⚠️ QO deadline" }, createdAt: { gte: since } }, select: { id: true } });
    if (recent) continue;
    const list = e.names.slice(0, 12).join(", ") + (e.names.length > 12 ? ` … (+${e.names.length - 12})` : "");
    await prisma.dmMessage.create({ data: { fromTeamId: fa.id, toTeamId: clubId, tradeUrl: "/rfa", body:
      `⚠️ QO deadline ${e.due.toISOString().slice(0, 10)}: ${e.names.length} RFA${e.names.length === 1 ? "" : "s"} still without a qualifying offer — ${list}. Tender the QO in RFA Central, or start negotiating with the player (that tenders it automatically). After the deadline an un-tendered RFA's rights are released and he becomes a UFA.` } }).catch(() => {});
    sent++;
  }
  return sent;
}

/** Arbitration is a summer process (off-season / Free Agent Frenzy) — never preseason or in-season. */
export async function arbitrationWindowOpen(): Promise<boolean> {
  const phase = (await getLeagueClock()).phase;
  return phase === "offseason" || phase === "frenzy";
}
