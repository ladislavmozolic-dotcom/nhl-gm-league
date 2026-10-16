// Articulated skater and goalie models (EA Sports NHL console style):
// Hierarchical skeleton (hips, knees, ankles, shoulders, elbows, stick, neck),
// authentic textured jerseys with team chest crest logos, stitched nameplates,
// 2-color tackle-twill numbers, sleeve numbers & stripes, helmet decals with visors,
// detailed composite skates, 4-roll anatomical gloves, and custom goalie pads.

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
  // Dynamic updates
  setLogo: (img: HTMLImageElement) => void;
};

const lastName = (n: string) =>
  (n.includes(" ") ? n.split(" ").slice(1).join(" ") : n).replace(/\(.*?\)/g, "").trim().toUpperCase();

function createJerseyFrontTexture(
  kit: Kit,
  a: Actor,
  logoImg?: HTMLImageElement | null
): THREE.CanvasTexture {
  const W = 512,
    H = 512;
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const c = cv.getContext("2d")!;

  // 1. Base sweater body
  c.fillStyle = kit.jersey;
  c.fillRect(0, 0, W, H);

  // Subtle athletic jersey mesh fabric weave
  c.fillStyle = "rgba(0,0,0,0.04)";
  for (let y = 0; y < H; y += 4) {
    c.fillRect(0, y, W, 2);
  }

  // 2. Shoulder Yoke
  if (kit.shoulderYoke && kit.shoulderYoke !== kit.jersey) {
    c.fillStyle = kit.shoulderYoke;
    c.beginPath();
    c.moveTo(0, 0);
    c.lineTo(W, 0);
    c.lineTo(W, 110);
    c.quadraticCurveTo(W / 2, 140, 0, 110);
    c.closePath();
    c.fill();
  }

  // 3. V-Neck Collar & Lace-up hockey tie-down
  c.fillStyle = kit.trim;
  c.beginPath();
  c.moveTo(W / 2 - 80, 0);
  c.lineTo(W / 2 + 80, 0);
  c.lineTo(W / 2 + 45, 75);
  c.lineTo(W / 2, 110);
  c.lineTo(W / 2 - 45, 75);
  c.closePath();
  c.fill();

  // White collar laces
  c.strokeStyle = "#ffffff";
  c.lineWidth = 4;
  c.beginPath();
  c.moveTo(W / 2 - 18, 55);
  c.lineTo(W / 2 + 18, 55);
  c.moveTo(W / 2 - 14, 72);
  c.lineTo(W / 2 + 14, 72);
  c.moveTo(W / 2 - 10, 88);
  c.lineTo(W / 2 + 10, 88);
  c.stroke();

  // NHL shield apex tab
  c.fillStyle = "#111111";
  c.beginPath();
  c.moveTo(W / 2 - 16, 25);
  c.lineTo(W / 2 + 16, 25);
  c.lineTo(W / 2 + 12, 45);
  c.lineTo(W / 2, 55);
  c.lineTo(W / 2 - 12, 45);
  c.closePath();
  c.fill();
  c.fillStyle = "#e2e8f0";
  c.font = "bold 14px Arial, sans-serif";
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillText("★", W / 2, 38);

  // 4. Waist Striping at the bottom hem
  const hemY = H - 110;
  // Top stripe
  c.fillStyle = kit.trim;
  c.fillRect(0, hemY, W, 22);
  // Center stripe
  c.fillStyle = kit.stripe;
  c.fillRect(0, hemY + 26, W, 28);
  // Bottom stripe
  c.fillStyle = kit.trim;
  c.fillRect(0, hemY + 58, W, 22);
  // Dark bottom hem
  c.fillStyle = "rgba(0,0,0,0.2)";
  c.fillRect(0, H - 24, W, 24);

  // 5. Team Chest Crest (Logo)
  const logoBoxSize = 240;
  const logoX = (W - logoBoxSize) / 2;
  const logoY = 155;

  if (logoImg && logoImg.complete && logoImg.naturalWidth) {
    const ar = logoImg.naturalWidth / logoImg.naturalHeight;
    let dw = logoBoxSize;
    let dh = logoBoxSize;
    if (ar > 1) {
      dh = logoBoxSize / ar;
    } else {
      dw = logoBoxSize * ar;
    }
    const dx = (W - dw) / 2;
    const dy = logoY + (logoBoxSize - dh) / 2;

    // Drop shadow under embroidered crest
    c.save();
    c.shadowColor = "rgba(0,0,0,0.55)";
    c.shadowBlur = 12;
    c.shadowOffsetY = 6;
    c.drawImage(logoImg, dx, dy, dw, dh);
    c.restore();
  } else {
    // Stylized chest crest fallback
    c.save();
    c.beginPath();
    c.arc(W / 2, logoY + logoBoxSize / 2, logoBoxSize * 0.44, 0, Math.PI * 2);
    c.fillStyle = kit.trim;
    c.fill();
    c.lineWidth = 6;
    c.strokeStyle = kit.stripe;
    c.stroke();

    c.fillStyle = kit.number;
    c.font = "bold 64px Arial Black, Arial, sans-serif";
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText(a.role === "G" ? "G" : "NHL", W / 2, logoY + logoBoxSize / 2);
    c.restore();
  }

  // 6. Captain "C" or Assistant "A" on left upper chest
  if (a.number === 97 || a.number === 87 || a.number === 77 || a.number === 11 || a.number === 19) {
    c.save();
    c.fillStyle = kit.number;
    c.strokeStyle = kit.numberBorder;
    c.lineWidth = 4;
    c.font = "bold 44px Arial Black, Arial, sans-serif";
    c.textAlign = "center";
    c.textBaseline = "middle";
    const badgeText = a.number === 97 || a.number === 87 || a.number === 11 ? "C" : "A";
    c.strokeText(badgeText, W - 90, 160);
    c.fillText(badgeText, W - 90, 160);
    c.restore();
  }

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function createJerseyBackTexture(kit: Kit, a: Actor): THREE.CanvasTexture {
  const W = 512,
    H = 512;
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const c = cv.getContext("2d")!;

  // 1. Base sweater body
  c.fillStyle = kit.jersey;
  c.fillRect(0, 0, W, H);

  // Subtle athletic jersey mesh fabric weave
  c.fillStyle = "rgba(0,0,0,0.04)";
  for (let y = 0; y < H; y += 4) {
    c.fillRect(0, y, W, 2);
  }

  // 2. Shoulder yoke on back
  if (kit.shoulderYoke && kit.shoulderYoke !== kit.jersey) {
    c.fillStyle = kit.shoulderYoke;
    c.beginPath();
    c.moveTo(0, 0);
    c.lineTo(W, 0);
    c.lineTo(W, 90);
    c.lineTo(0, 90);
    c.closePath();
    c.fill();
  }

  // 3. Waist Striping at the bottom hem
  const hemY = H - 110;
  c.fillStyle = kit.trim;
  c.fillRect(0, hemY, W, 22);
  c.fillStyle = kit.stripe;
  c.fillRect(0, hemY + 26, W, 28);
  c.fillStyle = kit.trim;
  c.fillRect(0, hemY + 58, W, 22);
  c.fillStyle = "rgba(0,0,0,0.2)";
  c.fillRect(0, H - 24, W, 24);

  // 4. Stitched Nameplate Bar & Arched Player Name
  const nm = lastName(a.name);
  if (nm) {
    const nameY = 72;
    // Nameplate fabric bar
    c.fillStyle = kit.jersey;
    c.fillRect(30, nameY - 32, W - 60, 60);

    // Stitched edge lines
    c.strokeStyle = "rgba(255,255,255,0.25)";
    c.setLineDash([4, 4]);
    c.strokeRect(34, nameY - 28, W - 68, 52);
    c.setLineDash([]);

    // Lettering
    c.save();
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.font = `bold ${nm.length > 10 ? 32 : nm.length > 7 ? 40 : 48}px Arial, sans-serif`;

    // Drop shadow / outline
    c.strokeStyle = kit.numberBorder;
    c.lineWidth = 6;
    c.strokeText(nm, W / 2, nameY);
    c.fillStyle = kit.number;
    c.fillText(nm, W / 2, nameY);
    c.restore();
  }

  // 5. Large Pro Tackle-Twill Number
  if (a.number != null) {
    const numY = 275;
    const numStr = String(a.number);

    c.save();
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.font = "bold 210px Arial Black, Arial, sans-serif";

    // 2-Color stitched pro effect (thick outline + drop shadow + main number)
    c.shadowColor = "rgba(0,0,0,0.45)";
    c.shadowBlur = 10;
    c.shadowOffsetY = 6;

    // Outer border
    c.strokeStyle = kit.numberBorder;
    c.lineWidth = 26;
    c.lineJoin = "round";
    c.strokeText(numStr, W / 2, numY);

    // Inner number
    c.shadowColor = "transparent";
    c.fillStyle = kit.number;
    c.fillText(numStr, W / 2, numY);
    c.restore();
  }

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function createSleeveTexture(kit: Kit, a: Actor, isLeft: boolean): THREE.CanvasTexture {
  const W = 256,
    H = 256;
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const c = cv.getContext("2d")!;

  c.fillStyle = kit.jersey;
  c.fillRect(0, 0, W, H);

  // Sleeve Number on bicep
  if (a.number != null) {
    c.save();
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.font = "bold 96px Arial Black, Arial, sans-serif";
    c.strokeStyle = kit.numberBorder;
    c.lineWidth = 14;
    c.strokeText(String(a.number), W / 2, 70);
    c.fillStyle = kit.number;
    c.fillText(String(a.number), W / 2, 70);
    c.restore();
  }

  // Elbow Striping
  const sY = 160;
  c.fillStyle = kit.trim;
  c.fillRect(0, sY, W, 18);
  c.fillStyle = kit.stripe;
  c.fillRect(0, sY + 22, W, 22);
  c.fillStyle = kit.trim;
  c.fillRect(0, sY + 48, W, 18);

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createHelmetTexture(kit: Kit, logoImg?: HTMLImageElement | null): THREE.CanvasTexture {
  const W = 256,
    H = 256;
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const c = cv.getContext("2d")!;

  c.fillStyle = kit.helmet;
  c.fillRect(0, 0, W, H);

  // Air ventilation slots
  c.fillStyle = "#111111";
  for (let i = 0; i < 4; i++) {
    c.beginPath();
    c.roundRect(40 + i * 48, 30, 24, 70, 10);
    c.fill();
  }

  // Team logo decals on sides
  if (logoImg && logoImg.complete && logoImg.naturalWidth) {
    c.drawImage(logoImg, 35, 140, 70, 70);
    c.drawImage(logoImg, 150, 140, 70, 70);
  }

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createGoaliePadTexture(kit: Kit): THREE.CanvasTexture {
  const W = 256,
    H = 512;
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const c = cv.getContext("2d")!;

  // Modern pro goalie pad graphics: crisp white leather face with bold dynamic color wedges
  c.fillStyle = "#f8fafc";
  c.fillRect(0, 0, W, H);

  // Primary color wedge
  c.fillStyle = kit.jersey;
  c.beginPath();
  c.moveTo(0, 120);
  c.lineTo(W * 0.85, 220);
  c.lineTo(W * 0.75, 270);
  c.lineTo(0, 220);
  c.closePath();
  c.fill();

  // Secondary color slash
  c.fillStyle = kit.trim;
  c.beginPath();
  c.moveTo(0, 240);
  c.lineTo(W * 0.95, 340);
  c.lineTo(W * 0.85, 380);
  c.lineTo(0, 320);
  c.closePath();
  c.fill();

  // Outer roll accent
  c.fillStyle = kit.stripe;
  c.fillRect(W - 24, 0, 24, H);

  // Knee block & boot channel lines
  c.strokeStyle = "rgba(0,0,0,0.15)";
  c.lineWidth = 3;
  c.beginPath();
  c.moveTo(0, 160);
  c.lineTo(W, 160);
  c.moveTo(0, 380);
  c.lineTo(W, 380);
  c.stroke();

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function makeRig(
  scene: THREE.Scene,
  a: Actor,
  kit: Kit,
  teamLogo?: HTMLImageElement | null
): Rig {
  const G = a.role === "G";
  const root = new THREE.Group();
  const cast = <T extends THREE.Mesh>(m: T) => {
    m.castShadow = true;
    m.receiveShadow = true;
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

  // Base materials
  const matPants = new THREE.MeshStandardMaterial({ color: kit.pants, roughness: 0.7 });
  const matDark = new THREE.MeshStandardMaterial({ color: "#14161a", roughness: 0.45 });
  const matTuuk = new THREE.MeshStandardMaterial({ color: "#f8fafc", roughness: 0.35 });
  const matSteel = new THREE.MeshStandardMaterial({ color: "#e2e8f0", roughness: 0.1, metalness: 0.95 });
  const matVisor = new THREE.MeshPhysicalMaterial({
    color: "#a5c5e8",
    roughness: 0.04,
    metalness: 0.05,
    transparent: true,
    opacity: 0.5,
    reflectivity: 0.95,
  });
  const matSkin = new THREE.MeshStandardMaterial({ color: "#d5a582", roughness: 0.8 });
  const matGlovePalm = new THREE.MeshStandardMaterial({ color: "#473b32", roughness: 0.85 });
  const matStick = new THREE.MeshStandardMaterial({ color: "#1e2229", roughness: 0.35, metalness: 0.25 });
  const matTape = new THREE.MeshStandardMaterial({ color: "#f1f5f9", roughness: 0.92 });
  const matTrim = new THREE.MeshStandardMaterial({ color: kit.trim, roughness: 0.6 });
  const matJerseySolid = new THREE.MeshStandardMaterial({ color: kit.jersey, roughness: 0.65 });

  // Custom textures
  let frontTex = createJerseyFrontTexture(kit, a, teamLogo);
  const backTex = createJerseyBackTexture(kit, a);
  const sleeveLTex = createSleeveTexture(kit, a, true);
  const sleeveRTex = createSleeveTexture(kit, a, false);
  const helmetTex = createHelmetTexture(kit, teamLogo);
  const padTex = G ? createGoaliePadTexture(kit) : null;

  const matJerseyFront = new THREE.MeshStandardMaterial({ map: frontTex, roughness: 0.65 });
  const matJerseyBack = new THREE.MeshStandardMaterial({ map: backTex, roughness: 0.65 });
  const matSleeveL = new THREE.MeshStandardMaterial({ map: sleeveLTex, roughness: 0.65 });
  const matSleeveR = new THREE.MeshStandardMaterial({ map: sleeveRTex, roughness: 0.65 });
  const matHelmet = new THREE.MeshStandardMaterial({ map: helmetTex, roughness: 0.22, metalness: 0.15 });
  const matGoaliePad = padTex ? new THREE.MeshStandardMaterial({ map: padTex, roughness: 0.45 }) : null;

  // Pelvis root (controls hockey crouch, weight shift & turn banking)
  const pelvis = new THREE.Group();
  pelvis.position.y = 0;
  root.add(pelvis);

  // --- LEGS (Hierarchical Articulation: Thigh -> Shin -> Skate) ---
  const mkLeg = (z: number, isLeft: boolean) => {
    // 1. Thigh (Hip Joint)
    const thigh = new THREE.Group();
    thigh.position.set(0, 3.05, z);

    // Breezers / Hockey pants (tapered thigh padding with kidney protector & side stripe)
    add(thigh, new THREE.CylinderGeometry(G ? 0.52 : 0.46, G ? 0.44 : 0.36, 1.15, 14), matPants, 0, -0.55, 0);
    // Vertical side stripe on pants
    add(thigh, new THREE.BoxGeometry(0.12, 1.05, 0.08), matTrim, 0, -0.55, isLeft ? -0.42 : 0.42);

    // 2. Shin (Knee Joint) - attached under thigh
    const shin = new THREE.Group();
    shin.position.set(0, -1.15, 0);
    thigh.add(shin);

    if (G && matGoaliePad) {
      // Modern goalie butterfly pad (outer roll, knee cradle, square top profile)
      add(shin, new THREE.BoxGeometry(0.72, 2.3, 0.88), matGoaliePad, 0.18, -0.75, 0);
      add(shin, new THREE.CylinderGeometry(0.12, 0.12, 2.2, 8), matTrim, -0.15, -0.75, isLeft ? -0.44 : 0.44); // outer roll
    } else {
      // Knee cap shell
      add(shin, new THREE.SphereGeometry(0.3, 10, 8), matDark, 0.06, 0.02, 0);
      // Hockey sock / Shin guard with authentic 3-stripe pattern
      add(shin, new THREE.CapsuleGeometry(0.26, 1.05, 4, 12), matJerseySolid, 0, -0.65, 0);
      // Sock stripes matching jersey
      add(shin, new THREE.CylinderGeometry(0.272, 0.272, 0.12, 12, 1, true), matTrim, 0, -0.42, 0);
      add(
        shin,
        new THREE.CylinderGeometry(0.274, 0.274, 0.14, 12, 1, true),
        new THREE.MeshStandardMaterial({ color: kit.stripe, roughness: 0.6 }),
        0,
        -0.56,
        0
      );
      add(shin, new THREE.CylinderGeometry(0.272, 0.272, 0.12, 12, 1, true), matTrim, 0, -0.7, 0);
    }

    // 3. Skate (Ankle Joint) - attached under shin
    const skate = new THREE.Group();
    skate.position.set(0.06, -1.45, 0);
    shin.add(skate);

    // Molded black composite hockey skate boot
    add(skate, new THREE.BoxGeometry(1.12, 0.36, 0.34), matDark, 0.08, 0.18, 0);
    // Curved heel cup
    add(skate, new THREE.BoxGeometry(0.36, 0.38, 0.3), matDark, -0.32, 0.4, 0);
    // Tendon guard sweeping up behind Achilles tendon
    add(skate, new THREE.BoxGeometry(0.12, 0.42, 0.2), matDark, -0.44, 0.56, 0);
    // White skate tongue with criss-crossed white laces
    add(skate, new THREE.BoxGeometry(0.52, 0.14, 0.22), matTuuk, 0.18, 0.38, 0);
    // White Tuuk Lightspeed Edge blade holder with trigger dial
    add(skate, new THREE.BoxGeometry(1.24, 0.22, 0.09), matTuuk, 0.08, -0.06, 0);
    add(skate, new THREE.CylinderGeometry(0.04, 0.04, 0.1, 8), matDark, -0.42, -0.06, 0.05);
    // Polished stainless steel runner blade
    add(skate, new THREE.BoxGeometry(1.32, 0.08, 0.03), matSteel, 0.08, -0.18, 0);

    return { thigh, shin, skate };
  };

  const legLParts = mkLeg(-0.43, true);
  const legRParts = mkLeg(0.43, false);
  pelvis.add(legLParts.thigh, legRParts.thigh);

  // --- UPPER BODY (Sculpted Contoured Torso, Shoulders, Arms, Head) ---
  const upper = new THREE.Group();
  upper.position.set(0, 3.05, 0);
  pelvis.add(upper);

  const chest = G ? 1.05 : 0.84;

  // Front 3D Curved Chest & Abdomen Shell (Seamless contour wrapping around ribs)
  const frontGeo = new THREE.CylinderGeometry(
    chest * 0.94,
    chest * 0.82,
    1.55,
    24,
    1,
    false,
    -Math.PI / 2,
    Math.PI
  );
  const frontMesh = cast(new THREE.Mesh(frontGeo, matJerseyFront));
  frontMesh.position.set(0, 0.95, 0);
  frontMesh.scale.set(0.82, 1.0, 1.18);
  upper.add(frontMesh);

  // Back 3D Curved Spine & Rib Shell (Seamless contour wrapping around flanks)
  const backGeo = new THREE.CylinderGeometry(
    chest * 0.94,
    chest * 0.82,
    1.55,
    24,
    1,
    false,
    Math.PI / 2,
    Math.PI
  );
  const backMesh = cast(new THREE.Mesh(backGeo, matJerseyBack));
  backMesh.position.set(0, 0.95, 0);
  backMesh.scale.set(0.82, 1.0, 1.18);
  upper.add(backMesh);

  // Broad sculpted shoulder caps (Deltoid pads giving broad athletic V-taper)
  for (const z of [-1, 1]) {
    const sc = add(
      upper,
      new THREE.SphereGeometry(G ? 0.58 : 0.5, 16, 12),
      matJerseySolid,
      0,
      1.68,
      z * (G ? 0.82 : 0.72),
      0.92,
      0.82,
      1.16
    );
    add(sc, new THREE.TorusGeometry(0.46, 0.04, 8, 16), matTrim, 0, 0, 0);
  }

  // 3D Padded hockey collar rim at the neck
  add(upper, new THREE.TorusGeometry(0.3, 0.05, 8, 20), matTrim, 0, 1.76, 0).rotation.x = Math.PI / 2;

  // --- HEAD & HELMET ---
  const head = new THREE.Group();
  head.position.set(0, 2.05, 0);
  upper.add(head);

  add(head, new THREE.CylinderGeometry(0.22, 0.25, 0.32, 12), matDark, 0, 0, 0); // Neck guard / base

  if (G) {
    // Modern painted goalie mask with wire cat-eye cage
    add(head, new THREE.SphereGeometry(0.52, 18, 14), matHelmet, 0, 0.46, 0, 1.04, 1.12, 0.94);
    add(head, new THREE.BoxGeometry(0.35, 0.28, 0.32), matHelmet, 0.22, 0.2, 0);
    const wireCageMat = new THREE.MeshStandardMaterial({ color: "#e2e8f0", roughness: 0.15, metalness: 0.95, wireframe: true });
    add(head, new THREE.SphereGeometry(0.44, 14, 12, -Math.PI / 2, Math.PI), wireCageMat, 0.18, 0.38, 0, 0.92, 1.02, 1);
  } else {
    // Sleek Pro NHL molded helmet shell with brow peak, ear protectors, and wrap-around visor
    add(head, new THREE.SphereGeometry(0.48, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.68), matHelmet, 0, 0.44, 0, 1.1, 1.02, 0.96);
    add(head, new THREE.BoxGeometry(0.2, 0.06, 0.56), matHelmet, 0.38, 0.46, 0); // Brow peak
    for (const ez of [-1, 1]) {
      add(head, new THREE.CylinderGeometry(0.12, 0.12, 0.08, 12), matDark, 0.02, 0.28, ez * 0.48); // Ear well
      add(head, new THREE.CylinderGeometry(0.04, 0.04, 0.06, 8), matSteel, 0.06, 0.38, ez * 0.49).rotation.x = Math.PI / 2; // Chrome bracket
    }
    // Curved wrap-around half-visor
    const visorGeo = new THREE.CylinderGeometry(0.49, 0.49, 0.24, 24, 1, true, -Math.PI / 2.3, Math.PI / 1.15);
    const visorMesh = cast(new THREE.Mesh(visorGeo, matVisor));
    visorMesh.position.set(0, 0.36, 0);
    visorMesh.scale.set(1.08, 1, 0.98);
    head.add(visorMesh);

    // Sculpted athletic face with nose bridge
    add(head, new THREE.SphereGeometry(0.36, 16, 12), matSkin, 0.12, 0.24, 0, 1.15, 1.0, 0.92);
    const nose = add(head, new THREE.ConeGeometry(0.05, 0.14, 6), matSkin, 0.46, 0.26, 0);
    nose.rotation.z = -Math.PI / 2;

    // Chin strap with chin cup
    add(head, new THREE.BoxGeometry(0.14, 0.1, 0.22), matDark, 0.12, 0.04, 0);
  }

  // --- ARMS (Hierarchical Articulation: Shoulder -> Elbow -> Glove) ---
  const mkArm = (z: number, isLeft: boolean) => {
    // 1. Shoulder / Upper Arm with sleeve number & striping
    const arm = new THREE.Group();
    arm.position.set(0, 1.74, z);

    const sleeveMat = isLeft ? matSleeveL : matSleeveR;
    add(arm, new THREE.CapsuleGeometry(G ? 0.31 : 0.25, 0.72, 4, 10), sleeveMat, 0, -0.42, 0);

    // 2. Forearm & Glove (Elbow Joint) - attached under arm
    const forearm = new THREE.Group();
    forearm.position.set(0, -0.76, 0);
    arm.add(forearm);

    // Elbow pad
    add(forearm, new THREE.SphereGeometry(0.22, 8, 6), matDark, -0.06, 0, 0);
    // Forearm sleeve
    add(forearm, new THREE.CapsuleGeometry(G ? 0.28 : 0.23, 0.65, 4, 10), matJerseySolid, 0, -0.38, 0);
    add(forearm, new THREE.CylinderGeometry(G ? 0.29 : 0.24, G ? 0.29 : 0.24, 0.08, 10, 1, true), matTrim, 0, -0.52, 0);

    // 4-Roll Hockey Glove with anatomical rolls, team trim, and leather palm
    const glove = add(forearm, new THREE.BoxGeometry(0.44, 0.38, 0.38), G ? (matGoaliePad ?? matTrim) : matTrim, 0, -0.72, 0);
    add(forearm, new THREE.CylinderGeometry(0.3, 0.26, 0.18, 12, 1, true), matTrim, 0, -0.58, 0); // Flared cuff
    add(glove, new THREE.BoxGeometry(0.28, 0.14, 0.34), matDark, 0.15, -0.22, 0); // Padded finger rolls
    add(glove, new THREE.BoxGeometry(0.24, 0.12, 0.32), matDark, 0.2, -0.32, 0);
    add(glove, new THREE.BoxGeometry(0.26, 0.24, 0.2), matGlovePalm, 0.08, -0.05, 0); // Palm grip

    return { arm, forearm };
  };

  const armLParts = mkArm(-(G ? 1.08 : 0.96), true);
  const armRParts = mkArm(G ? 1.08 : 0.96, false);
  upper.add(armLParts.arm, armRParts.arm);

  if (G) {
    // Goalie Blocker (Right Hand)
    add(armRParts.forearm, new THREE.BoxGeometry(0.18, 1.1, 0.82), matGoaliePad ?? matTrim, 0.12, -0.88, 0.25);
    add(armRParts.forearm, new THREE.BoxGeometry(0.2, 0.35, 0.84), matTrim, 0.13, -0.55, 0.25);
    // Goalie Catcher / Trapper (Left Hand)
    const catcher = add(armLParts.forearm, new THREE.CylinderGeometry(0.58, 0.58, 0.25, 18), matTrim, 0.15, -0.88, -0.2);
    catcher.rotation.z = Math.PI / 2;
    add(armLParts.forearm, new THREE.BoxGeometry(0.28, 0.52, 1.0), matGoaliePad ?? matTrim, 0.15, -1.15, -0.2); // catching pocket
  }

  // --- HOCKEY STICK (Held by hands in front of body) ---
  const stick = new THREE.Group();
  stick.position.set(0.92, 0.65, 0.45);

  const shaft = add(
    stick,
    new THREE.BoxGeometry(0.08, G ? 3.6 : 4.6, 0.12),
    matStick,
    0,
    G ? -1.4 : -1.9,
    0
  );
  shaft.rotation.z = G ? 0.35 : 0.55;

  // Curved blade with taped heel & toe
  add(stick, new THREE.BoxGeometry(G ? 1.45 : 1.2, G ? 0.36 : 0.29, 0.08), matStick, G ? 0.92 : 1.62, G ? -3.05 : -3.55, 0);
  add(stick, new THREE.BoxGeometry(G ? 1.05 : 0.85, G ? 0.26 : 0.22, 0.09), matTape, G ? 0.96 : 1.66, G ? -3.05 : -3.55, 0);

  if (G) {
    add(stick, new THREE.BoxGeometry(0.12, 1.35, 0.14), matStick, 0.42, -2.25, 0).rotation.z = 0.35;
  }
  upper.add(stick);

  // Player Name & Number Overhead Tag
  const label = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthTest: false }));
  label.position.y = 7.7;
  label.renderOrder = 10;
  root.add(label);

  scene.add(root);

  // Function to dynamically update the chest logo when the image finishes loading
  const setLogo = (img: HTMLImageElement) => {
    const newTex = createJerseyFrontTexture(kit, a, img);
    matJerseyFront.map?.dispose();
    matJerseyFront.map = newTex;
    matJerseyFront.needsUpdate = true;

    const newHelTex = createHelmetTexture(kit, img);
    matHelmet.map?.dispose();
    matHelmet.map = newHelTex;
    matHelmet.needsUpdate = true;
  };

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
    setLogo,
  };
}

/** Free a rig's per-player resources */
export function disposeRig(r: Rig) {
  r.root.traverse((o) => {
    const m = o as THREE.Mesh;
    m.geometry?.dispose();
    const mat = m.material as THREE.MeshStandardMaterial | undefined;
    if (mat) {
      mat.map?.dispose();
      mat.dispose();
    }
  });
}

