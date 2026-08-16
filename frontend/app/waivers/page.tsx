import { getTeamSession } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { activeWaivers } from "@/lib/waivers-server";
import WaiverWire from "@/components/WaiverWire";

export const dynamic = "force-dynamic";

export default async function WaiversPage() {
  const [session, waivers] = await Promise.all([getTeamSession(), activeWaivers()]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <PageHeader title="Waiver Wire" subtitle="Who's on waivers — claim from your team's Trades page priority order" />
      <WaiverWire waivers={waivers} myTeamId={session} />
    </div>
  );
}
