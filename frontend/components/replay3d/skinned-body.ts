// Realistic skinned player body (a CC-BY Mixamo-rigged human, see BODY_CREDIT)
// driven by the existing primitive rig.
//
// The primitive rig in players.ts already does all the hockey biomechanics —
// skating stride, shooting, celebrating, the goalie butterfly. Instead of
// re-animating, the primitive rig becomes an invisible "driver": once, with both
// skeletons in the same pose, we record each bone's rotation offset against its
// driver joint; every frame each bone takes its driver's world rotation times that
// offset. On top of that the arms are solved with two-bone IK onto the stick (top
// hand on the knob, bottom hand down the shaft) and the skates are kept on the ice.
//
// The gear lives in the shaders of the model's own clothes, so it bends with the
// body: the shirt is inflated into a sweater with shoulder pads, sleeve and hem
// stripes, the club crest on the chest and name + number on the back; the trousers
// become breezers above the knee and striped socks over shin guards below it.
// Helmet + visor (cage for goalies), gloves and skates are meshes pinned to bones.
// If the model file isn't installed nothing changes — the primitive players stay.

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { Rig } from "./players";
import type { Actor } from "@/lib/replay3d/reconstruct";
import type { Kit } from "@/lib/replay3d/team-colors";

export const BODY_URL = "/models/andrew/scene.gltf";
export const BODY_CREDIT = "Player body based on “Andrew – LOD Man character” by Egunoff (sketchfab.com/egunoff), CC BY 4.0";

type Template = { scene: THREE.Object3D };
let pending: Promise<Template | null> | null = null;

/** Load the body once per page; null when the model isn't installed. */
export function loadBodyTemplate(): Promise<Template | null> {
  pending ??= fetch(BODY_URL, { method: "HEAD" })
    .then((r) => (r.ok ? new Promise<Template | null>((res) => new GLTFLoader().load(BODY_URL, (g) => res({ scene: g.scene }), undefined, () => res(null))) : null))
    .catch(() => null);
  return pending;
}

/** "mixamorig_LeftForeArm_011" → "leftforearm". */
const boneKey = (n: string) => n.toLowerCase().replace(/_\d+$/, "").replace(/^.*mixamorig[:_]?/, "").replace(/[^a-z0-9]/g, "");

type Pair = { bone: THREE.Bone; driver: THREE.Object3D; offset: THREE.Quaternion };
type Arm = { up: THREE.Bone; fore: THREE.Bone; hand: THREE.Bone; side: 1 | -1 };
export type Body = {
  wrap: THREE.Group; bones: Map<string, THREE.Bone>; pairs: Pair[];
  hips: THREE.Bone; hipsRest: THREE.Vector3; pelvisRest: THREE.Vector3; wrapY: number;
  arms: Arm[]; shaft: THREE.Mesh | null; shaftHalf: number; feet: THREE.Bone[]; goalie: boolean;
  crouch: number; bend: Array<[THREE.Bone, number]>; free: Array<[THREE.Bone, THREE.Quaternion]>;
  stick: THREE.Group | null; chest: THREE.Bone | null;
};

const STICK_LEN = 5.1;
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _v = new THREE.Vector3(), _v2 = new THREE.Vector3();

function worldPos(o: THREE.Object3D, local?: THREE.Vector3): THREE.Vector3 {
  o.updateWorldMatrix(true, false);
  return local ? o.localToWorld(local.clone()) : new THREE.Vector3().setFromMatrixPosition(o.matrixWorld);
}

/** Rotate `bone` (world) so the direction bone→`childWorld` points along `want`. */
function aim(bone: THREE.Bone, childWorld: THREE.Vector3, want: THREE.Vector3) {
  const from = worldPos(bone);
  const cur = childWorld.clone().sub(from);
  if (cur.lengthSq() < 1e-10 || want.lengthSq() < 1e-10) return;
  const delta = new THREE.Quaternion().setFromUnitVectors(cur.normalize(), want.clone().normalize());
  bone.getWorldQuaternion(_q);
  const world = delta.multiply(_q);
  bone.parent!.getWorldQuaternion(_q2);
  bone.quaternion.copy(_q2.invert().multiply(world));
  bone.updateWorldMatrix(false, true);
}

/** Two-bone IK: shoulder→elbow→hand reaching `target`, elbow bending towards `pole`. */
function solveArm(a: Arm, target: THREE.Vector3, pole: THREE.Vector3) {
  const S = worldPos(a.up), E = worldPos(a.fore), H = worldPos(a.hand);
  const la = S.distanceTo(E), lb = E.distanceTo(H);
  const toT = target.clone().sub(S);
  const d = Math.min(toT.length(), (la + lb) * 0.999);
  if (d < 1e-4) return;
  const u = toT.normalize();
  const cosA = Math.max(-1, Math.min(1, (la * la + d * d - lb * lb) / (2 * la * d)));
  const v = pole.clone().sub(S); v.addScaledVector(u, -v.dot(u));
  if (v.lengthSq() < 1e-8) v.set(0, -1, 0).addScaledVector(u, -u.y);
  v.normalize();
  const elbow = S.clone().addScaledVector(u, la * cosA).addScaledVector(v, la * Math.sqrt(1 - cosA * cosA));
  aim(a.up, E, elbow.clone().sub(S));
  aim(a.fore, worldPos(a.hand), S.clone().addScaledVector(u, d).sub(worldPos(a.fore)));
}

function mat(color: string, rough = 0.6, metal = 0) { return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal }); }

function canvasTex(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
  draw(cv.getContext("2d")!);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

/** Name over number, tackle-twill style (outlined in the trim colour). */
function backTexture(kit: Kit, a: Actor): THREE.CanvasTexture {
  return canvasTex(256, 256, (c) => {
    c.textAlign = "center"; c.textBaseline = "middle"; c.lineJoin = "round";
    const name = (a.name.includes(" ") ? a.name.split(" ").slice(1).join(" ") : a.name).replace(/\(.*?\)/g, "").trim().toUpperCase();
    const stroke = kit.trim !== kit.number ? kit.trim : "#000000";
    if (name) { c.font = `bold ${name.length > 9 ? 30 : 36}px Arial, sans-serif`; c.fillStyle = kit.number; c.fillText(name, 128, 32, 240); }
    if (a.number != null) {
      c.font = "900 160px Arial Black, Arial, sans-serif";
      c.lineWidth = 12; c.strokeStyle = stroke; c.strokeText(String(a.number), 128, 158);
      c.fillStyle = kit.number; c.fillText(String(a.number), 128, 158);
    }
  });
}

function crestTexture(logo: HTMLImageElement | null | undefined): THREE.Texture | null {
  if (!logo || !logo.complete || !logo.naturalWidth) return null;
  return canvasTex(256, 256, (c) => {
    const ar = logo.naturalWidth / logo.naturalHeight, w = ar >= 1 ? 236 : 236 * ar, h = ar >= 1 ? 236 / ar : 236;
    c.drawImage(logo, (256 - w) / 2, (256 - h) / 2, w, h);
  });
}

const EMPTY = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1); EMPTY.needsUpdate = true;

type KitColors = { jersey: THREE.Color; trim: THREE.Color; stripe: THREE.Color; pants: THREE.Color };
function kitColors(kit: Kit): KitColors {
  const k = kit as Kit & { stripe?: string };
  return { jersey: new THREE.Color(kit.jersey), trim: new THREE.Color(kit.trim), stripe: new THREE.Color(k.stripe ?? kit.number), pants: new THREE.Color(kit.pants) };
}

/** The shirt becomes a hockey sweater (all coordinates are the model's bind pose, cm, facing +z, arms out on ±x). */
function sweater(src: THREE.MeshStandardMaterial, kit: Kit, a: Actor, logo: HTMLImageElement | null | undefined): THREE.MeshStandardMaterial {
  const bulk = a.role === "G" ? 1.55 : 1.0; // a goalie's chest + arm protector under the sweater
  const m = src.clone();
  const c = kitColors(kit);
  const back = backTexture(kit, a), crest = crestTexture(logo);
  m.color.set("#ffffff"); m.roughness = 0.78; m.metalness = 0;
  // the crest can arrive later (logos load after the players are built)
  const uCrest = { value: (crest ?? EMPTY) as THREE.Texture }, uHasCrest = { value: crest ? 1 : 0 };
  m.userData.setCrest = (img: HTMLImageElement) => { const t = crestTexture(img); if (t) { uCrest.value = t; uHasCrest.value = 1; } };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, {
      uJersey: { value: c.jersey }, uTrim: { value: c.trim }, uStripe: { value: c.stripe },
      uBack: { value: back }, uCrest, uHasCrest, uBulk: { value: bulk },
    });
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vBind; varying vec3 vBindN; uniform float uBulk;")
      .replace("#include <begin_vertex>", `#include <begin_vertex>
        vBind = position; vBindN = normal; // bind-pose normal (objectNormal is already skinned here)
        // a loose sweater over shoulder pads: thicker over the shoulders and upper arms
        float ax = abs(position.x);
        float shoulders = smoothstep(140.0, 158.0, position.y) * (1.0 - smoothstep(30.0, 52.0, ax));
        float arms = smoothstep(20.0, 30.0, ax) * (1.0 - smoothstep(48.0, 62.0, ax));
        transformed += normal * (2.2 + 3.1 * shoulders + 1.1 * arms) * uBulk;`);
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vBind; varying vec3 vBindN;\nuniform vec3 uJersey; uniform vec3 uTrim; uniform vec3 uStripe; uniform sampler2D uBack; uniform sampler2D uCrest; uniform float uHasCrest;")
      .replace("#include <map_fragment>", `
        float ax = abs(vBind.x), y = vBind.y;
        bool sleeve = ax > 24.0;
        vec3 col = uJersey;
        // waist stripes (torso) and elbow stripes (sleeves), the classic three-band pattern
        float hem = sleeve ? -1.0 : y;
        if (hem > 112.0 && hem < 115.5) col = uTrim;
        if (hem > 115.5 && hem < 120.5) col = uStripe;
        if (hem > 120.5 && hem < 124.0) col = uTrim;
        if (sleeve && ax > 47.0 && ax < 50.0) col = uTrim;
        if (sleeve && ax > 50.0 && ax < 54.5) col = uStripe;
        if (sleeve && ax > 54.5 && ax < 57.5) col = uTrim;
        if (sleeve && ax > 65.0) col = uTrim;
        // collar
        if (!sleeve && y > 161.0 && ax < 9.0) col = uTrim;
        // crest on the chest, name + number on the back
        vec2 cuv = vec2((vBind.x + 16.0) / 32.0, (y - 122.0) / 32.0);
        if (uHasCrest > 0.5 && vBindN.z > 0.15 && !sleeve && cuv.x > 0.0 && cuv.x < 1.0 && cuv.y > 0.0 && cuv.y < 1.0) {
          vec4 t = texture2D(uCrest, cuv); col = mix(col, t.rgb, t.a);
        }
        vec2 buv = vec2((14.0 - vBind.x) / 28.0, (y - 122.0) / 34.0);
        if (vBindN.z < -0.15 && !sleeve && buv.x > 0.0 && buv.x < 1.0 && buv.y > 0.0 && buv.y < 1.0) {
          vec4 t = texture2D(uBack, buv); col = mix(col, t.rgb, t.a);
        }
        // the number again on the outside of each upper sleeve (upright when the arms hang down)
        if (sleeve && ax > 29.0 && ax < 42.0 && vBindN.y > 0.3) {
          float u = vBind.x < 0.0 ? (vBind.z + 6.5) / 13.0 : (6.5 - vBind.z) / 13.0;
          float v = (42.0 - ax) / 13.0;
          if (u > 0.0 && u < 1.0) { vec4 t = texture2D(uBack, vec2(0.18 + u * 0.64, 0.06 + v * 0.62)); col = mix(col, t.rgb, t.a); }
        }
        // keep a faint hint of the cloth folds from the original shirt texture
        float fold = 1.0;
        #ifdef USE_MAP
          vec3 src = texture2D(map, vMapUv).rgb;
          fold = mix(1.0, clamp(dot(src, vec3(0.333)) * 1.2, 0.7, 1.1), 0.18);
        #endif
        diffuseColor.rgb *= col * fold;`);
  };
  m.customProgramCacheKey = () => "unhl-sweater-v3";
  return m;
}

/** The trousers become breezers above the knee and striped socks below it. */
function breezersAndSocks(src: THREE.MeshStandardMaterial, kit: Kit): THREE.MeshStandardMaterial {
  const m = src.clone();
  const c = kitColors(kit);
  m.color.set("#ffffff"); m.roughness = 0.75;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, { uJersey: { value: c.jersey }, uTrim: { value: c.trim }, uStripe: { value: c.stripe }, uPants: { value: c.pants } });
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vBind;")
      .replace("#include <begin_vertex>", `#include <begin_vertex>
        vBind = position;
        // padded breezers round the hips and thighs, shin guards under the socks
        float thigh = smoothstep(52.0, 64.0, position.y);
        float hip = smoothstep(80.0, 98.0, position.y);
        transformed += normal * mix(1.5, 3.7 + 0.9 * hip, thigh);`);
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vBind;\nuniform vec3 uJersey; uniform vec3 uTrim; uniform vec3 uStripe; uniform vec3 uPants;")
      .replace("#include <map_fragment>", `
        float y = vBind.y;
        vec3 col = uPants;
        // a stripe down the outside of each leg of the breezers
        float outer = abs(vBind.x);
        if (y > 58.0 && y < 100.0 && outer > 15.5 && outer < 18.5 && vBind.z > -6.0 && vBind.z < 2.0) col = mix(uPants, uTrim, 0.9);
        if (y > 55.0 && y < 58.0) col = uPants * 0.6;          // pant cuff over the knee
        if (y <= 55.0) {
          col = uJersey;
          if (y > 30.0 && y < 33.0) col = uTrim;
          if (y > 33.0 && y < 37.0) col = uStripe;
          if (y > 37.0 && y < 40.0) col = uTrim;
        }
        diffuseColor.rgb *= col;`);
  };
  m.customProgramCacheKey = () => "unhl-breezers-v2";
  return m;
}

/** Build a realistic body for `rig` (the rig keeps animating; call syncBody every frame). */
export function attachBody(rig: Rig, tpl: Template, kit: Kit, a: Actor, logo?: HTMLImageElement | null): Body | null {
  const model = cloneSkinned(tpl.scene);
  const bones = new Map<string, THREE.Bone>();
  model.traverse((o) => { if ((o as THREE.Bone).isBone) { const k = boneKey(o.name); if (!bones.has(k)) bones.set(k, o as THREE.Bone); } });
  const B = (k: string) => bones.get(k) ?? null;
  const hips = B("hips"), lUp = B("leftupleg"), rUp = B("rightupleg"), lFoot = B("leftfoot"), rFoot = B("rightfoot"), head = B("head"), lArm = B("leftarm");
  if (!hips || !lUp || !rUp || !lFoot || !rFoot || !head || !lArm) return null;
  const r = rig as unknown as Record<string, THREE.Object3D>;
  const G = a.role === "G";

  // wrapper: model faces +x like the rig, shoulders at the rig's shoulder height, ankles on its skates
  const wrap = new THREE.Group();
  wrap.add(model);
  rig.root.add(wrap);
  rig.root.updateWorldMatrix(true, true);
  const inRoot = (o: THREE.Object3D) => rig.root.worldToLocal(worldPos(o));
  const left = inRoot(lUp).sub(inRoot(rUp)); left.y = 0;
  const facing = left.clone().cross(new THREE.Vector3(0, 1, 0)).normalize();
  wrap.rotation.y = Math.atan2(facing.z, facing.x); // turns `facing` onto +x
  rig.root.updateWorldMatrix(true, true);
  const shoulderY = inRoot(lArm).y, ankleY = inRoot(lFoot).y;
  const driverShoulder = rig.root.worldToLocal(worldPos(r.armL)).y;
  const s = (driverShoulder - 0.45) / Math.max(1e-6, shoulderY - ankleY);
  wrap.scale.setScalar(s);
  wrap.position.y = 0.45 - ankleY * s;
  rig.root.updateWorldMatrix(true, true);

  // the rig's joints (and points along them) the bones follow
  const along = (o: THREE.Object3D, x: number, y: number, z = 0) => worldPos(o, new THREE.Vector3(x, y, z));
  const map: Array<[string, string, () => THREE.Vector3, string]> = [
    // bone, its child bone (direction), where the driver's segment points, driver joint
    ["spine", "neck", () => worldPos(r.head), "upper"],
    ["head", "headtopend", () => along(r.head, 0, 1), "head"],
    ["leftarm", "leftforearm", () => worldPos(r.forearmL), "armL"],
    ["leftforearm", "lefthand", () => along(r.forearmL, 0, -0.72), "forearmL"],
    ["rightarm", "rightforearm", () => worldPos(r.forearmR), "armR"],
    ["rightforearm", "righthand", () => along(r.forearmR, 0, -0.72), "forearmR"],
    ["leftupleg", "leftleg", () => worldPos(r.shinL), "thighL"],
    ["leftleg", "leftfoot", () => worldPos(r.skateL), "shinL"],
    ["leftfoot", "lefttoebase", () => along(r.skateL, 1, 0), "skateL"],
    ["rightupleg", "rightleg", () => worldPos(r.shinR), "thighR"],
    ["rightleg", "rightfoot", () => worldPos(r.skateR), "shinR"],
    ["rightfoot", "righttoebase", () => along(r.skateR, 1, 0), "skateR"],
  ];
  // 1) bend the T-pose into the rig's current pose, segment by segment
  for (const [bk, ck, target, dj] of map) {
    const bone = B(bk), child = B(ck);
    if (!bone || !child || !r[dj]) continue;
    aim(bone, worldPos(child), target().sub(worldPos(r[dj])));
  }
  // 2) remember each bone's rotation relative to its driver joint
  const pairs: Pair[] = [];
  const addPair = (bk: string, dj: string) => {
    const bone = B(bk); const d = r[dj];
    if (!bone || !d) return;
    d.getWorldQuaternion(_q); bone.getWorldQuaternion(_q2);
    pairs.push({ bone, driver: d, offset: _q.clone().invert().multiply(_q2) });
  };
  addPair("hips", "pelvis");
  for (const [bk, , , dj] of map) addPair(bk, dj);

  // 3) gear on the bones (built in world space in this pose, then parented to keep it)
  const pin = (bone: THREE.Bone | null, m: THREE.Object3D) => { if (!bone) return; m.traverse((o) => { o.castShadow = true; }); m.updateMatrixWorld(true); bone.attach(m); };
  const helmetM = mat(kit.helmet, 0.2, 0.25), trimM = mat(kit.trim, 0.55), gloveM = mat(G ? "#f3f4f6" : kit.jersey, 0.6), darkM = mat("#111317", 0.4), steelM = mat("#e5e9ef", 0.1, 0.95), holderM = mat("#f8fafc", 0.35);
  const top = B("headtopend") ? worldPos(B("headtopend")!) : worldPos(head).add(new THREE.Vector3(0, 0.7, 0));
  const hp = worldPos(head), hs = top.distanceTo(hp);
  {
    // helmet: a shell over the crown and back of the head, ear guards, visor (or a goalie cage)
    const g = new THREE.Group();
    const shell = new THREE.Mesh(new THREE.SphereGeometry(hs * 0.6, 28, 18, 0, Math.PI * 2, 0, Math.PI * 0.55), helmetM);
    shell.scale.set(1.12, 0.95, 1.0); g.add(shell);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(hs * 0.62, hs * 0.045, 8, 32), helmetM); rim.rotation.x = Math.PI / 2; rim.scale.set(1.1, 1, 1); rim.position.y = -hs * 0.06; g.add(rim);
    for (const z of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(hs * 0.2, 12, 10), helmetM); ear.scale.set(1, 1.15, 0.55); ear.position.set(-hs * 0.08, -hs * 0.32, z * hs * 0.62); g.add(ear);
    }
    if (G) {
      const cage = new THREE.Mesh(new THREE.SphereGeometry(hs * 0.66, 14, 10, -Math.PI * 0.42, Math.PI * 0.84, Math.PI * 0.35, Math.PI * 0.45), new THREE.MeshStandardMaterial({ color: "#e5e7eb", wireframe: true, metalness: 0.8, roughness: 0.3 }));
      cage.rotation.y = Math.PI / 2; cage.position.set(hs * 0.12, -hs * 0.2, 0); g.add(cage);
      const mask = new THREE.Mesh(new THREE.SphereGeometry(hs * 0.7, 20, 14, Math.PI * 0.55, Math.PI * 0.9, 0, Math.PI * 0.8), helmetM); mask.rotation.y = Math.PI / 2; g.add(mask);
    } else {
      const visor = new THREE.Mesh(new THREE.SphereGeometry(hs * 0.7, 24, 8, -Math.PI * 0.3, Math.PI * 0.6, Math.PI * 0.47, Math.PI * 0.14), new THREE.MeshPhysicalMaterial({ color: "#c9dcf0", roughness: 0.02, metalness: 0.2, transparent: true, opacity: 0.38, side: THREE.DoubleSide }));
      visor.rotation.y = Math.PI / 2; visor.scale.set(1, 1, 1.1); g.add(visor);
    }
    if (!G) {
      // chin strap from ear guard to ear guard
      const strap = new THREE.Mesh(new THREE.TorusGeometry(hs * 0.5, hs * 0.018, 6, 24, Math.PI), mat("#16181c", 0.6));
      strap.rotation.set(0, Math.PI / 2, Math.PI); strap.scale.set(1, 1.2, 1); strap.position.set(hs * 0.05, -hs * 0.36, 0); g.add(strap);
    }
    g.position.copy(hp.clone().lerp(top, 0.62)).add(new THREE.Vector3(-hs * 0.06, 0, 0));
    pin(head, g);
  }
  const glove = (side: "left" | "right") => {
    const fa = B(`${side}forearm`), h = B(`${side}hand`), mid = B(`${side}handmiddle1`);
    if (!fa || !h) return;
    const p0 = worldPos(fa), p1 = worldPos(h), p2 = mid ? worldPos(mid) : p1.clone().add(p1.clone().sub(p0).setLength(0.3));
    const dir = p2.clone().sub(p1).normalize();
    const g = new THREE.Group();
    const len = 0.62;
    // padded hockey glove: a rounded mitt, two trim bands across the back-roll, a flared cuff, a dark palm
    const mitt = new THREE.Mesh(new THREE.CapsuleGeometry(0.19, len - 0.28, 6, 12), gloveM); mitt.scale.set(1.2, 1, 0.92); g.add(mitt);
    for (const yy of [0.04, 0.16]) { const band = new THREE.Mesh(new THREE.CylinderGeometry(0.235, 0.235, 0.05, 14, 1, true), trimM); band.scale.set(1.18, 1, 0.94); band.position.y = yy; g.add(band); }
    const palm = new THREE.Mesh(new THREE.BoxGeometry(0.06, len * 0.55, 0.26), mat("#4a3c30", 0.85)); palm.position.set(0, 0.06, 0); palm.position.x = -0.2; g.add(palm);
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.22, 0.34, 16), trimM); cuff.position.y = -len * 0.56; g.add(cuff);
    g.position.copy(p1.clone().addScaledVector(dir, 0.18));
    g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    pin(h, g);
  };
  if (!G) { glove("left"); glove("right"); }
  else {
    const padM = mat("#f4f4f2", 0.5), accentM = mat(kit.trim === "#f4f4f4" ? kit.jersey : kit.trim, 0.5);
    rig.root.updateWorldMatrix(true, false);
    const fwdW = new THREE.Vector3(1, 0, 0).transformDirection(rig.root.matrixWorld);
    for (const sd of ["left", "right"] as const) {
      // leg pads: knee to toe over the front of the shin, three coloured rolls
      const kn = B(`${sd}leg`), ft = B(`${sd}foot`);
      if (!kn || !ft) continue;
      const pK = worldPos(kn).add(new THREE.Vector3(0, 0.25, 0)), pA = worldPos(ft).add(new THREE.Vector3(0, -0.35, 0));
      const dir = pA.clone().sub(pK), len = dir.length();
      const pad = new THREE.Group();
      const block = new THREE.Mesh(new THREE.BoxGeometry(0.62, len, 0.95), padM); pad.add(block);
      for (const k of [-0.32, 0, 0.32]) { const roll = new THREE.Mesh(new THREE.BoxGeometry(0.64, len * 0.08, 0.97), accentM); roll.position.y = k * len; pad.add(roll); }
      const knee = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.42, 0.8), accentM); knee.position.y = len * 0.5 + 0.1; pad.add(knee);
      pad.position.copy(pK).lerp(pA, 0.5).addScaledVector(fwdW, 0.28);
      pad.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.negate().normalize());
      pin(kn, pad);
    }
    // blocker on the stick hand, the trapper on the other
    const rh = B("righthand"), lh = B("lefthand");
    if (rh) {
      const g = new THREE.Group();
      const board = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.1, 0.72), padM); board.position.set(0, 0.05, 0.32); g.add(board);
      const edge = new THREE.Mesh(new THREE.BoxGeometry(0.17, 1.12, 0.12), accentM); edge.position.set(0, 0.05, 0.66); g.add(edge);
      const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.24, 0.5, 12), padM); cuff.position.y = -0.25; g.add(cuff);
      g.position.copy(worldPos(rh)); pin(rh, g);
    }
    if (lh) {
      const g = new THREE.Group();
      const mitt = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.58, 0.32, 20), padM); mitt.rotation.x = Math.PI / 2; g.add(mitt);
      const pocket = new THREE.Mesh(new THREE.SphereGeometry(0.42, 14, 10, 0, Math.PI), accentM); pocket.position.z = -0.12; pocket.rotation.y = Math.PI; g.add(pocket);
      const cuff = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.65, 0.55), accentM); cuff.position.y = -0.55; g.add(cuff);
      g.position.copy(worldPos(lh)).add(new THREE.Vector3(0.1, 0.15, -0.15)); pin(lh, g);
    }
  }
  for (const side of ["left", "right"] as const) {
    const ft = B(`${side}foot`), toe = B(`${side}toebase`);
    if (!ft) continue;
    const pA = worldPos(ft), pT = toe ? worldPos(toe) : pA.clone().add(new THREE.Vector3(0.8, 0, 0));
    const fwd = pT.clone().sub(pA); fwd.y = 0; fwd.normalize();
    const sk = new THREE.Group();
    const boot = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.62, 4, 10), darkM); boot.rotation.z = Math.PI / 2; boot.scale.set(1.15, 1, 1.1); boot.position.set(0.22, -0.2, 0); sk.add(boot);
    const ankle = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.5, 12), darkM); ankle.position.set(-0.05, 0.02, 0); sk.add(ankle);
    const tongue = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.34, 0.24), mat("#e5e7eb", 0.6)); tongue.position.set(0.14, 0.18, 0); sk.add(tongue);
    const holder = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.16, 0.08), holderM); holder.position.set(0.22, -0.46, 0); sk.add(holder);
    const blade = new THREE.Mesh(new THREE.BoxGeometry(1.14, 0.09, 0.04), steelM); blade.position.set(0.22, -0.58, 0); sk.add(blade);
    const toeCap = new THREE.Mesh(new THREE.SphereGeometry(0.21, 12, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat("#1d2026", 0.25, 0.3)); toeCap.rotation.z = -Math.PI / 2; toeCap.scale.set(1, 1.25, 1.05); toeCap.position.set(0.62, -0.22, 0); sk.add(toeCap);
    const tendon = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.32, 0.18), darkM); tendon.position.set(-0.3, 0.32, 0); tendon.rotation.z = 0.25; sk.add(tendon);
    sk.position.copy(pA); sk.rotation.y = -Math.atan2(fwd.z, fwd.x);
    pin(ft, sk);
  }

  // 4) the model's own clothes become the kit; no shoes or hair (skates + helmet go there)
  model.traverse((o) => {
    const m = o as THREE.SkinnedMesh;
    if (!m.isMesh) return;
    m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false;
    const name = `${m.name} ${(m.material as THREE.Material)?.name ?? ""}`.toLowerCase();
    if (/shoe|hair|eyelash/.test(name)) { m.visible = false; return; }
    const src = m.material as THREE.MeshStandardMaterial;
    if (/top/.test(name)) m.material = sweater(src, kit, a, logo);
    else if (/bottom/.test(name)) m.material = breezersAndSocks(src, kit);
    else { const sk = src.clone(); sk.roughness = 0.62; m.material = sk; }
  });

  // the primitive figure is now only the driver: hide its meshes (a goalie keeps the rig's stick) + keep the label
  const keep = new Set<THREE.Object3D>();
  keep.add(rig.label);
  rig.root.traverse((o) => { if ((o as THREE.Mesh).isMesh && !keep.has(o) && !isInside(o, wrap)) o.visible = false; });

  // the stick's shaft (longest box in the stick group) is what the hands grip
  let shaft: THREE.Mesh | null = null, shaftHalf = 0;
  rig.stick.traverse((o) => {
    const m = o as THREE.Mesh;
    const p = (m.geometry as THREE.BoxGeometry | undefined)?.parameters as { height?: number } | undefined;
    if (m.isMesh && p?.height && p.height > shaftHalf * 2) { shaft = m; shaftHalf = p.height / 2; }
  });
  const arm = (side: "left" | "right", sg: 1 | -1): Arm | null => {
    const up = B(`${side}arm`), fore = B(`${side}forearm`), hand = B(`${side}hand`);
    return up && fore && hand ? { up, fore, hand, side: sg } : null;
  };
  const arms = [arm("left", -1), arm("right", 1)].filter((x): x is Arm => !!x);

  // extra crouch (radians about the player's right axis; negative = forward for the trunk)
  const bend: Array<[THREE.Bone, number]> = [];
  const add = (k: string, ang: number) => { const bn = B(k); if (bn) bend.push([bn, ang]); };
  add("spine", -0.32); add("spine1", -0.08); add("neck", 0.22);
  for (const sd of ["left", "right"]) { add(`${sd}upleg`, 0.42); add(`${sd}leg`, -0.78); add(`${sd}foot`, 0.36); }
  // a skater's own stick: knob in the top hand, blade where the rig's blade is (shots, dekes, celebrations)
  let stick: THREE.Group | null = null;
  if (G) {
    stick = new THREE.Group();
    const stickM = mat("#1b1f26", 0.35, 0.25), tapeM = mat("#f1f5f9", 0.9);
    const sh = new THREE.Mesh(new THREE.BoxGeometry(0.085, 2.6, 0.12), stickM); sh.position.y = -1.3; stick.add(sh);
    const paddle = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.5, 0.3), stickM); paddle.position.y = -3.3; stick.add(paddle);
    const blade = new THREE.Group(); blade.position.y = -4.05; blade.name = "blade"; stick.add(blade);
    const bl = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.34, 0.07), stickM); bl.position.set(0.55, 0.12, 0); blade.add(bl);
    const tape = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.3, 0.08), tapeM); tape.position.set(0.6, 0.12, 0); blade.add(tape);
    stick.traverse((o) => { o.castShadow = true; });
    rig.root.add(stick);
  } else {
    stick = new THREE.Group();
    const stickM = mat("#1b1f26", 0.35, 0.25), tapeM = mat("#f1f5f9", 0.9);
    const sh = new THREE.Mesh(new THREE.BoxGeometry(0.085, STICK_LEN, 0.12), stickM); sh.position.y = -STICK_LEN / 2; stick.add(sh);
    const knob = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.28, 0.14), tapeM); knob.position.y = -0.1; stick.add(knob);
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.3, 0.125), trimM); band.position.y = -1.6; stick.add(band);
    const blade = new THREE.Group(); blade.position.y = -STICK_LEN; blade.name = "blade"; stick.add(blade);
    const bl = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.24, 0.06), stickM); bl.position.set(0.4, 0.05, 0); blade.add(bl);
    const tape = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.2, 0.07), tapeM); tape.position.set(0.45, 0.05, 0); blade.add(tape);
    stick.traverse((o) => { o.castShadow = true; });
    rig.root.add(stick);
  }
  // bones the rig doesn't drive return to their pose every frame before the crouch is added
  const driven = new Set(pairs.map((p) => p.bone));
  const free: Array<[THREE.Bone, THREE.Quaternion]> = bend.filter(([bn]) => !driven.has(bn)).map(([bn]) => [bn, bn.quaternion.clone()]);
  return { free, stick, chest: B("spine1"), wrap, bones, pairs, hips, hipsRest: hips.position.clone(), pelvisRest: rig.pelvis.position.clone(), wrapY: wrap.position.y, arms, shaft, shaftHalf, feet: [lFoot, rFoot], goalie: G, crouch: G ? 0 : 1, bend };
}

/** Put a club crest on a body's sweater once its logo has loaded. */
export function setBodyCrest(b: Body, img: HTMLImageElement) {
  b.wrap.traverse((o) => { const m = (o as THREE.Mesh).material as THREE.Material | undefined; (m?.userData?.setCrest as ((i: HTMLImageElement) => void) | undefined)?.(img); });
}

/** Rotate a bone by `angle` about a world axis (keeps its children attached). */
function bendWorld(bone: THREE.Bone, axis: THREE.Vector3, angle: number) {
  _q.setFromAxisAngle(axis, angle);
  bone.getWorldQuaternion(_q2);
  _q.multiply(_q2);
  bone.parent!.getWorldQuaternion(_q2);
  bone.quaternion.copy(_q2.invert().multiply(_q));
  bone.updateMatrixWorld(true);
}

function isInside(o: THREE.Object3D, root: THREE.Object3D): boolean {
  for (let p: THREE.Object3D | null = o; p; p = p.parent) if (p === root) return true;
  return false;
}

/** Copy the rig's current pose onto the body (call after the rig has been posed). */
export function syncBody(rig: Rig, b: Body, pose = 0) {
  const butterfly = b.goalie && pose === 3;
  rig.root.updateMatrixWorld(true);
  // hips ride with the pelvis (crouch, hop, weight shift)
  _v.copy(rig.pelvis.position).sub(b.pelvisRest);
  const parent = b.hips.parent!;
  _v2.copy(b.hipsRest);
  parent.localToWorld(_v2);
  rig.root.worldToLocal(_v2).add(_v);
  rig.root.localToWorld(_v2);
  parent.worldToLocal(_v2);
  b.hips.position.copy(_v2);
  for (const p of b.pairs) {
    p.driver.getWorldQuaternion(_q);
    _q.multiply(p.offset);
    p.bone.parent!.getWorldQuaternion(_q2);
    p.bone.quaternion.copy(_q2.invert().multiply(_q));
    p.bone.updateMatrixWorld(true);
  }
  // the hockey crouch on top of the rig's pose: chest over the knees, knees bent, blades flat
  for (const [bn, q] of b.free) { bn.quaternion.copy(q); bn.updateMatrixWorld(true); }
  if (b.crouch > 0) {
    rig.root.updateWorldMatrix(true, false);
    _v.set(0, 0, 1).transformDirection(rig.root.matrixWorld); // the player's right = the bending axis
    const k = b.crouch;
    for (const [bone, ang] of b.bend) bendWorld(bone, _v, ang * k);
  }
  // goalies: the butterfly (knees down in front, pads flat out to the posts) or the wide ready stance
  if (b.goalie) {
    rig.root.updateWorldMatrix(true, false);
    const dirW = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z).transformDirection(rig.root.matrixWorld);
    for (const [sd, sg] of [["left", -1], ["right", 1]] as const) {
      const up = b.bones.get(`${sd}upleg`), kn = b.bones.get(`${sd}leg`), ft = b.bones.get(`${sd}foot`), toe = b.bones.get(`${sd}toebase`);
      if (!up || !kn || !ft) continue;
      if (butterfly) {
        aim(up, worldPos(kn), dirW(0.42, -0.9, sg * 0.1));
        aim(kn, worldPos(ft), dirW(-0.3, -0.05, sg * 0.95));
        if (toe) aim(ft, worldPos(toe), dirW(-0.75, 0.0, sg * 0.66));
      } else {
        aim(up, worldPos(kn), dirW(0.5, -0.78, sg * 0.38));
        aim(kn, worldPos(ft), dirW(-0.28, -0.95, sg * 0.1));
        if (toe) aim(ft, worldPos(toe), dirW(0.95, -0.05, sg * 0.3));
      }
    }
    const spine = b.bones.get("spine");
    if (spine && !butterfly) bendWorld(spine, dirW(0, 0, 1), -0.32);
  }
  // skates on the ice: the model's ankles sit where the rig's ankles are (knees on the ice in the butterfly)
  const r = rig as unknown as Record<string, THREE.Object3D>;
  const yIn = (o: THREE.Object3D) => rig.root.worldToLocal(worldPos(o)).y;
  if (butterfly) {
    const kl = b.bones.get("leftleg"), kr = b.bones.get("rightleg");
    if (kl && kr) b.wrap.position.y += 0.42 - (yIn(kl) + yIn(kr)) / 2;
  } else {
    b.wrap.position.y += (yIn(r.skateL) + yIn(r.skateR)) / 2 - (yIn(b.feet[0]) + yIn(b.feet[1])) / 2;
  }
  b.wrap.updateMatrixWorld(true);
  // a goalie's stick hangs from the blocker hand, paddle down in front of the pads
  if (b.goalie && b.stick) {
    const rh = b.bones.get("righthand");
    if (rh) {
      rig.root.updateWorldMatrix(true, false);
      const top = worldPos(rh);
      const foot = rig.root.localToWorld(new THREE.Vector3(butterfly ? 2.0 : 1.7, 0.1, butterfly ? 0.0 : 0.25));
      const axis = foot.sub(top).normalize();
      const parent = b.stick.parent!;
      b.stick.position.copy(parent.worldToLocal(top.clone()));
      parent.getWorldQuaternion(_q2);
      _q.setFromUnitVectors(new THREE.Vector3(0, -1, 0), axis);
      b.stick.quaternion.copy(_q2.invert().multiply(_q));
      const blade = b.stick.getObjectByName("blade");
      if (blade) {
        b.stick.updateWorldMatrix(true, false);
        const flat = new THREE.Vector3(0, 0, -1).transformDirection(rig.root.matrixWorld); flat.addScaledVector(axis, -flat.dot(axis)).normalize();
        blade.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), flat.transformDirection(b.stick.matrixWorld.clone().invert()).normalize());
      }
    }
    return;
  }
  // a skater's stick: top hand in front of the belly, the blade where the rig's blade is
  if (b.stick && b.chest && b.shaft && b.arms.length === 2 && !b.goalie) {
    rig.root.updateWorldMatrix(true, false);
    const fwd = new THREE.Vector3(1, 0, 0).transformDirection(rig.root.matrixWorld);
    const right = new THREE.Vector3(0, 0, 1).transformDirection(rig.root.matrixWorld);
    const knob = worldPos(b.chest).addScaledVector(fwd, 0.75).addScaledVector(right, -0.15).add(new THREE.Vector3(0, -0.55, 0));
    b.shaft.updateWorldMatrix(true, false);
    const bladeAt = b.shaft.localToWorld(new THREE.Vector3(0, -b.shaftHalf, 0));
    bladeAt.y = Math.max(0.12, bladeAt.y);
    // skating / carrying: the blade stays out in front on the ice (only a shot winds it back, a celebration lifts it)
    if (pose === 0) {
      const ahead = bladeAt.clone().sub(knob).dot(fwd);
      if (ahead < 2.2) bladeAt.addScaledVector(fwd, 2.2 - ahead);
      bladeAt.y = Math.min(bladeAt.y, rig.root.localToWorld(new THREE.Vector3(0, 0.12, 0)).y);
    }
    const axis = bladeAt.clone().sub(knob).normalize();
    // never through the ice: if the full-length stick would dig in, lay it flatter so the blade sits on it
    const iceY = rig.root.localToWorld(new THREE.Vector3(0, 0.12, 0)).y;
    const drop = knob.y - iceY;
    if (-axis.y * STICK_LEN > drop && drop > 0) {
      const h = new THREE.Vector3(axis.x, 0, axis.z); if (h.lengthSq() < 1e-6) h.copy(fwd); h.normalize();
      const vy = -drop / STICK_LEN;
      axis.copy(h.multiplyScalar(Math.sqrt(Math.max(0, 1 - vy * vy)))).setY(vy);
    }
    // place the stick group: its -y runs from the knob down to the blade
    const parent = b.stick.parent!;
    const p = parent.worldToLocal(knob.clone());
    b.stick.position.copy(p);
    parent.getWorldQuaternion(_q2);
    _q.setFromUnitVectors(new THREE.Vector3(0, -1, 0), axis);
    b.stick.quaternion.copy(_q2.invert().multiply(_q));
    // the blade lies along the player's forward direction, flat on the ice
    const blade = b.stick.getObjectByName("blade");
    if (blade) {
      b.stick.updateWorldMatrix(true, false);
      const flat = fwd.clone(); flat.addScaledVector(axis, -flat.dot(axis)).normalize();
      const local = flat.clone().transformDirection(b.stick.matrixWorld.clone().invert());
      blade.rotation.set(0, 0, 0); blade.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), local.normalize());
    }
    const top = knob.clone().addScaledVector(axis, 0.22), low = knob.clone().addScaledVector(axis, 1.85);
    for (const a of b.arms) {
      const pole = worldPos(a.up).addScaledVector(right, a.side * 1.4).addScaledVector(fwd, -0.4).add(new THREE.Vector3(0, -1.2, 0));
      solveArm(a, a.side < 0 ? top : low, pole);
    }
  } else if (b.shaft && b.arms.length === 2) {
    const sh = b.shaft;
    sh.updateWorldMatrix(true, false);
    const topGrip = sh.localToWorld(_v.set(0, b.shaftHalf * 0.9, 0)).clone();
    const lowGrip = sh.localToWorld(_v.set(0, b.shaftHalf * 0.2, 0)).clone();
    for (const a of b.arms) {
      if (b.goalie && a.side < 0) continue;
      const target = b.goalie ? lowGrip : a.side < 0 ? topGrip : lowGrip;
      // elbows out to the side and a little down/back
      const pole = rig.root.localToWorld(rig.root.worldToLocal(worldPos(a.up)).add(new THREE.Vector3(-0.6, -1.2, a.side * 1.4)));
      solveArm(a, target, pole);
    }
  }
}
