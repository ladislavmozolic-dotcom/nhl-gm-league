// Coach Advice — a plain-language nudge on the team system for GMs who don't
// want to read the tactics matrix. It compares how the roster FITS each dial
// option (systemFit) and suggests a change when another setting clearly suits the
// group better. It is NOT a solver: the coach's read is filtered through his own
// experience (EX), so a low-EX coach can misjudge — the advice is an opinion, and
// it never claims a setting is "the best".

import { systemFit, type TeamTactics, type RosterProfile } from "./sim/tactics";

export type CoachSuggestion = { dial: keyof TeamTactics; toLabel: string; to: string; reason: string; confidence: "confident" | "leaning" | "hunch" };

const OPTIONS: Partial<Record<keyof TeamTactics, string[]>> = {
  tempo: ["slow", "balanced", "fast"],
  forecheck: ["passive", "balanced", "aggressive"],
  puckStyle: ["cycle", "balanced", "rush", "shotVolume"],
  dZone: ["collapse", "balanced", "aggressive"],
};
const LABEL: Record<string, string> = {
  slow: "Slow Tempo", balanced: "Balanced", fast: "Fast Tempo",
  passive: "Passive Forecheck", aggressive: "Aggressive Forecheck",
  cycle: "Cycle", rush: "Rush", shotVolume: "Shot-Volume",
  collapse: "Collapse D-Zone",
};
const label = (dial: string, opt: string) => opt === "balanced"
  ? (dial === "tempo" ? "Balanced Tempo" : dial === "forecheck" ? "Balanced Forecheck" : dial === "dZone" ? "Balanced D-Zone" : "Balanced Puck Play")
  : (LABEL[opt] ?? opt);

// what a demanding option leans on — used to phrase the reason
const DRIVER: Record<string, string> = {
  fast: "team speed and endurance", aggressive: "checking and skating",
  rush: "finish, passing and speed", cycle: "passing and size",
  shotVolume: "shooting and size", collapse: "team defence",
};

// tiny deterministic per-coach bias so a low-EX coach's read is imperfect (stable,
// not random-per-render): keyed by the option, scaled by how green the coach is.
function bias(dial: string, opt: string, coachEx: number): number {
  let h = 0; const s = dial + opt;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  const unit = ((Math.abs(h) % 1000) / 1000 - 0.5) * 2; // -1..1
  return unit * (1 - Math.max(0, Math.min(1, coachEx / 100))) * 0.08; // ±8% at EX 0, ~0 at EX 100
}

export function coachAdvice(profile: RosterProfile, current: TeamTactics, coachEx = 70): CoachSuggestion[] {
  const out: CoachSuggestion[] = [];
  for (const dial of Object.keys(OPTIONS) as (keyof TeamTactics)[]) {
    const opts = OPTIONS[dial]!;
    const cur = String(current[dial] ?? "balanced");
    // the coach's PERCEIVED fit of each option (true fit + his bias)
    const perceived = opts.map((opt) => {
      const trial = { ...current, [dial]: opt } as TeamTactics;
      return { opt, fit: systemFit(profile, trial) * (1 + bias(dial, opt, coachEx)) };
    });
    const best = perceived.reduce((a, b) => (b.fit > a.fit ? b : a));
    const curFit = perceived.find((p) => p.opt === cur)!.fit;
    if (best.opt === cur || best.fit - curFit < 0.02) continue; // current is fine (in his eyes)

    // phrase it: moving off a demanding setting he can't support, or onto one he can
    const reason = DRIVER[cur]
      ? `your group is short on the ${DRIVER[cur]} to sustain ${label(dial, cur)}.`
      : DRIVER[best.opt]
        ? `the roster has the ${DRIVER[best.opt]} to run ${best.opt === "balanced" ? "a" : ""} ${label(dial, best.opt)}.`
        : `it may suit the group better.`;
    const gain = best.fit - curFit;
    const confidence: CoachSuggestion["confidence"] = coachEx >= 80 && gain > 0.05 ? "confident" : coachEx >= 62 ? "leaning" : "hunch";
    out.push({ dial, to: best.opt, toLabel: label(dial, best.opt), reason, confidence });
  }
  // surface the 2 strongest reads only
  return out.slice(0, 2);
}
