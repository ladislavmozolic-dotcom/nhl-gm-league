// Post-hoc play-by-play generator. Produces a chronological, NHL-style event log
// that is consistent with an already-simulated GameResult (same shots, goals,
// penalties). It does NOT change the box score — a narrative layer on top.

import { RNG } from "./rng";
import type { GameResult, SimTeam, SimSkater, PbpEvent, PbpKind } from "./types";

const PERIOD_SECONDS = 1200;
const fmt = (s: number) => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, "0")}`;

const centers = (t: SimTeam) => {
  const c = t.forwards.filter((f) => f.isCenter);
  return c.length ? c : t.forwards;
};
const pool = (t: SimTeam) => [...t.forwards, ...t.defense];

export function generatePlayByPlay(result: GameResult, home: SimTeam, away: SimTeam): PbpEvent[] {
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
      add(p, inj.seconds, inj.teamId, "injury", `${inj.playerName} injured (${inj.desc}) — out ~${inj.days} day${inj.days === 1 ? "" : "s"}.`, true);
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
