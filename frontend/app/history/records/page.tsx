import Link from "next/link";
import { PageHeader } from "@/components/ui";
import HistoryNav from "@/components/HistoryNav";
import { getLeagueRecords, type LeaderItem, type RecordSection, type RecordPhase } from "@/lib/records-server";

export const dynamic = "force-dynamic";

function medalCls(rank: number) {
  if (rank === 1) return "bg-amber-400/20 text-amber-300 ring-1 ring-amber-400/50 shadow-sm shadow-amber-500/10";
  if (rank === 2) return "bg-slate-300/15 text-slate-200 ring-1 ring-slate-400/40";
  if (rank === 3) return "bg-orange-500/15 text-orange-300 ring-1 ring-orange-500/40";
  return "bg-slate-800/60 text-slate-400 ring-1 ring-slate-700/50";
}

function RecordCard({ record, cupName }: { record: RecordSection; cupName: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden flex flex-col shadow-sm">
      <div className="flex items-start justify-between gap-2.5 px-3.5 py-2.5 border-b border-slate-800/80 bg-slate-800/30 min-h-[46px]">
        <div className="flex items-start gap-2 min-w-0 flex-1">
          <span className="text-base leading-snug shrink-0 mt-0.5" aria-hidden>{record.icon}</span>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 leading-snug break-words">
            {record.title}
          </h3>
        </div>
        {record.phaseBadge && (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded shrink-0 mt-0.5 ${
            record.phaseBadge === "Play-off"
              ? "bg-amber-500/15 text-amber-300 border border-amber-500/30"
              : record.phaseBadge === "Príprava"
              ? "bg-orange-500/15 text-orange-300 border border-orange-500/30"
              : record.phaseBadge === "ZČ"
              ? "bg-blue-500/15 text-blue-300 border border-blue-500/30"
              : "bg-slate-800 text-slate-400 border border-slate-700"
          }`}>
            {record.phaseBadge}
          </span>
        )}
      </div>
      <div className="flex-1 p-2">
        {record.items.length === 0 ? (
          <p className="px-3 py-6 text-xs text-slate-500 text-center italic">Zatiaľ žiadne zaznamenané údaje</p>
        ) : (
          <ol className="divide-y divide-slate-800/50">
            {record.items.map((item, i) => (
              <li
                key={`${item.rank}-${item.name}-${i}`}
                className={`px-2.5 py-2 transition-colors rounded-lg ${
                  item.rank === 1 ? "bg-gradient-to-r from-amber-500/[0.07] to-transparent" : "hover:bg-slate-800/20"
                }`}
              >
                <div className="flex items-center gap-2.5 text-sm">
                  <span
                    className={`grid place-items-center w-5 h-5 shrink-0 rounded-full text-[10px] font-bold tabular-nums ${medalCls(
                      item.rank
                    )}`}
                  >
                    {item.rank}
                  </span>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {item.slug ? (
                        <Link
                          href={`/players/${item.slug}`}
                          className="font-semibold text-slate-100 hover:text-blue-400 transition-colors truncate"
                        >
                          {item.name}
                        </Link>
                      ) : item.gmSlug ? (
                        <Link
                          href={`/gm/${item.gmSlug}`}
                          className="font-semibold text-slate-100 hover:text-blue-400 transition-colors truncate"
                        >
                          {item.name}
                        </Link>
                      ) : (
                        <span className="font-semibold text-slate-100 truncate">{item.name}</span>
                      )}

                      {item.teamCode && (
                        <Link
                          href={item.teamSlug ? `/teams/${item.teamSlug}` : "#"}
                          className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-blue-400 transition-colors shrink-0"
                        >
                          {item.teamLogo && (
                            <img src={item.teamLogo} alt="" className="w-3.5 h-3.5 object-contain shrink-0" />
                          )}
                          <span>{item.teamCode}</span>
                        </Link>
                      )}
                    </div>

                    {item.sub && (
                      <p className="text-[11px] text-slate-400 mt-0.5 leading-tight truncate" title={item.sub}>
                        {item.sub}
                      </p>
                    )}
                  </div>

                  <div className="text-right shrink-0">
                    <span className={`text-xs font-bold tabular-nums ${item.rank === 1 ? "text-amber-300" : "text-slate-200"}`}>
                      {item.value}
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

export default async function LeagueRecordsPage({
  searchParams,
}: {
  searchParams: Promise<{ league?: string; phase?: string }>;
}) {
  const sp = await searchParams;
  const league = sp.league === "AHL" ? "AHL" : "NHL";
  const rawPhase = sp.phase;
  const phase: RecordPhase =
    rawPhase === "regular" || rawPhase === "playoffs" || rawPhase === "pre"
      ? rawPhase
      : "all";

  const data = await getLeagueRecords(league, phase);

  const phasesList: Array<{ key: RecordPhase; label: string; icon: string }> = [
    { key: "all", label: "Všetky rekordy (All-Time)", icon: "🌐" },
    { key: "regular", label: "Základná časť (Regular Season)", icon: "🏒" },
    { key: "playoffs", label: "Play-off (Playoffs)", icon: "🏆" },
    { key: "pre", label: "Príprava (Pre-season)", icon: "☀️" },
  ];

  return (
    <div className="space-y-6 py-2">
      <PageHeader
        title="Historické rekordy ligy"
        subtitle={`Všetky historické a sezónne rekordy ${league} — GM, tímy, hráči, brankári, Stanley Cupy, trofeje a série.`}
      />

      <HistoryNav active="records" league={league} />

      {/* Main Bar: League switch + Phase tabs */}
      <div className="space-y-3 bg-slate-900/60 p-3.5 rounded-xl border border-slate-800">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          {/* League switcher */}
          <div className="flex items-center gap-2">
            <Link
              href={`/history/records?league=NHL&phase=${phase}`}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                league === "NHL"
                  ? "bg-blue-600 text-white shadow-sm shadow-blue-500/20"
                  : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
              }`}
            >
              <span>🏆</span>
              <span>NHL Rekordy</span>
            </Link>
            <Link
              href={`/history/records?league=AHL&phase=${phase}`}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                league === "AHL"
                  ? "bg-orange-600 text-white shadow-sm shadow-orange-500/20"
                  : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
              }`}
            >
              <span>🏒</span>
              <span>AHL Rekordy</span>
            </Link>
          </div>

          {/* Quick jump anchor links */}
          <div className="flex items-center gap-1.5 flex-wrap text-xs text-slate-400">
            <span className="text-[11px] font-semibold text-slate-500 uppercase mr-1">Prejsť na:</span>
            {data.groups.map((group) => (
              <a
                key={group.id}
                href={`#${group.id}`}
                className="px-2.5 py-1 rounded bg-slate-800/80 hover:bg-slate-700 hover:text-blue-300 border border-slate-700/50 transition-colors flex items-center gap-1"
              >
                <span>{group.icon}</span>
                <span>{group.title.split("—")[0].trim()}</span>
              </a>
            ))}
          </div>
        </div>

        {/* Phase selector tabs */}
        <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-slate-800/70">
          <span className="text-xs font-bold uppercase text-slate-500 mr-1">Fáza súťaže:</span>
          {phasesList.map((p) => {
            const isActive = phase === p.key;
            return (
              <Link
                key={p.key}
                href={`/history/records?league=${league}&phase=${p.key}`}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  isActive
                    ? "bg-slate-100 text-slate-900 shadow font-bold"
                    : "bg-slate-800/80 text-slate-300 hover:bg-slate-700 border border-slate-700/50"
                }`}
              >
                <span>{p.icon}</span>
                <span>{p.label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Record category groups */}
      <div className="space-y-10">
        {data.groups.map((group) => (
          <section key={group.id} id={group.id} className="space-y-4 scroll-mt-6">
            <div className="flex items-center gap-2.5 pb-2 border-b border-slate-800/80">
              <span className="text-xl" aria-hidden>{group.icon}</span>
              <h2 className="text-lg font-black tracking-tight text-white">{group.title}</h2>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-medium">
                {group.records.length} {group.records.length === 1 ? "rekord" : group.records.length < 5 ? "rekordy" : "rekordov"}
              </span>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {group.records.map((record) => (
                <RecordCard key={record.id} record={record} cupName={data.cupName} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
