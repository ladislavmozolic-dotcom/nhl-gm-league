// Skater and goalie models: shoulder pads under the sweater, striped hem and
// sleeves, breezers with a stripe, socks, skates with steel, a helmet with a visor,
// name + number on the back. Built from primitives (no model files), one Group per
// player with pivots the animation code drives: legs at the hips, an upper body
// with arms at the shoulders and the stick in the hands.

import * as THREE from "three";
import type { Actor } from "@/lib/replay3d/reconstruct";
import type { Kit } from "@/lib/replay3d/team-colors";

export type Rig = {
  root: THREE.Group; upper: THREE.Group; legL: THREE.Group; legR: THREE.Group; armL: THREE.Group; armR: THREE.Group;
  stick: THREE.Group; label: THREE.Sprite; labelKey: string; phase: number; goalie: boolean; side: "home" | "away";
};

function tex(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
  draw(cv.getContext("2d")!);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}

const lastName = (n: string) => (n.includes(" ") ? n.split(" ").slice(1).join(" ") : n).replace(/\(.*?\)/g, "").trim().toUpperCase();

// shared materials per kit (a team's five skaters reuse them)
const kitCache = new Map<string, Record<string, THREE.Material>>();
function mats(kit: Kit): Record<string, THREE.Material> {
  const key = `${kit.jersey}|${kit.trim}|${kit.helmet}|${kit.pants}`;
  let m = kitCache.get(key);
  if (!m) {
    m = {
      jersey: new THREE.MeshStandardMaterial({ color: kit.jersey, roughness: 0.75 }),
      trim: new THREE.MeshStandardMaterial({ color: kit.trim, roughness: 0.7 }),
      pants: new THREE.MeshStandardMaterial({ color: kit.pants, roughness: 0.8 }),
      helmet: new THREE.MeshStandardMaterial({ color: kit.helmet, roughness: 0.25, metalness: 0.15 }),
      dark: new THREE.MeshStandardMaterial({ color: "#121212", roughness: 0.5 }),
      steel: new THREE.MeshStandardMaterial({ color: "#d9dee5", roughness: 0.2, metalness: 0.9 }),
      visor: new THREE.MeshPhysicalMaterial({ color: "#9fb8d0", roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.45 }),
      skin: new THREE.MeshStandardMaterial({ color: "#d9a882", roughness: 0.8 }),
      pad: new THREE.MeshStandardMaterial({ color: "#f2f2f2", roughness: 0.55 }),
      padTrim: new THREE.MeshStandardMaterial({ color: kit.trim === "#f4f4f4" ? kit.jersey : kit.trim, roughness: 0.55 }),
      tape: new THREE.MeshStandardMaterial({ color: "#f5f5f5", roughness: 0.9 }),
      stick: new THREE.MeshStandardMaterial({ color: "#1d1d1d", roughness: 0.45, metalness: 0.2 }),
      cage: new THREE.MeshStandardMaterial({ color: "#d9d9d9", roughness: 0.3, metalness: 0.8, wireframe: true }),
    };
    kitCache.set(key, m);
  }
  return m;
}

export function makeRig(scene: THREE.Scene, a: Actor, kit: Kit): Rig {
  const M = mats(kit);
  const G = a.role === "G";
  const root = new THREE.Group();
  const cast = <T extends THREE.Mesh>(m: T) => { m.castShadow = true; return m; };
  const add = (parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) => {
    const m = cast(new THREE.Mesh(geo, mat)); m.position.set(x, y, z); m.scale.set(sx, sy, sz); parent.add(m); return m;
  };

  const mkLeg = (z: number) => {
    const leg = new THREE.Group(); leg.position.set(0, 3.0, z);
    // breezers (tapered) with a stripe, then sock, then skate
    add(leg, new THREE.CylinderGeometry(G ? 0.5 : 0.44, G ? 0.42 : 0.34, 1.1, 12), M.pants, 0, -0.5, 0);
    add(leg, new THREE.CylinderGeometry(G ? 0.505 : 0.445, G ? 0.505 : 0.445, 0.12, 12, 1, true), M.trim, 0, -0.05, 0);
    if (G) {
      // goalie leg pad: tall rounded block with a coloured knee roll
      add(leg, new THREE.BoxGeometry(0.7, 2.2, 0.85), M.pad, 0.2, -1.85, 0);
      add(leg, new THREE.BoxGeometry(0.72, 0.35, 0.87), M.padTrim, 0.2, -1.1, 0);
      add(leg, new THREE.BoxGeometry(0.72, 0.2, 0.87), M.padTrim, 0.2, -2.4, 0);
    } else {
      add(leg, new THREE.CapsuleGeometry(0.25, 1.0, 4, 10), M.jersey, 0, -1.7, 0);
      add(leg, new THREE.CylinderGeometry(0.26, 0.26, 0.16, 10, 1, true), M.trim, 0, -1.55, 0);
      add(leg, new THREE.CylinderGeometry(0.26, 0.26, 0.1, 10, 1, true), M.trim, 0, -1.8, 0);
    }
    add(leg, new THREE.BoxGeometry(1.0, 0.36, 0.34), M.dark, 0.12, -2.72, 0);
    add(leg, new THREE.BoxGeometry(1.15, 0.08, 0.06), M.steel, 0.12, -2.93, 0);
    return leg;
  };
  const legL = mkLeg(-0.42), legR = mkLeg(0.42);
  root.add(legL, legR);

  const upper = new THREE.Group(); upper.position.y = 3.0; root.add(upper);
  const chest = G ? 1.0 : 0.8;
  add(upper, new THREE.CapsuleGeometry(chest, 1.05, 6, 16), M.jersey, 0, 1.0, 0, 0.72, 1, 1);
  // shoulder pads under the sweater + a yoke stripe across them
  for (const z of [-1, 1]) add(upper, new THREE.SphereGeometry(G ? 0.55 : 0.46, 12, 10), M.jersey, 0, 1.72, z * (G ? 0.78 : 0.68), 0.95, 0.8, 1);
  add(upper, new THREE.CylinderGeometry(chest + 0.01, chest + 0.01, 0.16, 18, 1, true), M.trim, 0, 1.55, 0, 0.73, 1, 1);
  add(upper, new THREE.CylinderGeometry(chest + 0.02, chest - 0.02, 0.3, 18, 1, true), M.trim, 0, 0.28, 0, 0.74, 1, 1);
  // head: helmet + visor (skater) or painted mask with a cage (goalie)
  add(upper, new THREE.CylinderGeometry(0.22, 0.24, 0.3, 10), M.skin, 0, 2.05, 0);
  if (G) {
    add(upper, new THREE.SphereGeometry(0.5, 16, 12), M.helmet, 0, 2.5, 0, 1, 1.05, 0.95);
    add(upper, new THREE.SphereGeometry(0.42, 10, 8, -Math.PI / 2, Math.PI), M.cage, 0.18, 2.42, 0, 0.9, 1, 1);
  } else {
    add(upper, new THREE.SphereGeometry(0.47, 16, 12), M.helmet, 0, 2.48, 0, 1.08, 0.95, 0.95);
    add(upper, new THREE.SphereGeometry(0.34, 10, 8), M.skin, 0.15, 2.3, 0);
    add(upper, new THREE.BoxGeometry(0.08, 0.22, 0.7), M.visor, 0.47, 2.42, 0);
  }
  // name + number on the back, small number on the chest
  if (a.number != null || a.name) {
    const nm = lastName(a.name);
    const back = tex(256, 256, (c) => {
      c.textAlign = "center"; c.textBaseline = "middle"; c.fillStyle = kit.number;
      if (nm) { c.font = `bold ${nm.length > 9 ? 30 : 38}px Arial, sans-serif`; c.fillText(nm, 128, 42, 240); }
      if (a.number != null) { c.font = "bold 150px Arial Black, Arial, sans-serif"; c.fillText(String(a.number), 128, 160); }
    });
    const mat = new THREE.MeshBasicMaterial({ map: back, transparent: true, depthWrite: false });
    const b = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 1.25), mat); b.position.set(-0.585, 1.12, 0); b.rotation.y = -Math.PI / 2; upper.add(b);
    if (a.number != null) {
      const f = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.42), mat.clone()); (f.material as THREE.MeshBasicMaterial).map = tex(128, 128, (c) => { c.textAlign = "center"; c.textBaseline = "middle"; c.fillStyle = kit.number; c.font = "bold 80px Arial Black, Arial, sans-serif"; c.fillText(String(a.number), 64, 70); });
      f.position.set(0.585, 1.4, 0.3); f.rotation.y = Math.PI / 2; upper.add(f);
    }
  }
  const mkArm = (z: number) => {
    const arm = new THREE.Group(); arm.position.set(0, 1.72, z);
    add(arm, new THREE.CapsuleGeometry(G ? 0.3 : 0.24, 0.95, 4, 10), M.jersey, 0, -0.6, 0);
    add(arm, new THREE.CylinderGeometry(G ? 0.31 : 0.25, G ? 0.31 : 0.25, 0.14, 10, 1, true), M.trim, 0, -0.75, 0);
    add(arm, new THREE.CylinderGeometry(G ? 0.31 : 0.25, G ? 0.31 : 0.25, 0.08, 10, 1, true), M.trim, 0, -0.95, 0);
    add(arm, new THREE.BoxGeometry(0.44, 0.42, 0.42), G ? M.pad : M.trim, 0, -1.3, 0);
    return arm;
  };
  const armL = mkArm(-(G ? 1.05 : 0.95)), armR = mkArm(G ? 1.05 : 0.95);
  armL.rotation.z = 0.7; armR.rotation.z = 0.9;
  upper.add(armL, armR);
  if (G) {
    add(armR, new THREE.BoxGeometry(0.18, 1.0, 0.75), M.pad, 0.12, -1.35, 0.25);
    add(armR, new THREE.BoxGeometry(0.2, 0.35, 0.77), M.padTrim, 0.13, -1.0, 0.25);
    const glove = add(armL, new THREE.CylinderGeometry(0.56, 0.56, 0.24, 18), M.padTrim, 0.15, -1.35, -0.2); glove.rotation.z = Math.PI / 2;
    add(armL, new THREE.BoxGeometry(0.26, 0.5, 0.95), M.pad, 0.15, -1.6, -0.2);
  }
  // stick: pivot at the hands, blade near the ice ahead and to the right, taped blade
  const stick = new THREE.Group(); stick.position.set(0.95, 0.65, 0.5);
  const shaft = add(stick, new THREE.BoxGeometry(0.09, G ? 3.6 : 4.6, 0.12), M.stick, 0, G ? -1.4 : -1.9, 0); shaft.rotation.z = G ? 0.35 : 0.55;
  add(stick, new THREE.BoxGeometry(G ? 1.4 : 1.15, G ? 0.35 : 0.28, 0.08), M.stick, G ? 0.9 : 1.6, G ? -3.05 : -3.55, 0);
  add(stick, new THREE.BoxGeometry(G ? 1.0 : 0.8, G ? 0.25 : 0.2, 0.09), M.tape, G ? 0.95 : 1.65, G ? -3.05 : -3.55, 0);
  if (G) add(stick, new THREE.BoxGeometry(0.12, 1.3, 0.13), M.stick, 0.42, -2.25, 0).rotation.z = 0.35; // the paddle
  upper.add(stick);

  const label = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthTest: false }));
  label.position.y = 7.6; label.renderOrder = 10; root.add(label);
  scene.add(root);
  return { root, upper, legL, legR, armL, armR, stick, label, labelKey: "", phase: Math.random() * 6, goalie: G, side: a.side };
}

/** Free a rig's per-player resources (shared kit materials stay cached). */
export function disposeRig(r: Rig) {
  r.root.traverse((o) => {
    const m = o as THREE.Mesh;
    m.geometry?.dispose();
    const mat = m.material as THREE.MeshBasicMaterial | undefined;
    if (mat && (mat.map || o === r.label)) { mat.map?.dispose(); mat.dispose(); }
  });
}
