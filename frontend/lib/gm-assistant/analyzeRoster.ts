import { prisma } from "@/lib/prisma";

// "Analyze my roster" — the first GM Assistant function. No LLM, no black-box
// judgment: every finding below is a plain average of Player.overall (the same
// number every roster page already shows) for the players occupying a given
// line/pair slot in TeamLines, ranked against the same slot across all 32 NHL
// clubs. The UI renders the exact players + numbers behind each finding, so a
// GM can always see precisely why a slot was flagged.

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
}

function slotPlayers(
  lines: { forwardLines: unknown; defensePairs: unknown } | null,
  slot: SlotDef,
  playerMap: Map<number, SlotPlayer>
): SlotPlayer[] {
  const source = slot.kind === "forward" ? lines?.forwardLines : lines?.defensePairs;
  const rows = Array.isArray(source) ? (source as Record<string, unknown>[]) : [];
  const picked: SlotPlayer[] = [];
  for (const idx of slot.lineIdxs) {
    const row = rows[idx];
    const pid = row?.[slot.side];
    if (typeof pid !== "number") continue;
    const player = playerMap.get(pid);
    if (player) picked.push(player);
  }
  return picked;
}

export async function analyzeRoster(teamId: number): Promise<RosterAnalysis | null> {
  const [teams, players] = await Promise.all([
    prisma.team.findMany({
      where: { league: "NHL", isAffiliate: false },
      select: { id: true, name: true, lines: { select: { forwardLines: true, defensePairs: true } } },
    }),
    prisma.player.findMany({
      where: { team: { league: "NHL", isAffiliate: false } },
      select: { id: true, name: true, slug: true, overall: true },
    }),
  ]);

  const myTeam = teams.find((t) => t.id === teamId);
  if (!myTeam) return null;

  const playerMap = new Map<number, SlotPlayer>(players.map((p) => [p.id, p]));

  const findings: RosterFinding[] = [];
  for (const slot of SLOTS) {
    const rows = teams
      .map((team) => {
        const slotedPlayers = slotPlayers(team.lines, slot, playerMap);
        const rated = slotedPlayers.filter((p) => p.overall != null);
        if (!rated.length) return null;
        const avg = rated.reduce((sum, p) => sum + (p.overall as number), 0) / rated.length;
        return { teamId: team.id, avg, players: slotedPlayers };
      })
      .filter((r): r is { teamId: number; avg: number; players: SlotPlayer[] } => r != null)
      .sort((a, b) => b.avg - a.avg);

    const myIdx = rows.findIndex((r) => r.teamId === teamId);
    if (myIdx === -1) continue; // this team has no lines set for the slot yet

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

  return { teamId, teamName: myTeam.name, findings };
}
