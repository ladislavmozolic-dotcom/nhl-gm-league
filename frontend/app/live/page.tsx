import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui";
import LiveBoard from "@/components/live/LiveBoard";
import { getTeamSession } from "@/lib/auth";
import { liveGameOf } from "@/lib/sim/live-round";
import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata = { title: "Live" };

export default async function LivePage() {
  const teams = await prisma.team.findMany({ select: { id: true, logoUrl: true } });
  const logos: Record<number, string> = {};
  for (const t of teams) if (t.logoUrl) logos[t.id] = t.logoUrl;
  const me = await getTeamSession();
  const myGame = me != null ? liveGameOf(me) : null;
  return (
    <div className="space-y-6">
      <PageHeader title="🔴 Live" subtitle="Tonight's games, played out as they happen. Results land in the standings once the last game is over."
        right={myGame ? <Link href={`/live/${myGame}`} className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-bold">Go to your game →</Link> : undefined} />
      <LiveBoard logos={logos} mineTeamIds={me != null ? [me] : []} />
    </div>
  );
}
