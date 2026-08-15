// Play-by-play generator. When the possession engine hands us its real event
// stream (v2), the goals, shots-on-goal, saves and penalties are narrated
// straight from it — same actors, same times, same xG the box score was built
// from (one source of truth). Only the atmospheric filler (hits, icings,
// offsides, misses) is still RNG colour. Without an event stream (volume model),
// it falls back to the legacy post-hoc reconstruction.

import { RNG } from "./rng";
import type { GameResult, SimTeam, SimSkater, PbpEvent, PbpKind } from "./types";
import type { SimEvent } from "./events";

const PERIOD_SECONDS = 1200;
const fmt = (s: number) => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, "0")}`;

const centers = (t: SimTeam) => {
  const c = t.forwards.filter((f) => f.isCenter);
  return c.length ? c : t.forwards;
};
const pool = (t: SimTeam) => [...t.forwards, ...t.defense];

export function generatePlayByPlay(result: GameResult, home: SimTeam, away: SimTeam, stream?: SimEvent[]): PbpEvent[] {
  // v2: narrate directly from the real event stream when it carries shot events.
  if (stream && stream.some((e) => e.type === "SHOT")) {
    return playByPlayFromEvents(result, home, away, stream);
  }
  return legacyPlayByPlay(result, home, away);
}

function legacyPlayByPlay(result: GameResult, home: SimTeam, away: SimTeam): PbpEvent[] {
  const rng = new RNG((result.seed ^ 0x5bd1e995) | 0);
  const sideOf = (teamId: number) => (teamId === home.id ? home : away);
  const oppOf = (teamId: number) => (teamId === home.id ? away : home);
  const goalieName = (teamId: number) => (teamId === home.id ? result.home.goalie.name : result.away.goalie.name);

  const pick = (t: SimTeam, weight: (s: SimSkater) => number) => {
    const p = pool(t);
    return p[rng.weighted(p.map(weight))];
  };
  const shooter = (t: SimTeam) => pick(t, (s) => Math.pow((s.offense * 0.7 + s.playmaking * 0.3) / 60, 2) * s.iceTime * (s.isDefense ? 0.35 : 1));
  const hitter = (t: SimTeam) => pick(t, (s) => s.hitting * s.iceTime);
  const blocker = (t: SimTeam) => pick(t, (s) => s.blocking * s.iceTime * (s.isDefense ? 1.8 : 1));
  const center = (t: SimTeam) => { const c = centers(t); return c[rng.weighted(c.map((s) => s.iceTime))]; };
  const anySkater = (t: SimTeam) => pick(t, (s) => s.iceTime);

  const events: PbpEvent[] = [];
  const add = (period: number, seconds: number, teamId: number | null, kind: PbpKind, text: string, major = false) =>
    events.push({ period, seconds: Math.max(0, Math.min(PERIOD_SECONDS - 1, Math.round(seconds))), time: fmt(seconds), teamId, kind, text, major });

  const goalsByPeriod = (p: number) => result.goals.filter((g) => g.period === p && g.strength !== "SO");
  const pensByPeriod = (p: number) => result.penalties.filter((x) => x.period === p);
  const zone = (t: SimTeam) => `${t.name} zone`;

  for (let p = 1; p <= 3; p++) {
    add(p, 0, null, "period", `Start of the ${p}${["st", "nd", "rd"][p - 1]} period.`, true);

    // opening faceoff
    const fc = center(home), fa = center(away);
    const homeWins = rng.chance(fc.faceoff / (fc.faceoff + fa.faceoff));
    add(p, 1, (homeWins ? home : away).id, "faceoff",
      `${(homeWins ? fc : fa).name} wins face-off versus ${(homeWins ? fa : fc).name} in neutral zone.`);

    type Shot = { t: number; team: SimTeam; goal: (typeof result.goals)[number] | null };
    const shots: Shot[] = [];
    for (const [box, team] of [[result.home, home], [result.away, away]] as const) {
      const sog = box.shotsByPeriod[p - 1] ?? 0;
      const goals = goalsByPeriod(p).filter((g) => g.team === team.id);
      const saves = Math.max(0, sog - goals.length);
      for (let i = 0; i < saves; i++) shots.push({ t: 5 + rng.int(PERIOD_SECONDS - 10), team, goal: null });
      for (const g of goals) shots.push({ t: g.seconds, team, goal: g });
    }

    // filler events (not on goal): misses, blocks, hits, icings, offsides
    const filler: Array<{ t: number; kind: PbpKind; teamId: number | null; text: string }> = [];
    for (const [box, team] of [[result.home, home], [result.away, away]] as const) {
      const opp = oppOf(team.id);
      const misses = Math.round((box.shotsByPeriod[p - 1] ?? 0) * 0.4);
      for (let i = 0; i < misses; i++) filler.push({ t: 5 + rng.int(PERIOD_SECONDS - 10), kind: "miss", teamId: team.id, text: `Shot by ${shooter(team).name}. Shot Misses the Net.` });
      const blocks = Math.round((box.blocks ?? 0) / 3); // per-period share
      for (let i = 0; i < blocks; i++) filler.push({ t: 5 + rng.int(PERIOD_SECONDS - 10), kind: "block", teamId: opp.id, text: `Shot by ${shooter(opp).name}. Blocked by ${blocker(team).name}.` });
      const hits = Math.round((box.hits ?? 0) / 3);
      for (let i = 0; i < hits; i++) filler.push({ t: 5 + rng.int(PERIOD_SECONDS - 10), kind: "hit", teamId: team.id, text: `${anySkater(opp).name} is hit by ${hitter(team).name} and loses puck.` });
      for (let i = 0; i < 2 + rng.int(3); i++) filler.push({ t: 5 + rng.int(PERIOD_SECONDS - 10), kind: "icing", teamId: team.id, text: `Icing by ${anySkater(team).name}.` });
      for (let i = 0; i < 1 + rng.int(3); i++) filler.push({ t: 5 + rng.int(PERIOD_SECONDS - 10), kind: "offside", teamId: team.id, text: `Off-side.` });
    }

    // emit shots
    for (const sh of shots.sort((a, b) => a.t - b.t)) {
      if (sh.goal) {
        const g = sh.goal;
        const tag = g.emptyNet ? " (EN)" : g.strength !== "EV" ? ` (${g.strength})` : "";
        add(p, sh.t, sh.team.id, "shot", `Shot by ${g.scorerName}.`);
        add(p, sh.t, sh.team.id, "goal",
          `GOAL${tag} scored by ${g.scorerName}${g.assistNames.length ? ` assisted by ${g.assistNames.join(" and ")}` : " unassisted"}.`, true);
        // faceoff after a goal
        add(p, sh.t + 1, null, "faceoff", `${center(home).name} wins face-off versus ${center(away).name} in neutral zone.`);
      } else {
        const sName = shooter(sh.team).name;
        add(p, sh.t, sh.team.id, "shot", `Shot by ${sName}.`);
        if (rng.chance(0.12)) add(p, sh.t, sh.team.id, "shot", `Deflect By ${anySkater(sh.team).name}.`);
        add(p, sh.t, sh.team.id, "save", `Stopped by ${goalieName(oppOf(sh.team.id).id)} ${rng.chance(0.5) ? "without a rebound" : "with a rebound"}.`);
      }
    }
    for (const f of filler) add(p, f.t, f.teamId, f.kind, f.text, false);

    // penalties (major in the condensed view)
    for (const pen of pensByPeriod(p)) {
      if (pen.type === "Fighting") continue; // shown as a fight line below
      add(p, pen.seconds, pen.team, "penalty",
        `${pen.playerName} penalty for ${pen.type} (${pen.minutes} min, ${pen.severity}).`, true);
    }
    // fights (pair up the two majors at the same time)
    const fights = pensByPeriod(p).filter((x) => x.type === "Fighting");
    for (let i = 0; i + 1 < fights.length; i += 2) {
      add(p, fights[i].seconds, null, "fight", `Fight: ${fights[i].playerName} versus ${fights[i + 1].playerName}. Both receive 5-minute majors.`, true);
    }
    // injuries
    for (const inj of result.injuries.filter((x) => x.period === p)) {
      add(p, inj.seconds, inj.teamId, "injury", `${inj.playerName} injured — ${inj.desc}${inj.mechanism === "Hit" && inj.byName ? ` (hit by ${inj.byName})` : ` (${inj.mechanism.toLowerCase()})`} — ${inj.severity}, out ~${inj.days} day${inj.days === 1 ? "" : "s"}.`, true);
    }

    add(p, PERIOD_SECONDS, null, "period", `End of the ${p}${["st", "nd", "rd"][p - 1]} period.`, true);
  }

  // overtime goal, if any
  const otGoal = result.goals.find((g) => g.period === 4);
  if (otGoal) {
    add(4, 0, null, "period", `Start of overtime.`, true);
    add(4, otGoal.seconds, otGoal.team, "goal",
      `GOAL scored by ${otGoal.scorerName}${otGoal.assistNames.length ? ` assisted by ${otGoal.assistNames.join(" and ")}` : ""}. Game over.`, true);
  }
  if (result.endedIn === "SO") add(5, 0, null, "period", `Shootout — won by ${sideOf(result.winner).name}.`, true);

  return events.sort((a, b) => a.period - b.period || a.seconds - b.seconds);
}

// ---- v2: play-by-play built from the real event stream ----------------------

function playByPlayFromEvents(result: GameResult, home: SimTeam, away: SimTeam, stream: SimEvent[]): PbpEvent[] {
  const rng = new RNG((result.seed ^ 0x27d4eb2f) | 0);
  const sideOf = (teamId: number) => (teamId === home.id ? home : away);
  const oppOf = (teamId: number) => (teamId === home.id ? away : home);
  const goalieName = (teamId: number) => (teamId === home.id ? result.home.goalie.name : result.away.goalie.name);
  const center = (t: SimTeam) => { const c = centers(t); return c[rng.weighted(c.map((s) => s.iceTime))]; };
  const anySkater = (t: SimTeam) => { const p = pool(t); return p[rng.weighted(p.map((s) => s.iceTime))]; };
  const hitter = (t: SimTeam) => { const p = pool(t); return p[rng.weighted(p.map((s) => s.hitting * s.iceTime))]; };

  const events: PbpEvent[] = [];
  const add = (period: number, seconds: number, teamId: number | null, kind: PbpKind, text: string, major = false) =>
    events.push({ period, seconds: Math.max(0, Math.min(PERIOD_SECONDS - 1, Math.round(seconds))), time: fmt(seconds), teamId, kind, text, major });

  const maxRegPeriod = Math.max(3, ...stream.map((e) => e.period));

  for (let p = 1; p <= maxRegPeriod; p++) {
    const label = p <= 3 ? `${p}${["st", "nd", "rd"][p - 1]} period` : p === 4 ? "overtime" : "period";
    add(p, 0, null, "period", `Start of the ${label}.`, true);

    // opening faceoff (real winner not tracked per-draw; colour only)
    const fc = center(home), fa = center(away);
    const homeWins = rng.chance(fc.faceoff / (fc.faceoff + fa.faceoff));
    add(p, 1, (homeWins ? home : away).id, "faceoff",
      `${(homeWins ? fc : fa).name} wins face-off versus ${(homeWins ? fa : fc).name} in neutral zone.`);

    // sudden-death OT ends on the goal — cap all filler/colour to before it.
    const cap = p >= 4 ? (stream.find((e) => e.period === p && e.type === "GOAL")?.seconds ?? PERIOD_SECONDS) : PERIOD_SECONDS;
    const rt = () => 5 + rng.int(Math.max(1, cap - 10));

    // atmospheric filler (not simulated as timed events): hits, icings, offsides
    const hitCount = Math.round(((result.home.hits ?? 0) + (result.away.hits ?? 0)) / 3 / maxRegPeriod);
    for (let i = 0; i < hitCount; i++) {
      const t = sideOf(rng.chance(0.5) ? home.id : away.id);
      add(p, rt(), t.id, "hit", `${anySkater(oppOf(t.id)).name} is hit by ${hitter(t).name} and loses puck.`);
    }
    for (let i = 0; i < 2 + rng.int(3); i++) { const t = rng.chance(0.5) ? home : away; add(p, rt(), t.id, "icing", `Icing by ${anySkater(t).name}.`); }
    for (let i = 0; i < 1 + rng.int(3); i++) { const t = rng.chance(0.5) ? home : away; add(p, rt(), t.id, "offside", `Off-side.`); }

    // real events this period, in order
    for (const e of stream.filter((x) => x.period === p)) {
      const tId = e.teamId ?? null;
      if (e.type === "SHOT") {
        // a SHOT immediately followed by its GOAL is narrated by the GOAL line
        continue;
      } else if (e.type === "SAVE") {
        const shooterName = e.targetName ?? "?";
        add(p, e.seconds, oppOf(e.teamId ?? home.id).id, "shot", `Shot by ${shooterName}.`);
        add(p, e.seconds, e.teamId ?? null, "save", `Stopped by ${e.playerName ?? goalieName(e.teamId ?? home.id)} ${rng.chance(0.5) ? "without a rebound" : "with a rebound"}.`);
      } else if (e.type === "GOAL") {
        const so = (e.meta as { so?: boolean } | undefined)?.so;
        if (so) continue; // shootout handled below
        const en = (e.meta as { emptyNet?: boolean } | undefined)?.emptyNet;
        const assistNames = ((e.meta as { assistNames?: string[] } | undefined)?.assistNames) ?? [];
        const tag = en ? " (EN)" : e.strength && e.strength !== "EV" ? ` (${e.strength})` : "";
        add(p, e.seconds, tId, "shot", `Shot by ${e.playerName ?? "?"}.`);
        const gameOver = p >= 4; // sudden-death OT winner
        add(p, e.seconds, tId, "goal",
          `GOAL${tag} scored by ${e.playerName ?? "?"}${assistNames.length ? ` assisted by ${assistNames.join(" and ")}` : " unassisted"}.${gameOver ? " Game over." : ""}`, true);
        if (!gameOver) add(p, e.seconds + 1, null, "faceoff", `${center(home).name} wins face-off versus ${center(away).name} in neutral zone.`);
      } else if (e.type === "PENALTY") {
        const m = e.meta as { penalty?: string; minutes?: number; severity?: string } | undefined;
        if (m?.penalty === "Fighting") continue; // paired into a fight line below
        add(p, e.seconds, tId, "penalty", `${e.playerName} penalty for ${m?.penalty ?? "infraction"} (${m?.minutes ?? 2} min, ${m?.severity ?? "Minor"}).`, true);
      }
    }

    // fights (pair the two Fighting majors)
    const fights = stream.filter((x) => x.period === p && x.type === "PENALTY" && (x.meta as { penalty?: string } | undefined)?.penalty === "Fighting");
    for (let i = 0; i + 1 < fights.length; i += 2) {
      add(p, fights[i].seconds, null, "fight", `Fight: ${fights[i].playerName} versus ${fights[i + 1].playerName}. Both receive 5-minute majors.`, true);
    }
    // injuries
    for (const inj of result.injuries.filter((x) => x.period === p)) {
      add(p, inj.seconds, inj.teamId, "injury", `${inj.playerName} injured — ${inj.desc}${inj.mechanism === "Hit" && inj.byName ? ` (hit by ${inj.byName})` : ` (${inj.mechanism.toLowerCase()})`} — ${inj.severity}, out ~${inj.days} day${inj.days === 1 ? "" : "s"}.`, true);
    }

    // no end-of-period line once a sudden-death OT goal has ended the game
    const otEnded = p >= 4 && stream.some((e) => e.period === p && e.type === "GOAL");
    if (p <= 3 || (p === 4 && !otEnded)) add(p, PERIOD_SECONDS, null, "period", `End of the ${label}.`, p <= 3);
  }

  if (result.endedIn === "SO") add(5, 0, null, "period", `Shootout — won by ${sideOf(result.winner).name}.`, true);

  return events.sort((a, b) => a.period - b.period || a.seconds - b.seconds);
}
