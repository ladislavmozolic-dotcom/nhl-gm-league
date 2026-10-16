"use client";

// Plays one reconstructed clip in the 3D arena: transport controls, scrubbing,
// slow motion, camera angles and an automatic "TV director" that cuts to the end
// camera for the shot and slows the goal down. Loaded lazily (three.js is heavy).

import { useCallback, useEffect, useRef, useState } from "react";
import { RinkScene, type CameraMode } from "./RinkScene";
import { playSfx } from "./sfx";
import { clipAt, type Clip } from "@/lib/replay3d/reconstruct";
import type { Kit } from "@/lib/replay3d/team-colors";

export type ReplayHud = {
  away: { code: string; score: number }; home: { code: string; score: number };
  clock: string; title: string; subtitle?: string; tag?: string;
};

type Cam = CameraMode | "auto";
const CAMS: Array<[Cam, string]> = [["auto", "🎬 Réžia"], ["broadcast", "📺 TV"], ["end", "🥅 Za bránkou"], ["goalcam", "📷 V bránke"], ["follow", "🏃 Sledovať"], ["top", "🗺️ Zhora"], ["free", "🖐️ Voľná"]];
const SPEEDS = [0.25, 0.5, 1] as const;

function readPref<T extends string>(key: string, fallback: T): T {
  try { return (localStorage.getItem(key) as T) ?? fallback; } catch { return fallback; }
}

export default function Replay3DPlayer({ clip, homeKit, awayKit, homeLogoUrl, focusId, hud, onEnded, occupancy, homeName }: {
  clip: Clip; homeKit: Kit; awayKit: Kit; homeLogoUrl?: string | null; focusId?: string | null; hud: ReplayHud; onEnded?: () => void;
  occupancy?: number | null; homeName?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<RinkScene | null>(null);
  const tRef = useRef(0);
  const playingRef = useRef(true);
  const speedRef = useRef(1);
  const camRef = useRef<Cam>("auto");
  const soundRef = useRef(true);
  const replayNo = useRef(0);
  const endedRef = useRef(false);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState<number>(1);
  // client-only component (loaded with ssr: false), so storage is safe to read up front
  const [cam, setCam] = useState<Cam>(() => readPref<Cam>("replay3d_cam", "auto"));
  const [labels, setLabels] = useState(() => readPref<string>("replay3d_labels", "on") !== "off");
  const [sound, setSound] = useState(() => readPref<string>("replay3d_sound", "on") !== "off");
  const [ended, setEnded] = useState(false);
  const [webgl] = useState(() => { try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch { return false; } });
  useEffect(() => { camRef.current = cam; try { localStorage.setItem("replay3d_cam", cam); } catch {} }, [cam]);
  useEffect(() => { soundRef.current = sound; try { localStorage.setItem("replay3d_sound", sound ? "on" : "off"); } catch {} }, [sound]);
  useEffect(() => { sceneRef.current?.setLabels(labels); try { localStorage.setItem("replay3d_labels", labels ? "on" : "off"); } catch {} }, [labels]);
  useEffect(() => { speedRef.current = speed; }, [speed]);
  useEffect(() => { playingRef.current = playing; }, [playing]);

  // the arena lives as long as the kits do
  useEffect(() => {
    const canvas = canvasRef.current, box = boxRef.current;
    if (!canvas || !box) return;
    let scene: RinkScene;
    try { scene = new RinkScene(canvas, { homeKit, awayKit, homeLogoUrl, occupancy, homeCode: hud.home.code, awayCode: hud.away.code, homeName }); } catch { return; }
    sceneRef.current = scene;
    const ro = new ResizeObserver(() => scene.resize(box.clientWidth, box.clientHeight));
    ro.observe(box); scene.resize(box.clientWidth, box.clientHeight);
    return () => { ro.disconnect(); scene.dispose(); sceneRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [homeKit, awayKit, homeLogoUrl, occupancy]);

  // a new clip: cast, labels, start from the top
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    scene.setActors(clip.actors);
    scene.setFocus(focusId ?? null);
    scene.setLabels(labels);
    scene.setScoreboard([`${hud.away.code} ${hud.away.score} – ${hud.home.score} ${hud.home.code}`, hud.tag ?? "REPLAY"]);
    tRef.current = 0; endedRef.current = false; replayNo.current = 0;
    setT(0); setPlaying(true); setEnded(false);
    scene.setFrame(clipAt(clip, 0), 0);
    scene.setCamera(camRef.current === "auto" ? "broadcast" : camRef.current, clip.attackDir);
    scene.snapCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clip, homeKit, awayKit]);

  // the auto director: wide for the build-up, end camera for the shot, then the scorer
  const directed = useCallback((time: number): CameraMode => {
    const shot = clip.shotT ?? clip.duration;
    const hit = clip.goalT ?? shot + 0.3;
    const variant = replayNo.current % 3;
    if (time < shot - 0.9) return variant === 2 ? "follow" : "broadcast";
    if (time < hit + 1.3) return variant === 1 ? "goalcam" : "end";
    return "follow";
  }, [clip]);

  useEffect(() => {
    let raf = 0, last = performance.now(), uiAt = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const scene = sceneRef.current;
      if (!scene) return;
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const prev = tRef.current;
      if (playingRef.current) {
        const shot = clip.shotT ?? 0, hit = clip.goalT ?? shot;
        const slow = camRef.current === "auto" && prev > shot - 0.6 && prev < hit + 0.5 ? 0.35 : 1;
        tRef.current = Math.min(clip.duration, prev + dt * speedRef.current * slow);
        if (soundRef.current) for (const c of clip.cues) if (c.t > prev && c.t <= tRef.current) {
          if (c.kind === "goal") { playSfx("horn"); playSfx("crowd"); }
          else if (c.kind === "shot") playSfx("shot");
          else if (c.kind === "pass") playSfx("pass");
          else if (c.kind === "post") playSfx("post");
          else if (c.kind === "save") playSfx("save");
          else if (c.kind === "whistle") playSfx("whistle");
        }
        if (clip.goalT != null && prev < clip.goalT && tRef.current >= clip.goalT) { scene.flashGoalLight(clip.attackDir); scene.cheer(clip.attackSide, 1, 7); }
        else if (clip.shotT != null && prev < clip.shotT && tRef.current >= clip.shotT) scene.cheer(clip.attackSide, 0.3, 1.4);
        if (tRef.current >= clip.duration && !endedRef.current) { endedRef.current = true; playingRef.current = false; setPlaying(false); setEnded(true); onEnded?.(); }
      }
      if (camRef.current === "auto") scene.setCamera(directed(tRef.current), clip.attackDir);
      else scene.setCamera(camRef.current, clip.attackDir);
      scene.setFrame(clipAt(clip, tRef.current), playingRef.current ? dt * speedRef.current : 0);
      scene.render(dt);
      if (now - uiAt > 100) { uiAt = now; setT(tRef.current); }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [clip, directed, onEnded]);

  const restart = () => { replayNo.current++; tRef.current = 0; endedRef.current = false; setEnded(false); setT(0); setPlaying(true); playingRef.current = true; sceneRef.current?.snapCamera(); };
  const toggle = () => { if (endedRef.current) restart(); else setPlaying((p) => !p); };
  const scrub = (v: number) => { tRef.current = v; endedRef.current = v >= clip.duration; setEnded(endedRef.current); setT(v); setPlaying(false); };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === "Space") { e.preventDefault(); toggle(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const goalShown = clip.goalT != null && t >= clip.goalT;

  return (
    <div className="w-full">
      <div ref={boxRef} className="relative w-full aspect-video bg-[#070b12] rounded-xl overflow-hidden border border-slate-800 select-none">
        <canvas ref={canvasRef} className={`w-full h-full block ${cam === "free" ? "cursor-grab active:cursor-grabbing" : ""}`} />
        {!webgl && <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-400 p-6 text-center">Tento prehliadač nepodporuje WebGL, 3D pohľad sa nedá zobraziť.</div>}
        {/* scorebug */}
        <div className="absolute top-2 left-2 sm:top-3 sm:left-3 flex items-stretch text-[11px] sm:text-sm font-black rounded-md overflow-hidden shadow-lg pointer-events-none">
          <span className="px-2 py-1 text-white" style={{ background: awayKit.trim }}>{hud.away.code}</span>
          <span className="px-2 py-1 bg-slate-950/90 text-white tabular-nums">{hud.away.score}</span>
          <span className="px-2 py-1 text-white" style={{ background: homeKit.jersey }}>{hud.home.code}</span>
          <span className="px-2 py-1 bg-slate-950/90 text-white tabular-nums">{hud.home.score}</span>
          <span className="px-2 py-1 bg-slate-800/95 text-slate-200 font-mono font-bold">{hud.clock}</span>
        </div>
        <div className="absolute top-2 right-2 sm:top-3 sm:right-3 px-2 py-0.5 rounded bg-red-600 text-white text-[10px] sm:text-xs font-black tracking-widest pointer-events-none">{hud.tag ?? "REPLAY"}</div>
        {/* goal caption */}
        <div className={`absolute left-2 right-2 bottom-2 sm:left-4 sm:bottom-4 sm:right-auto transition-all duration-500 pointer-events-none ${goalShown ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"}`}>
          <div className="inline-block bg-slate-950/85 border-l-4 rounded-r-md px-3 py-1.5 shadow-xl" style={{ borderColor: "#facc15" }}>
            <p className="text-sm sm:text-lg font-black text-white leading-tight">🚨 {hud.title}</p>
            {hud.subtitle && <p className="text-[11px] sm:text-xs text-slate-300">{hud.subtitle}</p>}
          </div>
        </div>
      </div>

      {/* transport */}
      <div className="mt-2 flex items-center gap-2">
        <button onClick={toggle} className="w-9 h-9 shrink-0 rounded-full bg-sky-600 hover:bg-sky-500 text-white font-black flex items-center justify-center" aria-label={playing ? "Pauza" : "Prehrať"}>
          {ended && !playing ? "↻" : playing ? "❚❚" : "▶"}
        </button>
        <input type="range" min={0} max={clip.duration} step={0.01} value={t} onChange={(e) => scrub(Number(e.target.value))} className="flex-1 accent-sky-500 min-w-0" aria-label="Posun v zázname" />
        <span className="text-[11px] font-mono text-slate-400 w-16 text-right tabular-nums">{t.toFixed(1)} / {clip.duration.toFixed(1)}s</span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {CAMS.map(([id, label]) => (
          <button key={id} onClick={() => setCam(id)} className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition ${cam === id ? "bg-sky-600 border-sky-500 text-white" : "bg-slate-800 border-slate-700 text-slate-300 hover:text-white"}`}>{label}</button>
        ))}
        <span className="mx-1 h-5 w-px bg-slate-700" />
        {SPEEDS.map((s) => (
          <button key={s} onClick={() => setSpeed(s)} className={`px-2 py-1 rounded-lg text-[11px] font-bold border ${speed === s ? "bg-amber-500 border-amber-400 text-slate-950" : "bg-slate-800 border-slate-700 text-slate-300"}`}>{s === 1 ? "1×" : `${s}×`}</button>
        ))}
        <span className="mx-1 h-5 w-px bg-slate-700" />
        <button onClick={() => setLabels((v) => !v)} className={`px-2 py-1 rounded-lg text-[11px] font-bold border ${labels ? "bg-slate-700 border-slate-600 text-white" : "bg-slate-800 border-slate-700 text-slate-500"}`}>🏷️ Mená</button>
        <button onClick={() => setSound((v) => !v)} className={`px-2 py-1 rounded-lg text-[11px] font-bold border ${sound ? "bg-slate-700 border-slate-600 text-white" : "bg-slate-800 border-slate-700 text-slate-500"}`}>{sound ? "🔊" : "🔇"}</button>
      </div>
      {cam === "free" && <p className="mt-1 text-[11px] text-slate-500">Ťahaj myšou pre otáčanie, koliesko = zoom, pravé tlačidlo = posun.</p>}
    </div>
  );
}
