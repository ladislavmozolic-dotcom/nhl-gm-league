// The 3D arena: ice with real NHL markings, boards + glass, nets, a crowd, and a
// pool of jersey-coloured skaters/goalies the replay and live views move around.
// Plain three.js (no React renderer) — the owning component drives it from one
// requestAnimationFrame loop and disposes it on unmount.

import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { RINK, POSE, type Actor, type ClipFrame } from "@/lib/replay3d/reconstruct";
import type { Kit } from "@/lib/replay3d/team-colors";

export type CameraMode = "broadcast" | "end" | "goalcam" | "follow" | "top" | "free";

const PX = 10.24; // ice texture pixels per foot

function roundedRect(path: THREE.Shape | THREE.Path, hx: number, hz: number, r: number) {
  path.moveTo(-hx + r, -hz);
  path.lineTo(hx - r, -hz); path.absarc(hx - r, -hz + r, r, -Math.PI / 2, 0, false);
  path.lineTo(hx, hz - r); path.absarc(hx - r, hz - r, r, 0, Math.PI / 2, false);
  path.lineTo(-hx + r, hz); path.absarc(-hx + r, hz - r, r, Math.PI / 2, Math.PI, false);
  path.lineTo(-hx, -hz + r); path.absarc(-hx + r, -hz + r, r, Math.PI, 1.5 * Math.PI, false);
}

/** A flat ring between two rounded rectangles, extruded upward (boards, glass, stands). */
function ringGeometry(inner: number, outer: number, height: number): THREE.BufferGeometry {
  const s = new THREE.Shape();
  roundedRect(s, RINK.halfLength + outer, RINK.halfWidth + outer, RINK.cornerR + outer);
  const hole = new THREE.Path();
  roundedRect(hole, RINK.halfLength + inner, RINK.halfWidth + inner, Math.max(1, RINK.cornerR + inner));
  s.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(s, { depth: height, bevelEnabled: false, curveSegments: 20 });
  g.rotateX(-Math.PI / 2); // shape y → −z, extrusion → +y
  return g;
}

/** Point on the rounded rink outline `offset` ft outside the boards, u ∈ [0,1). */
function outlinePoint(offset: number, u: number): { x: number; z: number; nx: number; nz: number } {
  const hx = RINK.halfLength + offset, hz = RINK.halfWidth + offset, r = RINK.cornerR + offset;
  const sx = 2 * (hx - r), sz = 2 * (hz - r), arc = (Math.PI / 2) * r;
  const L = 2 * sx + 2 * sz + 4 * arc;
  let d = (((u % 1) + 1) % 1) * L;
  const segs: Array<[number, (k: number) => { x: number; z: number; nx: number; nz: number }]> = [
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

function iceTexture(logo: HTMLImageElement | null): THREE.CanvasTexture {
  const W = Math.round(200 * PX), H = Math.round(85 * PX);
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const c = cv.getContext("2d")!;
  c.setTransform(PX, 0, 0, PX, 100 * PX, 42.5 * PX); // draw in feet, origin centre ice, +y = +z
  c.save();
  // rounded rink clip
  c.beginPath();
  const hx = 100, hz = 42.5, r = 28;
  c.moveTo(-hx + r, -hz); c.lineTo(hx - r, -hz); c.arc(hx - r, -hz + r, r, -Math.PI / 2, 0);
  c.lineTo(hx, hz - r); c.arc(hx - r, hz - r, r, 0, Math.PI / 2); c.lineTo(-hx + r, hz);
  c.arc(-hx + r, hz - r, r, Math.PI / 2, Math.PI); c.lineTo(-hx, -hz + r); c.arc(-hx + r, -hz + r, r, Math.PI, 1.5 * Math.PI);
  c.closePath(); c.clip();
  // ice base with faint skate scratches
  const g = c.createRadialGradient(0, 0, 10, 0, 0, 110);
  g.addColorStop(0, "#fbfdff"); g.addColorStop(1, "#e7eef5");
  c.fillStyle = g; c.fillRect(-100, -42.5, 200, 85);
  c.globalAlpha = 0.05; c.strokeStyle = "#7d93a8"; c.lineWidth = 0.08;
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 900; i++) { const x = -100 + rnd() * 200, z = -42 + rnd() * 84, a = rnd() * Math.PI, l = 2 + rnd() * 8; c.beginPath(); c.moveTo(x, z); c.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + 1, z + Math.sin(a) * l * 0.5, x + Math.cos(a) * l, z + Math.sin(a) * l); c.stroke(); }
  c.globalAlpha = 1;
  const RED = "#c8102e", BLUE = "#0b3d91";
  // centre logo
  if (logo && logo.complete && logo.naturalWidth) {
    const s = 22, ar = logo.naturalWidth / logo.naturalHeight;
    c.globalAlpha = 0.9; c.drawImage(logo, -s * ar / 2, -s / 2, s * ar, s); c.globalAlpha = 1;
  }
  // lines
  c.fillStyle = BLUE; c.fillRect(-25 - 0.5, -42.5, 1, 85); c.fillRect(25 - 0.5, -42.5, 1, 85);
  c.fillStyle = RED; c.fillRect(-0.5, -42.5, 1, 85);
  c.fillStyle = "#ffffff"; for (let z = -42; z < 42.5; z += 2.2) c.fillRect(-0.12, z, 0.24, 1.1);
  c.fillStyle = RED; c.fillRect(89 - 0.08, -42.5, 0.17, 85); c.fillRect(-89 - 0.08, -42.5, 0.17, 85);
  // centre circle + dot
  c.strokeStyle = BLUE; c.lineWidth = 0.17; c.beginPath(); c.arc(0, 0, 15, 0, Math.PI * 2); c.stroke();
  c.fillStyle = BLUE; c.beginPath(); c.arc(0, 0, 0.5, 0, Math.PI * 2); c.fill();
  // neutral-zone dots
  c.fillStyle = RED; for (const x of [-20, 20]) for (const z of [-22, 22]) { c.beginPath(); c.arc(x, z, 1, 0, Math.PI * 2); c.fill(); }
  // end-zone circles with hash marks
  c.strokeStyle = RED; c.lineWidth = 0.17;
  for (const x of [-69, 69]) for (const z of [-22, 22]) {
    c.beginPath(); c.arc(x, z, 15, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.arc(x, z, 1, 0, Math.PI * 2); c.fillStyle = RED; c.fill();
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { c.fillRect(x + sx * 2.9 - 0.08, z + sz * 14.7 - (sz > 0 ? 0 : 2), 0.17, 2); }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { c.fillRect(x + sx * 2, z + sz * 0.75, sx * 4, 0.17); c.fillRect(x + sx * 2, z + sz * 0.75, 0.17, sz * 3); }
  }
  // creases + trapezoids
  for (const d of [-1, 1]) {
    const gx = d * 89;
    // NHL crease: 4.5 ft straight sides, 6 ft arc centred on the goal line
    c.beginPath(); c.moveTo(gx, -4); c.lineTo(gx - d * 4.5, -4);
    c.arc(gx, 0, 6, Math.atan2(-4, -d * 4.5), Math.atan2(4, -d * 4.5), d > 0);
    c.lineTo(gx, 4); c.closePath();
    c.fillStyle = "rgba(96,170,235,0.55)"; c.fill(); c.strokeStyle = RED; c.lineWidth = 0.17; c.stroke();
    c.beginPath(); c.moveTo(gx, -11); c.lineTo(d * 100, -14); c.moveTo(gx, 11); c.lineTo(d * 100, 14); c.stroke();
  }
  // referee crease
  c.beginPath(); c.arc(0, 42.5, 10, Math.PI, 0); c.stroke();
  c.restore();
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function textTexture(lines: Array<{ text: string; font: string; color: string; y: number }>, w: number, h: number, bg?: string): THREE.CanvasTexture {
  const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
  const c = cv.getContext("2d")!;
  if (bg) { c.fillStyle = bg; c.fillRect(0, 0, w, h); }
  c.textAlign = "center"; c.textBaseline = "middle";
  for (const l of lines) { c.font = l.font; c.fillStyle = l.color; c.fillText(l.text, w / 2, l.y); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function netTexture(): THREE.CanvasTexture {
  const cv = document.createElement("canvas"); cv.width = 64; cv.height = 64;
  const c = cv.getContext("2d")!;
  c.strokeStyle = "rgba(255,255,255,0.95)"; c.lineWidth = 3;
  c.beginPath(); c.moveTo(0, 0); c.lineTo(64, 64); c.moveTo(64, 0); c.lineTo(0, 64); c.stroke();
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

type Rig = {
  root: THREE.Group; upper: THREE.Group; legL: THREE.Group; legR: THREE.Group; armL: THREE.Group; armR: THREE.Group;
  stick: THREE.Group; label: THREE.Sprite; labelKey: string; phase: number; goalie: boolean; side: "home" | "away";
};

export class RinkScene {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  private rigs = new Map<string, Rig>();
  private order: string[] = [];
  private puck: THREE.Mesh;
  private trail: THREE.Line;
  private trailPts: THREE.Vector3[] = [];
  private goalLights: Record<string, THREE.Mesh> = {};
  private goalLightUntil = 0;
  private clock = 0;
  private mode: CameraMode = "broadcast";
  private attackDir: 1 | -1 = 1;
  private camPos = new THREE.Vector3(0, 54, 80);
  private camLook = new THREE.Vector3(0, 0, 0);
  private focusId: string | null = null;
  private labels = true;
  private kits: Record<"home" | "away", Kit>;
  private ice: THREE.Mesh;
  private jumbo: THREE.Group;
  private jumboScreen: THREE.MeshBasicMaterial;
  private crowd: THREE.InstancedMesh | null = null;
  private disposables: Array<{ dispose(): void }> = [];
  private small = false;

  constructor(canvas: HTMLCanvasElement, opts: { homeKit: Kit; awayKit: Kit; homeLogoUrl?: string | null }) {
    this.kits = { home: opts.homeKit, away: opts.awayKit };
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    // phones / small screens: fewer pixels, a smaller shadow map and a thinner crowd keep it smooth
    this.small = Math.min(window.innerWidth, window.innerHeight) < 600;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.small ? 1.5 : 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.5, 2000);
    this.camera.position.copy(this.camPos);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enabled = false;
    this.controls.maxPolarAngle = Math.PI / 2.05;
    this.controls.minDistance = 10; this.controls.maxDistance = 320;

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = env;
    this.scene.environmentIntensity = 0.35;
    this.scene.background = new THREE.Color("#070b12");
    this.scene.fog = new THREE.Fog("#070b12", 260, 520);
    this.disposables.push(env, pmrem);

    // lights: arena whites from above, one shadow caster
    this.scene.add(new THREE.HemisphereLight("#e8f0ff", "#1a2233", 1.1));
    const sun = new THREE.DirectionalLight("#ffffff", 2.2);
    sun.position.set(-30, 140, 40); sun.castShadow = true;
    sun.shadow.mapSize.set(this.small ? 1024 : 2048, this.small ? 1024 : 2048);
    Object.assign(sun.shadow.camera, { left: -115, right: 115, top: 60, bottom: -60, near: 10, far: 320 });
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.6;
    this.scene.add(sun);

    // ice
    const iceShape = new THREE.Shape(); roundedRect(iceShape, RINK.halfLength, RINK.halfWidth, RINK.cornerR);
    const iceGeo = new THREE.ShapeGeometry(iceShape, 32); iceGeo.rotateX(-Math.PI / 2);
    const pos = iceGeo.attributes.position as THREE.BufferAttribute, uv = iceGeo.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + 100) / 200, 1 - (pos.getZ(i) + 42.5) / 85);
    const iceMat = new THREE.MeshPhysicalMaterial({ map: iceTexture(null), roughness: 0.35, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.12 });
    this.ice = new THREE.Mesh(iceGeo, iceMat); this.ice.receiveShadow = true;
    this.scene.add(this.ice);
    if (opts.homeLogoUrl) {
      const img = new Image(); img.crossOrigin = "anonymous";
      img.onload = () => { const old = iceMat.map; iceMat.map = iceTexture(img); iceMat.needsUpdate = true; old?.dispose(); };
      img.src = opts.homeLogoUrl;
    }

    // boards (kick plate, white boards, cap), glass
    const add = (g: THREE.BufferGeometry, m: THREE.Material, y = 0, shadow = true) => { const me = new THREE.Mesh(g, m); me.position.y = y; me.receiveShadow = shadow; me.castShadow = shadow; this.scene.add(me); return me; };
    add(ringGeometry(-0.06, 0.4, 0.8), new THREE.MeshStandardMaterial({ color: "#f2c230", roughness: 0.6 }));
    add(ringGeometry(0, 0.7, 3.4), new THREE.MeshStandardMaterial({ color: "#f5f7fa", roughness: 0.55 }));
    add(ringGeometry(-0.15, 1.1, 0.3), new THREE.MeshStandardMaterial({ color: "#122445", roughness: 0.5 }), 3.4);
    const glass = new THREE.MeshPhysicalMaterial({ color: "#d6ecff", roughness: 0.05, metalness: 0, transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide });
    add(ringGeometry(0.25, 0.4, 6.5), glass, 3.7, false);

    // stands + crowd
    const standMat = new THREE.MeshStandardMaterial({ color: "#151b26", roughness: 0.9 });
    const tiers = 7;
    for (let k = 0; k < tiers; k++) add(ringGeometry(4 + k * 4.2, 4 + (k + 1) * 4.2, 1), standMat, 1.5 + k * 3.2, false);
    add(ringGeometry(1.1, 4, 0.6), new THREE.MeshStandardMaterial({ color: "#0d1320" }), 0, false);
    this.buildCrowd(tiers);

    // nets + goal lights
    for (const d of [-1, 1] as const) this.scene.add(this.buildNet(d));

    // centre-hung scoreboard
    this.jumbo = new THREE.Group(); this.jumbo.position.set(0, 58, 0);
    const box = new THREE.Mesh(new THREE.BoxGeometry(26, 12, 18), new THREE.MeshStandardMaterial({ color: "#0b0f17", roughness: 0.4, metalness: 0.4 }));
    this.jumbo.add(box);
    this.jumboScreen = new THREE.MeshBasicMaterial({ map: textTexture([{ text: "UNHL", font: "bold 90px sans-serif", color: "#e2e8f0", y: 128 }], 512, 256, "#0f172a") });
    for (const [x, z, ry, w] of [[0, 9.05, 0, 24], [0, -9.05, Math.PI, 24], [13.05, 0, Math.PI / 2, 16], [-13.05, 0, -Math.PI / 2, 16]] as const) {
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(w, 10), this.jumboScreen); scr.position.set(x, 0, z); scr.rotation.y = ry; this.jumbo.add(scr);
    }
    this.scene.add(this.jumbo);

    // puck + its streak
    this.puck = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.14, 24), new THREE.MeshStandardMaterial({ color: "#0a0a0a", roughness: 0.5 }));
    this.puck.castShadow = true; this.scene.add(this.puck);
    this.trail = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: "#ffe28a", transparent: true, opacity: 0.85 }));
    this.trail.frustumCulled = false;
    this.scene.add(this.trail);
  }

  private buildCrowd(tiers: number) {
    const per: Array<{ x: number; y: number; z: number; nx: number; nz: number }> = [];
    for (let k = 0; k < tiers; k++) {
      const off = 4 + k * 4.2 + 2.1, y = 2.5 + k * 3.2 + 1;
      const n = Math.floor((2 * (200 + 85) + 2 * Math.PI * (RINK.cornerR + off) - 8 * (RINK.cornerR + off)) / 2.3);
      for (let i = 0; i < n; i++) {
        if (Math.random() < (this.small ? 0.5 : 0.12)) continue; // empty seats (and a sparser crowd on phones)
        const p = outlinePoint(off, i / n + Math.random() * 0.002);
        if (Math.abs(p.x) < 30 && p.nz > 0.9 && k < 2) continue; // benches side gap
        per.push({ x: p.x, y, z: p.z, nx: p.nx, nz: p.nz });
      }
    }
    const geo = new THREE.BoxGeometry(1.25, 2.3, 1.1); geo.translate(0, 1.15, 0);
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.9 });
    const im = new THREE.InstancedMesh(geo, mat, per.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), col = new THREE.Color();
    const home = new THREE.Color(this.kits.home.jersey);
    per.forEach((p, i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(p.nx, p.nz));
      sc.set(1, 0.85 + Math.random() * 0.3, 1);
      m.compose(new THREE.Vector3(p.x, p.y, p.z), q, sc);
      im.setMatrixAt(i, m);
      const r = Math.random();
      if (r < 0.42) col.copy(home).offsetHSL(0, 0, (Math.random() - 0.5) * 0.15);
      else if (r < 0.55) col.set("#e9e9e9");
      else col.setHSL(Math.random(), 0.25 + Math.random() * 0.3, 0.15 + Math.random() * 0.3);
      im.setColorAt(i, col);
    });
    this.crowd = im;
    this.scene.add(im);
  }

  private buildNet(d: 1 | -1): THREE.Group {
    const g = new THREE.Group();
    g.position.set(d * RINK.goalLine, 0, 0);
    if (d < 0) g.rotation.y = Math.PI; // local +x = into the net, away from centre
    const red = new THREE.MeshStandardMaterial({ color: "#d01c1c", roughness: 0.35, metalness: 0.3 });
    const W = RINK.netHalfWidth, H = RINK.netHeight, D = RINK.netDepth;
    const post = new THREE.CylinderGeometry(0.12, 0.12, H, 12);
    for (const z of [-W, W]) { const p = new THREE.Mesh(post, red); p.position.set(0, H / 2, z); p.castShadow = true; g.add(p); }
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 2 * W, 12), red); bar.rotation.x = Math.PI / 2; bar.position.set(0, H, 0); g.add(bar);
    // base frame + top shelf as tubes
    const base = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.08, -W), new THREE.Vector3(1.4, 0.08, -W - 0.3), new THREE.Vector3(D - 0.2, 0.08, -W + 0.9), new THREE.Vector3(D, 0.08, 0), new THREE.Vector3(D - 0.2, 0.08, W - 0.9), new THREE.Vector3(1.4, 0.08, W + 0.3), new THREE.Vector3(0, 0.08, W)]);
    const white = new THREE.MeshStandardMaterial({ color: "#f5f5f5", roughness: 0.6 });
    g.add(new THREE.Mesh(new THREE.TubeGeometry(base, 40, 0.07, 8, false), white));
    // netting: a surface from the crossbar back and down to the base
    const prof = [[0, H], [1.3, H - 0.25], [2.6, H * 0.55], [D, 0.08]];
    const cols = 14, rows = 10, verts: number[] = [], uvs: number[] = [], idx: number[] = [];
    for (let i = 0; i <= rows; i++) {
      const v = i / rows, seg = Math.min(prof.length - 2, Math.floor(v * (prof.length - 1))), k = v * (prof.length - 1) - seg;
      const x = prof[seg][0] + (prof[seg + 1][0] - prof[seg][0]) * k, y = prof[seg][1] + (prof[seg + 1][1] - prof[seg][1]) * k;
      const half = W - Math.sin(v * Math.PI) * 0.1 - v * 0.5;
      for (let j = 0; j <= cols; j++) { const u = j / cols; verts.push(x, y, -half + 2 * half * u); uvs.push(u * 9, v * 7); }
    }
    for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) { const a = i * (cols + 1) + j, b = a + cols + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
    const ng = new THREE.BufferGeometry();
    ng.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3)); ng.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2)); ng.setIndex(idx); ng.computeVertexNormals();
    const netMat = new THREE.MeshBasicMaterial({ map: netTexture(), transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, color: "#ffffff" });
    netMat.map!.repeat.set(1, 1);
    netMat.alphaMap = netMat.map;
    g.add(new THREE.Mesh(ng, netMat));
    // side panels
    for (const z of [-W, W]) {
      const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(0, H); prof.slice(1).forEach(([x, y]) => sh.lineTo(x, y)); sh.lineTo(0, 0);
      const sg = new THREE.ShapeGeometry(sh); const suv = sg.attributes.uv as THREE.BufferAttribute;
      for (let i = 0; i < suv.count; i++) suv.setXY(i, suv.getX(i) * 2.2, suv.getY(i) * 1.8);
      const m = new THREE.Mesh(sg, netMat); m.position.z = z * 0.98; g.add(m);
    }
    // goal light above the glass behind the net
    // kept just under the top of the glass so it never sits in front of the end camera
    const light = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 12), new THREE.MeshStandardMaterial({ color: "#5a0d0d", emissive: "#ff1a1a", emissiveIntensity: 0 }));
    light.position.set(RINK.halfLength - RINK.goalLine + 1.0, 9.2, 0); g.add(light);
    this.goalLights[String(d)] = light;
    return g;
  }

  private makeRig(a: Actor): Rig {
    const kit = this.kits[a.side];
    const goalie = a.role === "G";
    const jersey = new THREE.MeshStandardMaterial({ color: kit.jersey, roughness: 0.7 });
    const trim = new THREE.MeshStandardMaterial({ color: kit.trim, roughness: 0.6 });
    const pants = new THREE.MeshStandardMaterial({ color: kit.pants, roughness: 0.8 });
    const dark = new THREE.MeshStandardMaterial({ color: "#111111", roughness: 0.4 });
    const helmet = new THREE.MeshStandardMaterial({ color: kit.helmet, roughness: 0.3, metalness: 0.1 });
    const padMat = new THREE.MeshStandardMaterial({ color: "#f2f2f2", roughness: 0.6 });
    const root = new THREE.Group();
    const cast = (m: THREE.Mesh) => { m.castShadow = true; return m; };
    const mkLeg = (z: number) => {
      const leg = new THREE.Group(); leg.position.set(0, 3.0, z);
      const thigh = cast(new THREE.Mesh(new THREE.CapsuleGeometry(goalie ? 0.42 : 0.36, 0.7, 4, 10), pants)); thigh.position.y = -0.55; leg.add(thigh);
      const shin = cast(new THREE.Mesh(new THREE.CapsuleGeometry(goalie ? 0.5 : 0.25, 1.25, 4, 10), goalie ? padMat : jersey)); shin.position.y = -1.85; if (goalie) shin.position.x = 0.15; leg.add(shin);
      const skate = cast(new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.3, 0.32), dark)); skate.position.set(0.15, -2.82, 0); leg.add(skate);
      return leg;
    };
    const legL = mkLeg(-0.42), legR = mkLeg(0.42);
    root.add(legL, legR);
    const upper = new THREE.Group(); upper.position.y = 3.0; root.add(upper);
    const torso = cast(new THREE.Mesh(new THREE.CapsuleGeometry(goalie ? 0.95 : 0.78, 1.15, 6, 14), jersey)); torso.position.y = 1.0; torso.scale.set(0.72, 1, 1); upper.add(torso);
    const hem = cast(new THREE.Mesh(new THREE.CylinderGeometry(goalie ? 0.96 : 0.8, goalie ? 0.96 : 0.8, 0.28, 18, 1, true), trim)); hem.position.y = 0.3; hem.scale.set(0.73, 1, 1); upper.add(hem);
    const head = cast(new THREE.Mesh(new THREE.SphereGeometry(0.46, 16, 12), helmet)); head.position.y = 2.45; upper.add(head);
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.28, 0.62), goalie ? new THREE.MeshStandardMaterial({ color: "#d9d9d9", wireframe: true }) : dark); visor.position.set(0.38, 2.38, 0); upper.add(visor);
    // numbers front + back
    const num = a.number != null ? String(a.number) : "";
    if (num) {
      const tex = textTexture([{ text: num, font: "bold 150px Arial Black, Arial, sans-serif", color: kit.number, y: 100 }], 256, 200);
      const nm = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
      const back = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 0.9), nm); back.position.set(-0.58, 1.15, 0); back.rotation.y = -Math.PI / 2; upper.add(back);
      const front = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.47), nm); front.position.set(0.58, 1.35, 0.25); front.rotation.y = Math.PI / 2; upper.add(front);
    }
    const mkArm = (z: number) => {
      const arm = new THREE.Group(); arm.position.set(0, 1.75, z);
      const sleeve = cast(new THREE.Mesh(new THREE.CapsuleGeometry(goalie ? 0.3 : 0.24, 1.0, 4, 10), jersey)); sleeve.position.y = -0.62; arm.add(sleeve);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.255, 0.255, 0.18, 12, 1, true), trim); band.position.y = -0.85; arm.add(band);
      const glove = cast(new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.4, 0.4), goalie ? padMat : trim)); glove.position.y = -1.3; arm.add(glove);
      return arm;
    };
    const armL = mkArm(-0.92), armR = mkArm(0.92);
    armL.rotation.z = 0.7; armR.rotation.z = 0.9; // reaching forward to the stick
    upper.add(armL, armR);
    if (goalie) {
      const blocker = cast(new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.0, 0.75), padMat)); blocker.position.set(0.1, -1.35, 0.25); armR.add(blocker);
      const glove = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.25, 16), trim)); glove.rotation.z = Math.PI / 2; glove.position.set(0.15, -1.35, -0.2); armL.add(glove);
    }
    // stick: pivot at the hands, blade near the ice ahead and to the right
    const stick = new THREE.Group(); stick.position.set(0.95, 0.65, 0.5);
    const shaft = cast(new THREE.Mesh(new THREE.BoxGeometry(0.09, goalie ? 3.6 : 4.6, 0.12), new THREE.MeshStandardMaterial({ color: "#1d1d1d", roughness: 0.5 })));
    shaft.position.y = goalie ? -1.4 : -1.9; shaft.rotation.z = goalie ? 0.35 : 0.55; stick.add(shaft);
    const bl = cast(new THREE.Mesh(new THREE.BoxGeometry(goalie ? 1.4 : 1.15, goalie ? 0.35 : 0.28, 0.08), new THREE.MeshStandardMaterial({ color: "#262626" })));
    bl.position.set(goalie ? 0.9 : 1.6, goalie ? -3.05 : -3.55, 0); stick.add(bl);
    upper.add(stick);
    const label = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthTest: false }));
    label.position.y = 7.6; label.renderOrder = 10; root.add(label);
    this.scene.add(root);
    return { root, upper, legL, legR, armL, armR, stick, label, labelKey: "", phase: Math.random() * 6, goalie, side: a.side };
  }

  private setLabel(r: Rig, a: Actor, focus: boolean) {
    const key = `${a.name}|${a.number}|${focus}`;
    if (r.labelKey === key) return;
    r.labelKey = key;
    const last = a.name.includes(" ") ? a.name.split(" ").slice(1).join(" ") : a.name;
    const text = `${a.number != null ? `#${a.number} ` : ""}${last.toUpperCase()}`;
    const kit = this.kits[a.side];
    const old = (r.label.material as THREE.SpriteMaterial).map;
    const tex = textTexture([{ text, font: "bold 44px Arial, sans-serif", color: focus ? "#111111" : "#ffffff", y: 40 }], 512, 80, focus ? "#facc15" : a.side === "home" ? kit.jersey + "e6" : "#0f172ae6");
    (r.label.material as THREE.SpriteMaterial).map = tex; (r.label.material as THREE.SpriteMaterial).needsUpdate = true;
    old?.dispose();
    r.label.scale.set(focus ? 9 : 6.6, focus ? 1.4 : 1.03, 1);
  }

  /** Define who's on the ice (re-uses meshes for ids it already has). */
  setActors(actors: Actor[]) {
    const keep = new Set(actors.map((a) => a.id));
    for (const [id, r] of this.rigs) if (!keep.has(id)) { this.scene.remove(r.root); this.rigs.delete(id); }
    for (const a of actors) {
      const r = this.rigs.get(a.id);
      const sig = `${a.side}|${a.role}|${a.number}`;
      if (r && r.root.userData.sig === sig) continue;
      if (r) this.scene.remove(r.root);
      const nr = this.makeRig(a); nr.root.userData.sig = sig; this.rigs.set(a.id, nr);
    }
    this.order = actors.map((a) => a.id);
    this.actorsById = new Map(actors.map((a) => [a.id, a]));
  }
  private actorsById = new Map<string, Actor>();

  setFocus(id: string | null) { this.focusId = id; }
  setLabels(on: boolean) { this.labels = on; }
  setScoreboard(lines: string[]) {
    const old = this.jumboScreen.map;
    this.jumboScreen.map = textTexture(lines.map((t, i) => ({ text: t, font: i === 0 ? "bold 96px sans-serif" : "bold 54px sans-serif", color: i === 0 ? "#f8fafc" : "#fbbf24", y: lines.length === 1 ? 128 : 90 + i * 90 })), 512, 256, "#0f172a");
    this.jumboScreen.needsUpdate = true; old?.dispose();
  }
  flashGoalLight(dir: 1 | -1, seconds = 4) { this.goalLightDir = dir; this.goalLightUntil = this.clock + seconds; }
  private goalLightDir: 1 | -1 = 1;

  setCamera(mode: CameraMode, attackDir?: 1 | -1) {
    this.mode = mode;
    if (attackDir) this.attackDir = attackDir;
    this.controls.enabled = mode === "free";
    if (mode === "free") { this.controls.target.copy(this.camLook); this.controls.update(); }
    this.jumbo.visible = mode !== "top";
  }

  resize(w: number, h: number) {
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / Math.max(1, h); this.camera.updateProjectionMatrix();
  }

  /** Pose everyone from one interpolated frame. */
  setFrame(frame: ClipFrame, dt: number) {
    this.order.forEach((id, i) => {
      const r = this.rigs.get(id), s = frame.a[i], a = this.actorsById.get(id);
      if (!r || !s || !a) return;
      r.root.position.set(s.x, 0, s.z);
      r.root.rotation.y = -s.h;
      const v = Math.min(1, s.speed / 22);
      r.phase += dt * (3 + s.speed * 0.32);
      const stride = Math.sin(r.phase) * 0.55 * v;
      r.legL.rotation.z = stride; r.legR.rotation.z = -stride;
      r.legL.rotation.x = 0.12 + Math.max(0, stride) * 0.4; r.legR.rotation.x = -0.12 - Math.max(0, -stride) * 0.4;
      r.legL.position.y = r.legR.position.y = 3.0;
      r.upper.rotation.z = -0.18 - 0.28 * v; r.upper.position.y = 3.0 - 0.25 * v;
      r.upper.rotation.x = Math.sin(r.phase) * 0.06 * v;
      r.armL.rotation.set(0, 0, 0.7); r.armR.rotation.set(0, 0, 0.9); r.stick.rotation.set(0, 0, 0);
      r.root.position.y = 0;
      if (r.goalie) {
        r.upper.rotation.z = -0.35; r.upper.position.y = 2.6;
        r.legL.rotation.x = 0.25; r.legR.rotation.x = -0.25; r.legL.rotation.z = r.legR.rotation.z = 0.35;
        r.armL.rotation.set(0.5, 0, 0.5); r.armR.rotation.set(-0.3, 0, 0.6);
        if (s.pose === POSE.BUTTERFLY) {
          // knees down, pads flared out to the posts
          r.upper.position.y = 1.7; r.upper.rotation.z = -0.15;
          r.legL.position.y = r.legR.position.y = 1.5;
          r.legL.rotation.set(1.35, 0, 0.6); r.legR.rotation.set(-1.35, 0, 0.6);
          r.armL.rotation.set(1.0, 0, 0.4);
        }
      } else if (s.pose === POSE.SHOOT) {
        const k = s.poseT;
        const wind = k < 0.55 ? k / 0.55 : 1 - (k - 0.55) / 0.15;
        const follow = k > 0.55 ? Math.min(1, (k - 0.55) / 0.15) : 0;
        // stick back on the wind-up, through the puck, up on the follow-through
        r.stick.rotation.z = -1.5 * Math.max(0, wind) + 0.9 * follow;
        r.upper.rotation.y = 0.5 * Math.max(0, wind) - 0.4 * follow;
        r.armR.rotation.z = 0.9 - 1.2 * Math.max(0, wind) + 0.4 * follow;
      } else if (s.pose === POSE.CELEBRATE) {
        const k = s.poseT;
        r.armL.rotation.set(2.5, 0, 0.2); r.armR.rotation.set(-2.5, 0, 0.2 + Math.sin(k * 10) * 0.3);
        r.stick.rotation.z = 1.9;
        r.upper.rotation.z = 0.1; r.upper.position.y = 3.0;
        r.root.position.y = Math.max(0, Math.sin(k * 9)) * 0.35 * Math.max(0, 1 - k / 3);
      }
      // names only around the puck (plus the player the clip is about), so a crowded slot stays readable
      const near = Math.hypot(s.x - frame.p.x, s.z - frame.p.z) < 26;
      r.label.visible = ((this.labels && near) || id === this.focusId) && !!a.name;
      if (r.label.visible) this.setLabel(r, a, id === this.focusId);
    });
    const p = frame.p;
    this.puck.position.set(p.x, p.y + 0.07, p.z);
    // streak behind a flying puck
    if (p.flying) { this.trailPts.push(this.puck.position.clone()); if (this.trailPts.length > 9) this.trailPts.shift(); }
    else if (this.trailPts.length) this.trailPts.shift();
    this.trail.geometry.dispose();
    this.trail.geometry = new THREE.BufferGeometry().setFromPoints(this.trailPts.length > 1 ? this.trailPts : []);
  }

  render(dt: number) {
    this.clock += dt;
    // goal light pulse
    for (const [k, m] of Object.entries(this.goalLights)) {
      const on = this.clock < this.goalLightUntil && k === String(this.goalLightDir);
      (m.material as THREE.MeshStandardMaterial).emissiveIntensity = on ? 2.5 + Math.sin(this.clock * 14) * 1.5 : 0;
    }
    this.updateCamera(dt, false);
    this.renderer.render(this.scene, this.camera);
  }

  private updateCamera(dt: number, snap: boolean) {
    if (this.mode !== "free") {
      const P = this.puck.position, d = this.attackDir;
      const focus = this.focusId ? this.rigs.get(this.focusId)?.root.position : null;
      const want = new THREE.Vector3(), look = new THREE.Vector3();
      switch (this.mode) {
        case "end": want.set(d * 128, 26, P.z * 0.25); look.set(d * 55, 0, P.z * 0.4); break;
        case "goalcam": want.set(d * (RINK.goalLine + 2.6), 2.6, 0); look.set(P.x, 1.5, P.z); break;
        case "follow": { const t = focus ?? P; want.set(t.x - d * 30, 13, t.z * 0.8 + 6); look.set(t.x + d * 14, 1, t.z * 0.8); break; }
        case "top": want.set(P.x * 0.15, 185, 0.01); look.set(P.x * 0.15, 0, 0); break;
        default: { const cx = Math.max(-62, Math.min(62, P.x * 0.85)); want.set(cx, 54, 80); look.set(cx, 0, 1); } // high gondola, clears the near stands
      }
      const k = snap ? 1 : 1 - Math.exp(-dt * (this.mode === "goalcam" ? 10 : 3.2));
      this.camPos.lerp(want, k); this.camLook.lerp(look, k);
      this.camera.position.copy(this.camPos); this.camera.lookAt(this.camLook);
    } else {
      this.controls.update();
      this.camLook.copy(this.controls.target); this.camPos.copy(this.camera.position);
    }
  }

  /** Jump the camera to its target instead of easing (first frame, mode switch). */
  snapCamera() { this.updateCamera(0, true); }

  dispose() {
    this.controls.dispose();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
      for (const mt of mats) { (mt as THREE.MeshStandardMaterial).map?.dispose(); mt.dispose(); }
    });
    for (const d of this.disposables) d.dispose();
    this.renderer.dispose();
  }
}
