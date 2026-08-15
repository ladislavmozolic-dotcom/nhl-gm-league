import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { leagueRecords, type RecordHolder } from "@/lib/records-server";

export const dynamic = "force-dynamic";

function Holder({ h, unit }: { h: RecordHolder | null; unit: string }) {
  if (!h) return <span className="text-slate-600 text-sm">—</span>;
  const name = h.slug ? <Link href={`/players/${h.slug}`} className="font-semibold hover:text-blue-400">{h.who}</Link> : <span className="font-semibold">{h.who}</span>;
  return (
    <div className="flex items-baseline justify-between gap-3">
      <div className="min-w-0">
        <div className="truncate">{name} {h.team && <span className="text-slate-500 text-xs">({h.team})</span>}</div>
        <div className="text-xs text-slate-500 truncate">
          {h.season && <span>{h.season}</span>}
          {h.detail && <span> · {h.detail}</span>}
          {h.gameId && <> · <Link href={`/games/${h.gameId}`} className="text-blue-400 hover:underline">box →</Link></>}
        </div>
      </div>
      <div className="text-right shrink-0">
        <span className="text-2xl font-black tabular-nums text-amber-400">{h.value}</span>
        <span className="text-xs text-slate-500 ml-1">{unit}</span>
      </div>
    </div>
  );
}

export default async function RecordsPage() {
  const groups = await leagueRecords();
  return (
    <div className="space-y-6 py-2">
      <PageHeader title="League Records" subtitle="The all-time record book — every mark set in league play" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {groups.map((g) => (
          <div key={g.title} className="bg-slate-900/40 border border-slate-800 rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 border-b border-slate-800 bg-slate-800/30 text-sm font-bold uppercase tracking-wide text-slate-200">
              <span className="mr-1.5">{g.icon}</span>{g.title}
            </div>
            <div className="divide-y divide-slate-800/60">
              {g.rows.map((r) => (
                <div key={r.key} className="px-4 py-3">
                  <div className="text-[11px] uppercase tracking-wide text-slate-500 mb-1">{r.label}</div>
                  <Holder h={r.holder} unit={r.unit} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-600">Records are computed live from every FINAL game on record and grow as the league plays on.</p>
    </div>
  );
}
