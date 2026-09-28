import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card, BackPill } from "@/components/ui";
import { money } from "@/lib/finance";
import { cleanName } from "@/lib/playerName";
import { loadMarketPool, teamContentionMap, teamAsk, ufaAtExpiry } from "@/lib/free-agency-server";
import { termPremium, isDepthSlot, slotLabel, MAX_TERM } from "@/lib/free-agency";
import { loadSettings } from "@/lib/sim/settings";

export const dynamic = "force-dynamic";

const TERMS = [1, 2, 3, 4] as const;

const SORT_KEYS = ["name", "team", "age", "status", "capHit", "ask1", "ask2", "ask3", "ask4"] as const;
type SortKey = (typeof SORT_KEYS)[number];
const isSortKey = (v: string | undefined): v is SortKey => !!v && (SORT_KEYS as readonly string[]).includes(v);
// cap hit / asks lead with the biggest first; everything else starts alphabetical/youngest-first
const DEFAULT_DIR: Record<SortKey, "asc" | "desc"> = { name: "asc", team: "asc", age: "asc", status: "asc", capHit: "desc", ask1: "desc", ask2: "desc", ask3: "desc", ask4: "desc" };
const LABEL: Record<SortKey, string> = { name: "Player", team: "Club", age: "Age", status: "Status", capHit: "Current Cap Hit", ask1: "1yr ask", ask2: "2yr ask", ask3: "3yr ask", ask4: "4yr ask" };

type Row = {
  p: { id: number; name: string; slug: string; position: string | null; age: number | null; capHit: number | null; team: { name: string; code: string | null; logoUrl: string | null } };
  ufa: boolean; ladder: Record<number, number> | null; roleLabel: string | null; depth: boolean; preferredYears: number | null;
};

// AHL-only or fringe/no-rating players don't get a meaningful market read (no
// comps pool for them) — this tool is about real re-sign/arbitration planning,
// so it's scoped to the NHL roster like the rest of the Free Agent Frenzy engine.
export default async function ExpiringContractsPage({ searchParams }: { searchParams: Promise<{ q?: string; sort?: string; dir?: string }> }) {
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const sort: SortKey = isSortKey(sp.sort) ? sp.sort : "capHit";
  const dir: "asc" | "desc" = sp.dir === "asc" || sp.dir === "desc" ? sp.dir : DEFAULT_DIR[sort];

  const [players, settings] = await Promise.all([
    prisma.player.findMany({
      where: {
        contractYears: 1,
        rosterType: "NHL",
        team: { league: "NHL" },
        ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
      },
      select: {
        id: true, name: true, slug: true, position: true, age: true, birthDate: true, capHit: true, contractYears: true,
        isGoalie: true, teamId: true, team: { select: { name: true, code: true, logoUrl: true } },
      },
    }),
    loadSettings(),
  ]);

  const [pool, cmap] = await Promise.all([loadMarketPool(), teamContentionMap()]);

  const rows: Row[] = await Promise.all(players.map(async (p) => {
    const info = await teamAsk(p.id, p.teamId, pool, cmap);
    const ufa = settings.faMode === "simple" || ufaAtExpiry(p);
    if (!info) return { p, ufa, ladder: null, roleLabel: null, depth: false, preferredYears: null };
    const ladder: Record<number, number> = {};
    for (const t of TERMS) {
      const capped = Math.min(t, MAX_TERM);
      const mult = termPremium(capped, info.ask.years, info.age, info.slot, info.ask.salary);
      ladder[t] = Math.max(info.ask.floorSalary, Math.round((info.ask.salary * mult) / 50_000) * 50_000);
    }
    return { p, ufa, ladder, roleLabel: slotLabel(info.slot), depth: isDepthSlot(info.slot), preferredYears: info.ask.years };
  }));

  // Every value the demand ladder produces is computed, not a DB column, so
  // sorting happens here in JS against the already-built rows rather than via
  // Prisma orderBy.
  const cmp = (a: Row, b: Row): number => {
    switch (sort) {
      case "name": return a.p.name.localeCompare(b.p.name);
      case "team": return (a.p.team.code ?? a.p.team.name).localeCompare(b.p.team.code ?? b.p.team.name);
      case "age": return (a.p.age ?? 0) - (b.p.age ?? 0);
      case "status": return Number(a.ufa) - Number(b.ufa);
      case "capHit": return (a.p.capHit ?? 0) - (b.p.capHit ?? 0);
      default: {
        const t = Number(sort.slice(3));
        return (a.ladder?.[t] ?? -1) - (b.ladder?.[t] ?? -1);
      }
    }
  };
  rows.sort((a, b) => (dir === "asc" ? cmp(a, b) : -cmp(a, b)));

  // preserves q, swaps sort/dir — clicking an already-active column flips
  // direction, clicking a new one starts at that column's own natural default.
  const sortHref = (col: SortKey) => {
    const nextDir = sort === col ? (dir === "asc" ? "desc" : "asc") : DEFAULT_DIR[col];
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    params.set("sort", col);
    params.set("dir", nextDir);
    return `/admin/expiring-contracts?${params.toString()}`;
  };
  const ALIGN = { left: "text-left", right: "text-right", center: "text-center" } as const;
  const SortHeader = ({ col, align = "left" }: { col: SortKey; align?: keyof typeof ALIGN }) => (
    <th className={`px-3 py-3 font-medium ${ALIGN[align]}`}>
      <Link href={sortHref(col)} className="inline-flex items-center gap-1 hover:text-slate-200">
        {LABEL[col]}
        {sort === col && <span className="text-blue-400">{dir === "asc" ? "▲" : "▼"}</span>}
      </Link>
    </th>
  );

  return (
    <div className="space-y-6 py-2">
      <PageHeader
        title="Expiring Contracts — Demand Watch"
        subtitle="Every NHL player in the final year of his deal, with his projected asking price at 1–4 years (the same engine Free Agent Frenzy uses) — plan re-signings before the market opens."
        right={<BackPill href="/admin">Admin</BackPill>}
      />

      <form className="flex gap-2" action="/admin/expiring-contracts">
        <input name="q" defaultValue={q} placeholder="Search player by name…"
          className="flex-1 max-w-sm bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm" />
        <button className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-semibold">Search</button>
      </form>

      <Card bodyClassName="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead>
              <tr className="text-xs text-slate-500 uppercase tracking-wider border-b border-slate-800 bg-slate-800/30">
                <SortHeader col="name" />
                <SortHeader col="team" />
                <SortHeader col="age" align="center" />
                <SortHeader col="status" align="center" />
                <SortHeader col="capHit" align="right" />
                <th className="text-center px-3 py-3 font-medium">Projected Role</th>
                <SortHeader col="ask1" align="right" />
                <SortHeader col="ask2" align="right" />
                <SortHeader col="ask3" align="right" />
                <SortHeader col="ask4" align="right" />
              </tr>
            </thead>
            <tbody>
              {rows.map(({ p, ufa, ladder, roleLabel, depth, preferredYears }) => (
                <tr key={p.id} className="border-b border-slate-800/40 hover:bg-slate-800/30 transition-colors last:border-0">
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/players/${p.slug}`} className="hover:text-blue-400">{cleanName(p.name)}</Link>
                    <span className="text-slate-600 text-xs ml-1">{p.position}</span>
                  </td>
                  <td className="px-3 py-3 text-slate-400 flex items-center gap-1.5">
                    {p.team.logoUrl && <img src={p.team.logoUrl} alt="" className="w-4 h-4 object-contain" />}
                    {p.team.code || p.team.name}
                  </td>
                  <td className="px-3 py-3 text-center text-slate-400">{p.age ?? "—"}</td>
                  <td className="px-3 py-3 text-center">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${ufa ? "bg-red-500/15 text-red-400 border border-red-500/30" : "bg-sky-500/15 text-sky-400 border border-sky-500/30"}`}>
                      {ufa ? "UFA" : "RFA"}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">{p.capHit ? money(p.capHit) : "—"}</td>
                  <td className="px-3 py-3 text-center text-[11px] text-slate-400" title={preferredYears ? `Prefers a ${preferredYears}-year deal` : undefined}>
                    {roleLabel ?? "—"}{depth ? " (depth)" : ""}
                  </td>
                  {TERMS.map((t) => (
                    <td key={t} className={`px-3 py-3 text-right tabular-nums ${ladder && preferredYears === t ? "text-emerald-400 font-semibold" : "text-slate-300"}`}>
                      {ladder ? money(ladder[t]) : "—"}
                    </td>
                  ))}
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={6 + TERMS.length} className="px-4 py-8 text-center text-slate-500">No player in the final year of his deal{q ? ` matches "${q}"` : ""}.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
      <p className="text-xs text-slate-500 px-1">
        RFA/UFA status uses the real CBA rule (age 27 as of June 30 of the expiry year). The highlighted column is the player&apos;s own preferred term — shorter terms never carry a premium, longer ones do (steeper for very young or very old players). Click a column header to sort.
      </p>
    </div>
  );
}
