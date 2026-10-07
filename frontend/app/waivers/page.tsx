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
      {!settings.waiversEnabled ? (
        <div className="space-y-4">
          <PageHeader
            title="Waiver Wire"
            subtitle="24-hodinové waiver okno na presun hráčov na farmu a prioritné poradie nárokov"
          />
          <Card>
            <p className="text-sm text-slate-400 p-6">
              Waiver listina je v tejto lige <b>vypnutá</b> — kluby presúvajú hráčov medzi NHL a AHL farmou voľne cez správu zostavy bez nutnosti waiveru.
            </p>
          </Card>
        </div>
      ) : (
        <WaiverWire
          waivers={waivers}
          myTeamId={session}
          myTeam={myTeam}
          inSeason={inSeason}
          order={order}
        />
      )}
    </div>
  );
}
