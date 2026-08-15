import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getAutoSim } from "@/lib/sim/auto";
import AutoSimControl from "@/components/AutoSimControl";

export const dynamic = "force-dynamic";

export default async function AdminLinesPage() {
  const [teams, cfg] = await Promise.all([
    prisma.team.findMany({
      where: { league: "NHL", isAffiliate: false },
      select: { id: true, name: true, logoUrl: true, gm: true, lines: { select: { updatedAt: true } } },
      orderBy: { name: "asc" },
    }),
    getAutoSim(),
  ]);
  const SIM_HOUR = `${String(cfg.hour).padStart(2, "0")}:${String(cfg.minute).padStart(2, "0")} Bratislava`;

  const fmt = (d: Date | null | undefined) =>
    d ? d.toLocaleString("sk-SK", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "never submitted";

  return (
    <div className="max-w-3xl mx-auto px-4">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold">Line Submissions</h1>
        <Link href="/admin" className="text-sm text-slate-400 hover:text-blue-400">← Admin</Link>
      </div>
      <p className="text-slate-400 text-sm mb-4">The simulation runs daily at <b>{SIM_HOUR}</b>. If a GM hasn&apos;t re-saved their lines, their last-saved lineup is used. Below is when each club last submitted lines.</p>

      <AutoSimControl enabled={cfg.enabled} hour={cfg.hour} minute={cfg.minute} lastRunDate={cfg.lastRunDate} />

      <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="text-xs text-slate-500 border-b border-slate-800 bg-slate-800/40">
            <th className="px-4 py-2.5 text-left">Team</th>
            <th className="px-3 py-2.5 text-left">GM</th>
            <th className="px-4 py-2.5 text-right">Lines last submitted</th>
          </tr></thead>
          <tbody>
            {teams.map((t) => (
              <tr key={t.id} className="border-b border-slate-800/60">
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    {t.logoUrl && <img src={t.logoUrl} alt="" className="w-6 h-6 object-contain" />}
                    <span className="font-medium">{t.name}</span>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-slate-400">{t.gm || "—"}</td>
                <td className={`px-4 py-2.5 text-right tabular-nums whitespace-nowrap ${t.lines?.updatedAt ? "text-slate-300" : "text-red-400"}`}>{fmt(t.lines?.updatedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
