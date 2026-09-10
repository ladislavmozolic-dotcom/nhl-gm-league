import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/auth";
import { liveCapHit } from "@/lib/finance";
import { PageHeader, Card } from "@/components/ui";
import SortableTable, { type SortCol, type SortRow } from "@/components/SortableTable";

export const dynamic = "force-dynamic";

// GM Assistant — "Find Player". Same rule as Analyze My Roster: a plain,
// inspectable filter over data already in the DB — every filter you set is
// visible in the URL/form, and every result row is the exact player + numbers
// that matched it. No ranking model, no LLM. Commissioner-only for now (see
// memory: gm-assistant-intelligence) — 404s for anyone else.

const POSITIONS = ["ALL", "C", "LW", "RW", "D", "G"] as const;
const ROSTER_TYPES = ["ANY", "NHL", "AHL", "UFA"] as const;

interface Filters {
  pos: (typeof POSITIONS)[number];
  rosterType: (typeof ROSTER_TYPES)[number];
  minOverall: number;
  maxCap: number | null; // dollars
  maxAge: number | null;
  tradeBlockOnly: boolean;
}

function parseFilters(sp: Record<string, string | undefined>): Filters {
  const pos = POSITIONS.includes(sp.pos as any) ? (sp.pos as Filters["pos"]) : "ALL";
  const rosterType = ROSTER_TYPES.includes(sp.rosterType as any) ? (sp.rosterType as Filters["rosterType"]) : "ANY";
  const minOverall = Number(sp.minOverall) || 0;
  const maxCapM = sp.maxCap ? Number(sp.maxCap) : null;
  const maxAge = sp.maxAge ? Number(sp.maxAge) : null;
  const tradeBlockOnly = sp.tradeBlockOnly === "1";
  return { pos, rosterType, minOverall, maxCap: maxCapM != null && !Number.isNaN(maxCapM) ? maxCapM * 1_000_000 : null, maxAge: maxAge && !Number.isNaN(maxAge) ? maxAge : null, tradeBlockOnly };
}

export default async function FindPlayerPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if (!(await isAdmin())) notFound();

  const sp = await searchParams;
  const f = parseFilters(sp);
  const isGoalieSearch = f.pos === "G";

  const baseWhere: Record<string, unknown> = {
    isGoalie: isGoalieSearch,
    ...(f.rosterType !== "ANY" ? { rosterType: f.rosterType } : { rosterType: { in: ["NHL", "AHL", "UFA"] } }),
    ...(f.tradeBlockOnly ? { onTradeBlock: true } : {}),
    ...(f.maxAge != null ? { age: { lte: f.maxAge } } : {}),
    ...(!isGoalieSearch && f.pos !== "ALL" ? { position: { contains: f.pos } } : {}),
  };

  const players = isGoalieSearch
    ? await prisma.player.findMany({
        where: { ...baseWhere, goalieRating: { overall: { gte: f.minOverall } } },
        include: { team: { select: { code: true, slug: true, logoUrl: true } }, goalieRating: { select: { overall: true } } },
        orderBy: { overall: "desc" },
      })
    : await prisma.player.findMany({
        where: { ...baseWhere, overall: { gte: f.minOverall } },
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
        pos: p.position, age: p.age, ovr, cap,
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
    { key: "ovr", label: "OVR", kind: "ovr" },
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
        subtitle="GM Assistant"
        right={<Link href="/tools/assistant" className="text-sm text-slate-400 hover:text-blue-400">← GM Assistant</Link>}
      />

      <Card bodyClassName="p-4">
        <form method="get" className="grid grid-cols-2 md:grid-cols-6 gap-3 items-end">
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
            <label className={labelCls}>Min. OVR</label>
            <input type="number" name="minOverall" min={0} max={99} defaultValue={f.minOverall || ""} className={inputCls} placeholder="0" />
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
          <div className="col-span-2 md:col-span-6 flex gap-2">
            <button type="submit" className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold">Hľadať</button>
            <Link href="/tools/assistant/find-player" className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold">Reset</Link>
          </div>
        </form>
      </Card>

      <Card title={`Výsledky (${rows.length})`} bodyClassName="p-2">
        {rows.length === 0 ? (
          <p className="text-slate-500 text-center py-8">Žiadny hráč nezodpovedá filtrom.</p>
        ) : (
          <SortableTable cols={cols} rows={rows} initialSort="ovr" minWidth={760} />
        )}
      </Card>
    </div>
  );
}
