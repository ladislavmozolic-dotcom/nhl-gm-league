"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";

export interface LiveRinkTrackerProps {
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
}

interface Player {
  id: string;
  team: "home" | "away";
  x: number;
  y: number;
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

const INITIAL_PLAYERS: Player[] = [
  // Rangers (Away, Blue)
  { id: "nyr-lw", team: "away", x: 0.86, y: 0.30, targetX: 0.86, targetY: 0.30, angle: 0, num: "10", name: "Panarin", role: "LW", energy: 82, toi: "14:12", shiftSeconds: 24, speed: 0.32 },
  { id: "nyr-c",  team: "away", x: 0.78, y: 0.50, targetX: 0.78, targetY: 0.50, angle: 0, num: "93", name: "Zibanejad", role: "C", energy: 76, toi: "15:20", shiftSeconds: 32, speed: 0.30 },
  { id: "nyr-rw", team: "away", x: 0.84, y: 0.72, targetX: 0.84, targetY: 0.72, angle: 0, num: "13", name: "Lafreniere", role: "RW", energy: 85, toi: "12:45", shiftSeconds: 18, speed: 0.28 },
  { id: "nyr-ld", team: "away", x: 0.68, y: 0.32, targetX: 0.68, targetY: 0.32, angle: 0, num: "55", name: "Lindgren", role: "LD", energy: 62, toi: "16:04", shiftSeconds: 38, speed: 0.26 },
  { id: "nyr-rd", team: "away", x: 0.68, y: 0.65, targetX: 0.68, targetY: 0.65, angle: 0, num: "23", name: "Fox", role: "RD", energy: 65, toi: "17:15", shiftSeconds: 35, speed: 0.29 },
  { id: "nyr-g",  team: "away", x: 0.08, y: 0.50, targetX: 0.08, targetY: 0.50, angle: 0, num: "31", name: "Shesterkin", role: "G", isGoalie: true, energy: 95, toi: "33:42", shiftSeconds: 0, speed: 0.20 },

  // Devils (Home, Red)
  { id: "njd-lw", team: "home", x: 0.75, y: 0.34, targetX: 0.75, targetY: 0.34, angle: Math.PI, num: "63", name: "Bratt", role: "LW", energy: 74, toi: "13:30", shiftSeconds: 26, speed: 0.30 },
  { id: "njd-c",  team: "home", x: 0.82, y: 0.48, targetX: 0.82, targetY: 0.48, angle: Math.PI, num: "13", name: "Hischier", role: "C", energy: 79, toi: "14:40", shiftSeconds: 28, speed: 0.30 },
  { id: "njd-rw", team: "home", x: 0.75, y: 0.66, targetX: 0.75, targetY: 0.66, angle: Math.PI, num: "86", name: "Hughes", role: "RW", energy: 63, toi: "15:05", shiftSeconds: 40, speed: 0.31 },
  { id: "njd-ld", team: "home", x: 0.86, y: 0.38, targetX: 0.86, targetY: 0.38, angle: Math.PI, num: "71", name: "Siegenthaler", role: "LD", energy: 84, toi: "16:12", shiftSeconds: 20, speed: 0.25 },
  { id: "njd-rd", team: "home", x: 0.86, y: 0.62, targetX: 0.86, targetY: 0.62, angle: Math.PI, num: "7", name: "Hamilton", role: "RD", energy: 67, toi: "17:30", shiftSeconds: 32, speed: 0.26 },
  { id: "njd-g",  team: "home", x: 0.915, y: 0.50, targetX: 0.915, targetY: 0.50, angle: Math.PI, num: "25", name: "Markström", role: "G", isGoalie: true, energy: 92, toi: "33:42", shiftSeconds: 0, speed: 0.22 },

  // Extra Attacker (6v5)
  { id: "njd-extra", team: "home", x: 0.78, y: 0.52, targetX: 0.78, targetY: 0.52, angle: Math.PI, num: "91", name: "Mercer", role: "EA", energy: 88, toi: "09:20", shiftSeconds: 10, speed: 0.28 }
];

export default function LiveRinkTracker({
  homeTeamName = "New Jersey Devils",
  awayTeamName = "New York Rangers",
  homeLogoUrl = "/NHLlogos/new_jersey_devils.png",
  awayLogoUrl = "/NHLlogos/new_york_rangers.png",
  homeScore = 1,
  awayScore = 2,
  homeSog = 16,
  awaySog = 21,
  periodStr = "2. Tretina",
  standaloneControls = true
}: LiveRinkTrackerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Audio Context ref
  const audioCtxRef = useRef<AudioContext | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(true);

  // Sim State
  const [isPlaying, setIsPlaying] = useState(true);
  const [simSpeed, setSimSpeed] = useState(2);
  const [scoreHomeState, setScoreHomeState] = useState(homeScore);
  const [scoreAwayState, setScoreAwayState] = useState(awayScore);
  const [sogHomeState, setSogHomeState] = useState(homeSog);
  const [sogAwayState, setSogAwayState] = useState(awaySog);
  const [gameClockSeconds, setGameClockSeconds] = useState(13 * 60 + 42);

  const [isShortenBench, setIsShortenBench] = useState(false);
  const [isPullGoalie, setIsPullGoalie] = useState(false);
  const [timeoutsLeft, setTimeoutsLeft] = useState(1);
  const [activeHomeLine, setActiveHomeLine] = useState(1);
  const [tacticsDrawerOpen, setTacticsDrawerOpen] = useState(false);

  // HUD and Commentaries
  const [puckCarrierName, setPuckCarrierName] = useState("A. Panarin (#10)");
  const [zoneText, setZoneText] = useState("🔄 KOLOTOČ V ÚTOČNOM PÁSME (O-ZONE CYCLE)");
  const [shotAlertVisible, setShotAlertVisible] = useState(false);
  const [goalOverlay, setGoalOverlay] = useState<{ visible: boolean; text: string }>({ visible: false, text: "" });
  const [feed, setFeed] = useState<Array<{ id: number; time: string; badge: string; border: string; bg: string; text: string }>>([
    { id: 1, time: "13:42", badge: "ŠANCA", border: "border-emerald-500", bg: "bg-emerald-500/20 text-emerald-300", text: "Panarin zaviezol puk do rohu a zakladá útočný kolotoč v pásme Devils." }
  ]);

  // Simulation Refs
  const playersRef = useRef<Player[]>(JSON.parse(JSON.stringify(INITIAL_PLAYERS)));
  const puckRef = useRef<Puck>({
    x: 0.86,
    y: 0.30,
    mode: "CARRIED",
    carrierId: "nyr-lw",
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
  const phaseRef = useRef<"CYCLE" | "SHOT" | "REBOUND_BATTLE" | "DEVILS_RUSH">("CYCLE");
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
    if (typeof window === "undefined") return;
    const img = new Image();
    img.src = homeLogoUrl;
    centerLogoRef.current = img;
  }, [homeLogoUrl]);

  // Goal trigger
  const triggerGoal = useCallback((scorerName = "Mika Zibanejad", teamName = "NYR") => {
    setScoreAwayState((s) => s + 1);
    playSound("horn");

    setGoalOverlay({ visible: true, text: `GÓL! ${scorerName.toUpperCase()} (${teamName})` });
    setTimeout(() => {
      setGoalOverlay({ visible: false, text: "" });
    }, 2600);

    addCommentary("GÓL 🚨", "border-red-500", "bg-red-600 text-white font-black", `${scorerName} (${teamName}) posiela puk z prvej do šibenice!`);
  }, [playSound, addCommentary]);

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

    const panarin = players.find((p) => p.id === "nyr-lw")!;
    const zibanejad = players.find((p) => p.id === "nyr-c")!;
    const lafreniere = players.find((p) => p.id === "nyr-rw")!;
    const fox = players.find((p) => p.id === "nyr-rd")!;
    const lindgren = players.find((p) => p.id === "nyr-ld")!;

    const hischier = players.find((p) => p.id === "njd-c")!;
    const bratt = players.find((p) => p.id === "njd-lw")!;
    const hughes = players.find((p) => p.id === "njd-rw")!;
    const njdLd = players.find((p) => p.id === "njd-ld")!;
    const njdRd = players.find((p) => p.id === "njd-rd")!;
    const markstrom = players.find((p) => p.id === "njd-g")!;

    // Goalie tracking
    if (!isPullGoalie) {
      markstrom.targetX = 0.915;
      markstrom.targetY = 0.50 + Math.max(-0.06, Math.min(0.06, (puck.y - 0.50) * 0.55));
    } else {
      markstrom.targetX = 0.98;
      markstrom.targetY = 0.50;
    }

    // TACTICAL SEQUENCER
    if (phaseRef.current === "CYCLE") {
      setZoneText("🔄 KOLOTOČ V ÚTOČNOM PÁSME (O-ZONE CYCLE & PASSES)");
      fox.targetX = 0.68 + Math.sin(gameTime * 1.2) * 0.02;
      fox.targetY = 0.65 + Math.cos(gameTime * 0.9) * 0.08;
      lindgren.targetX = 0.68 + Math.cos(gameTime * 1.1) * 0.02;
      lindgren.targetY = 0.33 + Math.sin(gameTime * 0.9) * 0.08;
      njdLd.targetX = 0.86;
      njdLd.targetY = 0.38 + Math.sin(gameTime * 1.2) * 0.04;
      njdRd.targetX = 0.86;
      njdRd.targetY = 0.62 + Math.cos(gameTime * 1.2) * 0.04;

      if (cycleStepRef.current === 0) {
        panarin.targetX = 0.92 + Math.sin(gameTime * 1.5) * 0.03;
        panarin.targetY = 0.32 + Math.cos(gameTime * 1.3) * 0.05;
        zibanejad.targetX = 0.79 + Math.sin(gameTime * 1.0) * 0.03;
        zibanejad.targetY = 0.48;
        lafreniere.targetX = 0.85;
        lafreniere.targetY = 0.74 + Math.sin(gameTime * 1.1) * 0.04;
        hischier.targetX = puck.x - 0.05;
        hischier.targetY = puck.y;

        if (phaseTimeRef.current > 3.0) {
          puck.mode = "PASS_FLIGHT";
          puck.passFromX = puck.x;
          puck.passFromY = puck.y;
          puck.passToX = lafreniere.x;
          puck.passToY = lafreniere.y;
          puck.passProgress = 0;
          puck.passDuration = 0.75;
          puck.passReceiverId = "nyr-rw";
          playSound("pass");
          addCommentary("PRIHRÁVKA", "border-sky-500", "bg-sky-500/20 text-sky-300", "Panarin posiela krížny pas z rohu na voľného Lafreniera.");
          cycleStepRef.current = 1;
          phaseTimeRef.current = 0;
        }
      } else if (cycleStepRef.current === 1) {
        lafreniere.targetX = 0.80 + Math.sin(gameTime * 1.4) * 0.03;
        lafreniere.targetY = 0.72;
        zibanejad.targetX = 0.81;
        zibanejad.targetY = 0.52 + Math.sin(gameTime * 1.2) * 0.03;
        panarin.targetX = 0.88;
        panarin.targetY = 0.28;
        hischier.targetX = puck.x - 0.04;
        hischier.targetY = puck.y;

        if (phaseTimeRef.current > 2.8) {
          puck.mode = "PASS_FLIGHT";
          puck.passFromX = puck.x;
          puck.passFromY = puck.y;
          puck.passToX = fox.x;
          puck.passToY = fox.y;
          puck.passProgress = 0;
          puck.passDuration = 0.65;
          puck.passReceiverId = "nyr-rd";
          playSound("pass");
          addCommentary("ROZOHRÁVKA", "border-blue-500", "bg-blue-500/20 text-blue-300", "Lafreniere posunul puk na modrú čiaru, Fox má napriahnuté.");
          cycleStepRef.current = 2;
          phaseTimeRef.current = 0;
        }
      } else if (cycleStepRef.current === 2) {
        fox.targetX = 0.70;
        fox.targetY = 0.50 + Math.sin(gameTime * 1.5) * 0.04;
        zibanejad.targetX = 0.82;
        zibanejad.targetY = 0.46;

        if (phaseTimeRef.current > 2.4) {
          puck.mode = "PASS_FLIGHT";
          puck.passFromX = puck.x;
          puck.passFromY = puck.y;
          puck.passToX = zibanejad.x;
          puck.passToY = zibanejad.y;
          puck.passProgress = 0;
          puck.passDuration = 0.55;
          puck.passReceiverId = "nyr-c";
          playSound("pass");
          addCommentary("ŠANCA 🔥", "border-emerald-500", "bg-emerald-500/20 text-emerald-300", "Fox krásne uvoľnil Zibanejada na ľavom kruhu, ten sa chystá páliť!");
          cycleStepRef.current = 3;
          phaseTimeRef.current = 0;
        }
      } else if (cycleStepRef.current === 3) {
        if (phaseTimeRef.current > 1.0) {
          puck.mode = "SHOT_FLIGHT";
          puck.passFromX = puck.x;
          puck.passFromY = puck.y;
          puck.passToX = 0.92;
          puck.passToY = 0.47 + Math.random() * 0.06;
          puck.passProgress = 0;
          puck.passDuration = 0.38;
          puck.passReceiverId = null;
          playSound("shot");
          setShotAlertVisible(true);
          setTimeout(() => setShotAlertVisible(false), 1400);

          phaseRef.current = "SHOT";
          cycleStepRef.current = 0;
          phaseTimeRef.current = 0;
        }
      }
    } else if (phaseRef.current === "SHOT") {
      if (puck.mode === "REBOUND") {
        phaseRef.current = "REBOUND_BATTLE";
        phaseTimeRef.current = 0;
      }
    } else if (phaseRef.current === "REBOUND_BATTLE") {
      setZoneText("🥊 SÚBOJ O VYRAZENÝ PUK PRED BRÁNKOU (SLOT SCRAMBLE)");
      hischier.targetX = puck.x; hischier.targetY = puck.y;
      zibanejad.targetX = puck.x; zibanejad.targetY = puck.y;

      if (phaseTimeRef.current > 1.4) {
        puck.mode = "CARRIED";
        puck.carrierId = "njd-c";
        phaseRef.current = "DEVILS_RUSH";
        phaseTimeRef.current = 0;
        addCommentary("BREJK ⚡", "border-red-500", "bg-red-500/20 text-red-300", "Hischier vybojoval puk a vyráža s Hughesom do rýchleho protiútoku!");
      }
    } else if (phaseRef.current === "DEVILS_RUSH") {
      setZoneText("⚡ RÝCHLY PRECHOD DEVILS (COUNTER RUSH 2-ON-1)");
      bratt.targetX = 0.32; bratt.targetY = 0.32;
      hughes.targetX = 0.35; hughes.targetY = 0.68;
      hischier.targetX = 0.45; hischier.targetY = 0.50;
      fox.targetX = 0.28; fox.targetY = 0.62;
      lindgren.targetX = 0.28; lindgren.targetY = 0.35;

      if (phaseTimeRef.current > 2.2 && puck.carrierId === "njd-c") {
        puck.mode = "PASS_FLIGHT";
        puck.passFromX = puck.x;
        puck.passFromY = puck.y;
        puck.passToX = hughes.x;
        puck.passToY = hughes.y;
        puck.passProgress = 0;
        puck.passDuration = 0.65;
        puck.passReceiverId = "njd-rw";
        playSound("pass");
        addCommentary("PREČÍSLENIE", "border-red-500", "bg-red-500/20 text-red-300", "Hischier prestrčil puk na rozbehnutého Hughesa!");
      }

      if (phaseTimeRef.current > 4.5) {
        puck.mode = "SHOT_FLIGHT";
        puck.passFromX = puck.x;
        puck.passFromY = puck.y;
        puck.passToX = 0.08;
        puck.passToY = 0.50;
        puck.passProgress = 0;
        puck.passDuration = 0.40;
        puck.passReceiverId = null;
        playSound("shot");

        setSogHomeState((s) => s + 1);
        addCommentary("LAPAČKA 🧤", "border-blue-500", "bg-blue-500/20 text-blue-300", "Shesterkin s istotou chytá prudkú strelu Hughesa do lapačky!");

        setTimeout(() => {
          phaseRef.current = "CYCLE";
          cycleStepRef.current = 0;
          phaseTimeRef.current = 0;
          puck.mode = "CARRIED";
          puck.carrierId = "nyr-lw";
          puck.x = 0.86; puck.y = 0.30;
        }, 1500);
      }
    }

    // Kinematics
    players.forEach((p) => {
      const effSpeed = p.speed * (0.65 + 0.35 * (p.energy / 100)) * simSpeed;
      const dx = p.targetX - p.x;
      const dy = p.targetY - p.y;
      const dist = Math.hypot(dx, dy);

      if (dist > 0.004) {
        const moveDist = Math.min(dist, effSpeed * dt);
        p.x += (dx / dist) * moveDist;
        p.y += (dy / dist) * moveDist;
        p.angle = Math.atan2(dy, dx);
      }

      if (Math.random() < 0.25 * simSpeed) {
        skateTrailsRef.current.push({ x: p.x, y: p.y });
        if (skateTrailsRef.current.length > 150) skateTrailsRef.current.shift();
      }
    });

    // Puck Physics
    if (puck.mode === "CARRIED") {
      const carrier = players.find((p) => p.id === puck.carrierId);
      if (carrier) {
        const stickDist = 0.018;
        puck.x = carrier.x + Math.cos(carrier.angle) * stickDist;
        puck.y = carrier.y + Math.sin(carrier.angle) * stickDist;
        setPuckCarrierName(`${carrier.name} (#${carrier.num})`);
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
        if (recv) setPuckCarrierName(`${recv.name} (#${recv.num})`);
        playSound("receive");
      }
    } else if (puck.mode === "SHOT_FLIGHT") {
      puck.passProgress += (dt * simSpeed) / puck.passDuration;
      const t = Math.min(1.0, puck.passProgress);
      puck.x = puck.passFromX + (puck.passToX - puck.passFromX) * t;
      puck.y = puck.passFromY + (puck.passToY - puck.passFromY) * t;

      if (t >= 1.0) {
        if (Math.random() < 0.80 && !isPullGoalie) {
          setSogAwayState((s) => s + 1);
          playSound("post");
          addCommentary("ZÁKROK 🛑", "border-blue-500", "bg-blue-500/20 text-blue-300", "Markström vyráža puk betónom do kruhu!");
          puck.mode = "REBOUND";
          puck.reboundVx = -0.22 - (Math.random() * 0.12);
          puck.reboundVy = (Math.random() - 0.5) * 0.35;
        } else {
          triggerGoal();
          puck.mode = "CARRIED";
          puck.carrierId = "nyr-c";
        }
      }
    } else if (puck.mode === "REBOUND") {
      puck.x += puck.reboundVx * dt * simSpeed;
      puck.y += puck.reboundVy * dt * simSpeed;
      puck.reboundVx *= Math.pow(0.92, dt * 60);
      puck.reboundVy *= Math.pow(0.92, dt * 60);
    }

    // Game Clock
    clockTimerRef.current += dt * simSpeed;
    if (clockTimerRef.current >= 1.0) {
      clockTimerRef.current = 0;
      setGameClockSeconds((sec) => Math.max(0, sec - 1));
    }
  }, [isPlaying, simSpeed, isShortenBench, isPullGoalie, playSound, addCommentary, triggerGoal]);

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
            if (p.id === "njd-g" && isPullGoalie) return;
            if (p.id === "njd-extra" && !isPullGoalie) return;

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
      if (p.id === "njd-g" && isPullGoalie) return false;
      if (p.id === "njd-extra" && !isPullGoalie) return false;
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

  const selectForwardLine = (lineNum: number) => {
    setActiveHomeLine(lineNum);
    playersRef.current
      .filter((p) => p.team === "home" && !p.isGoalie)
      .forEach((p) => {
        p.energy = 95;
        p.shiftSeconds = 0;
      });
    addCommentary("STRIEDANIE 🔄", "border-sky-500", "bg-sky-500/20 text-sky-300", `Tréner posiela na ľad ${lineNum}. útočnú formáciu.`);
  };

  const clockMins = Math.floor(gameClockSeconds / 60);
  const clockSecs = (gameClockSeconds % 60).toString().padStart(2, "0");
  const displayClock = `${clockMins}:${clockSecs}`;

  const awaySkaters = playersRef.current.filter((p) => p.team === "away" && !p.isGoalie);
  const homeSkaters = playersRef.current.filter((p) => p.team === "home" && !p.isGoalie && p.id !== "njd-extra");

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
                <span className="bg-slate-900/80 px-2 py-0.5 rounded border border-slate-700">Strely: <strong className="text-white font-mono">{sogAwayState}</strong></span>
                <span className="bg-slate-900/80 px-2 py-0.5 rounded border border-slate-700">xG: <strong className="text-sky-300 font-mono">1.84</strong></span>
              </div>
            </div>
          </div>

          {/* Score Capsule */}
          <div className="flex flex-col items-center justify-center">
            <div className="flex items-center gap-4">
              <span className="text-4xl md:text-6xl font-black font-mono tabular-nums text-white drop-shadow">{scoreAwayState}</span>
              <div className="flex flex-col items-center px-4 py-1.5 bg-[#01040a] rounded-xl border border-slate-700 shadow-inner">
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 animate-pulse">{periodStr}</span>
                <span className="font-mono text-2xl md:text-3xl font-black text-amber-400">{displayClock}</span>
              </div>
              <span className="text-4xl md:text-6xl font-black font-mono tabular-nums text-white drop-shadow">{scoreHomeState}</span>
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
                <span className="bg-slate-900/80 px-2 py-0.5 rounded border border-slate-700">xG: <strong className="text-red-300 font-mono">1.32</strong></span>
                <span className="bg-slate-900/80 px-2 py-0.5 rounded border border-slate-700">Strely: <strong className="text-white font-mono">{sogHomeState}</strong></span>
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
            <span className="text-[10px] px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800">1. Útok</span>
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
              {feed.map((f) => (
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
            <span className="text-[10px] px-2 py-0.5 rounded bg-red-950 text-red-300 border border-red-800">{activeHomeLine}. Útok</span>
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
                    onClick={() => selectForwardLine(ln)}
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
