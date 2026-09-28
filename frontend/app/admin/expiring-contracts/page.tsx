import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card, BackPill } from "@/components/ui";
import { money } from "@/lib/finance";
import { cleanName } from "@/lib/playerName";
import { loadMarketPool, teamContentionMap, teamAsk, ufaAtExpiry } from "@/lib/free-agency-server";
import { termPremium, isDepthSlot, slotLabel, MAX_TERM, LEAGUE_MIN } from "@/lib/free-agency";
import { loadSettings } from "@/lib/sim/settings";

export const dynamic = "force-dynamic";

const TERMS = [1, 2, 3, 4] as const;

const SORT_KEYS = ["name", "team", "age", "status", "capHit", "realCapHit", "ask1", "ask2", "ask3", "ask4"] as const;
type SortKey = (typeof SORT_KEYS)[number];
const isSortKey = (v: string | undefined): v is SortKey => !!v && (SORT_KEYS as readonly string[]).includes(v);
// cap hit / asks lead with the biggest first; everything else starts alphabetical/youngest-first
const DEFAULT_DIR: Record<SortKey, "asc" | "desc"> = { name: "asc", team: "asc", age: "asc", status: "asc", capHit: "desc", realCapHit: "desc", ask1: "desc", ask2: "desc", ask3: "desc", ask4: "desc" };
const LABEL: Record<SortKey, string> = { name: "Player", team: "Club", age: "Age", status: "Status", capHit: "Current Cap Hit", realCapHit: "Real Cap Hit", ask1: "1yr ask", ask2: "2yr ask", ask3: "3yr ask", ask4: "4yr ask" };

type Row = {
  p: {
    id: number; name: string; slug: string; position: string | null; age: number | null; capHit: number | null;
    realCapHit: number | null; realContractYears: number | null;
    team: { name: string; code: string | null; logoUrl: string | null };
  };
  ufa: boolean; ladder: Record<number, number> | null; roleLabel: string | null; depth: boolean; preferredYears: number | null;
  overrideTerms: Set<number>;
};

// AHL-only or fringe/no-rating players don't get a meaningful market read (no
// comps pool for them) — this tool is about real re-sign/arbitration planning,
// so it's scoped to the NHL roster like the rest of the Free Agent Frenzy engine.
const STATUS_TABS = [
  { key: "all", label: "All" },
  { key: "ufa", label: "UFA" },
  { key: "rfa", label: "RFA" },
] as const;
type StatusFilter = (typeof STATUS_TABS)[number]["key"];
const isStatusFilter = (v: string | undefined): v is StatusFilter => v === "all" || v === "ufa" || v === "rfa";

export default async function ExpiringContractsPage({ searchParams }: { searchParams: Promise<{ q?: string; sort?: string; dir?: string; status?: string; team?: string }> }) {
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const sort: SortKey = isSortKey(sp.sort) ? sp.sort : "capHit";
  const dir: "asc" | "desc" = sp.dir === "asc" || sp.dir === "desc" ? sp.dir : DEFAULT_DIR[sort];
  const status: StatusFilter = isStatusFilter(sp.status) ? sp.status : "all";

  // team-logo switcher, same pattern as /tools/all-rosters — "all" (no team) is
  // its own state here (unlike All Rosters, which always picks one), since the
  // whole point of this page is usually the LEAGUE-WIDE view.
  const teams = await prisma.team.findMany({
    where: { league: "NHL", isAffiliate: false },
    select: { id: true, slug: true, name: true, code: true, logoUrl: true },
    orderBy: { name: "asc" },
  });
  const team = teams.find((t) => t.slug === sp.team) ?? null;

  const [players, settings] = await Promise.all([
    prisma.player.findMany({
      where: {
        contractYears: 1,
        rosterType: "NHL",
        team: { league: "NHL" },
        ...(team ? { teamId: team.id } : {}),
        ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
      },
      select: {
        id: true, name: true, slug: true, position: true, age: true, birthDate: true, capHit: true, contractYears: true,
        isGoalie: true, teamId: true, realCapHit: true, realContractYears: true, faOverrideLadder: true,
        team: { select: { name: true, code: true, logoUrl: true } },
      },
    }),
    loadSettings(),
  ]);

  const [pool, cmap] = await Promise.all([loadMarketPool(), teamContentionMap()]);

  const rows: Row[] = await Promise.all(players.map(async (p) => {
    const info = await teamAsk(p.id, p.teamId, pool, cmap);
    const ufa = settings.faMode === "simple" || ufaAtExpiry(p);
    // Admin → FA Tuning hand-set ladder (any subset of terms) overrides the
    // computed rung for those terms — the rest still come from the engine.
    const override = p.faOverrideLadder && typeof p.faOverrideLadder === "object" ? (p.faOverrideLadder as Record<string, number>) : null;
    const overrideTerms = new Set(TERMS.filter((t) => override?.[String(t)] != null));
    if (!info) {
      if (!override) return { p, ufa, ladder: null, roleLabel: null, depth: false, preferredYears: null, overrideTerms };
      const ladder: Record<number, number> = {};
      for (const t of overrideTerms) ladder[t] = override![String(t)];
      return { p, ufa, ladder: Object.keys(ladder).length ? ladder : null, roleLabel: null, depth: false, preferredYears: null, overrideTerms };
    }
    // No floor clamp here on purpose — a 35+ veteran's ladder is meant to run
    // DOWN as term grows (see termPremium), and clamping every rung at his
    // floorSalary would flatten that back out.
    const ladder: Record<number, number> = {};
    for (const t of TERMS) {
      if (overrideTerms.has(t)) { ladder[t] = override![String(t)]; continue; }
      const capped = Math.min(t, MAX_TERM);
      const mult = termPremium(capped, info.ask.years, info.age, info.slot, info.ask.salary, info.elite > 0);
      ladder[t] = Math.max(LEAGUE_MIN, Math.round((info.ask.salary * mult) / 50_000) * 50_000);
    }
    return { p, ufa, ladder, roleLabel: slotLabel(info.slot), depth: isDepthSlot(info.slot), preferredYears: info.ask.years, overrideTerms };
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
      case "realCapHit": return (a.p.realCapHit ?? 0) - (b.p.realCapHit ?? 0);
      default: {
        const t = Number(sort.slice(3));
        return (a.ladder?.[t] ?? -1) - (b.ladder?.[t] ?? -1);
      }
    }
  };
  rows.sort((a, b) => (dir === "asc" ? cmp(a, b) : -cmp(a, b)));
  const shown = status === "all" ? rows : rows.filter((r) => (status === "ufa" ? r.ufa : !r.ufa));
  const counts = { ufa: rows.filter((r) => r.ufa).length, rfa: rows.filter((r) => !r.ufa).length };

  // preserves q/team, swaps sort/dir — clicking an already-active column flips
  // direction, clicking a new one starts at that column's own natural default.
  const sortHref = (col: SortKey) => {
    const nextDir = sort === col ? (dir === "asc" ? "desc" : "asc") : DEFAULT_DIR[col];
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (team) params.set("team", team.slug);
    if (status !== "all") params.set("status", status);
    params.set("sort", col);
    params.set("dir", nextDir);
    return `/admin/expiring-contracts?${params.toString()}`;
  };
  const statusHref = (s: StatusFilter) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (team) params.set("team", team.slug);
    if (s !== "all") params.set("status", s);
    params.set("sort", sort);
    params.set("dir", dir);
    return `/admin/expiring-contracts?${params.toString()}`;
  };
  const teamHref = (slug: string | null) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (slug) params.set("team", slug);
    if (status !== "all") params.set("status", status);
    params.set("sort", sort);
    params.set("dir", dir);
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
        right={
          <div className="flex items-center gap-2">
            <Link href="/admin/fa-tuning" className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white whitespace-nowrap">
              🎛️ Edit market weights
            </Link>
            <BackPill href="/admin">Admin</BackPill>
          </div>
        }
      />

      {/* team-logo switcher — same pattern as /tools/all-rosters, plus an "All" pill */}
      <div className="flex flex-wrap gap-1.5 border border-slate-800 bg-slate-900/70 rounded-2xl p-2 sticky top-14 z-20 backdrop-blur shadow-lg shadow-black/20">
        <Link href={teamHref(null)} title="All teams"
          className={`px-2.5 h-7 grid place-items-center rounded text-xs font-bold transition-colors ${
            !team ? "bg-blue-600/30 ring-1 ring-blue-500 text-white" : "hover:bg-slate-800 text-slate-400"
          }`}>
          ALL
        </Link>
        {teams.map((t) => (
          <Link key={t.id} href={teamHref(t.slug)} title={t.name}
            className={`p-1 rounded transition-colors ${t.id === team?.id ? "bg-blue-600/30 ring-1 ring-blue-500" : "hover:bg-slate-800"}`}>
            {t.logoUrl ? <img src={t.logoUrl} alt={t.code ?? ""} className="w-7 h-7 object-contain" />
              : <span className="w-7 h-7 grid place-items-center text-[10px] text-slate-400">{t.code}</span>}
          </Link>
        ))}
      </div>

      <form className="flex gap-2" action="/admin/expiring-contracts">
        {status !== "all" && <input type="hidden" name="status" value={status} />}
        {team && <input type="hidden" name="team" value={team.slug} />}
        <input name="q" defaultValue={q} placeholder="Search player by name…"
          className="flex-1 max-w-sm bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm" />
        <button className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-semibold">Search</button>
      </form>

      <div className="flex flex-wrap gap-2">
        {STATUS_TABS.map((t) => (
          <Link key={t.key} href={statusHref(t.key)}
            className={`text-sm font-semibold px-3 py-1.5 rounded-lg transition-colors ${
              status === t.key ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}>
            {t.label}
            {t.key !== "all" && <span className="ml-1.5 text-xs opacity-80">{counts[t.key]}</span>}
          </Link>
        ))}
      </div>

      <Card bodyClassName="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[940px]">
            <thead>
              <tr className="text-xs text-slate-500 uppercase tracking-wider border-b border-slate-800 bg-slate-800/30">
                <th className="px-2 py-3 font-medium w-8"></th>
                <SortHeader col="name" />
                {!team && <SortHeader col="team" />}
                <SortHeader col="age" align="center" />
                <SortHeader col="status" align="center" />
                <SortHeader col="capHit" align="right" />
                <SortHeader col="realCapHit" align="right" />
                <th className="text-center px-3 py-3 font-medium">Projected Role</th>
                <SortHeader col="ask1" align="right" />
                <SortHeader col="ask2" align="right" />
                <SortHeader col="ask3" align="right" />
                <SortHeader col="ask4" align="right" />
              </tr>
            </thead>
            <tbody>
              {shown.map(({ p, ufa, ladder, roleLabel, depth, preferredYears, overrideTerms }) => (
                <tr key={p.id} className="border-b border-slate-800/40 hover:bg-slate-800/30 transition-colors last:border-0">
                  <td className="px-2 py-3 text-center">
                    <Link href={`/admin/fa-tuning?name=${encodeURIComponent(p.name)}`} title="Hand-override his demand"
                      className="text-slate-500 hover:text-amber-400">
                      ✏️
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/players/${p.slug}`} className="hover:text-blue-400">{cleanName(p.name)}</Link>
                    <span className="text-slate-600 text-xs ml-1">{p.position}</span>
                  </td>
                  {!team && (
                    <td className="px-3 py-3 text-slate-400 flex items-center gap-1.5">
                      {p.team.logoUrl && <img src={p.team.logoUrl} alt="" className="w-4 h-4 object-contain" />}
                      {p.team.code || p.team.name}
                    </td>
                  )}
                  <td className="px-3 py-3 text-center text-slate-400">{p.age ?? "—"}</td>
                  <td className="px-3 py-3 text-center">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${ufa ? "bg-red-500/15 text-red-400 border border-red-500/30" : "bg-sky-500/15 text-sky-400 border border-sky-500/30"}`}>
                      {ufa ? "UFA" : "RFA"}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">{p.capHit ? money(p.capHit) : "—"}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-slate-400"
                    title={p.realContractYears != null ? `${p.realContractYears} year${p.realContractYears === 1 ? "" : "s"} left on his real-life deal${p.realContractYears > MAX_TERM ? ` — extends ${p.realContractYears - MAX_TERM} year${p.realContractYears - MAX_TERM === 1 ? "" : "s"} past our ${MAX_TERM}yr cap` : ""}` : "No CapWages data synced for this player yet (Admin → Roster Source)"}>
                    {p.realCapHit ? money(p.realCapHit) : "—"}
                    {p.realContractYears != null && p.realContractYears > MAX_TERM && (
                      <span className="ml-1 text-[10px] font-bold text-amber-400">🔒{p.realContractYears}y</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-center text-[11px] text-slate-400" title={preferredYears ? `Prefers a ${preferredYears}-year deal` : undefined}>
                    {roleLabel ?? "—"}{depth ? " (depth)" : ""}
                  </td>
                  {TERMS.map((t) => (
                    <td key={t} title={overrideTerms.has(t) ? "Hand-overridden — Admin → FA Tuning" : undefined}
                      className={`px-3 py-3 text-right tabular-nums ${
                        overrideTerms.has(t) ? "text-amber-400 font-semibold bg-amber-500/5" : ladder && preferredYears === t ? "text-emerald-400 font-semibold" : "text-slate-300"
                      }`}>
                      {ladder ? money(ladder[t]) : "—"}{overrideTerms.has(t) && " ✏️"}
                    </td>
                  ))}
                </tr>
              ))}
              {shown.length === 0 && (
                <tr><td colSpan={team ? 7 + TERMS.length : 8 + TERMS.length} className="px-4 py-8 text-center text-slate-500">
                  No player in the final year of his deal{q ? ` matches "${q}"` : ""}{team ? ` for ${team.name}` : ""}.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
      <p className="text-xs text-slate-500 px-1">
        RFA/UFA status uses the real CBA rule (age 27 as of June 30 of the expiry year). The highlighted column is the player&apos;s own preferred term — shorter terms never carry a premium, longer ones do (steeper for very young or very old players). Click a column header to sort. The ✏️ opens FA Tuning with him already searched, to hand-override his demand.
      </p>
      <p className="text-xs text-slate-500 px-1">
        Real Cap Hit is his actual real-life NHL salary from CapWages (Admin → Roster Source → &quot;Fill Real Cap Hits&quot;) — re-run that sync to pick up a real-life extension. 🔒 flags a player whose real deal runs longer than our {MAX_TERM}yr cap.
      </p>
    </div>
  );
}
