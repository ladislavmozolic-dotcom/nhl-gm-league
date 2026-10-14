"use client";

// Notification sounds are synthesised with WebAudio (no audio files to ship or cache).
export const SOUNDS = [
  { id: "classic", label: "Klasik" },
  { id: "drop", label: "Kvapka" },
  { id: "chime", label: "Zvonček" },
  { id: "pop", label: "Pukanec" },
  { id: "horn", label: "Gólový roh 🚨" },
  { id: "whistle", label: "Rozhodcovská píšťalka" },
  { id: "off", label: "Bez zvuku" },
] as const;
export type SoundId = (typeof SOUNDS)[number]["id"];

export type Prefs = { sound: SoundId; volume: number; banner: boolean; vibrate: boolean };
const KEY = "unhl-chat-prefs";
export const DEFAULT_PREFS: Prefs = { sound: "classic", volume: 0.7, banner: true, vibrate: true };

export function loadPrefs(): Prefs {
  try { return { ...DEFAULT_PREFS, ...(JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<Prefs>) }; } catch { return DEFAULT_PREFS; }
}
export function savePrefs(p: Prefs) { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* private mode */ } }

let ctx: AudioContext | null = null;
function audio(): AudioContext | null {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx ??= new AC();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch { return null; }
}
/** Browsers only allow audio after a user gesture — call once on the first tap/click. */
export function unlockAudio() { audio(); }

type Tone = { f: number; t: number; d: number; type?: OscillatorType; g?: number; to?: number; vib?: number };
const PATTERNS: Record<Exclude<SoundId, "off">, Tone[]> = {
  classic: [{ f: 880, t: 0, d: 0.16 }, { f: 1320, t: 0.14, d: 0.28 }],
  drop: [{ f: 1400, to: 520, t: 0, d: 0.22 }],
  chime: [{ f: 523, t: 0, d: 0.3 }, { f: 659, t: 0.12, d: 0.3 }, { f: 784, t: 0.24, d: 0.45 }],
  pop: [{ f: 420, to: 180, t: 0, d: 0.09, type: "square", g: 0.5 }],
  horn: [{ f: 196, t: 0, d: 0.75, type: "sawtooth", g: 0.55 }, { f: 247, t: 0, d: 0.75, type: "sawtooth", g: 0.35 }],
  whistle: [{ f: 2500, t: 0, d: 0.4, vib: 38 }, { f: 2500, t: 0.5, d: 0.25, vib: 38 }],
};

export function playSound(id: SoundId, volume = 0.7) {
  if (id === "off") return;
  const c = audio();
  if (!c) return;
  const now = c.currentTime;
  for (const tn of PATTERNS[id]) {
    const o = c.createOscillator(), g = c.createGain();
    o.type = tn.type ?? "sine";
    o.frequency.setValueAtTime(tn.f, now + tn.t);
    if (tn.to) o.frequency.exponentialRampToValueAtTime(tn.to, now + tn.t + tn.d);
    if (tn.vib) { // whistle trill
      const l = c.createOscillator(), lg = c.createGain();
      l.frequency.value = tn.vib; lg.gain.value = 90; l.connect(lg); lg.connect(o.frequency); l.start(now + tn.t); l.stop(now + tn.t + tn.d);
    }
    const peak = Math.max(0.0001, (tn.g ?? 0.6) * volume * 0.5);
    g.gain.setValueAtTime(0.0001, now + tn.t);
    g.gain.exponentialRampToValueAtTime(peak, now + tn.t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now + tn.t + tn.d);
    o.connect(g); g.connect(c.destination);
    o.start(now + tn.t); o.stop(now + tn.t + tn.d + 0.05);
  }
}
