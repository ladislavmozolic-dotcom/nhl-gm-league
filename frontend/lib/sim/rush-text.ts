// Broadcast wording for transition rushes (V3). One place so the saved play-by-play and the live feed read alike.
// Pure and client-safe.

export type RushMeta = {
  kind?: "BREAKAWAY" | "2ON1" | "3ON2";
  why?: "strip" | "entry" | "pass" | "save" | "clear";
  outcome?: "shot" | "backchecked" | "hooked" | "pass-broken";
  giver?: string; lead?: string; support?: string[]; by?: string;
};

export const RUSH_LABEL: Record<string, string> = { BREAKAWAY: "breakaway", "2ON1": "2-on-1", "3ON2": "3-on-2" };

const WHAT: Record<string, string> = {
  strip: "is stripped in the neutral zone",
  entry: "turns it over at the blue line",
  pass: "has the pass picked off",
  save: "can't keep the puck alive after the save",
  clear: "gets the rebound cleared out",
};

/** "X turns it over at the blue line — Y is in all alone on a breakaway!" */
export function rushStartText(m: RushMeta, leadName: string, giverName?: string): string {
  const who = giverName ?? m.giver;
  const cause = who ? `${who} ${WHAT[m.why ?? "strip"] ?? "gives it up"}` : "The puck is turned over";
  const sup = (m.support ?? []).slice(0, 2);
  switch (m.kind) {
    case "BREAKAWAY": return `${cause} — ${leadName} is in all alone on a breakaway!`;
    case "2ON1": return `${cause} — it's a 2-on-1 the other way, ${leadName}${sup[0] ? ` and ${sup[0]}` : ""} against one defender!`;
    case "3ON2": return `${cause} — three-on-two: ${leadName} leads the rush${sup.length ? ` with ${sup.join(" and ")}` : ""}.`;
    default: return `${cause} — ${leadName} races up the ice.`;
  }
}

export type WhistleReason = "offside" | "puck-out" | "tie-up" | "hand-pass" | "high-stick";
export type WhistleMeta = { reason?: WhistleReason };

/** Broadcast line for a named whistle. `name` = the player at the centre of it, `other` = the opponent in a tie-up. */
export function whistleText(m: WhistleMeta, name: string, teamCode?: string | null, other?: string | null): string {
  const t = teamCode ? ` (${teamCode})` : "";
  switch (m.reason) {
    case "offside": return `Offside — ${name}${t} was in the zone ahead of the puck. Draw in the neutral zone.`;
    case "puck-out": return `Puck out of play off ${name}${t} — whistle.`;
    case "tie-up": return `Whistle — ${name}${t} is tied up along the boards${other ? ` by ${other}` : ""}.`;
    case "hand-pass": return `Hand pass by ${name}${t} — play is stopped.`;
    case "high-stick": return `High stick by ${name}${t} — the puck is whistled dead.`;
    default: return `Whistle — play is stopped.`;
  }
}

/** A delay-of-game call is almost always a defenseman sending the puck over the glass. */
export const overGlassText = (name: string, minutes: number, severity: string) => `${name} sends the puck over the glass — delay of game (${minutes} min, ${severity}).`;

/** The line that closes the rush when it ends without a shot (null when it ends in a shot — those are narrated as shots). */
export function rushEndText(m: RushMeta, leadName: string): string | null {
  switch (m.outcome) {
    case "backchecked": return `${m.by ?? "A defender"} races back and breaks up the ${RUSH_LABEL[m.kind ?? ""] ?? "rush"} — ${leadName} never gets the shot off.`;
    case "hooked": return `${m.by ?? "A defender"} hauls ${leadName} down from behind to stop the ${RUSH_LABEL[m.kind ?? ""] ?? "rush"}!`;
    case "pass-broken": return `${m.by ?? "The defender"} gets a stick on the pass and kills the ${RUSH_LABEL[m.kind ?? ""] ?? "rush"}.`;
    default: return null;
  }
}

/** "BOS has BUF pinned in its own end for 45 seconds — the BUF defenders are gassed and can't change." */
export function pressureText(m: { seconds?: number; against?: string; tired?: boolean }, atk?: string | null): string {
  const d = m.against ?? "the defenders";
  return `${atk ?? "The attackers"} ${atk ? "has" : "have"} ${d} pinned in ${m.against ? "its" : "their"} own end for ${m.seconds ?? 20} seconds${m.tired ? ` — the ${d} defenders are gassed and can't change.` : "."}`;
}

/** The race for a dumped-in puck. `name` is whoever got there (a skater, or the goalie when `goalie`). */
export function puckRaceText(m: { won?: "att" | "def"; goalie?: boolean; next?: string }, name: string, dumper?: string): string {
  if (m.won === "att") return `${name} wins the race to the dumped-in puck and keeps the forecheck alive.`;
  if (m.goalie) return `${name} comes out to play the dump-in behind the net and ${m.next ? `hands it to ${m.next}` : "starts the breakout"}.`;
  return `${name} gets to the dump-in${dumper ? ` from ${dumper}` : ""} first and the breakout starts.`;
}

/** "End of the 1st period — COL 2, BOS 1 · shots 12–9 · hits 8–11." (falls back to the plain line without a recap) */
export function periodEndText(label: string, m?: { homeCode?: string; awayCode?: string; score?: { home: number; away: number }; shots?: { home: number; away: number }; hits?: { home: number; away: number } } | null): string {
  if (!m || !m.score || !m.homeCode) return `End of the ${label}.`;
  const sc = m.score.home === m.score.away ? `tied ${m.score.home}–${m.score.away}` : m.score.home > m.score.away ? `${m.homeCode} ${m.score.home}, ${m.awayCode} ${m.score.away}` : `${m.awayCode} ${m.score.away}, ${m.homeCode} ${m.score.home}`;
  return `End of the ${label} — ${sc}${m.shots ? ` · shots ${m.awayCode} ${m.shots.away}–${m.shots.home} ${m.homeCode}` : ""}${m.hits ? ` · hits ${m.awayCode} ${m.hits.away}–${m.hits.home} ${m.homeCode}` : ""}.`;
}

/** "COL power play is over — 1:45, 3 shots, no goal." (the plain line when there is no recap) */
export function ppEndText(who: string, m?: { seconds?: number; shots?: number; goals?: number } | null): string {
  if (!m || m.seconds == null) return `${who} power play is over.`;
  const t = `${Math.floor(m.seconds / 60)}:${String(Math.floor(m.seconds % 60)).padStart(2, "0")}`;
  const shots = `${m.shots ?? 0} shot${m.shots === 1 ? "" : "s"}`;
  const goal = (m.goals ?? 0) > 0 ? `${m.goals} goal${m.goals === 1 ? "" : "s"}` : "no goal";
  return `${who} power play is over — ${t}, ${shots}, ${goal}.`;
}

export function longShiftText(m: { seconds?: number; unit?: string; names?: string[] }, team?: string | null): string {
  const who = m.names?.length ? `${m.names.join(", ")}` : `${team ?? "The"} ${m.unit ?? "unit"}`;
  const t = m.seconds ?? 75;
  return `${team ? `${team}: ` : ""}${who} ${m.names?.length ? "have" : "has"} been out for ${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")} — legs are getting heavy.`;
}
