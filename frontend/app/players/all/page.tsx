import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card } from "@/components/ui";
import SortableTable, { type SortCol, type SortRow } from "@/components/SortableTable";
import { posGroup, ratingColor, ovColor } from "@/lib/ratingBands";
import { epProfileUrl, cleanName } from "@/lib/playerName";
import { PROSPECT_PROJECTION_INCLUDE, PROJECTION_COLS, prospectProjectionCells } from "@/lib/prospect-projection";
import { isLoggedIn } from "@/lib/auth";
import { liveCapHit, money } from "@/lib/finance";
import { getLang } from "@/lib/lang-server";
import PlayerAvatar from "@/components/playerAvatar";

export const dynamic = "force-dynamic";

type TabType = "players" | "goalies" | "prospects";

const SKATER_ATTRS = ["ck", "fg", "di", "sk", "st", "en", "du", "ph", "fo", "pa", "sc", "df", "ps", "ex", "ld", "mo"];
const GOALIE_ATTRS = ["sk", "du", "en", "sz", "ag", "rb", "sc", "hs", "rt", "ph", "ps", "ex", "ld", "mo"];

export default async function AllRostersPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const [raw, cfg, loggedIn, lang] = await Promise.all([
    searchParams.then((sp) => sp.type),
    prisma.leagueConfig.findUnique({ where: { id: 1 } }),
    isLoggedIn(),
    getLang(),
  ]);

  const isCs = lang === "cs";
  const type: TabType = raw === "goalies" || raw === "prospects" ? raw : "players";
  const source = cfg?.rosterMode === "real" ? "real" : "profinhl";

  // Tab counts
  const [skatersCount, goaliesCount, prospectsCount] = await Promise.all([
    prisma.player.count({ where: { isGoalie: false, rosterType: { in: ["NHL", "AHL"] } } }),
    prisma.player.count({ where: { isGoalie: true, rosterType: { in: ["NHL", "AHL"] } } }),
    prisma.prospect.count({ where: { source } }),
  ]);

  let cols: SortCol[] = [];
  let rows: SortRow[] = [];
  let initialSort = "ovr";
  let count = 0;
  let topItem: { name: string; label: string; photo?: string | null; badge: string } | null = null;
  let avgAge = 0;

  if (type === "prospects") {
    const prospects = await prisma.prospect.findMany({
      where: { source },
      include: { team: { select: { code: true, slug: true, logoUrl: true } }, ...PROSPECT_PROJECTION_INCLUDE },
      orderBy: { overallPick: "asc" },
    });
    count = prospects.length;
    if (prospects.length > 0) {
      topItem = {
        name: prospects[0].name,
        label: isCs ? "Top prospekt draftu" : "Top Draft Prospect",
        badge: `#${prospects[0].overallPick ?? 1}`,
      };
    }

    cols = [
      { key: "name", label: isCs ? "Prospekt" : "Prospect", kind: "ext", sticky: true, title: "EliteProspects" },
      { key: "team", label: isCs ? "Tím" : "Team", kind: "team" },
      { key: "pos", label: isCs ? "Poz" : "Pos", kind: "text" },
      { key: "year", label: isCs ? "Rok draftu" : "Draft Year", kind: "num" },
      { key: "pick", label: isCs ? "Voľba" : "Pick #", kind: "num" },
      ...PROJECTION_COLS,
    ];

    rows = prospects.map((p) => ({
      _id: p.id,
      name: p.name,
      pos: (p as any).position,
      epUrl: (p as any).epUrl ?? epProfileUrl(p.name),
      teamCode: p.team?.code,
      teamSlug: p.team?.slug,
      teamLogo: p.team?.logoUrl,
      year: p.draftYear,
      pick: p.overallPick,
      ...prospectProjectionCells(p, !((p as any).undrafted && !p.draftYear)),
    }));
    initialSort = "pick";
  } else {
    const isGoalie = type === "goalies";
    const attrs = loggedIn ? (isGoalie ? GOALIE_ATTRS : SKATER_ATTRS) : [];
    const players = await prisma.player.findMany({
      where: { isGoalie, rosterType: { in: ["NHL", "AHL"] } },
      include: { team: { select: { code: true, slug: true, logoUrl: true } }, goalieRating: true },
      orderBy: { overall: "desc" },
    });
    count = players.length;

    if (players.length > 0) {
      topItem = {
        name: players[0].name,
        photo: players[0].photoUrl,
        label: isCs ? (isGoalie ? "Najlepší brankár" : "Najlepší hráč") : (isGoalie ? "Highest Rated Goalie" : "Highest Rated Skater"),
        badge: `${players[0].overall} OVR`,
      };
      const ages = players.filter((p) => p.age != null).map((p) => p.age!);
      if (ages.length > 0) {
        avgAge = Math.round((ages.reduce((s, a) => s + a, 0) / ages.length) * 10) / 10;
      }
    }

    cols = [
      { key: "name", label: isGoalie ? (isCs ? "Brankár" : "Goalie") : (isCs ? "Hráč" : "Player"), kind: "player", sticky: true },
      { key: "team", label: isCs ? "Tím" : "Team", kind: "team" },
      { key: "pos", label: isCs ? "Poz" : "Pos", kind: "text" },
      { key: "age", label: isCs ? "Vek" : "Age", kind: "num" },
      ...attrs.map((a) => ({ key: a, label: a.toUpperCase(), kind: "num" as const })),
      { key: "ovr", label: "OVR", kind: "ovr" as const },
      { key: "cap", label: "Cap Hit", kind: "money" as const },
      { key: "yrs", label: isCs ? "Roky" : "Yrs", kind: "years" as const },
    ];

    rows = players.map((p) => {
      const rr: any = isGoalie ? { ...p, ...(p.goalieRating ?? {}), mo: p.mo } : p;
      const ovr = isGoalie ? p.goalieRating?.overall ?? p.overall : p.overall;
      const grp = isGoalie ? ("G" as const) : posGroup(p.position, false);
      return {
        _id: p.id,
        name: p.name,
        slug: p.slug,
        photo: p.photoUrl,
        teamCode: p.team?.code,
        teamSlug: p.team?.slug,
        teamLogo: p.team?.logoUrl,
        pos: p.position,
        age: p.age,
        ...Object.fromEntries(attrs.map((a) => [a, rr[a]])),
        ...Object.fromEntries(attrs.map((a) => [`_c_${a}`, ratingColor(grp, a, rr[a])])),
        ovr,
        _c_ovr: ovColor(grp, ovr),
        cap: liveCapHit(p),
        yrs: p.contractYears ?? (p.contractExpiry ? p.contractExpiry - 2026 : null),
      };
    });
  }

  const tabs: { key: TabType; label: string; count: number }[] = [
    { key: "players", label: isCs ? "Hráči v poli" : "Skaters", count: skatersCount },
    { key: "goalies", label: isCs ? "Brankári" : "Goalies", count: goaliesCount },
    { key: "prospects", label: isCs ? "Prospekti" : "Prospects", count: prospectsCount },
  ];

  return (
    <div className="space-y-6 py-2">
      {/* Page Header */}
      <PageHeader
        title={isCs ? "Všetci hráči" : "All Players Directory"}
        subtitle={
          isCs
            ? `Kompletný zoznam hráčov a atribútov v databáze (${cfg?.rosterMode === "real" ? "Reálny" : "ProfiNHL"} režim)`
            : `Comprehensive roster master database (${cfg?.rosterMode === "real" ? "Real" : "ProfiNHL"} dataset)`
        }
      />

      {/* Top HUD Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 backdrop-blur shadow-sm">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            {isCs ? "Počet v kategórii" : "Active Count"}
          </div>
          <div className="text-2xl font-black text-white mt-1">
            {count} <span className="text-xs font-normal text-slate-500">{isCs ? "hráčov" : "registered"}</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {type === "prospects" ? (isCs ? "Draftovaní & talenty" : "Drafted & Watchlist") : "NHL & AHL"}
          </div>
        </div>

        {topItem && (
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 backdrop-blur shadow-sm">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              {topItem.label}
            </div>
            <div className="mt-1 flex items-center gap-2">
              {topItem.photo !== undefined && (
                <PlayerAvatar src={topItem.photo} alt={topItem.name} size={30} />
              )}
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold text-white truncate">{cleanName(topItem.name)}</div>
                <div className="text-xs font-black text-amber-400 font-mono">{topItem.badge}</div>
              </div>
            </div>
          </div>
        )}

        {type !== "prospects" && (
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 backdrop-blur shadow-sm">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              {isCs ? "Priemerný vek" : "Average Age"}
            </div>
            <div className="text-2xl font-black text-sky-400 mt-1">
              {avgAge} <span className="text-xs font-medium text-slate-400">{isCs ? "rokov" : "yrs"}</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              {isCs ? "Naprieč súpiskami" : "Across active rosters"}
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-3">
        {tabs.map((t) => {
          const active = t.key === type;
          return (
            <Link
              key={t.key}
              href={`/players/all?type=${t.key}`}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                active
                  ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                  : "bg-slate-900/70 text-slate-400 border border-slate-800 hover:border-slate-700 hover:text-slate-200"
              }`}
            >
              <span>{t.label}</span>
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
                  active ? "bg-white/20 text-white" : "bg-slate-800 text-slate-400"
                }`}
              >
                {t.count}
              </span>
            </Link>
          );
        })}
      </div>

      {/* Table Card */}
      {count === 0 ? (
        <Card>
          <p className="text-slate-500 text-center py-8">
            {isCs ? "Neboli nájdení žiadni hráči" : `No ${type} found`}
          </p>
        </Card>
      ) : (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-2 shadow-lg backdrop-blur">
          <SortableTable
            cols={cols}
            rows={rows}
            initialSort={initialSort}
            minWidth={type === "prospects" ? 920 : 1100}
            csvFilename={`all_${type}`}
          />
          <div className="px-3 py-2 text-[11px] text-slate-500 border-t border-slate-800/60 mt-1 flex items-center justify-between">
            <span>
              {isCs ? "Kliknutím na záhlavie stĺpca zoradíte tabuľku." : "Click any column header to sort."}
            </span>
            <span>
              {count} {isCs ? "záznamov" : "rows"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
