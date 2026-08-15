import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Live lottery-broadcast state: startedAt (drives the synced reveal) + the drawn
// round-1 order. Polled by every viewer so the show plays in sync.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const year = Number(searchParams.get("year")) || new Date().getUTCFullYear();

  const [run, rows] = await Promise.all([
    prisma.draftLotteryRun.findUnique({ where: { year } }),
    prisma.draftLottery.findMany({ where: { year }, orderBy: { pick: "asc" } }),
  ]);
  if (!run || rows.length === 0) return NextResponse.json({ startedAt: null });

  const teams = await prisma.team.findMany({ where: { id: { in: rows.map((r) => r.teamId) } }, select: { id: true, code: true, name: true, logoUrl: true } });
  const t = new Map(teams.map((x) => [x.id, x]));
  return NextResponse.json({
    startedAt: run.startedAt.toISOString(),
    order: rows.map((r) => ({ pick: r.pick, code: t.get(r.teamId)?.code ?? "—", name: t.get(r.teamId)?.name ?? "—", logo: t.get(r.teamId)?.logoUrl ?? null, viaLottery: r.viaLottery, combo: r.combo ? r.combo.split("-").map(Number) : null })),
  });
}
