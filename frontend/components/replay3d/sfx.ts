// Tiny Web Audio synth for the 3D views (no audio files): stick on puck, a pass,
// the post ping, the referee's whistle, the goal horn and a crowd swell.

export type Sfx = "pass" | "shot" | "post" | "whistle" | "horn" | "crowd" | "save" | "hit";

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!ctx && Ctor) ctx = new Ctor();
    if (ctx?.state === "suspended") void ctx.resume();
    return ctx;
  } catch { return null; }
}

function tone(c: AudioContext, type: OscillatorType, f0: number, f1: number, dur: number, vol: number, at = 0) {
  const t = c.currentTime + at, o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + dur + 0.02);
}

function noise(c: AudioContext, dur: number, vol: number, freq: number, attack = 0.3) {
  const len = Math.floor(c.sampleRate * dur), buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource(); src.buffer = buf;
  const bp = c.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = freq; bp.Q.value = 0.6;
  const g = c.createGain(), t = c.currentTime;
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(bp); bp.connect(g); g.connect(c.destination); src.start(t);
}

export function playSfx(kind: Sfx) {
  const c = audio();
  if (!c) return;
  switch (kind) {
    case "pass": tone(c, "sine", 260, 80, 0.05, 0.22); break;
    case "shot": tone(c, "triangle", 170, 35, 0.15, 0.55); break;
    case "save": tone(c, "square", 120, 60, 0.08, 0.12); noise(c, 0.25, 0.08, 900, 0.01); break;
    case "post": tone(c, "sine", 2850, 2700, 0.85, 0.35); break;
    case "whistle": tone(c, "sine", 2600, 2550, 0.35, 0.18); tone(c, "sine", 2650, 2600, 0.25, 0.12, 0.38); break;
    case "horn": for (const f of [174.61, 220, 261.63, 349.23]) tone(c, "sawtooth", f, f * 0.995, 2.4, 0.1); break;
    case "crowd": noise(c, 3.2, 0.22, 700, 0.35); break;
    case "hit": tone(c, "sine", 90, 40, 0.22, 0.6); noise(c, 0.3, 0.18, 300, 0.01); break;
  }
}
