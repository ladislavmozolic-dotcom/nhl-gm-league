import Link from "next/link";
import { PageHeader, Card } from "@/components/ui";
import { currentInjuries, seasonInjuries } from "@/lib/injuries-server";
import { CurrentInjuryTable, SeasonInjuryTable } from "@/components/InjuryTables";

export const dynamic = "force-dynamic";
const SEASON = "2026-27";

export default async function InjuriesPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const view = (await searchParams).view === "all" ? "all" : "current";
  const Tab = ({ id, label }: { id: string; label: string }) => (
    <Link href={`/players/injuries?view=${id}`}
      className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
        view === id ? "bg-blue-600 text-white" : "bg-slate-800/60 text-slate-400 hover:text-white"
      }`}>{label}</Link>
  );

  const [current, all] = view === "current"
    ? [await currentInjuries(), []]
    : [[], await seasonInjuries(SEASON)];

  return (
    <div className="space-y-6 py-2">
      <PageHeader title="Injuries"
        subtitle={view === "current"
          ? `${current.length} player${current.length === 1 ? "" : "s"} out right now — league-wide`
          : `${all.length} injuries this season — league-wide`} />
      <div className="flex gap-2">
        <Tab id="current" label="Current Injuries" />
        <Tab id="all" label="All Injuries (season)" />
      </div>
      <Card bodyClassName="p-0">
        <div className="p-2">
          {view === "current" ? <CurrentInjuryTable rows={current} /> : <SeasonInjuryTable rows={all} />}
        </div>
      </Card>
      {view === "all" && <p className="text-xs text-slate-600">Every injury the sim recorded this season, with how it happened (hit / blocked shot / fight / overuse / collision) and who caused it.</p>}
    </div>
  );
}
