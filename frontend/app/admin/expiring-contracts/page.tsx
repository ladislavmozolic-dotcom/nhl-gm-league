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

// AHL-only or fringe/no-rating players don't get a meaningful market read (no
// comps pool for them) — this tool is about real re-sign/arbitration planning,
// so it's scoped to the NHL roster like the rest of the Free Agent Frenzy engine.
export default async function ExpiringContractsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";

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
      orderBy: [{ team: { code: "asc" } }, { capHit: "desc" }],
    }),
    loadSettings(),
  ]);

  const [pool, cmap] = await Promise.all([loadMarketPool(), teamContentionMap()]);

  const rows = await Promise.all(players.map(async (p) => {
    const info = await teamAsk(p.id, p.teamId, pool, cmap);
    const ufa = settings.faMode === "simple" || ufaAtExpiry(p);
    if (!info) return { p, ufa, ladder: null as null | Record<number, number>, roleLabel: null as string | null, depth: false, preferredYears: null as number | null };
    const ladder: Record<number, number> = {};
    for (const t of TERMS) {
      const capped = Math.min(t, MAX_TERM);
      const mult = termPremium(capped, info.ask.years, info.age, info.slot, info.ask.salary);
      ladder[t] = Math.max(info.ask.floorSalary, Math.round((info.ask.salary * mult) / 50_000) * 50_000);
    }
    return { p, ufa, ladder, roleLabel: slotLabel(info.slot), depth: isDepthSlot(info.slot), preferredYears: info.ask.years };
  }));

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
                <th className="text-left px-4 py-3 font-medium">Player</th>
                <th className="text-left px-3 py-3 font-medium">Club</th>
                <th className="text-center px-3 py-3 font-medium">Age</th>
                <th className="text-center px-3 py-3 font-medium">Status</th>
                <th className="text-right px-3 py-3 font-medium">Current Cap Hit</th>
                <th className="text-center px-3 py-3 font-medium">Projected Role</th>
                {TERMS.map((t) => (
                  <th key={t} className="text-right px-3 py-3 font-medium">{t}yr ask</th>
                ))}
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
        RFA/UFA status uses the real CBA rule (age 27 as of June 30 of the expiry year). The highlighted column is the player&apos;s own preferred term — shorter terms never carry a premium, longer ones do (steeper for very young or very old players).
      </p>
    </div>
  );
}
