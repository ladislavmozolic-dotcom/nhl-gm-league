import { prisma } from "@/lib/prisma";
import { leagueCapCompliance } from "@/lib/cap";
import { ROSTER_LIMITS } from "@/lib/roster-rules";
import { compositeRating } from "./leagueSlots";

// UNHL Intelligence — Commissioner Intelligence (roadmap Phase 7, admin-only —
// see memory: gm-assistant-intelligence). Same non-negotiable rule as every
// other UNHL Intelligence tool: no verdict, no auto-fix — every finding below
// is a plain, decomposable leaguewide scan a commissioner can act on manually.
// Read-only/advisory: nothing here ever writes to a Player/Team row. Every
// view of this page is audit-logged (CommishIntelAudit) per the design doc.

export interface FindingRow {
  teamId?: number;
  teamName?: string;
  playerId?: number;
  playerName?: string;
  detail: string;
}

export interface CommissionerFinding {
  id: string;
  label: string;
  severity: "ok" | "warning" | "critical";
  summary: string;
  rows: FindingRow[];
}

export interface CommissionerIntel {
  findings: CommissionerFinding[];
}

const sev = (n: number, warnAt = 1, critAt = 4): CommissionerFinding["severity"] => (n === 0 ? "ok" : n < critAt ? "warning" : "critical");

// ---- 1. Cap violations — reuses the same leagueCapCompliance() the Commissioner
// Dashboard and opening-day check already use, judged against the CURRENT phase. ----
async function capViolationsFinding(): Promise<CommissionerFinding> {
  const offenders = await leagueCapCompliance();
  const rows: FindingRow[] = offenders.map((o) => ({
    teamId: o.teamId, teamName: o.name,
    detail: o.over > 0 ? `$${(o.over / 1_000_000).toFixed(2)}M nad stropom` : `$${(o.underFloor / 1_000_000).toFixed(2)}M pod podlahou`,
  }));
  return {
    id: "cap-violations", label: "Porušenia salary capu", severity: sev(rows.length, 1, 3),
    summary: rows.length === 0 ? "Žiadny klub momentálne neporušuje strop ani podlahu capu." : `${rows.length} klub(y) momentálne mimo capu.`,
    rows,
  };
}

// ---- 2. Roster-size legality — the same ROSTER_LIMITS the roster-mover enforces
// AT THE POINT of a move, re-checked leaguewide against today's actual counts —
// catches drift from any path that doesn't go through that mover (import,
// trade, signing). This league has no separate "IR" roster slot (LTIR is cap
// relief only, see lib/finance.ts onLtir) — the closest real equivalent to
// "illegal IR roster spots" here is a club whose NHL/AHL/org counts are
// currently over the limits the app itself defines. ----
async function rosterSizeFinding(): Promise<CommissionerFinding> {
  const nhlTeams = await prisma.team.findMany({ where: { league: "NHL", isAffiliate: false }, select: { id: true, name: true } });
  // NOTE: Team.isAffiliate is not actually set on any AHL club in this data
  // model (verified — 0 of 32 rows have it true) — the real signal an
  // existing-code convention already relies on (app/teams/[slug]/page.tsx's
  // affiliateTeams relation) is league:"AHL" + parentTeamId, not this flag.
  const affiliates = await prisma.team.findMany({ where: { league: "AHL", parentTeamId: { in: nhlTeams.map((t) => t.id) } }, select: { id: true, name: true, parentTeamId: true } });
  const affiliateByParent = new Map(affiliates.map((a) => [a.parentTeamId!, a]));

  const orgTeamIds = [...nhlTeams.map((t) => t.id), ...affiliates.map((a) => a.id)];
  const players = await prisma.player.findMany({
    where: { teamId: { in: orgTeamIds }, rosterType: { in: ["NHL", "AHL"] } },
    select: { teamId: true, rosterType: true, scratched: true, isGoalie: true },
  });
  const byTeam = new Map<number, typeof players>();
  for (const p of players) { const arr = byTeam.get(p.teamId) ?? []; arr.push(p); byTeam.set(p.teamId, arr); }

  const rows: FindingRow[] = [];
  for (const t of nhlTeams) {
    const affiliate = affiliateByParent.get(t.id);
    const pro = byTeam.get(t.id) ?? [];
    const farm = affiliate ? (byTeam.get(affiliate.id) ?? []) : [];
    const proCount = pro.length;
    const farmActiveCount = farm.filter((p) => !p.scratched).length;
    const orgCount = proCount + farm.length;
    const orgGoalies = pro.filter((p) => p.isGoalie).length + farm.filter((p) => p.isGoalie).length;

    const problems: string[] = [];
    if (proCount > ROSTER_LIMITS.proMax) problems.push(`NHL roster ${proCount}/${ROSTER_LIMITS.proMax}`);
    if (farmActiveCount > ROSTER_LIMITS.ahlMax) problems.push(`AHL aktívny roster ${farmActiveCount}/${ROSTER_LIMITS.ahlMax}`);
    if (orgCount > ROSTER_LIMITS.orgMax) problems.push(`organizácia ${orgCount}/${ROSTER_LIMITS.orgMax}`);
    if (orgGoalies > ROSTER_LIMITS.orgMaxGoalies) problems.push(`brankári ${orgGoalies}/${ROSTER_LIMITS.orgMaxGoalies}`);
    if (problems.length) rows.push({ teamId: t.id, teamName: t.name, detail: problems.join(", ") });
  }

  return {
    id: "roster-size", label: "Legálnosť veľkosti rosteru", severity: sev(rows.length, 1, 4),
    summary: rows.length === 0 ? "Všetky kluby sú v rámci limitov NHL/AHL/organizácie." : `${rows.length} klub(y) prekračujú limit rosteru.`,
    rows,
  };
}

// ---- 3. Contract outlier detection — leaguewide, separately for skaters and
// goalies (different rating scales): percentile rank by live cap hit vs.
// percentile rank by the SAME rating the rest of UNHL Intelligence ranks on
// (CK/PA/SC/DF composite for skaters, GoalieRating.overall for goalies) — a
// large gap means "paid like a top-of-league player, rated like a middling
// one," decomposed into both percentiles, never a single "overpaid" verdict. ----
const GAP_THRESHOLD = 25; // percentage points — plainly stated, not fitted

function percentileRanks<T>(items: T[], valueOf: (t: T) => number): number[] {
  const sortedIdx = items.map((_, i) => i).sort((a, b) => valueOf(items[a]) - valueOf(items[b]));
  const rank = new Array(items.length);
  sortedIdx.forEach((origIdx, pos) => { rank[origIdx] = items.length > 1 ? (pos / (items.length - 1)) * 100 : 100; });
  return rank;
}

async function contractOutlierFinding(): Promise<CommissionerFinding> {
  const [skaters, goalies] = await Promise.all([
    prisma.player.findMany({ where: { rosterType: "NHL", isGoalie: false }, select: { id: true, name: true, teamId: true, team: { select: { name: true } }, capHit: true, contractYears: true, ck: true, pa: true, sc: true, df: true, sk: true, ph: true } }),
    prisma.player.findMany({ where: { rosterType: "NHL", isGoalie: true }, select: { id: true, name: true, teamId: true, team: { select: { name: true } }, capHit: true, contractYears: true, goalieRating: { select: { overall: true } } } }),
  ]);

  const rows: FindingRow[] = [];
  const scan = (pool: { id: number; name: string; team: { name: string } | null; capHit: number | null; contractYears: number | null; rating: number | null }[]) => {
    const eligible = pool.filter((p) => (p.contractYears ?? 0) > 0 && p.capHit != null && p.rating != null);
    if (eligible.length < 12) return; // too small a pool for a percentile to mean anything
    const capRanks = percentileRanks(eligible, (p) => p.capHit!);
    const ratingRanks = percentileRanks(eligible, (p) => p.rating!);
    eligible.forEach((p, i) => {
      const gap = capRanks[i] - ratingRanks[i];
      if (gap >= GAP_THRESHOLD) {
        rows.push({
          playerId: p.id, playerName: p.name, teamId: undefined, teamName: p.team?.name,
          detail: `cap hit ${Math.round(capRanks[i])}. percentil, rating ${Math.round(ratingRanks[i])}. percentil (rozdiel ${Math.round(gap)} b.)`,
        });
      }
    });
  };
  scan(skaters.map((p) => ({ ...p, rating: compositeRating(p) })));
  scan(goalies.map((p) => ({ ...p, rating: p.goalieRating?.overall ?? null })));
  rows.sort((a, b) => (b.detail > a.detail ? 1 : -1));

  return {
    id: "contract-outliers", label: "Kontraktné výkyvy (rating vs. cap hit)", severity: sev(rows.length, 1, 10),
    summary: rows.length === 0 ? `Žiadny hráč nemá rozdiel cap-hit/rating percentilu ≥ ${GAP_THRESHOLD} b.` : `${rows.length} hráč(ov) je platených výrazne nad úrovňou svojho ratingu.`,
    rows: rows.slice(0, 30),
  };
}

// ---- 4. Data-consistency scans: duplicates, NHL/AHL conflicts, missing fields ----
async function duplicatePlayersFinding(): Promise<CommissionerFinding> {
  const dupes = await prisma.player.groupBy({ by: ["nhlId"], where: { nhlId: { not: null } }, _count: { nhlId: true }, having: { nhlId: { _count: { gt: 1 } } } });
  const rows: FindingRow[] = [];
  for (const d of dupes) {
    const players = await prisma.player.findMany({ where: { nhlId: d.nhlId }, select: { id: true, name: true, team: { select: { name: true } } } });
    rows.push({ detail: `nhlId ${d.nhlId}: ${players.map((p) => `${p.name} (${p.team?.name ?? "?"}, #${p.id})`).join(" a ")}` });
  }
  return {
    id: "duplicate-players", label: "Duplicitní hráči (rovnaké nhlId)", severity: sev(rows.length, 1, 3),
    summary: rows.length === 0 ? "Žiadne dve Player záznamy nezdieľajú rovnaké nhlId." : `${rows.length} nhlId má viac ako jeden záznam hráča.`,
    rows,
  };
}

async function nhlAhlConflictFinding(): Promise<CommissionerFinding> {
  // Team.league (NHL/AHL) is the real signal here, not Team.isAffiliate — see
  // the note in rosterSizeFinding above (that flag is unset on every AHL club
  // in this data model, so checking it produced a false positive on every
  // single AHL-rostered player when this was first written and verified).
  const players = await prisma.player.findMany({
    where: { rosterType: { in: ["NHL", "AHL"] } },
    select: { id: true, name: true, rosterType: true, team: { select: { id: true, name: true, league: true } } },
  });
  const rows: FindingRow[] = [];
  for (const p of players) {
    if (!p.team) { rows.push({ playerId: p.id, playerName: p.name, detail: `rosterType ${p.rosterType}, ale bez priradeného tímu` }); continue; }
    if (p.rosterType === "NHL" && p.team.league !== "NHL") {
      rows.push({ playerId: p.id, playerName: p.name, teamId: p.team.id, teamName: p.team.name, detail: `rosterType NHL, ale tím "${p.team.name}" je AHL/farm` });
    }
    if (p.rosterType === "AHL" && p.team.league !== "AHL") {
      rows.push({ playerId: p.id, playerName: p.name, teamId: p.team.id, teamName: p.team.name, detail: `rosterType AHL, ale tím "${p.team.name}" nie je farm klub` });
    }
  }
  return {
    id: "nhl-ahl-conflicts", label: "NHL/AHL nezrovnalosti", severity: sev(rows.length, 1, 5),
    summary: rows.length === 0 ? "rosterType každého hráča sedí s ligou jeho tímu." : `${rows.length} hráč(ov) má rosterType nesedící s tímom, na ktorom sedí.`,
    rows: rows.slice(0, 40),
  };
}

async function missingFieldsFinding(): Promise<CommissionerFinding> {
  const skaters = await prisma.player.findMany({
    where: { rosterType: "NHL", isGoalie: false },
    select: { id: true, name: true, team: { select: { name: true } }, capHit: true, age: true, birthDate: true, position: true },
  });
  const goalies = await prisma.player.findMany({
    where: { rosterType: { in: ["NHL", "AHL"] }, isGoalie: true },
    select: { id: true, name: true, team: { select: { name: true } }, goalieRating: { select: { id: true } } },
  });
  const rows: FindingRow[] = [];
  for (const p of skaters) {
    const missing = [!p.capHit ? "cap hit" : null, p.age == null ? "vek" : null, !p.birthDate ? "dátum narodenia" : null, !p.position ? "pozícia" : null].filter((x): x is string => x != null);
    if (missing.length) rows.push({ playerId: p.id, playerName: p.name, teamName: p.team?.name, detail: `chýba: ${missing.join(", ")}` });
  }
  for (const g of goalies) {
    if (!g.goalieRating) rows.push({ playerId: g.id, playerName: g.name, teamName: g.team?.name, detail: "chýba GoalieRating" });
  }
  return {
    id: "missing-fields", label: "Chýbajúce polia na rostrovaných hráčoch", severity: sev(rows.length, 1, 10),
    summary: rows.length === 0 ? "Žiadny rostrovaný hráč nemá chýbajúce kľúčové pole." : `${rows.length} hráč(ov) má chýbajúce kľúčové pole.`,
    rows: rows.slice(0, 40),
  };
}

export async function loadCommissionerIntel(): Promise<CommissionerIntel> {
  const findings = await Promise.all([
    capViolationsFinding(),
    rosterSizeFinding(),
    contractOutlierFinding(),
    duplicatePlayersFinding(),
    nhlAhlConflictFinding(),
    missingFieldsFinding(),
  ]);
  return { findings };
}

export function summarizeForAudit(intel: CommissionerIntel): string {
  const flagged = intel.findings.filter((f) => f.rows.length > 0);
  if (!flagged.length) return "Žiadne nálezy — všetky kontroly čisté.";
  return flagged.map((f) => `${f.label}: ${f.rows.length}`).join("; ");
}
