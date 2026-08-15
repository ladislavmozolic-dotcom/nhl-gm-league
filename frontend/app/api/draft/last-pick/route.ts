import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { currentDraftSourceWhere } from "@/lib/draft-source";

export const dynamic = "force-dynamic";

// The most recent selection of a draft year — polled by the live announcer so
// every viewer sees the pick (auto-dismissing, latest-only, no click backlog).
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const year = Number(searchParams.get("year")) || new Date().getUTCFullYear();

  const last = await prisma.draftProspect.findFirst({
    where: { draftYear: year, draftedByTeamId: { not: null }, ...(await currentDraftSourceWhere()) },
    orderBy: { overallPick: "desc" },
    select: { overallPick: true, name: true, amateurClub: true, draftedByTeamId: true },
  });
  if (!last || last.overallPick == null) return NextResponse.json({ pick: 0 });

  const team = last.draftedByTeamId ? await prisma.team.findUnique({ where: { id: last.draftedByTeamId }, select: { name: true, logoUrl: true } }) : null;
  return NextResponse.json({
    pick: last.overallPick, name: last.name, club: last.amateurClub,
    teamName: team?.name ?? "—", teamLogo: team?.logoUrl ?? null,
  });
}
