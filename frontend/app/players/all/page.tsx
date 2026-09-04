import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card } from "@/components/ui";
import SortableTable, { type SortCol, type SortRow } from "@/components/SortableTable";
import { posGroup, ratingColor, ovColor } from "@/lib/ratingBands";
import { epProfileUrl } from "@/lib/playerName";
import { isLoggedIn } from "@/lib/auth";

export const dynamic = "force-dynamic";

type TabType = "players" | "goalies" | "prospects";

const TABS: { key: TabType; label: string }[] = [
  { key: "players", label: "Skaters" },
  { key: "goalies", label: "Goalies" },
  { key: "prospects", label: "Prospects" },
];

const SKATER_ATTRS = ["ck", "fg", "di", "sk", "st", "en", "du", "ph", "fo", "pa", "sc", "df", "ps", "ex", "ld", "mo"];
const GOALIE_ATTRS = ["sk", "du", "en", "sz", "ag", "rb", "sc", "hs", "rt", "ph", "ps", "ex", "ld", "mo"];

export default async function AllRostersPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const raw = (await searchParams).type;
  const type: TabType = raw === "goalies" || raw === "prospects" ? raw : "players";
  const [cfg, loggedIn] = await Promise.all([prisma.leagueConfig.findUnique({ where: { id: 1 } }), isLoggedIn()]);

  let cols: SortCol[] = [];
  let rows: SortRow[] = [];
  let initialSort = "ovr";
  let count = 0;

  if (type === "prospects") {
    const source = cfg?.rosterMode === "real" ? "real" : "profinhl";
    const prospects = await prisma.prospect.findMany({
      where: { source },
      include: { team: { select: { code: true, slug: true, logoUrl: true } } },
      orderBy: { overallPick: "asc" },
    });
    count = prospects.length;
    cols = [
      { key: "name", label: "Prospect", kind: "ext", sticky: true, title: "Opens EliteProspects in a new tab" },
      { key: "team", label: "Team", kind: "team" },
      { key: "pos", label: "Pos", kind: "text" },
      { key: "year", label: "Draft Year", kind: "num" },
      { key: "pick", label: "Overall Pick", kind: "num" },
    ];
    rows = prospects.map((p) => ({
      _id: p.id, name: p.name, pos: (p as any).position,
      epUrl: (p as any).epUrl ?? epProfileUrl(p.name),
      teamCode: p.team?.code, teamSlug: p.team?.slug, teamLogo: p.team?.logoUrl,
      year: p.draftYear, pick: p.overallPick,
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
    cols = [
      { key: "name", label: isGoalie ? "Goalie" : "Player", kind: "player", sticky: true },
      { key: "team", label: "Team", kind: "team" },
      { key: "pos", label: "Pos", kind: "text" },
      { key: "age", label: "Age", kind: "num" },
      ...attrs.map((a) => ({ key: a, label: a.toUpperCase(), kind: "num" as const })),
      { key: "ovr", label: "OVR", kind: "ovr" as const },
      { key: "cap", label: "Cap Hit", kind: "money" as const },
      { key: "yrs", label: "Yrs", kind: "years" as const },
    ];
    rows = players.map((p) => {
      const rr: any = isGoalie ? { ...p, ...(p.goalieRating ?? {}) } : p;
      const ovr = isGoalie ? p.goalieRating?.overall ?? p.overall : p.overall;
      const grp = isGoalie ? ("G" as const) : posGroup(p.position, false);
      return {
        _id: p.id, name: p.name, slug: p.slug, photo: p.photoUrl,
        teamCode: p.team?.code, teamSlug: p.team?.slug, teamLogo: p.team?.logoUrl,
        pos: p.position, age: p.age,
        ...Object.fromEntries(attrs.map((a) => [a, rr[a]])),
        ...Object.fromEntries(attrs.map((a) => [`_c_${a}`, ratingColor(grp, a, rr[a])])),
        ovr, _c_ovr: ovColor(grp, ovr), cap: p.capHit ?? 0, yrs: p.contractYears ?? (p.contractExpiry ? p.contractExpiry - 2026 : null),
      };
    });
  }

  return (
    <div className="space-y-6 py-2">
      <PageHeader title="All Players" subtitle={`${count} ${type} in the ${cfg?.rosterMode === "real" ? "real" : "ProfiNHL"} dataset`} />

      <div className="flex gap-2">
        {TABS.map((t) => {
          const active = t.key === type;
          return (
            <Link key={t.key} href={`/players/all?type=${t.key}`}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${active ? "bg-blue-600 text-white" : "bg-slate-900/70 text-slate-400 border border-slate-800 hover:border-slate-600"}`}>
              {t.label}
            </Link>
          );
        })}
      </div>

      {count === 0 ? (
        <Card><p className="text-slate-500 text-center py-8">No {type} found</p></Card>
      ) : (
        <Card bodyClassName="p-2">
          <SortableTable cols={cols} rows={rows} initialSort={initialSort} minWidth={type === "prospects" ? 640 : 1080} />
          <p className="text-[11px] text-slate-600 px-2 pt-1">Click any column header to sort.</p>
        </Card>
      )}
    </div>
  );
}
