// Team DNA — an auto-generated identity for each club, derived from the actual
// roster (attributes), and coloured by results. No manual bonus: six style
// dimensions, each normalised against the league so the bars read as "how this
// club compares", plus a one-line identity label and its biggest strength/gap.

import { prisma } from "./prisma";
import { computeStandings } from "./sim/standings";

export type DnaBar = { label: string; value: number }; // value 0..100 (league-relative)
export type TeamDna = {
  bars: DnaBar[];
  identity: string;
  blurb: string;
  strength: string;
  weakness: string;
  record: string | null;
};

const DIMS = ["Speed", "Skill", "Physical", "Defense", "Transition", "Forecheck"] as const;
type Dim = (typeof DIMS)[number];

type Sk = { ck: number | null; st: number | null; en: number | null; sk: number | null; pa: number | null; sc: number | null; df: number | null; di: number | null; overall: number | null };

const n = (v: number | null) => v ?? 50;
function rawMetrics(sk: Sk): Record<Dim, number> {
  return {
    Speed: n(sk.sk),
    Skill: 0.55 * n(sk.sc) + 0.45 * n(sk.pa),
    Physical: 0.6 * n(sk.ck) + 0.4 * n(sk.st),
    Defense: 0.6 * n(sk.df) + 0.4 * n(sk.di),
    Transition: 0.5 * n(sk.sk) + 0.5 * n(sk.pa),
    Forecheck: 0.55 * n(sk.ck) + 0.45 * n(sk.en),
  };
}

export async function teamDna(teamId: number): Promise<TeamDna | null> {
  const team = await prisma.team.findUnique({ where: { id: teamId }, select: { id: true, league: true } });
  if (!team) return null;
  const league = team.league ?? "NHL";

  // every club's ice-defining skaters (weighted by overall so stars define identity)
  const skaters = await prisma.player.findMany({
    where: { rosterType: league === "AHL" ? "AHL" : "NHL", isGoalie: false, team: { league, isAffiliate: false } },
    select: { teamId: true, ck: true, st: true, en: true, sk: true, pa: true, sc: true, df: true, di: true, overall: true },
  });
  const byTeam = new Map<number, Sk[]>();
  for (const s of skaters) { const a = byTeam.get(s.teamId) ?? []; a.push(s); byTeam.set(s.teamId, a); }

  // weighted raw metric per team per dimension
  const teamRaw = new Map<number, Record<Dim, number>>();
  for (const [tid, list] of byTeam) {
    const acc = Object.fromEntries(DIMS.map((d) => [d, 0])) as Record<Dim, number>;
    let wt = 0;
    for (const s of list) {
      const w = Math.max(1, n(s.overall) - 40); // heavier weight to better players
      const m = rawMetrics(s);
      for (const d of DIMS) acc[d] += m[d] * w;
      wt += w;
    }
    for (const d of DIMS) acc[d] = wt ? acc[d] / wt : 50;
    teamRaw.set(tid, acc);
  }

  const mine = teamRaw.get(teamId);
  if (!mine) return null;

  // min-max normalise each dimension across the league → 0..100 relative bars
  const bars: DnaBar[] = DIMS.map((d) => {
    const vals = [...teamRaw.values()].map((r) => r[d]);
    const lo = Math.min(...vals), hi = Math.max(...vals);
    const value = hi > lo ? Math.round(((mine[d] - lo) / (hi - lo)) * 100) : 50;
    return { label: d, value };
  });
  const barOf = (d: Dim) => bars.find((b) => b.label === d)!.value;

  // identity from the standout dimensions
  const ranked = [...bars].sort((a, b) => b.value - a.value);
  const strength = ranked[0].label, weakness = ranked[ranked.length - 1].label;
  const hi = (d: Dim, t = 62) => barOf(d) >= t;
  let identity: string;
  if (hi("Speed") && hi("Skill") && barOf("Transition") >= 55) identity = "Fast Possession Team";
  else if (hi("Physical") && hi("Forecheck")) identity = "Heavy Forechecking Team";
  else if (hi("Defense") && barOf("Skill") < 48) identity = "Defensive Structure";
  else if (hi("Skill") && barOf("Defense") >= 55) identity = "Skilled Two-Way Team";
  else if (hi("Speed") && hi("Transition")) identity = "Speed & Transition";
  else if (hi("Physical")) identity = "Big & Heavy";
  else if (hi("Defense")) identity = "Defence-First";
  else if (hi("Skill")) identity = "Skill-Driven";
  else identity = `${strength}-Leaning`;

  // colour it with results
  let record: string | null = null;
  try {
    const standings = await computeStandings("2026-27", league);
    const s = standings.find((x) => x.teamId === teamId);
    if (s && s.gp > 0) record = `${s.w}-${s.l}-${s.otl} · ${s.points} pts`;
  } catch { /* preseason: no record yet */ }

  const blurb = `Built around its ${strength.toLowerCase()}${barOf(weakness) < 35 ? `, with ${weakness.toLowerCase()} the clear area to address` : ""}. Identity emerges from the roster — no manual bonus.`;

  return { bars, identity, blurb, strength, weakness, record };
}
