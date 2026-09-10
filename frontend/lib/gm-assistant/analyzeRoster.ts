import { prisma } from "@/lib/prisma";
import { autoLines } from "@/lib/sim/lines-core";

// "Analyze my roster" — the first GM Assistant function. No LLM, no black-box
// judgment: every finding below is a plain average of Player.overall (the same
// number every roster page already shows) for the players occupying a given
// line/pair slot, ranked against the same slot across all 32 NHL clubs. A club
// that hasn't set its own Team Lines gets a position-aware best-lineup computed
// on the fly with the same autoLines() the sim itself falls back to (see
// lib/sim/lines-core.ts) — purely in memory for this comparison, never written
// back, never shown on that club's own Lines page. Every finding still lists
// its exact players + numbers, and autoTeams flags which clubs' numbers are
// algorithmic guesses rather than a GM's real deployment.

type ForwardSide = "lw" | "c" | "rw";
type DefenseSide = "ld" | "rd";

interface SlotDef {
  id: string;
  label: string;
  kind: "forward" | "defense";
  lineIdxs: number[]; // 0-based indexes into forwardLines / defensePairs
  side: ForwardSide | DefenseSide;
}

// Top slot vs. depth slot, per side — mirrors how GMs actually talk about a
// lineup ("top-line C", "bottom-pair RD") and is exactly granular enough to
// reproduce findings like "2nd/3rd-pair RD".
const SLOTS: SlotDef[] = [
  { id: "lw-top", label: "Top-line LW", kind: "forward", lineIdxs: [0], side: "lw" },
  { id: "lw-depth", label: "Depth LW (2.–4. formácia)", kind: "forward", lineIdxs: [1, 2, 3], side: "lw" },
  { id: "c-top", label: "Top-line C", kind: "forward", lineIdxs: [0], side: "c" },
  { id: "c-depth", label: "Depth C (2.–4. formácia)", kind: "forward", lineIdxs: [1, 2, 3], side: "c" },
  { id: "rw-top", label: "Top-line RW", kind: "forward", lineIdxs: [0], side: "rw" },
  { id: "rw-depth", label: "Depth RW (2.–4. formácia)", kind: "forward", lineIdxs: [1, 2, 3], side: "rw" },
  { id: "ld-top", label: "Top-pár LD", kind: "defense", lineIdxs: [0], side: "ld" },
  { id: "ld-bottom", label: "2.–3. pár LD", kind: "defense", lineIdxs: [1, 2], side: "ld" },
  { id: "rd-top", label: "Top-pár RD", kind: "defense", lineIdxs: [0], side: "rd" },
  { id: "rd-bottom", label: "2.–3. pár RD", kind: "defense", lineIdxs: [1, 2], side: "rd" },
];

export interface SlotPlayer {
  id: number;
  name: string;
  slug: string;
  overall: number | null;
}

export interface RosterFinding {
  id: string;
  label: string;
  teamValue: number;
  leagueRank: number;
  leagueSize: number;
  severity: "ok" | "warning" | "critical";
  players: SlotPlayer[];
}

export interface RosterAnalysis {
  teamId: number;
  teamName: string;
  findings: RosterFinding[]; // worst (highest rank number) first
  // Clubs with no Team Lines of their own — their numbers above come from an
  // auto-generated best-available lineup (best player per eligible slot by
  // overall), not a GM's real deployment. Always non-empty-checked before
  // trusting a finding as "this club's real plan".
  autoTeams: string[];
  myTeamIsAuto: boolean;
}

interface ResolvedLines {
  forwardLines: { lw: number | null; c: number | null; rw: number | null }[];
  defensePairs: { ld: number | null; rd: number | null }[];
}

function slotPlayers(lines: ResolvedLines, slot: SlotDef, playerMap: Map<number, SlotPlayer>): SlotPlayer[] {
  const rows = slot.kind === "forward" ? lines.forwardLines : lines.defensePairs;
  const picked: SlotPlayer[] = [];
  for (const idx of slot.lineIdxs) {
    const row = rows[idx] as Record<string, number | null> | undefined;
    const pid = row?.[slot.side];
    if (typeof pid !== "number") continue;
    const player = playerMap.get(pid);
    if (player) picked.push(player);
  }
  return picked;
}

export async function analyzeRoster(teamId: number): Promise<RosterAnalysis | null> {
  const [teams, linesRows, roster] = await Promise.all([
    prisma.team.findMany({ where: { league: "NHL", isAffiliate: false }, select: { id: true, name: true } }),
    prisma.teamLines.findMany({
      where: { team: { league: "NHL", isAffiliate: false } },
      select: { teamId: true, forwardLines: true, defensePairs: true },
    }),
    // same roster filter teamLineBuilder/the sim use for its own auto-lines fallback
    prisma.player.findMany({
      where: { team: { league: "NHL", isAffiliate: false }, rosterType: "NHL", isGoalie: false, scratched: false },
      select: { id: true, name: true, slug: true, overall: true, position: true, shoots: true, teamId: true },
    }),
  ]);

  const myTeam = teams.find((t) => t.id === teamId);
  if (!myTeam) return null;

  const playerMap = new Map<number, SlotPlayer>(roster.map((p) => [p.id, { id: p.id, name: p.name, slug: p.slug, overall: p.overall }]));
  const linesByTeam = new Map(linesRows.map((l) => [l.teamId, l]));
  const rosterByTeam = new Map<number, typeof roster>();
  for (const p of roster) {
    const arr = rosterByTeam.get(p.teamId) ?? [];
    arr.push(p);
    rosterByTeam.set(p.teamId, arr);
  }

  const autoTeamIds = new Set<number>();
  const resolvedLines = new Map<number, ResolvedLines>();
  for (const team of teams) {
    const saved = linesByTeam.get(team.id);
    const fl = Array.isArray(saved?.forwardLines) ? (saved!.forwardLines as ResolvedLines["forwardLines"]) : [];
    const dp = Array.isArray(saved?.defensePairs) ? (saved!.defensePairs as ResolvedLines["defensePairs"]) : [];
    if (fl.length > 0 && dp.length > 0) {
      resolvedLines.set(team.id, { forwardLines: fl, defensePairs: dp });
    } else {
      const skaters = (rosterByTeam.get(team.id) ?? []).map((p) => ({
        id: p.id, position: p.position, overall: p.overall ?? 0, shoots: p.shoots,
      }));
      const built = autoLines(skaters, []);
      resolvedLines.set(team.id, { forwardLines: built.forwardLines, defensePairs: built.defensePairs });
      autoTeamIds.add(team.id);
    }
  }

  const findings: RosterFinding[] = [];
  for (const slot of SLOTS) {
    const rows = teams
      .map((team) => {
        const slotedPlayers = slotPlayers(resolvedLines.get(team.id)!, slot, playerMap);
        const rated = slotedPlayers.filter((p) => p.overall != null);
        if (!rated.length) return null;
        const avg = rated.reduce((sum, p) => sum + (p.overall as number), 0) / rated.length;
        return { teamId: team.id, avg, players: slotedPlayers };
      })
      .filter((r): r is { teamId: number; avg: number; players: SlotPlayer[] } => r != null)
      .sort((a, b) => b.avg - a.avg);

    const myIdx = rows.findIndex((r) => r.teamId === teamId);
    if (myIdx === -1) continue; // no eligible player anywhere on the roster for this slot

    const rank = myIdx + 1;
    const leagueSize = rows.length;
    const percentileFromTop = rank / leagueSize;
    const severity: RosterFinding["severity"] =
      percentileFromTop <= 1 / 3 ? "ok" : percentileFromTop <= 2 / 3 ? "warning" : "critical";

    findings.push({
      id: slot.id,
      label: slot.label,
      teamValue: Math.round(rows[myIdx].avg * 10) / 10,
      leagueRank: rank,
      leagueSize,
      severity,
      players: rows[myIdx].players,
    });
  }

  findings.sort((a, b) => b.leagueRank - a.leagueRank);

  const autoTeams = teams.filter((t) => autoTeamIds.has(t.id)).map((t) => t.name);

  return { teamId, teamName: myTeam.name, findings, autoTeams, myTeamIsAuto: autoTeamIds.has(teamId) };
}
