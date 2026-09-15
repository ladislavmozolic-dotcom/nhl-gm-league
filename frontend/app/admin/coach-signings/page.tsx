import { prisma } from "@/lib/prisma";
import { PageHeader, Card, BackPill } from "@/components/ui";
import { money } from "@/lib/finance";
import RevertCoachSigningButton from "@/components/RevertCoachSigningButton";

export const dynamic = "force-dynamic";

const fmtDate = (d: Date) => d.toLocaleString("sk-SK", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default async function AdminCoachSigningsPage() {
  const logs = await prisma.coachSigningLog.findMany({ orderBy: { id: "desc" }, take: 60 });

  return (
    <div className="space-y-6 py-2">
      <PageHeader title="Coach Signings" subtitle="Every head-coach hire & fire — revert one to restore his prior contract." right={<BackPill href="/admin">Admin</BackPill>} />

      <Card bodyClassName="p-0">
        {logs.length === 0 ? (
          <p className="text-center text-slate-500 py-10 text-sm">No coach moves recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="text-xs text-slate-500 uppercase tracking-wider border-b border-slate-800 bg-slate-800/30">
                  <th className="text-left px-4 py-3 font-medium">Coach</th>
                  <th className="text-left px-3 py-3 font-medium">Club</th>
                  <th className="text-left px-3 py-3 font-medium">Type</th>
                  <th className="text-right px-3 py-3 font-medium">Deal</th>
                  <th className="text-right px-3 py-3 font-medium">Payout</th>
                  <th className="text-right px-3 py-3 font-medium">When</th>
                  <th className="text-right px-4 py-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id} className={`border-b border-slate-800/40 last:border-0 ${l.reverted ? "opacity-40" : "hover:bg-slate-800/30"}`}>
                    <td className="px-4 py-3 font-medium">{l.coachName}</td>
                    <td className="px-3 py-3 text-slate-400">{l.teamCode ?? "—"}</td>
                    <td className="px-3 py-3">
                      {l.kind === "FIRE"
                        ? <span className="text-[11px] px-1.5 py-0.5 rounded bg-red-600/20 text-red-300 font-semibold">FIRE</span>
                        : <span className="text-[11px] px-1.5 py-0.5 rounded bg-blue-600/20 text-blue-300 font-semibold">HIRE</span>}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{money(l.salary)} × {l.years}yr</td>
                    <td className="px-3 py-3 text-right tabular-nums text-slate-400">{l.kind === "FIRE" ? money(l.payout) : "—"}</td>
                    <td className="px-3 py-3 text-right text-slate-500 tabular-nums whitespace-nowrap">{fmtDate(l.createdAt)}</td>
                    <td className="px-4 py-3 text-right">
                      {l.reverted ? <span className="text-xs text-slate-500">reverted</span> : <RevertCoachSigningButton logId={l.id} name={l.coachName} kind={l.kind} />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <p className="text-xs text-slate-600">
        A <b>HIRE</b> revert releases the coach back to the free-agent pool. A <b>FIRE</b> revert restores him to his
        old club at his old salary/term and refunds the buyout to that club&apos;s bank. Either one refuses if the
        coach has moved again since (a later hire, fire, or trade) to avoid clobbering the newer state.
      </p>
    </div>
  );
}
