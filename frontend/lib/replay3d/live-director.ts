// Live 3D "director": turns the live event feed into a queue of short 3D clips.
//
// The feed carries every shot/save/goal plus the NOTABLE events (misses, blocks,
// hits, penalties, zone entries, takeaways…) — not faceoffs or line changes (those
// are MINOR and never leave the engine). So the director keeps its own idea of who
// is on the ice: it rotates the matchup lines on game time, shrinks a unit while it
// kills a penalty, adds a sixth skater when a goalie is pulled, and always swaps in
// whoever an event names. Faceoffs are staged after goals and whistles. Between
// events it plays possession filler so the ice never freezes.

import type { SimEvent } from "@/lib/sim/events";
import {
  attackDirFor, buildFaceoffClip, buildFlowClip, buildHitClip, buildShotClip, momentSeed,
  type Actor, type Clip, type Role, type Side,
} from "./reconstruct";

export type LivePlayer = { name: string; number: number | null; role: Role };
export type LiveTeam = { teamId: number; code: string; fLines: LivePlayer[][]; dPairs: LivePlayer[][]; goalie: LivePlayer | null };
export type Banner = { text: string; tone: "goal" | "penalty" | "save" | "info" };
export type LiveItem = { clip: Clip; banner?: Banner; focusId?: string | null; startAt?: number; kind: "shot" | "goal" | "hit" | "faceoff" | "flow" | "stoppage" };

/** "Jesper Bratt (R)" and "J. Bratt" both → "j. bratt". */
export function nameKey(name: string): string {
  const clean = name.replace(/\([^)]*\)/g, "").replace(/['"]{1,2}[CA]['"]{1,2}/g, "").replace(/\s+/g, " ").trim();
  const parts = clean.split(" ");
  if (parts.length < 2) return clean.toLowerCase();
  return `${parts[0][0]}. ${parts.slice(1).join(" ")}`.toLowerCase();
}

const ABS = (e: { period: number; seconds: number }) => (e.period - 1) * 1200 + e.seconds;
const SHIFT = 45; // game seconds per shift

type Unit = { f: Actor[]; d: Actor[]; g: Actor | null };
/** Manpower at the moment an event happened (clips are staged later, the state moves on). */
type Snap = { abs: number; period: number; pulled: Record<Side, boolean>; box: Record<Side, number> };

export class LiveDirector {
  private teams: Record<Side, LiveTeam>;
  private unit: Record<Side, Unit>;
  private line: Record<Side, number> = { home: 0, away: 0 };
  private pair: Record<Side, number> = { home: 0, away: 0 };
  private boxUntil: Record<Side, number> = { home: -1, away: -1 };
  private pulled: Record<Side, boolean> = { home: false, away: false };
  private queue: Array<{ kind: LiveItem["kind"]; make: () => LiveItem }> = [];
  private seen = new Set<number>();
  private poss: { side: Side; zone: "OFF" | "NEU" | "DEF" } = { side: "home", zone: "NEU" };
  private period = 1;
  private abs = 0;
  private shiftAt = 0;
  private fillN = 0;
  private started = false;
  private held: SimEvent[] = [];
  private silent = false; // replaying history for state only (joined mid-game)

  constructor(home: LiveTeam, away: LiveTeam, private gameId: number) {
    this.teams = { home, away };
    this.unit = { home: this.fresh("home"), away: this.fresh("away") };
  }

  private actor(side: Side, p: LivePlayer, extra = ""): Actor {
    return { id: `${side}-${p.role === "G" ? "G-" : ""}${nameKey(p.name)}${extra}`, side, role: p.role, name: p.name, number: p.number };
  }

  private fresh(side: Side): Unit {
    const t = this.teams[side];
    const fl = t.fLines.length ? t.fLines[this.line[side] % t.fLines.length] : [];
    const dp = t.dPairs.length ? t.dPairs[this.pair[side] % t.dPairs.length] : [];
    const f = fl.map((p) => this.actor(side, { ...p, role: "F" }));
    const d = dp.map((p) => this.actor(side, { ...p, role: "D" }));
    while (f.length < 3) f.push({ id: `${side}-f${f.length}`, side, role: "F", name: "", number: null });
    while (d.length < 2) d.push({ id: `${side}-d${d.length}`, side, role: "D", name: "", number: null });
    return { f, d, g: t.goalie ? this.actor(side, { ...t.goalie, role: "G" }) : { id: `${side}-G`, side, role: "G", name: "", number: null } };
  }

  private sideOf(teamId: number | undefined): Side | null {
    if (teamId === this.teams.home.teamId) return "home";
    if (teamId === this.teams.away.teamId) return "away";
    return null;
  }
  private other(s: Side): Side { return s === "home" ? "away" : "home"; }

  /** Make sure a named player is on the ice for `side`, swapping him in if needed. */
  private ensure(side: Side, name: string | undefined, protect: string[] = []): Actor | null {
    if (!name) return null;
    const key = nameKey(name);
    const u = this.unit[side];
    const hit = [...u.f, ...u.d].find((a) => a.id === `${side}-${key}`);
    if (hit) { if (!hit.name) hit.name = name; return hit; }
    const t = this.teams[side];
    const known = [...t.fLines.flat(), ...t.dPairs.flat()].find((p) => nameKey(p.name) === key);
    const role: Role = known?.role ?? "F";
    const a = this.actor(side, { name: known?.name ?? name, number: known?.number ?? null, role });
    const pool = role === "D" ? u.d : u.f;
    const slot = pool.findIndex((x) => !protect.includes(x.id));
    if (slot >= 0) pool[slot] = a; else pool.push(a);
    return a;
  }

  private snap(): Snap { return { abs: this.abs, period: this.period, pulled: { ...this.pulled }, box: { ...this.boxUntil } }; }

  /** On-ice skaters for a side at a moment (penalty kill / extra attacker applied). */
  private skaters(side: Side, at: Snap): Actor[] {
    const u = this.unit[side];
    let f = [...u.f];
    if (at.abs < at.box[side] && at.abs >= at.box[this.other(side)]) f = f.slice(0, Math.max(1, f.length - 1));
    if (at.pulled[side]) {
      const t = this.teams[side];
      const next = t.fLines[(this.line[side] + 1) % Math.max(1, t.fLines.length)]?.[0];
      f.push(next ? this.actor(side, { ...next, role: "F" }, "-x") : { id: `${side}-xa`, side, role: "F", name: "", number: null });
    }
    return [...f, ...u.d];
  }

  private tick(abs: number) {
    this.abs = Math.max(this.abs, abs);
    if (this.abs - this.shiftAt >= SHIFT) {
      this.shiftAt = this.abs;
      for (const s of ["home", "away"] as const) {
        this.line[s] = (this.line[s] + 1) % Math.max(1, Math.min(4, this.teams[s].fLines.length));
        if (Math.round(this.shiftAt / SHIFT) % 3 !== 2) this.pair[s] = (this.pair[s] + 1) % Math.max(1, Math.min(3, this.teams[s].dPairs.length)); // D shifts run a bit longer
        const g = this.unit[s].g;
        this.unit[s] = { ...this.fresh(s), g };
      }
    }
  }

  private scene(att: Side, seed: number, at: Snap) {
    const def = this.other(att);
    return {
      attackSide: att, attackDir: attackDirFor(att, Math.min(at.period, 4)),
      attackers: this.skaters(att, at), defenders: this.skaters(def, at),
      goalie: at.pulled[def] ? null : this.unit[def].g, ownGoalie: at.pulled[att] ? null : this.unit[att].g,
      seed,
    };
  }

  private faceoff(dotFor: "center" | Side, seed: number, at: Snap): LiveItem {
    const winner: Side = seed % 2 ? "home" : "away";
    const sc = this.scene(winner, seed, at);
    // world dot → the winner's attacking frame
    let wx = 0, wz = 0;
    if (dotFor !== "center") {
      const defDir = attackDirFor(dotFor, Math.min(at.period, 4)); // the side whose end it is defends −defDir
      wx = -defDir * 69; wz = (seed % 3 ? 1 : -1) * 22;
    }
    this.poss = { side: winner, zone: "NEU" };
    return { kind: "faceoff", clip: buildFaceoffClip({ ...sc, dot: { x: wx * sc.attackDir, z: wz * sc.attackDir } }) };
  }

  /** Feed new events (repeats are dropped by seq). */
  ingest(events: SimEvent[]) {
    const incoming = events.filter((e) => !this.seen.has(e.seq));
    for (const e of incoming) this.seen.add(e.seq);
    const fresh = [...this.held, ...incoming].sort((a, b) => ABS(a) - ABS(b) || a.seq - b.seq);
    this.held = [];
    // joining a game already under way: older events only set the state, the last ~20 s get staged
    const lastAbs = fresh.length ? ABS(fresh[fresh.length - 1]) : 0;
    const joinCut = !this.started && lastAbs > 40 ? lastAbs - 20 : -1;
    if (!this.started && fresh.length) {
      this.started = true;
      if (joinCut < 0) {
        const seed = momentSeed(this.gameId, "open");
        const at = this.snap();
        this.queue.push({ kind: "faceoff", make: () => this.faceoff("center", seed, at) });
      }
    }
    const used = new Set<number>();
    for (let i = 0; i < fresh.length; i++) {
      const e = fresh[i];
      if (used.has(e.seq)) continue;
      this.silent = ABS(e) < joinCut;
      this.period = Math.max(this.period, e.period);
      this.tick(ABS(e));
      const side = this.sideOf(e.teamId);
      const seed = momentSeed(this.gameId, e.period, e.seconds, e.seq);
      const at = this.snap();
      switch (e.type) {
        case "SHOT": case "SAVE": case "GOAL": case "MISS": case "BLOCK": {
          // gather the whole shot (SHOT + its SAVE/GOAL at the same instant)
          const group = fresh.filter((x) => !used.has(x.seq) && x.period === e.period && x.seconds === e.seconds && ["SHOT", "SAVE", "GOAL", "MISS", "BLOCK"].includes(x.type));
          group.forEach((x) => used.add(x.seq));
          // a SHOT whose SAVE/GOAL hasn't arrived yet (split across polls): wait one batch for it
          if (group.every((x) => x.type === "SHOT") && !fresh.some((x) => ABS(x) > ABS(e))) { this.held.push(...group); break; }
          this.shot(group, seed, at);
          break;
        }
        case "HIT": {
          if (!side) break;
          const victimSide = this.other(side);
          this.push("hit", () => {
            const hitter = this.ensure(side, e.playerName), victim = this.ensure(victimSide, e.targetName);
            const sc = this.scene(victimSide, seed, at);
            return { kind: "hit", clip: buildHitClip({ ...sc, hitterId: hitter?.id ?? sc.defenders[0].id, victimId: victim?.id ?? sc.attackers[0].id }), banner: { text: `💥 Hit – ${e.playerName ?? ""}`, tone: "info" }, focusId: hitter?.id };
          });
          this.poss = { side, zone: "NEU" };
          break;
        }
        case "PENALTY": {
          if (!side) break;
          const mins = Number((e.meta as { minutes?: number } | undefined)?.minutes ?? 2);
          const givesPP = (e.meta as { givesPP?: boolean } | undefined)?.givesPP !== false;
          if (givesPP && mins < 10) this.boxUntil[side] = Math.max(this.boxUntil[side], ABS(e) + mins * 60);
          const after = this.snap();
          const penalty = String((e.meta as { penalty?: string } | undefined)?.penalty ?? "");
          this.push("stoppage", () => {
            const who = this.ensure(side, e.playerName);
            return { kind: "stoppage", clip: buildFlowClip({ ...this.scene(this.other(side), seed, at), zone: "NEU", duration: 2.4 }), banner: { text: `🛑 Vylúčenie – ${e.playerName ?? ""}${penalty ? ` (${penalty}, ${mins} min)` : ""}`, tone: "penalty" }, focusId: who?.id };
          });
          this.push("faceoff", () => this.faceoff(side, seed + 1, after));
          break;
        }
        case "GOALIE_PULL": if (side) this.pulled[side] = true; break;
        case "PERIOD_START":
          this.pulled = { home: false, away: false };
          { const now = this.snap(); this.push("faceoff", () => this.faceoff("center", seed, now)); }
          break;
        case "PERIOD_END":
          this.pulled = { home: false, away: false };
          { const side0 = this.poss.side; this.push("stoppage", () => ({ kind: "stoppage", clip: buildFlowClip({ ...this.scene(side0, seed, at), zone: "NEU", duration: 2.2 }), banner: { text: `⏱ Koniec ${e.period}. tretiny`, tone: "info" } })); }
          break;
        case "ZONE_ENTRY": if (side) { this.poss = { side, zone: "OFF" }; this.pushFlow(seed, at); } break;
        case "TAKEAWAY": if (side) { this.poss = { side, zone: "NEU" }; this.pushFlow(seed, at); } break;
        case "GIVEAWAY": if (side) this.poss = { side: this.other(side), zone: "NEU" }; break;
        case "RUSH": case "PUCK_RACE": if (side) this.poss = { side, zone: "NEU" }; break;
        case "ICING": case "WHISTLE": if (side) this.push("faceoff", () => this.faceoff(side, seed, at)); break;
      }
    }
    this.silent = false;
  }

  private pushFlow(seed: number, at: Snap) {
    if (this.queue.length >= 2) return; // possession filler only when we're keeping up
    const { side, zone } = this.poss;
    this.push("flow", () => ({ kind: "flow", clip: buildFlowClip({ ...this.scene(side, seed, at), zone, duration: 2.6 }) }));
  }

  private push(kind: LiveItem["kind"], make: () => LiveItem) { if (!this.silent) this.queue.push({ kind, make }); }

  private shot(group: SimEvent[], seed: number, at: Snap) {
    const goal = group.find((x) => x.type === "GOAL");
    const save = group.find((x) => x.type === "SAVE");
    const block = group.find((x) => x.type === "BLOCK");
    const miss = group.find((x) => x.type === "MISS");
    const shot = group.find((x) => x.type === "SHOT");
    // which team shot, and who
    const offTeam = goal?.teamId ?? shot?.teamId ?? miss?.teamId ?? (save ? this.teams[this.sideOf(save.teamId) === "home" ? "away" : "home"].teamId : undefined) ?? (block ? this.teams[this.sideOf(block.teamId) === "home" ? "away" : "home"].teamId : undefined);
    const att = this.sideOf(offTeam);
    if (!att) return;
    const def = this.other(att);
    const shooterName = goal?.playerName ?? shot?.playerName ?? miss?.playerName ?? save?.targetName ?? block?.targetName;
    const meta = (goal?.meta ?? save?.meta ?? {}) as { assistNames?: string[]; play?: string; rush?: string; emptyNet?: boolean };
    const assists = (meta.assistNames ?? []).slice(0, 2);
    const outcome = goal ? "goal" : save ? "save" : block ? "block" : miss ? "miss" : "save";
    const src = goal ?? save ?? shot ?? miss ?? block!;
    const emptyNet = !!(goal && meta.emptyNet);
    if (emptyNet) at.pulled[def] = true;
    const kind = goal ? "goal" : "shot";
    if (goal) {
      // after a goal: goalies back in, the penalty (on a PP goal) is over, a draw at centre ice
      this.pulled = { home: false, away: false };
      if (goal.strength === "PP") this.boxUntil[def] = -1;
    }
    const after = this.snap();
    this.push(kind, () => {
      // put the named players on the ice at the moment the clip is staged
      const shooter = this.ensure(att, shooterName);
      const ids = [shooter?.id ?? ""];
      const assistActors = assists.map((n) => { const a = this.ensure(att, n, ids); if (a) ids.push(a.id); return a; }).filter((a): a is Actor => !!a);
      const blocker = block ? this.ensure(def, block.playerName) : null;
      const sc = this.scene(att, seed, at);
      // the blocker leads the defenders list so the clip puts him in the lane
      const defenders = blocker ? [blocker, ...sc.defenders.filter((d) => d.id !== blocker.id)] : sc.defenders;
      const clip = buildShotClip({
        ...sc, defenders, outcome, goalie: emptyNet ? null : sc.goalie, emptyNet,
        shooterId: shooter?.id ?? sc.attackers[0].id, assistIds: assistActors.map((a) => a.id),
        sector: src.sector ?? (miss ? "SLOT" : null), shotType: src.shotType ?? null, play: meta.play ?? null, rush: meta.rush ?? null,
      });
      const code = this.teams[att].code;
      let banner: Banner | undefined;
      if (goal) banner = { text: `🚨 GÓL! ${goal.playerName ?? ""} (${code})${assists.length ? ` · ${assists.join(", ")}` : ""}`, tone: "goal" };
      else if (save) banner = { text: `🧤 Zákrok – ${save.playerName ?? ""}`, tone: "save" };
      else if (block) banner = { text: `🛡️ Blok – ${block.playerName ?? ""}`, tone: "info" };
      if (goal) this.queue.unshift({ kind: "faceoff", make: () => this.faceoff("center", seed + 7, after) });
      else if (clip.cues.some((c) => c.kind === "whistle")) this.queue.unshift({ kind: "faceoff", make: () => this.faceoff(def, seed + 3, after) });
      this.poss = { side: outcome === "save" || outcome === "block" ? def : att, zone: outcome === "miss" ? "OFF" : "DEF" };
      if (this.poss.side === def) this.poss.zone = "DEF";
      return { kind, clip, banner, focusId: shooter?.id ?? null };
    });
  }

  /** How many clips are waiting (the view speeds up when this grows). */
  get pending(): number { return this.queue.length; }

  /** The next clip to play: the oldest queued event, or possession filler. */
  next(): LiveItem {
    // falling behind: drop possession filler and stoppages, keep what matters
    if (this.queue.length > 5) this.queue = this.queue.filter((q, i) => q.kind === "goal" || i >= this.queue.length - 3);
    const q = this.queue.shift();
    if (q) return q.make();
    const seed = momentSeed(this.gameId, "fill", this.fillN++);
    if (this.fillN % 3 === 0) this.poss = { side: this.poss.side, zone: this.poss.zone === "OFF" ? "NEU" : "OFF" };
    const { side, zone } = this.poss;
    return { kind: "flow", clip: buildFlowClip({ ...this.scene(side, seed, this.snap()), zone, duration: 3 }) };
  }
}
