import { getTeamSession } from "@/lib/auth";
import { PageHeader, Card } from "@/components/ui";
import { activeWaivers } from "@/lib/waivers-server";
import { loadSettings } from "@/lib/sim/settings";
import { getLeagueClock } from "@/lib/calendar-server";
import WaiverWire from "@/components/WaiverWire";

export const dynamic = "force-dynamic";

export default async function WaiversPage() {
  const [session, waivers, settings, clock] = await Promise.all([getTeamSession(), activeWaivers(), loadSettings(), getLeagueClock()]);
  const inSeason = clock.phase === "regular" || clock.phase === "playoffs";

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <PageHeader title="Waiver Wire" subtitle="Who's on waivers — claim from your team's Trades page priority order" />
      {!settings.waiversEnabled ? (
        <Card><p className="text-sm text-slate-400">The waiver wire is <b>turned off</b> in this league — clubs move players between the NHL and their AHL affiliate freely from the roster mover, with no claims. The commissioner can enable waivers in engine settings.</p></Card>
      ) : (
        <WaiverWire waivers={waivers} myTeamId={session} inSeason={inSeason} />
      )}
    </div>
  );
}
