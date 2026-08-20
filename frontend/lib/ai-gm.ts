// AI GM — runs the clubs that have no registered human GM (passwordHash IS NULL).
//
// Scope (deliberately limited): it manages ON-ICE matters only —
//   • picks a team tactical system (attack / defence identity) that best fits the
//     roster, and refreshes it as the roster changes;
//   • keeps a legal, healthy lineup (auto-fill from the farm, fresh injury-aware
//     auto-lines each game, rested goalie — all handled by the sim/day loop);
// It NEVER trades or signs free agents — those stay human-only.

import { prisma } from "./prisma";
import { loadSimTeam } from "./sim/index";
import { PRESETS, systemFit } from "./sim/tactics";
import { autoFillRosters, fillAhlFromScratched } from "./roster-fill";
import { teamCapStatus } from "./cap";

/** Teams with no human GM login → AI-controlled. Returns NHL clubs + AHL affiliates. */
export async function aiTeamIds(): Promise<number[]> {
  const teams = await prisma.team.findMany({
    where: { passwordHash: null },
    select: { id: true },
  });
  return teams.map((t) => t.id);
}

/** Choose the tactical preset whose roster-fit is highest for this club. */
function bestPresetFor(profile: Parameters<typeof systemFit>[0]): (typeof PRESETS)[string] {
  let best = PRESETS["Balanced"];
  let bestFit = systemFit(profile, best);
  for (const p of Object.values(PRESETS)) {
    const f = systemFit(profile, p);
    if (f > bestFit) { best = p; bestFit = f; }
  }
  return best;
}

/** Set (or refresh) one AI club's tactical system from its current roster, and
 *  clear any stale explicit lines so the sim ices fresh, injury-aware auto-lines. */
async function manageOne(teamId: number, league: "NHL" | "AHL"): Promise<string | null> {
  let team;
  try { team = await loadSimTeam(teamId, league); } catch { return null; }
  if (!team?.profile) return null;
  const preset = bestPresetFor(team.profile);
  await prisma.teamLines.upsert({
    where: { teamId },
    create: { teamId, system: preset as object },
    // clear explicit lines → sim auto-lines fresh each game (healthy, position-valid)
    update: { system: preset as object, forwardLines: [], defensePairs: [] },
  });
  return preset.preset ?? "Balanced";
}

/** Best-effort cap compliance for one club: if it's over the ceiling, send its
 *  MOVABLE surplus down (healthy two-way / ELC players, highest cap first) until
 *  compliant or nothing more can move. One-way / star contracts can't be demoted —
 *  those must be bought out or traded by a human. Returns a note if it acted. */
async function enforceCap(teamId: number): Promise<string | null> {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { code: true, name: true, affiliateTeams: { select: { id: true } } },
  });
  const affId = team?.affiliateTeams?.[0]?.id;
  if (!affId) return null;
  const status = await teamCapStatus(teamId);
  let over = status.committed - status.ceiling;
  if (over <= 0) return null;
  const movable = await prisma.player.findMany({
    where: {
      teamId, rosterType: "NHL", injuryDaysLeft: { lte: 0 },
      OR: [{ contractType: "TWO_WAY" }, { contractText: { contains: "ELC" } }],
    },
    orderBy: { capHit: "desc" },
    select: { id: true, capHit: true },
  });
  let sent = 0;
  for (const p of movable) {
    if (over <= 0) break;
    await prisma.player.update({ where: { id: p.id }, data: { teamId: affId, rosterType: "AHL" } });
    over -= p.capHit ?? 0;
    sent++;
  }
  return sent ? `${team.code ?? team.name}: sent ${sent} down for cap` : null;
}

/** The daily AI-GM pass: refresh each GM-less club's tactical system from its
 *  current roster and keep it cap-compliant. Cheap & idempotent — hooked into the
 *  sim-day loop so AI tactics + cap track the roster. Never trades or signs. */
export async function aiGmDaily(): Promise<{ managed: number; details: string[] }> {
  // NHL clubs only — the AHL farm stays legal via the day-loop fills; it doesn't
  // need its own persisted tactics (and its parent may be human-managed).
  const teams = await prisma.team.findMany({
    where: { passwordHash: null, league: "NHL", isAffiliate: false },
    select: { id: true, name: true, code: true },
  });
  const details: string[] = [];
  for (const t of teams) {
    const sys = await manageOne(t.id, "NHL");
    if (sys) details.push(`${t.code ?? t.name}: ${sys}`);
    const cap = await enforceCap(t.id);
    if (cap) details.push(cap);
  }
  // Advanced-AI clubs also negotiate incoming trade proposals from human GMs.
  try {
    const { aiGmTradesDaily } = await import("./ai-gm-trades");
    const tr = await aiGmTradesDaily();
    details.push(...tr.details);
  } catch (e) { details.push(`AI trades error: ${(e as Error).message}`); } // surface, but never block the daily run
  return { managed: teams.length, details };
}

/** Full AI-GM pass (admin action): the daily pass PLUS keeping rosters legal
 *  (promote healthy farmhands when short; activate healthy AHL scratches). */
export async function runAiGm(): Promise<{ managed: number; details: string[] }> {
  const res = await aiGmDaily();
  await autoFillRosters("NHL").catch(() => []);
  await fillAhlFromScratched().catch(() => []);
  return res;
}
