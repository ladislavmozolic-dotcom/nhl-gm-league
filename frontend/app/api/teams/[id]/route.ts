import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publicTeamSelect } from "@/lib/public-team";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const team = await prisma.team.findUnique({
    select: publicTeamSelect,
    where: {
      id: Number(id),
    },
  });

  return NextResponse.json(team);
}
