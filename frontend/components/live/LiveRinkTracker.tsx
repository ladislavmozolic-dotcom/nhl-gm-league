"use client";

import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import type { SimEvent } from "@/lib/sim/events";
import type { LiveLine } from "@/lib/sim/live-text";

export interface ForwardLineData {
  num: number;
  lw: { name: string; num: string };
  c: { name: string; num: string };
  rw: { name: string; num: string };
}

export interface LiveRinkTrackerProps {
  gameId?: number;
  homeTeamId?: number;
  awayTeamId?: number;
  homeTeamName?: string;
  awayTeamName?: string;
  homeLogoUrl?: string;
  awayLogoUrl?: string;
  homeScore?: number;
  awayScore?: number;
  homeSog?: number;
  awaySog?: number;
  clockStr?: string;
  periodStr?: string;
  isLive?: boolean;
  standaloneControls?: boolean;
  events?: SimEvent[];
  liveLines?: LiveLine[];
}

interface Player {
  id: string;
  team: "home" | "away";
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  targetX: number;
  targetY: number;
  angle: number;
  num: string;
  name: string;
  role: string;
  energy: number;
  toi: string;
  shiftSeconds: number;
  speed: number;
  isGoalie?: boolean;
}

interface Puck {
  x: number;
  y: number;
  mode: "CARRIED" | "PASS_FLIGHT" | "SHOT_FLIGHT" | "REBOUND";
  carrierId: string | null;
  passFromX: number;
  passFromY: number;
  passToX: number;
  passToY: number;
  passProgress: number;
  passDuration: number;
  passReceiverId: string | null;
  reboundVx: number;
  reboundVy: number;
}

export const AWAY_FORWARD_LINES = [
  {
    num: 1,
    lw: { name: "A. Panarin", num: "10" },
    c:  { name: "M. Zibanejad", num: "93" },
    rw: { name: "A. Lafreniere", num: "13" },
  },
  {
    num: 2,
    lw: { name: "C. Kreider", num: "20" },
    c:  { name: "V. Trocheck", num: "16" },
    rw: { name: "R. Smith", num: "91" },
  },
  {
    num: 3,
    lw: { name: "W. Cuylle", num: "50" },
    c:  { name: "F. Chytil", num: "72" },
    rw: { name: "K. Kakko", num: "24" },
  },
  {
    num: 4,
    lw: { name: "J. Vesey", num: "26" },
    c:  { name: "S. Carrick", num: "39" },
    rw: { name: "M. Rempe", num: "73" },
  },
];

export const HOME_FORWARD_LINES = [
  {
    num: 1,
    lw: { name: "J. Bratt", num: "63" },
    c:  { name: "N. Hischier", num: "13" },
    rw: { name: "T. Meier", num: "28" },
  },
  {
    num: 2,
    lw: { name: "O. Palát", num: "18" },
    c:  { name: "J. Hughes", num: "86" },
    rw: { name: "D. Mercer", num: "91" },
  },
  {
    num: 3,
    lw: { name: "P. Cotter", num: "47" },
    c:  { name: "E. Haula", num: "56" },
    rw: { name: "S. Noesen", num: "11" },
  },
  {
    num: 4,
    lw: { name: "K. MacDermid", num: "23" },
    c:  { name: "C. Lazar", num: "42" },
    rw: { name: "N. Bastian", num: "14" },
  },
];

const INITIAL_PLAYERS: Player[] = [
  // Away Team (Blue)
  { id: "away-lw", team: "away", x: 0.86, y: 0.30, targetX: 0.86, targetY: 0.30, angle: 0, num: "10", name: "A. Panarin", role: "LW", energy: 88, toi: "14:12", shiftSeconds: 15, speed: 0.32 },
  { id: "away-c",  team: "away", x: 0.78, y: 0.50, targetX: 0.78, targetY: 0.50, angle: 0, num: "93", name: "M. Zibanejad", role: "C",  energy: 82, toi: "15:20", shiftSeconds: 15, speed: 0.30 },
  { id: "away-rw", team: "away", x: 0.84, y: 0.72, targetX: 0.84, targetY: 0.72, angle: 0, num: "13", name: "A. Lafreniere", role: "RW", energy: 85, toi: "12:45", shiftSeconds: 15, speed: 0.28 },
  { id: "away-ld", team: "away", x: 0.68, y: 0.32, targetX: 0.68, targetY: 0.32, angle: 0, num: "55", name: "R. Lindgren", role: "LD", energy: 75, toi: "16:04", shiftSeconds: 15, speed: 0.26 },
  { id: "away-rd", team: "away", x: 0.68, y: 0.65, targetX: 0.68, targetY: 0.65, angle: 0, num: "23", name: "A. Fox", role: "RD", energy: 78, toi: "17:15", shiftSeconds: 15, speed: 0.29 },
  { id: "away-g",  team: "away", x: 0.08, y: 0.50, targetX: 0.08, targetY: 0.50, angle: 0, num: "31", name: "I. Shesterkin", role: "G",  isGoalie: true, energy: 95, toi: "33:42", shiftSeconds: 0, speed: 0.20 },

  // Home Team (Red)
  { id: "home-lw", team: "home", x: 0.75, y: 0.34, targetX: 0.75, targetY: 0.34, angle: Math.PI, num: "63", name: "J. Bratt", role: "LW", energy: 84, toi: "13:30", shiftSeconds: 12, speed: 0.30 },
  { id: "home-c",  team: "home", x: 0.82, y: 0.48, targetX: 0.82, targetY: 0.48, angle: Math.PI, num: "13", name: "N. Hischier", role: "C",  energy: 86, toi: "14:40", shiftSeconds: 12, speed: 0.30 },
  { id: "home-rw", team: "home", x: 0.75, y: 0.66, targetX: 0.75, targetY: 0.66, angle: Math.PI, num: "28", name: "T. Meier", role: "RW", energy: 80, toi: "15:05", shiftSeconds: 12, speed: 0.31 },
  { id: "home-ld", team: "home", x: 0.86, y: 0.38, targetX: 0.86, targetY: 0.38, angle: Math.PI, num: "71", name: "J. Siegenthaler", role: "LD", energy: 80, toi: "16:12", shiftSeconds: 12, speed: 0.25 },
  { id: "home-rd", team: "home", x: 0.86, y: 0.62, targetX: 0.86, targetY: 0.62, angle: Math.PI, num: "7",  name: "D. Hamilton", role: "RD", energy: 77, toi: "17:30", shiftSeconds: 12, speed: 0.26 },
  { id: "home-g",  team: "home", x: 0.915, y: 0.50, targetX: 0.915, targetY: 0.50, angle: Math.PI, num: "25", name: "J. Markström", role: "G",  isGoalie: true, energy: 92, toi: "33:42", shiftSeconds: 0, speed: 0.22 },

  // Extra Attacker (6v5)
  { id: "home-extra", team: "home", x: 0.78, y: 0.52, targetX: 0.78, targetY: 0.52, angle: Math.PI, num: "91", name: "D. Mercer", role: "EA", energy: 88, toi: "09:20", shiftSeconds: 10, speed: 0.28 }
];

export default function LiveRinkTracker({
  gameId,
  homeTeamId,
  awayTeamId,
  homeTeamName = "Domáci",
  awayTeamName = "Hostia",
  homeLogoUrl = "",
  awayLogoUrl = "",
  homeScore = 0,
  awayScore = 0,
  homeSog = 0,
  awaySog = 0,
  periodStr = "1. Tretina",
  clockStr = "20:00",
  isLive = false,
  standaloneControls = true,
  events = [],
  liveLines = []
}: LiveRinkTrackerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Audio Context ref
  const audioCtxRef = useRef<AudioContext | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(true);

  // Sim State
  const [isPlaying, setIsPlaying] = useState(true);
  const [simSpeed, setSimSpeed] = useState(1);
  const [scoreHomeState, setScoreHomeState] = useState(homeScore);
  const [scoreAwayState, setScoreAwayState] = useState(awayScore);
  const [sogHomeState, setSogHomeState] = useState(homeSog);
  const [sogAwayState, setSogAwayState] = useState(awaySog);
  const [gameClockSeconds, setGameClockSeconds] = useState(20 * 60);

  // Keep state synced with props from real live engine
  useEffect(() => {
    if (!standaloneControls) {
      setScoreHomeState(homeScore);
      setScoreAwayState(awayScore);
      setSogHomeState(homeSog);
      setSogAwayState(awaySog);
    }
  }, [homeScore, awayScore, homeSog, awaySog, standaloneControls]);

  // Keep clock synced
  useEffect(() => {
    if (!standaloneControls && clockStr) {
      const parts = clockStr.split(":");
      if (parts.length === 2) {
        const m = parseInt(parts[0], 10) || 0;
        const s = parseInt(parts[1], 10) || 0;
        setGameClockSeconds(m * 60 + s);
      }
    }
  }, [clockStr, standaloneControls]);

  const [isShortenBench, setIsShortenBench] = useState(false);
  const [isPullGoalie, setIsPullGoalie] = useState(false);
  const [timeoutsLeft, setTimeoutsLeft] = useState(1);
  const [activeHomeLine, setActiveHomeLine] = useState(1);
  const [activeAwayLine, setActiveAwayLine] = useState(1);
  const activeHomeLineRef = useRef(1);
  const activeAwayLineRef = useRef(1);
  const homeShiftTimerRef = useRef(0);
  const awayShiftTimerRef = useRef(0);
  const [tacticsDrawerOpen, setTacticsDrawerOpen] = useState(false);

  // Dynamic Lines Data
  const [awayForwardLines, setAwayForwardLines] = useState<ForwardLineData[]>(AWAY_FORWARD_LINES);
  const [homeForwardLines, setHomeForwardLines] = useState<ForwardLineData[]>(HOME_FORWARD_LINES);
  const awayForwardLinesRef = useRef<ForwardLineData[]>(AWAY_FORWARD_LINES);
  const homeForwardLinesRef = useRef<ForwardLineData[]>(HOME_FORWARD_LINES);

  // HUD and Commentaries
  const [puckCarrierName, setPuckCarrierName] = useState(awayTeamName + " (#10)");
  const [zoneText, setZoneText] = useState("⚡ SÚBOJ V STREDNOM PÁSME");
  const [shotAlertVisible, setShotAlertVisible] = useState(false);
  const [goalOverlay, setGoalOverlay] = useState<{ visible: boolean; text: string }>({ visible: false, text: "" });
  const [feed, setFeed] = useState<Array<{ id: number; time: string; badge: string; border: string; bg: string; text: string }>>([
    { id: 1, time: clockStr || "20:00", badge: "ÚVOD", border: "border-emerald-500", bg: "bg-emerald-500/20 text-emerald-300", text: `Zápas ${awayTeamName} vs ${homeTeamName} bol zahájený úvodným buly.` }
  ]);

  // Merge real match broadcast lines into commentary feed when provided
  const displayFeed = useMemo(() => {
    if (liveLines && liveLines.length > 0) {
      const mapped = liveLines.map((l) => {
        let badge = "INFO ℹ️";
        let border = "border-slate-500";
        let bg = "bg-slate-700 text-slate-200";

        if (l.kind === "goal") {
          badge = "GÓL 🚨";
          border = "border-red-500";
          bg = "bg-red-600 text-white font-black";
        } else if (l.kind === "penalty") {
          badge = "TREST 🛑";
          border = "border-amber-500";
          bg = "bg-amber-500/20 text-amber-300 font-bold";
        } else if (l.kind === "save") {
          badge = "ZÁKROK 🧤";
          border = "border-sky-500";
          bg = "bg-sky-500/20 text-sky-300 font-bold";
        } else if (l.kind === "period") {
          badge = "TRETINA ⏱";
          border = "border-emerald-500";
          bg = "bg-emerald-500/20 text-emerald-300 font-bold";
        }

        const mins = Math.floor(l.seconds / 60);
        const secs = (l.seconds % 60).toString().padStart(2, "0");
        const timeStr = l.tag ?? `${mins}:${secs}`;

        return {
          id: l.seq,
          time: timeStr,
          badge,
          border,
          bg,
          text: l.text,
        };
      });

      const localShifts = feed.filter((f) => f.badge.includes("STRIEDANIE"));
      return [...localShifts, ...mapped.reverse()].slice(0, 30);
    }
    return feed;
  }, [liveLines, feed]);

  // Simulation Refs
  const playersRef = useRef<Player[]>(JSON.parse(JSON.stringify(INITIAL_PLAYERS)));

  // Load real team lines and rosters for both teams
  useEffect(() => {
    if (!gameId && !homeTeamId && !awayTeamId) return;

    const url = gameId
      ? `/api/live/games/${gameId}/matchup?homeTeamId=${homeTeamId || ""}&awayTeamId=${awayTeamId || ""}`
      : `/api/live/games/0/matchup?homeTeamId=${homeTeamId || ""}&awayTeamId=${awayTeamId || ""}`;

    fetch(url)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data?.home || !data?.away) return;
        const homeM = data.home;
        const awayM = data.away;

        if (homeM.forwardLines?.length) {
          setHomeForwardLines(homeM.forwardLines);
          homeForwardLinesRef.current = homeM.forwardLines;
        }
        if (awayM.forwardLines?.length) {
          setAwayForwardLines(awayM.forwardLines);
          awayForwardLinesRef.current = awayM.forwardLines;
        }

        // Apply real names and jersey numbers to active players
        const hLine1 = homeM.forwardLines?.[0];
        const aLine1 = awayM.forwardLines?.[0];

        playersRef.current.forEach((p) => {
          if (p.id === "away-lw" && aLine1?.lw) { p.name = aLine1.lw.name; p.num = aLine1.lw.num; }
          if (p.id === "away-c"  && aLine1?.c)  { p.name = aLine1.c.name;  p.num = aLine1.c.num; }
          if (p.id === "away-rw" && aLine1?.rw) { p.name = aLine1.rw.name; p.num = aLine1.rw.num; }
          if (p.id === "away-ld" && awayM.defense?.ld) { p.name = awayM.defense.ld.name; p.num = awayM.defense.ld.num; }
          if (p.id === "away-rd" && awayM.defense?.rd) { p.name = awayM.defense.rd.name; p.num = awayM.defense.rd.num; }
          if (p.id === "away-g"  && awayM.goalie) { p.name = awayM.goalie.name; p.num = awayM.goalie.num; }

          if (p.id === "home-lw" && hLine1?.lw) { p.name = hLine1.lw.name; p.num = hLine1.lw.num; }
          if (p.id === "home-c"  && hLine1?.c)  { p.name = hLine1.c.name;  p.num = hLine1.c.num; }
          if (p.id === "home-rw" && hLine1?.rw) { p.name = hLine1.rw.name; p.num = hLine1.rw.num; }
          if (p.id === "home-ld" && homeM.defense?.ld) { p.name = homeM.defense.ld.name; p.num = homeM.defense.ld.num; }
          if (p.id === "home-rd" && homeM.defense?.rd) { p.name = homeM.defense.rd.name; p.num = homeM.defense.rd.num; }
          if (p.id === "home-g"  && homeM.goalie) { p.name = homeM.goalie.name; p.num = homeM.goalie.num; }
          if (p.id === "home-extra" && homeM.extra) { p.name = homeM.extra.name; p.num = homeM.extra.num; }
        });

        if (aLine1?.c) {
          setPuckCarrierName(`${aLine1.c.name} (${awayTeamName})`);
        }
      })
      .catch((err) => {
        console.warn("Failed to load matchup lines:", err);
      });
  }, [gameId, homeTeamId, awayTeamId, awayTeamName]);
  const puckRef = useRef<Puck>({
    x: 0.50,
    y: 0.50,
    mode: "CARRIED",
    carrierId: "away-c",
    passFromX: 0,
    passFromY: 0,
    passToX: 0,
    passToY: 0,
    passProgress: 0,
    passDuration: 0.75,
    passReceiverId: null,
    reboundVx: 0,
    reboundVy: 0
  });

  const centerLogoRef = useRef<HTMLImageElement | null>(null);
  const skateTrailsRef = useRef<Array<{ x: number; y: number }>>([]);
  // Flow states: NEUTRAL -> AWAY_RUSH -> AWAY_OZONE -> AWAY_SHOT -> HOME_RUSH -> HOME_OZONE -> HOME_SHOT
  const phaseRef = useRef<"NEUTRAL" | "AWAY_RUSH" | "AWAY_OZONE" | "AWAY_SHOT" | "HOME_RUSH" | "HOME_COUNTER" | "HOME_OZONE" | "HOME_SHOT">("NEUTRAL");
  const phaseTimeRef = useRef(0);
  const cycleStepRef = useRef(0);
  const globalSimTimeRef = useRef(0);
  const clockTimerRef = useRef(0);
  const animFrameIdRef = useRef<number | null>(null);

  // Hover Tooltip state
  const [hoveredPlayer, setHoveredPlayer] = useState<{ player: Player; x: number; y: number } | null>(null);

  // Web Audio Synth
  const playSound = useCallback((type: "pass" | "receive" | "shot" | "post" | "horn") => {
    if (!audioEnabled || typeof window === "undefined") return;
    try {
      const AudioCtor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!audioCtxRef.current && AudioCtor) {
        audioCtxRef.current = new AudioCtor();
      }
      const ctx = audioCtxRef.current;
      if (!ctx) return;
      if (ctx.state === "suspended") ctx.resume();

      const t = ctx.currentTime;
      if (type === "pass") {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(260, t);
        osc.frequency.exponentialRampToValueAtTime(80, t + 0.05);
        gain.gain.setValueAtTime(0.25, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.06);
      } else if (type === "receive") {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(180, t);
        osc.frequency.exponentialRampToValueAtTime(70, t + 0.04);
        gain.gain.setValueAtTime(0.18, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.05);
      } else if (type === "shot") {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(160, t);
        osc.frequency.exponentialRampToValueAtTime(35, t + 0.15);
        gain.gain.setValueAtTime(0.6, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.16);
      } else if (type === "post") {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(2850, t);
        gain.gain.setValueAtTime(0.4, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.85);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.9);
      } else if (type === "horn") {
        const freqs = [174.61, 220.0, 261.63, 349.23];
        freqs.forEach((f) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sawtooth";
          osc.frequency.setValueAtTime(f, t);
          gain.gain.setValueAtTime(0.12, t);
          gain.gain.linearRampToValueAtTime(0.18, t + 0.25);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 2.2);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(t);
          osc.stop(t + 2.3);
        });
      }
    } catch {
      // Audio fallback
    }
  }, [audioEnabled]);

  const addCommentary = useCallback((badge: string, border: string, bg: string, text: string) => {
    const mins = Math.floor(gameClockSeconds / 60);
    const secs = (gameClockSeconds % 60).toString().padStart(2, "0");
    setFeed((cur) => [
      { id: Date.now() + Math.random(), time: `${mins}:${secs}`, badge, border, bg, text },
      ...cur.slice(0, 19)
    ]);
  }, [gameClockSeconds]);

  // Load home logo for center ice
  useEffect(() => {
    if (typeof window === "undefined" || !homeLogoUrl) {
      centerLogoRef.current = null;
      return;
    }
    const img = new Image();
    img.src = homeLogoUrl;
    centerLogoRef.current = img;
  }, [homeLogoUrl]);

  const switchForwardLine = useCallback((team: "home" | "away", lineNum: number) => {
    if (team === "home") {
      setActiveHomeLine(lineNum);
      activeHomeLineRef.current = lineNum;
      homeShiftTimerRef.current = 0;
      const lines = homeForwardLinesRef.current;
      const lineData = lines[lineNum - 1] || lines[0] || HOME_FORWARD_LINES[0];
      const lw = playersRef.current.find((p) => p.id === "home-lw");
      const c  = playersRef.current.find((p) => p.id === "home-c");
      const rw = playersRef.current.find((p) => p.id === "home-rw");
      if (lw) { lw.name = lineData.lw.name; lw.num = lineData.lw.num; lw.energy = 96; lw.shiftSeconds = 0; }
      if (c)  { c.name = lineData.c.name;   c.num = lineData.c.num;   c.energy = 96; c.shiftSeconds = 0; }
      if (rw) { rw.name = lineData.rw.name; rw.num = lineData.rw.num; rw.energy = 96; rw.shiftSeconds = 0; }
      addCommentary("STRIEDANIE 🔄", "border-red-500", "bg-red-500/20 text-red-300", `${homeTeamName} posiela na ľad ${lineNum}. útočnú formáciu.`);
    } else {
      setActiveAwayLine(lineNum);
      activeAwayLineRef.current = lineNum;
      awayShiftTimerRef.current = 0;
      const lines = awayForwardLinesRef.current;
      const lineData = lines[lineNum - 1] || lines[0] || AWAY_FORWARD_LINES[0];
      const lw = playersRef.current.find((p) => p.id === "away-lw");
      const c  = playersRef.current.find((p) => p.id === "away-c");
      const rw = playersRef.current.find((p) => p.id === "away-rw");
      if (lw) { lw.name = lineData.lw.name; lw.num = lineData.lw.num; lw.energy = 96; lw.shiftSeconds = 0; }
      if (c)  { c.name = lineData.c.name;   c.num = lineData.c.num;   c.energy = 96; c.shiftSeconds = 0; }
      if (rw) { rw.name = lineData.rw.name; rw.num = lineData.rw.num; rw.energy = 96; rw.shiftSeconds = 0; }
      addCommentary("STRIEDANIE 🔄", "border-sky-500", "bg-sky-500/20 text-sky-300", `${awayTeamName} posiela na ľad ${lineNum}. útočnú formáciu.`);
    }
  }, [homeTeamName, awayTeamName, addCommentary]);

  // Process real match live events if connected to engine
  const seenEventSeqsRef = useRef<Set<number>>(new Set());
  useEffect(() => {
    if (standaloneControls || !events?.length) return;
    for (const ev of events) {
      if (seenEventSeqsRef.current.has(ev.seq)) continue;
      seenEventSeqsRef.current.add(ev.seq);

      if (ev.type === "GOAL") {
        playSound("horn");
        const tCode = ev.teamCode || (ev.teamId ? "TÍM" : "");
        const scorer = ev.playerName || "Hráč";
        setGoalOverlay({ visible: true, text: `🚨 GÓÓÓL! ${scorer.toUpperCase()} ${tCode ? `(${tCode})` : ""}` });
        setTimeout(() => setGoalOverlay({ visible: false, text: "" }), 3000);
        addCommentary("GÓL 🚨", "border-red-500", "bg-red-600 text-white font-black", `${scorer} ${tCode ? `(${tCode})` : ""} dáva gól!`);
        // Fresh lines after goal
        const nextHome = (activeHomeLineRef.current % 4) + 1;
        const nextAway = (activeAwayLineRef.current % 4) + 1;
        switchForwardLine("home", nextHome);
        switchForwardLine("away", nextAway);
      } else if (ev.type === "SHOT" || ev.type === "SAVE") {
        playSound("shot");
        if (ev.playerName) {
          addCommentary("STRELA ⚡", "border-sky-500", "bg-sky-500/20 text-sky-300", `${ev.playerName} zakončuje na bránku!`);
        }
      } else if (ev.type === "PENALTY") {
        addCommentary("TREST 🛑", "border-amber-500", "bg-amber-500/20 text-amber-300", `Vylúčenie: ${ev.playerName || "Hráč"} (${ev.targetName || "2 min"})`);
      }
    }
  }, [events, standaloneControls, playSound, addCommentary, switchForwardLine]);

  // Goal trigger
  const triggerGoal = useCallback((scorerName?: string, teamName?: string) => {
    const sTeam = teamName || awayTeamName;
    const defaultScorer = awayForwardLinesRef.current[0]?.c?.name || "Útočník";
    const sName = scorerName || defaultScorer;
    setScoreAwayState((s) => s + 1);
    playSound("horn");

    setGoalOverlay({ visible: true, text: `GÓL! ${sName.toUpperCase()} (${sTeam})` });
    setTimeout(() => {
      setGoalOverlay({ visible: false, text: "" });
    }, 2600);

    addCommentary("GÓL 🚨", "border-red-500", "bg-red-600 text-white font-black", `${sName} (${sTeam}) posiela puk z prvej do šibenice!`);
    const nextHome = (activeHomeLineRef.current % 4) + 1;
    const nextAway = (activeAwayLineRef.current % 4) + 1;
    switchForwardLine("home", nextHome);
    switchForwardLine("away", nextAway);
  }, [awayTeamName, playSound, addCommentary, switchForwardLine]);

  // DRAW HOCKEY NET
  const drawGoalNet = (ctx: CanvasRenderingContext2D, gx: number, isLeft: boolean, w: number, h: number) => {
    const netDepth = w * 0.035;
    const mouthHalfH = h * 0.07;
    const yTop = h / 2 - mouthHalfH;
    const yBottom = h / 2 + mouthHalfH;
    const dir = isLeft ? -1 : 1;
    const backX = gx + (dir * netDepth);

    ctx.save();
    ctx.fillStyle = "rgba(0, 0, 0, 0.22)";
    ctx.beginPath();
    ctx.moveTo(gx, yTop);
    ctx.lineTo(backX, yTop + 3);
    ctx.lineTo(backX, yBottom - 3);
    ctx.lineTo(gx, yBottom);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "rgba(248, 250, 252, 0.45)";
    ctx.fillRect(isLeft ? backX : gx, yTop + 2, netDepth, (yBottom - yTop) - 4);

    ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
    ctx.lineWidth = 0.7;
    const gridStep = 4;
    for (let offset = -mouthHalfH * 2; offset <= mouthHalfH * 2 + netDepth; offset += gridStep) {
      ctx.beginPath();
      ctx.moveTo(gx, yTop + Math.max(0, -offset));
      ctx.lineTo(backX, yTop + Math.min(yBottom - yTop, offset + netDepth));
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(gx, yBottom - Math.max(0, -offset));
      ctx.lineTo(backX, yBottom - Math.min(yBottom - yTop, offset + netDepth));
      ctx.stroke();
    }

    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(backX, yTop + 4);
    ctx.lineTo(backX, yBottom - 4);
    ctx.stroke();

    ctx.strokeStyle = "#dc2626";
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(gx, yTop);
    ctx.quadraticCurveTo(backX - (dir * 2), yTop + 1, backX, yTop + 4);
    ctx.lineTo(backX, yBottom - 4);
    ctx.quadraticCurveTo(backX - (dir * 2), yBottom - 1, gx, yBottom);
    ctx.stroke();

    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(gx, h / 2);
    ctx.lineTo(backX, h / 2);
    ctx.stroke();

    ctx.lineWidth = 3;
    ctx.strokeStyle = "#b91c1c";
    ctx.beginPath();
    ctx.moveTo(gx, yTop);
    ctx.lineTo(gx, yBottom);
    ctx.stroke();

    const drawPost = (py: number) => {
      ctx.fillStyle = "#dc2626";
      ctx.beginPath();
      ctx.arc(gx, py, 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.arc(gx - 0.5, py - 0.5, 1.2, 0, Math.PI * 2);
      ctx.stroke();
    };
    drawPost(yTop);
    drawPost(yBottom);
    ctx.restore();
  };

  // DRAW RINK
  const drawRink = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    ctx.save();
    const cornerRadius = h * 0.22;
    const puck = puckRef.current;

    const makeRinkPath = (offset: number) => {
      ctx.beginPath();
      ctx.moveTo(offset + cornerRadius, offset);
      ctx.lineTo(w - offset - cornerRadius, offset);
      ctx.arcTo(w - offset, offset, w - offset, offset + cornerRadius, cornerRadius);
      ctx.lineTo(w - offset, h - offset - cornerRadius);
      ctx.arcTo(w - offset, h - offset, w - offset - cornerRadius, h - offset, cornerRadius);
      ctx.lineTo(offset + cornerRadius, h - offset);
      ctx.arcTo(offset, h - offset, offset, h - offset - cornerRadius, cornerRadius);
      ctx.lineTo(offset, offset + cornerRadius);
      ctx.arcTo(offset, offset, offset + cornerRadius, offset, cornerRadius);
      ctx.closePath();
    };

    makeRinkPath(4);
    ctx.clip();

    // Ice Gradient
    const iceGrad = ctx.createLinearGradient(0, 0, 0, h);
    iceGrad.addColorStop(0, "#f8fafc");
    iceGrad.addColorStop(0.25, "#f1f5f9");
    iceGrad.addColorStop(0.5, "#e8eef5");
    iceGrad.addColorStop(0.75, "#f1f5f9");
    iceGrad.addColorStop(1, "#dce4ec");
    ctx.fillStyle = iceGrad;
    ctx.fillRect(0, 0, w, h);

    // Sheen
    const sheenGrad = ctx.createLinearGradient(w * 0.2, 0, w * 0.8, h);
    sheenGrad.addColorStop(0, "rgba(255, 255, 255, 0.4)");
    sheenGrad.addColorStop(0.5, "rgba(255, 255, 255, 0.05)");
    sheenGrad.addColorStop(1, "rgba(255, 255, 255, 0.35)");
    ctx.fillStyle = sheenGrad;
    ctx.fillRect(0, 0, w, h);

    // Skate trails
    ctx.strokeStyle = "rgba(255, 255, 255, 0.55)";
    ctx.lineWidth = 1.2;
    for (const tr of skateTrailsRef.current) {
      ctx.beginPath();
      ctx.arc(tr.x * w, tr.y * h, 1.2, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Active zone tint
    if (puck.x > 0.65) {
      ctx.fillStyle = "rgba(56, 189, 248, 0.08)";
      ctx.fillRect(w * 0.65, 0, w * 0.35, h);
    } else if (puck.x >= 0.35 && puck.x <= 0.65) {
      ctx.fillStyle = "rgba(234, 179, 8, 0.06)";
      ctx.fillRect(w * 0.35, 0, w * 0.30, h);
    } else {
      ctx.fillStyle = "rgba(59, 130, 246, 0.06)";
      ctx.fillRect(0, 0, w * 0.35, h);
    }

    // Center Red Line
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#dc2626";
    ctx.beginPath();
    ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h);
    ctx.stroke();

    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "#ffffff";
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h);
    ctx.stroke();
    ctx.setLineDash([]);

    // Center Ice Home Logo
    const centerCircleRadius = h * 0.18;
    const logoSize = centerCircleRadius * 1.7;
    if (centerLogoRef.current && centerLogoRef.current.complete) {
      ctx.save();
      ctx.globalAlpha = 0.78;
      ctx.drawImage(centerLogoRef.current, (w / 2) - (logoSize / 2), (h / 2) - (logoSize / 2), logoSize, logoSize);
      ctx.restore();
    }

    ctx.lineWidth = 2.4;
    ctx.strokeStyle = "#2563eb";
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, centerCircleRadius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = "#2563eb";
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // Blue lines
    ctx.lineWidth = 5;
    ctx.strokeStyle = "#1d4ed8";
    ctx.beginPath();
    ctx.moveTo(w * 0.35, 0); ctx.lineTo(w * 0.35, h);
    ctx.moveTo(w * 0.65, 0); ctx.lineTo(w * 0.65, h);
    ctx.stroke();

    // Goal lines
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = "#dc2626";
    ctx.beginPath();
    ctx.moveTo(w * 0.08, 0); ctx.lineTo(w * 0.08, h);
    ctx.moveTo(w * 0.92, 0); ctx.lineTo(w * 0.92, h);
    ctx.stroke();

    // Creases
    ctx.fillStyle = "rgba(186, 230, 253, 0.7)";
    ctx.strokeStyle = "#dc2626";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(w * 0.08, h / 2, h * 0.09, -Math.PI / 2, Math.PI / 2);
    ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.arc(w * 0.92, h / 2, h * 0.09, Math.PI / 2, -Math.PI / 2);
    ctx.fill(); ctx.stroke();

    // Nets
    drawGoalNet(ctx, w * 0.08, true, w, h);
    drawGoalNet(ctx, w * 0.92, false, w, h);

    // Faceoff circles
    const drawFaceoff = (cx: number, cy: number) => {
      ctx.strokeStyle = "#dc2626";
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(cx, cy, h * 0.16, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "#dc2626";
      ctx.beginPath();
      ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
      ctx.fill();
    };
    drawFaceoff(w * 0.18, h * 0.28);
    drawFaceoff(w * 0.18, h * 0.72);
    drawFaceoff(w * 0.82, h * 0.28);
    drawFaceoff(w * 0.82, h * 0.72);

    ctx.restore();

    // Boards & Kickplate
    ctx.save();
    makeRinkPath(4);
    ctx.lineWidth = 6;
    ctx.strokeStyle = "#64748b";
    ctx.stroke();

    makeRinkPath(6);
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = "#eab308";
    ctx.stroke();
    ctx.restore();
  };

  // MAIN SIMULATION UPDATE
  const updateSim = useCallback((dt: number) => {
    if (!isPlaying) return;

    globalSimTimeRef.current += dt * simSpeed;
    phaseTimeRef.current += dt * simSpeed;
    const gameTime = globalSimTimeRef.current;
    const puck = puckRef.current;
    const players = playersRef.current;

    // Fatigue & Shift timers
    const drain = (isShortenBench ? 0.07 : 0.035) * simSpeed;
    players.forEach((p) => {
      if (!p.isGoalie) {
        p.energy = Math.max(25, p.energy - (drain * dt));
        p.shiftSeconds += dt * simSpeed;
      }
    });

    // Automatic forward line rotations (every ~38-42s of game time)
    homeShiftTimerRef.current += dt * simSpeed;
    awayShiftTimerRef.current += dt * simSpeed;
    if (homeShiftTimerRef.current >= 42) {
      const nextHome = (activeHomeLineRef.current % 4) + 1;
      switchForwardLine("home", nextHome);
    }
    if (awayShiftTimerRef.current >= 38) {
      const nextAway = (activeAwayLineRef.current % 4) + 1;
      switchForwardLine("away", nextAway);
    }

    const awayLw = players.find((p) => p.id === "away-lw")!;
    const awayC  = players.find((p) => p.id === "away-c")!;
    const awayRw = players.find((p) => p.id === "away-rw")!;
    const awayLd = players.find((p) => p.id === "away-ld")!;
    const awayRd = players.find((p) => p.id === "away-rd")!;
    const awayG  = players.find((p) => p.id === "away-g")!;

    const homeLw = players.find((p) => p.id === "home-lw")!;
    const homeC  = players.find((p) => p.id === "home-c")!;
    const homeRw = players.find((p) => p.id === "home-rw")!;
    const homeLd = players.find((p) => p.id === "home-ld")!;
    const homeRd = players.find((p) => p.id === "home-rd")!;
    const homeG  = players.find((p) => p.id === "home-g")!;

    // Goalie tracking (both nets)
    if (homeG) {
      if (!isPullGoalie) {
        homeG.targetX = 0.915;
        homeG.targetY = 0.50 + Math.max(-0.06, Math.min(0.06, (puck.y - 0.50) * 0.55));
      } else {
        homeG.targetX = 0.98;
        homeG.targetY = 0.50;
      }
    }
    if (awayG) {
      awayG.targetX = 0.085;
      awayG.targetY = 0.50 + Math.max(-0.06, Math.min(0.06, (puck.y - 0.50) * 0.55));
    }

    // ==========================================
    // AUTHENTIC CONTINUOUS TWO-WAY HOCKEY GAMEPLAY FLOW
    // ==========================================
    if (phaseRef.current === "NEUTRAL") {
      setZoneText("⚡ BOJ V STREDNOM PÁSME (NEUTRAL ZONE TRANSITION)");
      // Continuous neutral zone motion
      awayC.targetX = 0.48 + Math.sin(gameTime * 1.6) * 0.05;  awayC.targetY = 0.50 + Math.cos(gameTime * 1.2) * 0.06;
      awayLw.targetX = 0.44 + Math.cos(gameTime * 1.4) * 0.04; awayLw.targetY = 0.28 + Math.sin(gameTime * 1.5) * 0.05;
      awayRw.targetX = 0.44 + Math.sin(gameTime * 1.4) * 0.04; awayRw.targetY = 0.72 + Math.cos(gameTime * 1.5) * 0.05;
      awayLd.targetX = 0.30 + Math.sin(gameTime * 1.0) * 0.03; awayLd.targetY = 0.35 + Math.cos(gameTime * 1.2) * 0.04;
      awayRd.targetX = 0.30 + Math.cos(gameTime * 1.0) * 0.03; awayRd.targetY = 0.65 + Math.sin(gameTime * 1.2) * 0.04;

      homeC.targetX = 0.52 + Math.cos(gameTime * 1.6) * 0.05;  homeC.targetY = 0.50 + Math.sin(gameTime * 1.2) * 0.06;
      homeLw.targetX = 0.56 + Math.sin(gameTime * 1.4) * 0.04; homeLw.targetY = 0.30 + Math.cos(gameTime * 1.5) * 0.05;
      homeRw.targetX = 0.56 + Math.cos(gameTime * 1.4) * 0.04; homeRw.targetY = 0.70 + Math.sin(gameTime * 1.5) * 0.05;
      homeLd.targetX = 0.70 + Math.cos(gameTime * 1.0) * 0.03; homeLd.targetY = 0.36 + Math.sin(gameTime * 1.2) * 0.04;
      homeRd.targetX = 0.70 + Math.sin(gameTime * 1.0) * 0.03; homeRd.targetY = 0.64 + Math.cos(gameTime * 1.2) * 0.04;

      if (phaseTimeRef.current > 2.2) {
        if (Math.random() < 0.5) {
          puck.mode = "CARRIED";
          puck.carrierId = "away-lw";
          phaseRef.current = "AWAY_RUSH";
          phaseTimeRef.current = 0;
          addCommentary("PRECHOD DO PÁSMA", "border-sky-500", "bg-sky-500/20 text-sky-300", `${awayTeamName} rozbieha útok a zaváža puk do pásma.`);
        } else {
          puck.mode = "CARRIED";
          puck.carrierId = "home-lw";
          phaseRef.current = "HOME_RUSH";
          phaseTimeRef.current = 0;
          addCommentary("PRECHOD DO PÁSMA", "border-red-500", "bg-red-500/20 text-red-300", `${homeTeamName} získava puk a vyráža do útoku.`);
        }
      }
    } else if (phaseRef.current === "AWAY_RUSH") {
      setZoneText(`⚡ RÝCHLY PRECHOD ${awayTeamName.toUpperCase()} DO PÁSMA`);
      const rushProgress = Math.min(1.0, phaseTimeRef.current / 3.0);

      // Carrier progressively leads the rush from neutral zone (0.42) into offensive zone (0.84)
      awayLw.targetX = 0.42 + rushProgress * 0.42;
      awayLw.targetY = 0.32 + Math.sin(rushProgress * Math.PI) * 0.12;

      // Supporting forwards skate with him
      awayC.targetX = 0.38 + rushProgress * 0.40;
      awayC.targetY = 0.50 + Math.cos(gameTime * 2.5) * 0.05;
      awayRw.targetX = 0.40 + rushProgress * 0.42;
      awayRw.targetY = 0.68 + Math.sin(gameTime * 2.5) * 0.05;

      // Defensemen follow up
      awayLd.targetX = 0.28 + rushProgress * 0.38;
      awayLd.targetY = 0.34;
      awayRd.targetX = 0.28 + rushProgress * 0.38;
      awayRd.targetY = 0.66;

      // Home defenders retreat / backskate with gap control
      homeLd.targetX = Math.max(0.74, 0.58 + rushProgress * 0.24);
      homeLd.targetY = 0.38;
      homeRd.targetX = Math.max(0.74, 0.58 + rushProgress * 0.24);
      homeRd.targetY = 0.62;
      homeC.targetX = Math.max(0.68, 0.52 + rushProgress * 0.22);
      homeC.targetY = 0.50;
      homeLw.targetX = Math.max(0.66, 0.50 + rushProgress * 0.20);
      homeLw.targetY = 0.32;
      homeRw.targetX = Math.max(0.66, 0.50 + rushProgress * 0.20);
      homeRw.targetY = 0.68;

      if (rushProgress >= 1.0) {
        phaseRef.current = "AWAY_OZONE";
        cycleStepRef.current = 0;
        phaseTimeRef.current = 0;
      }
    } else if (phaseRef.current === "AWAY_OZONE") {
      setZoneText(`🔄 ${awayTeamName.toUpperCase()} TLAK V ÚTOČNOM PÁSME`);
      // Defensemen actively walk the blue line
      awayLd.targetX = 0.68 + Math.sin(gameTime * 1.2) * 0.02;
      awayLd.targetY = 0.33 + Math.cos(gameTime * 1.5) * 0.06;
      awayRd.targetX = 0.68 + Math.cos(gameTime * 1.2) * 0.02;
      awayRd.targetY = 0.67 + Math.sin(gameTime * 1.5) * 0.06;

      // Defending players shadow and collapse
      homeLd.targetX = 0.85 + Math.sin(gameTime * 1.4) * 0.02;
      homeLd.targetY = 0.38 + (puck.y - 0.5) * 0.25;
      homeRd.targetX = 0.85 + Math.cos(gameTime * 1.4) * 0.02;
      homeRd.targetY = 0.62 + (puck.y - 0.5) * 0.25;
      homeLw.targetX = 0.76; homeLw.targetY = 0.38;
      homeRw.targetX = 0.76; homeRw.targetY = 0.62;
      homeC.targetX = Math.min(0.85, Math.max(0.75, puck.x - 0.04));
      homeC.targetY = puck.y;

      if (cycleStepRef.current === 0) {
        // Continuous curve/cycle in corner
        awayLw.targetX = 0.86 + Math.cos(gameTime * 2.0) * 0.06;
        awayLw.targetY = 0.28 + Math.sin(gameTime * 2.0) * 0.08;
        awayC.targetX = 0.80 + Math.sin(gameTime * 1.8) * 0.04;
        awayC.targetY = 0.48;
        awayRw.targetX = 0.84 + Math.cos(gameTime * 1.8) * 0.04;
        awayRw.targetY = 0.70;

        if (phaseTimeRef.current > 2.2) {
          puck.mode = "PASS_FLIGHT";
          puck.passFromX = puck.x; puck.passFromY = puck.y;
          puck.passToX = awayRw.x; puck.passToY = awayRw.y;
          puck.passProgress = 0; puck.passDuration = 0.55;
          puck.passReceiverId = "away-rw";
          playSound("pass");
          addCommentary("PRIHRÁVKA", "border-sky-500", "bg-sky-500/20 text-sky-300", `${awayTeamName} kombinuje v útočnom pásme.`);
          cycleStepRef.current = 1; phaseTimeRef.current = 0;
        }
      } else if (cycleStepRef.current === 1) {
        // Continuous movement along boards to slot
        awayRw.targetX = 0.82 + Math.sin(gameTime * 2.0) * 0.04;
        awayRw.targetY = 0.66 + Math.cos(gameTime * 2.0) * 0.06;
        awayC.targetX = 0.78 + Math.cos(gameTime * 2.2) * 0.05;
        awayC.targetY = 0.50 + Math.sin(gameTime * 2.2) * 0.04;
        awayLw.targetX = 0.88; awayLw.targetY = 0.35;

        if (phaseTimeRef.current > 1.8) {
          puck.mode = "PASS_FLIGHT";
          puck.passFromX = puck.x; puck.passFromY = puck.y;
          puck.passToX = awayC.x; puck.passToY = awayC.y;
          puck.passProgress = 0; puck.passDuration = 0.45;
          puck.passReceiverId = "away-c";
          playSound("pass");
          addCommentary("ŠANCA 🔥", "border-emerald-500", "bg-emerald-500/20 text-emerald-300", `Prihrávka medzi kruhy, ${awayTeamName} sa dostáva do zakončenia!`);
          cycleStepRef.current = 2; phaseTimeRef.current = 0;
        }
      } else if (cycleStepRef.current === 2) {
        awayC.targetX = 0.82; awayC.targetY = 0.50;
        if (phaseTimeRef.current > 0.9) {
          puck.mode = "SHOT_FLIGHT";
          puck.passFromX = puck.x; puck.passFromY = puck.y;
          puck.passToX = 0.92; puck.passToY = 0.48 + (Math.random() - 0.5) * 0.07;
          puck.passProgress = 0; puck.passDuration = 0.32;
          puck.passReceiverId = null;
          playSound("shot");
          setShotAlertVisible(true);
          setTimeout(() => setShotAlertVisible(false), 1200);
          phaseRef.current = "AWAY_SHOT";
          phaseTimeRef.current = 0;
        }
      }
    } else if (phaseRef.current === "AWAY_SHOT") {
      if (puck.mode === "REBOUND" || phaseTimeRef.current > 1.0) {
        phaseRef.current = "HOME_RUSH";
        puck.mode = "CARRIED";
        puck.carrierId = "home-c";
        phaseTimeRef.current = 0;
        addCommentary("ZÁKROK & BREJK ⚡", "border-red-500", "bg-red-500/20 text-red-300", `${homeTeamName} získava puk a vyráža do protiútoku!`);
      }
    } else if (phaseRef.current === "HOME_RUSH") {
      setZoneText(`⚡ RÝCHLY PRECHOD ${homeTeamName.toUpperCase()} DO PÁSMA`);
      const rushProgress = Math.min(1.0, phaseTimeRef.current / 3.0);

      // Home carrier leads the rush across center ice (0.58) down to offensive zone (0.16)
      homeC.targetX = 0.58 - rushProgress * 0.42;
      homeC.targetY = 0.48 + Math.sin(rushProgress * Math.PI) * 0.12;

      // Supporting forwards
      homeLw.targetX = 0.62 - rushProgress * 0.42;
      homeLw.targetY = 0.32 + Math.cos(gameTime * 2.5) * 0.05;
      homeRw.targetX = 0.60 - rushProgress * 0.40;
      homeRw.targetY = 0.68 + Math.sin(gameTime * 2.5) * 0.05;

      // Home defense follows up
      homeLd.targetX = 0.72 - rushProgress * 0.38;
      homeLd.targetY = 0.35;
      homeRd.targetX = 0.72 - rushProgress * 0.38;
      homeRd.targetY = 0.65;

      // Away defenders backskate with gap control
      awayLd.targetX = Math.min(0.26, 0.42 - rushProgress * 0.24);
      awayLd.targetY = 0.38;
      awayRd.targetX = Math.min(0.26, 0.42 - rushProgress * 0.24);
      awayRd.targetY = 0.62;
      awayC.targetX = Math.min(0.32, 0.48 - rushProgress * 0.22);
      awayC.targetY = 0.50;
      awayLw.targetX = Math.min(0.34, 0.50 - rushProgress * 0.20);
      awayLw.targetY = 0.32;
      awayRw.targetX = Math.min(0.34, 0.50 - rushProgress * 0.20);
      awayRw.targetY = 0.68;

      if (rushProgress >= 1.0) {
        phaseRef.current = "HOME_OZONE";
        cycleStepRef.current = 0;
        phaseTimeRef.current = 0;
      }
    } else if (phaseRef.current === "HOME_OZONE") {
      setZoneText(`🔄 ${homeTeamName.toUpperCase()} TLAK V ÚTOČNOM PÁSME`);
      // Defensemen walk blue line
      homeLd.targetX = 0.32 + Math.sin(gameTime * 1.2) * 0.02;
      homeLd.targetY = 0.33 + Math.cos(gameTime * 1.5) * 0.06;
      homeRd.targetX = 0.32 + Math.cos(gameTime * 1.2) * 0.02;
      homeRd.targetY = 0.67 + Math.sin(gameTime * 1.5) * 0.06;

      // Away defenders collapse towards slot
      awayLd.targetX = 0.15 + Math.sin(gameTime * 1.4) * 0.02;
      awayLd.targetY = 0.38 + (puck.y - 0.5) * 0.25;
      awayRd.targetX = 0.15 + Math.cos(gameTime * 1.4) * 0.02;
      awayRd.targetY = 0.62 + (puck.y - 0.5) * 0.25;
      awayLw.targetX = 0.24; awayLw.targetY = 0.38;
      awayRw.targetX = 0.24; awayRw.targetY = 0.62;
      awayC.targetX = Math.max(0.15, Math.min(0.25, puck.x + 0.04));
      awayC.targetY = puck.y;

      if (cycleStepRef.current === 0) {
        homeLw.targetX = 0.14 + Math.cos(gameTime * 2.0) * 0.06;
        homeLw.targetY = 0.28 + Math.sin(gameTime * 2.0) * 0.08;
        homeC.targetX = 0.20 + Math.sin(gameTime * 1.8) * 0.04;
        homeC.targetY = 0.48;
        homeRw.targetX = 0.16 + Math.cos(gameTime * 1.8) * 0.04;
        homeRw.targetY = 0.70;

        if (phaseTimeRef.current > 2.2) {
          puck.mode = "PASS_FLIGHT";
          puck.passFromX = puck.x; puck.passFromY = puck.y;
          puck.passToX = homeRw.x; puck.passToY = homeRw.y;
          puck.passProgress = 0; puck.passDuration = 0.55;
          puck.passReceiverId = "home-rw";
          playSound("pass");
          addCommentary("PRIHRÁVKA", "border-red-500", "bg-red-500/20 text-red-300", `${homeTeamName} roztočil kolotoč v útočnom pásme.`);
          cycleStepRef.current = 1; phaseTimeRef.current = 0;
        }
      } else if (cycleStepRef.current === 1) {
        homeRw.targetX = 0.18 + Math.sin(gameTime * 2.0) * 0.04;
        homeRw.targetY = 0.66 + Math.cos(gameTime * 2.0) * 0.06;
        homeC.targetX = 0.22 + Math.cos(gameTime * 2.2) * 0.05;
        homeC.targetY = 0.50 + Math.sin(gameTime * 2.2) * 0.04;
        homeLw.targetX = 0.12; homeLw.targetY = 0.35;

        if (phaseTimeRef.current > 1.8) {
          puck.mode = "PASS_FLIGHT";
          puck.passFromX = puck.x; puck.passFromY = puck.y;
          puck.passToX = homeC.x; puck.passToY = homeC.y;
          puck.passProgress = 0; puck.passDuration = 0.45;
          puck.passReceiverId = "home-c";
          playSound("pass");
          addCommentary("ŠANCA 🔥", "border-amber-500", "bg-amber-500/20 text-amber-300", `Krásna prihrávka pred bránku, ${homeTeamName} v obrovskej šanci!`);
          cycleStepRef.current = 2; phaseTimeRef.current = 0;
        }
      } else if (cycleStepRef.current === 2) {
        homeC.targetX = 0.18; homeC.targetY = 0.50;
        if (phaseTimeRef.current > 0.9) {
          puck.mode = "SHOT_FLIGHT";
          puck.passFromX = puck.x; puck.passFromY = puck.y;
          puck.passToX = 0.08; puck.passToY = 0.48 + (Math.random() - 0.5) * 0.07;
          puck.passProgress = 0; puck.passDuration = 0.32;
          puck.passReceiverId = null;
          playSound("shot");
          setShotAlertVisible(true);
          setTimeout(() => setShotAlertVisible(false), 1200);
          phaseRef.current = "HOME_SHOT";
          phaseTimeRef.current = 0;
        }
      }
    } else if (phaseRef.current === "HOME_SHOT") {
      if (puck.mode === "REBOUND" || phaseTimeRef.current > 1.0) {
        phaseRef.current = "AWAY_RUSH";
        puck.mode = "CARRIED";
        puck.carrierId = "away-c";
        phaseTimeRef.current = 0;
        addCommentary("ZÁKROK 🛑", "border-blue-500", "bg-blue-500/20 text-blue-300", `Brankár ${awayTeamName} vyráža puk, protiútok ${awayTeamName}!`);
      }
    }

    // Kinematics with authentic skating momentum, acceleration & gliding inertia
    players.forEach((p) => {
      const maxSpeed = (p.isGoalie ? 0.18 : p.speed) * (0.75 + 0.25 * (p.energy / 100)) * simSpeed;
      const dx = p.targetX - p.x;
      const dy = p.targetY - p.y;
      const dist = Math.hypot(dx, dy);

      // Desired velocity towards target with smooth easing
      const desiredSpeed = Math.min(maxSpeed, dist * 3.5);
      const targetVx = dist > 0.001 ? (dx / dist) * desiredSpeed : 0;
      const targetVy = dist > 0.001 ? (dy / dist) * desiredSpeed : 0;

      // Skating inertia (smooth acceleration and continuous gliding)
      const accel = p.isGoalie ? 8.0 : 5.5;
      p.vx = (p.vx || 0) + (targetVx - (p.vx || 0)) * Math.min(1, accel * dt);
      p.vy = (p.vy || 0) + (targetVy - (p.vy || 0)) * Math.min(1, accel * dt);

      p.x += (p.vx || 0) * dt;
      p.y += (p.vy || 0) * dt;

      // Keep within rink boards
      p.x = Math.max(0.04, Math.min(0.96, p.x));
      p.y = Math.max(0.06, Math.min(0.94, p.y));

      const currentSpeed = Math.hypot(p.vx || 0, p.vy || 0);
      if (currentSpeed > 0.02) {
        // Smooth body banking into turns
        const targetAngle = Math.atan2(p.vy || 0, p.vx || 0);
        let diff = targetAngle - p.angle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        p.angle += diff * Math.min(1, 10 * dt);
      } else if (dist > 0.01) {
        p.angle = Math.atan2(dy, dx);
      }

      if (currentSpeed > 0.06 && Math.random() < 0.20 * simSpeed) {
        skateTrailsRef.current.push({ x: p.x, y: p.y });
        if (skateTrailsRef.current.length > 150) skateTrailsRef.current.shift();
      }
    });

    // Puck Physics with stick handling
    if (puck.mode === "CARRIED") {
      const carrier = players.find((p) => p.id === puck.carrierId);
      if (carrier) {
        const stickDist = 0.018;
        const targetPuckX = carrier.x + Math.cos(carrier.angle) * stickDist;
        const targetPuckY = carrier.y + Math.sin(carrier.angle) * stickDist;
        const wobble = Math.sin(gameTime * 8) * 0.002;
        puck.x += (targetPuckX - puck.x) * Math.min(1, 16 * dt);
        puck.y += (targetPuckY + wobble - puck.y) * Math.min(1, 16 * dt);
        const teamLabel = carrier.team === "away" ? awayTeamName : homeTeamName;
        setPuckCarrierName(`${carrier.name} (${teamLabel})`);
      }
    } else if (puck.mode === "PASS_FLIGHT") {
      puck.passProgress += (dt * simSpeed) / puck.passDuration;
      const t = Math.min(1.0, puck.passProgress);
      const ease = 1 - Math.pow(1 - t, 2.5);
      puck.x = puck.passFromX + (puck.passToX - puck.passFromX) * ease;
      puck.y = puck.passFromY + (puck.passToY - puck.passFromY) * ease;

      if (t >= 1.0) {
        puck.mode = "CARRIED";
        puck.carrierId = puck.passReceiverId;
        const recv = players.find((p) => p.id === puck.passReceiverId);
        if (recv) {
          const teamLabel = recv.team === "away" ? awayTeamName : homeTeamName;
          setPuckCarrierName(`${recv.name} (${teamLabel})`);
        }
        playSound("receive");
      }
    } else if (puck.mode === "SHOT_FLIGHT") {
      puck.passProgress += (dt * simSpeed) / puck.passDuration;
      const t = Math.min(1.0, puck.passProgress);
      puck.x = puck.passFromX + (puck.passToX - puck.passFromX) * t;
      puck.y = puck.passFromY + (puck.passToY - puck.passFromY) * t;

      if (t >= 1.0) {
        // Only increment local mock shots if in standalone sandbox mode
        if (standaloneControls) {
          if (puck.passToX > 0.5) setSogAwayState((s) => s + 1);
          else setSogHomeState((s) => s + 1);
        }
        playSound("post");
        puck.mode = "REBOUND";
        puck.reboundVx = (puck.passToX > 0.5 ? -1 : 1) * (0.18 + Math.random() * 0.10);
        puck.reboundVy = (Math.random() - 0.5) * 0.30;
      }
    } else if (puck.mode === "REBOUND") {
      puck.x += puck.reboundVx * dt * simSpeed;
      puck.y += puck.reboundVy * dt * simSpeed;
      puck.reboundVx *= Math.pow(0.92, dt * 60);
      puck.reboundVy *= Math.pow(0.92, dt * 60);
    }

    // Game Clock (only run mock clock in standalone sandbox)
    if (standaloneControls) {
      clockTimerRef.current += dt * simSpeed;
      if (clockTimerRef.current >= 1.0) {
        clockTimerRef.current = 0;
        setGameClockSeconds((sec) => Math.max(0, sec - 1));
      }
    }
  }, [isPlaying, simSpeed, isShortenBench, isPullGoalie, playSound, addCommentary, triggerGoal, standaloneControls, awayTeamName, homeTeamName, switchForwardLine]);

  // ANIMATION LOOP
  useEffect(() => {
    let lastTime = performance.now();

    const render = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.05) || 0.016;
      lastTime = now;

      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          const w = canvas.width / (window.devicePixelRatio || 1);
          const h = canvas.height / (window.devicePixelRatio || 1);

          ctx.clearRect(0, 0, w, h);
          drawRink(ctx, w, h);

          if (isPlaying) {
            updateSim(dt);
          }

          const players = playersRef.current;
          const puck = puckRef.current;

          // Draw Skaters
          players.forEach((p) => {
            if (p.id === "home-g" && isPullGoalie) return;
            if (p.id === "home-extra" && !isPullGoalie) return;

            const sx = p.x * w;
            const sy = p.y * h;
            const radius = p.isGoalie ? 11 : 9;

            // Energy Ring
            if (!p.isGoalie) {
              const energyPct = p.energy / 100;
              ctx.strokeStyle = energyPct < 0.5 ? "#ef4444" : energyPct < 0.75 ? "#f59e0b" : "#10b981";
              ctx.lineWidth = 2.4;
              ctx.beginPath();
              ctx.arc(sx, sy, radius + 3.5, -Math.PI / 2, (-Math.PI / 2) + (Math.PI * 2 * energyPct));
              ctx.stroke();
            }

            // Puck-Carrier Ring
            if (puck.carrierId === p.id && puck.mode === "CARRIED") {
              ctx.strokeStyle = "rgba(251, 191, 36, 0.85)";
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.arc(sx, sy, radius + 7, 0, Math.PI * 2);
              ctx.stroke();
            }

            // Stick Blade
            if (!p.isGoalie) {
              const stickLength = 14;
              const stickAngle = (puck.carrierId === p.id) ? p.angle : Math.atan2((puck.y * h) - sy, (puck.x * w) - sx);
              const stickX = sx + Math.cos(stickAngle) * stickLength;
              const stickY = sy + Math.sin(stickAngle) * stickLength;

              ctx.strokeStyle = "#1e293b";
              ctx.lineWidth = 2.2;
              ctx.beginPath();
              ctx.moveTo(sx, sy);
              ctx.lineTo(stickX, stickY);
              ctx.stroke();

              ctx.fillStyle = "#0f172a";
              ctx.beginPath();
              ctx.arc(stickX, stickY, 2.2, 0, Math.PI * 2);
              ctx.fill();
            }

            // Shadow
            ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
            ctx.beginPath();
            ctx.arc(sx + 1.5, sy + 2.5, radius, 0, Math.PI * 2);
            ctx.fill();

            // Jersey Circle
            ctx.fillStyle = p.team === "away" ? "#1d4ed8" : "#dc2626";
            if (p.role === "EA") ctx.fillStyle = "#d97706";
            ctx.beginPath();
            ctx.arc(sx, sy, radius, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = "#ffffff";
            ctx.lineWidth = 2;
            ctx.stroke();

            // Number
            ctx.fillStyle = "#ffffff";
            ctx.font = "bold 8.5px monospace";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(p.num, sx, sy);

            // Floating Name Badge
            ctx.fillStyle = "rgba(10, 18, 32, 0.94)";
            ctx.fillRect(sx - 24, sy - radius - 13, 48, 12);
            ctx.strokeStyle = "rgba(255, 255, 255, 0.18)";
            ctx.lineWidth = 0.8;
            ctx.strokeRect(sx - 24, sy - radius - 13, 48, 12);

            ctx.fillStyle = p.team === "away" ? "#93c5fd" : "#fca5a5";
            ctx.font = "bold 7.5px sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(`${p.name} ${Math.round(p.energy)}%`, sx, sy - radius - 7);
          });

          // Draw Puck
          const px = puck.x * w;
          const py = puck.y * h;
          ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
          ctx.beginPath();
          ctx.arc(px + 2, py + 2.5, 4.2, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = "#090d16";
          ctx.beginPath();
          ctx.arc(px, py, 4.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 1;
          ctx.stroke();

          // Flight Trail
          if (puck.mode === "SHOT_FLIGHT" || puck.mode === "PASS_FLIGHT") {
            ctx.strokeStyle = puck.mode === "SHOT_FLIGHT" ? "rgba(239, 68, 68, 0.6)" : "rgba(56, 189, 248, 0.5)";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(px, py);
            ctx.lineTo(puck.passFromX * w, puck.passFromY * h);
            ctx.stroke();
          }
        }
      }

      animFrameIdRef.current = requestAnimationFrame(render);
    };

    animFrameIdRef.current = requestAnimationFrame(render);

    return () => {
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
    };
  }, [drawRink, isPlaying, isPullGoalie, updateSim]);

  // RESIZE HANDLER
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (!canvas || !canvas.parentElement) return;
      const rect = canvas.parentElement.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.scale(dpr, dpr);
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Hover detection
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) / rect.width;
    const my = (e.clientY - rect.top) / rect.height;

    const found = playersRef.current.find((p) => {
      if (p.id === "home-g" && isPullGoalie) return false;
      if (p.id === "home-extra" && !isPullGoalie) return false;
      return Math.hypot(p.x - mx, p.y - my) < 0.035;
    });

    if (found) {
      setHoveredPlayer({ player: found, x: e.clientX - rect.left, y: e.clientY - rect.top });
    } else {
      setHoveredPlayer(null);
    }
  };

  const handleTimeout = () => {
    if (timeoutsLeft <= 0) return;
    setTimeoutsLeft(0);
    playersRef.current.forEach((p) => (p.energy = Math.min(100, p.energy + 20)));
    addCommentary("TIMEOUT ⏸️", "border-amber-500", "bg-amber-500/20 text-amber-300", "Tréner berie oddychový čas (V3 Momentum Reset úspešný, +20% energia hráčom).");
  };


  const clockMins = Math.floor(gameClockSeconds / 60);
  const clockSecs = (gameClockSeconds % 60).toString().padStart(2, "0");
  const displayClock = `${clockMins}:${clockSecs}`;

  const displayScoreAway = standaloneControls ? scoreAwayState : awayScore;
  const displayScoreHome = standaloneControls ? scoreHomeState : homeScore;
  const displaySogAway = standaloneControls ? sogAwayState : awaySog;
  const displaySogHome = standaloneControls ? sogHomeState : homeSog;
  const displayClockStr = standaloneControls ? displayClock : (clockStr || "20:00");
  const displayPeriodStr = standaloneControls ? periodStr : (periodStr || "1. Tretina");
  const displayXgAway = Math.max(0.05, displaySogAway * 0.075).toFixed(2);
  const displayXgHome = Math.max(0.05, displaySogHome * 0.075).toFixed(2);

  const awaySkaters = playersRef.current.filter((p) => p.team === "away" && !p.isGoalie);
  const homeSkaters = playersRef.current.filter((p) => p.team === "home" && !p.isGoalie && p.id !== "home-extra");

  return (
    <div className="w-full flex flex-col gap-3 font-sans select-none text-slate-100">
      {/* 1. TOP TICKER / SCOREBOARD */}
      <section className="w-full rounded-2xl bg-gradient-to-r from-[#0e2040] via-[#081328] to-[#2a0b12] border border-slate-700/80 p-4 shadow-xl">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Away Team */}
          <div className="flex items-center gap-3 w-full md:w-auto justify-start">
            <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-blue-500/60 p-2 flex items-center justify-center shadow-lg">
              <img src={awayLogoUrl} alt={awayTeamName} className="w-full h-full object-contain filter drop-shadow" />
            </div>
            <div>
              <h2 className="text-lg md:text-xl font-black text-white">{awayTeamName}</h2>
              <div className="flex items-center gap-2 text-xs text-slate-300 mt-1">
                <span className="bg-slate-900/80 px-2 py-0.5 rounded border border-slate-700">Strely: <strong className="text-white font-mono">{displaySogAway}</strong></span>
                <span className="bg-slate-900/80 px-2 py-0.5 rounded border border-slate-700">xG: <strong className="text-sky-300 font-mono">{displayXgAway}</strong></span>
              </div>
            </div>
          </div>

          {/* Score Capsule */}
          <div className="flex flex-col items-center justify-center">
            <div className="flex items-center gap-4">
              <span className="text-4xl md:text-6xl font-black font-mono tabular-nums text-white drop-shadow">{displayScoreAway}</span>
              <div className="flex flex-col items-center px-4 py-1.5 bg-[#01040a] rounded-xl border border-slate-700 shadow-inner">
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 animate-pulse">{displayPeriodStr}</span>
                <span className="font-mono text-2xl md:text-3xl font-black text-amber-400">{displayClockStr}</span>
              </div>
              <span className="text-4xl md:text-6xl font-black font-mono tabular-nums text-white drop-shadow">{displayScoreHome}</span>
            </div>
            <div className="mt-2 text-[11px] font-bold px-3 py-0.5 rounded-full bg-slate-900 border border-slate-700 text-slate-300">
              {isPullGoalie ? <span className="text-red-400 font-black animate-pulse">🚨 EMPTY NET (6 NA 5)</span> : "Rovnovážny stav 5 na 5"}
            </div>
          </div>

          {/* Home Team */}
          <div className="flex items-center gap-3 w-full md:w-auto justify-end text-right">
            <div>
              <h2 className="text-lg md:text-xl font-black text-white">{homeTeamName}</h2>
              <div className="flex items-center justify-end gap-2 text-xs text-slate-300 mt-1">
                <span className="bg-slate-900/80 px-2 py-0.5 rounded border border-slate-700">xG: <strong className="text-red-300 font-mono">{displayXgHome}</strong></span>
                <span className="bg-slate-900/80 px-2 py-0.5 rounded border border-slate-700">Strely: <strong className="text-white font-mono">{displaySogHome}</strong></span>
              </div>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-red-500/60 p-2 flex items-center justify-center shadow-lg">
              <img src={homeLogoUrl} alt={homeTeamName} className="w-full h-full object-contain filter drop-shadow" />
            </div>
          </div>
        </div>
      </section>

      {/* 2. TACTICAL SHORTCUTS & SIM CONTROLS */}
      {standaloneControls && (
        <nav className="w-full px-4 py-2 bg-slate-950/80 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center flex-wrap gap-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase mr-1">⚡ Taktika:</span>
            <button
              onClick={() => setIsShortenBench((v) => !v)}
              className={`px-3 py-1.5 rounded-lg border font-bold flex items-center gap-1.5 transition ${
                isShortenBench ? "bg-amber-950 border-amber-500 text-amber-300" : "bg-slate-900 border-slate-700 text-slate-300"
              }`}
            >
              <span>⏳ Skrátiť striedačku</span>
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800">{isShortenBench ? "3F/2D ON" : "OFF"}</span>
            </button>

            <button
              onClick={() => setIsPullGoalie((v) => !v)}
              className={`px-3 py-1.5 rounded-lg border font-bold flex items-center gap-1.5 transition ${
                isPullGoalie ? "bg-red-950 border-red-500 text-red-300 animate-pulse" : "bg-slate-900 border-slate-700 text-slate-300"
              }`}
            >
              <span>🥅 Odvolať brankára</span>
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800">{isPullGoalie ? "6v5" : "V bráne"}</span>
            </button>

            <button
              onClick={handleTimeout}
              disabled={timeoutsLeft <= 0}
              className={`px-3 py-1.5 rounded-lg border font-bold flex items-center gap-1.5 transition ${
                timeoutsLeft > 0 ? "bg-amber-950/50 border-amber-700 text-amber-300 hover:bg-amber-900/60" : "bg-slate-900 border-slate-800 text-slate-500"
              }`}
            >
              <span>⏸️ Time-out V3</span>
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800">{timeoutsLeft > 0 ? "1 zostáva" : "Vyčerpaný"}</span>
            </button>

            <button
              onClick={() => setTacticsDrawerOpen((v) => !v)}
              className="px-3 py-1.5 rounded-lg bg-indigo-950 border border-indigo-700 text-indigo-300 font-bold hover:bg-indigo-900 transition"
            >
              ⚙️ Zmena Formácií
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setAudioEnabled((v) => !v)}
              className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 hover:bg-slate-800 transition"
              title="Zvukové efekty zápasu"
            >
              {audioEnabled ? "🔊 Zvuk ZAP" : "🔇 Zvuk VYP"}
            </button>

            <button
              onClick={() => setIsPlaying((v) => !v)}
              className={`px-4 py-1.5 rounded-lg font-black text-white shadow transition ${
                isPlaying ? "bg-amber-600 hover:bg-amber-500" : "bg-emerald-600 hover:bg-emerald-500"
              }`}
            >
              {isPlaying ? "⏸ Pauza" : "▶ Spustiť"}
            </button>

            <div className="flex items-center bg-slate-900 rounded-lg p-0.5 border border-slate-800">
              {[1, 2, 4].map((sp) => (
                <button
                  key={sp}
                  onClick={() => setSimSpeed(sp)}
                  className={`px-2 py-1 rounded text-[11px] font-bold ${
                    simSpeed === sp ? "bg-slate-800 text-sky-400" : "text-slate-400 hover:text-white"
                  }`}
                >
                  {sp}x
                </button>
              ))}
            </div>

            <button
              onClick={() => triggerGoal()}
              className="px-3 py-1.5 rounded-lg bg-red-950/80 border border-red-700 text-red-200 font-bold hover:bg-red-900 transition"
            >
              🚨 Test Gól
            </button>
          </div>
        </nav>
      )}

      {/* 3. 3-COLUMN COCKPIT (AWAY BENCH, RINK, HOME BENCH) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">
        {/* Away Bench (3 cols) */}
        <aside className="lg:col-span-3 bg-slate-950/80 rounded-2xl p-3 border border-slate-800 shadow-xl flex flex-col gap-2.5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="text-xs font-black uppercase text-blue-400">{awayTeamName}</span>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800 font-bold">
                {activeAwayLine}. Útok
              </span>
              <div className="flex items-center gap-0.5 bg-slate-900 rounded p-0.5 border border-slate-800">
                {[1, 2, 3, 4].map((ln) => (
                  <button
                    key={ln}
                    onClick={() => switchForwardLine("away", ln)}
                    title={`Nasadiť ${ln}. útok ${awayTeamName}`}
                    className={`w-5 h-5 rounded text-[10px] font-bold transition flex items-center justify-center ${
                      activeAwayLine === ln
                        ? "bg-blue-600 text-white shadow"
                        : "text-slate-400 hover:text-white hover:bg-slate-800"
                    }`}
                  >
                    {ln}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="space-y-1.5 text-xs">
            {awaySkaters.map((p) => {
              const warn = Math.round(p.shiftSeconds) >= 45;
              const isFatigued = p.energy < 50;
              return (
                <div key={p.id} className="bg-slate-900/90 p-2 rounded-xl border border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded bg-blue-950 border border-blue-800 text-blue-300 font-mono font-bold text-[10px] flex items-center justify-center">
                      {p.num}
                    </span>
                    <div>
                      <div className="font-bold text-white text-[11px]">{p.name} <span className="text-slate-400 text-[10px]">{p.role}</span></div>
                      <div className="text-[9px] text-slate-400">
                        Striedanie: <span className={`font-mono font-bold ${warn ? "text-amber-400" : "text-slate-300"}`}>{Math.round(p.shiftSeconds)}s</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`text-[11px] font-black ${isFatigued ? "text-amber-400" : "text-emerald-400"}`}>{Math.round(p.energy)}%</span>
                    <div className="w-12 bg-slate-950 h-1.5 rounded-full overflow-hidden mt-0.5 border border-slate-800">
                      <div className={`${isFatigued ? "bg-amber-500" : "bg-emerald-500"} h-full`} style={{ width: `${p.energy}%` }}></div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        {/* Center: Rink & Commentary (6 cols) */}
        <section className="lg:col-span-6 flex flex-col gap-3">
          <div className="bg-slate-950/80 rounded-2xl p-3 border border-slate-800 shadow-xl flex flex-col items-center">
            <div className="w-full flex items-center justify-between px-2 mb-2 text-xs font-bold">
              <span className="text-blue-400">{awayTeamName} ➔</span>
              <span className="text-[11px] font-mono px-3 py-0.5 rounded-full bg-blue-950 text-sky-300 border border-blue-500">{zoneText}</span>
              <span className="text-red-400">⬅ {homeTeamName}</span>
            </div>

            {/* Rink Canvas Container */}
            <div className="relative w-full aspect-[2/1] max-h-[380px] rounded-2xl overflow-hidden border-2 border-slate-600/90 bg-[#e2e8f0] shadow-2xl">
              <canvas ref={canvasRef} onMouseMove={handleMouseMove} onMouseLeave={() => setHoveredPlayer(null)} className="w-full h-full block cursor-crosshair" />

              {/* Hover Tooltip */}
              {hoveredPlayer && (
                <div
                  className="absolute pointer-events-none px-2.5 py-1 rounded-xl bg-slate-950/95 border border-slate-700 text-xs shadow-2xl z-30 transform -translate-x-1/2 -translate-y-12"
                  style={{ left: hoveredPlayer.x, top: hoveredPlayer.y }}
                >
                  <div className="font-bold text-white whitespace-nowrap">
                    #{hoveredPlayer.player.num} {hoveredPlayer.player.name} ({hoveredPlayer.player.role})
                  </div>
                  <div className="text-[10px] text-slate-300 mt-0.5">
                    Energia: <strong className={hoveredPlayer.player.energy < 50 ? "text-amber-400" : "text-emerald-400"}>{Math.round(hoveredPlayer.player.energy)}%</strong> • Striedanie: {Math.round(hoveredPlayer.player.shiftSeconds)}s
                  </div>
                </div>
              )}

              {/* Goal Overlay */}
              {goalOverlay.visible && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 pointer-events-none z-20">
                  <div className="px-6 py-2.5 rounded-full bg-red-600 text-white font-black text-sm uppercase tracking-wider shadow-2xl border-2 border-red-300 animate-bounce">
                    🚨 {goalOverlay.text} 🚨
                  </div>
                </div>
              )}

              {/* Puck Carrier Pill */}
              <div className="absolute bottom-2.5 left-2.5 px-3 py-1 rounded-xl bg-slate-950/95 border border-slate-700 text-xs text-slate-200 flex items-center gap-1.5 shadow-xl">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
                <span>Puk: <strong className="text-white">{puckCarrierName}</strong></span>
              </div>

              {/* Shot Alert */}
              {shotAlertVisible && (
                <div className="absolute top-2.5 right-2.5 px-3 py-1 rounded-xl bg-red-950/95 border border-red-500 text-[11px] font-bold text-red-200 shadow-xl">
                  ⚡ NEBEZPEČNÁ STRELA (xG: 0.38)
                </div>
              )}
            </div>
          </div>

          {/* Commentary Feed */}
          <div className="bg-slate-950/80 rounded-2xl p-3 border border-slate-800 shadow-xl flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2 text-xs">
              <span className="font-bold uppercase tracking-wide text-slate-200">Komentár zápasu (Play-by-Play)</span>
              <span className="text-[10px] text-emerald-400 font-bold">● LIVE STREAM</span>
            </div>
            <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1 text-xs">
              {displayFeed.map((f) => (
                <div key={f.id} className={`p-2 rounded-xl bg-slate-900/90 border-l-4 ${f.border} flex items-start gap-2 shadow`}>
                  <span className="font-mono text-[11px] text-slate-400 pt-0.5 font-bold shrink-0">{f.time}</span>
                  <div>
                    <span className={`px-1.5 py-0.2 rounded ${f.bg} font-bold text-[9px] mr-1`}>{f.badge}</span>
                    <span className="text-slate-200">{f.text}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Home Bench (3 cols) */}
        <aside className="lg:col-span-3 bg-slate-950/80 rounded-2xl p-3 border border-slate-800 shadow-xl flex flex-col gap-2.5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="text-xs font-black uppercase text-red-400">{homeTeamName}</span>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] px-2 py-0.5 rounded bg-red-950 text-red-300 border border-red-800 font-bold">
                {activeHomeLine}. Útok
              </span>
              <div className="flex items-center gap-0.5 bg-slate-900 rounded p-0.5 border border-slate-800">
                {[1, 2, 3, 4].map((ln) => (
                  <button
                    key={ln}
                    onClick={() => switchForwardLine("home", ln)}
                    title={`Nasadiť ${ln}. útok ${homeTeamName}`}
                    className={`w-5 h-5 rounded text-[10px] font-bold transition flex items-center justify-center ${
                      activeHomeLine === ln
                        ? "bg-red-600 text-white shadow"
                        : "text-slate-400 hover:text-white hover:bg-slate-800"
                    }`}
                  >
                    {ln}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="space-y-1.5 text-xs">
            {homeSkaters.map((p) => {
              const warn = Math.round(p.shiftSeconds) >= 45;
              const isFatigued = p.energy < 50;
              return (
                <div key={p.id} className="bg-slate-900/90 p-2 rounded-xl border border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded bg-red-950 border border-red-800 text-red-300 font-mono font-bold text-[10px] flex items-center justify-center">
                      {p.num}
                    </span>
                    <div>
                      <div className="font-bold text-white text-[11px]">{p.name} <span className="text-slate-400 text-[10px]">{p.role}</span></div>
                      <div className="text-[9px] text-slate-400">
                        Striedanie: <span className={`font-mono font-bold ${warn ? "text-amber-400" : "text-slate-300"}`}>{Math.round(p.shiftSeconds)}s</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`text-[11px] font-black ${isFatigued ? "text-amber-400" : "text-emerald-400"}`}>{Math.round(p.energy)}%</span>
                    <div className="w-12 bg-slate-950 h-1.5 rounded-full overflow-hidden mt-0.5 border border-slate-800">
                      <div className={`${isFatigued ? "bg-amber-500" : "bg-emerald-500"} h-full`} style={{ width: `${p.energy}%` }}></div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </aside>
      </div>

      {/* 4. TACTICS DRAWER MODAL */}
      {tacticsDrawerOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-2xl max-w-xl w-full p-5 border border-slate-700 shadow-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <span className="text-sm font-black text-white uppercase">Taktický pult & Formácie (V3)</span>
              <button onClick={() => setTacticsDrawerOpen(false)} className="text-slate-400 hover:text-white font-bold text-base">✕</button>
            </div>
            <div>
              <div className="text-[11px] font-bold text-slate-300 mb-2 uppercase">Výber útočnej formácie na ľad:</div>
              <div className="grid grid-cols-2 gap-2">
                {[1, 2, 3, 4].map((ln) => (
                  <button
                    key={ln}
                    onClick={() => switchForwardLine("home", ln)}
                    className={`p-2.5 rounded-xl border text-left font-bold transition ${
                      activeHomeLine === ln ? "bg-red-950/80 border-red-500 text-white" : "bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800"
                    }`}
                  >
                    <div>{ln}. Útočná formácia</div>
                    <div className="text-[10px] text-slate-400 font-normal">Čerstvá energia + reset striedania</div>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                onClick={() => setTacticsDrawerOpen(false)}
                className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold"
              >
                Uložiť a zavrieť
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
