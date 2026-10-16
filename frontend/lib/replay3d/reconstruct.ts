// 3D replay reconstruction.
//
// The sim engine decides *what* happened (who shot, from which sector, what kind of
// shot, rebound / wraparound / deflection, rush kind, assists, who was on the ice) —
// it never tracks where the ten skaters stood. This module turns one of those facts
// into a short, plausible piece of motion: keyframed paths for the attackers, a puck
// script (carry → pass → shot → net), and steered defenders + goalies that react to
// it. Purely cosmetic and seeded, so the same goal always replays the same way and
// nothing here can ever touch a result.
//
// Units are feet, origin at centre ice: x runs end to end (goal lines at ±89), z runs
// across (boards at ±42.5), y is up. Everything is planned attacking +x and mirrored
// at the end for the other direction.

import { RNG } from "@/lib/sim/rng";

export const RINK = { halfLength: 100, halfWidth: 42.5, cornerR: 28, goalLine: 89, blueLine: 25, netDepth: 3.67, netHalfWidth: 3, netHeight: 4 } as const;

export type Side = "home" | "away";
export type Role = "F" | "D" | "G";
export const POSE = { SKATE: 0, SHOOT: 1, CELEBRATE: 2, BUTTERFLY: 3 } as const;

export type Actor = { id: string; side: Side; role: Role; name: string; number: number | null };
export type ActorState = { x: number; z: number; h: number; pose: number; poseT: number; speed: number };
export type PuckState = { x: number; y: number; z: number; flying: boolean };
export type Cue = { t: number; kind: "pass" | "shot" | "goal" | "save" | "post" | "miss" | "block" | "whistle" | "hit" };
export type ClipFrame = { a: ActorState[]; p: PuckState };
export type Clip = {
  duration: number; fps: number; actors: Actor[]; frames: ClipFrame[]; cues: Cue[];
  attackDir: 1 | -1; attackSide: Side; shotT: number | null; goalT: number | null;
};

export type ShotSpec = {
  outcome: "goal" | "save" | "miss" | "block" | "post";
  attackSide: Side; attackDir: 1 | -1;
  attackers: Actor[];          // attacking skaters (any order)
  defenders: Actor[];          // defending skaters
  goalie: Actor | null;        // defending goalie — null on an empty net
  ownGoalie?: Actor | null;    // the attacking team's goalie, drawn in his own crease
  shooterId: string;
  assistIds?: string[];        // primary first
  sector?: string | null; shotType?: string | null;
  play?: string | null;        // "rebound" | "wrap" | "deflect" (engine meta.play)
  rush?: string | null;        // "BREAKAWAY" | "2ON1" | "3ON2" (engine meta.rush)
  emptyNet?: boolean;
  seed: number;
};

const FPS = 30;
const NET_X = RINK.goalLine;
type P = { x: number; z: number };
type Key = { t: number; x: number; z: number };
type PuckSeg =
  | { kind: "carry"; who: string; t0: number; t1: number }
  | { kind: "fly"; t0: number; t1: number; from: PuckFrom; to: PuckTo; lift?: number; y0?: number; y1?: number }
  | { kind: "rest"; t0: number; t1: number; at: { x: number; y: number; z: number } };
type PuckFrom = { who: string } | { at: { x: number; y: number; z: number } };
type PuckTo = { who: string } | { at: { x: number; y: number; z: number } };

const dist = (a: P, b: P) => Math.hypot(a.x - b.x, a.z - b.z);
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const clamp01 = (k: number) => Math.max(0, Math.min(1, k));
const smooth = (k: number) => { const c = clamp01(k); return c * c * (3 - 2 * c); };

/** Keep a point inside the rounded boards (with a margin). */
export function clampRink(x: number, z: number, m = 1.5): P {
  const hx = RINK.halfLength - m, hz = RINK.halfWidth - m, r = RINK.cornerR - m;
  let cx = Math.max(-hx, Math.min(hx, x)), cz = Math.max(-hz, Math.min(hz, z));
  const ox = hx - r, oz = hz - r;
  if (Math.abs(cx) > ox && Math.abs(cz) > oz) {
    const px = Math.sign(cx) * ox, pz = Math.sign(cz) * oz, d = Math.hypot(cx - px, cz - pz);
    if (d > r) { cx = px + ((cx - px) / d) * r; cz = pz + ((cz - pz) / d) * r; }
  }
  return { x: cx, z: cz };
}

/** Where a shot from this engine sector is taken (attacking +x, side s = ±1). */
export function shotSpot(sector: string | null | undefined, s: number, rng: RNG): P {
  const j = () => (rng.next() - 0.5) * 4;
  switch (sector) {
    case "NET_FRONT": return { x: 83 + j() * 0.4, z: s * (2.5 + rng.next() * 2) };
    case "CIRCLE": return { x: 68 + j(), z: s * (19 + rng.next() * 5) };
    case "PERIMETER": return { x: 60 + j(), z: s * (29 + rng.next() * 5) };
    case "POINT": return { x: 32 + j() * 0.5, z: s * (12 + rng.next() * 10) };
    default: return { x: 73 + j(), z: s * (3 + rng.next() * 5) }; // SLOT
  }
}

const SHOT_SPEED: Record<string, number> = { SLAP: 135, ONE_TIMER: 125, SNAP: 110, WRIST: 100, BACKHAND: 75, TIP: 70 };

/** Hermite interpolation through time-stamped keys (smooth, passes through every key). */
function sampleKeys(keys: Key[], t: number): P {
  if (t <= keys[0].t) return { x: keys[0].x, z: keys[0].z };
  const n = keys.length;
  if (t >= keys[n - 1].t) return { x: keys[n - 1].x, z: keys[n - 1].z };
  let i = 0;
  while (i < n - 2 && t > keys[i + 1].t) i++;
  const a = keys[i], b = keys[i + 1], dt = b.t - a.t || 1e-6;
  const prev = keys[i - 1], next = keys[i + 2];
  const tan = (p: Key | undefined, q: Key | undefined, cur: Key, other: Key): P => {
    if (p && q) return { x: (q.x - p.x) / (q.t - p.t), z: (q.z - p.z) / (q.t - p.t) };
    return { x: (other.x - cur.x) / (other.t - cur.t || 1e-6) * 0.5, z: (other.z - cur.z) / (other.t - cur.t || 1e-6) * 0.5 };
  };
  const ma = tan(prev, b, a, b), mb = tan(a, next, b, a);
  const u = (t - a.t) / dt, u2 = u * u, u3 = u2 * u;
  const h00 = 2 * u3 - 3 * u2 + 1, h10 = u3 - 2 * u2 + u, h01 = -2 * u3 + 3 * u2, h11 = u3 - u2;
  return { x: h00 * a.x + h10 * dt * ma.x + h01 * b.x + h11 * dt * mb.x, z: h00 * a.z + h10 * dt * ma.z + h01 * b.z + h11 * dt * mb.z };
}

function keyAt(keys: Key[], t: number): P { return sampleKeys(keys, t); }

/** A script under construction: attacker paths + the puck + timing marks. */
class Script {
  keys = new Map<string, Key[]>();
  puck: PuckSeg[] = [];
  cues: Cue[] = [];
  shooting = new Map<string, Array<{ t0: number; t1: number }>>();
  shotT = 0; arriveT = 0;
  target = { x: NET_X + 0.6, y: 1, z: 0 };
  key(id: string, t: number, p: P) {
    const c = clampRink(p.x, p.z);
    const arr = this.keys.get(id) ?? [];
    arr.push({ t, x: c.x, z: c.z }); arr.sort((a, b) => a.t - b.t);
    this.keys.set(id, arr);
  }
  at(id: string, t: number): P { const k = this.keys.get(id); return k ? keyAt(k, t) : { x: 40, z: 0 }; }
  shootPose(id: string, t0: number, t1: number) { const a = this.shooting.get(id) ?? []; a.push({ t0, t1 }); this.shooting.set(id, a); }
}

/** Pick a role for an attacker slot when the engine didn't say (first ones forwards). */
export function splitRoles<T extends { role: Role }>(list: T[]): { f: T[]; d: T[] } {
  return { f: list.filter((a) => a.role === "F"), d: list.filter((a) => a.role === "D") };
}

// ---- plays -----------------------------------------------------------------------------

type Ctx = { spec: ShotSpec; rng: RNG; s: number; S: Script; all: Actor[]; shooter: Actor; a1: Actor | null; a2: Actor | null; others: Actor[] };

/** Park everyone not in the play on a sensible offensive-zone spot. */
function placeOthers(c: Ctx, avoid: P[], tEnd: number) {
  const { S, s, rng } = c;
  const fSpots: P[] = [{ x: 84, z: -s * 2.5 }, { x: 64, z: s * 32 }, { x: 80, z: -s * 27 }, { x: 70, z: -s * 14 }];
  const dSpots: P[] = [{ x: 33, z: 17 }, { x: 33, z: -17 }, { x: 40, z: 0 }];
  const taken: P[] = [...avoid];
  for (const o of c.others) {
    if (S.keys.has(o.id)) continue;
    const pool = o.role === "D" ? [...dSpots, ...fSpots] : [...fSpots, ...dSpots];
    const spot = pool.find((p) => taken.every((q) => dist(p, q) > 9)) ?? pool[0];
    taken.push(spot);
    const wob = () => (rng.next() - 0.5) * 6;
    S.key(o.id, 0, { x: spot.x + wob(), z: spot.z + wob() });
    S.key(o.id, tEnd * 0.5, { x: spot.x + wob() * 0.6, z: spot.z + wob() * 0.6 });
    S.key(o.id, tEnd, { x: spot.x + wob() * 0.3, z: spot.z + wob() * 0.3 });
  }
}

/** Puck from carrier to target in the net (or wherever the outcome sends it). */
function shoot(c: Ctx, who: string, t: number, from: P) {
  const { S, spec, rng } = c;
  const type = (spec.shotType ?? "WRIST").toUpperCase();
  const windup = type === "SLAP" ? 0.5 : type === "ONE_TIMER" ? 0.18 : 0.3;
  S.shootPose(who, t - windup, t + 0.35);
  // where it's going: a corner, a five-hole, or (for the save/miss outcomes) not quite
  const high = rng.chance(type === "BACKHAND" || type === "TIP" ? 0.35 : 0.55);
  const glove = rng.chance(0.5) ? 1 : -1;
  let tz = glove * (1.6 + rng.next() * 1.1), ty = high ? 2.6 + rng.next() * 1 : 0.25 + rng.next() * 0.5;
  if (spec.emptyNet || !spec.goalie) { tz = (rng.next() - 0.5) * 3; ty = 0.15; }
  if (spec.outcome === "miss") { tz = Math.sign(tz || 1) * (4.2 + rng.next() * 3); ty = rng.chance(0.3) ? 4.8 : ty; }
  if (spec.outcome === "post") { tz = Math.sign(tz || 1) * 3; ty = 0.8 + rng.next() * 2.4; }
  if (spec.outcome === "save") { tz *= 0.55; ty = Math.min(ty, 3.2); }
  S.target = { x: NET_X + 0.15, y: ty, z: tz };
  const d = Math.hypot(S.target.x - from.x, S.target.z - from.z);
  const v = SHOT_SPEED[type] ?? 100;
  const flight = Math.max(0.12, d / v);
  S.shotT = t; S.arriveT = t + flight;
  S.cues.push({ t, kind: "shot" });
  const lift = type === "SLAP" || type === "WRIST" || type === "SNAP" ? Math.min(1.5, d / 40) : 0.3;
  if (spec.outcome === "block") {
    // a defender steps into the lane a third of the way out
    const bk = { x: lerp(from.x, S.target.x, 0.3), z: lerp(from.z, S.target.z, 0.3) };
    S.shotT = t; S.arriveT = t + flight * 0.3;
    S.puck.push({ kind: "fly", t0: t, t1: S.arriveT, from: { who }, to: { at: { x: bk.x, y: 0.6, z: bk.z } }, lift: 0.2 });
    const out = clampRink(bk.x - 6 + rng.next() * 4, bk.z + (rng.chance(0.5) ? 9 : -9));
    S.puck.push({ kind: "fly", t0: S.arriveT, t1: S.arriveT + 0.7, from: { at: { x: bk.x, y: 0.6, z: bk.z } }, to: { at: { x: out.x, y: 0, z: out.z } }, lift: 0.4 });
    S.puck.push({ kind: "rest", t0: S.arriveT + 0.7, t1: 99, at: { x: out.x, y: 0, z: out.z } });
    S.cues.push({ t: S.arriveT, kind: "block" });
    return;
  }
  S.puck.push({ kind: "fly", t0: t, t1: S.arriveT, from: { who }, to: { at: { ...S.target } }, lift, y1: ty });
  finishShot(c);
}

/** What the puck does after it reaches the goal line. */
function finishShot(c: Ctx) {
  const { S, spec, rng } = c;
  const T = S.target, t = S.arriveT;
  if (spec.outcome === "goal") {
    const back = { x: NET_X + RINK.netDepth - 0.5, y: 0.12, z: T.z * 0.7 };
    S.puck.push({ kind: "fly", t0: t, t1: t + 0.22, from: { at: { ...T } }, to: { at: back }, lift: 0, y0: T.y, y1: Math.max(0.12, T.y * 0.4) });
    S.puck.push({ kind: "fly", t0: t + 0.22, t1: t + 0.5, from: { at: { ...back, y: Math.max(0.12, T.y * 0.4) } }, to: { at: back }, lift: 0, y1: 0.12 });
    S.puck.push({ kind: "rest", t0: t + 0.5, t1: 99, at: back });
    S.cues.push({ t, kind: "goal" });
  } else if (spec.outcome === "save") {
    const freeze = rng.chance(0.45);
    if (freeze) {
      S.puck.push({ kind: "rest", t0: t, t1: 99, at: { x: NET_X - 1.6, y: T.y > 1.8 ? 3 : 0.3, z: T.z * 0.6 } });
      S.cues.push({ t, kind: "save" }, { t: t + 0.5, kind: "whistle" });
    } else {
      const out = clampRink(NET_X - 10 - rng.next() * 8, (rng.chance(0.5) ? 1 : -1) * (18 + rng.next() * 14));
      S.puck.push({ kind: "fly", t0: t, t1: t + 0.6, from: { at: { ...T } }, to: { at: { x: out.x, y: 0, z: out.z } }, lift: 1.2 });
      S.puck.push({ kind: "rest", t0: t + 0.6, t1: 99, at: { x: out.x, y: 0, z: out.z } });
      S.cues.push({ t, kind: "save" });
    }
  } else if (spec.outcome === "post") {
    const out = clampRink(NET_X - 12, Math.sign(T.z) * 16);
    S.puck.push({ kind: "fly", t0: t, t1: t + 0.55, from: { at: { ...T } }, to: { at: { x: out.x, y: 0, z: out.z } }, lift: 0.8 });
    S.puck.push({ kind: "rest", t0: t + 0.55, t1: 99, at: { x: out.x, y: 0, z: out.z } });
    S.cues.push({ t, kind: "post" });
  } else {
    // wide: off the end boards and back out along them
    const wall = { x: RINK.halfLength - 2, y: 0.2, z: Math.sign(T.z || 1) * 9 };
    const back = clampRink(NET_X - 2, Math.sign(T.z || 1) * 30);
    S.puck.push({ kind: "fly", t0: t, t1: t + 0.12, from: { at: { ...T } }, to: { at: wall }, lift: 0, y1: 0.2 });
    S.puck.push({ kind: "fly", t0: t + 0.12, t1: t + 0.9, from: { at: wall }, to: { at: { x: back.x, y: 0, z: back.z } }, lift: 0 });
    S.puck.push({ kind: "rest", t0: t + 0.9, t1: 99, at: { x: back.x, y: 0, z: back.z } });
    S.cues.push({ t, kind: "miss" });
  }
}

function pass(S: Script, from: string, to: string, t0: number, t1: number) {
  S.puck.push({ kind: "fly", t0, t1, from: { who: from }, to: { who: to }, lift: 0 });
  S.cues.push({ t: t0, kind: "pass" });
}

/** Default: work it around the zone and finish from the engine's sector. */
function playCycle(c: Ctx) {
  const { S, s, rng, shooter, a1, a2, spec } = c;
  const spot = shotSpot(spec.sector, s, rng);
  const oneTimer = (spec.shotType ?? "").toUpperCase() === "ONE_TIMER";
  let t = 0;
  const chain: Actor[] = [a2, a1].filter((x): x is Actor => !!x);
  // starting spots for the passers: half-wall, then the far side / point / corner
  const startFor = (a: Actor, i: number): P => a.role === "D" ? { x: 34, z: (i % 2 ? -1 : 1) * s * 18 } : i === 0 ? { x: 58, z: s * 34 } : { x: 84, z: -s * 26 };
  let holder: Actor | null = null;
  for (let i = 0; i < chain.length; i++) {
    const a = chain[i], st = startFor(a, i);
    if (!holder) {
      const carry = 0.9 + rng.next() * 0.5;
      S.key(a.id, 0, st);
      S.key(a.id, carry, { x: st.x + 5, z: st.z * 0.92 });
      S.puck.push({ kind: "carry", who: a.id, t0: 0, t1: carry }); t = carry;
    } else {
      const hold = 0.6 + rng.next() * 0.5;
      S.key(a.id, 0, { x: st.x - 4, z: st.z * 0.9 });
      S.key(a.id, t + 0.4, st);
      S.key(a.id, t + 0.4 + hold, { x: st.x + (a.role === "D" ? 2 : -3), z: st.z * 0.85 });
      pass(S, holder.id, a.id, t, t + 0.4);
      S.puck.push({ kind: "carry", who: a.id, t0: t + 0.4, t1: t + 0.4 + hold }); t = t + 0.4 + hold;
    }
    const here = S.at(a.id, t);
    S.key(a.id, t + 2.5, { x: (here.x + spot.x) / 2, z: here.z * 0.8 });
    holder = a;
  }
  if (holder) {
    const hp = S.at(holder.id, t);
    const pt = Math.max(0.25, dist(hp, spot) / 70);
    // shooter slides into the soft ice and arrives with the pass
    S.key(shooter.id, 0, { x: spot.x - 10 + rng.next() * 4, z: spot.z + -s * (6 + rng.next() * 6) });
    S.key(shooter.id, t + pt, spot);
    pass(S, holder.id, shooter.id, t, t + pt);
    t += pt;
    if (oneTimer) { shoot(c, shooter.id, t + 0.03, spot); S.key(shooter.id, t + 1, { x: spot.x + 4, z: spot.z * 0.8 }); }
    else {
      const hold = 0.35 + rng.next() * 0.4;
      const drive = { x: spot.x + 3, z: spot.z * 0.85 };
      S.key(shooter.id, t + hold, drive);
      S.puck.push({ kind: "carry", who: shooter.id, t0: t, t1: t + hold });
      shoot(c, shooter.id, t + hold, drive);
      S.key(shooter.id, t + hold + 1, { x: drive.x + 5, z: drive.z * 0.7 });
    }
  } else {
    // unassisted: he takes it himself off the wall
    const st = { x: 56, z: s * 33 };
    S.key(shooter.id, 0, st);
    S.key(shooter.id, 1.2, { x: 66, z: s * 28 });
    S.key(shooter.id, 2.1, spot);
    S.puck.push({ kind: "carry", who: shooter.id, t0: 0, t1: 2.1 });
    shoot(c, shooter.id, 2.1, spot);
    S.key(shooter.id, 3.1, { x: spot.x + 5, z: spot.z * 0.6 });
  }
  placeOthers(c, [spot], S.arriveT + 3.5);
}

function playRush(c: Ctx) {
  const { S, s, rng, shooter, a1, a2, spec } = c;
  const kind = spec.rush;
  const v = 27;
  if (kind === "BREAKAWAY" || !a1) {
    const st = { x: 4, z: s * 10 };
    S.key(shooter.id, 0, st);
    S.key(shooter.id, 1.1, { x: 34, z: s * 6 });
    S.key(shooter.id, 2.0, { x: 60, z: s * 2 });
    const deke = { x: 79, z: -s * 2.5 };
    S.key(shooter.id, 2.7, deke);
    S.puck.push({ kind: "carry", who: shooter.id, t0: 0, t1: 2.7 });
    shoot(c, shooter.id, 2.7, deke);
    S.key(shooter.id, 3.5, { x: 88, z: -s * 9 });
  } else {
    // 2-on-1 / 3-on-2: the carrier draws the defender and slides it across
    const carrierStart = { x: 16, z: -s * 15 }, shooterStart = { x: 14, z: s * 14 };
    S.key(a1.id, 0, carrierStart);
    S.key(a1.id, 1.6, { x: 16 + v * 1.6, z: -s * 14 });
    S.key(a1.id, 2.2, { x: 63, z: -s * 12 });
    S.key(a1.id, 3.4, { x: 78, z: -s * 16 });
    S.puck.push({ kind: "carry", who: a1.id, t0: 0, t1: 2.2 });
    const spot = { x: 70 + rng.next() * 3, z: s * (9 + rng.next() * 3) };
    S.key(shooter.id, 0, shooterStart);
    S.key(shooter.id, 1.6, { x: 14 + v * 1.6, z: s * 13 });
    S.key(shooter.id, 2.55, spot);
    pass(S, a1.id, shooter.id, 2.2, 2.55);
    shoot(c, shooter.id, 2.6, spot);
    S.key(shooter.id, 3.6, { x: 84, z: s * 6 });
    if (kind === "3ON2" && a2) {
      S.key(a2.id, 0, { x: 10, z: 0 });
      S.key(a2.id, 2.6, { x: 74, z: -s * 2 });
      S.key(a2.id, 3.6, { x: 83, z: -s * 1 });
    }
  }
  // the rest trail the play up ice
  let k = 0;
  for (const o of c.all) {
    if (S.keys.has(o.id)) continue;
    const z = (k % 2 ? 1 : -1) * (8 + 8 * k); k++;
    S.key(o.id, 0, { x: -18 - rng.next() * 8, z });
    S.key(o.id, S.arriveT + 3, { x: 30 + rng.next() * 10, z: z * 0.6 });
  }
}

function playRebound(c: Ctx) {
  const { S, s, rng, shooter, a1, a2, spec } = c;
  const first = a1 ?? c.others.find((o) => o.role === "D") ?? c.others[0];
  if (!first) return playCycle(c);
  const from = first.role === "D" ? { x: 33, z: s * 15 } : { x: 68, z: s * 21 };
  if (a2 && a2.id !== first.id) {
    S.key(a2.id, 0, { x: 56, z: s * 34 });
    S.key(a2.id, 0.8, { x: 60, z: s * 33 });
    S.key(a2.id, 3.5, { x: 64, z: s * 26 });
    S.puck.push({ kind: "carry", who: a2.id, t0: 0, t1: 0.8 });
    S.key(first.id, 0, { x: from.x - 4, z: from.z * 0.8 });
    S.key(first.id, 1.15, from);
    pass(S, a2.id, first.id, 0.8, 1.15);
  } else {
    S.key(first.id, 0, { x: from.x - 6, z: from.z * 1.1 });
    S.key(first.id, 1.15, from);
    S.puck.push({ kind: "carry", who: first.id, t0: 0, t1: 1.15 });
  }
  S.key(first.id, 1.6, { x: from.x + 3, z: from.z * 0.9 });
  S.puck.push({ kind: "carry", who: first.id, t0: 1.15, t1: 1.6 });
  S.shootPose(first.id, 1.3, 1.95);
  S.key(first.id, 4, { x: from.x + 6, z: from.z * 0.7 });
  // first shot: the goalie gets a pad on it, it squirts into the blue paint
  const pad = { x: NET_X - 1.5, y: 0.5, z: s * 1.2 };
  const tHit = 1.6 + dist(from, pad) / 105;
  S.puck.push({ kind: "fly", t0: 1.6, t1: tHit, from: { who: first.id }, to: { at: pad }, lift: 0.3, y1: 0.5 });
  S.cues.push({ t: 1.6, kind: "shot" }, { t: tHit, kind: "save" });
  const loose = { x: NET_X - 5.5, y: 0, z: -s * (1.5 + rng.next() * 2) };
  S.puck.push({ kind: "fly", t0: tHit, t1: tHit + 0.3, from: { at: pad }, to: { at: loose }, lift: 0.5 });
  S.key(shooter.id, 0, { x: 72, z: -s * 9 });
  S.key(shooter.id, 1.6, { x: 78, z: -s * 6 });
  S.key(shooter.id, tHit + 0.3, { x: loose.x - 1.8, z: loose.z });
  S.puck.push({ kind: "rest", t0: tHit + 0.3, t1: tHit + 0.36, at: loose });
  const t = tHit + 0.36;
  S.shootPose(shooter.id, t - 0.15, t + 0.35);
  S.target = { x: NET_X + 0.15, y: 0.4 + rng.next() * 1.4, z: -s * (2 + rng.next() * 0.7) };
  if (spec.outcome !== "goal") S.target.z *= 0.4;
  S.shotT = t; S.arriveT = t + 0.13;
  S.cues.push({ t, kind: "shot" });
  S.puck.push({ kind: "fly", t0: t, t1: S.arriveT, from: { at: loose }, to: { at: { ...S.target } }, lift: 0, y1: S.target.y });
  S.key(shooter.id, t + 1.2, { x: NET_X - 4, z: -s * 7 });
  finishShot(c);
  placeOthers(c, [loose, from], S.arriveT + 3.5);
}

function playWrap(c: Ctx) {
  const { S, s, shooter, rng, spec } = c;
  S.key(shooter.id, 0, { x: 76, z: -s * 31 });
  S.key(shooter.id, 0.9, { x: 90, z: -s * 19 });
  S.key(shooter.id, 1.7, { x: 96.5, z: -s * 5 });
  S.key(shooter.id, 2.3, { x: 94.5, z: s * 4.5 });
  const tuck = { x: NET_X - 0.4, z: s * 4 };
  S.key(shooter.id, 2.75, tuck);
  S.puck.push({ kind: "carry", who: shooter.id, t0: 0, t1: 2.75 });
  S.shootPose(shooter.id, 2.6, 3.0);
  S.target = { x: NET_X + 0.3, y: 0.25 + rng.next() * 0.4, z: s * (spec.outcome === "goal" ? 2.3 : 1.5) };
  S.shotT = 2.75; S.arriveT = 2.87;
  S.cues.push({ t: 2.75, kind: "shot" });
  S.puck.push({ kind: "fly", t0: 2.75, t1: 2.87, from: { who: shooter.id }, to: { at: { ...S.target } }, lift: 0, y1: S.target.y });
  S.key(shooter.id, 3.8, { x: 80, z: s * 12 });
  finishShot(c);
  placeOthers(c, [tuck], S.arriveT + 3.5);
}

function playDeflect(c: Ctx) {
  const { S, s, rng, shooter, a1, a2, spec } = c;
  const pointMan = (a1 && a1.role === "D" ? a1 : null) ?? a1 ?? c.others.find((o) => o.role === "D") ?? c.others[0];
  if (!pointMan) return playCycle(c);
  const pt = { x: 32, z: s * (10 + rng.next() * 8) };
  if (a2 && a2.id !== pointMan.id) {
    S.key(a2.id, 0, { x: 50, z: s * 35 }); S.key(a2.id, 0.7, { x: 46, z: s * 34 }); S.key(a2.id, 3.5, { x: 58, z: s * 30 });
    S.puck.push({ kind: "carry", who: a2.id, t0: 0, t1: 0.7 });
    S.key(pointMan.id, 0, { x: 30, z: pt.z + s * 6 }); S.key(pointMan.id, 1.05, pt);
    pass(S, a2.id, pointMan.id, 0.7, 1.05);
  } else {
    S.key(pointMan.id, 0, { x: 28, z: pt.z + s * 10 }); S.key(pointMan.id, 1.05, pt);
    S.puck.push({ kind: "carry", who: pointMan.id, t0: 0, t1: 1.05 });
  }
  S.key(pointMan.id, 1.7, { x: pt.x + 2, z: pt.z * 0.8 });
  S.puck.push({ kind: "carry", who: pointMan.id, t0: 1.05, t1: 1.7 });
  S.shootPose(pointMan.id, 1.25, 2.0);
  S.key(pointMan.id, 4.5, { x: pt.x + 3, z: pt.z * 0.6 });
  const screen = { x: NET_X - 6.5, z: s * 1 };
  S.key(shooter.id, 0, { x: 78, z: -s * 10 });
  S.key(shooter.id, 1.6, { x: screen.x - 1, z: screen.z - s * 2 });
  const tTip = 1.7 + dist(pt, screen) / 120;
  S.key(shooter.id, tTip, screen);
  S.cues.push({ t: 1.7, kind: "shot" });
  const stick = { x: screen.x + 1.8, y: 0.8, z: screen.z };
  S.puck.push({ kind: "fly", t0: 1.7, t1: tTip, from: { who: pointMan.id }, to: { at: stick }, lift: 0.4, y1: 0.8 });
  S.shootPose(shooter.id, tTip - 0.15, tTip + 0.3);
  S.target = { x: NET_X + 0.15, y: rng.chance(0.5) ? 0.3 : 2.4, z: (rng.chance(0.5) ? 1 : -1) * (spec.outcome === "goal" ? 2.3 : 1.2) };
  S.shotT = tTip; S.arriveT = tTip + 0.09;
  S.puck.push({ kind: "fly", t0: tTip, t1: S.arriveT, from: { at: stick }, to: { at: { ...S.target } }, lift: 0, y0: 0.8, y1: S.target.y });
  S.key(shooter.id, tTip + 1.2, { x: screen.x + 2, z: screen.z - s * 7 });
  finishShot(c);
  placeOthers(c, [pt, screen], S.arriveT + 3.5);
}

function playEmptyNet(c: Ctx) {
  const { S, s, rng, shooter } = c;
  const st = { x: -34, z: s * 22 };
  S.key(shooter.id, 0, st);
  S.key(shooter.id, 1.3, { x: -12, z: s * 12 });
  const rel = { x: -4, z: s * 8 };
  S.key(shooter.id, 1.8, rel);
  S.puck.push({ kind: "carry", who: shooter.id, t0: 0, t1: 1.8 });
  S.shootPose(shooter.id, 1.5, 2.1);
  S.target = { x: NET_X + 0.2, y: 0.12, z: (rng.next() - 0.5) * 2.5 };
  const d = dist(rel, S.target);
  S.shotT = 1.8; S.arriveT = 1.8 + d / 62;
  S.cues.push({ t: 1.8, kind: "shot" });
  S.puck.push({ kind: "fly", t0: 1.8, t1: S.arriveT, from: { who: shooter.id }, to: { at: { ...S.target } }, lift: 0, y1: 0.12 });
  S.key(shooter.id, S.arriveT, { x: 30, z: s * 4 });
  finishShot(c);
  let k = 0;
  for (const o of c.all) {
    if (S.keys.has(o.id)) continue;
    const z = (k % 2 ? 1 : -1) * (10 + 7 * k); k++;
    S.key(o.id, 0, { x: -55 + rng.next() * 10, z });
    S.key(o.id, S.arriveT + 3, { x: -10, z: z * 0.7 });
  }
}

// ---- sampling -------------------------------------------------------------------------

/** Build a clip for one shot (goal / save / miss / block / post). */
export function buildShotClip(spec: ShotSpec): Clip {
  const rng = new RNG(spec.seed || 1);
  const s = rng.chance(0.5) ? 1 : -1;
  const S = new Script();
  const all = spec.attackers;
  const shooter = all.find((a) => a.id === spec.shooterId) ?? all[0];
  const [a1, a2] = (spec.assistIds ?? []).map((id) => all.find((a) => a.id === id) ?? null);
  const others = all.filter((a) => a.id !== shooter.id && a.id !== a1?.id && a.id !== a2?.id);
  const ctx: Ctx = { spec, rng, s, S, all, shooter, a1: a1 ?? null, a2: a2 ?? null, others };
  // an assister the play didn't use still needs to stand somewhere
  const ensureAll = () => {
    for (const a of all) if (!S.keys.has(a.id) && !ctx.others.includes(a)) ctx.others.push(a);
    placeOthers(ctx, [], S.arriveT + 3.5);
  };

  const play = (spec.play ?? "").toLowerCase();
  const type = (spec.shotType ?? "").toUpperCase();
  if (spec.emptyNet || !spec.goalie) playEmptyNet(ctx);
  else if (spec.rush) playRush(ctx);
  else if (play === "rebound") playRebound(ctx);
  else if (play === "wrap") playWrap(ctx);
  else if (play === "deflect" || type === "TIP") playDeflect(ctx);
  else playCycle(ctx);
  ensureAll();

  const goal = spec.outcome === "goal";
  const tail = goal ? 3.4 : 1.6;
  const duration = S.arriveT + tail;

  // celebration: scorer peels off toward the boards, the others pile in
  if (goal) {
    const g0 = S.arriveT + 0.25;
    const sp = S.at(shooter.id, g0);
    const corner = clampRink(Math.min(sp.x + 6, 80), Math.sign(sp.z || s) * 36, 4);
    const k = S.keys.get(shooter.id)!; while (k.length && k[k.length - 1].t > g0) k.pop();
    S.key(shooter.id, g0, sp);
    S.key(shooter.id, g0 + 1.4, corner);
    S.key(shooter.id, duration, { x: corner.x - 3, z: corner.z * 0.92 });
    let i = 0;
    for (const a of all) {
      if (a.id === shooter.id) continue;
      const kk = S.keys.get(a.id)!; while (kk.length && kk[kk.length - 1].t > g0) kk.pop();
      S.key(a.id, g0, S.at(a.id, g0));
      const ang = (i++ / Math.max(1, all.length - 1)) * Math.PI - Math.PI / 2;
      S.key(a.id, Math.min(duration, g0 + 1.9 + rng.next() * 0.5), { x: corner.x - 3 - Math.cos(ang) * 3.5, z: corner.z - Math.sign(corner.z) * (2.5 + Math.sin(ang) * 2.5) });
      S.key(a.id, duration, { x: corner.x - 4 - Math.cos(ang) * 3, z: corner.z - Math.sign(corner.z) * (2.5 + Math.sin(ang) * 2.5) });
    }
  }

  return finalize(spec, S, { goal, duration, shooter });
}

type SceneSpec = Pick<ShotSpec, "attackSide" | "attackDir" | "attackers" | "defenders" | "goalie" | "ownGoalie" | "rush" | "emptyNet"> & { outcome: ShotSpec["outcome"] | "none" };

/** Sample a planned script into frames: keyed skaters, the puck, then steered defenders + goalies. */
function finalize(spec: SceneSpec, S: Script, o: { goal: boolean; duration: number; shooter: Actor | null }): Clip {
  const { goal, duration, shooter } = o;
  const all = spec.attackers;
  const actors: Actor[] = [...all, ...spec.defenders, ...(spec.goalie ? [spec.goalie] : []), ...(spec.ownGoalie ? [spec.ownGoalie] : [])];
  const nF = Math.ceil(duration * FPS) + 1;
  const idx = new Map(actors.map((a, i) => [a.id, i]));
  const frames: ClipFrame[] = [];
  const heading = (arr: P[], f: number, prev: number): { h: number; v: number } => {
    const a = arr[Math.max(0, f - 2)], b = arr[Math.min(arr.length - 1, f + 2)];
    const dx = b.x - a.x, dz = b.z - a.z, span = (Math.min(arr.length - 1, f + 2) - Math.max(0, f - 2)) / FPS || 1;
    const v = Math.hypot(dx, dz) / span;
    return { h: v > 2.5 ? Math.atan2(dz, dx) : prev, v };
  };

  // pass 1: everyone with a scripted path (all attackers; defenders only when a play keys them)
  const keyed = new Map<string, P[]>();
  const keyedHead = new Map<string, number[]>();
  for (const a of [...all, ...spec.defenders]) {
    const k = S.keys.get(a.id);
    if (!k) continue;
    const arr = Array.from({ length: nF }, (_, f) => keyAt(k, f / FPS));
    keyed.set(a.id, arr);
    let h = a.side === spec.attackSide ? 0 : Math.PI;
    keyedHead.set(a.id, arr.map((_, f) => { const r = heading(arr, f, h); h = r.h; return h; }));
  }
  const atkPos: P[][] = all.map((a) => keyed.get(a.id)!);

  // pass 2: the puck
  const blade = (who: string, f: number) => {
    const arr = keyed.get(who), hs = keyedHead.get(who);
    const ff = Math.min(nF - 1, Math.max(0, f));
    const p = arr ? arr[ff] : { x: 0, z: 0 }, h = hs ? hs[ff] : 0;
    return { x: p.x + Math.cos(h) * 2.4 - Math.sin(h) * 0.9, y: 0.06, z: p.z + Math.sin(h) * 2.4 + Math.cos(h) * 0.9 };
  };
  const evalSeg = (seg: PuckSeg, t: number): PuckState => {
    const f = Math.round(t * FPS);
    if (seg.kind === "carry") { const b = blade(seg.who, f); const wob = Math.sin(t * 9) * 0.35; return { x: b.x + wob * 0.3, y: 0.06, z: b.z + wob, flying: false }; }
    if (seg.kind === "rest") return { x: seg.at.x, y: Math.max(0.06, seg.at.y), z: seg.at.z, flying: false };
    const k = clamp01((t - seg.t0) / (seg.t1 - seg.t0 || 1e-6));
    const A = "who" in seg.from ? blade(seg.from.who, Math.round(seg.t0 * FPS)) : seg.from.at;
    const B = "who" in seg.to ? blade(seg.to.who, Math.round(seg.t1 * FPS)) : seg.to.at;
    const y0 = seg.y0 ?? A.y ?? 0.06, y1 = seg.y1 ?? B.y ?? 0.06;
    const y = Math.max(0.06, lerp(y0, y1, k) + (seg.lift ?? 0) * 4 * k * (1 - k));
    return { x: lerp(A.x, B.x, k), y, z: lerp(A.z, B.z, k), flying: k < 1 };
  };
  const puck: PuckState[] = [];
  for (let f = 0; f < nF; f++) {
    const t = f / FPS;
    const seg = S.puck.find((p) => t >= p.t0 && t < p.t1);
    if (seg) { puck.push(evalSeg(seg, t)); continue; }
    // between two scripted moments: hold wherever the last one left it
    let last: PuckSeg | null = null;
    for (const p of S.puck) if (p.t1 <= t && (!last || p.t1 > last.t1)) last = p;
    puck.push(last ? evalSeg(last, last.kind === "carry" ? t : last.t1) : S.puck[0] ? evalSeg(S.puck[0], t) : { x: 0, y: 0.06, z: 0, flying: false });
  }

  // pass 3: unscripted defenders + goalies steer toward where they ought to be
  const netD = { x: NET_X, z: 0 };
  const hasShot = S.shotT > 0 && S.shotT < duration;
  const shotF = hasShot ? Math.round(S.shotT * FPS) : nF + 999;
  const arriveF = hasShot ? Math.round(S.arriveT * FPS) : nF + 999;
  const refF = Math.min(nF - 1, hasShot ? shotF : Math.round(nF / 2));
  const threat = all.map((_, i) => dist(atkPos[i][refF], netD));
  const order = all.map((_, i) => i).sort((p, q) => threat[p] - threat[q]);
  const defs = spec.defenders;
  const steered = defs.filter((d) => !keyed.has(d.id));
  const mark = new Map<string, number>();
  const freeD = [...steered].sort((a, b) => (a.role === "D" ? 0 : 1) - (b.role === "D" ? 0 : 1));
  for (const ai of order) { const d = freeD.shift(); if (!d) break; mark.set(d.id, ai); }
  const shooterIdx = shooter ? all.indexOf(shooter) : -1;
  const rushBack = spec.rush === "3ON2" ? 2 : spec.rush === "2ON1" ? 1 : 0;
  const defPos = new Map<string, P[]>();
  const goalF = goal ? arriveF : Infinity;
  steered.forEach((d, di) => {
    const ai = mark.get(d.id);
    const desiredAt = (f: number): P => {
      const pk = puck[f];
      if (spec.rush || spec.emptyNet) {
        // rush: the last men back retreat between puck and net, the rest chase from behind
        if (di < rushBack) { const back = Math.max(9, 26 - (pk.x - 30) * 0.3); const ux = netD.x - pk.x, uz = netD.z - pk.z, n = Math.hypot(ux, uz) || 1; return { x: netD.x - (ux / n) * back + (di ? 6 : -6) * (rushBack - 1), z: netD.z - (uz / n) * back + (di ? 5 : -5) * (rushBack - 1) }; }
        const tgt = ai != null ? atkPos[ai][Math.max(0, f - 14)] : pk;
        return { x: tgt.x - 6, z: tgt.z + (di % 2 ? 3 : -3) };
      }
      if (ai == null) return { x: lerp(pk.x, netD.x, 0.5), z: pk.z * 0.4 };
      const lag = ai === shooterIdx ? 13 : 8;
      const a = atkPos[ai][Math.max(0, f - lag)];
      const ux = netD.x - a.x, uz = netD.z - a.z, n = Math.hypot(ux, uz) || 1;
      const gap = ai === shooterIdx ? 6.5 : 4.5;
      let p = { x: a.x + (ux / n) * gap, z: a.z + (uz / n) * gap };
      // whoever marks the puck carrier steps up on him a little
      if (dist(a, pk) < 5) p = { x: lerp(p.x, pk.x, 0.25), z: lerp(p.z, pk.z, 0.25) };
      if (spec.outcome === "block" && f >= shotF - 6 && di === 0) {
        const lane = { x: lerp(puck[shotF]?.x ?? a.x, S.target.x, 0.3), z: lerp(puck[shotF]?.z ?? a.z, S.target.z, 0.3) };
        p = { x: lane.x + 1, z: lane.z };
      }
      return p;
    };
    let cur = desiredAt(0);
    const vel = { x: 0, z: 0 };
    const maxV = spec.rush ? 25 : 22, acc = 40;
    const out: P[] = [];
    for (let f = 0; f < nF; f++) {
      let want = desiredAt(f);
      if (f > goalF) want = { x: cur.x + vel.x * 0.3, z: cur.z + vel.z * 0.3 }; // stunned glide after the goal
      const dx = want.x - cur.x, dz = want.z - cur.z, n = Math.hypot(dx, dz);
      const wantV = Math.min(maxV, n * 3);
      const tvx = n > 0.01 ? (dx / n) * wantV : 0, tvz = n > 0.01 ? (dz / n) * wantV : 0;
      const ax = tvx - vel.x, az = tvz - vel.z, an = Math.hypot(ax, az), lim = acc / FPS;
      vel.x += an > lim ? (ax / an) * lim : ax; vel.z += an > lim ? (az / an) * lim : az;
      if (f > goalF) { vel.x *= 0.96; vel.z *= 0.96; }
      cur = clampRink(cur.x + vel.x / FPS, cur.z + vel.z / FPS);
      out.push(cur);
    }
    defPos.set(d.id, out);
  });

  // goalie: on the arc between puck and net, late on a goal, square on a save
  const gPos: P[] = []; const gPose: number[] = [];
  if (spec.goalie) {
    let cur: P = { x: NET_X - 3, z: 0 };
    for (let f = 0; f < nF; f++) {
      const pk = puck[f];
      let want: P;
      if (pk.x > NET_X - 0.5) want = { x: NET_X - 1.2, z: Math.sign(pk.z || 1) * 2.2 };
      else { const ux = pk.x - NET_X, uz = pk.z, n = Math.hypot(ux, uz) || 1, out = n < 12 ? 1.8 : 3.4; want = { x: NET_X + (ux / n) * out, z: (uz / n) * out }; }
      const inFlight = f >= shotF && f <= arriveF;
      if (inFlight && spec.outcome === "save") want = { x: NET_X - 2, z: S.target.z * 0.9 };
      const k = inFlight ? (spec.outcome === "goal" ? 0.05 : 0.35) : 0.18;
      cur = { x: lerp(cur.x, want.x, k), z: lerp(cur.z, want.z, k) };
      gPos.push(cur);
      const low = S.target.y < 1.6;
      gPose.push(f >= shotF - 3 && f <= arriveF + 18 && low ? POSE.BUTTERFLY : POSE.SKATE);
    }
  }

  // assemble frames (+ mirror for the other attacking direction)
  const dir = spec.attackDir;
  const flip = dir < 0 ? Math.PI : 0;
  const poseFor = (a: Actor, t: number): { pose: number; poseT: number } => {
    const win = S.shooting.get(a.id)?.find((w) => t >= w.t0 && t <= w.t1);
    if (win) return { pose: POSE.SHOOT, poseT: (t - win.t0) / (win.t1 - win.t0) };
    if (goal && shooter && a.side === spec.attackSide && a.role !== "G") {
      const since = t - S.arriveT;
      if (a.id === shooter.id && since > 0.45) return { pose: POSE.CELEBRATE, poseT: since };
      if (a.id !== shooter.id && since > 2.0) return { pose: POSE.CELEBRATE, poseT: since - 2.0 };
    }
    return { pose: POSE.SKATE, poseT: 0 };
  };
  const mir = (p: P): P => ({ x: p.x * dir, z: p.z * dir });
  const defHead = new Map<string, number>(steered.map((d) => [d.id, Math.PI]));
  let gHead = Math.PI;
  for (let f = 0; f < nF; f++) {
    const t = f / FPS;
    const a: ActorState[] = new Array(actors.length);
    for (const [id, arr] of keyed) {
      const act = actors[idx.get(id)!];
      const p = mir(arr[f]);
      const { v } = heading(arr, f, 0);
      a[idx.get(id)!] = { x: p.x, z: p.z, h: keyedHead.get(id)![f] + flip, speed: v, ...poseFor(act, t) };
    }
    for (const [id, arr] of defPos) {
      const r = heading(arr, f, defHead.get(id)!);
      // slow-moving defenders turn to face the puck
      if (r.v < 4) { const pk = puck[f], q = arr[f]; defHead.set(id, Math.atan2(pk.z - q.z, pk.x - q.x)); } else defHead.set(id, r.h);
      const p = mir(arr[f]);
      a[idx.get(id)!] = { x: p.x, z: p.z, h: defHead.get(id)! + flip, speed: r.v, pose: POSE.SKATE, poseT: 0 };
    }
    if (spec.goalie) {
      const q = gPos[f], pk = puck[f];
      gHead = Math.atan2(pk.z - q.z, pk.x - q.x);
      if (pk.x > NET_X) gHead = Math.PI;
      const p = mir(q);
      a[idx.get(spec.goalie.id)!] = { x: p.x, z: p.z, h: gHead + flip, speed: 0, pose: gPose[f], poseT: 0 };
    }
    if (spec.ownGoalie) {
      const q = { x: -NET_X + 3, z: 0 }, pk = puck[f];
      const p = mir(q);
      a[idx.get(spec.ownGoalie.id)!] = { x: p.x, z: p.z, h: Math.atan2(pk.z, pk.x - q.x) + flip, speed: 0, pose: POSE.SKATE, poseT: 0 };
    }
    const pk = puck[f];
    frames.push({ a, p: { x: pk.x * dir, y: pk.y, z: pk.z * dir, flying: pk.flying } });
  }

  return {
    duration, fps: FPS, actors, frames, cues: S.cues.filter((c) => c.t <= duration).sort((p, q) => p.t - q.t),
    attackDir: dir, attackSide: spec.attackSide, shotT: hasShot ? S.shotT : null, goalT: goal ? S.arriveT : null,
  };
}

// ---- live-view clips (no shot) -------------------------------------------------------

export type SceneInput = Omit<SceneSpec, "outcome"> & { seed: number };

function sceneCtx(spec: SceneInput): { S: Script; rng: RNG; s: number; ctx: Ctx } {
  const rng = new RNG(spec.seed || 1);
  const s = rng.chance(0.5) ? 1 : -1;
  const S = new Script();
  S.shotT = S.arriveT = 1e9;
  const shot: ShotSpec = { ...spec, outcome: "save", shooterId: spec.attackers[0]?.id ?? "", seed: spec.seed };
  const ctx: Ctx = { spec: shot, rng, s, S, all: spec.attackers, shooter: spec.attackers[0], a1: null, a2: null, others: [...spec.attackers] };
  return { S, rng, s, ctx };
}

/** Puck possession with no shot: OZ cycle, a neutral-zone carry, or a breakout from the own end. */
export function buildFlowClip(spec: SceneInput & { zone?: "OFF" | "NEU" | "DEF"; duration?: number }): Clip {
  const { S, rng, s } = sceneCtx(spec);
  const dur = spec.duration ?? 3.4;
  const atk = spec.attackers;
  const { f, d } = splitRoles(atk);
  const zone = spec.zone ?? "OFF";
  const spots: P[] = zone === "OFF"
    ? [{ x: 62, z: s * 33 }, { x: 34, z: s * 16 }, { x: 34, z: -s * 15 }, { x: 64, z: -s * 32 }, { x: 80, z: -s * 24 }]
    : zone === "NEU"
      ? [{ x: -20, z: s * 12 }, { x: 4, z: s * 18 }, { x: 18, z: -s * 14 }, { x: 30, z: s * 26 }]
      : [{ x: -91, z: s * 8 }, { x: -70, z: -s * 20 }, { x: -60, z: s * 35 }, { x: -30, z: s * 30 }];
  const order = [...d, ...f];
  const carriers = order.slice(0, Math.min(order.length, 3 + rng.int(2)));
  let t = 0, prev: Actor | null = null;
  carriers.forEach((c, i) => {
    const spot = spots[i % spots.length];
    if (prev) { const pt = 0.45; pass(S, prev.id, c.id, t, t + pt); t += pt; }
    S.key(c.id, Math.max(0, t - 0.6), { x: spot.x - 4, z: spot.z * 0.9 });
    S.key(c.id, t, spot);
    const hold = Math.max(0.5, (dur - t) / Math.max(1, carriers.length - i) - 0.45);
    S.key(c.id, t + hold, { x: spot.x + (zone === "OFF" ? 3 : 10), z: spot.z * 0.92 });
    S.puck.push({ kind: "carry", who: c.id, t0: t, t1: t + hold }); t += hold;
    S.key(c.id, dur + 1, { x: spot.x + (zone === "OFF" ? 4 : 18), z: spot.z * 0.85 });
    prev = c;
  });
  // everyone else holds a shape for that zone, drifting with the play
  const shift = zone === "OFF" ? 0 : zone === "NEU" ? -55 : -120;
  for (const o of atk) {
    if (S.keys.has(o.id)) continue;
    const i = atk.indexOf(o);
    const base: P = o.role === "D" ? { x: 33 + shift * 0.9, z: (i % 2 ? 1 : -1) * 16 } : { x: 76 + shift, z: (i % 3 - 1) * 20 };
    S.key(o.id, 0, base);
    S.key(o.id, dur * 0.5, { x: base.x + 3, z: base.z + (rng.next() - 0.5) * 6 });
    S.key(o.id, dur + 1, { x: base.x + (zone === "OFF" ? 2 : 14), z: base.z });
  }
  return finalize({ ...spec, outcome: "none" }, S, { goal: false, duration: dur, shooter: null });
}

/** A body check along the boards: the hit, the puck squirting loose. */
export function buildHitClip(spec: SceneInput & { hitterId: string; victimId: string }): Clip {
  const { S, s, ctx } = sceneCtx(spec);
  const victim = spec.attackers.find((a) => a.id === spec.victimId) ?? spec.attackers[0];
  const hitter = spec.defenders.find((a) => a.id === spec.hitterId) ?? spec.defenders[0];
  const wall = s * (RINK.halfWidth - 3);
  S.key(victim.id, 0, { x: 34, z: wall * 0.92 });
  S.key(victim.id, 1.45, { x: 58, z: wall });
  S.key(victim.id, 1.75, { x: 60.5, z: wall + s * 0.4 });
  S.key(victim.id, 2.9, { x: 63, z: wall * 0.97 });
  S.puck.push({ kind: "carry", who: victim.id, t0: 0, t1: 1.45 });
  const loose = clampRink(66, wall - s * 9);
  S.puck.push({ kind: "fly", t0: 1.45, t1: 2.1, from: { who: victim.id }, to: { at: { x: loose.x, y: 0, z: loose.z } }, lift: 0.3 });
  S.puck.push({ kind: "rest", t0: 2.1, t1: 99, at: { x: loose.x, y: 0, z: loose.z } });
  if (hitter) {
    S.key(hitter.id, 0, { x: 70, z: wall - s * 14 });
    S.key(hitter.id, 1.0, { x: 63, z: wall - s * 5 });
    S.key(hitter.id, 1.5, { x: 59.5, z: wall - s * 1.6 });
    S.key(hitter.id, 2.9, { x: 61, z: wall - s * 2.2 });
  }
  S.cues.push({ t: 1.5, kind: "hit" });
  placeOthers(ctx, [{ x: 58, z: wall }], 3);
  return finalize({ ...spec, outcome: "none" }, S, { goal: false, duration: 2.9, shooter: null });
}

/** A faceoff: both units lined up on the dot, the drop, the draw back to the winners' point. */
export function buildFaceoffClip(spec: SceneInput & { dot: P }): Clip {
  const { S, rng } = sceneCtx(spec);
  const dot = spec.dot;
  const side = (p: P): P => clampRink(p.x, p.z, 3);
  const line = (list: Actor[], sign: 1 | -1, winner: boolean) => {
    const { f, d } = splitRoles(list);
    const c = f.find((x) => x.role === "F") ?? f[0];
    const wings = f.filter((x) => x !== c);
    const spots: Array<[Actor | undefined, P]> = [
      [c, { x: dot.x - sign * 2.1, z: dot.z }],
      [wings[0], { x: dot.x - sign * 3.5, z: dot.z + 14 }], [wings[1], { x: dot.x - sign * 3.5, z: dot.z - 14 }],
      [d[0], { x: dot.x - sign * 22, z: dot.z + 9 }], [d[1], { x: dot.x - sign * 22, z: dot.z - 9 }],
    ];
    for (const extra of wings.slice(2)) spots.push([extra, { x: dot.x - sign * 12, z: dot.z }]);
    for (const extra of d.slice(2)) spots.push([extra, { x: dot.x - sign * 30, z: dot.z }]);
    spots.forEach(([a, p]) => {
      if (!a) return;
      const q = side(p);
      S.key(a.id, 0, { x: q.x - sign * 0.3, z: q.z });
      S.key(a.id, 1.0, q);
      const go = winner ? 9 : -6;
      S.key(a.id, 2.6, side({ x: q.x + sign * go * (a === c ? 0.4 : 1), z: q.z + (rng.next() - 0.5) * 6 }));
      S.key(a.id, 3.4, side({ x: q.x + sign * go * 1.6, z: q.z + (rng.next() - 0.5) * 8 }));
    });
    return { c, d };
  };
  const win = line(spec.attackers, 1, true);
  line(spec.defenders, -1, false);
  S.puck.push({ kind: "fly", t0: 0, t1: 0.95, from: { at: { x: dot.x, y: 4.2, z: dot.z } }, to: { at: { x: dot.x, y: 0.06, z: dot.z } }, lift: 0, y0: 4.2, y1: 0.06 });
  const back = win.d[rng.int(Math.max(1, win.d.length))] ?? win.c;
  if (back) {
    S.puck.push({ kind: "fly", t0: 1.05, t1: 1.5, from: { at: { x: dot.x, y: 0.06, z: dot.z } }, to: { who: back.id }, lift: 0 });
    S.puck.push({ kind: "carry", who: back.id, t0: 1.5, t1: 99 });
    S.cues.push({ t: 1.05, kind: "pass" });
  }
  if (win.c) S.shootPose(win.c.id, 0.9, 1.25);
  return finalize({ ...spec, outcome: "none" }, S, { goal: false, duration: 3.4, shooter: null });
}

/** Interpolated state at time t (between the 30 fps samples). */
export function clipAt(clip: Clip, t: number): ClipFrame {
  const ft = Math.max(0, Math.min(clip.frames.length - 1, t * clip.fps));
  const i = Math.floor(ft), k = ft - i;
  const A = clip.frames[i], B = clip.frames[Math.min(clip.frames.length - 1, i + 1)];
  if (k < 1e-3 || A === B) return A;
  const angle = (p: number, q: number) => { let d = q - p; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return p + d * k; };
  return {
    a: A.a.map((s, j) => { const e = B.a[j]; return { x: lerp(s.x, e.x, k), z: lerp(s.z, e.z, k), h: angle(s.h, e.h), speed: lerp(s.speed, e.speed, k), pose: e.pose, poseT: lerp(s.poseT, e.poseT, k) }; }),
    p: { x: lerp(A.p.x, B.p.x, k), y: lerp(A.p.y, B.p.y, k), z: lerp(A.p.z, B.p.z, k), flying: B.p.flying },
  };
}

/** Which end a team attacks in a period: home shoots at +x in periods 1 and 3 (teams swap every period). */
export function attackDirFor(side: Side, period: number): 1 | -1 {
  const odd = period % 2 === 1;
  return (side === "home") === odd ? 1 : -1;
}

/** Seed from anything stable about the moment (game, period, second, team). */
export function momentSeed(...parts: Array<number | string | null | undefined>): number {
  let h = 2166136261;
  for (const p of parts) { const s = String(p ?? ""); for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); h = Math.imul(h ^ 124, 16777619); }
  return h >>> 0;
}

export { smooth };
