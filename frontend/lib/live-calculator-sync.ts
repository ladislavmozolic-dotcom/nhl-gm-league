import { prisma } from "./prisma";
import { importMoneyPuckSkaters } from "./moneypuck-skater-import";
import { importMoneyPuckGoalies } from "./moneypuck-import-server";
import { fetchAhlSkaterStats, importAhlSkaterStats } from "./ahl-import";
import { fetchNhlCurrentStats, importNhlCurrentStats } from "./nhl-api-import";
import { importNhlEdgeSpeed } from "./nhl-edge-speed-import";
import { CURRENT_SEASON_START } from "./finance";
import { getLiveCalculatorConfig } from "./live-calculator-config";

export type SyncResult = {
  success: boolean;
  moneyPuckMatched: number;
  moneyPuckGoaliesMatched?: number;
  ahlMatchedCur: number;
  ahlMatchedLast: number;
  nhlSkaterMatched?: number;
  edgeSpeedMatched?: number;
  timestamp: string;
  error?: string;
};

/**
 * Synchronize live data from external sources:
 * - MoneyPuck (skaters & goalies CSVs)
 * - AHL HockeyTech (current season 90 and previous seasons)
 */
export async function syncLiveCalculatorData(): Promise<SyncResult> {
  try {
    const config = await getLiveCalculatorConfig();
    console.log("[LiveCalcSync] Starting live data ingestion...");

    // 1. Ingest MoneyPuck skaters data
    let mpMatched = 0;
    try {
      const mpRes = await importMoneyPuckSkaters();
      mpMatched = mpRes.matched;
      console.log(`[LiveCalcSync] MoneyPuck skaters synced: ${mpMatched} players matched.`);
    } catch (e: any) {
      console.warn("[LiveCalcSync] MoneyPuck skaters sync warning:", e?.message);
    }

    // 1b. Ingest MoneyPuck goalies data
    let mpGoaliesMatched = 0;
    try {
      const gRes = await importMoneyPuckGoalies();
      mpGoaliesMatched = gRes.matched;
      console.log(`[LiveCalcSync] MoneyPuck goalies synced: ${mpGoaliesMatched} goalies matched.`);
    } catch (e: any) {
      console.warn("[LiveCalcSync] MoneyPuck goalies sync warning:", e?.message);
    }

    // 1c. Ingest the CURRENT real season's skater box score (goals/assists/GP/TOI) from
    // the NHL.com stats API — feeds both the Player Calculator projection AND the FA
    // demand engine's in-season performance blend (see performanceOf in free-agency-server).
    let nhlSkaterMatched = 0;
    try {
      const seasonId = CURRENT_SEASON_START * 10000 + (CURRENT_SEASON_START + 1);
      const nhlRows = await fetchNhlCurrentStats(seasonId);
      if (nhlRows.length > 0) {
        const res = await importNhlCurrentStats(nhlRows);
        nhlSkaterMatched = res.matched;
      }
      console.log(`[LiveCalcSync] NHL current-season skater stats synced: ${nhlSkaterMatched} players matched.`);
    } catch (e: any) {
      console.warn("[LiveCalcSync] NHL current-season skater sync warning:", e?.message);
    }

    // 2. Ingest AHL stats
    let ahlCurMatched = 0;
    let ahlLastMatched = 0;
    try {
      const ahlCurRows = await fetchAhlSkaterStats(90); // Season 90 = 2025-26 AHL
      if (ahlCurRows.length > 0) {
        const res = await importAhlSkaterStats(ahlCurRows, "cur");
        ahlCurMatched = res.matched;
      }
      // Season 86 = 2024-25 AHL
      const ahlLastRows = await fetchAhlSkaterStats(86);
      if (ahlLastRows.length > 0) {
        const res = await importAhlSkaterStats(ahlLastRows, "last");
        ahlLastMatched = res.matched;
      }
      console.log(`[LiveCalcSync] AHL stats synced: ${ahlCurMatched} cur, ${ahlLastMatched} last.`);
    } catch (e: any) {
      console.warn("[LiveCalcSync] AHL sync warning:", e?.message);
    }

    // 3. Ingest NHL EDGE skating-speed percentiles (Next Gen SK) — was defined but
    // never actually wired into any sync path, so SK silently stayed blank for
    // every skater, rookies included, until this call.
    let edgeSpeedMatched = 0;
    try {
      const res = await importNhlEdgeSpeed();
      edgeSpeedMatched = res.matched;
      console.log(`[LiveCalcSync] NHL EDGE skating speed synced: ${edgeSpeedMatched} players matched.`);
    } catch (e: any) {
      console.warn("[LiveCalcSync] NHL EDGE speed sync warning:", e?.message);
    }

    const now = new Date();
    await prisma.liveCalcConfig.upsert({
      where: { id: 1 },
      update: { lastSyncedAt: now },
      create: { id: 1, lastSyncedAt: now },
    });

    return {
      success: true,
      moneyPuckMatched: mpMatched,
      moneyPuckGoaliesMatched: mpGoaliesMatched,
      ahlMatchedCur: ahlCurMatched,
      ahlMatchedLast: ahlLastMatched,
      nhlSkaterMatched,
      edgeSpeedMatched,
      timestamp: now.toISOString(),
    };
  } catch (err: any) {
    console.error("[LiveCalcSync] Sync error:", err);
    return {
      success: false,
      moneyPuckMatched: 0,
      ahlMatchedCur: 0,
      ahlMatchedLast: 0,
      timestamp: new Date().toISOString(),
      error: err?.message || String(err),
    };
  }
}
