// NHL on-ice officials — the real 2025-26 roster (44 referees, 39 linesmen; Wikipedia
// "List of NHL on-ice officials", sourced from Scouting The Refs) with each referee's
// real penalties per game (Scouting The Refs 2025-26 referee stats).
//
// Strictness = his penalties/game ÷ the league mean, shrunk toward 1 for small
// samples (weight games/(games+30)), so a crew of two refs scales how many
// infractions get called by roughly ±10 %. Every NHL game gets two referees and
// two linesmen; nobody works two games on the same night; minor-league (AHL)
// officials work less, and the playoffs get only full-time referees.
import { prisma } from "./prisma";
import roster from "./data/nhl-officials-2025-26.json";

type RosterRow = { name: string; number: number | null; country: string; role: "REF" | "LINESMAN"; minor: boolean; penaltiesPerGame?: number; sampleGames?: number };
const SHRINK_GAMES = 30;

export async function seedOfficials(): Promise<number> {
  const rows = roster as RosterRow[];
  const refs = rows.filter((r) => r.role === "REF" && r.penaltiesPerGame && r.sampleGames);
  const totalG = refs.reduce((t, r) => t + r.sampleGames!, 0);
  const mean = refs.reduce((t, r) => t + r.penaltiesPerGame! * r.sampleGames!, 0) / Math.max(1, totalG);
  for (const r of rows) {
    const strict = r.role === "REF" && r.penaltiesPerGame && r.sampleGames
      ? 1 + (r.penaltiesPerGame / mean - 1) * (r.sampleGames / (r.sampleGames + SHRINK_GAMES))
      : 1;
    const data = { number: r.number, country: r.country, role: r.role, minor: r.minor, penaltiesPerGame: r.penaltiesPerGame ?? null, sampleGames: r.sampleGames ?? null, strictness: Math.round(strict * 1000) / 1000 };
    await prisma.official.upsert({ where: { name: r.name }, update: data, create: { name: r.name, ...data } });
  }
  return rows.length;
}

export type Crew = { ids: number[]; penaltyMult: number; evenUp: number };

const hash = (n: number) => { let x = (n ^ 0x9e3779b9) >>> 0; x = Math.imul(x ^ (x >>> 16), 0x85ebca6b) >>> 0; x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35) >>> 0; return ((x ^ (x >>> 16)) >>> 0) / 4294967296; };

/** Crews for one night's games (deterministic per game id; no double-booking). */
export async function assignCrews(gameIds: number[], opts: { playoffs?: boolean } = {}): Promise<Map<number, Crew>> {
  const out = new Map<number, Crew>();
  if (!gameIds.length) return out;
  const all = await prisma.official.findMany({ where: { active: true }, select: { id: true, role: true, minor: true, strictness: true, evenUp: true } });
  if (!all.length) return out;
  const used = new Set<number>();
  const draw = (role: "REF" | "LINESMAN", salt: number) => {
    const pool = all.filter((o) => o.role === role && !used.has(o.id) && !(opts.playoffs && o.minor));
    if (!pool.length) return null;
    const w = pool.map((o) => (o.minor ? 0.3 : 1) * (0.2 + hash(o.id * 7919 + salt)));
    let r = hash(salt * 31 + 17) * w.reduce((a, b) => a + b, 0);
    for (let i = 0; i < pool.length; i++) { r -= w[i]; if (r <= 0) { used.add(pool[i].id); return pool[i]; } }
    used.add(pool[pool.length - 1].id); return pool[pool.length - 1];
  };
  for (const gid of gameIds) {
    const r1 = draw("REF", gid * 4 + 1), r2 = draw("REF", gid * 4 + 2), l1 = draw("LINESMAN", gid * 4 + 3), l2 = draw("LINESMAN", gid * 4 + 4);
    const refs = [r1, r2].filter((x): x is NonNullable<typeof x> => !!x);
    if (!refs.length) continue;
    out.set(gid, {
      ids: [r1?.id, r2?.id, l1?.id, l2?.id].filter((x): x is number => x != null),
      penaltyMult: refs.reduce((t, o) => t + o.strictness, 0) / refs.length,
      evenUp: refs.reduce((t, o) => t + o.evenUp, 0) / refs.length,
    });
  }
  return out;
}

/** Officials of one game, in crew order (refs first). */
export async function officialsOf(ids: number[]) {
  if (!ids.length) return [];
  const rows = await prisma.official.findMany({ where: { id: { in: ids } } });
  return ids.map((id) => rows.find((r) => r.id === id)).filter((r): r is NonNullable<typeof r> => !!r);
}
