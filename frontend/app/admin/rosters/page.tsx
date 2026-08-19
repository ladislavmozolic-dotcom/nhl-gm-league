import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getRosterConfig } from "./actions";
import RosterModeControl from "@/components/RosterModeControl";
import NormalizeRostersButton from "@/components/NormalizeRostersButton";
import { money } from "@/lib/finance";

export const dynamic = "force-dynamic";

export default async function AdminRostersPage() {
  const [cfg, realCount, profinhlCount, realCapCount, farmCount] = await Promise.all([
    getRosterConfig(),
    prisma.player.count({ where: { realTeamId: { not: null } } }),
    prisma.player.count({ where: { profinhlTeamId: { not: null } } }),
    prisma.player.count({ where: { realCapHit: { not: null } } }),
    prisma.player.count({ where: { realFarmTeamId: { not: null } } }),
  ]);

  return (
    <div className="max-w-3xl mx-auto px-4">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold">Roster Source</h1>
        <Link href="/admin" className="text-sm text-slate-400 hover:text-blue-400">← Admin</Link>
      </div>
      <p className="text-slate-400 text-sm mb-6">Choose which roster the league plays with. Currently: <b className="text-white">{cfg.rosterMode === "real" ? "Real NHL Rosters" : "ProfiNHL Rosters"}</b>. Switching also swaps the <b>salary-cap ceiling</b> and each player&apos;s cap hit.</p>

      <RosterModeControl mode={cfg.rosterMode} realCount={realCount} profinhlCount={profinhlCount}
        profinhlCap={money(cfg.profinhlCapUpper)} realCap={money(cfg.realCapUpper)} realCapCount={realCapCount} />

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-6">
        <Stat label="On a real NHL roster" value={String(realCount)} />
        <Stat label="On a real AHL farm" value={String(farmCount)} />
        <Stat label="Real cap hits pulled" value={String(realCapCount)} />
        <Stat label="ProfiNHL cap" value={money(cfg.profinhlCapUpper)} />
        <Stat label="Real NHL cap" value={money(cfg.realCapUpper)} />
      </div>
      <p className="text-xs text-slate-500 mt-4">Real rosters &amp; cap hits are from the NHL API + spotrac by <code>nhlId</code>/name. Cap ceiling is applied to <code>SimSettings</code> on switch.</p>

      <NormalizeRostersButton />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4"><p className="text-xs text-slate-400">{label}</p><p className="text-xl font-black mt-0.5">{value}</p></div>;
}
