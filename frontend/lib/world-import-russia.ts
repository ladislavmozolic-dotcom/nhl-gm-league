import { prisma } from "@/lib/prisma";
import { epSearchName } from "@/lib/playerName";
import { resolveWorldPlayer } from "@/lib/world-player-identity";
import { scrapeEpPlayer, mapEpLeagueToCode } from "@/lib/ep-scraper";

const norm = (s: string) =>
  epSearchName(s)
    .replace(/\s*\([^)]*\)/g, "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function formatSeason(seasonInt: number | string | undefined): string {
  const s = String(seasonInt ?? "");
  if (s.length === 8) {
    return `${s.slice(0, 4)}-${s.slice(6, 8)}`;
  }
  return "2025-26";
}

function getSearchVariations(name: string): string[] {
  const clean = name.replace(/\s*\([^)]*\)/g, "").trim();
  const variations: string[] = [clean];
  const parts = clean.split(" ");
  const first = parts[0] || "";
  const last = parts.slice(1).join(" ");

  let altLast = last;
  if (/yov$/i.test(last)) altLast = last.replace(/yov$/i, "ev");
  else if (/yev$/i.test(last)) altLast = last.replace(/yev$/i, "ev");
  else if (/ev$/i.test(last)) altLast = last.replace(/ev$/i, "yov");
  else if (/ov$/i.test(last)) altLast = last.replace(/ov$/i, "yov");

  let altFirst = first;
  if (/i$/i.test(first)) altFirst = first.replace(/i$/i, "y");
  else if (/y$/i.test(first)) altFirst = first.replace(/y$/i, "i");

  if (altLast !== last || altFirst !== first) {
    variations.push(`${altFirst} ${altLast}`.trim());
    if (altLast && !variations.includes(altLast)) variations.push(altLast);
  }
  if (last && !variations.includes(last)) {
    variations.push(last);
  }
  return variations;
}

const KNOWN_SPECIAL_PLAYERS: Record<string, {
  teamName: string;
  leagueCode: string;
  position: string;
  isGoalie: boolean;
  epUrl: string;
  season: string;
  gamesPlayed?: number;
  goals?: number;
  assists?: number;
  points?: number;
  wins?: number;
  savePercentage?: number;
  goalsAgainstAverage?: number;
}> = {
  "artemi pleshkov": {
    teamName: "SKA St. Petersburg",
    leagueCode: "KHL",
    position: "G",
    isGoalie: true,
    epUrl: "https://www.eliteprospects.com/player/589049/artemi-pleshkov",
    season: "2026-27",
    gamesPlayed: 4,
    wins: 3,
    savePercentage: 0.932,
    goalsAgainstAverage: 2.49,
  },
  "emil jarventie": {
    teamName: "Tappara U20",
    leagueCode: "FIN-U20",
    position: "LW",
    isGoalie: false,
    epUrl: "https://www.eliteprospects.com/player/540337/emil-jarventie",
    season: "2026-27",
    gamesPlayed: 6,
    goals: 10,
    assists: 1,
    points: 11,
  },
};

const LEAGUE_MAP: Record<string, string> = {
  "FIN-U20": "FIN-U20",
  KHL: "KHL",
  MHL: "MHL",
  VHL: "VHL",
  AHL: "AHL",
  ECHL: "ECHL",
  NCAA: "NCAA",
  LIIGA: "LIIGA",
  SHL: "SHL",
  OHL: "OHL",
  WHL: "WHL",
  QMJHL: "QMJHL",
  CZE: "CZE",
  SVK: "SVK",
  DEL: "DEL",
};

async function mapPool<T, R>(items: T[], concurrency: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let idx = 0;
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (idx < items.length) {
        const k = idx++;
        out[k] = await fn(items[k]);
      }
    })
  );
  return out;
}

export async function importRussianProspects() {
  const unlinked = await prisma.prospect.findMany({
    where: { worldPlayerId: null },
    select: { id: true, name: true, nhlId: true, epUrl: true, position: true, source: true, worldPlayerId: true },
  });

  const prospectMap = new Map<string, typeof unlinked>();
  for (const p of unlinked) {
    const k = norm(p.name);
    prospectMap.set(k, [...(prospectMap.get(k) ?? []), p]);
  }

  const uniqueCandidates = [...prospectMap.values()].map((list) => list.find((p) => p.nhlId) || list[0]);
  let imported = 0;

  await mapPool(uniqueCandidates, 8, async (prospect) => {
    try {
      const pKey = norm(prospect.name);

    // 1. Check known special players (e.g. Artemi Pleshkov)
    const special = KNOWN_SPECIAL_PLAYERS[pKey];
    if (special) {
      try {
        const targetLeague = await prisma.worldLeague.upsert({
          where: { code: special.leagueCode },
          update: { active: true },
          create: { code: special.leagueCode, name: special.leagueCode === "FIN-U20" ? "Finnish U20 SM-sarja" : special.leagueCode, country: "Finland", region: "Europe", active: true },
        });

        const slug = norm(special.teamName).replace(/ /g, "-");
        const team = await prisma.worldTeam.upsert({
          where: { leagueId_slug: { leagueId: targetLeague.id, slug } },
          update: { name: special.teamName },
          create: { leagueId: targetLeague.id, slug, name: special.teamName },
        });

        const { player } = await resolveWorldPlayer({
          provider: "manual",
          externalId: `special:${pKey.replace(/ /g, "-")}`,
          name: prospect.name.replace(/\s*\([^)]*\)/g, "").trim(),
          position: special.position,
          currentTeamId: team.id,
        });

        await prisma.worldPlayerSeasonStat.upsert({
          where: { playerId_leagueId_season: { playerId: player.id, leagueId: targetLeague.id, season: special.season } },
          update: {
            teamId: team.id,
            isGoalie: special.isGoalie,
            gamesPlayed: special.gamesPlayed ?? 0,
            goals: special.goals ?? 0,
            assists: special.assists ?? 0,
            points: special.points ?? 0,
            wins: special.wins ?? null,
            savePercentage: special.savePercentage ?? null,
            goalsAgainstAverage: special.goalsAgainstAverage ?? null,
            source: "manual-entry",
            syncedAt: new Date(),
          },
          create: {
            playerId: player.id,
            leagueId: targetLeague.id,
            teamId: team.id,
            season: special.season,
            isGoalie: special.isGoalie,
            gamesPlayed: special.gamesPlayed ?? 0,
            goals: special.goals ?? 0,
            assists: special.assists ?? 0,
            points: special.points ?? 0,
            wins: special.wins ?? null,
            savePercentage: special.savePercentage ?? null,
            goalsAgainstAverage: special.goalsAgainstAverage ?? null,
            source: "manual-entry",
          },
        });

        const allMatching = prospectMap.get(pKey) ?? [prospect];
        for (const m of allMatching) {
          if (m.worldPlayerId !== player.id) {
            await prisma.prospect.update({ where: { id: m.id }, data: { worldPlayerId: player.id } });
          }
          if ((m.epUrl || special.epUrl) && !player.epUrl) {
            await prisma.worldPlayer.update({ where: { id: player.id }, data: { epUrl: m.epUrl || special.epUrl } });
          }
        }
        imported++;
        return;
      } catch {
        // continue
      }
    }

    // 2. Search NHL API landing
    let nhlId = prospect.nhlId ? String(prospect.nhlId) : null;
    if (!nhlId) {
      const vars = getSearchVariations(prospect.name);
      const targetLast = norm(prospect.name.split(" ").slice(-1)[0]).replace(/yov$/, "ev").replace(/yev$/, "ev");
      const targetFirst = norm(prospect.name.split(" ")[0]).slice(0, 3);

      for (const q of vars) {
        try {
          const searchRes = await fetch(
            `https://search.d3.nhle.com/api/v1/search/player?culture=en-us&limit=10&q=${encodeURIComponent(q)}`,
            {
              headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)" },
              cache: "no-store",
              signal: AbortSignal.timeout(5_000),
            }
          );
          if (searchRes.ok) {
            const list = (await searchRes.json()) as Array<{ playerId: string; name: string }>;
            const match = list.find((x) => {
              const rNorm = norm(x.name);
              const rLast = rNorm.split(" ").slice(-1)[0];
              const rFirst = rNorm.split(" ")[0];
              return (
                (rLast === targetLast || rLast.includes(targetLast) || targetLast.includes(rLast)) &&
                (rFirst.startsWith(targetFirst) || targetFirst.startsWith(rFirst.slice(0, 3)))
              );
            });
            if (match?.playerId) {
              nhlId = String(match.playerId);
              break;
            }
          }
        } catch {
          // try next query variation
        }
      }
    }

    // 3. EP scraper fallback: if no nhlId found OR after NHL landing – try EP page.
    // We always want to try EP if the prospect has an epUrl, since EP has more accurate
    // current-season team assignments (especially for Russian leagues that block the NHL API).
    const epUrl = prospect.epUrl;

    if (!nhlId) {
      // No NHL profile at all → try EP directly
      if (!epUrl) return;
      const epResult = await scrapeEpPlayer(epUrl);
      if (!epResult.success || !epResult.season2627) {
        // At minimum set current club from EP even without stats
        if (epResult.success && epResult.currentTeam && epResult.currentLeague) {
          const leagueCode = mapEpLeagueToCode(epResult.currentLeague, null);
          const targetLeague = await prisma.worldLeague.upsert({
            where: { code: leagueCode },
            update: { active: true },
            create: {
              code: leagueCode,
              name: epResult.currentLeague,
              country: null,
              region: "Europe",
              active: true,
            },
          });
          const teamSlug = norm(epResult.currentTeam).replace(/ /g, "-");
          const team = await prisma.worldTeam.upsert({
            where: { leagueId_slug: { leagueId: targetLeague.id, slug: teamSlug } },
            update: { name: epResult.currentTeam },
            create: { leagueId: targetLeague.id, slug: teamSlug, name: epResult.currentTeam },
          });
          const { player } = await resolveWorldPlayer({
            provider: "ep-scraper",
            externalId: String(epResult.epId),
            name: prospect.name.replace(/\s*\([^)]*\)/g, "").trim(),
            position: epResult.position || prospect.position || null,
            birthDate: epResult.dateOfBirth || null,
            epUrl,
            currentTeamId: team.id,
          });
          const allMatching = prospectMap.get(pKey) ?? [prospect];
          for (const m of allMatching) {
            if (m.worldPlayerId !== player.id) {
              await prisma.prospect.update({ where: { id: m.id }, data: { worldPlayerId: player.id } });
            }
          }
          imported++;
        }
        return;
      }

      // We have 2026-27 stats from EP
      const s = epResult.season2627;
      const leagueCode = mapEpLeagueToCode(s.leagueName, s.leagueUrlPath);
      const isGoalie = (epResult.position || prospect.position || "").toUpperCase() === "G";

      const targetLeague = await prisma.worldLeague.upsert({
        where: { code: leagueCode },
        update: { active: true },
        create: {
          code: leagueCode,
          name: s.leagueName ?? leagueCode,
          country: null,
          region: leagueCode === "LIIGA" || leagueCode === "KHL" || leagueCode === "SHL" || leagueCode === "VHL" || leagueCode === "MHL" ? "Europe" : "North America",
          active: true,
        },
      });

      const teamName = s.teamName ?? "Unknown Club";
      const teamSlug = norm(teamName).replace(/ /g, "-");
      const team = await prisma.worldTeam.upsert({
        where: { leagueId_slug: { leagueId: targetLeague.id, slug: teamSlug } },
        update: { name: teamName },
        create: { leagueId: targetLeague.id, slug: teamSlug, name: teamName },
      });

      const { player } = await resolveWorldPlayer({
        provider: "ep-scraper",
        externalId: String(epResult.epId),
        name: prospect.name.replace(/\s*\([^)]*\)/g, "").trim(),
        position: epResult.position || prospect.position || null,
        birthDate: epResult.dateOfBirth || null,
        epUrl,
        currentTeamId: team.id,
      });

      if (leagueCode !== "NCAA") {
        await prisma.worldPlayerSeasonStat.upsert({
          where: { playerId_leagueId_season: { playerId: player.id, leagueId: targetLeague.id, season: "2026-27" } },
          update: {
            teamId: team.id,
            isGoalie,
            gamesPlayed: s.gp,
            goals: s.g,
            assists: s.a,
            points: s.pts,
            plusMinus: s.pm ?? null,
            penaltyMinutes: s.pim,
            wins: isGoalie ? (s.w ?? null) : null,
            savePercentage: isGoalie ? (s.svp ?? null) : null,
            goalsAgainstAverage: isGoalie ? (s.gaa ?? null) : null,
            shutouts: isGoalie ? (s.so ?? null) : null,
            source: "ep-scraper",
            syncedAt: new Date(),
          },
          create: {
            playerId: player.id,
            leagueId: targetLeague.id,
            teamId: team.id,
            season: "2026-27",
            isGoalie,
            gamesPlayed: s.gp,
            goals: s.g,
            assists: s.a,
            points: s.pts,
            plusMinus: s.pm ?? null,
            penaltyMinutes: s.pim,
            wins: isGoalie ? (s.w ?? null) : null,
            savePercentage: isGoalie ? (s.svp ?? null) : null,
            goalsAgainstAverage: isGoalie ? (s.gaa ?? null) : null,
            shutouts: isGoalie ? (s.so ?? null) : null,
            source: "ep-scraper",
          },
        });
      }

      const allMatching = prospectMap.get(pKey) ?? [prospect];
      for (const m of allMatching) {
        if (m.worldPlayerId !== player.id) {
          await prisma.prospect.update({ where: { id: m.id }, data: { worldPlayerId: player.id } });
        }
        if (epUrl && !player.epUrl) {
          await prisma.worldPlayer.update({ where: { id: player.id }, data: { epUrl } });
        }
      }
      imported++;
      return;
    }

    const landingRes = await fetch(`https://api-web.nhle.com/v1/player/${nhlId}/landing`, {
        headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)" },
        cache: "no-store",
        signal: AbortSignal.timeout(6_000),
      });
      if (!landingRes.ok) {
        // NHL API failed → fall back to EP scraper
        if (!epUrl) return;
        const epResult = await scrapeEpPlayer(epUrl);
        if (!epResult.success || !epResult.season2627) return;
        const s = epResult.season2627;
        const leagueCode = mapEpLeagueToCode(s.leagueName, s.leagueUrlPath);
        const isGoalie = (epResult.position || prospect.position || "").toUpperCase() === "G";
        const targetLeague = await prisma.worldLeague.upsert({
          where: { code: leagueCode },
          update: { active: true },
          create: { code: leagueCode, name: s.leagueName ?? leagueCode, country: null, region: "Europe", active: true },
        });
        const teamName = s.teamName ?? "Unknown Club";
        const teamSlug = norm(teamName).replace(/ /g, "-");
        const team = await prisma.worldTeam.upsert({
          where: { leagueId_slug: { leagueId: targetLeague.id, slug: teamSlug } },
          update: { name: teamName },
          create: { leagueId: targetLeague.id, slug: teamSlug, name: teamName },
        });
        const { player } = await resolveWorldPlayer({
          provider: "ep-scraper",
          externalId: String(epResult.epId),
          name: prospect.name.replace(/\s*\([^)]*\)/g, "").trim(),
          position: epResult.position || prospect.position || null,
          birthDate: epResult.dateOfBirth || null,
          epUrl,
          currentTeamId: team.id,
        });
        if (leagueCode !== "NCAA") {
          await prisma.worldPlayerSeasonStat.upsert({
            where: { playerId_leagueId_season: { playerId: player.id, leagueId: targetLeague.id, season: "2026-27" } },
            update: { teamId: team.id, isGoalie, gamesPlayed: s.gp, goals: s.g, assists: s.a, points: s.pts, plusMinus: s.pm, penaltyMinutes: s.pim, wins: isGoalie ? s.w : null, savePercentage: isGoalie ? s.svp : null, goalsAgainstAverage: isGoalie ? s.gaa : null, shutouts: isGoalie ? s.so : null, source: "ep-scraper", syncedAt: new Date() },
            create: { playerId: player.id, leagueId: targetLeague.id, teamId: team.id, season: "2026-27", isGoalie, gamesPlayed: s.gp, goals: s.g, assists: s.a, points: s.pts, plusMinus: s.pm, penaltyMinutes: s.pim, wins: isGoalie ? s.w : null, savePercentage: isGoalie ? s.svp : null, goalsAgainstAverage: isGoalie ? s.gaa : null, shutouts: isGoalie ? s.so : null, source: "ep-scraper" },
          });
        }
        const allMatching = prospectMap.get(pKey) ?? [prospect];
        for (const m of allMatching) {
          if (m.worldPlayerId !== player.id) await prisma.prospect.update({ where: { id: m.id }, data: { worldPlayerId: player.id } });
          if (epUrl && !player.epUrl) await prisma.worldPlayer.update({ where: { id: player.id }, data: { epUrl } });
        }
        imported++;
        return;
      }
      const landing = (await landingRes.json()) as {
        seasonTotals?: Array<{
          gameTypeId?: number;
          leagueAbbrev?: string;
          teamName?: { default?: string };
          gamesPlayed?: number;
          goals?: number;
          assists?: number;
          points?: number;
          plusMinus?: number;
          pim?: number;
          season?: number;
          wins?: number;
          losses?: number;
          otLosses?: number;
          savePctg?: number;
          goalsAgainstAvg?: number;
          shutouts?: number;
        }>;
        position?: string;
        birthDate?: string;
        birthCountry?: string;
      };

      const regularStats = (landing.seasonTotals ?? []).filter((s) => s.gameTypeId === 2);
      if (!regularStats.length) return;

      const lastStat = regularStats[regularStats.length - 1];
      const rawLeague = (lastStat.leagueAbbrev ?? "").toUpperCase();
      const leagueCode = LEAGUE_MAP[rawLeague] || rawLeague;

      // Find or create target league
      const targetLeague = await prisma.worldLeague.upsert({
        where: { code: leagueCode },
        update: { active: true },
        create: {
          code: leagueCode,
          name: leagueCode === "KHL" ? "Kontinental Hockey League" : leagueCode === "MHL" ? "Molodezhnaya Hockey League" : leagueCode,
          country: ["KHL", "MHL", "VHL"].includes(leagueCode) ? "Russia" : "International",
          region: ["KHL", "MHL", "VHL", "LIIGA", "SHL", "CZE", "SVK", "DEL"].includes(leagueCode) ? "Europe" : "North America",
          active: true,
        },
      });

      const teamName = lastStat.teamName?.default || "Unknown Club";
      const teamSlug = norm(teamName).replace(/ /g, "-");

      const team = await prisma.worldTeam.upsert({
        where: { leagueId_slug: { leagueId: targetLeague.id, slug: teamSlug } },
        update: { name: teamName },
        create: { leagueId: targetLeague.id, slug: teamSlug, name: teamName },
      });

      const isGoalie = landing.position === "G";
      const seasonLabel = "2026-27";

      const { player } = await resolveWorldPlayer({
        provider: "nhl-profile",
        externalId: nhlId,
        name: prospect.name.replace(/\s*\([^)]*\)/g, "").trim(),
        position: isGoalie ? "G" : landing.position ?? prospect.position ?? "F",
        birthDate: landing.birthDate ?? null,
        nationality: landing.birthCountry ?? null,
        currentTeamId: team.id,
      });

      // ONLY pull season stats if they actually belong to the current 2026-27 season!
      // (Per user rule: all leagues must only pull 2026-27 stats; older seasons are never pulled)
      const stat2627 = regularStats.find((s) => s.season === 20262027 || String(s.season).startsWith("2026"));

      // If NHL landing has no 2026-27 stats yet, try EP fallback for current stats
      if (!stat2627 && epUrl) {
        const epResult = await scrapeEpPlayer(epUrl);
        if (epResult.success && epResult.dateOfBirth && !player.birthDate) {
          await prisma.worldPlayer.update({ where: { id: player.id }, data: { birthDate: epResult.dateOfBirth } });
        }
        if (epResult.success && epResult.season2627) {
          const s = epResult.season2627;
          const epLeagueCode = mapEpLeagueToCode(s.leagueName, s.leagueUrlPath);
          if (epLeagueCode !== "NCAA") {
            const epLeague = await prisma.worldLeague.upsert({
              where: { code: epLeagueCode },
              update: { active: true },
              create: { code: epLeagueCode, name: s.leagueName ?? epLeagueCode, country: null, region: "Europe", active: true },
            });
            const epTeamName = s.teamName ?? "Unknown Club";
            const epTeamSlug = norm(epTeamName).replace(/ /g, "-");
            const epTeam = await prisma.worldTeam.upsert({
              where: { leagueId_slug: { leagueId: epLeague.id, slug: epTeamSlug } },
              update: { name: epTeamName },
              create: { leagueId: epLeague.id, slug: epTeamSlug, name: epTeamName },
            });
            await prisma.worldPlayerSeasonStat.upsert({
              where: { playerId_leagueId_season: { playerId: player.id, leagueId: epLeague.id, season: seasonLabel } },
              update: { teamId: epTeam.id, isGoalie, gamesPlayed: s.gp, goals: s.g, assists: s.a, points: s.pts, plusMinus: s.pm, penaltyMinutes: s.pim, wins: isGoalie ? s.w : null, savePercentage: isGoalie ? s.svp : null, goalsAgainstAverage: isGoalie ? s.gaa : null, shutouts: isGoalie ? s.so : null, source: "ep-scraper", syncedAt: new Date() },
              create: { playerId: player.id, leagueId: epLeague.id, teamId: epTeam.id, season: seasonLabel, isGoalie, gamesPlayed: s.gp, goals: s.g, assists: s.a, points: s.pts, plusMinus: s.pm, penaltyMinutes: s.pim, wins: isGoalie ? s.w : null, savePercentage: isGoalie ? s.svp : null, goalsAgainstAverage: isGoalie ? s.gaa : null, shutouts: isGoalie ? s.so : null, source: "ep-scraper" },
            });
            // Update currentTeam on the player profile
            if (epTeam.id !== player.currentTeamId) {
              await prisma.worldPlayer.update({ where: { id: player.id }, data: { currentTeamId: epTeam.id } });
            }
          }
        }
      }

      if (stat2627 && leagueCode !== "NCAA") {
        await prisma.worldPlayerSeasonStat.upsert({
          where: { playerId_leagueId_season: { playerId: player.id, leagueId: targetLeague.id, season: seasonLabel } },
          update: {
            teamId: team.id,
            isGoalie,
            gamesPlayed: stat2627.gamesPlayed ?? 0,
            goals: stat2627.goals ?? 0,
            assists: stat2627.assists ?? 0,
            points: stat2627.points ?? 0,
            plusMinus: stat2627.plusMinus ?? null,
            penaltyMinutes: stat2627.pim ?? 0,
            wins: isGoalie ? (stat2627.wins ?? null) : null,
            losses: isGoalie ? (stat2627.losses ?? null) : null,
            overtimeLosses: isGoalie ? (stat2627.otLosses ?? null) : null,
            savePercentage: isGoalie && stat2627.savePctg != null ? stat2627.savePctg : null,
            goalsAgainstAverage: isGoalie && stat2627.goalsAgainstAvg != null ? stat2627.goalsAgainstAvg : null,
            shutouts: isGoalie ? (stat2627.shutouts ?? null) : null,
            source: "official-feed",
            syncedAt: new Date(),
          },
          create: {
            playerId: player.id,
            leagueId: targetLeague.id,
            teamId: team.id,
            season: seasonLabel,
            isGoalie,
            gamesPlayed: stat2627.gamesPlayed ?? 0,
            goals: stat2627.goals ?? 0,
            assists: stat2627.assists ?? 0,
            points: stat2627.points ?? 0,
            plusMinus: stat2627.plusMinus ?? null,
            penaltyMinutes: stat2627.pim ?? 0,
            wins: isGoalie ? (stat2627.wins ?? null) : null,
            losses: isGoalie ? (stat2627.losses ?? null) : null,
            overtimeLosses: isGoalie ? (stat2627.otLosses ?? null) : null,
            savePercentage: isGoalie && stat2627.savePctg != null ? stat2627.savePctg : null,
            goalsAgainstAverage: isGoalie && stat2627.goalsAgainstAvg != null ? stat2627.goalsAgainstAvg : null,
            shutouts: isGoalie ? (stat2627.shutouts ?? null) : null,
            source: "official-feed",
          },
        });
      }

      const allMatching = prospectMap.get(pKey) ?? [prospect];
      for (const m of allMatching) {
        if (m.worldPlayerId !== player.id) {
          await prisma.prospect.update({ where: { id: m.id }, data: { worldPlayerId: player.id } });
        }
        if (m.epUrl && !player.epUrl) {
          await prisma.worldPlayer.update({ where: { id: player.id }, data: { epUrl: m.epUrl } });
        }
      }
      imported++;
    } catch {
      // ignore individual failure
    }
  });

  return { league: "Russia & Global Profiles", imported };
}

