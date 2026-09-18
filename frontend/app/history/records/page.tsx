import Link from "next/link";
import { PageHeader } from "@/components/ui";
import HistoryNav from "@/components/HistoryNav";
import PlayerAvatar from "@/components/playerAvatar";
import { getLeagueRecords, type LeaderItem, type RecordSection, type RecordPhase } from "@/lib/records-server";

export const dynamic = "force-dynamic";

function RecordCard({ record, cupName }: { record: RecordSection; cupName: string }) {
  const first = record.items[0];
  const rest = record.items.slice(1, 5);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden flex flex-col shadow-sm transition-all hover:border-slate-700/80">
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

      <div className="flex-1 p-2.5 flex flex-col justify-between">
        {!first ? (
          <p className="px-3 py-6 text-xs text-slate-500 text-center italic">Zatiaľ žiadne zaznamenané údaje</p>
        ) : (
          <div className="space-y-2">
            {/* Dominant #1 Hero Row */}
            <div className="rounded-lg bg-gradient-to-br from-amber-500/15 via-slate-800/70 to-slate-900/90 border border-amber-500/30 p-2.5 relative overflow-hidden shadow-sm">
              <div className="flex items-center gap-2.5">
                {/* #1 Rank Medal Badge */}
                <div className="relative shrink-0">
                  <span className="w-5 h-5 rounded-full bg-gradient-to-tr from-amber-500 to-yellow-300 text-slate-950 font-black text-[10px] flex items-center justify-center shadow-sm ring-1 ring-amber-400/50">
                    1
                  </span>
                </div>

                {/* Avatar / Photo / Logo */}
                <div className="shrink-0">
                  {first.slug ? (
                    <Link href={`/players/${first.slug}`} className="block hover:opacity-90 transition-opacity">
                      <PlayerAvatar src={first.photoUrl ?? null} alt={first.name} size={42} />
                    </Link>
                  ) : first.teamLogo ? (
                    <Link href={first.teamSlug ? `/teams/${first.teamSlug}` : "#"} className="block hover:opacity-90 transition-opacity">
                      <img src={first.teamLogo} alt="" className="w-9 h-9 object-contain drop-shadow" />
                    </Link>
                  ) : first.gmSlug ? (
                    <Link href={`/gm/${first.gmSlug}`} className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 text-sm hover:border-amber-400/50 transition-colors">
                      👔
                    </Link>
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 text-[10px] font-bold">
                      #1
                    </div>
                  )}
                </div>

                {/* Player Name, Team, Sub */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {first.slug ? (
                      <Link
                        href={`/players/${first.slug}`}
                        className="font-bold text-sm text-white hover:text-amber-300 transition-colors truncate"
                      >
                        {first.name}
                      </Link>
                    ) : first.gmSlug ? (
                      <Link
                        href={`/gm/${first.gmSlug}`}
                        className="font-bold text-sm text-white hover:text-amber-300 transition-colors truncate"
                      >
                        {first.name}
                      </Link>
                    ) : (
                      <span className="font-bold text-sm text-white truncate">{first.name}</span>
                    )}

                    {first.teams && first.teams.length > 1 && !first.hideTeam ? (
                      <div className="inline-flex items-center gap-1.5 flex-wrap">
                        {first.teams.map((t, tIdx) => (
                          <span key={t.code} className="inline-flex items-center gap-1 text-[11px] text-slate-300 font-medium">
                            <Link
                              href={t.slug ? `/teams/${t.slug}` : "#"}
                              className="inline-flex items-center gap-1 hover:text-blue-400 transition-colors"
                            >
                              {t.logoUrl && <img src={t.logoUrl} alt="" className="w-3.5 h-3.5 object-contain shrink-0" />}
                              <span>{t.code}</span>
                            </Link>
                            {tIdx < first.teams!.length - 1 && <span className="text-slate-500">/</span>}
                          </span>
                        ))}
                      </div>
                    ) : (first.teamLogo || first.teamCode) && !first.hideTeam ? (
                      <Link
                        href={first.teamSlug ? `/teams/${first.teamSlug}` : "#"}
                        className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-blue-400 transition-colors shrink-0 font-medium"
                      >
                        {first.teamLogo ? (
                          <img src={first.teamLogo} alt="" className="w-4 h-4 object-contain shrink-0" />
                        ) : (
                          <span>{first.teamCode}</span>
                        )}
                      </Link>
                    ) : null}
                  </div>

                  {first.sub && (
                    <p className="text-[11px] text-slate-400 mt-0.5 leading-tight truncate" title={first.sub}>
                      {first.sub}
                    </p>
                  )}
                </div>

                {/* Value */}
                <div className="text-right shrink-0">
                  <span className="text-sm sm:text-base font-black tabular-nums text-amber-300 tracking-tight">
                    {first.value}
                  </span>
                </div>
              </div>
            </div>

            {/* Ranks 2 to 5: Clean minimal single rows */}
            {rest.length > 0 && (
              <div className="divide-y divide-slate-800/40 pt-0.5">
                {rest.map((item, idx) => (
                  <div
                    key={`${item.rank}-${item.name}-${idx}`}
                    className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-slate-800/30 text-xs transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="w-4 text-center font-bold text-slate-500 text-[11px] shrink-0 tabular-nums">
                        {item.rank}
                      </span>

                      {item.teams && item.teams.length > 1 && !item.hideTeam ? (
                        <span className="inline-flex items-center gap-1 shrink-0">
                          {item.teams.map((t, tIdx) => (
                            <span key={t.code} className="inline-flex items-center gap-0.5 text-[10px] text-slate-400 font-medium">
                              {t.logoUrl && <img src={t.logoUrl} alt="" className="w-3.5 h-3.5 object-contain shrink-0" />}
                              <span>{t.code}</span>
                              {tIdx < item.teams!.length - 1 && <span className="text-slate-600">/</span>}
                            </span>
                          ))}
                        </span>
                      ) : (
                        !item.hideTeam && item.teamLogo && (
                          <img src={item.teamLogo} alt="" className="w-3.5 h-3.5 object-contain shrink-0" />
                        )
                      )}

                      {item.slug ? (
                        <Link
                          href={`/players/${item.slug}`}
                          className="font-medium text-slate-200 hover:text-blue-400 transition-colors truncate"
                        >
                          {item.name}
                        </Link>
                      ) : item.gmSlug ? (
                        <Link
                          href={`/gm/${item.gmSlug}`}
                          className="font-medium text-slate-200 hover:text-blue-400 transition-colors truncate"
                        >
                          {item.name}
                        </Link>
                      ) : (
                        <span className="font-medium text-slate-200 truncate">{item.name}</span>
                      )}

                      {(!item.teams || item.teams.length <= 1) && !item.teamLogo && item.teamCode && !item.hideTeam && (
                        <span className="text-[10px] text-slate-500 font-medium shrink-0">
                          {item.teamCode}
                        </span>
                      )}
                    </div>

                    <div className="text-right shrink-0 ml-2">
                      <span className="font-bold tabular-nums text-slate-300 text-xs">
                        {item.value}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
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
