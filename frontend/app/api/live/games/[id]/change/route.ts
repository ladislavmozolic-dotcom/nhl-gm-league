import { NextResponse } from "next/server";
import { canManageTeam, getTeamSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { submitLiveChange } from "@/lib/live-server";
import type { TeamLinesData } from "@/lib/sim/lines";

export const dynamic = "force-dynamic";

/** A GM's in-game change for their own club: `{ teamId, lines }` (the Lines editor's object, incl. system/strategy/PP-PK). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gameId = Number(id);
  let body: { teamId?: number; lines?: TeamLinesData; timeout?: boolean };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Bad request." }, { status: 400 }); }
  const teamId = Number(body.teamId);
  if (!Number.isInteger(gameId) || !Number.isInteger(teamId) || (!body.lines && !body.timeout)) return NextResponse.json({ ok: false, error: "Bad request." }, { status: 400 });
  if (!(await canManageTeam(teamId))) return NextResponse.json({ ok: false, error: "You can't coach that club." }, { status: 403 });
  const me = await getTeamSession();
  const by = me != null ? (await prisma.team.findUnique({ where: { id: me }, select: { name: true } }))?.name ?? "GM" : "GM";
  const res = await submitLiveChange({ gameId, teamId, lines: body.lines, timeout: body.timeout === true, by });
  return NextResponse.json(res, { status: res.ok ? 200 : 400, headers: { "Cache-Control": "no-store" } });
}
