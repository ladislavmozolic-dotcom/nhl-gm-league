import { NextResponse } from "next/server";
import { canManageTeam } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cleanName } from "@/lib/playerName";
import { liveLinesOf } from "@/lib/sim/live-round";

export const dynamic = "force-dynamic";

/** The lines a club is icing right now in a live game, its skater roster for the editor, and how many of
 *  its changes have taken effect — only for the club's own GM (or an admin). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gameId = Number(id);
  const url = new URL(req.url);
  const teamId = Number(url.searchParams.get("teamId"));
  if (!Number.isInteger(gameId) || !Number.isInteger(teamId)) return NextResponse.json({ error: "Bad request." }, { status: 400 });
  if (!(await canManageTeam(teamId))) return NextResponse.json({ error: "You can't coach that club." }, { status: 403 });
  const res = liveLinesOf(gameId, teamId);
  if (!res) return NextResponse.json({ error: "That game is not live." }, { status: 404 });
  // the editor needs names/positions — only on request, so the cheap 4-second "applied" refresh stays cheap
  let roster: Array<{ id: number; name: string; position: string; shoots: string | null; overall: number | null; scratched: boolean }> | undefined;
  if (url.searchParams.get("roster") === "1") {
    const team = await prisma.team.findUnique({ where: { id: teamId }, select: { league: true } });
    const rows = await prisma.player.findMany({
      where: { teamId, rosterType: team?.league === "AHL" ? "AHL" : "NHL", isGoalie: false, scratched: false, injuryDaysLeft: { lte: 0 }, suspendedGames: { lte: 0 } }, // players the GM scratched in Roster Moves stay out
      select: { id: true, name: true, position: true, shoots: true, overall: true, scratched: true },
      orderBy: { overall: "desc" },
    });
    roster = rows.map((p) => ({ id: p.id, name: cleanName(p.name), position: p.position ?? "C", shoots: p.shoots, overall: p.overall, scratched: p.scratched }));
  }
  return NextResponse.json({ ...res, roster }, { headers: { "Cache-Control": "no-store" } });
}
