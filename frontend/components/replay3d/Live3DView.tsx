"use client";

// Live 3D view of a running game. The LiveDirector turns the event feed into short
// clips (faceoffs, shots, goals, hits, possession); this plays them back to back,
// blending each clip out of the last one so nobody teleports, and speeds up a little
// when the feed gets ahead. The score/clock come straight from the live view.

import { useEffect, useMemo, useRef, useState } from "react";
import { RinkScene, type CameraMode } from "./RinkScene";
import { playSfx } from "./sfx";
import { clipAt, type ActorState, type ClipFrame } from "@/lib/replay3d/reconstruct";
import { LiveDirector, type Banner, type LiveItem, type LivePlayer, type LiveTeam } from "@/lib/replay3d/live-director";
import { teamKit } from "@/lib/replay3d/team-colors";
import type { SimEvent } from "@/lib/sim/events";

type Side = { id: number; code: string | null; name: string };
type MatchupSlot = { name: string; num: string };
type MatchupTeam = { forwardLines?: Array<{ lw: MatchupSlot; c: MatchupSlot; rw: MatchupSlot }>; defensePairs?: Array<{ ld: MatchupSlot; rd: MatchupSlot }>; goalie?: MatchupSlot };

type Cam = CameraMode | "auto";
const CAMS: Array<[Cam, string]> = [["auto", "🎬 Réžia"], ["broadcast", "📺 TV"], ["end", "🥅 Za bránkou"], ["follow", "🏃 Sledovať"], ["top", "🗺️ Zhora"], ["free", "🖐️ Voľná"]];
const BLEND = 0.6;

const num = (s: string | undefined) => { const n = Number(s); return Number.isFinite(n) && s !== "" ? n : null; };
function toTeam(teamId: number, code: string, m: MatchupTeam | undefined): LiveTeam {
  const p = (x: MatchupSlot | undefined, role: LivePlayer["role"]): LivePlayer | null => (x?.name ? { name: x.name, number: num(x.num), role } : null);
  return {
    teamId, code,
    fLines: (m?.forwardLines ?? []).map((l) => [p(l.lw, "F"), p(l.c, "F"), p(l.rw, "F")].filter((x): x is LivePlayer => !!x)),
    dPairs: (m?.defensePairs ?? []).map((l) => [p(l.ld, "D"), p(l.rd, "D")].filter((x): x is LivePlayer => !!x)),
    goalie: p(m?.goalie, "G"),
  };
}

function readPref(key: string, fallback: string): string {
  try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
}

export default function Live3DView({ gameId, home, away, homeLogoUrl, events, score, shots, periodText, clockText, status }: {
  gameId: number; home: Side; away: Side; homeLogoUrl?: string | null;
  events: SimEvent[]; score: { home: number; away: number }; shots: { home: number; away: number };
  periodText: string; clockText: string; status: "pending" | "live" | "final" | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<RinkScene | null>(null);
  const directorRef = useRef<LiveDirector | null>(null);
  const fedRef = useRef(0);
  const camRef = useRef<Cam>("auto");
  const soundRef = useRef(true);
  const statusRef = useRef(status);
  const [ready, setReady] = useState(false);
  const [cam, setCam] = useState<Cam>(() => readPref("live3d_cam", "auto") as Cam);
  const [sound, setSound] = useState(() => readPref("live3d_sound", "on") !== "off");
  const [labels, setLabels] = useState(() => readPref("live3d_labels", "on") !== "off");
  const [banner, setBanner] = useState<Banner | null>(null);
  const [behind, setBehind] = useState(0);
  const [replaying, setReplaying] = useState(false);
  const [webgl] = useState(() => { try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch { return false; } });
  const homeKit = useMemo(() => teamKit(home.code, home.name, true), [home.code, home.name]);
  const awayKit = useMemo(() => teamKit(away.code, away.name, false), [away.code, away.name]);

  useEffect(() => { camRef.current = cam; try { localStorage.setItem("live3d_cam", cam); } catch {} }, [cam]);
  useEffect(() => { soundRef.current = sound; try { localStorage.setItem("live3d_sound", sound ? "on" : "off"); } catch {} }, [sound]);
  useEffect(() => { sceneRef.current?.setLabels(labels); try { localStorage.setItem("live3d_labels", labels ? "on" : "off"); } catch {} }, [labels]);
  useEffect(() => { statusRef.current = status; }, [status]);

  // the two benches, from the same matchup endpoint the 2D tracker uses
  useEffect(() => {
    let alive = true;
    fetch(`/api/live/games/${gameId}/matchup?homeTeamId=${home.id}&awayTeamId=${away.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
      .then((m: { home?: MatchupTeam; away?: MatchupTeam } | null) => {
        if (!alive) return;
        directorRef.current = new LiveDirector(toTeam(home.id, home.code ?? home.name.slice(0, 3).toUpperCase(), m?.home), toTeam(away.id, away.code ?? away.name.slice(0, 3).toUpperCase(), m?.away), gameId);
        fedRef.current = 0;
        setReady(true);
      });
    return () => { alive = false; };
  }, [gameId, home.id, away.id, home.code, home.name, away.code, away.name]);

  // feed the director whatever arrived since last time
  useEffect(() => {
    const d = directorRef.current;
    if (!d || !ready) return;
    if (events.length > fedRef.current) { d.ingest(events.slice(fedRef.current)); fedRef.current = events.length; }
  }, [events, ready]);

  useEffect(() => {
    const canvas = canvasRef.current, box = boxRef.current;
    if (!canvas || !box || !ready) return;
    let scene: RinkScene;
    try { scene = new RinkScene(canvas, { homeKit, awayKit, homeLogoUrl }); } catch { return; }
    sceneRef.current = scene;
    scene.setLabels(labels);
    const ro = new ResizeObserver(() => scene.resize(box.clientWidth, box.clientHeight));
    ro.observe(box); scene.resize(box.clientWidth, box.clientHeight);

    let item: LiveItem | null = null, t = 0, raf = 0, last = performance.now(), bannerUntil = 0, uiAt = 0;
    let prev: { a: Map<string, ActorState>; p: ClipFrame["p"] } | null = null;
    const start = () => {
      const d = directorRef.current!;
      // remember where everyone was so the next clip can glide out of it
      if (item) {
        const end = clipAt(item.clip, Math.min(t, item.clip.duration));
        prev = { a: new Map(item.clip.actors.map((a, i) => [a.id, end.a[i]])), p: end.p };
      }
      item = d.next();
      t = item.startAt ?? 0;
      if (item.kind === "replay") prev = null; // a replay is a hard cut, like on TV
      setReplaying(item.kind === "replay");
      scene.setActors(item.clip.actors);
      scene.setFocus(item.focusId ?? null);
      if (item.banner) { setBanner(item.banner); bannerUntil = performance.now() + (item.kind === "goal" ? 6000 : 3200); }
    };
    const camFor = (it: LiveItem, time: number): CameraMode => {
      const shot0 = it.clip.shotT ?? 0, hit0 = it.clip.goalT ?? shot0 + 0.4;
      if (it.kind === "replay") return time < hit0 + 0.9 ? "goalcam" : "end";
      if (it.kind === "solo" || (it.kind === "goal" && it.clip.actors.filter((a) => a.role !== "G").length === 1)) return time < shot0 - 0.5 ? "follow" : time < hit0 + 1.2 ? "end" : "follow";
      if (it.kind === "goal" || it.kind === "shot") {
        const shot = it.clip.shotT ?? 0, hit = it.clip.goalT ?? shot + 0.4;
        if (time < shot - 0.8) return "broadcast";
        if (time < hit + (it.kind === "goal" ? 1.4 : 0.6)) return "end";
        return it.kind === "goal" ? "follow" : "broadcast";
      }
      return "broadcast";
    };
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const d = directorRef.current;
      if (!d) return;
      const over = statusRef.current === "final" && d.pending === 0;
      if (!item || (t >= item.clip.duration && !over)) start();
      const it = item!;
      // keep up with the feed: up to 2.2× when several clips are waiting
      let speed = statusRef.current === "pending" ? 0.6 : 1 + Math.min(1.2, d.pending * 0.3);
      if (it.kind === "replay") { const sh = it.clip.shotT ?? 0, g = it.clip.goalT ?? sh; speed = t > sh - 0.7 && t < g + 0.6 ? 0.4 : 1.2; }
      const prevT = t;
      if (!over) t = Math.min(it.clip.duration, t + dt * speed);
      if (soundRef.current) for (const c of it.clip.cues) if (c.t > prevT && c.t <= t) {
        if (c.kind === "goal") { if (it.kind !== "replay") { playSfx("horn"); playSfx("crowd"); } }
        else if (c.kind === "shot") playSfx("shot");
        else if (c.kind === "pass") playSfx("pass");
        else if (c.kind === "post") playSfx("post");
        else if (c.kind === "save") playSfx("save");
        else if (c.kind === "whistle") playSfx("whistle");
        else if (c.kind === "hit") playSfx("hit");
      }
      if (it.clip.goalT != null && prevT < it.clip.goalT && t >= it.clip.goalT && it.kind !== "replay") scene.flashGoalLight(it.clip.attackDir);
      // glide out of the previous clip
      let fr = clipAt(it.clip, t);
      const k = Math.min(1, (t - (it.startAt ?? 0)) / BLEND);
      if (prev && k < 1) {
        const e = k * k * (3 - 2 * k), P = prev;
        fr = {
          a: fr.a.map((s, i) => { const q = P.a.get(it.clip.actors[i].id); if (!q) return s; let dh = s.h - q.h; while (dh > Math.PI) dh -= 2 * Math.PI; while (dh < -Math.PI) dh += 2 * Math.PI; return { ...s, x: q.x + (s.x - q.x) * e, z: q.z + (s.z - q.z) * e, h: q.h + dh * e }; }),
          p: { ...fr.p, x: P.p.x + (fr.p.x - P.p.x) * e, y: P.p.y + (fr.p.y - P.p.y) * e, z: P.p.z + (fr.p.z - P.p.z) * e },
        };
      }
      scene.setCamera(camRef.current === "auto" ? camFor(it, t) : camRef.current, it.clip.attackDir);
      scene.setFrame(fr, over ? 0 : dt * speed);
      scene.render(dt);
      if (bannerUntil && now > bannerUntil) { bannerUntil = 0; setBanner(null); }
      if (now - uiAt > 500) { uiAt = now; setBehind(d.pending); }
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); scene.dispose(); sceneRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, homeKit, awayKit, homeLogoUrl]);

  // the centre-hung board mirrors the real score
  useEffect(() => {
    sceneRef.current?.setScoreboard([`${away.code ?? "AWY"} ${score.away} – ${score.home} ${home.code ?? "HOM"}`, `${periodText} ${clockText}`]);
  }, [score.home, score.away, periodText, clockText, home.code, away.code, ready]);

  const tone = banner?.tone === "goal" ? "bg-red-600 text-white" : banner?.tone === "penalty" ? "bg-amber-500 text-slate-950" : banner?.tone === "save" ? "bg-sky-600 text-white" : "bg-slate-900/90 text-slate-100";

  return (
    <div className="w-full">
      <div ref={boxRef} className="relative w-full aspect-video bg-[#070b12] rounded-xl overflow-hidden border border-slate-800 select-none">
        <canvas ref={canvasRef} className={`w-full h-full block ${cam === "free" ? "cursor-grab active:cursor-grabbing" : ""}`} />
        {!webgl && <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-400 p-6 text-center">Tento prehliadač nepodporuje WebGL, 3D pohľad sa nedá zobraziť.</div>}
        {!ready && webgl && <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-400">Načítavam zostavy…</div>}
        <div className="absolute top-2 left-2 sm:top-3 sm:left-3 flex items-stretch text-[11px] sm:text-sm font-black rounded-md overflow-hidden shadow-lg pointer-events-none">
          <span className="px-2 py-1 text-white" style={{ background: awayKit.trim }}>{away.code ?? away.name}</span>
          <span className="px-2 py-1 bg-slate-950/90 text-white tabular-nums">{score.away}</span>
          <span className="px-2 py-1 text-white" style={{ background: homeKit.jersey }}>{home.code ?? home.name}</span>
          <span className="px-2 py-1 bg-slate-950/90 text-white tabular-nums">{score.home}</span>
          <span className="px-2 py-1 bg-slate-800/95 text-slate-200 font-mono font-bold">{periodText} {clockText}</span>
        </div>
        <div className="absolute top-2 right-2 sm:top-3 sm:right-3 flex items-center gap-1.5 pointer-events-none">
          <span className="text-[10px] font-mono text-slate-300 bg-slate-950/70 px-1.5 py-0.5 rounded hidden sm:inline">SOG {shots.away}–{shots.home}</span>
          {replaying
            ? <span className="px-2 py-0.5 rounded text-[10px] sm:text-xs font-black tracking-widest bg-amber-500 text-slate-950">🔁 REPLAY</span>
            : <span className={`px-2 py-0.5 rounded text-[10px] sm:text-xs font-black tracking-widest ${status === "live" ? "bg-red-600 text-white animate-pulse" : "bg-slate-700 text-slate-200"}`}>{status === "live" ? "● LIVE" : status === "final" ? "FINAL" : "PRED ZÁPASOM"}</span>}
        </div>
        {banner && (
          <div className="absolute left-1/2 -translate-x-1/2 bottom-3 sm:bottom-5 max-w-[92%] pointer-events-none">
            <div className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg shadow-xl font-black text-xs sm:text-base text-center ${tone}`}>{banner.text}</div>
          </div>
        )}
        {status === "final" && behind === 0 && <div className="absolute inset-x-0 top-12 text-center pointer-events-none"><span className="inline-block px-4 py-1.5 rounded-lg bg-slate-950/85 text-white font-black tracking-widest text-sm">KONIEC ZÁPASU</span></div>}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {CAMS.map(([id, label]) => (
          <button key={id} onClick={() => setCam(id)} className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition ${cam === id ? "bg-sky-600 border-sky-500 text-white" : "bg-slate-800 border-slate-700 text-slate-300 hover:text-white"}`}>{label}</button>
        ))}
        <span className="mx-1 h-5 w-px bg-slate-700" />
        <button onClick={() => setLabels((v) => !v)} className={`px-2 py-1 rounded-lg text-[11px] font-bold border ${labels ? "bg-slate-700 border-slate-600 text-white" : "bg-slate-800 border-slate-700 text-slate-500"}`}>🏷️ Mená</button>
        <button onClick={() => setSound((v) => !v)} className={`px-2 py-1 rounded-lg text-[11px] font-bold border ${sound ? "bg-slate-700 border-slate-600 text-white" : "bg-slate-800 border-slate-700 text-slate-500"}`}>{sound ? "🔊" : "🔇"}</button>
        {behind > 2 && <span className="text-[11px] text-amber-400 font-bold">⏩ dobieham živý priebeh ({behind})</span>}
        <span className="ml-auto text-[10px] text-slate-500 hidden sm:inline">3D pohľad je rekonštrukcia z udalostí zápasu, výsledok neovplyvňuje.</span>
      </div>
    </div>
  );
}
