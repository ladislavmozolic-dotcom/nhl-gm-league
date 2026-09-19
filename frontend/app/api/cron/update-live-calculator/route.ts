import { NextRequest, NextResponse } from "next/server";
import { syncLiveCalculatorData } from "@/lib/live-calculator-sync";
import { runLiveCalculatorRecompute } from "@/lib/live-calculator-engine";

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    console.log("[Cron LiveCalculator] Starting scheduled sync and recompute...");
    const syncRes = await syncLiveCalculatorData();
    const recomputeRes = await runLiveCalculatorRecompute();

    return NextResponse.json({
      success: true,
      sync: syncRes,
      recompute: recomputeRes,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("[Cron LiveCalculator] Scheduled update failed:", err);
    return NextResponse.json(
      { error: err?.message || String(err) },
      { status: 500 }
    );
  }
}
