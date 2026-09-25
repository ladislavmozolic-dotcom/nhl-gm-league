// All-Star Skills Competition — pure, deterministic (seeded) event models built on
// the same ratings the sim and EDGE Tracking use, so a fast skater in EDGE is
// fast here too. No DB. Runner: lib/all-star-server.ts.
import { RNG } from "./sim/rng";

export type SkillsEntrant = {
  id: number; name: string; side: "A" | "B"; teamCode: string | null; isGoalie: boolean;
  sk: number; sc: number; st: number; pa: number; di: number; // skater ratings (50 when unknown)
  gq: number; // goalie quality 0..100 (goalies only)
};

export type SkillsRow = { id: number; name: string; side: "A" | "B"; teamCode: string | null; value: number; display: string; detail?: string };
export type SkillsEventResult = { key: SkillsKey; title: string; unit: string; lowerIsBetter: boolean; rows: SkillsRow[]; winner: SkillsRow | null; winnerSide: "A" | "B" | null };
export type SkillsResult = { events: SkillsEventResult[]; points: { A: number; B: number }; seed: number };

export type SkillsKey = "fastest" | "hardest" | "accuracy" | "passing" | "breakaway";
export const SKILLS_EVENTS: { key: SkillsKey; title: string; about: string }[] = [
  { key: "fastest", title: "Fastest Skater", about: "One lap of the rink — skating (SK) sets the pace." },
  { key: "hardest", title: "Hardest Shot", about: "Two slap shots each, best counts — shooting (SC) and strength (ST)." },
  { key: "accuracy", title: "Accuracy Shooting", about: "Hit all four corner targets as fast as possible — shooting (SC) and deking (DI)." },
  { key: "passing", title: "Passing Challenge", about: "Timed passing course — passing (PA)." },
  { key: "breakaway", title: "Breakaway Challenge", about: "Every shooter gets 3 breakaways against the other team's All-Star goalies." },
];

const r2 = (n: number) => Math.round(n * 100) / 100;
const noise = (rng: RNG, spread: number) => (rng.next() - 0.5) * 2 * spread;

function rank(key: SkillsKey, title: string, unit: string, lowerIsBetter: boolean, rows: SkillsRow[]): SkillsEventResult {
  rows.sort((a, b) => (lowerIsBetter ? a.value - b.value : b.value - a.value));
  const winner = rows[0] ?? null;
  return { key, title, unit, lowerIsBetter, rows, winner, winnerSide: winner?.side ?? null };
}

/** Top N entrants per side by a rating — who each team sends to an event. */
export function pickEntrants(all: SkillsEntrant[], by: (e: SkillsEntrant) => number, perSide: number): SkillsEntrant[] {
  const out: SkillsEntrant[] = [];
  for (const side of ["A", "B"] as const) out.push(...all.filter((e) => e.side === side && !e.isGoalie).sort((a, b) => by(b) - by(a)).slice(0, perSide));
  return out;
}

export function runSkills(entrants: SkillsEntrant[], seed: number, perSide = 3): SkillsResult {
  const rng = new RNG(seed);
  const events: SkillsEventResult[] = [];
  const row = (e: SkillsEntrant, value: number, display: string, detail?: string): SkillsRow => ({ id: e.id, name: e.name, side: e.side, teamCode: e.teamCode, value, display, detail });

  // Fastest Skater — lap time, mirrors EDGE's SK → top-speed curve (SK 99 ≈ 13.1 s, SK 50 ≈ 14.6 s)
  events.push(rank("fastest", "Fastest Skater", "s", true, pickEntrants(entrants, (e) => e.sk, perSide).map((e) => {
    const t = r2(14.6 - ((e.sk - 50) / 49) * 1.5 + noise(rng, 0.22));
    return row(e, t, `${t.toFixed(2)} s`);
  })));

  // Hardest Shot — best of two slap shots (EDGE's slap base 88 mph + SC, plus full-effort + ST)
  events.push(rank("hardest", "Hardest Shot", "mph", false, pickEntrants(entrants, (e) => e.sc * 0.55 + e.st * 0.45, perSide).map((e) => {
    const shot = () => 94 + (e.sc - 60) * 0.22 + (e.st - 60) * 0.2 + noise(rng, 2.5);
    const a = r2(shot()), b = r2(shot());
    const best = Math.max(a, b);
    return row(e, r2(best), `${best.toFixed(1)} mph`, `${a.toFixed(1)} / ${b.toFixed(1)}`);
  })));

  // Accuracy Shooting — shots until all 4 targets fall; each shot hits with p(SC, DI)
  events.push(rank("accuracy", "Accuracy Shooting", "s", true, pickEntrants(entrants, (e) => e.sc * 0.7 + e.di * 0.3, perSide).map((e) => {
    const p = Math.min(0.92, Math.max(0.35, 0.3 + (e.sc * 0.7 + e.di * 0.3) / 160));
    let hits = 0, shots = 0;
    while (hits < 4 && shots < 20) { shots++; if (rng.next() < p) hits++; }
    const t = r2(shots * 1.55 + 2.2 + noise(rng, 0.6));
    return row(e, t, `${t.toFixed(2)} s`, `${shots} shots`);
  })));

  // Passing Challenge — course time from PA
  events.push(rank("passing", "Passing Challenge", "s", true, pickEntrants(entrants, (e) => e.pa, perSide).map((e) => {
    const t = r2(62 - (e.pa - 50) * 0.42 + noise(rng, 2.2));
    return row(e, t, `${t.toFixed(2)} s`);
  })));

  // Breakaway Challenge — every shooter, 3 attempts vs the OTHER side's goalies
  const goalies = entrants.filter((e) => e.isGoalie);
  const shooters = pickEntrants(entrants, (e) => e.sc * 0.6 + e.di * 0.4, perSide);
  const saves = new Map<number, { faced: number; saved: number }>();
  const bRows = shooters.map((s) => {
    const opp = goalies.filter((g) => g.side !== s.side);
    let goals = 0;
    for (let i = 0; i < 3; i++) {
      const g = opp[i % Math.max(1, opp.length)];
      const skill = (s.sc * 0.6 + s.di * 0.4) - (g ? g.gq : 70);
      const p = Math.min(0.8, Math.max(0.2, 0.45 + skill * 0.012));
      const scored = rng.next() < p;
      if (scored) goals++;
      if (g) { const r = saves.get(g.id) ?? { faced: 0, saved: 0 }; r.faced++; if (!scored) r.saved++; saves.set(g.id, r); }
    }
    return row(s, goals, `${goals}/3`);
  });
  // tied at the top → sudden-death shoot-off between the leaders (up to 6 rounds)
  const top = Math.max(0, ...bRows.map((r) => r.value));
  let tied = bRows.filter((r) => r.value === top);
  for (let round = 0; tied.length > 1 && round < 6; round++) {
    const scored = tied.filter((t) => { const s = shooters.find((x) => x.id === t.id)!; return rng.next() < Math.min(0.8, Math.max(0.2, 0.45 + ((s.sc * 0.6 + s.di * 0.4) - 75) * 0.012)); });
    if (scored.length >= 1) tied = scored.length < tied.length ? scored : tied;
  }
  if (tied.length) { tied[0].value += 0.5; tied[0].detail = bRows.filter((r) => Math.floor(r.value) === top).length > 1 ? "won the shoot-off" : undefined; }
  const breakaway = rank("breakaway", "Breakaway Challenge", "goals", false, bRows);
  // goalies: best save %, shown as extra rows after the shooters
  const gRows = goalies.map((g) => { const r = saves.get(g.id) ?? { faced: 0, saved: 0 }; return row(g, r.faced ? r.saved / r.faced : 0, `${r.saved}/${r.faced} saves`, "goalie"); }).sort((a, b) => b.value - a.value);
  breakaway.rows.push(...gRows);
  events.push(breakaway);

  const points = { A: 0, B: 0 };
  for (const e of events) if (e.winnerSide) points[e.winnerSide]++;
  return { events, points, seed };
}
