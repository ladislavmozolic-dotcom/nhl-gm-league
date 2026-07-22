import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const picks = await (prisma as any).draftPick.findMany({
    take: 20,
  });

  return NextResponse.json(picks);
}