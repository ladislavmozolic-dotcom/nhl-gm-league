import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";
import { PageHeader, Card } from "@/components/ui";

export const dynamic = "force-dynamic";

const fmt = (d: Date) => d.toLocaleString("sk-SK", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const shortUA = (ua: string | null) => {
  if (!ua) return "—";
  const os = /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Mac OS X|Macintosh/.test(ua) ? "macOS" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "";
  const br = /Edg\//.test(ua) ? "Edge" : /OPR\/|Opera/.test(ua) ? "Opera" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "";
  return [br, os].filter(Boolean).join(" · ") || "—";
};

export default async function LoginsPage() {
  if (!(await isAdmin())) redirect("/");
  const logs = await prisma.loginLog.findMany({ orderBy: { createdAt: "desc" }, take: 250 });
  const teamIds = [...new Set(logs.map((l) => l.teamId).filter((x): x is number => x != null))];
  const teams = await prisma.team.findMany({ where: { id: { in: teamIds } }, select: { id: true, code: true, name: true, slug: true, gmNickname: true, gm: true } });
  const tById = new Map(teams.map((t) => [t.id, t]));

  return (
    <div className="space-y-4 py-2">
      <PageHeader title="Login Audit" subtitle="Every GM sign-in — time, IP and rough location." right={<Link href="/admin" className="text-sm text-slate-400 hover:text-blue-400">← Admin</Link>} />
      <Card bodyClassName="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[820px]">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-800/30 text-slate-500 text-xs uppercase tracking-wider">
                <th className="px-3 py-2.5 text-left">When</th>
                <th className="px-3 py-2.5 text-left">Team · GM</th>
                <th className="px-3 py-2.5 text-left">IP</th>
                <th className="px-3 py-2.5 text-left">Location</th>
                <th className="px-3 py-2.5 text-left">ISP</th>
                <th className="px-3 py-2.5 text-left">Device</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-500">No sign-ins recorded yet.</td></tr>}
              {logs.map((l) => {
                const t = l.teamId != null ? tById.get(l.teamId) : null;
                const loc = [l.city, l.region, l.country].filter(Boolean).join(", ") || "—";
                return (
                  <tr key={l.id} className="border-b border-slate-800/40 hover:bg-slate-800/30 last:border-0">
                    <td className="px-3 py-2 text-slate-400 whitespace-nowrap tabular-nums">{fmt(l.createdAt)}</td>
                    <td className="px-3 py-2">{t ? <><span className="font-semibold">{t.code}</span> <span className="text-slate-500 text-xs">{t.gmNickname || t.gm || t.name}</span></> : <span className="text-slate-500">#{l.teamId ?? "?"}</span>}</td>
                    <td className="px-3 py-2 font-mono text-xs text-slate-300">{l.ip ?? "—"}</td>
                    <td className="px-3 py-2 text-slate-300">{loc}</td>
                    <td className="px-3 py-2 text-slate-400 text-xs truncate max-w-[220px]" title={l.isp ?? ""}>{l.isp ?? "—"}</td>
                    <td className="px-3 py-2 text-slate-400 text-xs">{shortUA(l.userAgent)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
      <p className="text-xs text-slate-600">Location is a best-effort lookup from the IP (via ip-api) at sign-in time — city-level and approximate.</p>
    </div>
  );
}
