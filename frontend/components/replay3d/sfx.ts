// Realistic Web Audio sound synthesis for NHL 3D replays and live views (zero external audio files).
// Authentic pneumatic NHL goal horn chords, stadium siren, puck-in-twine, composite stick crack,
// post ring, arena crowd roar, and broadcast transition whooshes.

export type Sfx = "pass" | "shot" | "post" | "whistle" | "horn" | "crowd" | "save" | "hit" | "twine" | "whoosh" | "siren";

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

function tone(
  c: AudioContext,
  type: OscillatorType,
  f0: number,
  f1: number,
  dur: number,
  vol: number,
  at = 0,
  dest?: AudioNode
) {
  const t = c.currentTime + at, o = c.createOscillator(), g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(Math.max(20, f0), t);
  if (f0 !== f1) {
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  }
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + Math.min(0.02, dur * 0.1));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g);
  g.connect(dest || c.destination);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function noise(
  c: AudioContext,
  dur: number,
  vol: number,
  freq: number,
  attack = 0.2,
  q = 0.8,
  type: BiquadFilterType = "bandpass",
  at = 0
) {
  const len = Math.floor(c.sampleRate * Math.max(0.05, dur));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

  const src = c.createBufferSource();
  src.buffer = buf;
  const bp = c.createBiquadFilter();
  bp.type = type;
  bp.frequency.value = freq;
  bp.Q.value = q;

  const g = c.createGain(), t = c.currentTime + at;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

  src.connect(bp);
  bp.connect(g);
  g.connect(c.destination);
  src.start(t);
  src.stop(t + dur + 0.05);
}

/** Layered authentic NHL goal horn (Nathan K3LA / Kahlenberg pneumatic chord intervals). */
function playGoalHorn(c: AudioContext) {
  const freqs = [
    87.31,              // deep sub bass resonance
    174.61, 175.5,      // F3 body + detune
    233.08, 234.1,      // Bb3
    293.66, 294.8,      // D4
    349.23, 350.5,      // F4 high harmonic
    466.16              // Bb4 presence
  ];

  // Horn blasts: 2.3s primary blast, slight gap, then secondary blast
  const blasts = [
    { at: 0, dur: 2.3, vol: 0.085 },
    { at: 2.5, dur: 1.8, vol: 0.075 }
  ];

  for (const b of blasts) {
    for (const f of freqs) {
      tone(c, "sawtooth", f, f * 0.998, b.dur, b.vol, b.at);
    }
  }

  // Goal siren overlay (spinning police/arena siren)
  const t0 = c.currentTime;
  const sirenOsc = c.createOscillator();
  const sirenLfo = c.createOscillator();
  const lfoGain = c.createGain();
  const sirenGain = c.createGain();

  sirenOsc.type = "sine";
  sirenOsc.frequency.setValueAtTime(740, t0);

  sirenLfo.frequency.setValueAtTime(1.8, t0); // 1.8 Hz rotation
  lfoGain.gain.setValueAtTime(180, t0); // wail between 560Hz and 920Hz

  sirenGain.gain.setValueAtTime(0.0001, t0);
  sirenGain.gain.linearRampToValueAtTime(0.065, t0 + 0.4);
  sirenGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 4.8);

  sirenLfo.connect(lfoGain);
  lfoGain.connect(sirenOsc.frequency);
  sirenOsc.connect(sirenGain);
  sirenGain.connect(c.destination);

  sirenLfo.start(t0);
  sirenOsc.start(t0);
  sirenLfo.stop(t0 + 5.0);
  sirenOsc.stop(t0 + 5.0);
}

export function playSfx(kind: Sfx) {
  const c = audio();
  if (!c) return;

  switch (kind) {
    case "pass":
      // Clean tape-to-tape pass
      tone(c, "sine", 240, 90, 0.045, 0.28);
      noise(c, 0.04, 0.14, 1800, 0.005);
      break;

    case "shot":
      // Composite stick slap: high-frequency whip crack + low resonant body thump
      tone(c, "triangle", 190, 38, 0.12, 0.65);
      noise(c, 0.035, 0.35, 2400, 0.003, 1.2, "bandpass");
      break;

    case "twine":
      // Puck hitting the back of the net mesh (satisfying muffled thwack + net vibration)
      tone(c, "triangle", 110, 45, 0.16, 0.5);
      noise(c, 0.18, 0.22, 950, 0.015, 0.9);
      break;

    case "save":
      // Goalie pad / blocker save
      tone(c, "square", 130, 50, 0.08, 0.18);
      noise(c, 0.22, 0.14, 1100, 0.01);
      break;

    case "post":
      // High-pitched crossbar / goal post iron ping with sustained arena reverb
      tone(c, "sine", 2850, 2760, 1.1, 0.45);
      tone(c, "sine", 4200, 4120, 0.8, 0.25);
      break;

    case "whistle":
      // Referee's pea whistle
      tone(c, "sine", 2620, 2560, 0.32, 0.2);
      tone(c, "sine", 2680, 2610, 0.22, 0.14, 0.34);
      break;

    case "horn":
      playGoalHorn(c);
      break;

    case "siren":
      tone(c, "sine", 600, 900, 2.0, 0.08);
      break;

    case "crowd":
      // Multi-layer arena crowd cheer swell
      noise(c, 4.5, 0.26, 680, 0.4, 0.6);
      noise(c, 3.8, 0.18, 1400, 0.6, 0.8);
      noise(c, 3.2, 0.12, 2600, 0.8, 0.7);
      break;

    case "hit":
      // Heavy board check
      tone(c, "sine", 95, 38, 0.24, 0.7);
      noise(c, 0.32, 0.28, 320, 0.01, 1.2);
      break;

    case "whoosh":
      // TV broadcast stinger wipe / camera cut transition swoosh
      noise(c, 0.38, 0.24, 1800, 0.08, 1.4, "bandpass");
      tone(c, "sine", 320, 110, 0.25, 0.12);
      break;
  }
}
