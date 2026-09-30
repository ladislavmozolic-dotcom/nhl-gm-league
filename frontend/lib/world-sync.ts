import { prisma } from "@/lib/prisma";
import { seedWorldLeagueCatalog } from "@/lib/world-catalog";
import { importAhlSeason, importOhlSeason, importQmjhlSeason, importWhlSeason } from "@/lib/world-import-hockeytech";
import { importNcaaSeason } from "@/lib/world-import-ncaa";
import { importLiigaProspects } from "@/lib/world-import-liiga";
import { importCzechExtraligaProspects, importShlProspects } from "@/lib/world-import-europe";
import { importEuropeanJuniorLeagues } from "@/lib/world-import-juniors";
import { importRussianProspects } from "@/lib/world-import-russia";
import { importKhlLeague } from "@/lib/world-import-khl";
import { importDelLeague } from "@/lib/world-import-del";
import { reconcileAllProspects } from "@/lib/world-player-identity";

/**
 * Executes the complete Around the World pipeline:
 * 1. Seeds/refreshes the competition catalog
 * 2. CHL Junior Leagues (WHL, OHL, QMJHL via HockeyTech)
 * 3. AHL (American Hockey League via HockeyTech)
 * 4. NCAA Division I rosters & club assignments (pre-season)
 * 5. European Senior & Junior Leagues (Liiga, SHL, Czechia, Slovakia, Juniors, DEL)
 * 6. Russian Leagues (KHL, MHL, VHL) & Global Player Profiles
 * 7. Cross-source prospect identity reconciliation
 */
export async function runFullWorldSync() {
  await seedWorldLeagueCatalog();
  // Ensure the database strictly retains only the active 2026-27 season stats
  await prisma.worldPlayerSeasonStat.deleteMany({
    where: { NOT: { season: "2026-27" } },
  });
  const chl = await Promise.all([
    importWhlSeason().catch((e) => ({ error: (e as Error).message })),
    importOhlSeason().catch((e) => ({ error: (e as Error).message })),
    importQmjhlSeason().catch((e) => ({ error: (e as Error).message })),
  ]);
  const ahl = await importAhlSeason().catch((e) => ({ error: (e as Error).message }));
  const ncaa = await importNcaaSeason().catch((e) => ({ error: (e as Error).message }));
  const [liiga, shl, cze, juniors] = await Promise.all([
    importLiigaProspects().catch((e) => ({ error: (e as Error).message })),
    importShlProspects().catch((e) => ({ error: (e as Error).message })),
    importCzechExtraligaProspects().catch((e) => ({ error: (e as Error).message })),
    importEuropeanJuniorLeagues().catch((e) => ({ error: (e as Error).message })),
  ]);
  const russia = await importRussianProspects().catch((e) => ({ error: (e as Error).message }));
  const khl = await importKhlLeague().catch((e) => ({ error: (e as Error).message }));
  const del = await importDelLeague().catch((e) => ({ error: (e as Error).message }));
  const reconcile = await reconcileAllProspects().catch((e) => ({ error: (e as Error).message }));

  return {
    success: true,
    timestamp: new Date().toISOString(),
    chl,
    ahl,
    ncaa,
    liiga,
    shl,
    cze,
    juniors,
    russia,
    khl,
    del,
    reconcile,
  };
}
