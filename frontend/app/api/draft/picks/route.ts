import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { currentDraftSourceWhere } from "@/lib/draft-source";

export const dynamic = "force-dynamic";

// All selections of a draft year, in pick order — feeds the Live Tracker ticker.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const year = Number(searchParams.get("year")) || new Date().getUTCFullYear();

  const picks = await prisma.draftProspect.findMany({
    where: { draftYear: year, draftedByTeamId: { not: null }, ...(await currentDraftSourceWhere()) },
    orderBy: { overallPick: "asc" },
    select: { overallPick: true, name: true, position: true, draftedByTeamId: true },
  });
  const teamIds = [...new Set(picks.map((p) => p.draftedByTeamId!).filter(Boolean))];
  const teams = await prisma.team.findMany({ where: { id: { in: teamIds } }, select: { id: true, code: true, logoUrl: true } });
  const t = new Map(teams.map((x) => [x.id, x]));

  return NextResponse.json({
    picks: picks.map((p) => ({
      pick: p.overallPick, name: p.name, position: p.position,
      code: p.draftedByTeamId ? t.get(p.draftedByTeamId)?.code ?? null : null,
      logo: p.draftedByTeamId ? t.get(p.draftedByTeamId)?.logoUrl ?? null : null,
    })),
  });
}
