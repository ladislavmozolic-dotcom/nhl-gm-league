

import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const prospects = await (prisma as any).prospect.findMany({
    where: {
      teamId: 2,
    },
  });

  return NextResponse.json(prospects);
}