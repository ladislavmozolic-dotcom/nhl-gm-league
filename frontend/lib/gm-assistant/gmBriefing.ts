import { prisma } from "@/lib/prisma";
import { getLeagueClock } from "@/lib/calendar-server";
import { CONTENTION_LABELS, type Contention } from "@/lib/free-agency";
import { loadLeagueCap, teamContentionMap } from "@/lib/free-agency-server";
import { seasonForPhase } from "@/lib/phase";
import { analyzeRoster, type RosterAnalysis, type RosterFinding } from "./analyzeRoster";
import { liveCapHit } from "@/lib/finance";
import { activeWaivers, waiverPriorityOrder } from "@/lib/waivers-server";
import { fillsNeed, tradeBlockBoard } from "@/lib/trade-block-server";
import { loadSettings } from "@/lib/sim/settings";
import type { Phase } from "@/lib/calendar";

// The GM Assistant is deliberately a briefing, not an auto-GM. It combines
// explainable signals that already exist in UNHL Intelligence into a short,
// prioritized next-step list. "Trade target" never means another GM will sell:
// it only opens the existing depth comparison / open-market research tools.

export type BriefingAction = {
  label: string;
  href: string;
  tone?: "blue" | "emerald" | "amber";
};

export type BriefingItem = {
  id: string;
  priority: "now" | "next" | "watch";
  title: string;
  detail: string;
  actions: BriefingAction[];
};

export type GmBriefing = {
  teamName: string;
  contention: Contention;
  contentionLabel: string;
  record: { gp: number; points: number; pointsPct: number } | null;
  form: { lastGames: number; points: number; streak: number } | null;
  items: BriefingItem[];
  radar: {
    positions: string[];
    tradeBlock: RadarPlayer[];
    waiversEnabled: boolean;
    waiverPriority: number | null;
    waivers: WaiverRadarPlayer[];
  };
};

// These are live market listings, not an AI prediction that a club will accept
// a trade or that a waiver claim is affordable. The UI deliberately says what
// created each match: a declared team need and/or a weak role-score slot.
export type RadarPlayer = {
  id: number; name: string; slug: string | null; position: string; age: number | null;
  capHit: number | null; overall: number | null; teamName: string; teamCode: string | null;
  note: string | null; farm: boolean;
};

export type WaiverRadarPlayer = RadarPlayer & { placedAt: Date; claimCount: number };

type GameResult = { won: boolean; otLoss: boolean };

function positionForFinding(f: RosterFinding): "C" | "LW" | "RW" | "D" | "G" | null {
  if (f.id.startsWith("c-")) return "C";
  if (f.id.startsWith("lw-")) return "LW";
  if (f.id.startsWith("rw-")) return "RW";
  if (f.id.startsWith("ld-") || f.id.startsWith("rd-")) return "D";
  if (f.id.startsWith("goalie-")) return "G";
  return null;
}

function marketActions(f: RosterFinding): BriefingAction[] {
  const position = positionForFinding(f);
  const actions: BriefingAction[] = [
    { label: "Compare club depth", href: `/tools/assistant/find-trade-partner?slot=${f.id}` },
  ];
  if (position) actions.push({ label: "Explore the UFA market", href: `/tools/assistant/find-player?pos=${position}&rosterType=UFA`, tone: "emerald" });
  return actions;
}

async function recentForm(teamId: number, season: string): Promise<{ results: GameResult[]; streak: number }> {
  const games = await prisma.game.findMany({
    where: { season, league: "NHL", status: "FINAL", seriesId: null, OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }] },
    select: { id: true, gameDate: true, homeTeamId: true, winnerTeamId: true, endedIn: true },
    orderBy: [{ gameDate: "desc" }, { id: "desc" }],
    take: 10,
  });
  const results = games.map((g) => ({
    won: g.winnerTeamId === teamId,
    otLoss: g.winnerTeamId !== teamId && g.endedIn !== "REG",
  }));
  if (!results.length) return { results, streak: 0 };
  const firstWon = results[0].won;
  let streak = 0;
  for (const result of results) {
    if (result.won !== firstWon) break;
    streak += firstWon ? 1 : -1;
  }
  return { results, streak };
}

async function capSpace(teamId: number): Promise<number | null> {
  const [cap, players] = await Promise.all([
    loadLeagueCap(),
    prisma.player.findMany({ where: { teamId, rosterType: "NHL" }, select: { capHit: true, realCapHit: true, retainedSalary: true } }),
  ]);
  if (!players.length) return null;
  return cap.upper - players.reduce((sum, player) => sum + liveCapHit(player), 0);
}

async function marketRadar(teamId: number, analysis: RosterAnalysis, phase: Phase): Promise<GmBriefing["radar"]> {
  const weakPositions = analysis.findings
    .filter((f) => f.severity === "critical" || f.severity === "warning")
    .map(positionForFinding)
    .filter((p): p is NonNullable<typeof p> => p != null);
  const [team, board, waivers, settings, priority] = await Promise.all([
    prisma.team.findUnique({ where: { id: teamId }, select: { needs: true } }),
    tradeBlockBoard(), activeWaivers(), loadSettings(), waiverPriorityOrder(phase),
  ]);
  // A GM's manually declared needs take precedence in presentation; role-score
  // gaps supplement them so an empty Trade Block setup never means an empty radar.
  const positions = [...new Set([...(team?.needs ?? []), ...weakPositions])];
  const wants = (position: string) => positions.some((need) => fillsNeed(position, need));
  const toRadar = (p: { id: number; name: string; slug: string | null; position: string; age: number | null; capHit: number | null; overall: number | null; teamName: string; teamCode: string | null; note: string | null; farm: boolean }): RadarPlayer => p;
  const tradeBlock = board
    .filter((club) => club.teamId !== teamId)
    .flatMap((club) => club.players)
    .filter((p) => wants(p.position))
    // NHL listings first, then the same transparent OVR order used by Trade Block.
    .sort((a, b) => Number(a.farm) - Number(b.farm) || (b.overall ?? 0) - (a.overall ?? 0))
    .slice(0, 6)
    .map(toRadar);
  const waiverPriority = priority.find((row) => row.teamId === teamId)?.rank ?? null;
  const waiverRows = settings.waiversEnabled
    ? waivers
      .filter((w) => w.fromTeamId !== teamId && wants(w.position))
      .sort((a, b) => b.placedAt.getTime() - a.placedAt.getTime())
      .slice(0, 6)
      .map((w): WaiverRadarPlayer => ({
        id: w.playerId, name: w.playerName, slug: w.playerSlug, position: w.position, age: w.age ?? null,
        capHit: w.capHit, overall: w.overall ?? null, teamName: w.fromName ?? w.fromCode,
        teamCode: w.fromCode, note: null, farm: false, placedAt: w.placedAt, claimCount: w.claims.length,
      }))
    : [];
  return { positions, tradeBlock, waiversEnabled: settings.waiversEnabled, waiverPriority, waivers: waiverRows };
}

function strategyItem(contention: Contention, analysis: RosterAnalysis): BriefingItem {
  const strengths = analysis.findings.filter((f) => f.severity === "ok").slice(0, 2).map((f) => f.label);
  const strengthNote = strengths.length ? ` Strengths: ${strengths.join(", ")}.` : "";
  if (contention === "contender") return {
    id: "strategy", priority: "next", title: "Mode: go for the result",
    detail: `The team is classed as a contender. When adding players, prefer an immediate gain at the weakest slot over stacking depth.${strengthNote}`,
    actions: [{ label: "Dry-run a move", href: "/tools/assistant/scenario" }],
  };
  if (contention === "rebuild") return {
    id: "strategy", priority: "next", title: "Mode: building the core",
    detail: `The team is classed as a rebuild. Protect draft capital and cap flexibility; before trading a veteran, check whether it opens room for a younger player.${strengthNote}`,
    actions: [{ label: "Open the draft", href: "/draft" }],
  };
  if (contention === "rising") return {
    id: "strategy", priority: "next", title: "Mode: growth without shortcuts",
    detail: `The team is classed as rising. Only strengthen spots that hold the core back; do not sacrifice future assets for a small short-term gain.${strengthNote}`,
    actions: [{ label: "Dry-run a move", href: "/tools/assistant/scenario" }],
  };
  return {
    id: "strategy", priority: "watch", title: "Mode: assess the direction",
    detail: `The team is in the middle zone. Before a bigger trade, wait for a clear trend in the standings and only address the obvious weak spot.${strengthNote}`,
    actions: [{ label: "Open the standings", href: "/standings" }],
  };
}

export async function loadGmBriefing(teamId: number, existingAnalysis?: RosterAnalysis | null): Promise<GmBriefing | null> {
  const [analysis, clock, contentionMap, space] = await Promise.all([
    existingAnalysis === undefined ? analyzeRoster(teamId) : Promise.resolve(existingAnalysis),
    getLeagueClock(), teamContentionMap(), capSpace(teamId),
  ]);
  if (!analysis) return null;
  const season = seasonForPhase(clock.phase);
  const [form, games, radar] = await Promise.all([
    recentForm(teamId, season),
    prisma.game.findMany({
      where: { season, league: "NHL", status: "FINAL", seriesId: null, OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }] },
      select: { winnerTeamId: true, endedIn: true },
    }),
    marketRadar(teamId, analysis, clock.phase),
  ]);
  const points = games.reduce((sum, game) => sum + (game.winnerTeamId === teamId ? 2 : game.endedIn === "REG" ? 0 : 1), 0);
  const contention = contentionMap.get(teamId) ?? "middle";
  const items: BriefingItem[] = [];
  const weaknesses = analysis.findings.filter((f) => f.severity === "critical").slice(0, 2);
  for (const weakness of weaknesses) {
    items.push({
      id: `gap-${weakness.id}`, priority: "now", title: `Priority: ${weakness.label}`,
      detail: `Role Score ${weakness.teamValue}, i.e. #${weakness.leagueRank} of ${weakness.leagueSize}. This is a comparison with the same slot across the league, not an estimate of another GM's willingness to trade.`,
      actions: marketActions(weakness),
    });
  }
  if (form.streak <= -3) {
    items.push({
      id: "cold-streak", priority: "now", title: `${Math.abs(form.streak)} straight losses — diagnose first`,
      detail: `Last ${form.results.length} games: ${form.results.reduce((sum, r) => sum + (r.won ? 2 : r.otLoss ? 1 : 0), 0)} points. Do not automatically treat a losing streak as a signal to trade; first compare the last game's performance with the season average and check lineup fit.`,
      actions: [{ label: "Line Fit Finder", href: "/tools/line-fit" }, { label: "Latest results", href: "/scores", tone: "amber" }],
    });
  } else if (form.streak >= 4) {
    items.push({
      id: "hot-streak", priority: "watch", title: `${form.streak} straight wins — check sustainability`,
      detail: `The streak is a positive signal, but base a decision on aggressive reinforcement on weak slots and the full-season standing, not only on short-term form.`,
      actions: [{ label: "Open the standings", href: "/standings" }],
    });
  }
  if (space != null && space < 2_000_000) {
    items.push({
      id: "cap", priority: "next", title: "Tight cap room",
      detail: `Current room under the cap is $${Math.round(space / 100_000) / 10}M. Test every addition in the Scenario Engine first so it does not collide with future commitments.`,
      actions: [{ label: "Scenario Engine", href: "/tools/assistant/scenario" }],
    });
  }
  items.push(strategyItem(contention, analysis));
  if (!items.some((item) => item.id.startsWith("gap-"))) {
    const watch = analysis.findings.find((f) => f.severity === "warning");
    if (watch) items.push({ id: `watch-${watch.id}`, priority: "watch", title: `Watch: ${watch.label}`, detail: `Role Score ${watch.teamValue}; #${watch.leagueRank} of ${watch.leagueSize}. Not an emergency purchase, but a clear point for ongoing scouting.`, actions: marketActions(watch) });
  }
  return {
    teamName: analysis.teamName,
    contention,
    contentionLabel: CONTENTION_LABELS[contention],
    record: games.length ? { gp: games.length, points, pointsPct: points / (games.length * 2) } : null,
    form: form.results.length ? { lastGames: form.results.length, points: form.results.reduce((sum, r) => sum + (r.won ? 2 : r.otLoss ? 1 : 0), 0), streak: form.streak } : null,
    items: items.slice(0, 5),
    radar,
  };
}
