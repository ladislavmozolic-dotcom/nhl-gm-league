import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card } from "@/components/ui";
import { projectAllSkaters, LAST_WEIGHT, CUR_WEIGHT, ACTIVATE_AT_GP } from "@/lib/param-projection";
import { cleanName } from "@/lib/playerName";

export const dynamic = "force-dynamic";

const PARAMS = [
  { key: "ck", label: "CK", title: "Checking (from hits)" },
  { key: "sc", label: "SC", title: "Scoring (from goals)" },
  { key: "pa", label: "PA", title: "Passing (from assists)" },
  { key: "df", label: "DF", title: "Defense (from blocks)" },
] as const;

const isDef = (p: string | null) => /\bD\b/.test((p ?? "").toUpperCase()) || ((p ?? "").toUpperCase().includes("D") && !/[CW]/.test((p ?? "").toUpperCase()));

export default async function PlayerCalculatorPage({ searchParams }: { searchParams: Promise<{ team?: string }> }) {
  const { team: teamSlug } = await searchParams;
  const teams = await prisma.team.findMany({ where: { league: "NHL" }, select: { id: true, slug: true, code: true, name: true, logoUrl: true }, orderBy: { name: "asc" } });
  const team = teams.find((t) => t.slug === teamSlug) ?? teams[0];

  const { rows, active } = await projectAllSkaters();
  const mine = rows.filter((r) => r.teamId === team.id).sort((a, b) => (isDef(a.position) ? 1 : 0) - (isDef(b.position) ? 1 : 0) || cleanName(a.name).localeCompare(cleanName(b.name)));

  const delta = (a: number | null, p: number | null) => (a == null || p == null ? 0 : p - a);
  const dcolor = (d: number) => (d > 0 ? "text-green-400" : d < 0 ? "text-red-400" : "text-slate-500");

  return (
    <div className="space-y-6 py-2">
      <PageHeader title="Player Calculator" subtitle={`Projected CK / SC / PA / DF from real form — last season ${LAST_WEIGHT * 100}% + current ${CUR_WEIGHT * 100}%`} />

      <div className="flex flex-wrap gap-1.5">
        {teams.map((t) => (
          <Link key={t.id} href={`/tools/player-calculator?team=${t.slug}`} title={t.name}
            className={`px-2 py-1 rounded-lg border ${t.id === team.id ? "bg-blue-600 border-blue-500" : "bg-slate-800/50 border-slate-700 hover:border-slate-500"}`}>
            {t.logoUrl ? <img src={t.logoUrl} alt={t.code ?? ""} className="w-6 h-6 object-contain" /> : <span className="text-xs">{t.code}</span>}
          </Link>
        ))}
      </div>

      {!active ? (
        <div className="text-sm text-amber-200 bg-amber-950/25 border border-amber-800/40 rounded-lg px-4 py-2.5">
          <b>Off-season — estimates are idle.</b> The real NHL isn&apos;t playing, so projected values equal the current ratings. Once the 2026-27 season is underway (about {ACTIVATE_AT_GP} games in) and you refresh data, the estimate column will move with each player&apos;s real form.
        </div>
      ) : (
        <div className="text-sm text-blue-200 bg-blue-950/25 border border-blue-800/40 rounded-lg px-4 py-2.5">
          <b>Reference data.</b> These estimates run on the <b>last imported NHL season</b> — a demo of the tool, not the new season. The 2026-27 season hasn&apos;t started, so there&apos;s no live data to pull yet. Fresh projections appear only once the real season begins and each player has at least <b>{ACTIVATE_AT_GP} games</b> played (then Refresh data).
        </div>
      )}

      <Card title={`${team.name} — skaters`} accent="text-blue-400" bodyClassName="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ minWidth: 720 }}>
            <thead>
              <tr className="bg-slate-800/30 border-b border-slate-800 text-slate-500 text-[11px] uppercase tracking-wider">
                <th className="px-3 py-2.5 text-left sticky left-0 bg-slate-900">Player</th>
                <th className="px-2 py-2.5">Pos</th>
                <th className="px-2 py-2.5" title="Games played this season — drives the games-missed penalty">GP</th>
                {PARAMS.map((p) => <th key={`a${p.key}`} className="px-2 py-2.5" title={`Current ${p.title}`}>{p.label}</th>)}
                <th className="px-2 py-2.5 text-slate-600">·</th>
                {PARAMS.map((p) => <th key={`e${p.key}`} className="px-2 py-2.5 text-amber-400/70" title={`Estimated ${p.title}`}>{p.label}′</th>)}
              </tr>
            </thead>
            <tbody>
              {mine.map((r) => (
                <tr key={r.id} className="border-b border-slate-800/40 hover:bg-slate-800/30">
                  <td className="px-3 py-1.5 font-medium sticky left-0 bg-slate-900">{cleanName(r.name)}</td>
                  <td className="px-2 py-1.5 text-center text-slate-400">{r.position}</td>
                  <td className="px-2 py-1.5 text-center tabular-nums">
                    {active ? (
                      <span className="inline-flex items-center gap-1">
                        <span className="text-slate-300">{r.gp}</span>
                        {r.missedPenalty > 0 && <span className="text-[10px] font-semibold text-red-400" title={`Missed a big part of the season → −${r.missedPenalty} on each projected rating`}>−{r.missedPenalty}</span>}
                      </span>
                    ) : <span className="text-slate-600">—</span>}
                  </td>
                  {PARAMS.map((p) => <td key={`a${p.key}`} className="px-2 py-1.5 text-center tabular-nums text-slate-200">{r.actual[p.key] ?? "—"}</td>)}
                  <td className="px-2 py-1.5" />
                  {PARAMS.map((p) => {
                    const d = delta(r.actual[p.key], r.projected[p.key]);
                    return (
                      <td key={`e${p.key}`} className="px-2 py-1.5 text-center tabular-nums">
                        <span className={active && d !== 0 ? dcolor(d) : "text-slate-300"}>{r.projected[p.key] ?? "—"}</span>
                        {active && d !== 0 && <span className={`ml-0.5 text-[10px] ${dcolor(d)}`}>{d > 0 ? "▲" : "▼"}</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {mine.length === 0 && <tr><td colSpan={12} className="px-4 py-8 text-center text-slate-500">No skaters on this roster.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      <p className="text-xs text-slate-600">
        Left block = current ratings · right block (′) = estimate from real form using the calculator&apos;s exact tables. CK←hits · SC←goals · PA←assists · DF←PK-usage + blocks + +/− + take/give (NHL on-ice data). DF′ shows only once current-season NHL stats are imported. <b>Games-missed penalty:</b> a player who sits out ≥25% of the season loses −1 on every projected rating, ≥50% → −2, ≥75% → −3 (shown next to GP). Informative only — official ratings publish after the season with every parameter. Goalies excluded. <Link href="/tools/player-data" className="hover:text-blue-400">Refresh data →</Link>
      </p>
    </div>
  );
}
