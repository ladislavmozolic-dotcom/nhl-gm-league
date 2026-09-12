import { prisma } from "@/lib/prisma";
import { liveCapHit, playerCapYears, money, CURRENT_SEASON_START } from "@/lib/finance";
import { loadLeagueCap } from "@/lib/free-agency-server";
import { epSearchName } from "@/lib/playerName";

// Team-wide UNHL Intelligence findings — the "Cap", "Age curve", "Prospect
// pipeline" and "Roster balance" analyses from the UNHL Intelligence design
// doc (see memory: gm-assistant-intelligence), on top of the per-slot depth
// findings in analyzeRoster.ts. Same rule as the rest of the tool: every
// number here is a plain, explainable aggregate over real DB rows — no
// model, no invented weighting beyond a couple of plainly-stated round-number
// thresholds (documented inline).

export interface TeamFinding {
  id: string;
  label: string;
  severity: "ok" | "warning" | "critical";
  summary: string;
}

const isPos = (pos: string, code: string) => new RegExp(`(^|/)${code}(/|$)`).test(pos.toUpperCase());

const pKey = (n: string) => epSearchName(n).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

/** Cap outlook: contracts expiring after this season (UFA/RFA split via the
 *  same playerCapYears helper Cap Central uses) and the resulting projected
 *  cap space, using the current league ceiling as the best available stand-in
 *  for next season's (UNHL doesn't track a separate future cap number). */
async function capOutlookFinding(teamId: number): Promise<TeamFinding | null> {
  const [roster, cap] = await Promise.all([
    prisma.player.findMany({
      where: { teamId, rosterType: "NHL" },
      select: { capHit: true, contractYears: true, age: true, birthDate: true },
    }),
    loadLeagueCap(),
  ]);
  if (!roster.length) return null;

  const committedNextYear = roster.filter((p) => (p.contractYears ?? 0) > 1).reduce((s, p) => s + liveCapHit(p), 0);
  const expiring = roster.filter((p) => (p.contractYears ?? 0) === 1);
  const expiringValue = expiring.reduce((s, p) => s + liveCapHit(p), 0);
  const ufaCount = expiring.filter((p) => playerCapYears(p, CURRENT_SEASON_START, 2)[1]?.status === "UFA").length;
  const rfaCount = expiring.length - ufaCount;
  const projectedSpace = cap.upper - committedNextYear;

  // Plain round-dollar thresholds, not a fitted model: negative room is a real
  // problem, under $5M is tight going into a summer of re-signings.
  const severity: TeamFinding["severity"] = projectedSpace < 0 ? "critical" : projectedSpace < 5_000_000 ? "warning" : "ok";

  return {
    id: "cap-outlook",
    label: "Výhľad na cap budúcu sezónu",
    severity,
    summary: expiring.length === 0
      ? `Budúcu sezónu vám neexpiruje žiadna zmluva. Projected cap space (pri strope ${money(cap.upper)}) je ${money(projectedSpace)}.`
      : `Do budúcej sezóny expiruje ${expiring.length} zmlúv (${ufaCount} UFA, ${rfaCount} RFA) v hodnote ${money(expiringValue)}. Bez nich je projected cap space ${money(projectedSpace)} (pri strope ${money(cap.upper)}).`,
  };
}

/** Age curve: this club's roster average age ranked against all 32 NHL clubs
 *  (oldest first) — an aging core is a risk factor a GM should see, not a
 *  verdict, so it's flagged "warning" (never "critical") when the club sits
 *  in the league's oldest third. */
async function ageCurveFinding(teamId: number): Promise<TeamFinding | null> {
  const rosters = await prisma.player.findMany({
    where: { team: { league: "NHL", isAffiliate: false }, rosterType: "NHL" },
    select: { teamId: true, age: true, team: { select: { name: true } } },
  });
  const byTeam = new Map<number, { name: string; ages: number[] }>();
  for (const p of rosters) {
    if (p.age == null) continue;
    const e = byTeam.get(p.teamId) ?? { name: p.team.name, ages: [] };
    e.ages.push(p.age);
    byTeam.set(p.teamId, e);
  }
  const rows = [...byTeam.entries()]
    .map(([id, v]) => ({ teamId: id, avg: v.ages.reduce((s, a) => s + a, 0) / v.ages.length }))
    .sort((a, b) => b.avg - a.avg); // oldest first
  const idx = rows.findIndex((r) => r.teamId === teamId);
  if (idx === -1) return null;

  const leagueSize = rows.length;
  const leagueAvg = rows.reduce((s, r) => s + r.avg, 0) / leagueSize;
  const rank = idx + 1;
  const oldestThird = rank <= Math.ceil(leagueSize / 3);

  return {
    id: "age-curve",
    label: "Vekový profil zostavy",
    severity: oldestThird ? "warning" : "ok",
    summary: `Priemerný vek rosteru je ${rows[idx].avg.toFixed(1)} rokov (ligový priemer ${leagueAvg.toFixed(1)}) — ${rank}. najstarší roster z ${leagueSize} klubov.`,
  };
}

/** Prospect pipeline: this org's Prospect-table pool (deduped against anyone
 *  already on an NHL/AHL roster anywhere, or already graduated by the
 *  games-played rule — the exact rule the Team Prospects page uses), bucketed
 *  F/D/G and compared to the league-average pool size per bucket. */
async function prospectPipelineFinding(teamId: number): Promise<TeamFinding | null> {
  const cfg = await prisma.leagueConfig.findUnique({ where: { id: 1 }, select: { rosterMode: true } });
  const source = cfg?.rosterMode === "real" ? "real" : "profinhl";

  const [teams, graduatedAnywhere] = await Promise.all([
    prisma.team.findMany({
      where: { league: "NHL", isAffiliate: false },
      select: {
        id: true,
        prospects: { where: { source }, select: { name: true, position: true } },
        players: { where: { rosterType: "NHL" }, select: { name: true } },
        affiliateTeams: { select: { players: { where: { rosterType: "AHL" }, select: { name: true } } } },
      },
    }),
    prisma.player.findMany({
      where: { OR: [{ lastSeasonGP: { gte: 10 } }, { lastSeasonAhlGP: { gte: 15 } }, { AND: [{ isGoalie: true }, { lastSeasonAhlGP: { gte: 5 } }] }] },
      select: { name: true },
    }),
  ]);
  const graduatedKeys = new Set(graduatedAnywhere.map((p) => pKey(p.name)));

  const BUCKETS = ["F", "D", "G"] as const;
  const bucketOf = (pos: string | null): (typeof BUCKETS)[number] | null => {
    if (!pos) return null;
    const p = pos.toUpperCase();
    if (isPos(p, "G")) return "G";
    if (isPos(p, "D")) return "D";
    if (isPos(p, "C") || isPos(p, "LW") || isPos(p, "RW")) return "F";
    return null;
  };

  const countsByTeam = new Map<number, Record<(typeof BUCKETS)[number], number>>();
  for (const t of teams) {
    const rosterNames = new Set([
      ...t.players.map((p) => pKey(p.name)),
      ...t.affiliateTeams.flatMap((a) => a.players.map((p) => pKey(p.name))),
    ]);
    const rec = { F: 0, D: 0, G: 0 };
    for (const pr of t.prospects) {
      const key = pKey(pr.name);
      if (rosterNames.has(key) || graduatedKeys.has(key)) continue; // already established, not a pipeline asset
      const b = bucketOf(pr.position);
      if (b) rec[b]++;
    }
    countsByTeam.set(t.id, rec);
  }

  const mine = countsByTeam.get(teamId);
  if (!mine) return null;
  const allCounts = [...countsByTeam.values()];
  const leagueAvg = { F: 0, D: 0, G: 0 };
  for (const b of BUCKETS) leagueAvg[b] = allCounts.reduce((s, c) => s + c[b], 0) / allCounts.length;

  const gaps: string[] = [];
  const strong: string[] = [];
  let severity: TeamFinding["severity"] = "ok";
  for (const b of BUCKETS) {
    const avg = leagueAvg[b];
    if (mine[b] === 0 && avg > 0.5) {
      gaps.push(`${b}: 0 (ligový priemer ${avg.toFixed(1)}) — chýba nástupca`);
      severity = "critical";
    } else if (avg > 0 && mine[b] < avg * 0.5) {
      gaps.push(`${b}: ${mine[b]} (pod ligovým priemerom ${avg.toFixed(1)})`);
      if (severity === "ok") severity = "warning";
    } else if (avg > 0 && mine[b] > avg * 1.5) {
      strong.push(`${b}: ${mine[b]} (nad priemerom ${avg.toFixed(1)})`);
    }
  }

  if (!gaps.length && !strong.length) {
    return { id: "prospect-pipeline", label: "Prospect pipeline", severity: "ok", summary: "Počet prospektov podľa F/D/G je v rámci ligového priemeru." };
  }
  const parts: string[] = [];
  if (gaps.length) parts.push(gaps.join("; "));
  if (strong.length) parts.push(`Dostatok: ${strong.join(", ")}`);
  return { id: "prospect-pipeline", label: "Prospect pipeline", severity, summary: parts.join(". ") + "." };
}

/** Roster balance: current NHL-roster player counts per C/LW/RW/D vs. the
 *  32-club average for that position — a big surplus/shortage is a trade-
 *  matching signal, not a verdict on its own. */
async function rosterBalanceFinding(teamId: number): Promise<TeamFinding | null> {
  const roster = await prisma.player.findMany({
    where: { team: { league: "NHL", isAffiliate: false }, rosterType: "NHL", isGoalie: false, scratched: false },
    select: { teamId: true, position: true },
  });
  const POS = ["C", "LW", "RW", "D"] as const;
  const counts = new Map<number, Record<(typeof POS)[number], number>>();
  for (const p of roster) {
    const rec = counts.get(p.teamId) ?? { C: 0, LW: 0, RW: 0, D: 0 };
    for (const code of POS) if (isPos(p.position ?? "", code)) rec[code]++;
    counts.set(p.teamId, rec);
  }
  const mine = counts.get(teamId);
  if (!mine) return null;
  const allCounts = [...counts.values()];
  const leagueAvg = { C: 0, LW: 0, RW: 0, D: 0 };
  for (const code of POS) leagueAvg[code] = allCounts.reduce((s, c) => s + c[code], 0) / allCounts.length;

  const shortages: string[] = [];
  const surpluses: string[] = [];
  for (const code of POS) {
    const avg = leagueAvg[code];
    if (avg <= 0) continue;
    const ratio = mine[code] / avg;
    if (ratio < 0.6) shortages.push(`${code} (${mine[code]} vs. priemer ${avg.toFixed(1)})`);
    else if (ratio > 1.5) surpluses.push(`${code} (${mine[code]} vs. priemer ${avg.toFixed(1)})`);
  }

  if (!shortages.length && !surpluses.length) {
    return { id: "roster-balance", label: "Rovnováha zostavy", severity: "ok", summary: "Počty hráčov podľa pozície sú v rámci ligového priemeru — žiadny výrazný prebytok ani nedostatok." };
  }
  const parts: string[] = [];
  if (shortages.length) parts.push(`Nedostatok: ${shortages.join(", ")}`);
  if (surpluses.length) parts.push(`Prebytok: ${surpluses.join(", ")}`);
  return { id: "roster-balance", label: "Rovnováha zostavy", severity: shortages.length ? "warning" : "ok", summary: parts.join(". ") + "." };
}

export async function teamWideFindings(teamId: number): Promise<TeamFinding[]> {
  const results = await Promise.all([
    capOutlookFinding(teamId),
    ageCurveFinding(teamId),
    prospectPipelineFinding(teamId),
    rosterBalanceFinding(teamId),
  ]);
  return results.filter((f): f is TeamFinding => f != null);
}
