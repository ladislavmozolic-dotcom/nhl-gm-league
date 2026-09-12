import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getTeamSession } from "@/lib/auth";
import { liveCapHit } from "@/lib/finance";
import { SKATER_ATTRS, GOALIE_ATTRS } from "@/lib/ratingBands";
import { PageHeader, Card, BackPill } from "@/components/ui";
import SortableTable, { type SortCol, type SortRow } from "@/components/SortableTable";

export const dynamic = "force-dynamic";

// UNHL Intelligence — "Find Player". Same rule as Analyze My Roster: a plain,
// inspectable filter over data already in the DB — every filter you set is
// visible in the URL/form, and every result row is the exact player + numbers
// that matched it. No ranking model, no LLM. Open to any logged-in GM (see
// memory: gm-assistant-intelligence) — 404s for anyone not logged in.

const SKATER_POS = ["C", "LW", "RW", "D"] as const;
type SkaterPos = (typeof SKATER_POS)[number];
const ROSTER_TYPES = ["ANY", "NHL", "AHL", "UFA"] as const;
const SHOOTS = ["ANY", "L", "R"] as const;

interface Filters {
  // Which skater positions to include — empty means all of them. "G" is its
  // own checkbox outside this list: checking it switches the whole search to
  // goalies (their rating card doesn't share a single field with skaters, so
  // the two searches don't mix in one query/table).
  positions: SkaterPos[];
  searchGoalies: boolean;
  shoots: (typeof SHOOTS)[number];
  rosterType: (typeof ROSTER_TYPES)[number];
  // OV is a rough headline number in this league — real scouting goes through the
  // rated parameters, so filtering/sorting leans on CK/PA/SC/DF, not OV.
  minCk: number | null;
  minPa: number | null;
  minSc: number | null;
  minDf: number | null;
  maxCap: number | null; // dollars
  maxAge: number | null;
  tradeBlockOnly: boolean;
}

function num(v: string | undefined): number | null {
  if (!v) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

function toArray(v: string | string[] | undefined): string[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

function parseFilters(sp: Record<string, string | string[] | undefined>): Filters {
  const rawPos = toArray(sp.pos);
  const positions = SKATER_POS.filter((p) => rawPos.includes(p));
  const searchGoalies = rawPos.includes("G");
  const shoots = SHOOTS.includes(sp.shoots as any) ? (sp.shoots as Filters["shoots"]) : "ANY";
  const rosterType = ROSTER_TYPES.includes(sp.rosterType as any) ? (sp.rosterType as Filters["rosterType"]) : "ANY";
  const maxCapM = num(sp.maxCap as string | undefined);
  return {
    positions, searchGoalies, shoots, rosterType,
    minCk: num(sp.minCk as string | undefined), minPa: num(sp.minPa as string | undefined),
    minSc: num(sp.minSc as string | undefined), minDf: num(sp.minDf as string | undefined),
    maxCap: maxCapM != null ? maxCapM * 1_000_000 : null,
    maxAge: num(sp.maxAge as string | undefined),
    tradeBlockOnly: sp.tradeBlockOnly === "1",
  };
}

export default async function FindPlayerPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if ((await getTeamSession()) == null) notFound();

  const sp = await searchParams;
  const f = parseFilters(sp);
  const isGoalieSearch = f.searchGoalies;

  const baseWhere: Record<string, unknown> = {
    isGoalie: isGoalieSearch,
    ...(f.rosterType !== "ANY" ? { rosterType: f.rosterType } : { rosterType: { in: ["NHL", "AHL", "UFA"] } }),
    ...(f.tradeBlockOnly ? { onTradeBlock: true } : {}),
    ...(f.maxAge != null ? { age: { lte: f.maxAge } } : {}),
    ...(f.shoots !== "ANY" ? { shoots: f.shoots } : {}),
    ...(!isGoalieSearch && f.positions.length > 0 ? { OR: f.positions.map((p) => ({ position: { contains: p } })) } : {}),
    // CK/PA/SC/DF are the parameters that actually matter here — OV is only a rough
    // headline number in this league, so it's shown but never filtered on.
    ...(!isGoalieSearch && f.minCk != null ? { ck: { gte: f.minCk } } : {}),
    ...(!isGoalieSearch && f.minPa != null ? { pa: { gte: f.minPa } } : {}),
    ...(!isGoalieSearch && f.minSc != null ? { sc: { gte: f.minSc } } : {}),
    ...(!isGoalieSearch && f.minDf != null ? { df: { gte: f.minDf } } : {}),
  };

  const players = isGoalieSearch
    ? await prisma.player.findMany({
        where: baseWhere,
        include: { team: { select: { code: true, slug: true, logoUrl: true } }, goalieRating: true },
        orderBy: { overall: "desc" },
      })
    : await prisma.player.findMany({
        where: baseWhere,
        include: { team: { select: { code: true, slug: true, logoUrl: true } } },
        orderBy: { overall: "desc" },
      });

  const attrs = isGoalieSearch ? GOALIE_ATTRS : SKATER_ATTRS;

  const rows: SortRow[] = players
    .map((p) => {
      const gr = isGoalieSearch ? (p as any).goalieRating : null;
      const ovr = isGoalieSearch ? gr?.overall ?? p.overall : p.overall;
      const cap = liveCapHit(p);
      const attrVals: Record<string, number | null> = {};
      for (const a of attrs) attrVals[a.key] = isGoalieSearch ? gr?.[a.key] ?? null : (p as any)[a.key] ?? null;
      return {
        _id: p.id, name: p.name, slug: p.slug, photo: p.photoUrl,
        teamCode: p.team?.code, teamSlug: p.team?.slug, teamLogo: p.team?.logoUrl,
        pos: p.position, age: p.age, shoots: p.shoots ?? "—",
        ...attrVals,
        ovr, cap,
        yrs: p.contractYears ?? null,
        status: [p.rosterType, p.onTradeBlock ? "Trade Block" : null].filter(Boolean).join(" · "),
      };
    })
    .filter((r) => f.maxCap == null || r.cap <= f.maxCap);

  const cols: SortCol[] = [
    { key: "name", label: "Player", kind: "player", sticky: true },
    { key: "team", label: "Team", kind: "team" },
    { key: "pos", label: "Pos", kind: "text" },
    { key: "shoots", label: "Shoots", kind: "text" },
    { key: "age", label: "Age", kind: "num" },
    ...attrs.map((a): SortCol => ({ key: a.key, label: a.label, kind: "num" })),
    { key: "ovr", label: "OVR", kind: "ovr", title: "Orientačné celkové číslo — na hľadanie použi radšej konkrétne parametre" },
    { key: "cap", label: "Cap Hit", kind: "money" },
    { key: "yrs", label: "Yrs", kind: "years" },
    { key: "status", label: "Status", kind: "text" },
  ];

  const inputCls = "w-full bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500";
  const labelCls = "block text-xs uppercase tracking-wide text-slate-400 mb-1";

  return (
    <div className="py-2 flex flex-col gap-6">
      <PageHeader
        title="🔎 Find Player"
        subtitle="UNHL Intelligence"
        right={<BackPill href="/tools/assistant">UNHL Intelligence</BackPill>}
      />

      <Card bodyClassName="p-4">
        <form method="get" className="flex flex-col gap-3">
          <div>
            <label className={labelCls}>Pozícia (viac možností)</label>
            <div className="flex flex-wrap gap-x-4 gap-y-1.5">
              {SKATER_POS.map((p) => (
                <label key={p} className="flex items-center gap-1.5 text-sm text-slate-200">
                  <input type="checkbox" name="pos" value={p} defaultChecked={f.positions.includes(p)} className="w-4 h-4" />
                  {p}
                </label>
              ))}
              <label className="flex items-center gap-1.5 text-sm text-slate-200">
                <input type="checkbox" name="pos" value="G" defaultChecked={f.searchGoalies} className="w-4 h-4" />
                G
              </label>
              <span className="text-[11px] text-slate-500 self-center">nič nezaškrtnuté = všetky korčuliari; G prepne hľadanie na brankárov</span>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-6 gap-3 items-end">
            <div>
              <label className={labelCls}>Status</label>
              <select name="rosterType" defaultValue={f.rosterType} className={inputCls}>
                {ROSTER_TYPES.map((r) => <option key={r} value={r}>{r === "ANY" ? "Akýkoľvek" : r}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Shoots</label>
              <select name="shoots" defaultValue={f.shoots} className={inputCls}>
                {SHOOTS.map((s) => <option key={s} value={s}>{s === "ANY" ? "Akákoľvek" : s}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Max Cap Hit ($M)</label>
              <input type="number" name="maxCap" min={0} step={0.1} defaultValue={f.maxCap != null ? f.maxCap / 1_000_000 : ""} className={inputCls} placeholder="bez limitu" />
            </div>
            <div>
              <label className={labelCls}>Max vek</label>
              <input type="number" name="maxAge" min={17} max={45} defaultValue={f.maxAge ?? ""} className={inputCls} placeholder="bez limitu" />
            </div>
            <div className="flex items-center gap-2 pb-2.5">
              <input type="checkbox" id="tradeBlockOnly" name="tradeBlockOnly" value="1" defaultChecked={f.tradeBlockOnly} className="w-4 h-4" />
              <label htmlFor="tradeBlockOnly" className="text-sm text-slate-300">Iba Trade Block</label>
            </div>
          </div>

          {!f.searchGoalies && (
            <div>
              <label className={`${labelCls} mb-1.5`}>Min. parametre (OVR je len orientačné — hľadaj radšej podľa týchto)</label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">CK — Checking</label>
                  <input type="number" name="minCk" min={0} max={99} defaultValue={f.minCk ?? ""} className={inputCls} placeholder="—" />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">PA — Passing</label>
                  <input type="number" name="minPa" min={0} max={99} defaultValue={f.minPa ?? ""} className={inputCls} placeholder="—" />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">SC — Scoring</label>
                  <input type="number" name="minSc" min={0} max={99} defaultValue={f.minSc ?? ""} className={inputCls} placeholder="—" />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">DF — Defense</label>
                  <input type="number" name="minDf" min={0} max={99} defaultValue={f.minDf ?? ""} className={inputCls} placeholder="—" />
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <button type="submit" className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold">Hľadať</button>
            <Link href="/tools/assistant/find-player" className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold">Reset</Link>
          </div>
        </form>
      </Card>

      <Card title={`Výsledky (${rows.length})`} bodyClassName="p-2">
        {rows.length === 0 ? (
          <p className="text-slate-500 text-center py-8">Žiadny hráč nezodpovedá filtrom.</p>
        ) : (
          <SortableTable cols={cols} rows={rows} initialSort={isGoalieSearch ? "ovr" : "sc"} minWidth={1400} />
        )}
      </Card>
    </div>
  );
}
