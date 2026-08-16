import { prisma } from "@/lib/prisma";
import { getTeamSession } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { cleanName } from "@/lib/playerName";
import { activeWaivers } from "@/lib/waivers-server";
import WaiverWire from "@/components/WaiverWire";

export const dynamic = "force-dynamic";

export default async function WaiversPage() {
  const [session, waivers] = await Promise.all([getTeamSession(), activeWaivers()]);

  let myPlayers: { id: number; name: string; position: string; capHit: number; clause: string | null; onWaivers: boolean }[] = [];
  if (session != null) {
    const roster = await prisma.player.findMany({
      where: { teamId: session, rosterType: "NHL" },
      select: { id: true, name: true, position: true, capHit: true, tradeClause: true, waiverStatus: true },
      orderBy: [{ capHit: "asc" }],
    });
    myPlayers = roster.map((p) => ({ id: p.id, name: cleanName(p.name), position: p.position ?? "", capHit: p.capHit ?? 0, clause: p.tradeClause, onWaivers: p.waiverStatus === "ON_WAIVERS" }));
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <PageHeader title="Waivers" subtitle="Expose a player, or claim one off the wire" />
      <WaiverWire waivers={waivers} myTeamId={session} myPlayers={myPlayers} />
    </div>
  );
}
