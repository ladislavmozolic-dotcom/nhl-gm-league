import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { recentAudits } from "@/lib/audit-server";

export const dynamic = "force-dynamic";

export default async function AuditLogPage() {
  const rows = await recentAudits(150);
  const resims = rows.filter((r) => r.action === "RESIMULATE").length;

  return (
    <div className="space-y-5 py-2">
      <PageHeader title="League Audit Log" subtitle="Every simulation on record — who ran it, the engine version and the RNG seed. Results are reproducible and can't be silently re-rolled." />

      <div className="flex flex-wrap gap-3 text-sm">
        <span className="rounded-lg bg-slate-800/60 px-3 py-1.5">{rows.length} entries</span>
        {resims > 0 && <span className="rounded-lg bg-amber-950/40 border border-amber-800/40 px-3 py-1.5 text-amber-300">⚠ {resims} re-simulation{resims === 1 ? "" : "s"}</span>}
      </div>

      {rows.length === 0 ? (
        <p className="text-slate-500 text-sm">No simulations logged yet. Every game simulated from now on is recorded here.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wide text-slate-500 border-b border-slate-800 bg-slate-800/30">
                <th className="text-left px-3 py-2">When</th>
                <th className="text-left px-3 py-2">Game</th>
                <th className="text-left px-3 py-2">Action</th>
                <th className="text-left px-3 py-2">By</th>
                <th className="text-left px-3 py-2">Engine</th>
                <th className="text-right px-3 py-2">Seed</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={`border-b border-slate-800/50 ${r.action === "RESIMULATE" ? "bg-amber-950/10" : ""}`}>
                  <td className="px-3 py-2 whitespace-nowrap text-slate-400">{new Date(r.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <Link href={`/games/${r.gameId}`} className="hover:text-blue-400">
                      {r.awayCode ?? "?"} {r.awayGoals ?? ""}–{r.homeGoals ?? ""} {r.homeCode ?? "?"}
                    </Link>
                    <span className="text-[11px] text-slate-600 ml-1">#{r.gameId}</span>
                  </td>
                  <td className="px-3 py-2">
                    {r.action === "RESIMULATE"
                      ? <span className="text-amber-400 font-semibold">⚠ Re-sim</span>
                      : <span className="text-slate-400">Simulate</span>}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-slate-200">{r.byName}</td>
                  <td className="px-3 py-2 font-mono text-slate-400">{r.engineVersion ?? "—"}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-400">{r.seed ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
