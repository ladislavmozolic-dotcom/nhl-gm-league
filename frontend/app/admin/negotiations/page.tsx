import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card, BackPill } from "@/components/ui";
import { cleanName } from "@/lib/playerName";

export const dynamic = "force-dynamic";

const fmtM = (c: number | null) => (c == null ? "—" : `$${(c / 1e6).toFixed(2)}M`);
const fmtDate = (d: Date) => d.toLocaleString("sk-SK", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });

const OUTCOME: Record<string, { label: string; cls: string }> = {
  ACCEPTED: { label: "SIGNED", cls: "bg-emerald-600/20 text-emerald-300" },
  COUNTERED: { label: "COUNTER", cls: "bg-amber-600/20 text-amber-300" },
  WALKED_UFA: { label: "WALKED → UFA", cls: "bg-red-600/20 text-red-300" },
  OS_ELIGIBLE: { label: "→ OFFER SHEETS", cls: "bg-orange-600/20 text-orange-300" },
  FORCE_SIGNED: { label: "FORCE SIGNED", cls: "bg-violet-600/20 text-violet-300" },
  FORCE_WALK: { label: "FORCE WALK", cls: "bg-violet-600/20 text-violet-300" },
  RESET: { label: "RESET", cls: "bg-slate-600/30 text-slate-300" },
  EDITED: { label: "EDITED", cls: "bg-slate-600/30 text-slate-300" },
};

// Admin: permanent audit trail of every own-player re-sign negotiation — each offer, the
// player's counter, his ask at that moment, lowball insults, and commissioner interventions.
export default async function NegotiationsPage({ searchParams }: { searchParams: Promise<{ q?: string; team?: string; player?: string }> }) {
  if (!(await isAdmin())) redirect("/");
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const team = (sp.team ?? "").trim().toUpperCase();
  const pid = Number(sp.player);
  const where = {
    ...(Number.isFinite(pid) && pid > 0 ? { playerId: pid } : {}),
    ...(q ? { playerName: { contains: q, mode: "insensitive" as const } } : {}),
    ...(team ? { teamCode: team } : {}),
  };
  const single = Number.isFinite(pid) && pid > 0;
  const rows = await prisma.negotiationLog.findMany({ where, orderBy: { id: single ? "asc" : "desc" }, take: 300 });

  return (
    <div className="space-y-5 py-2">
      <PageHeader title="Negotiation Log" subtitle="Complete audit of every re-sign negotiation — each offer, the player's answer and his ask at that moment." right={<BackPill href="/admin">Admin</BackPill>} />

      <form className="flex flex-wrap gap-2 items-end text-sm" action="/admin/negotiations">
        <label className="flex flex-col gap-1 text-xs text-slate-500">Player
          <input name="q" defaultValue={q} placeholder="e.g. Kleven" className="bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-slate-200" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-500">Team
          <input name="team" defaultValue={team} placeholder="OTT" maxLength={4} className="w-20 bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-slate-200 uppercase" />
        </label>
        <button className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white font-medium">Filter</button>
        {(q || team || single) && <Link href="/admin/negotiations" className="px-3 py-1.5 text-slate-400 hover:text-white">Clear</Link>}
        <span className="text-xs text-slate-600 ml-auto">{single ? "oldest first" : "newest first"} · max 300 rows</span>
      </form>

      <Card bodyClassName="p-0">
        {rows.length === 0 ? (
          <p className="text-center text-slate-500 py-10 text-sm">No negotiations recorded yet — entries appear from the first offer made after this log went live.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[1000px]">
              <thead>
                <tr className="text-xs text-slate-500 uppercase tracking-wider border-b border-slate-800 bg-slate-800/30">
                  <th className="text-left px-4 py-3 font-medium">When</th>
                  <th className="text-left px-3 py-3 font-medium">Player</th>
                  <th className="text-left px-3 py-3 font-medium">Club</th>
                  <th className="text-left px-3 py-3 font-medium">Result</th>
                  <th className="text-right px-3 py-3 font-medium">Club offer</th>
                  <th className="text-left px-3 py-3 font-medium">Role / terms</th>
                  <th className="text-right px-3 py-3 font-medium">Player counter</th>
                  <th className="text-right px-3 py-3 font-medium">His ask (floor)</th>
                  <th className="text-left px-3 py-3 font-medium">Notes</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const o = OUTCOME[r.outcome] ?? { label: r.outcome, cls: "bg-slate-600/30 text-slate-300" };
                  const terms = [
                    r.offerLine != null ? (r.offerLine === 0 ? "auto role" : `L${r.offerLine}`) : null,
                    r.offerPP ? "PP" : null,
                    r.offerPK ? "PK" : null,
                    r.offerClause,
                    r.offerTwoWay ? "2-way" : null,
                  ].filter(Boolean).join(" · ");
                  return (
                    <tr key={r.id} className="border-b border-slate-800/40 last:border-0 hover:bg-slate-800/30 align-top">
                      <td className="px-4 py-3 text-slate-500 tabular-nums whitespace-nowrap">{fmtDate(r.createdAt)}{r.phase && <div className="text-[10px] uppercase text-slate-600">{r.phase}</div>}</td>
                      <td className="px-3 py-3 font-medium"><Link href={`/admin/negotiations?player=${r.playerId}`} className="hover:text-blue-400" title="Show this player's full history">{cleanName(r.playerName)}</Link></td>
                      <td className="px-3 py-3 text-slate-400">{r.teamCode ?? "—"}</td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span className={`text-[11px] px-1.5 py-0.5 rounded font-semibold ${o.cls}`}>{o.label}</span>
                        {r.round != null && <span className="ml-1.5 text-xs text-slate-500">R{r.round}</span>}
                        {r.insulted && <span title={r.lowballBump ? `Ask ×${r.lowballBump.toFixed(3)}` : "Lowball insult"} className="ml-1.5">😠</span>}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums whitespace-nowrap">{r.offerSalary != null ? `${fmtM(r.offerSalary)} × ${r.offerYears}yr` : "—"}</td>
                      <td className="px-3 py-3 text-xs text-slate-400">{terms || "—"}</td>
                      <td className="px-3 py-3 text-right tabular-nums whitespace-nowrap">{r.counterSalary != null ? `${fmtM(r.counterSalary)} × ${r.counterYears}yr` : "—"}</td>
                      <td className="px-3 py-3 text-right tabular-nums whitespace-nowrap text-slate-400">
                        {r.askSalary != null ? <>{fmtM(r.askSalary)} <span className="text-slate-600">({fmtM(r.askFloor)})</span>{r.askMinYears != null && <div className="text-[10px] text-slate-600">{r.askMinYears}–{r.askMaxYears}yr</div>}</> : "—"}
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-500">{r.note ?? ""}{r.actor ? ` · ${r.actor}` : ""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <p className="text-xs text-slate-600">Rows are written from the moment this log went live — earlier negotiations (before deploy) only exist as the player's current state. 😠 = the offer was a lowball and raised his ask to your club.</p>
    </div>
  );
}
