import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card } from "@/components/ui";
import { cleanName } from "@/lib/playerName";
import RevertSigningButton from "@/components/RevertSigningButton";

export const dynamic = "force-dynamic";

const fmtM = (c: number) => `$${(c / 1e6).toFixed(2)}M`;
const fmtDate = (d: Date) => d.toLocaleString("sk-SK", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default async function AdminSigningsPage() {
  const logs = await prisma.signingLog.findMany({ orderBy: { id: "desc" }, take: 60 });

  return (
    <div className="space-y-6 py-2">
      <PageHeader title="Latest Signings" subtitle="Every UFA signing & extension — revert one to restore the player's prior contract." right={<Link href="/admin" className="text-sm text-slate-400 hover:text-blue-400">← Admin</Link>} />

      <Card bodyClassName="p-0">
        {logs.length === 0 ? (
          <p className="text-center text-slate-500 py-10 text-sm">No signings recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="text-xs text-slate-500 uppercase tracking-wider border-b border-slate-800 bg-slate-800/30">
                  <th className="text-left px-4 py-3 font-medium">Player</th>
                  <th className="text-left px-3 py-3 font-medium">Club</th>
                  <th className="text-left px-3 py-3 font-medium">Type</th>
                  <th className="text-right px-3 py-3 font-medium">Deal</th>
                  <th className="text-right px-3 py-3 font-medium">When</th>
                  <th className="text-right px-4 py-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id} className={`border-b border-slate-800/40 last:border-0 ${l.reverted ? "opacity-40" : "hover:bg-slate-800/30"}`}>
                    <td className="px-4 py-3 font-medium">{cleanName(l.playerName)}</td>
                    <td className="px-3 py-3 text-slate-400">{l.teamCode ?? "—"}</td>
                    <td className="px-3 py-3">
                      {l.kind === "EXTEND"
                        ? <span className="text-[11px] px-1.5 py-0.5 rounded bg-cyan-600/20 text-cyan-300 font-semibold">EXTENSION</span>
                        : <span className="text-[11px] px-1.5 py-0.5 rounded bg-blue-600/20 text-blue-300 font-semibold">SIGNING</span>}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{fmtM(l.salary)} × {l.years}yr</td>
                    <td className="px-3 py-3 text-right text-slate-500 tabular-nums whitespace-nowrap">{fmtDate(l.createdAt)}</td>
                    <td className="px-4 py-3 text-right">
                      {l.reverted ? <span className="text-xs text-slate-500">reverted</span> : <RevertSigningButton logId={l.id} name={cleanName(l.playerName)} />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <p className="text-xs text-slate-600">An <b>extension</b> revert just drops the future deal (the current-season contract was never changed). A <b>signing</b> revert restores the pre-signing contract from the saved snapshot.</p>
    </div>
  );
}
