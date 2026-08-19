import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card } from "@/components/ui";

export const dynamic = "force-dynamic";

const fmtDate = (d: Date | null) =>
  d ? d.toLocaleDateString("sk-SK", { day: "numeric", month: "short", year: "numeric" }) + ", " + d.toLocaleTimeString("sk-SK", { hour: "2-digit", minute: "2-digit" }) : "never";

export default async function LeagueDirectoryPage() {
  const teams = await prisma.team.findMany({
    where: { league: "NHL", isAffiliate: false },
    select: { id: true, name: true, code: true, logoUrl: true, slug: true, conference: true, division: true, gm: true, gmNickname: true, gmFirstName: true, gmLastName: true, gmEmail: true, lastLoginAt: true, passwordHash: true },
    orderBy: [{ conference: "asc" }, { division: "asc" }, { name: "asc" }],
  });

  return (
    <div className="space-y-6 py-2">
      <PageHeader title="Team / GM Directory" subtitle={`All ${teams.length} clubs and their general managers.`} />

      <Card bodyClassName="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[760px]">
            <thead>
              <tr className="text-xs text-slate-500 uppercase tracking-wider border-b border-slate-800 bg-slate-800/30">
                <th className="text-left px-4 py-3 font-medium">Team</th>
                <th className="text-left px-3 py-3 font-medium">Division</th>
                <th className="text-left px-3 py-3 font-medium">General Manager</th>
                <th className="text-left px-3 py-3 font-medium">Email</th>
                <th className="text-right px-4 py-3 font-medium">Last login</th>
              </tr>
            </thead>
            <tbody>
              {teams.map((t) => (
                <tr key={t.id} className="border-b border-slate-800/40 hover:bg-slate-800/30 transition-colors last:border-0">
                  <td className="px-4 py-3">
                    <Link href={`/teams/${t.slug}`} className="flex items-center gap-2 hover:text-blue-400 transition-colors">
                      {t.logoUrl && <img src={t.logoUrl} alt="" className="w-6 h-6 object-contain" />}
                      <span className="font-medium">{t.name}</span>
                    </Link>
                  </td>
                  <td className="px-3 py-3 text-slate-400">{t.division ?? "—"}</td>
                  <td className="px-3 py-3">
                    {t.passwordHash
                      ? <Link href={`/gm/${t.slug}`} className="hover:text-blue-400 transition-colors">{t.gmNickname || [t.gmFirstName, t.gmLastName].filter(Boolean).join(" ").trim() || t.gm}</Link>
                      : <span className="inline-flex items-center gap-1.5 text-cyan-400" title="No registered GM — run by the AI GM">🤖 AI GM</span>}
                  </td>
                  <td className="px-3 py-3 text-slate-400">{t.gmEmail || <span className="text-slate-600">—</span>}</td>
                  <td className="px-4 py-3 text-right text-slate-500 tabular-nums whitespace-nowrap">{fmtDate(t.lastLoginAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <p className="text-xs text-slate-600">GM name & email are set by the commissioner; last login updates each time a GM signs in.</p>
    </div>
  );
}
