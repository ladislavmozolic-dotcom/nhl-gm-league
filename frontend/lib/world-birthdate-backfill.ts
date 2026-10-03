import { prisma } from "@/lib/prisma";
import { normalizeWorldName } from "@/lib/world-player-identity";
import { scrapeEpPlayer } from "@/lib/ep-scraper";

const UA = { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)" };

async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const i = index++;
      results[i] = await fn(items[i]);
    }
  }
  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

/**
 * Fills missing birth dates on linked real-world profiles:
 * 1. From EliteProspects for players with an epUrl (prioritizing active players with season stats).
 * 2. From the public NHL API for players with prospects links / nhlId.
 */
export async function backfillWorldBirthDates(limit = 120) {
  // 1. EP backfill: Prioritize players with an epUrl who are active in current stats
  const epPlayers = await prisma.worldPlayer.findMany({
    where: {
      birthDate: null,
      epUrl: { not: null },
    },
    select: { id: true, name: true, epUrl: true },
    orderBy: [
      { stats: { _count: "desc" } },
      { id: "asc" },
    ],
    take: Math.min(limit, 100),
  });

  let epFilled = 0;
  if (epPlayers.length > 0) {
    await mapPool(epPlayers, 4, async (p) => {
      try {
        if (!p.epUrl) return;
        const res = await scrapeEpPlayer(p.epUrl);
        if (res.success && res.dateOfBirth) {
          await prisma.worldPlayer.update({
            where: { id: p.id },
            data: { birthDate: res.dateOfBirth },
          });
          epFilled++;
        }
      } catch {
        // skip on error
      }
    });
  }

  // 2. NHL API backfill for remaining quota / players with prospect links
  const nhlLimit = Math.max(20, limit - epPlayers.length);
  const nhlPlayers = await prisma.worldPlayer.findMany({
    where: { birthDate: null, prospects: { some: {} } },
    select: { id: true, name: true, normalizedName: true, prospects: { select: { nhlId: true }, take: 1 } },
    take: nhlLimit,
  });

  let nhlFilled = 0;
  for (const wp of nhlPlayers) {
    try {
      let nhlId = wp.prospects[0]?.nhlId ? String(wp.prospects[0].nhlId) : null;
      if (!nhlId) {
        const res = await fetch(
          `https://search.d3.nhle.com/api/v1/search/player?culture=en-us&limit=10&q=${encodeURIComponent(wp.name)}`,
          { headers: UA, cache: "no-store", signal: AbortSignal.timeout(6_000) }
        );
        if (!res.ok) continue;
        const list = (await res.json()) as Array<{ playerId: string; name: string }>;
        const exact = list.filter((x) => normalizeWorldName(x.name) === wp.normalizedName);
        if (exact.length !== 1) continue;
        nhlId = String(exact[0].playerId);
      }
      const res = await fetch(`https://api-web.nhle.com/v1/player/${nhlId}/landing`, {
        headers: UA,
        cache: "no-store",
        signal: AbortSignal.timeout(6_000),
      });
      if (!res.ok) continue;
      const landing = (await res.json()) as { birthDate?: string };
      if (!landing.birthDate) continue;
      await prisma.worldPlayer.update({ where: { id: wp.id }, data: { birthDate: landing.birthDate } });
      nhlFilled++;
    } catch {
      // skip this player; the next run retries
    }
  }

  return {
    checked: epPlayers.length + nhlPlayers.length,
    epFilled,
    nhlFilled,
    filled: epFilled + nhlFilled,
  };
}
