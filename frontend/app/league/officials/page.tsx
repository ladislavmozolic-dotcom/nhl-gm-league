import { PageHeader, Card } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { REGULAR_SEASON } from "@/lib/phase";

export const dynamic = "force-dynamic";

const FLAG: Record<string, string> = { CAN: "🇨🇦", USA: "🇺🇸", SWE: "🇸🇪", FIN: "🇫🇮", CZE: "🇨🇿", SVK: "🇸🇰", GER: "🇩🇪", SUI: "🇨🇭", RUS: "🇷🇺", GBR: "🇬🇧" };

export default async function OfficialsPage() {
  const [officials, games] = await Promise.all([
    prisma.official.findMany({ where: { active: true }, orderBy: [{ role: "asc" }, { name: "asc" }] }),
    prisma.game.findMany({ where: { season: REGULAR_SEASON, league: "NHL", status: "FINAL", NOT: { officialIds: { isEmpty: true } } }, select: { id: true, officialIds: true, _count: { select: { penaltyEvents: true } } } }),
  ]);
  const worked = new Map<number, { gp: number; pens: number }>();
  for (const g of games) for (const id of g.officialIds) { const w = worked.get(id) ?? { gp: 0, pens: 0 }; w.gp++; w.pens += g._count.penaltyEvents; worked.set(id, w); }
  const refs = officials.filter((o) => o.role === "REF").sort((a, b) => b.strictness - a.strictness);
  const lines = officials.filter((o) => o.role !== "REF");
  const tone = (x: number) => x >= 1.05 ? "text-red-400" : x <= 0.95 ? "text-emerald-400" : "text-slate-300";
  return (
    <div className="space-y-6 py-2">
      <PageHeader title="🦓 NHL Officials" subtitle={`${refs.length} referees · ${lines.length} linesmen — the real 2025-26 NHL roster`} />
      <Card title="How crews work" accent="text-slate-400">
        <p className="text-sm text-slate-400">Every NHL game gets two referees and two linesmen from the real NHL roster; nobody works two games on the same night and the playoffs get full-time referees only. A referee&apos;s <b>strictness</b> comes from his real 2025-26 penalties per game (Scouting The Refs), pulled toward the league average when he worked few games — the crew&apos;s average scales how many infractions get called that night. Crews also &quot;manage the game&quot; a little: the bench that has been called less so far is a touch likelier to be called next.</p>
      </Card>
      <Card title="Referees" accent="text-amber-400" bodyClassName="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-800"><tr><th className="px-3 py-2 text-left">Referee</th><th className="px-2 py-2">#</th><th className="px-2 py-2" title="Real 2025-26 NHL">NHL pen/gm</th><th className="px-2 py-2">NHL GP</th><th className="px-2 py-2">Strictness</th><th className="px-2 py-2">UNHL GP</th><th className="px-2 py-2">UNHL pen/gm</th></tr></thead>
            <tbody className="divide-y divide-slate-800/60">
              {refs.map((o) => { const w = worked.get(o.id); return (
                <tr key={o.id} className="hover:bg-slate-800/30">
                  <td className="px-3 py-2">{FLAG[o.country ?? ""] ?? ""} {o.name}{o.minor && <span className="ml-1 text-[10px] text-slate-500" title="NHL/AHL minor-league contract">AHL</span>}</td>
                  <td className="px-2 py-2 text-center tabular-nums text-slate-400">{o.number ?? "—"}</td>
                  <td className="px-2 py-2 text-center tabular-nums">{o.penaltiesPerGame?.toFixed(1) ?? "—"}</td>
                  <td className="px-2 py-2 text-center tabular-nums text-slate-500">{o.sampleGames ?? "—"}</td>
                  <td className={`px-2 py-2 text-center tabular-nums font-semibold ${tone(o.strictness)}`}>{o.strictness.toFixed(2)}×</td>
                  <td className="px-2 py-2 text-center tabular-nums text-slate-400">{w?.gp ?? 0}</td>
                  <td className="px-2 py-2 text-center tabular-nums text-slate-300">{w?.gp ? (w.pens / w.gp).toFixed(1) : "—"}</td>
                </tr>
              ); })}
            </tbody>
          </table>
        </div>
      </Card>
      <Card title="Linesmen" accent="text-sky-400">
        <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3 text-sm">
          {lines.map((o) => <div key={o.id} className="flex justify-between"><span>{FLAG[o.country ?? ""] ?? ""} {o.name}{o.minor && <span className="ml-1 text-[10px] text-slate-500">AHL</span>}</span><span className="tabular-nums text-slate-500">#{o.number ?? "—"} · {worked.get(o.id)?.gp ?? 0} GP</span></div>)}
        </div>
      </Card>
    </div>
  );
}
