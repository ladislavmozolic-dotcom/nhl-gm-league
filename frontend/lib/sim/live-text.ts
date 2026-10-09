// Turns the engine's event stream into broadcast lines for the live page. Pure and client-safe
// (no engine imports) — wording mirrors lib/sim/playbyplay.ts so live and the final report read alike.

import type { SimEvent } from "./events";

export type LiveLine = { seq: number; period: number; seconds: number; teamId?: number; /** set when this line means a skater has left the game */ outPlayerId?: number; /** replaces the period/clock label (e.g. "SO") */ tag?: string; kind: "goal" | "penalty" | "save" | "note" | "period"; major: boolean; text: string };

export const fmtClock = (s: number) => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, "0")}`;
export const periodLabel = (p: number) => (p <= 3 ? `${p}${["st", "nd", "rd"][p - 1]}` : p === 4 ? "OT" : `${p - 3}OT`);

type Meta = Record<string, unknown> | undefined;
const m = <T,>(e: SimEvent) => e.meta as (Meta & T) | undefined;

/** One broadcast line for an event, or null when it isn't worth a line (bare SHOT, minor noise). */
export function describeLiveEvent(e: SimEvent): LiveLine | null {
  const base = { seq: e.seq, period: e.period, seconds: e.seconds, teamId: e.teamId };
  const who = e.teamCode ?? "The team";
  switch (e.type) {
    case "GOAL": {
      if (m<{ so?: boolean }>(e)?.so) return null;
      const mm = m<{ emptyNet?: boolean; assistNames?: string[] }>(e);
      const tag = mm?.emptyNet ? " (EN)" : e.strength && e.strength !== "EV" ? ` (${e.strength})` : "";
      const a = mm?.assistNames ?? [];
      return { ...base, kind: "goal", major: true, text: `GOAL${tag} — ${e.playerName ?? "?"}${a.length ? `, assisted by ${a.join(" and ")}` : ", unassisted"}.` };
    }
    case "SAVE": return { ...base, kind: "save", major: false, text: `Shot by ${e.targetName ?? "?"} — saved by ${e.playerName ?? "the goalie"}.` };
    case "PENALTY": {
      const mm = m<{ penalty?: string; minutes?: number; severity?: string; washedOut?: boolean }>(e);
      if (mm?.penalty === "Fighting") return null; // narrated as a fight
      if (mm?.severity === "Game Misconduct") return null; // folded into its major
      if (mm?.washedOut) return { ...base, kind: "penalty", major: false, text: `The delayed penalty on ${e.playerName} (${mm.penalty ?? "infraction"}) is washed out by the goal.` };
      return { ...base, kind: "penalty", major: true, text: `${e.playerName} — ${mm?.penalty ?? "infraction"} (${mm?.minutes ?? 2} min, ${mm?.severity ?? "Minor"}).` };
    }
    case "EJECTION": return { ...base, outPlayerId: e.playerId, kind: "penalty", major: true, text: `${e.playerName ?? "?"} is ejected from the game.` };
    case "ICING": return { ...base, kind: "note", major: false, text: `Icing — ${who} can't change; the draw is in their end.` };
    case "DELAYED_PENALTY": return { ...base, kind: "note", major: false, text: `Delayed penalty — ${who} pulls the goalie for the extra attacker.` };
    case "COINCIDENTAL": {
      const mm = m<{ fourOnFour?: boolean; names?: string[] }>(e);
      return { ...base, kind: "penalty", major: true, text: `Scrum after the whistle: ${(mm?.names ?? []).join(" and ")} get roughing minors${mm?.fourOnFour ? " — 4-on-4" : ""}.` };
    }
    case "TIMEOUT": return { ...base, kind: "note", major: true, text: `⏱ ${who} calls its timeout${m<{ why?: string }>(e)?.why ? ` ${m<{ why?: string }>(e)!.why}` : ""}.` };
    case "CHALLENGE": {
      const mm = m<{ kind?: string; won?: boolean }>(e);
      return { ...base, kind: "goal", major: true, text: mm?.won ? `🎥 ${who} challenges for ${mm.kind} — goal by ${e.playerName} OVERTURNED!` : `🎥 ${who} challenges for ${mm?.kind} — the call stands, ${who} gets a delay-of-game minor.` };
    }
    case "GOALIE_PULL": return { ...base, kind: "note", major: true, text: m<{ pulled?: boolean }>(e)?.pulled ? `${who} pulls the goalie for the extra attacker.` : `${who} goalie is back in net.` };
    case "PP_START": return { ...base, kind: "note", major: false, text: `${who} power play begins.` };
    case "PP_END": return { ...base, kind: "note", major: false, text: `${who} power play is over.` };
    case "KNOCK": return { ...base, kind: "note", major: false, text: `${e.playerName ?? "?"} is shaken up and heads to the room.` };
    case "RETURN": return { ...base, kind: "note", major: false, text: `${e.playerName ?? "?"} is back on the bench.` };
    case "INJURY": return { ...base, outPlayerId: e.playerId, kind: "note", major: true, text: `${e.playerName ?? "?"} is injured and will not return.` };
    case "FIGHT": return { ...base, kind: "penalty", major: true, text: `Fight: ${e.playerName ?? "?"}${e.targetName ? ` versus ${e.targetName}` : ""}.` };
    case "GOALIE_CHANGE": return { ...base, kind: "note", major: true, text: `🥅 ${who} goalie change — ${e.playerName ?? "the backup"} replaces ${e.targetName ?? "the starter"}.` };
    case "SHOOTOUT": {
      const mm = m<{ round?: number; result?: string; homeSo?: number; awaySo?: number }>(e);
      const who = `${e.playerName ?? "?"}${e.teamCode ? ` (${e.teamCode})` : ""}`;
      const what = mm?.result === "goal" ? "SCORES" : mm?.result === "miss" ? "misses the net" : `is stopped by ${e.targetName ?? "the goalie"}`;
      return { ...base, tag: "SO", kind: mm?.result === "goal" ? "goal" : "save", major: mm?.result === "goal", text: `Shootout, round ${mm?.round ?? "?"} — ${who} ${what}.` };
    }
    case "PERIOD_START": return { ...base, kind: "period", major: true, text: `Start of the ${periodLabel(e.period)} period.` };
    case "PERIOD_END": return { ...base, kind: "period", major: true, text: `End of the ${periodLabel(e.period)} period.` };
    default: return null;
  }
}

/** Lines for a batch of events, oldest first. */
export const describeLiveEvents = (events: SimEvent[]): LiveLine[] => events.map(describeLiveEvent).filter((l): l is LiveLine => !!l);
