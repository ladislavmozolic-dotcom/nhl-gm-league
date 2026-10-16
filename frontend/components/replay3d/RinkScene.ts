// The 3D arena: ice with real NHL markings, boards + glass, nets, a crowd, and a
// pool of jersey-coloured skaters/goalies the replay and live views move around.
// Plain three.js (no React renderer) — the owning component drives it from one
// requestAnimationFrame loop and disposes it on unmount.

import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { Arena, roundedRect, glowTexture } from "./arena";
import { makeRig, disposeRig, type Rig } from "./players";
import { RINK, POSE, type Actor, type ClipFrame } from "@/lib/replay3d/reconstruct";
import type { Kit } from "@/lib/replay3d/team-colors";

export type CameraMode = "broadcast" | "end" | "reverse" | "goalcam" | "ice" | "follow" | "top" | "free";

const PX = 10.24; // ice texture pixels per foot

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
  private arena: Arena;
  private goalGlow: Record<string, THREE.Sprite> = {};
  private disposables: Array<{ dispose(): void }> = [];
  private small = false;

  constructor(canvas: HTMLCanvasElement, opts: { homeKit: Kit; awayKit: Kit; homeLogoUrl?: string | null; occupancy?: number | null; homeCode?: string | null; awayCode?: string | null; homeName?: string | null }) {
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
    // the ice is lit hard from the rigs; the bowl sits darker so the play pops
    this.scene.add(new THREE.HemisphereLight("#e8f0ff", "#141a26", 0.8));
    const sun = new THREE.DirectionalLight("#ffffff", 2.5);
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
    const iceMat = new THREE.MeshPhysicalMaterial({ map: iceTexture(null), roughness: 0.22, metalness: 0.04, clearcoat: 1.0, clearcoatRoughness: 0.08, reflectivity: 0.88 });
    this.ice = new THREE.Mesh(iceGeo, iceMat); this.ice.receiveShadow = true;
    this.scene.add(this.ice);
    if (opts.homeLogoUrl) {
      const img = new Image(); img.crossOrigin = "anonymous";
      img.onload = () => { const old = iceMat.map; iceMat.map = iceTexture(img); iceMat.needsUpdate = true; old?.dispose(); };
      img.src = opts.homeLogoUrl;
    }

    // the building: boards + ads, glass, benches, the two-tier bowl, the crowd, the roof
    this.arena = new Arena({
      homeKit: opts.homeKit, awayKit: opts.awayKit, small: this.small,
      occupancy: opts.occupancy ?? 0.92, homeCode: opts.homeCode ?? "HOME", awayCode: opts.awayCode ?? "AWAY", homeName: opts.homeName ?? "UNHL",
    });
    this.scene.add(this.arena.group);

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
    for (const y of [-6.4, 6.4]) {
      const ring = new THREE.Mesh(new THREE.BoxGeometry(26.4, 0.8, 18.4), new THREE.MeshStandardMaterial({ color: "#000", emissive: opts.homeKit.jersey === "#f4f4f4" ? "#3b82f6" : opts.homeKit.jersey, emissiveIntensity: 2.2 }));
      ring.position.y = y; this.jumbo.add(ring);
    }
    this.scene.add(this.jumbo);

    // puck + its streak
    this.puck = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.14, 24), new THREE.MeshStandardMaterial({ color: "#0a0a0a", roughness: 0.5 }));
    this.puck.castShadow = true; this.scene.add(this.puck);
    this.trail = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: "#ffe28a", transparent: true, opacity: 0.85 }));
    this.trail.frustumCulled = false;
    this.scene.add(this.trail);
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
    const light = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: "#5a0d0d", emissive: "#ff1a1a", emissiveIntensity: 0 }));
    light.position.set(RINK.halfLength - RINK.goalLine + 0.6, 10.25, 0); g.add(light); // a small dome on top of the glass
    this.goalLights[String(d)] = light;
    // the red halo that blooms around it when it goes on
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: "#ff2a2a", blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
    halo.scale.set(7, 7, 1); halo.position.copy(light.position); halo.visible = false; g.add(halo);
    this.goalGlow[String(d)] = halo;
    return g;
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
    for (const [id, r] of this.rigs) if (!keep.has(id)) { this.scene.remove(r.root); disposeRig(r); this.rigs.delete(id); }
    for (const a of actors) {
      const r = this.rigs.get(a.id);
      const sig = `${a.side}|${a.role}|${a.number}`;
      if (r && r.root.userData.sig === sig) continue;
      if (r) { this.scene.remove(r.root); disposeRig(r); }
      const nr = makeRig(this.scene, a, this.kits[a.side]); nr.root.userData.sig = sig; this.rigs.set(a.id, nr);
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
    this.arena.setTopView(mode === "top");
  }

  resize(w: number, h: number) {
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / Math.max(1, h); this.camera.updateProjectionMatrix();
  }

  /** Pose everyone from one interpolated frame (EA NHL console style biomechanics). */
  setFrame(frame: ClipFrame, dt: number) {
    this.order.forEach((id, i) => {
      const r = this.rigs.get(id),
        s = frame.a[i],
        a = this.actorsById.get(id);
      if (!r || !s || !a) return;

      r.root.position.set(s.x, 0, s.z);
      r.root.rotation.y = -s.h;

      // Heading delta for dynamic turn banking (leaning into curves)
      let dh = s.h - (r.prevHeading || s.h);
      while (dh > Math.PI) dh -= 2 * Math.PI;
      while (dh < -Math.PI) dh += 2 * Math.PI;
      r.prevHeading = s.h;

      const v = Math.min(1, s.speed / 20);
      const turnRate = dt > 0.001 ? Math.max(-1, Math.min(1, (dh / dt) * 0.2)) : 0;
      const targetBank = turnRate * v * 0.38;
      r.bankAngle += (targetBank - r.bankAngle) * Math.min(1, dt * 9);

      // Stride cycle frequency (faster strides when sprinting)
      r.phase += dt * (3.0 + s.speed * 0.36);
      const strideL = Math.sin(r.phase);
      const strideR = -strideL;

      // Check if skater is carrying the puck
      const distToPuck = Math.hypot(s.x - frame.p.x, s.z - frame.p.z);
      const hasPuck = distToPuck < 4.2;

      // Athletic hockey crouch: center of gravity drops as speed increases
      r.pelvis.position.y = -0.12 - 0.22 * v;
      // Lateral weight shift over the gliding skate
      r.pelvis.position.z = Math.sin(r.phase) * 0.16 * v;
      // Banking into turn + subtle pelvic roll
      r.pelvis.rotation.x = r.bankAngle + Math.sin(r.phase) * 0.05 * v;
      r.pelvis.rotation.z = -0.05 * v;

      // Athletic forward pitch of spine
      r.upper.rotation.z = -0.22 - 0.28 * v;
      r.upper.rotation.x = Math.sin(r.phase) * 0.05 * v;
      r.upper.position.y = 3.05;

      if (r.goalie) {
        // --- GOALIE BIOMECHANICS ---
        r.upper.rotation.z = -0.38;
        r.upper.position.y = 2.65;
        r.pelvis.position.y = -0.25;

        // Wide active ready stance
        r.thighL.rotation.set(-0.25, 0, 0.42);
        r.thighR.rotation.set(0.25, 0, 0.42);
        r.shinL.rotation.set(0, 0, -0.55);
        r.shinR.rotation.set(0, 0, -0.55);
        r.skateL.rotation.set(0, 0, 0.15);
        r.skateR.rotation.set(0, 0, 0.15);

        // Blocker and Catcher active in front of chest
        r.armL.rotation.set(0.45, 0, 0.55);
        r.armR.rotation.set(-0.35, 0, 0.65);
        r.forearmL.rotation.set(0, 0, -0.5);
        r.forearmR.rotation.set(0, 0, -0.45);

        r.stick.position.set(0.85, 0.45, 0.3);
        r.stick.rotation.set(0, 0, 0.15);

        if (s.pose === POSE.BUTTERFLY) {
          // Modern Butterfly Slide: knees drop tight to seal the 5-hole,
          // shins flare outward 85° to seal ice from post to post!
          r.pelvis.position.y = -1.45;
          r.upper.position.y = 2.05;
          r.upper.rotation.z = -0.16;

          // Thighs together, angled down
          r.thighL.rotation.set(1.42, 0, 0.2);
          r.thighR.rotation.set(-1.42, 0, 0.2);
          // Shins flared wide across the ice
          r.shinL.rotation.set(1.5, 0, 0.75);
          r.shinR.rotation.set(-1.5, 0, 0.75);

          // Catcher & Blocker tracking puck
          r.armL.rotation.set(0.85, 0, 0.4);
          r.armR.rotation.set(-0.3, 0, 0.55);
          r.forearmL.rotation.set(0, 0, -0.3);
          r.forearmR.rotation.set(0, 0, -0.3);

          // Paddle seals 5-hole
          r.stick.position.set(0.72, -0.15, 0.15);
          r.stick.rotation.set(0.1, 0, 0.3);
        }
      } else if (s.pose === POSE.SHOOT) {
        // --- EXPLOSIVE NHL SHOT BIOMECHANICS ---
        const k = s.poseT;
        const wind = k < 0.5 ? k / 0.5 : 1 - (k - 0.5) / 0.15;
        const follow = k > 0.5 ? Math.min(1, (k - 0.5) / 0.35) : 0;

        // Weight shifts to back leg during windup, drives forward on release
        r.pelvis.position.y = -0.28 - 0.15 * Math.max(0, wind);
        r.pelvis.position.x = 0.2 * follow - 0.15 * Math.max(0, wind);

        // Torso coils on backswing, explosive uncoiling through release
        r.upper.rotation.y = 0.65 * Math.max(0, wind) - 0.55 * follow;
        r.upper.rotation.z = -0.28 - 0.25 * follow;

        // Stick sweeps back, flexes into ice, and follows through towards goal
        r.stick.rotation.z = -1.65 * Math.max(0, wind) + 1.1 * follow;
        r.stick.rotation.y = 0.4 * Math.max(0, wind) - 0.3 * follow;

        // Arms & shoulders flex through the shot
        r.armR.rotation.z = 0.95 - 1.4 * Math.max(0, wind) + 0.65 * follow;
        r.armL.rotation.z = 0.65 + 0.8 * Math.max(0, wind) - 0.45 * follow;
        r.forearmR.rotation.z = -0.55 + 0.5 * follow;
        r.forearmL.rotation.z = -0.45;

        // Front leg plants firmly with knee bend, back leg kicks back for balance
        r.thighL.rotation.set(-0.15, 0, 0.45 * follow - 0.3 * Math.max(0, wind));
        r.shinL.rotation.set(0, 0, -0.6 * follow);
        r.thighR.rotation.set(0.15, 0, -0.55 * follow + 0.25 * Math.max(0, wind));
        r.shinR.rotation.set(0, 0, 0.4 * follow);
      } else if (s.pose === POSE.CELEBRATE) {
        // --- GOAL CELEBRATION ---
        const k = s.poseT;
        // Arms high in the air in triumph!
        r.armL.rotation.set(2.55, 0, 0.25);
        r.armR.rotation.set(-2.55, 0, 0.25 + Math.sin(k * 10) * 0.35);
        r.forearmL.rotation.set(0, 0, 0.2);
        r.forearmR.rotation.set(0, 0, 0.2);
        r.stick.rotation.set(0, 0, 1.85);

        r.upper.rotation.set(0, 0, 0.1);
        r.upper.position.y = 3.05;
        // Hop & fist pump
        r.pelvis.position.y = Math.max(0, Math.sin(k * 9)) * 0.42 * Math.max(0, 1 - k / 3);

        r.thighL.rotation.set(-0.1, 0, 0.2);
        r.thighR.rotation.set(0.1, 0, -0.3);
        r.shinL.rotation.set(0, 0, -0.4);
        r.shinR.rotation.set(0, 0, -0.5);
      } else {
        // --- NATURAL NHL SKATING STRIDE & STICKHANDLING ---
        // Left Leg: 40-45° lateral push-off when extending, knee flex when recovering
        const pushL = Math.max(0, -strideL);
        const glideL = Math.max(0, strideL);
        r.thighL.rotation.z = 0.35 * v - strideL * 0.58 * v; // Hip push backward
        r.thighL.rotation.x = -0.1 - pushL * 0.42 * v; // 45° lateral push-off!
        r.shinL.rotation.z = -0.42 - pushL * 0.35 * v + glideL * 0.45 * v; // Knee flexion/extension
        r.skateL.rotation.z = -r.thighL.rotation.z - r.shinL.rotation.z; // Keeps blade aligned to ice

        // Right Leg: in opposition
        const pushR = Math.max(0, -strideR);
        const glideR = Math.max(0, strideR);
        r.thighR.rotation.z = 0.35 * v - strideR * 0.58 * v;
        r.thighR.rotation.x = 0.1 + pushR * 0.42 * v;
        r.shinR.rotation.z = -0.42 - pushR * 0.35 * v + glideR * 0.45 * v;
        r.skateR.rotation.z = -r.thighR.rotation.z - r.shinR.rotation.z;

        // Stickhandling & Arm Mechanics
        if (hasPuck) {
          // Puck carrier: hands and stick sweep smoothly side-to-side (dangling / stickhandling)
          const stickWag = Math.sin(r.phase * 1.6) * 0.28;
          r.upper.rotation.y = stickWag * 0.35;
          r.stick.position.set(0.92, 0.65, 0.45 + stickWag * 0.35);
          r.stick.rotation.set(0, stickWag * 0.4, 0);

          r.armL.rotation.set(0.2, stickWag * 0.2, 0.68);
          r.armR.rotation.set(-0.2, stickWag * 0.2, 0.88);
          r.forearmL.rotation.set(0, 0, -0.52);
          r.forearmR.rotation.set(0, 0, -0.68);
        } else {
          // Non-carrier: natural arm pump in counter-balance to strides
          r.upper.rotation.y = 0;
          r.stick.position.set(0.92, 0.65, 0.45);
          r.stick.rotation.set(0, 0, 0);

          r.armL.rotation.set(0, 0, 0.68 + strideR * 0.32 * v);
          r.armR.rotation.set(0, 0, 0.88 + strideL * 0.32 * v);
          r.forearmL.rotation.set(0, 0, -0.45);
          r.forearmR.rotation.set(0, 0, -0.55);
        }
      }

      // Names only around the puck (plus the player the clip is about)
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

  /** The crowd of `side` reacts (goal: 1, big chance ~0.3). */
  cheer(side: "home" | "away", level = 1, seconds = 6) { this.arena.cheer(side, level, seconds); }

  render(dt: number) {
    this.clock += dt;
    this.arena.update(dt);
    // goal light pulse
    for (const [k, m] of Object.entries(this.goalLights)) {
      const on = this.clock < this.goalLightUntil && k === String(this.goalLightDir);
      (m.material as THREE.MeshStandardMaterial).emissiveIntensity = on ? 2.5 + Math.sin(this.clock * 14) * 1.5 : 0;
      const halo = this.goalGlow[k]; halo.visible = on; if (on) { const s = 6 + Math.sin(this.clock * 14) * 1.5; halo.scale.set(s, s, 1); }
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
        case "end":
          // Behind the glass looking down the slot
          want.set(d * 126, 25, P.z * 0.25);
          look.set(d * 52, 1, P.z * 0.35);
          break;
        case "reverse":
          // Low reverse angle behind the net looking out into the scoring zone
          want.set(d * 106, 11, P.z * 0.4);
          look.set(d * 62, 2.2, P.z * 0.5);
          break;
        case "goalcam":
          // Looking directly across the goal line from inside the net
          want.set(d * (RINK.goalLine + 2.8), 2.5, 0);
          look.set(Math.max(-20, Math.min(20, P.x)), 1.4, Math.max(-10, Math.min(10, P.z)));
          break;
        case "ice":
          // Dynamic low ice-level cable/rail cam along boards tracking the rush
          want.set(P.x - d * 22, 5.2, d > 0 ? 38 : -38);
          look.set(P.x + d * 10, 2.0, P.z * 0.7);
          break;
        case "follow": {
          const t = focus ?? P;
          want.set(t.x - d * 28, 12, t.z * 0.7 + 5);
          look.set(t.x + d * 14, 2.0, t.z * 0.7);
          break;
        }
        case "top":
          want.set(P.x * 0.15, 185, 0.01);
          look.set(P.x * 0.15, 0, 0);
          break;
        default: {
          // Broadcast high cam: lead ahead of the puck slightly with smooth operator inertia
          const cx = Math.max(-60, Math.min(60, P.x * 0.8 + d * 4));
          want.set(cx, 52, 78);
          look.set(cx + d * 2, 0, 0);
        }
      }
      const k = snap ? 1 : 1 - Math.exp(-dt * (this.mode === "goalcam" ? 10 : 3.6));
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
