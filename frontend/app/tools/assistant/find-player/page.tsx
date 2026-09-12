import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getTeamSession } from "@/lib/auth";
import { liveCapHit } from "@/lib/finance";
import { PageHeader, Card, BackPill } from "@/components/ui";
import SortableTable, { type SortCol, type SortRow } from "@/components/SortableTable";

export const dynamic = "force-dynamic";

// UNHL Intelligence — "Find Player". Same rule as Analyze My Roster: a plain,
// inspectable filter over data already in the DB — every filter you set is
// visible in the URL/form, and every result row is the exact player + numbers
// that matched it. No ranking model, no LLM. Open to any logged-in GM (see
// memory: gm-assistant-intelligence) — 404s for anyone not logged in.

const POSITIONS = ["ALL", "C", "LW", "RW", "D", "G"] as const;
const ROSTER_TYPES = ["ANY", "NHL", "AHL", "UFA"] as const;

interface Filters {
  pos: (typeof POSITIONS)[number];
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

function parseFilters(sp: Record<string, string | undefined>): Filters {
  const pos = POSITIONS.includes(sp.pos as any) ? (sp.pos as Filters["pos"]) : "ALL";
  const rosterType = ROSTER_TYPES.includes(sp.rosterType as any) ? (sp.rosterType as Filters["rosterType"]) : "ANY";
  const maxCapM = num(sp.maxCap);
  return {
    pos, rosterType,
    minCk: num(sp.minCk), minPa: num(sp.minPa), minSc: num(sp.minSc), minDf: num(sp.minDf),
    maxCap: maxCapM != null ? maxCapM * 1_000_000 : null,
    maxAge: num(sp.maxAge),
    tradeBlockOnly: sp.tradeBlockOnly === "1",
  };
}

export default async function FindPlayerPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if ((await getTeamSession()) == null) notFound();

  const sp = await searchParams;
  const f = parseFilters(sp);
  const isGoalieSearch = f.pos === "G";

  const baseWhere: Record<string, unknown> = {
    isGoalie: isGoalieSearch,
    ...(f.rosterType !== "ANY" ? { rosterType: f.rosterType } : { rosterType: { in: ["NHL", "AHL", "UFA"] } }),
    ...(f.tradeBlockOnly ? { onTradeBlock: true } : {}),
    ...(f.maxAge != null ? { age: { lte: f.maxAge } } : {}),
    ...(!isGoalieSearch && f.pos !== "ALL" ? { position: { contains: f.pos } } : {}),
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
        include: { team: { select: { code: true, slug: true, logoUrl: true } }, goalieRating: { select: { overall: true } } },
        orderBy: { overall: "desc" },
      })
    : await prisma.player.findMany({
        where: baseWhere,
        include: { team: { select: { code: true, slug: true, logoUrl: true } } },
        orderBy: { overall: "desc" },
      });

  const rows: SortRow[] = players
    .map((p) => {
      const ovr = isGoalieSearch ? (p as any).goalieRating?.overall ?? p.overall : p.overall;
      const cap = liveCapHit(p);
      return {
        _id: p.id, name: p.name, slug: p.slug, photo: p.photoUrl,
        teamCode: p.team?.code, teamSlug: p.team?.slug, teamLogo: p.team?.logoUrl,
        pos: p.position, age: p.age,
        ck: isGoalieSearch ? null : (p as any).ck, pa: isGoalieSearch ? null : (p as any).pa,
        sc: isGoalieSearch ? null : (p as any).sc, df: isGoalieSearch ? null : (p as any).df,
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
    { key: "age", label: "Age", kind: "num" },
    ...(isGoalieSearch ? [] : ([
      { key: "ck", label: "CK", kind: "num" },
      { key: "pa", label: "PA", kind: "num" },
      { key: "sc", label: "SC", kind: "num" },
      { key: "df", label: "DF", kind: "num" },
    ] as SortCol[])),
    { key: "ovr", label: "OVR", kind: "ovr", title: "Orientačné celkové číslo — na hľadanie použi radšej CK/PA/SC/DF" },
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
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 items-end">
            <div>
              <label className={labelCls}>Pozícia</label>
              <select name="pos" defaultValue={f.pos} className={inputCls}>
                {POSITIONS.map((p) => <option key={p} value={p}>{p === "ALL" ? "Všetky" : p}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Status</label>
              <select name="rosterType" defaultValue={f.rosterType} className={inputCls}>
                {ROSTER_TYPES.map((r) => <option key={r} value={r}>{r === "ANY" ? "Akýkoľvek" : r}</option>)}
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

          {f.pos !== "G" && (
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
          <SortableTable cols={cols} rows={rows} initialSort={isGoalieSearch ? "ovr" : "sc"} minWidth={880} />
        )}
      </Card>
    </div>
  );
}
