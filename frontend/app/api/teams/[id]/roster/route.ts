import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const players = await prisma.player.findMany({
    where: {
      teamId: Number(id),
    },
  });

  return NextResponse.json(players);
}