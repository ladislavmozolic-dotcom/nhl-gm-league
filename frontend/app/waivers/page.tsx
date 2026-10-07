import { getTeamSession } from "@/lib/auth";
import { PageHeader, Card } from "@/components/ui";
import { activeWaivers, waiverPriorityOrder } from "@/lib/waivers-server";
import { loadSettings } from "@/lib/sim/settings";
import { getLeagueClock } from "@/lib/calendar-server";
import { prisma } from "@/lib/prisma";
import WaiverWire from "@/components/WaiverWire";

export const dynamic = "force-dynamic";

export default async function WaiversPage() {
  const [session, waivers, settings, clock] = await Promise.all([
    getTeamSession(),
    activeWaivers(),
    loadSettings(),
    getLeagueClock(),
  ]);
  const inSeason = clock.phase === "regular" || clock.phase === "playoffs";
  const order = settings.waiversEnabled ? await waiverPriorityOrder(clock.phase) : [];

  const myTeam = session
    ? await prisma.team.findUnique({
        where: { id: session },
        select: { id: true, name: true, code: true, logoUrl: true, slug: true },
      })
    : null;

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-3 sm:px-6 py-6">
      <WaiverWire
        waivers={waivers}
        myTeamId={session}
        myTeam={myTeam}
        inSeason={inSeason}
        order={order}
        waiversEnabled={settings.waiversEnabled}
      />
    </div>
  );
}
