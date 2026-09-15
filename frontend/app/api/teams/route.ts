import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publicTeamSelect } from "@/lib/public-team";

export async function GET() {
  const teams = await prisma.team.findMany({
    select: publicTeamSelect,
    orderBy: {
      name: "asc",
    },
  });

  return NextResponse.json(teams);
}
