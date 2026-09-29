import { NextRequest, NextResponse } from "next/server";
import { importOhlSeason, importQmjhlSeason, importWhlSeason } from "@/lib/world-import-hockeytech";
import { importLiigaProspects } from "@/lib/world-import-liiga";
import { importCzechExtraligaProspects, importShlProspects } from "@/lib/world-import-europe";
import { importEuropeanJuniorLeagues } from "@/lib/world-import-juniors";

/** Daily CHL refresh. This remains deliberately separate from the simulation
 * cron: a temporary external-feed problem must never delay league simulation. */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const results = [await importWhlSeason(), await importOhlSeason(), await importQmjhlSeason()];
    const europe = [await importLiigaProspects(), await importShlProspects(), await importCzechExtraligaProspects()];
    const europeanJuniors = await importEuropeanJuniorLeagues();
    return NextResponse.json({ success: true, results, europe, europeanJuniors, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error("[Cron WorldLeagues] CHL import failed:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "CHL import failed." }, { status: 500 });
  }
}
