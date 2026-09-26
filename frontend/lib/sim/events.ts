// Next-gen event stream (v2 engine).
//
// The possession tick loop emits a typed stream of micro-events through an
// EventSink. That stream is the single source of truth: play-by-play, the box
// score and (later) xG / advanced stats are all *derived* from it rather than
// reconstructed post-hoc. Every on-target SHOT/SAVE and all NOTABLE-and-above
// events are persisted; the thousands of transient possession ticks stay in memory.

export type EventType =
  | "PERIOD_START"
  | "PERIOD_END"
  | "FACEOFF"
  | "ZONE_ENTRY"
  | "SHOT"      // a shot on goal (leads to SAVE or GOAL)
  | "GOAL"
  | "SAVE"
  | "BLOCK"     // a defender blocks the shot
  | "MISS"      // wide / off the iron
  | "REBOUND"
  | "HIT"
  | "TAKEAWAY"
  | "GIVEAWAY"
  | "PENALTY"
  | "PP_START"
  | "PP_END"
  | "GOALIE_PULL"
  | "EMPTY_NET"
  | "FIGHT"
  | "INJURY"
  | "LINE_CHANGE" // a fresh forward line / D pair hops the boards
  | "ICING"             // an icing whistle — the icing team can't change, draw in its own zone
  | "DELAYED_PENALTY"   // arm up: the other side pulls its goalie until the offenders touch the puck
  | "CHALLENGE"         // coach's challenge on a goal (offside / goaltender interference)
  | "TIMEOUT"           // a bench's one timeout
  | "COINCIDENTAL";     // coincidental minors at full strength → 4-on-4

// Rising importance — controls what gets persisted and how loud the PBP is.
export type Importance = "MINOR" | "NOTABLE" | "MAJOR" | "HIGHLIGHT";

const RANK: Record<Importance, number> = { MINOR: 0, NOTABLE: 1, MAJOR: 2, HIGHLIGHT: 3 };

export type Zone = "DEF" | "NEU" | "OFF";
export type Strength = "EV" | "PP" | "SH" | "EN";

export type SimEvent = {
  seq: number;
  period: number;
  seconds: number;      // clock within the period
  type: EventType;
  teamId?: number;      // acting team
  teamCode?: string;
  playerId?: number;    // primary actor
  playerName?: string;
  targetId?: number;    // hit target / goalie / defender
  targetName?: string;
  zone?: Zone;
  sector?: string;      // shot location bucket (Phase 2)
  shotType?: string;    // WRIST|SLAP|SNAP|BACKHAND|TIP|ONE_TIMER
  strength?: Strength;
  xg?: number;          // shot-quality at the moment (Phase 2)
  importance: Importance;
  meta?: Record<string, unknown>;
};

/** Collects the event stream for one game. Cheap: an array + a counter. */
export class EventSink {
  private events: SimEvent[] = [];
  private seq = 0;

  emit(e: Omit<SimEvent, "seq">): void {
    this.events.push({ ...e, seq: this.seq++ });
  }

  /** Every event, in order. */
  all(): SimEvent[] {
    return this.events;
  }

  /** Only the events worth storing / narrating (NOTABLE and above by default). */
  notable(min: Importance = "NOTABLE"): SimEvent[] {
    const floor = RANK[min];
    return this.events.filter((e) => RANK[e.importance] >= floor);
  }

  /** Events stored with the game. Keep the full on-target shot chain so xG flow,
   * shot maps and goalie reports can reproduce the box score exactly; retain the
   * previous NOTABLE threshold for every other kind of micro-event. */
  persistable(): SimEvent[] {
    return this.events.filter((e) => e.type === "SHOT" || e.type === "SAVE" || RANK[e.importance] >= RANK.NOTABLE);
  }

  get count(): number {
    return this.events.length;
  }
}

/** A no-op sink so the tick loop can always call sink.emit() unconditionally. */
export const NULL_SINK = new EventSink();
