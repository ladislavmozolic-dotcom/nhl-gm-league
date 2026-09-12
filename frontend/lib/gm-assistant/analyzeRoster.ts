import { loadLeagueSlots, rankSlot, SLOTS, type SlotPlayer } from "./leagueSlots";

// "Analyze my roster" — the first UNHL Intelligence function. No LLM, no black-box
// judgment: every finding below is a plain average rating — the CK/PA/SC/DF
// composite for skaters, GoalieRating.overall for goalies (OV is orientational
// only in this league, see memory: ov-vs-specific-params) — for the players
// occupying a given slot, ranked against the same slot across all 32 NHL
// clubs. See leagueSlots.ts for how a slot a club hasn't set itself gets
// filled in, and for the rating composite itself.

export interface RosterFinding {
  id: string;
  label: string;
  teamValue: number;
  leagueRank: number;
  leagueSize: number;
  severity: "ok" | "warning" | "critical";
  players: SlotPlayer[];
  // true when THIS slot's numbers came from the autoLines() fallback because
  // the club hasn't set it — a real forward-lines club can still be auto on,
  // say, PP1 if that tab was never touched.
  auto: boolean;
}

export interface RosterAnalysis {
  teamId: number;
  teamName: string;
  findings: RosterFinding[]; // worst (highest rank number) first
}

export async function analyzeRoster(teamId: number): Promise<RosterAnalysis | null> {
  const data = await loadLeagueSlots();
  const myTeam = data.teams.find((t) => t.id === teamId);
  if (!myTeam) return null;

  const findings: RosterFinding[] = [];
  for (const slot of SLOTS) {
    const rows = rankSlot(data, slot);
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
      teamValue: rows[myIdx].avg,
      leagueRank: rank,
      leagueSize,
      severity,
      players: rows[myIdx].players,
      auto: rows[myIdx].isAuto,
    });
  }

  findings.sort((a, b) => b.leagueRank - a.leagueRank);

  return { teamId, teamName: myTeam.name, findings };
}
