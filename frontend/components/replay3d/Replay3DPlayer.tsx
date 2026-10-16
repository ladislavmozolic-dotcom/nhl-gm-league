"use client";

// Authentic NHL TV Broadcast 3D replay: multi-angle director sequence,
// ESPN/TNT lower-third graphic with NHL Edge telemetry (shot speed, distance, xG),
// camera stinger wipes, realistic audio, and interactive camera switching.

import { useCallback, useEffect, useRef, useState } from "react";
import { RinkScene, type CameraMode } from "./RinkScene";
import { playSfx } from "./sfx";
import { clipAt, type Clip } from "@/lib/replay3d/reconstruct";
import type { Kit } from "@/lib/replay3d/team-colors";
import type { GoalTelemetry } from "@/lib/replay3d/goal-replay";

export type ReplayHud = {
  away: { code: string; score: number };
  home: { code: string; score: number };
  clock: string;
  title: string;
  subtitle?: string;
  tag?: string;
  telemetry?: GoalTelemetry | null;
  scorer?: {
    name: string;
    number?: number | null;
    seasonGoals?: number | null;
    teamCode: string;
    teamColor: string;
  };
  assists?: Array<{ name: string; number?: number | null }>;
  strength?: string;
  emptyNet?: boolean;
  scoringSide?: "home" | "away";
};

type Cam = CameraMode | "auto";
const CAMS: Array<[Cam, string, string]> = [
  ["auto", "🎬 TV Réžia", "Automatický broadcast zostrih viacerých uhlov"],
  ["broadcast", "📺 Hlavná TV", "Klasická televízna broadcast kamera"],
  ["reverse", "🔄 Za bránkou", "Detailný reverzný pohľad na zakončenie"],
  ["goalcam", "📷 V bránke", "Kamera zvnútra bránky cez bránkovú čiaru"],
  ["ice", "⛸️ Pri mantinely", "Dynamická nízka kamera pri ľade"],
  ["follow", "🏃 Strelec", "Izolované sledovanie zakončujúceho hráča"],
  ["top", "🗺️ Zhora", "Taktický pohľad na celé útočné pásmo"],
  ["free", "🖐️ Voľná", "Voľné otáčanie a zoomovanie myšou"],
];

const SPEEDS = [0.25, 0.5, 1] as const;

function readPref<T extends string>(key: string, fallback: T): T {
  try {
    return (localStorage.getItem(key) as T) ?? fallback;
  } catch {
    return fallback;
  }
}

export default function Replay3DPlayer({
  clip,
  homeKit,
  awayKit,
  homeLogoUrl,
  focusId,
  hud,
  onEnded,
  occupancy,
  homeName,
}: {
  clip: Clip;
  homeKit: Kit;
  awayKit: Kit;
  homeLogoUrl?: string | null;
  focusId?: string | null;
  hud: ReplayHud;
  onEnded?: () => void;
  occupancy?: number | null;
  homeName?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<RinkScene | null>(null);
  const tRef = useRef(0);
  const playingRef = useRef(true);
  const speedRef = useRef(1);
  const camRef = useRef<Cam>("auto");
  const soundRef = useRef(true);
  const tvAngleRef = useRef<number>(0); // 0 = Broadcast live speed, 1 = Reverse/Net super-slowmo, 2 = Celebration
  const endedRef = useRef(false);

  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState<number>(1);
  const [cam, setCam] = useState<Cam>(() => readPref<Cam>("replay3d_cam", "auto"));
  const [labels, setLabels] = useState(() => readPref<string>("replay3d_labels", "on") !== "off");
  const [sound, setSound] = useState(() => readPref<string>("replay3d_sound", "on") !== "off");
  const [ended, setEnded] = useState(false);
  const [stinger, setStinger] = useState(false);
  const [tvAngle, setTvAngle] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [speedUnit, setSpeedUnit] = useState<"mph" | "kmh">("mph");
  const [webgl] = useState(() => {
    try {
      const c = document.createElement("canvas");
      return !!(c.getContext("webgl2") || c.getContext("webgl"));
    } catch {
      return false;
    }
  });

  useEffect(() => {
    camRef.current = cam;
    try {
      localStorage.setItem("replay3d_cam", cam);
    } catch {}
  }, [cam]);

  useEffect(() => {
    soundRef.current = sound;
    try {
      localStorage.setItem("replay3d_sound", sound ? "on" : "off");
    } catch {}
  }, [sound]);

  useEffect(() => {
    sceneRef.current?.setLabels(labels);
    try {
      localStorage.setItem("replay3d_labels", labels ? "on" : "off");
    } catch {}
  }, [labels]);

  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);

  // Fullscreen tracking
  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  const toggleFullscreen = () => {
    if (!boxRef.current) return;
    if (!document.fullscreenElement) {
      void boxRef.current.requestFullscreen();
    } else {
      void document.exitFullscreen();
    }
  };

  // Scene lifecycle
  useEffect(() => {
    const canvas = canvasRef.current,
      box = boxRef.current;
    if (!canvas || !box) return;
    let scene: RinkScene;
    try {
      scene = new RinkScene(canvas, {
        homeKit,
        awayKit,
        homeLogoUrl,
        occupancy,
        homeCode: hud.home.code,
        awayCode: hud.away.code,
        homeName,
      });
    } catch {
      return;
    }
    sceneRef.current = scene;
    const ro = new ResizeObserver(() => scene.resize(box.clientWidth, box.clientHeight));
    ro.observe(box);
    scene.resize(box.clientWidth, box.clientHeight);
    return () => {
      ro.disconnect();
      scene.dispose();
      sceneRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [homeKit, awayKit, homeLogoUrl, occupancy]);

  // Trigger TV broadcast stinger wipe
  const triggerStinger = useCallback(() => {
    setStinger(true);
    if (soundRef.current) playSfx("whoosh");
    const tm = setTimeout(() => setStinger(false), 550);
    return () => clearTimeout(tm);
  }, []);

  // When a new clip arrives
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    scene.setActors(clip.actors);
    scene.setFocus(focusId ?? null);
    scene.setLabels(labels);
    scene.setScoreboard([
      `${hud.away.code} ${hud.away.score} – ${hud.home.score} ${hud.home.code}`,
      hud.tag ?? "NHL REPLAY",
    ]);
    tRef.current = 0;
    tvAngleRef.current = 0;
    endedRef.current = false;
    setT(0);
    setTvAngle(0);
    setPlaying(true);
    setEnded(false);
    scene.setFrame(clipAt(clip, 0), 0);
    scene.setCamera(camRef.current === "auto" ? "broadcast" : camRef.current, clip.attackDir);
    scene.snapCamera();
    triggerStinger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clip, homeKit, awayKit, triggerStinger]);

  // Automated TV Director
  const directed = useCallback(
    (time: number): CameraMode => {
      const angle = tvAngleRef.current;
      const shot = clip.shotT ?? clip.duration;
      const hit = clip.goalT ?? shot + 0.3;

      if (angle === 1) {
        // Angle 2: Close reverse angle or net cam
        return clip.attackDir === 1 ? "reverse" : "goalcam";
      } else if (angle === 2) {
        // Angle 3: Follow scorer celebration
        return "follow";
      }

      // Angle 0: Primary broadcast flow with slow-down at release
      if (time < shot - 0.8) return "broadcast";
      if (time < hit + 1.2) return "end";
      return "follow";
    },
    [clip]
  );

  useEffect(() => {
    let raf = 0,
      last = performance.now(),
      uiAt = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const scene = sceneRef.current;
      if (!scene) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const prev = tRef.current;

      if (playingRef.current) {
        const shot = clip.shotT ?? 0,
          hit = clip.goalT ?? shot;
        const isAuto = camRef.current === "auto";
        const curAngle = tvAngleRef.current;

        // Slow motion calculations in auto TV mode
        let slow = 1;
        if (isAuto) {
          if (curAngle === 0 && prev > shot - 0.7 && prev < hit + 0.5) {
            slow = 0.35;
          } else if (curAngle === 1) {
            slow = 0.38;
          }
        }

        tRef.current = Math.min(clip.duration, prev + dt * speedRef.current * slow);

        // Sound cues
        if (soundRef.current) {
          for (const c of clip.cues) {
            if (c.t > prev && c.t <= tRef.current) {
              if (c.kind === "goal") {
                playSfx("horn");
                playSfx("crowd");
                playSfx("twine");
              } else if (c.kind === "shot") {
                playSfx("shot");
              } else if (c.kind === "pass") {
                playSfx("pass");
              } else if (c.kind === "post") {
                playSfx("post");
              } else if (c.kind === "save") {
                playSfx("save");
              } else if (c.kind === "whistle") {
                playSfx("whistle");
              }
            }
          }
        }

        // Celebrations & goal lights
        if (clip.goalT != null && prev < clip.goalT && tRef.current >= clip.goalT) {
          scene.flashGoalLight(clip.attackDir, 4.5);
          scene.cheer(clip.attackSide, 1, 7);
        } else if (clip.shotT != null && prev < clip.shotT && tRef.current >= clip.shotT) {
          scene.cheer(clip.attackSide, 0.35, 1.4);
        }

        // Auto Director Angle Transition Sequence
        if (isAuto) {
          // Angle 0 completes after goal + 1.2s -> transition to Angle 1 (Super slow-mo from reverse)
          if (curAngle === 0 && tRef.current >= Math.min(clip.duration, hit + 1.4)) {
            tvAngleRef.current = 1;
            setTvAngle(1);
            triggerStinger();
            tRef.current = Math.max(0, shot - 0.75);
            scene.setCamera(directed(tRef.current), clip.attackDir);
            scene.snapCamera();
          } else if (curAngle === 1 && tRef.current >= Math.min(clip.duration, hit + 1.1)) {
            // Angle 1 completes -> transition to Angle 2 (Celebration ISO cam)
            tvAngleRef.current = 2;
            setTvAngle(2);
            triggerStinger();
            tRef.current = hit + 0.15;
            scene.setCamera("follow", clip.attackDir);
            scene.snapCamera();
          } else if (tRef.current >= clip.duration && !endedRef.current) {
            endedRef.current = true;
            playingRef.current = false;
            setPlaying(false);
            setEnded(true);
            onEnded?.();
          }
        } else {
          if (tRef.current >= clip.duration && !endedRef.current) {
            endedRef.current = true;
            playingRef.current = false;
            setPlaying(false);
            setEnded(true);
            onEnded?.();
          }
        }
      }

      if (camRef.current === "auto") {
        scene.setCamera(directed(tRef.current), clip.attackDir);
      } else {
        scene.setCamera(camRef.current, clip.attackDir);
      }

      scene.setFrame(clipAt(clip, tRef.current), playingRef.current ? dt * speedRef.current : 0);
      scene.render(dt);

      if (now - uiAt > 80) {
        uiAt = now;
        setT(tRef.current);
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [clip, directed, onEnded, triggerStinger]);

  const restart = () => {
    tvAngleRef.current = 0;
    setTvAngle(0);
    tRef.current = 0;
    endedRef.current = false;
    setEnded(false);
    setT(0);
    setPlaying(true);
    playingRef.current = true;
    sceneRef.current?.snapCamera();
    triggerStinger();
  };

  const toggle = () => {
    if (endedRef.current) restart();
    else setPlaying((p) => !p);
  };

  const scrub = (v: number) => {
    tRef.current = v;
    endedRef.current = v >= clip.duration;
    setEnded(endedRef.current);
    setT(v);
    setPlaying(false);
  };

  const switchCam = (c: Cam) => {
    setCam(c);
    camRef.current = c;
    tvAngleRef.current = 0;
    setTvAngle(0);
    if (sceneRef.current) {
      sceneRef.current.setCamera(c === "auto" ? directed(tRef.current) : c, clip.attackDir);
      sceneRef.current.snapCamera();
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === "Space") {
        e.preventDefault();
        toggle();
      } else if (e.code === "KeyF") {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.code === "KeyR") {
        e.preventDefault();
        restart();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const goalShown = clip.goalT != null && t >= clip.goalT;
  const isGoalMoment = clip.goalT != null && Math.abs(t - clip.goalT) < 0.8;
  const scoringSide = hud.scoringSide ?? "home";
  const scoringColor = scoringSide === "home" ? homeKit.jersey : awayKit.jersey;

  const activeCamLabel =
    cam === "auto"
      ? tvAngle === 0
        ? "🎬 TV RÉŽIA · UHOL 1/3 (TV PRENOS)"
        : tvAngle === 1
        ? "🎬 TV RÉŽIA · UHOL 2/3 (SUPER SLOW-MO)"
        : "🎬 TV RÉŽIA · UHOL 3/3 (OSLAVA GÓLU)"
      : CAMS.find((c) => c[0] === cam)?.[1] ?? cam.toUpperCase();

  return (
    <div className="w-full">
      {/* 3D Viewport Box */}
      <div
        ref={boxRef}
        className="relative w-full aspect-video bg-[#050810] rounded-xl overflow-hidden border border-slate-800/80 select-none shadow-2xl"
      >
        <canvas
          ref={canvasRef}
          className={`w-full h-full block ${cam === "free" ? "cursor-grab active:cursor-grabbing" : ""}`}
        />

        {!webgl && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-400 p-6 text-center">
            Tento prehliadač nepodporuje WebGL, 3D záznam sa nedá zobraziť.
          </div>
        )}

        {/* TV Stinger Wipe Transition */}
        {stinger && (
          <div className="absolute inset-0 z-40 pointer-events-none overflow-hidden flex items-center justify-center">
            <div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-sky-400/30 to-transparent transform -skew-x-12 translate-x-full animate-[wipe_0.5s_cubic-bezier(0.4,0,0.2,1)_forwards]"
              style={{
                background: `linear-gradient(90deg, transparent, ${scoringColor}88, #ffffff, ${scoringColor}88, transparent)`,
              }}
            />
          </div>
        )}

        {/* TV Scorebug (Top Left) */}
        <div className="absolute top-2.5 left-2.5 sm:top-3.5 sm:left-3.5 z-20 flex items-stretch text-[11px] sm:text-xs font-black rounded-lg overflow-hidden shadow-2xl border border-white/10 backdrop-blur-md pointer-events-none">
          {/* Away Team */}
          <div
            className="px-2.5 py-1 text-white flex items-center justify-center tracking-wider"
            style={{ background: awayKit.jersey }}
          >
            {hud.away.code}
          </div>
          <div
            className={`px-2.5 py-1 text-white tabular-nums flex items-center justify-center transition-colors duration-300 ${
              isGoalMoment && scoringSide === "away" ? "bg-red-600 animate-pulse" : "bg-black/85"
            }`}
          >
            {hud.away.score}
          </div>

          {/* Home Team */}
          <div
            className="px-2.5 py-1 text-white flex items-center justify-center tracking-wider"
            style={{ background: homeKit.jersey }}
          >
            {hud.home.code}
          </div>
          <div
            className={`px-2.5 py-1 text-white tabular-nums flex items-center justify-center transition-colors duration-300 ${
              isGoalMoment && scoringSide === "home" ? "bg-red-600 animate-pulse" : "bg-black/85"
            }`}
          >
            {hud.home.score}
          </div>

          {/* Clock & Period */}
          <div className="px-2.5 py-1 bg-slate-900/90 text-slate-200 font-mono font-bold flex items-center justify-center border-l border-white/10">
            {hud.clock}
          </div>
        </div>

        {/* Replay Bug & Active Camera Badge (Top Right) */}
        <div className="absolute top-2.5 right-2.5 sm:top-3.5 sm:right-3.5 z-20 flex items-center gap-1.5 pointer-events-none">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-black/75 border border-white/10 backdrop-blur-md text-[10px] sm:text-xs font-bold text-slate-200 shadow-lg">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping inline-block" />
            <span className="font-mono text-red-400 font-black tracking-widest">REPLAY</span>
            <span className="text-slate-600">|</span>
            <span className="text-slate-300 tracking-wide">{activeCamLabel}</span>
          </div>
        </div>

        {/* TV Broadcast Lower Third with NHL Edge Telemetry */}
        <div
          className={`absolute left-2.5 right-2.5 bottom-2.5 sm:left-4 sm:bottom-4 sm:right-auto z-20 transition-all duration-500 pointer-events-none max-w-[620px] ${
            goalShown ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <div
            className="rounded-xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.85)] border backdrop-blur-md"
            style={{
              borderColor: `${scoringColor}99`,
              background: "linear-gradient(135deg, rgba(8,12,22,0.95), rgba(15,23,42,0.92))",
            }}
          >
            {/* Header / Scorer Row */}
            <div className="px-3.5 py-2 flex items-center justify-between gap-3 border-b border-white/10">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider text-white shadow-sm"
                  style={{ background: scoringColor }}
                >
                  {hud.scorer?.teamCode ?? (scoringSide === "home" ? hud.home.code : hud.away.code)}
                </span>
                <span className="text-sm sm:text-base font-black text-white tracking-wide truncate">
                  {hud.scorer?.number != null ? `#${hud.scorer.number} ` : ""}
                  {hud.scorer?.name ?? hud.title}
                </span>
                {hud.scorer?.seasonGoals != null && hud.scorer.seasonGoals > 0 && (
                  <span className="text-[11px] font-bold text-amber-400 px-1.5 py-0.5 rounded bg-amber-400/10 border border-amber-400/30">
                    {hud.scorer.seasonGoals}. gól
                  </span>
                )}
              </div>

              {/* Strength Badge (PPG / SHG / EN) */}
              <div className="flex items-center gap-1.5 shrink-0">
                {hud.strength === "PP" && (
                  <span className="px-2 py-0.5 rounded bg-amber-500 text-slate-950 font-black text-[10px] tracking-wider">
                    PRESILOVKA
                  </span>
                )}
                {hud.strength === "SH" && (
                  <span className="px-2 py-0.5 rounded bg-red-600 text-white font-black text-[10px] tracking-wider">
                    OSLABENIE
                  </span>
                )}
                {hud.emptyNet && (
                  <span className="px-2 py-0.5 rounded bg-slate-700 text-white font-black text-[10px] tracking-wider">
                    PRÁZDNA BRÁNA
                  </span>
                )}
              </div>
            </div>

            {/* NHL Edge / SMT Telemetry Bar */}
            {hud.telemetry && (
              <div className="px-3.5 py-2 grid grid-cols-2 sm:grid-cols-4 gap-2 bg-black/40 border-b border-white/5 text-[11px]">
                {/* Shot Speed */}
                <div className="flex flex-col">
                  <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400">Rýchlosť strely</span>
                  <div className="flex items-baseline gap-1 font-black text-sky-400">
                    <span className="text-sm sm:text-base font-mono">
                      {speedUnit === "mph" ? hud.telemetry.speedMph : hud.telemetry.speedKmh}
                    </span>
                    <span className="text-[10px] uppercase font-bold text-slate-400">
                      {speedUnit === "mph" ? "MPH" : "KM/H"}
                    </span>
                  </div>
                </div>

                {/* Distance */}
                <div className="flex flex-col">
                  <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400">Vzdialenosť</span>
                  <div className="flex items-baseline gap-1 font-black text-amber-400">
                    <span className="text-sm sm:text-base font-mono">{hud.telemetry.distanceFt}</span>
                    <span className="text-[10px] uppercase font-bold text-slate-400">FT</span>
                    <span className="text-[9px] text-slate-500">({hud.telemetry.distanceM}m)</span>
                  </div>
                </div>

                {/* Shot Type */}
                <div className="flex flex-col">
                  <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400">Typ zakončenia</span>
                  <span className="text-xs sm:text-sm font-black text-slate-100 truncate">
                    {hud.telemetry.shotTypeLabel}
                  </span>
                </div>

                {/* Expected Goals / Play */}
                <div className="flex flex-col">
                  <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400">
                    {hud.telemetry.xgFormatted ? "Šanca (xG)" : "Situácia"}
                  </span>
                  <div className="flex items-center gap-1 font-black text-emerald-400">
                    {hud.telemetry.xgFormatted ? (
                      <>
                        <span className="text-xs sm:text-sm font-mono">{hud.telemetry.xgFormatted}</span>
                        {hud.telemetry.isHighDanger && (
                          <span className="text-[9px] px-1 py-0.2 rounded bg-rose-500/20 text-rose-400 font-bold border border-rose-500/30">
                            HD
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-xs font-bold text-slate-300">{hud.telemetry.playLabel}</span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Assists Row */}
            <div className="px-3.5 py-1.5 bg-black/60 text-[11px] text-slate-300 flex items-center gap-1.5">
              <span className="text-slate-500 font-bold uppercase text-[9px] tracking-wider">Asistencie:</span>
              <span className="font-semibold text-slate-200">
                {hud.assists && hud.assists.length > 0
                  ? hud.assists
                      .map((a) => (a.number != null ? `${a.name} (#${a.number})` : a.name))
                      .join(", ")
                  : hud.subtitle ?? "bez asistencie"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Transport Bar & Scrubber */}
      <div className="mt-2.5 flex items-center gap-2.5">
        <button
          onClick={toggle}
          className="w-10 h-10 shrink-0 rounded-xl bg-gradient-to-br from-sky-500 to-sky-600 hover:from-sky-400 hover:to-sky-500 text-white font-black flex items-center justify-center shadow-lg transition active:scale-95"
          aria-label={playing ? "Pauza" : "Prehrať"}
          title={playing ? "Pauza (Medzerník)" : "Prehrať (Medzerník)"}
        >
          {ended && !playing ? "↻" : playing ? "❚❚" : "▶"}
        </button>

        {/* Scrubber with Keyframe Dots */}
        <div className="relative flex-1 flex items-center min-w-0">
          <input
            type="range"
            min={0}
            max={clip.duration}
            step={0.01}
            value={t}
            onChange={(e) => scrub(Number(e.target.value))}
            className="w-full accent-sky-500 cursor-pointer h-2 bg-slate-800 rounded-lg"
            aria-label="Posun v zázname"
          />

          {/* Keyframe Cue Markers */}
          {clip.shotT != null && (
            <div
              className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-amber-400 pointer-events-none shadow"
              style={{ left: `${(clip.shotT / clip.duration) * 100}%` }}
              title="Moment strely"
            />
          )}
          {clip.goalT != null && (
            <div
              className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-red-500 pointer-events-none shadow animate-pulse"
              style={{ left: `${(clip.goalT / clip.duration) * 100}%` }}
              title="Gól v sieti"
            />
          )}
        </div>

        <span className="text-[11px] font-mono text-slate-400 w-20 text-right tabular-nums shrink-0 font-bold">
          {t.toFixed(1)} / {clip.duration.toFixed(1)}s
        </span>

        {/* Speed Unit Toggle (MPH / KM/H) */}
        <button
          onClick={() => setSpeedUnit((u) => (u === "mph" ? "kmh" : "mph"))}
          className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[10px] font-mono font-bold text-slate-300 uppercase transition"
          title="Prepnúť jednotky rýchlosti"
        >
          {speedUnit}
        </button>

        {/* Fullscreen Button */}
        <button
          onClick={toggleFullscreen}
          className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white flex items-center justify-center text-xs font-bold transition"
          title="Celá obrazovka (F)"
          aria-label="Celá obrazovka"
        >
          {isFullscreen ? "🗗" : "⛶"}
        </button>
      </div>

      {/* Camera Selection & Secondary Controls */}
      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-800/80 pt-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          {CAMS.map(([id, label, desc]) => (
            <button
              key={id}
              onClick={() => switchCam(id)}
              title={desc}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition ${
                cam === id
                  ? "bg-sky-600 border-sky-400 text-white shadow-md shadow-sky-600/30"
                  : "bg-slate-800/90 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {SPEEDS.map((s) => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={`px-2 py-1 rounded-lg text-[11px] font-bold border transition ${
                speed === s
                  ? "bg-amber-500 border-amber-400 text-slate-950 font-black shadow-md shadow-amber-500/20"
                  : "bg-slate-800/90 border-slate-700 text-slate-300 hover:text-white"
              }`}
            >
              {s === 1 ? "1×" : `${s}×`}
            </button>
          ))}

          <span className="mx-1 h-5 w-px bg-slate-800" />

          <button
            onClick={() => setLabels((v) => !v)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition ${
              labels
                ? "bg-slate-700 border-slate-600 text-white"
                : "bg-slate-800 border-slate-700 text-slate-500"
            }`}
            title="Zapnúť / vypnúť menovky hráčov"
          >
            🏷️ Mená
          </button>

          <button
            onClick={() => setSound((v) => !v)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition ${
              sound
                ? "bg-slate-700 border-slate-600 text-white"
                : "bg-slate-800 border-slate-700 text-slate-500"
            }`}
            title="Zvuk klaksónu a arény"
          >
            {sound ? "🔊" : "🔇"}
          </button>
        </div>
      </div>

      {cam === "free" && (
        <p className="mt-1.5 text-[11px] text-slate-500 font-mono">
          Tip: Ťahanie myšou pre voľné 360° otáčanie okolo bránky, koliesko = zoom, pravé tlačidlo = posun kamery.
        </p>
      )}
    </div>
  );
}
