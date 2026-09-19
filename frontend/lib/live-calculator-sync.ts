import { prisma } from "./prisma";
import { importMoneyPuckSkaters } from "./moneypuck-skater-import";
import { fetchAhlSkaterStats, importAhlSkaterStats } from "./ahl-import";
import { getLiveCalculatorConfig } from "./live-calculator-config";

export type SyncResult = {
  success: boolean;
  moneyPuckMatched: number;
  ahlMatchedCur: number;
  ahlMatchedLast: number;
  timestamp: string;
  error?: string;
};

/**
 * Synchronize live data from external sources:
 * - MoneyPuck (2025 and 2024 skaters & teams CSVs)
 * - AHL HockeyTech (current season 90 and previous seasons)
 */
export async function syncLiveCalculatorData(): Promise<SyncResult> {
  try {
    const config = await getLiveCalculatorConfig();
    console.log("[LiveCalcSync] Starting live data ingestion...");

    // 1. Ingest MoneyPuck data (covers goals, assists, xG, hits, blocks, situational splits)
    let mpMatched = 0;
    try {
      const mpRes = await importMoneyPuckSkaters();
      mpMatched = mpRes.matched;
      console.log(`[LiveCalcSync] MoneyPuck synced: ${mpMatched} players matched across seasons.`);
    } catch (e: any) {
      console.warn("[LiveCalcSync] MoneyPuck sync warning:", e?.message);
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

    const now = new Date();
    await prisma.liveCalcConfig.upsert({
      where: { id: 1 },
      update: { lastSyncedAt: now },
      create: { id: 1, lastSyncedAt: now },
    });

    return {
      success: true,
      moneyPuckMatched: mpMatched,
      ahlMatchedCur: ahlCurMatched,
      ahlMatchedLast: ahlLastMatched,
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
