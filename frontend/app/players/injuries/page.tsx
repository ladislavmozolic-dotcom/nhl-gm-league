import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { currentInjuries, seasonInjuries } from "@/lib/injuries-server";
import { CurrentInjuryTable, SeasonInjuryTable } from "@/components/InjuryTables";
import { defaultStatsPhase } from "@/lib/calendar-server";
import { PRE_SEASON, REGULAR_SEASON } from "@/lib/phase";
import { getLang } from "@/lib/lang-server";

export const dynamic = "force-dynamic";

export default async function InjuriesPage({ searchParams }: { searchParams: Promise<{ view?: string; league?: string }> }) {
  const [sp, lang] = await Promise.all([searchParams, getLang()]);
  const isCs = lang === "cs";

  const view = sp.view === "all" ? "all" : "current";
  const league = sp.league === "AHL" ? "AHL" : "NHL";
  const season = (await defaultStatsPhase()) === "pre" ? PRE_SEASON : REGULAR_SEASON;

  const [current, all] = view === "current"
    ? [await currentInjuries({ league }), []]
    : [[], await seasonInjuries(season, { league })];

  const title = isCs ? `Zranenia ${league}` : `${league} Injury Report`;
  const subtitle = view === "current"
    ? (isCs
      ? `${current.length} ${current.length === 1 ? "hráč" : current.length < 5 ? "hráči" : "hráčov"} momentálne mimo hry — ${league}`
      : `${current.length} player${current.length === 1 ? "" : "s"} currently sidelined — ${league}`)
    : (isCs
      ? `${all.length} zranení v tejto sezóne — ${league}`
      : `${all.length} injuries recorded this season — ${league}`);

  return (
    <div className="space-y-6 py-2">
      {/* Page Header */}
      <PageHeader
        title={title}
        subtitle={subtitle}
        right={
          <div className="flex items-center gap-2 bg-slate-900/80 p-1 rounded-xl border border-slate-800">
            <Link
              href={`/players/injuries?league=NHL${view === "all" ? "&view=all" : ""}`}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                league === "NHL" ? "bg-blue-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
              }`}
            >
              NHL
            </Link>
            <Link
              href={`/players/injuries?league=AHL${view === "all" ? "&view=all" : ""}`}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                league === "AHL" ? "bg-emerald-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
              }`}
            >
              AHL
            </Link>
          </div>
        }
      />

      {/* View Switcher Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3">
        <Link
          href={`/players/injuries?view=current${league === "AHL" ? "&league=AHL" : ""}`}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            view === "current"
              ? "bg-rose-500/15 text-rose-300 border border-rose-500/30 shadow-sm"
              : "bg-slate-900/70 text-slate-400 border border-slate-800 hover:border-slate-700 hover:text-slate-200"
          }`}
        >
          <span>🏥</span>
          <span>{isCs ? "Aktuálne zranenia" : "Current Injuries"}</span>
          <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-800 text-slate-300 font-mono">
            {view === "current" ? current.length : "•"}
          </span>
        </Link>

        <Link
          href={`/players/injuries?view=all${league === "AHL" ? "&league=AHL" : ""}`}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            view === "all"
              ? "bg-blue-500/15 text-blue-300 border border-blue-500/30 shadow-sm"
              : "bg-slate-900/70 text-slate-400 border border-slate-800 hover:border-slate-700 hover:text-slate-200"
          }`}
        >
          <span>📜</span>
          <span>{isCs ? "Archív celej sezóny" : "Season Archive"}</span>
          <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-800 text-slate-300 font-mono">
            {view === "all" ? all.length : "•"}
          </span>
        </Link>
      </div>

      {/* Table Section */}
      <div>
        {view === "current" ? (
          <CurrentInjuryTable rows={current} lang={lang} />
        ) : (
          <SeasonInjuryTable rows={all} lang={lang} />
        )}
      </div>

      {view === "all" && (
        <p className="text-xs text-slate-500 px-1">
          {isCs
            ? "Všetky zranenia zaznamenané herným simulátorom v zápasových udalostiach (hit / zblokovaná strela / bitka / únava / kolízia)."
            : "Every injury recorded by the sim match engine (hit / blocked shot / fight / fatigue / collision), including responsible player where applicable."}
        </p>
      )}
    </div>
  );
}
