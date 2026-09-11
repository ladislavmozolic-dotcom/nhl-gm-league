import { loadLeagueSlots, rankSlot, SLOTS, type SlotPlayer } from "./leagueSlots";

// "Analyze my roster" — the first GM Assistant function. No LLM, no black-box
// judgment: every finding below is a plain average of Player.overall (the same
// number every roster page already shows) for the players occupying a given
// line/pair slot, ranked against the same slot across all 32 NHL clubs. See
// leagueSlots.ts for how a club with no Team Lines of its own is filled in.

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
    });
  }

  findings.sort((a, b) => b.leagueRank - a.leagueRank);

  const autoTeams = data.teams.filter((t) => data.autoTeamIds.has(t.id)).map((t) => t.name);

  return { teamId, teamName: myTeam.name, findings, autoTeams, myTeamIsAuto: data.autoTeamIds.has(teamId) };
}
