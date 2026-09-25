// Liveness + league-clock probe for the server watchdog (scripts/ops/watchdog.sh).
// Public on purpose (the watchdog has no session) — so it returns only coarse
// booleans, never league data. 200 = healthy, 503 = something needs a human.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { bratislavaParts } from "@/lib/season-cron";

export const dynamic = "force-dynamic";

export async function GET() {
  const problems: string[] = [];
  let db = false;
  try {
    const cfg = await prisma.leagueConfig.findUnique({ where: { id: 1 }, select: { phaseOverride: true, leagueDate: true, lastSimulatedDay: true } });
    db = true;
    // Only judge the clock when it's following the calendar — a pinned phase pauses it on purpose.
    if (cfg?.leagueDate && !cfg.phaseOverride) {
      const now = bratislavaParts(new Date());
      const leagueDay = cfg.leagueDate.toISOString().slice(0, 10);
      const simmed = cfg.lastSimulatedDay?.getTime() === cfg.leagueDate.getTime();
      // the 20:30 window closes at 20:40 — by 21:00 tonight's sim must have run
      if (now.hour >= 21 && !simmed) problems.push("sim-overdue");
      // the midnight rollover should have moved the league date by ~00:30
      if (now.dateStr > leagueDay && now.hour >= 1) problems.push("calendar-stuck");
    }
  } catch {
    problems.push("db-down");
  }
  return NextResponse.json({ ok: problems.length === 0, db, problems }, { status: problems.length ? 503 : 200 });
}
