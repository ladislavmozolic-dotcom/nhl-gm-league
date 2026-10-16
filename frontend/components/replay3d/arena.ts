// The building around the ice: dasher boards with (made-up) league ads, glass
// with stanchions, both benches with subs on them, penalty boxes, a two-tier
// seating bowl with aisles, an LED ribbon, the roof with its light rigs — and the
// crowd. Seats are filled to the game's real occupancy (attendance ÷ capacity),
// empty seats show first up in the corners and the upper deck, and the fans bounce
// (a vertex-shader bob, no per-frame CPU work) and jump when their team scores.

import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { RINK } from "@/lib/replay3d/reconstruct";
import type { Kit } from "@/lib/replay3d/team-colors";

export type ArenaOpts = { homeKit: Kit; awayKit: Kit; occupancy: number; small: boolean; homeCode: string; awayCode: string; homeName: string };

export function roundedRect(path: THREE.Shape | THREE.Path, hx: number, hz: number, r: number) {
  path.moveTo(-hx + r, -hz);
  path.lineTo(hx - r, -hz); path.absarc(hx - r, -hz + r, r, -Math.PI / 2, 0, false);
  path.lineTo(hx, hz - r); path.absarc(hx - r, hz - r, r, 0, Math.PI / 2, false);
  path.lineTo(-hx + r, hz); path.absarc(-hx + r, hz - r, r, Math.PI / 2, Math.PI, false);
  path.lineTo(-hx, -hz + r); path.absarc(-hx + r, -hz + r, r, Math.PI, 1.5 * Math.PI, false);
}

/** A flat ring between two rounded rectangles, extruded upward (boards, glass, stands). */
export function ringGeometry(inner: number, outer: number, height: number): THREE.BufferGeometry {
  const s = new THREE.Shape();
  roundedRect(s, RINK.halfLength + outer, RINK.halfWidth + outer, RINK.cornerR + outer);
  const hole = new THREE.Path();
  roundedRect(hole, RINK.halfLength + inner, RINK.halfWidth + inner, Math.max(1, RINK.cornerR + inner));
  s.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(s, { depth: height, bevelEnabled: false, curveSegments: 20 });
  g.rotateX(-Math.PI / 2); // shape y → −z, extrusion → +y
  return g;
}

type OP = { x: number; z: number; nx: number; nz: number };
export function outlineLength(offset: number): number {
  const r = RINK.cornerR + offset;
  return 2 * 2 * (RINK.halfLength - RINK.cornerR) + 2 * 2 * (RINK.halfWidth - RINK.cornerR) + 2 * Math.PI * r;
}

/** Point on the rounded rink outline `offset` ft outside the boards, u ∈ [0,1). */
export function outlinePoint(offset: number, u: number): OP {
  const hx = RINK.halfLength + offset, hz = RINK.halfWidth + offset, r = RINK.cornerR + offset;
  const sx = 2 * (hx - r), sz = 2 * (hz - r), arc = (Math.PI / 2) * r;
  const L = 2 * sx + 2 * sz + 4 * arc;
  let d = (((u % 1) + 1) % 1) * L;
  const segs: Array<[number, (k: number) => OP]> = [
    [sx, (k) => ({ x: -hx + r + k * sx, z: -hz, nx: 0, nz: -1 })],
    [arc, (k) => { const a = -Math.PI / 2 + k * Math.PI / 2; return { x: hx - r + Math.cos(a) * r, z: -hz + r + Math.sin(a) * r, nx: Math.cos(a), nz: Math.sin(a) }; }],
    [sz, (k) => ({ x: hx, z: -hz + r + k * sz, nx: 1, nz: 0 })],
    [arc, (k) => { const a = k * Math.PI / 2; return { x: hx - r + Math.cos(a) * r, z: hz - r + Math.sin(a) * r, nx: Math.cos(a), nz: Math.sin(a) }; }],
    [sx, (k) => ({ x: hx - r - k * sx, z: hz, nx: 0, nz: 1 })],
    [arc, (k) => { const a = Math.PI / 2 + k * Math.PI / 2; return { x: -hx + r + Math.cos(a) * r, z: hz - r + Math.sin(a) * r, nx: Math.cos(a), nz: Math.sin(a) }; }],
    [sz, (k) => ({ x: -hx, z: hz - r - k * sz, nx: -1, nz: 0 })],
    [arc, (k) => { const a = Math.PI + k * Math.PI / 2; return { x: -hx + r + Math.cos(a) * r, z: -hz + r + Math.sin(a) * r, nx: Math.cos(a), nz: Math.sin(a) }; }],
  ];
  for (const [len, f] of segs) { if (d <= len) return f(len ? d / len : 0); d -= len; }
  return segs[0][1](0);
}

/** A vertical band following the outline, facing the ice (ads, LED ribbon, back walls). */
function stripGeometry(offset: number, y0: number, y1: number, feetPerRepeat: number, segs = 360): THREE.BufferGeometry {
  const L = outlineLength(offset);
  const pos: number[] = [], uv: number[] = [], nor: number[] = [], idx: number[] = [];
  for (let i = 0; i <= segs; i++) {
    const p = outlinePoint(offset, i / segs);
    const u = (i / segs) * (L / feetPerRepeat);
    pos.push(p.x, y0, p.z, p.x, y1, p.z); uv.push(u, 0, u, 1); nor.push(-p.nx, 0, -p.nz, -p.nx, 0, -p.nz);
    if (i < segs) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  return g;
}

function canvasTex(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void, repeat = false): THREE.CanvasTexture {
  const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
  draw(cv.getContext("2d")!);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (repeat) { t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping; }
  return t;
}

let glowTex: THREE.CanvasTexture | null = null;
/** Soft radial dot for additive light halos (shared). */
export function glowTexture(): THREE.CanvasTexture {
  if (glowTex) return glowTex;
  glowTex = canvasTex(64, 64, (c) => {
    const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.25, "rgba(255,255,255,0.55)"); g.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = g; c.fillRect(0, 0, 64, 64);
  });
  return glowTex;
}

// made-up league partners only — never real brands
const ADS = ["UNHL", "ULTIMATE NATIONAL HOCKEY LEAGUE", "unhl.eu", "POWER PLAY", "FROZEN PUCK", "BLUE LINE", "HAT TRICK", "ONE TIMER", "SLAP SHOT", "TOP SHELF"];

/** Seats per tier: offset of the first row, rows, tread depth, riser, base height. */
const TIERS = [
  { o0: 8, rows: 16, tread: 2.7, rise: 1.2, y0: 1.2 },
  { o0: 53, rows: 14, tread: 2.9, rise: 1.65, y0: 24 },
];

export class Arena {
  group = new THREE.Group();
  private uniforms = { uTime: { value: 0 }, uCheerHome: { value: 0 }, uCheerAway: { value: 0 } };
  private cheerHomeUntil = 0; private cheerAwayUntil = 0; private cheerLevel = { home: 0, away: 0 };
  private ribbon: THREE.CanvasTexture | null = null;
  private clock = 0;
  private overhead: THREE.Object3D[] = [];

  constructor(private o: ArenaOpts) {
    this.boards();
    this.benches();
    this.bowl();
    this.crowd();
    this.roof();
  }

  private mesh(g: THREE.BufferGeometry, m: THREE.Material, y = 0, shadow = false) {
    const me = new THREE.Mesh(g, m); me.position.y = y; me.receiveShadow = shadow; me.castShadow = shadow; this.group.add(me); return me;
  }

  private boards() {
    const { homeKit } = this.o;
    this.mesh(ringGeometry(-0.06, 0.4, 0.8), new THREE.MeshStandardMaterial({ color: "#f2c230", roughness: 0.6 }), 0, true);
    this.mesh(ringGeometry(0, 0.7, 3.4), new THREE.MeshStandardMaterial({ color: "#f5f7fa", roughness: 0.55 }), 0, true);
    this.mesh(ringGeometry(-0.15, 1.1, 0.3), new THREE.MeshStandardMaterial({ color: "#122445", roughness: 0.5 }), 3.4, true);
    // dasher ads on the inside face of the boards
    const ads = canvasTex(4096, 160, (c) => {
      const n = 10, w = 4096 / n;
      for (let i = 0; i < n; i++) {
        const dark = i % 3 === 1;
        c.fillStyle = dark ? homeKit.jersey : i % 3 === 2 ? "#0f172a" : "#ffffff"; c.fillRect(i * w, 0, w, 160);
        c.fillStyle = dark ? "#ffffff" : i % 3 === 2 ? "#facc15" : "#0b3d91";
        const text = i === 4 ? this.o.homeName.toUpperCase() : ADS[i % ADS.length];
        c.font = `900 ${text.length > 16 ? 46 : 78}px Arial Black, Arial, sans-serif`; c.textAlign = "center"; c.textBaseline = "middle";
        c.fillText(text, i * w + w / 2, 84, w - 30);
        c.fillStyle = "rgba(0,0,0,0.15)"; c.fillRect(i * w + w - 3, 0, 3, 160);
      }
    }, true);
    this.mesh(stripGeometry(-0.08, 0.82, 3.25, 205), new THREE.MeshStandardMaterial({ map: ads, roughness: 0.5, side: THREE.FrontSide }));
    // glass + stanchions
    const glass = new THREE.MeshPhysicalMaterial({ color: "#d6ecff", roughness: 0.05, metalness: 0, transparent: true, opacity: 0.09, depthWrite: false, side: THREE.DoubleSide });
    this.mesh(ringGeometry(0.25, 0.4, 6.5), glass, 3.7);
    const L = outlineLength(0.33), n = Math.floor(L / 8);
    const st = new THREE.InstancedMesh(new THREE.BoxGeometry(0.16, 6.5, 0.16), new THREE.MeshStandardMaterial({ color: "#c7ced8", metalness: 0.6, roughness: 0.3 }), n);
    const m = new THREE.Matrix4();
    for (let i = 0; i < n; i++) { const p = outlinePoint(0.33, i / n); m.makeTranslation(p.x, 3.7 + 3.25, p.z); st.setMatrixAt(i, m); }
    this.group.add(st);
    // walkway behind the glass
    this.mesh(ringGeometry(1.1, 7, 0.5), new THREE.MeshStandardMaterial({ color: "#1a1f2b", roughness: 0.9 }));
  }

  /** Team benches on the far side, penalty boxes + timekeeper on the near side. */
  private benches() {
    const { homeKit, awayKit } = this.o;
    const floor = new THREE.MeshStandardMaterial({ color: "#2b2f3a", roughness: 0.9 });
    const wood = new THREE.MeshStandardMaterial({ color: "#3d4454", roughness: 0.7 });
    const wall = new THREE.MeshStandardMaterial({ color: "#121722", roughness: 0.8 });
    const box = (w: number, h: number, d: number, x: number, y: number, z: number, mat: THREE.Material) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); b.position.set(x, y, z); b.receiveShadow = true; this.group.add(b); return b; };
    const zf = -(RINK.halfWidth + 0.7);
    for (const [x0, kit] of [[-36, awayKit], [8, homeKit]] as const) {
      box(28, 0.6, 6, x0 + 14, 0.3, zf - 3, floor);
      box(28, 1.2, 1.6, x0 + 14, 1.2, zf - 4.6, wood);
      box(28, 4.5, 0.4, x0 + 14, 2.4, zf - 6, wall);
      // the guys on the bench: torso + helmet, a little uneven
      const jer = new THREE.MeshStandardMaterial({ color: kit.jersey, roughness: 0.7 });
      const hel = new THREE.MeshStandardMaterial({ color: kit.helmet, roughness: 0.35 });
      for (let i = 0; i < 8; i++) {
        const x = x0 + 2.5 + i * 3.2 + (i % 2) * 0.4;
        const t = new THREE.Mesh(new THREE.CapsuleGeometry(0.62, 0.9, 4, 8), jer); t.position.set(x, 3.05, zf - 4.4); t.scale.set(1, 1, 0.8); this.group.add(t);
        const h = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 10), hel); h.position.set(x, 4.35 + (i % 3) * 0.05, zf - 4.2); this.group.add(h);
      }
      // the coach standing behind them
      const coach = new THREE.Mesh(new THREE.CapsuleGeometry(0.6, 2.6, 4, 8), new THREE.MeshStandardMaterial({ color: "#1c1c22" })); coach.position.set(x0 + 14, 3.0, zf - 5.4); this.group.add(coach);
      const ch = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 10), new THREE.MeshStandardMaterial({ color: "#d9a882" })); ch.position.set(x0 + 14, 5.3, zf - 5.4); this.group.add(ch);
    }
    const zn = RINK.halfWidth + 0.7;
    for (const x0 of [-14, 4]) { box(10, 0.6, 5, x0 + 5, 0.3, zn + 2.5, floor); box(10, 1.1, 1.2, x0 + 5, 1.2, zn + 4, wood); box(10, 4.5, 0.4, x0 + 5, 2.4, zn + 5.2, wall); }
    box(8, 3.4, 4, 0, 1.7, zn + 2.8, wall); // timekeeper
  }

  /** Stepped two-tier bowl, the LED ribbon between the tiers and the back wall. */
  private bowl() {
    const step = new THREE.MeshStandardMaterial({ color: "#1b212d", roughness: 0.95 });
    for (const T of TIERS) {
      for (let r = 0; r < T.rows; r++) {
        const o = T.o0 + r * T.tread, y = T.y0 + r * T.rise;
        this.mesh(ringGeometry(o - T.tread / 2, o + T.tread / 2, y), step);
      }
    }
    // the LED ribbon (fascia) between the two tiers: home colours scrolling round the bowl
    const lowerTop = TIERS[0].y0 + (TIERS[0].rows - 1) * TIERS[0].rise;
    const fasciaO = TIERS[0].o0 + TIERS[0].rows * TIERS[0].tread - 1;
    this.mesh(ringGeometry(fasciaO - 0.5, TIERS[1].o0 - TIERS[1].tread / 2, TIERS[1].y0 - 0.5), step);
    const { homeKit, homeCode } = this.o;
    this.ribbon = canvasTex(2048, 64, (c) => {
      const g = c.createLinearGradient(0, 0, 2048, 0);
      g.addColorStop(0, homeKit.jersey); g.addColorStop(0.5, "#0b1220"); g.addColorStop(1, homeKit.jersey);
      c.fillStyle = g; c.fillRect(0, 0, 2048, 64);
      c.font = "900 40px Arial Black, Arial, sans-serif"; c.textBaseline = "middle"; c.fillStyle = "#ffffff";
      for (let i = 0; i < 4; i++) c.fillText(`★ GO ${homeCode} ★   UNHL   `, i * 512 + 20, 34, 480);
    }, true);
    this.mesh(stripGeometry(fasciaO - 0.55, lowerTop + 0.8, TIERS[1].y0 - 0.8, 180), new THREE.MeshStandardMaterial({ color: "#000000", emissive: "#ffffff", emissiveMap: this.ribbon, emissiveIntensity: 1.6 }));
    // back wall + a band of suites/windows above the upper tier
    const top = TIERS[1].y0 + TIERS[1].rows * TIERS[1].rise, backO = TIERS[1].o0 + TIERS[1].rows * TIERS[1].tread;
    this.mesh(stripGeometry(backO, 0, top + 30, 50), new THREE.MeshStandardMaterial({ color: "#0d1119", roughness: 1, side: THREE.DoubleSide }));
    const win = canvasTex(256, 32, (c) => { c.fillStyle = "#0d1119"; c.fillRect(0, 0, 256, 32); for (let i = 0; i < 8; i++) { c.fillStyle = i % 3 ? "#f6d58a" : "#8fb3ff"; c.globalAlpha = 0.55 + (i % 2) * 0.2; c.fillRect(i * 32 + 4, 8, 24, 16); } }, true);
    this.mesh(stripGeometry(backO - 0.2, top + 2, top + 6, 40), new THREE.MeshStandardMaterial({ color: "#000000", emissive: "#ffffff", emissiveMap: win, emissiveIntensity: 0.9 }));
  }

  /** Seats for every row; people in the share of them the box office sold. */
  private crowd() {
    const { small, homeKit, awayKit } = this.o;
    const occ = Math.max(0, Math.min(1, this.o.occupancy));
    const spacing = small ? 3 : 2.05;
    type Seat = { x: number; y: number; z: number; rot: number; score: number; upper: boolean };
    const seats: Seat[] = [];
    let seed = 1234567; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    TIERS.forEach((T, ti) => {
      for (let r = 0; r < T.rows; r++) {
        if (small && r % 2) continue;
        const o = T.o0 + r * T.tread, y = T.y0 + r * T.rise;
        const L = outlineLength(o), n = Math.floor(L / spacing);
        for (let i = 0; i < n; i++) {
          if (i % 16 >= 14) continue; // stairs between sections
          const p = outlinePoint(o, i / n);
          // corners and the top rows are the last to sell
          const corner = Math.min(1, Math.max(0, (Math.abs(p.x) - 55) / 45)) * Math.min(1, Math.max(0, (Math.abs(p.z) - 30) / 40));
          const end = Math.abs(p.x) > RINK.halfLength ? 0.15 : 0;
          seats.push({ x: p.x, y, z: p.z, rot: Math.atan2(p.nx, p.nz), upper: ti === 1, score: rnd() * 0.55 + (ti === 1 ? 0.22 + r * 0.012 : r * 0.006) + corner * 0.18 + end });
        }
      }
    });
    // seats
    const seatGeo = mergeGeometries([new THREE.BoxGeometry(1.55, 0.22, 1.3).translate(0, 1.4, 0), new THREE.BoxGeometry(1.55, 1.3, 0.18).translate(0, 2.0, 0.6)]);
    const seatCol = new THREE.Color(homeKit.jersey).lerp(new THREE.Color("#2a2f3a"), 0.35);
    const upperCol = new THREE.Color("#3a4252");
    const seatMesh = new THREE.InstancedMesh(seatGeo, new THREE.MeshLambertMaterial({ color: "#ffffff" }), seats.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1);
    seats.forEach((s, i) => { q.setFromAxisAngle(up, s.rot); m.compose(new THREE.Vector3(s.x, s.y, s.z), q, one); seatMesh.setMatrixAt(i, m); seatMesh.setColorAt(i, s.upper ? upperCol : seatCol); });
    this.group.add(seatMesh);

    // fans in the cheapest-to-sell-out-first order
    const filled = [...seats].sort((a, b) => a.score - b.score).slice(0, Math.round(seats.length * occ));
    if (!filled.length) return;
    const body = new THREE.CapsuleGeometry(0.55, 0.95, 3, 8).translate(0, 2.35, 0); body.scale(1, 1, 0.75);
    const head = new THREE.SphereGeometry(0.36, 8, 6).translate(0, 3.55, -0.05);
    const phase = new Float32Array(filled.length), fan = new Float32Array(filled.length);
    const bodyMesh = new THREE.InstancedMesh(body, this.crowdMat(false), filled.length);
    const headMesh = new THREE.InstancedMesh(head, this.crowdMat(true), filled.length);
    const homeC = new THREE.Color(homeKit.jersey), awayC = new THREE.Color(awayKit.trim), col = new THREE.Color();
    const skins = ["#f1c7a5", "#e0ac84", "#c68863", "#8d5a3b", "#f6d6bd", "#5b3a29"].map((c) => new THREE.Color(c));
    const hair = ["#2b1d14", "#5a3b22", "#c9a26b", "#1a1a1a", "#7a4a2a"].map((c) => new THREE.Color(c));
    filled.forEach((s, i) => {
      q.setFromAxisAngle(up, s.rot + (rnd() - 0.5) * 0.3);
      const sc = 0.92 + rnd() * 0.16;
      m.compose(new THREE.Vector3(s.x + (rnd() - 0.5) * 0.2, s.y, s.z), q, new THREE.Vector3(sc, sc, sc));
      bodyMesh.setMatrixAt(i, m); headMesh.setMatrixAt(i, m);
      const r = rnd();
      let side = 0.5;
      if (r < 0.46) { col.copy(homeC).offsetHSL(0, 0, (rnd() - 0.5) * 0.12); side = 1; }
      else if (r < 0.56) { col.set("#f1f1f1"); side = 1; }
      else if (r < 0.64) { col.copy(awayC); side = 0; }
      else col.setHSL(rnd(), 0.15 + rnd() * 0.35, 0.12 + rnd() * 0.32);
      bodyMesh.setColorAt(i, col);
      headMesh.setColorAt(i, rnd() < 0.18 ? hair[Math.floor(rnd() * hair.length)] : skins[Math.floor(rnd() * skins.length)]);
      phase[i] = rnd(); fan[i] = side;
    });
    for (const im of [bodyMesh, headMesh]) {
      im.geometry.setAttribute("aPhase", new THREE.InstancedBufferAttribute(phase, 1));
      im.geometry.setAttribute("aFan", new THREE.InstancedBufferAttribute(fan, 1));
      im.frustumCulled = false;
      this.group.add(im);
    }
  }

  /** Lambert with a little vertex shader: idle sway + team-specific jumping on a goal. */
  private crowdMat(head: boolean): THREE.Material {
    const mat = new THREE.MeshLambertMaterial({ color: "#ffffff", emissive: "#151922" });
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, this.uniforms);
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", "#include <common>\nattribute float aPhase;\nattribute float aFan;\nuniform float uTime;\nuniform float uCheerHome;\nuniform float uCheerAway;")
        .replace("#include <begin_vertex>", `#include <begin_vertex>
          float idle = sin(uTime * (0.8 + aPhase) + aPhase * 6.2831) * 0.06;
          float cheer = aFan > 0.75 ? uCheerHome : aFan < 0.25 ? uCheerAway : max(uCheerHome, uCheerAway) * 0.35;
          float jump = max(0.0, sin(uTime * (7.0 + aPhase * 3.0) + aPhase * 30.0)) * cheer * 1.1;
          transformed.y += idle + jump;
          ${head ? "transformed.x += sin(uTime * 2.0 + aPhase * 9.0) * 0.08 * cheer;" : ""}`);
    };
    mat.customProgramCacheKey = () => `crowd-${head}`;
    return mat;
  }

  private roof() {
    const top = TIERS[1].y0 + TIERS[1].rows * TIERS[1].rise + 30;
    const roof = new THREE.Mesh(new THREE.PlaneGeometry(500, 400), new THREE.MeshBasicMaterial({ color: "#07090e" }));
    roof.rotation.x = Math.PI / 2; roof.position.y = top; this.group.add(roof);
    // light rigs over the ice
    const n = this.o.small ? 24 : 48;
    const rig = new THREE.InstancedMesh(new THREE.BoxGeometry(2.6, 0.5, 1.4), new THREE.MeshStandardMaterial({ color: "#222", emissive: "#fff7e6", emissiveIntensity: 3 }), n);
    const m = new THREE.Matrix4();
    const halo: number[] = [];
    for (let i = 0; i < n; i++) {
      const ring = i % 2, k = Math.floor(i / 2) / (n / 2);
      const p = outlinePoint(ring ? -14 : 6, k);
      const y = top - 6 - ring * 3;
      m.makeTranslation(p.x * 0.92, y, p.z * 0.92); rig.setMatrixAt(i, m);
      halo.push(p.x * 0.92, y - 0.6, p.z * 0.92);
    }
    // each rig glows (additive points — no post-processing, so the ice never washes out)
    const hg = new THREE.BufferGeometry(); hg.setAttribute("position", new THREE.Float32BufferAttribute(halo, 3));
    const glow = new THREE.Points(hg, new THREE.PointsMaterial({ map: glowTexture(), color: "#fff1d0", size: 16, sizeAttenuation: true, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.9 }));
    this.group.add(rig, glow); this.overhead.push(rig, roof, glow);
    // catwalk trusses
    const truss = new THREE.MeshStandardMaterial({ color: "#2a2f39", metalness: 0.5, roughness: 0.5 });
    for (const z of [-30, 0, 30]) { const b = new THREE.Mesh(new THREE.BoxGeometry(230, 1, 1.2), truss); b.position.set(0, top - 4, z); this.group.add(b); this.overhead.push(b); }
  }

  /** The overhead camera looks straight through the roof rigs. */
  setTopView(on: boolean) { for (const o of this.overhead) o.visible = !on; }

  /** Fans of `side` go up for `seconds` (a goal: 1, a big chance: ~0.35). */
  cheer(side: "home" | "away", level = 1, seconds = 6) {
    const until = this.clock + seconds;
    if (side === "home") { this.cheerHomeUntil = until; this.cheerLevel.home = level; } else { this.cheerAwayUntil = until; this.cheerLevel.away = level; }
  }

  update(dt: number) {
    this.clock += dt;
    this.uniforms.uTime.value = this.clock;
    const ease = (cur: number, until: number, lvl: number) => { const want = this.clock < until ? lvl : 0; return cur + (want - cur) * Math.min(1, dt * (want > cur ? 6 : 1.2)); };
    this.uniforms.uCheerHome.value = ease(this.uniforms.uCheerHome.value, this.cheerHomeUntil, this.cheerLevel.home);
    this.uniforms.uCheerAway.value = ease(this.uniforms.uCheerAway.value, this.cheerAwayUntil, this.cheerLevel.away);
    if (this.ribbon) this.ribbon.offset.x = (this.ribbon.offset.x + dt * 0.02) % 1;
  }
}
