import { loadLeagueSlots, rankSlot, SLOTS, type SlotPlayer } from "./leagueSlots";
import { teamWideFindings, type TeamFinding } from "./teamFindings";

// "Analyze my roster" — the first UNHL Intelligence function. No LLM, no black-box
// judgment: every finding below is a role-specific Role Score (a weighted mix
// of STHS params, each converted to a C/W/D/G percentile — see leagueSlots.ts's
// ROLE_WEIGHTS for the exact per-role weight tables, per the "Analyze My
// Roster" spec doc) or a Goalie Quality Score for goalies (OV is orientational
// only in this league and never an input, see memory: ov-vs-specific-params)
// — for the players occupying a given slot, ranked against the same slot
// across all 32 NHL clubs. See leagueSlots.ts for how a slot a club hasn't
// set itself gets filled in, and for the scoring itself.

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
  // In SLOTS order, not by severity: grouped by position (LW, C, RW, D, then
  // goalies), with each position's top-line, 2nd-line and depth slot back to
  // back so its strong and weak sides sit near each other, and PP1/PP2/PK1/PK2
  // grouped together at the end. The UI's grid just flows these in order —
  // not literally 2 cards per row per position any more now that forwards
  // have 3 slots each, but still reads as one coherent group per position.
  findings: RosterFinding[];
  teamFindings: TeamFinding[]; // cap outlook, age curve, prospect pipeline, roster balance
}

export async function analyzeRoster(teamId: number): Promise<RosterAnalysis | null> {
  const [data, teamFindings] = await Promise.all([loadLeagueSlots(), teamWideFindings(teamId)]);
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

  return { teamId, teamName: myTeam.name, findings, teamFindings };
}
