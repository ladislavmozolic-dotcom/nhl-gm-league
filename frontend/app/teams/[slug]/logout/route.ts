import { NextRequest, NextResponse } from "next/server";
import { clearTeamSession } from "@/lib/auth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await clearTeamSession();
  return NextResponse.redirect(new URL(`/teams/${slug}`, req.url));
}
