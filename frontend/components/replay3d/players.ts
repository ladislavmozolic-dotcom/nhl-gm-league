// Articulated skater and goalie models (EA Sports NHL console style):
// Hierarchical skeleton (hips, knees, ankles, shoulders, elbows, stick, neck),
// athletic hockey stance, contoured breezers, shin guards, Tuuk skate holders with steel runners,
// hockey gloves, curved aerodynamic helmets with tinted visors, and modern goalie butterfly pads.

import * as THREE from "three";
import type { Actor } from "@/lib/replay3d/reconstruct";
import type { Kit } from "@/lib/replay3d/team-colors";

export type Rig = {
  root: THREE.Group;
  pelvis: THREE.Group;
  upper: THREE.Group;
  head: THREE.Group;
  // Articulated legs (hip -> knee -> ankle)
  thighL: THREE.Group;
  thighR: THREE.Group;
  shinL: THREE.Group;
  shinR: THREE.Group;
  skateL: THREE.Group;
  skateR: THREE.Group;
  // Articulated arms (shoulder -> elbow -> stick)
  armL: THREE.Group;
  armR: THREE.Group;
  forearmL: THREE.Group;
  forearmR: THREE.Group;
  stick: THREE.Group;
  label: THREE.Sprite;
  labelKey: string;
  // Biomechanics state
  phase: number;
  prevHeading: number;
  bankAngle: number;
  goalie: boolean;
  side: "home" | "away";
};

function tex(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  draw(cv.getContext("2d")!);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const lastName = (n: string) =>
  (n.includes(" ") ? n.split(" ").slice(1).join(" ") : n).replace(/\(.*?\)/g, "").trim().toUpperCase();

// Shared materials per kit
const kitCache = new Map<string, Record<string, THREE.Material>>();
function mats(kit: Kit): Record<string, THREE.Material> {
  const key = `${kit.jersey}|${kit.trim}|${kit.helmet}|${kit.pants}`;
  let m = kitCache.get(key);
  if (!m) {
    m = {
      jersey: new THREE.MeshStandardMaterial({ color: kit.jersey, roughness: 0.65 }),
      trim: new THREE.MeshStandardMaterial({ color: kit.trim, roughness: 0.6 }),
      pants: new THREE.MeshStandardMaterial({ color: kit.pants, roughness: 0.75 }),
      helmet: new THREE.MeshStandardMaterial({ color: kit.helmet, roughness: 0.2, metalness: 0.18 }),
      dark: new THREE.MeshStandardMaterial({ color: "#14161a", roughness: 0.45 }),
      tuuk: new THREE.MeshStandardMaterial({ color: "#f8fafc", roughness: 0.4 }),
      steel: new THREE.MeshStandardMaterial({ color: "#e2e8f0", roughness: 0.12, metalness: 0.95 }),
      visor: new THREE.MeshPhysicalMaterial({
        color: "#a5c5e8",
        roughness: 0.04,
        metalness: 0.05,
        transparent: true,
        opacity: 0.45,
        reflectivity: 0.9,
      }),
      skin: new THREE.MeshStandardMaterial({ color: "#d5a582", roughness: 0.8 }),
      glovePalm: new THREE.MeshStandardMaterial({ color: "#473b32", roughness: 0.85 }),
      pad: new THREE.MeshStandardMaterial({ color: "#f4f5f7", roughness: 0.45 }),
      padTrim: new THREE.MeshStandardMaterial({
        color: kit.trim === "#f4f4f4" ? kit.jersey : kit.trim,
        roughness: 0.45,
      }),
      tape: new THREE.MeshStandardMaterial({ color: "#f1f5f9", roughness: 0.92 }),
      stick: new THREE.MeshStandardMaterial({ color: "#1e2229", roughness: 0.35, metalness: 0.25 }),
      cage: new THREE.MeshStandardMaterial({ color: "#cbd5e1", roughness: 0.25, metalness: 0.85, wireframe: true }),
    };
    kitCache.set(key, m);
  }
  return m;
}

export function makeRig(scene: THREE.Scene, a: Actor, kit: Kit): Rig {
  const M = mats(kit);
  const G = a.role === "G";
  const root = new THREE.Group();
  const cast = <T extends THREE.Mesh>(m: T) => {
    m.castShadow = true;
    return m;
  };
  const add = (
    parent: THREE.Object3D,
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    x = 0,
    y = 0,
    z = 0,
    sx = 1,
    sy = 1,
    sz = 1
  ) => {
    const m = cast(new THREE.Mesh(geo, mat));
    m.position.set(x, y, z);
    m.scale.set(sx, sy, sz);
    parent.add(m);
    return m;
  };

  // Pelvis root (controls hockey crouch, weight shift & turn banking)
  const pelvis = new THREE.Group();
  pelvis.position.y = 0;
  root.add(pelvis);

  // --- LEGS (Hierarchical Articulation: Thigh -> Shin -> Skate) ---
  const mkLeg = (z: number) => {
    // 1. Thigh (Hip Joint)
    const thigh = new THREE.Group();
    thigh.position.set(0, 3.05, z);

    // Breezers / Hockey pants (tapered thigh padding with kidney protector & side stripe)
    add(thigh, new THREE.CylinderGeometry(G ? 0.52 : 0.45, G ? 0.44 : 0.35, 1.15, 14), M.pants, 0, -0.55, 0);
    add(thigh, new THREE.CylinderGeometry(G ? 0.53 : 0.46, G ? 0.53 : 0.46, 0.14, 14, 1, true), M.trim, 0, -0.05, 0);
    // Outer hip pad
    add(thigh, new THREE.BoxGeometry(0.5, 0.9, 0.16), M.pants, 0, -0.5, z > 0 ? 0.28 : -0.28);

    // 2. Shin (Knee Joint) - attached under thigh
    const shin = new THREE.Group();
    shin.position.set(0, -1.15, 0);
    thigh.add(shin);

    if (G) {
      // Modern goalie butterfly pad (outer roll, knee cradle, square top profile)
      add(shin, new THREE.BoxGeometry(0.72, 2.3, 0.88), M.pad, 0.18, -0.75, 0);
      add(shin, new THREE.BoxGeometry(0.74, 0.38, 0.9), M.padTrim, 0.18, 0.05, 0); // knee block
      add(shin, new THREE.BoxGeometry(0.74, 0.24, 0.9), M.padTrim, 0.18, -1.35, 0); // boot channel
      add(shin, new THREE.CylinderGeometry(0.12, 0.12, 2.2, 8), M.padTrim, -0.15, -0.75, z > 0 ? 0.44 : -0.44); // outer roll
    } else {
      // Knee cap shell
      add(shin, new THREE.SphereGeometry(0.3, 10, 8), M.dark, 0.06, 0.02, 0);
      // Hockey sock / Shin guard with team jersey color and striped bands
      add(shin, new THREE.CapsuleGeometry(0.26, 1.05, 4, 12), M.jersey, 0, -0.65, 0);
      add(shin, new THREE.CylinderGeometry(0.27, 0.27, 0.15, 12, 1, true), M.trim, 0, -0.48, 0);
      add(shin, new THREE.CylinderGeometry(0.27, 0.27, 0.1, 12, 1, true), M.trim, 0, -0.72, 0);
    }

    // 3. Skate (Ankle Joint) - attached under shin
    const skate = new THREE.Group();
    skate.position.set(0.06, -1.45, 0);
    shin.add(skate);

    // Molded hockey skate boot with curved tendon guard
    add(skate, new THREE.BoxGeometry(1.05, 0.38, 0.32), M.dark, 0.08, 0.18, 0);
    add(skate, new THREE.BoxGeometry(0.35, 0.32, 0.28), M.dark, -0.32, 0.38, 0); // heel cup
    // White Tuuk blade holder chassis
    add(skate, new THREE.BoxGeometry(1.22, 0.18, 0.08), M.tuuk, 0.08, -0.04, 0);
    // Polished stainless steel runner blade
    add(skate, new THREE.BoxGeometry(1.28, 0.07, 0.03), M.steel, 0.08, -0.15, 0);

    return { thigh, shin, skate };
  };

  const legLParts = mkLeg(-0.43);
  const legRParts = mkLeg(0.43);
  pelvis.add(legLParts.thigh, legRParts.thigh);

  // --- UPPER BODY (Torso, Shoulders, Arms, Head) ---
  const upper = new THREE.Group();
  upper.position.set(0, 3.05, 0);
  pelvis.add(upper);

  const chest = G ? 1.05 : 0.84;
  // Athletic V-taper jersey chest
  add(upper, new THREE.CapsuleGeometry(chest, 1.1, 6, 16), M.jersey, 0, 1.02, 0, 0.74, 1, 1);
  // Shoulder pads under sweater + rounded shoulder bells
  for (const z of [-1, 1]) {
    add(upper, new THREE.SphereGeometry(G ? 0.58 : 0.48, 12, 10), M.jersey, 0, 1.74, z * (G ? 0.8 : 0.7), 0.95, 0.8, 1);
  }
  // Striped hem and waist stripes
  add(upper, new THREE.CylinderGeometry(chest + 0.02, chest + 0.02, 0.18, 18, 1, true), M.trim, 0, 1.58, 0, 0.75, 1, 1);
  add(upper, new THREE.CylinderGeometry(chest + 0.03, chest - 0.02, 0.32, 18, 1, true), M.trim, 0, 0.28, 0, 0.76, 1, 1);

  // --- HEAD & HELMET ---
  const head = new THREE.Group();
  head.position.set(0, 2.05, 0);
  upper.add(head);

  add(head, new THREE.CylinderGeometry(0.22, 0.24, 0.32, 10), M.skin, 0, 0, 0); // neck
  if (G) {
    // Modern painted goalie mask with wire cat-eye cage
    add(head, new THREE.SphereGeometry(0.52, 16, 14), M.helmet, 0, 0.46, 0, 1.02, 1.08, 0.96);
    add(head, new THREE.SphereGeometry(0.44, 12, 10, -Math.PI / 2, Math.PI), M.cage, 0.18, 0.38, 0, 0.92, 1.02, 1);
  } else {
    // Sleek NHL aerodynamic helmet with ear loops and chin strap
    add(head, new THREE.SphereGeometry(0.48, 16, 14), M.helmet, 0, 0.44, 0, 1.08, 0.96, 0.96);
    add(head, new THREE.SphereGeometry(0.35, 10, 8), M.skin, 0.15, 0.26, 0); // face
    // Curved transparent tinted visor
    add(head, new THREE.BoxGeometry(0.08, 0.24, 0.72), M.visor, 0.48, 0.38, 0);
    // Chin strap
    add(head, new THREE.CylinderGeometry(0.25, 0.25, 0.05, 8), M.dark, 0.08, 0.08, 0);
  }

  // Back name & number, chest number
  if (a.number != null || a.name) {
    const nm = lastName(a.name);
    const back = tex(256, 256, (c) => {
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillStyle = kit.number;
      if (nm) {
        c.font = `bold ${nm.length > 9 ? 30 : 38}px Arial, sans-serif`;
        c.fillText(nm, 128, 42, 240);
      }
      if (a.number != null) {
        c.font = "bold 150px Arial Black, Arial, sans-serif";
        c.fillText(String(a.number), 128, 160);
      }
    });
    const mat = new THREE.MeshBasicMaterial({ map: back, transparent: true, depthWrite: false });
    const b = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 1.25), mat);
    b.position.set(-0.6, 1.14, 0);
    b.rotation.y = -Math.PI / 2;
    upper.add(b);

    if (a.number != null) {
      const f = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.42), mat.clone());
      (f.material as THREE.MeshBasicMaterial).map = tex(128, 128, (c) => {
        c.textAlign = "center";
        c.textBaseline = "middle";
        c.fillStyle = kit.number;
        c.font = "bold 80px Arial Black, Arial, sans-serif";
        c.fillText(String(a.number), 64, 70);
      });
      f.position.set(0.6, 1.42, 0.3);
      f.rotation.y = Math.PI / 2;
      upper.add(f);
    }
  }

  // --- ARMS (Hierarchical Articulation: Shoulder -> Elbow -> Glove) ---
  const mkArm = (z: number, isLeft: boolean) => {
    // 1. Shoulder / Upper Arm
    const arm = new THREE.Group();
    arm.position.set(0, 1.74, z);

    add(arm, new THREE.CapsuleGeometry(G ? 0.31 : 0.25, 0.72, 4, 10), M.jersey, 0, -0.42, 0);
    add(arm, new THREE.CylinderGeometry(G ? 0.32 : 0.26, G ? 0.32 : 0.26, 0.12, 10, 1, true), M.trim, 0, -0.55, 0);

    // 2. Forearm & Glove (Elbow Joint) - attached under arm
    const forearm = new THREE.Group();
    forearm.position.set(0, -0.76, 0);
    arm.add(forearm);

    // Elbow pad
    add(forearm, new THREE.SphereGeometry(0.22, 8, 6), M.dark, -0.06, 0, 0);
    // Forearm sleeve
    add(forearm, new THREE.CapsuleGeometry(G ? 0.28 : 0.23, 0.65, 4, 10), M.jersey, 0, -0.38, 0);
    add(forearm, new THREE.CylinderGeometry(G ? 0.29 : 0.24, G ? 0.29 : 0.24, 0.08, 10, 1, true), M.trim, 0, -0.52, 0);

    // Hockey Glove with flared cuff and grip
    const glove = add(forearm, new THREE.BoxGeometry(0.42, 0.46, 0.38), G ? M.pad : M.trim, 0, -0.84, 0);
    add(glove, new THREE.BoxGeometry(0.24, 0.28, 0.22), M.glovePalm, 0.06, -0.05, 0); // palm grip

    return { arm, forearm };
  };

  const armLParts = mkArm(-(G ? 1.08 : 0.96), true);
  const armRParts = mkArm(G ? 1.08 : 0.96, false);
  upper.add(armLParts.arm, armRParts.arm);

  if (G) {
    // Goalie Blocker (Right Hand)
    add(armRParts.forearm, new THREE.BoxGeometry(0.18, 1.1, 0.82), M.pad, 0.12, -0.88, 0.25);
    add(armRParts.forearm, new THREE.BoxGeometry(0.2, 0.35, 0.84), M.padTrim, 0.13, -0.55, 0.25);
    // Goalie Catcher / Trapper (Left Hand)
    const catcher = add(armLParts.forearm, new THREE.CylinderGeometry(0.58, 0.58, 0.25, 18), M.padTrim, 0.15, -0.88, -0.2);
    catcher.rotation.z = Math.PI / 2;
    add(armLParts.forearm, new THREE.BoxGeometry(0.28, 0.52, 1.0), M.pad, 0.15, -1.15, -0.2); // catching pocket
  }

  // --- HOCKEY STICK (Held by hands in front of body) ---
  const stick = new THREE.Group();
  stick.position.set(0.92, 0.65, 0.45);

  const shaft = add(
    stick,
    new THREE.BoxGeometry(0.08, G ? 3.6 : 4.6, 0.12),
    M.stick,
    0,
    G ? -1.4 : -1.9,
    0
  );
  shaft.rotation.z = G ? 0.35 : 0.55;

  // Curved blade with taped heel & toe
  add(stick, new THREE.BoxGeometry(G ? 1.45 : 1.2, G ? 0.36 : 0.29, 0.08), M.stick, G ? 0.92 : 1.62, G ? -3.05 : -3.55, 0);
  add(stick, new THREE.BoxGeometry(G ? 1.05 : 0.85, G ? 0.26 : 0.22, 0.09), M.tape, G ? 0.96 : 1.66, G ? -3.05 : -3.55, 0);

  if (G) {
    add(stick, new THREE.BoxGeometry(0.12, 1.35, 0.14), M.stick, 0.42, -2.25, 0).rotation.z = 0.35; // Goalie paddle
  }
  upper.add(stick);

  // Player Name & Number Overhead Tag
  const label = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthTest: false }));
  label.position.y = 7.7;
  label.renderOrder = 10;
  root.add(label);

  scene.add(root);

  return {
    root,
    pelvis,
    upper,
    head,
    thighL: legLParts.thigh,
    thighR: legRParts.thigh,
    shinL: legLParts.shin,
    shinR: legRParts.shin,
    skateL: legLParts.skate,
    skateR: legRParts.skate,
    armL: armLParts.arm,
    armR: armRParts.arm,
    forearmL: armLParts.forearm,
    forearmR: armRParts.forearm,
    stick,
    label,
    labelKey: "",
    phase: Math.random() * 6,
    prevHeading: 0,
    bankAngle: 0,
    goalie: G,
    side: a.side,
  };
}

/** Free a rig's per-player resources (shared kit materials stay cached). */
export function disposeRig(r: Rig) {
  r.root.traverse((o) => {
    const m = o as THREE.Mesh;
    m.geometry?.dispose();
    const mat = m.material as THREE.MeshBasicMaterial | undefined;
    if (mat && (mat.map || o === r.label)) {
      mat.map?.dispose();
      mat.dispose();
    }
  });
}

