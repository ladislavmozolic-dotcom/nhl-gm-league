import { prisma } from "@/lib/prisma";
import { normalizeWorldName } from "@/lib/world-player-identity";

const UA = { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)" };

/**
 * Fills missing birth dates on linked real-world profiles from the public NHL
 * API.  Only an exact (accent-insensitive) full-name match that is unique in the
 * search results is accepted, so a namesake can never lend the wrong age to a
 * prospect's grade.  Returns how many profiles were filled.
 */
export async function backfillWorldBirthDates(limit = 120) {
  const players = await prisma.worldPlayer.findMany({
    where: { birthDate: null, prospects: { some: {} } },
    select: { id: true, name: true, normalizedName: true, prospects: { select: { nhlId: true }, take: 1 } },
    take: limit,
  });
  let filled = 0;
  for (const wp of players) {
    try {
      let nhlId = wp.prospects[0]?.nhlId ? String(wp.prospects[0].nhlId) : null;
      if (!nhlId) {
        const res = await fetch(`https://search.d3.nhle.com/api/v1/search/player?culture=en-us&limit=10&q=${encodeURIComponent(wp.name)}`, { headers: UA, cache: "no-store", signal: AbortSignal.timeout(6_000) });
        if (!res.ok) continue;
        const list = (await res.json()) as Array<{ playerId: string; name: string }>;
        const exact = list.filter((x) => normalizeWorldName(x.name) === wp.normalizedName);
        if (exact.length !== 1) continue;
        nhlId = String(exact[0].playerId);
      }
      const res = await fetch(`https://api-web.nhle.com/v1/player/${nhlId}/landing`, { headers: UA, cache: "no-store", signal: AbortSignal.timeout(6_000) });
      if (!res.ok) continue;
      const landing = (await res.json()) as { birthDate?: string };
      if (!landing.birthDate) continue;
      await prisma.worldPlayer.update({ where: { id: wp.id }, data: { birthDate: landing.birthDate } });
      filled++;
    } catch {
      // skip this player; the next run retries
    }
  }
  return { checked: players.length, filled };
}
