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
