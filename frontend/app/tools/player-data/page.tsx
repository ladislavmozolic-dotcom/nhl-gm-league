import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/auth";
import { PageHeader, Card } from "@/components/ui";
import PlayerDataUpload from "@/components/PlayerDataUpload";
import { leagueFullGP } from "@/lib/free-agency-server";

export const dynamic = "force-dynamic";

export default async function PlayerDataPage() {
  const admin = await isAdmin();
  const [withStats, total, fullGP, topPts] = await Promise.all([
    prisma.player.count({ where: { lastSeasonGP: { gt: 0 } } }),
    prisma.player.count(),
    leagueFullGP(),
    prisma.player.findMany({
      where: { lastSeasonPts: { gt: 0 } }, orderBy: { lastSeasonPts: "desc" }, take: 5,
      select: { name: true, lastSeasonPts: true, lastSeasonGP: true },
    }),
  ]);
  const downCount = fullGP > 0
    ? await prisma.player.count({ where: { lastSeasonGP: { gt: 0, lt: Math.round(0.6 * fullGP) } } })
    : 0;

  return (
    <div className="space-y-6 py-2">
      <PageHeader title="Player Data Refresh" subtitle="Import real last-season stats from the Players Calculator (hockey-reference)" />

      <Card title="Coverage" accent="text-blue-400">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          <div><p className="text-2xl font-black text-white">{withStats}</p><p className="text-xs text-slate-400">players with stats</p></div>
          <div><p className="text-2xl font-black text-white">{total}</p><p className="text-xs text-slate-400">total players</p></div>
          <div><p className="text-2xl font-black text-white">{fullGP}</p><p className="text-xs text-slate-400">full-slate GP</p></div>
          <div><p className="text-2xl font-black text-amber-400">{downCount}</p><p className="text-xs text-slate-400">down-season (→ 1yr)</p></div>
        </div>
        {topPts.length > 0 && (
          <p className="text-xs text-slate-500 mt-3">Points leaders: {topPts.map((p) => `${p.name.split(" ").slice(-1)[0]} ${p.lastSeasonPts}`).join(" · ")}</p>
        )}
      </Card>

      <Card title="How it works" accent="text-slate-200">
        <ul className="text-sm text-slate-300 space-y-1.5 list-disc pl-5">
          <li>Your <b>Players Calculator</b> already pulls each player&apos;s games, goals &amp; assists live from hockey-reference (its <i>Data → Aktualizovat vše</i>).</li>
          <li>Upload that <b>.xlsx</b> here to write every player&apos;s <b>last-season GP + points</b> into the league — matched by name (diacritics &amp; common nicknames handled).</li>
          <li>A player who missed most of the season (under 60% of the full slate) is treated as coming off a <b>down year</b> and will only take a <b>1-year prove-it deal</b> in the Free Agent Frenzy.</li>
          <li>This is a one-off <b>import</b> (not a live fetch), so the league stays self-contained and fast.</li>
        </ul>
      </Card>

      <Card title="Import" accent="text-green-400">
        {admin ? <PlayerDataUpload /> : <p className="text-sm text-slate-500">Sign in as a league admin to import player data.</p>}
      </Card>

      <p className="text-xs text-slate-600"><Link href="/free-agents" className="hover:text-blue-400">→ Free Agent Frenzy board</Link></p>
    </div>
  );
}
