// NHL API career games-played totals — the data the Next Gen EXPERIENCE param needs:
// api-web.nhle.com/v1/player/{nhlId}/landing → careerTotals.regularSeason.gamesPlayed
// and careerTotals.playoffs.gamesPlayed. Career-to-date, skaters and goalies alike.

import { prisma } from "./prisma";

const UA = "Mozilla/5.0 (compatible; ProfiNHL-League/1.0)";

async function fetchOne(nhlId: number): Promise<{ reg: number; po: number } | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15_000);
  try {
    const res = await fetch(`https://api-web.nhle.com/v1/player/${nhlId}/landing`, { headers: { "User-Agent": UA }, signal: ctrl.signal });
    if (!res.ok) return null;
    const d: any = await res.json();
    const reg = d?.careerTotals?.regularSeason?.gamesPlayed;
    const po = d?.careerTotals?.playoffs?.gamesPlayed;
    if (reg == null && po == null) return null;
    return { reg: reg ?? 0, po: po ?? 0 };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Pull career regular-season + playoff GP for every player with an nhlId. */
export async function importNhlCareerGP(): Promise<{ total: number; matched: number }> {
  const players = await prisma.player.findMany({ where: { nhlId: { not: null } }, select: { id: true, nhlId: true } });
  let matched = 0;
  // modest sequential pace to stay friendly to the public API
  for (const p of players) {
    const gp = await fetchOne(p.nhlId!);
    if (!gp) continue;
    await prisma.player.update({ where: { id: p.id }, data: { careerGP: gp } });
    matched++;
  }
  return { total: players.length, matched };
}
