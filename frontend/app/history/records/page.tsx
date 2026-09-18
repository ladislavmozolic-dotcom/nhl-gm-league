import Link from "next/link";
import { PageHeader } from "@/components/ui";
import HistoryNav from "@/components/HistoryNav";
import PlayerAvatar from "@/components/playerAvatar";
import {
  getLeagueRecords,
  type LeaderItem,
  type RecordSection,
  type RecordPhase,
  type MainRecordCategory,
  type RecordCategoryGroup,
} from "@/lib/records-server";

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

type CategoryMeta = {
  key: MainRecordCategory;
  label: string;
  shortLabel: string;
  icon: string;
  description: string;
  accentColor: string;
};

const CATEGORIES: CategoryMeta[] = [
  {
    key: "all",
    label: "Všetky kategórie",
    shortLabel: "Všetko",
    icon: "🌐",
    description: "Kompletný prehľad všetkých historických a sezónnych rekordov ligy.",
    accentColor: "from-blue-500/20 to-purple-500/10 border-blue-500/30 text-blue-300",
  },
  {
    key: "skaters",
    label: "Hráči (Korčuliari)",
    shortLabel: "Korčuliari",
    icon: "🏒",
    description: "Individuálne kariérne, sezónne, zápasové rekordy korčuliarov, nováčikov a play-off.",
    accentColor: "from-cyan-500/20 to-blue-500/10 border-cyan-500/30 text-cyan-300",
  },
  {
    key: "goalies",
    label: "Brankári",
    shortLabel: "Brankári",
    icon: "🧤",
    description: "Kariérne a sezónne rekordy brankárov — výhry, čisté kontá, ukradnuté zápasy a GSAx.",
    accentColor: "from-emerald-500/20 to-teal-500/10 border-emerald-500/30 text-emerald-300",
  },
  {
    key: "gms",
    label: "Manažéri (GM)",
    shortLabel: "Manažéri",
    icon: "👔",
    description: "Historické míľniky generálnych manažérov — odohrané sezóny, série a tituly.",
    accentColor: "from-amber-500/20 to-yellow-500/10 border-amber-500/30 text-amber-300",
  },
  {
    key: "teams",
    label: "Tímy & Poháre",
    shortLabel: "Tímy",
    icon: "🏆",
    description: "Tímové víťazstvá, zisky pohárov, sezónne a sériové maximá klubov.",
    accentColor: "from-yellow-500/20 to-amber-500/10 border-yellow-500/30 text-yellow-300",
  },
  {
    key: "trophies",
    label: "Trofeje & Ocenenia",
    shortLabel: "Trofeje",
    icon: "🏵️",
    description: "Historický prehľad víťazov individuálnych trofejí a ocenení.",
    accentColor: "from-purple-500/20 to-pink-500/10 border-purple-500/30 text-purple-300",
  },
  {
    key: "games",
    label: "Zápasy & Diváci",
    shortLabel: "Zápasy",
    icon: "🏟️",
    description: "Divácka návštevnosť, gólové prestrelky, rekordné výhry a vekové míľniky.",
    accentColor: "from-indigo-500/20 to-blue-500/10 border-indigo-500/30 text-indigo-300",
  },
  {
    key: "pre",
    label: "Príprava (Pre-season)",
    shortLabel: "Príprava",
    icon: "☀️",
    description: "Reálne tímové a individuálne štatistiky z predsezónnej prípravy.",
    accentColor: "from-orange-500/20 to-amber-500/10 border-orange-500/30 text-orange-300",
  },
];

export default async function LeagueRecordsPage({
  searchParams,
}: {
  searchParams: Promise<{ league?: string; phase?: string; cat?: string }>;
}) {
  const sp = await searchParams;
  const league = sp.league === "AHL" ? "AHL" : "NHL";
  const rawPhase = sp.phase;
  const phase: RecordPhase =
    rawPhase === "regular" || rawPhase === "playoffs" || rawPhase === "pre"
      ? rawPhase
      : "all";

  const rawCat = sp.cat as MainRecordCategory | undefined;
  const category: MainRecordCategory =
    rawCat && ["all", "skaters", "goalies", "gms", "teams", "trophies", "games", "pre"].includes(rawCat)
      ? rawCat
      : "all";

  const data = await getLeagueRecords(league, phase, category);

  const phasesList: Array<{ key: RecordPhase; label: string; icon: string }> = [
    { key: "all", label: "Všetky fázy", icon: "🌐" },
    { key: "regular", label: "Základná časť", icon: "🏒" },
    { key: "playoffs", label: "Play-off", icon: "🏆" },
    { key: "pre", label: "Príprava", icon: "☀️" },
  ];

  // Group the resulting categories by their overarching mainCategory for clear visual separation
  const majorSectionsOrder: Array<{ cat: MainRecordCategory; meta: CategoryMeta }> = CATEGORIES
    .filter((c) => c.key !== "all")
    .map((meta) => ({ cat: meta.key, meta }));

  return (
    <div className="space-y-6 py-2">
      <PageHeader
        title="Historické rekordy ligy"
        subtitle={`Všetky historické a sezónne rekordy ${league} — prehľadne rozdelené podľa kategórií: hráči, brankári, GM, tímy, trofeje a zápasy.`}
      />

      <HistoryNav active="records" league={league} />

      {/* Main Bar: League switch + Category Filter + Phase tabs */}
      <div className="space-y-4 bg-slate-900/80 p-4 rounded-2xl border border-slate-800 shadow-md">
        {/* Row 1: League Switcher & Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap pb-3 border-b border-slate-800/80">
          <div className="flex items-center gap-2">
            <Link
              href={`/history/records?league=NHL&phase=${phase}&cat=${category}`}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
                league === "NHL"
                  ? "bg-blue-600 text-white shadow-md shadow-blue-500/25 ring-2 ring-blue-400/50"
                  : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
              }`}
            >
              <span>🏆</span>
              <span>NHL Rekordy</span>
            </Link>
            <Link
              href={`/history/records?league=AHL&phase=${phase}&cat=${category}`}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
                league === "AHL"
                  ? "bg-orange-600 text-white shadow-md shadow-orange-500/25 ring-2 ring-orange-400/50"
                  : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
              }`}
            >
              <span>🏒</span>
              <span>AHL Rekordy</span>
            </Link>
          </div>

          {/* Active section info badge */}
          <div className="text-xs text-slate-400 flex items-center gap-1.5">
            <span className="font-semibold text-slate-300">Zobrazených:</span>
            <span className="px-2.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 font-bold text-amber-400">
              {data.groups.reduce((sum, g) => sum + g.records.length, 0)} rekordov
            </span>
          </div>
        </div>

        {/* Row 2: Category Selector Tabs */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Kategória rekordov:</span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {CATEGORIES.map((c) => {
              const isActive = category === c.key;
              return (
                <Link
                  key={c.key}
                  href={`/history/records?league=${league}&phase=${phase}&cat=${c.key}`}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                    isActive
                      ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-600/30 ring-1 ring-blue-400"
                      : "bg-slate-800/80 text-slate-300 hover:bg-slate-700/90 border border-slate-700/60"
                  }`}
                >
                  <span>{c.icon}</span>
                  <span>{c.label}</span>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Row 3: Phase Selector Tabs */}
        <div className="flex items-center gap-2 flex-wrap pt-3 border-t border-slate-800/80">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mr-1">Fáza súťaže:</span>
          {phasesList.map((p) => {
            const isActive = phase === p.key;
            return (
              <Link
                key={p.key}
                href={`/history/records?league=${league}&phase=${p.key}&cat=${category}`}
                className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  isActive
                    ? "bg-slate-100 text-slate-900 shadow font-black"
                    : "bg-slate-800/70 text-slate-400 hover:bg-slate-700 hover:text-slate-200 border border-slate-700/40"
                }`}
              >
                <span>{p.icon}</span>
                <span>{p.label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Render Major Category Blocks */}
      <div className="space-y-12">
        {data.groups.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-12 text-center">
            <p className="text-slate-400 text-sm">V tejto kombinácii kategórie a fázy súťaže sa nenachádzajú žiadne rekordy.</p>
            <Link
              href={`/history/records?league=${league}&phase=all&cat=all`}
              className="inline-block mt-3 text-xs font-bold text-blue-400 hover:underline"
            >
              Zobraziť všetky rekordy
            </Link>
          </div>
        ) : (
          majorSectionsOrder.map(({ cat, meta }) => {
            const groupsInCat = data.groups.filter((g) => g.mainCategory === cat);
            if (!groupsInCat.length) return null;

            return (
              <div key={cat} className="space-y-6 pt-2 first:pt-0">
                {/* Major Category Banner Divider */}
                <div className={`rounded-2xl bg-gradient-to-r ${meta.accentColor} border p-4 shadow-sm flex items-center justify-between gap-4 flex-wrap`}>
                  <div className="flex items-center gap-3">
                    <span className="text-3xl" aria-hidden>{meta.icon}</span>
                    <div>
                      <h2 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-2">
                        <span>{meta.label}</span>
                      </h2>
                      <p className="text-xs text-slate-400 mt-0.5">{meta.description}</p>
                    </div>
                  </div>

                  <span className="text-xs font-bold px-3 py-1 rounded-full bg-slate-950/60 border border-slate-700/80 text-slate-300 shrink-0">
                    {groupsInCat.length} {groupsInCat.length === 1 ? "skupina" : groupsInCat.length < 5 ? "skupiny" : "skupín"} · {groupsInCat.reduce((sum, g) => sum + g.records.length, 0)} rekordov
                  </span>
                </div>

                {/* Sub-groups within this Major Category */}
                <div className="space-y-8 pl-1 sm:pl-2">
                  {groupsInCat.map((group) => (
                    <section key={group.id} id={group.id} className="space-y-3.5 scroll-mt-6">
                      <div className="flex items-center gap-2 pb-1.5 border-b border-slate-800/60">
                        <span className="text-lg" aria-hidden>{group.icon}</span>
                        <h3 className="text-sm font-black tracking-tight text-slate-200">{group.title}</h3>
                        <span className="text-[11px] px-2 py-0.2 rounded bg-slate-800/80 text-slate-400 font-semibold ml-auto">
                          {group.records.length} {group.records.length === 1 ? "rekord" : group.records.length < 5 ? "rekordy" : "rekordov"}
                        </span>
                      </div>

                      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                        {group.records.map((record) => (
                          <RecordCard key={record.id} record={record} cupName={data.cupName} />
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
