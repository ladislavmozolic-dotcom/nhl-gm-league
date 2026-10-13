import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { PageHeader, Card, BackPill } from "@/components/ui";
import { loadUnhappyPlayers } from "@/lib/unhappy-players-server";
import UnhappyPlayersTable from "@/components/admin/UnhappyPlayersTable";

export const dynamic = "force-dynamic";

export default async function UnhappyPlayersPage() {
  if (!(await isAdmin())) redirect("/");
  const data = await loadUnhappyPlayers(); // fast — the live ice-time re-check loads afterwards in the table
  return (
    <div className="space-y-5 py-2">
      <PageHeader title="Unhappy Players" subtitle="Everyone carrying an ice-time count, warning, broken promise or trade request — with his ice time re-checked right now." right={<BackPill href="/admin">Admin</BackPill>} />
      <Card bodyClassName="p-0">
        <UnhappyPlayersTable data={data} />
      </Card>
      <p className="text-xs text-slate-600">
        A player turns unhappy when his average ice time over the club&apos;s last 20 games (judged only once he has 15 with the club) is below {data.pct}% of what his projected role gets on his own club. Each unhappy day adds one to the count:
        at {data.warnDays} his agent warns the GM, at {data.requestDays} he requests a trade. Games missed through injury don&apos;t count. “Right now” = the same check run live without changing anything; “Clear” wipes the count, warnings and an ice-time/promise trade request.
      </p>
    </div>
  );
}
