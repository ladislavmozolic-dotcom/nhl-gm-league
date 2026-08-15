import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card } from "@/components/ui";
import { money } from "@/lib/finance";
import { isAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminContractsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = (await searchParams).q?.trim() ?? "";
  const [players, admin] = await Promise.all([
    prisma.player.findMany({
      where: {
        team: { league: "NHL" },
        ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
      },
      select: { id: true, name: true, slug: true, position: true, capHit: true, contractYears: true, contractExpiry: true, team: { select: { name: true, code: true } } },
      orderBy: [{ capHit: "desc" }, { name: "asc" }],
      take: q ? 200 : 60,
    }),
    isAdmin(),
  ]);

  return (
    <div className="space-y-6 py-2">
      <PageHeader
        title="Contract Management"
        subtitle="Set a player's salary (cap hit) and contract length. Manual override until Agent signing writes it automatically."
        right={<Link href="/admin" className="text-sm text-slate-400 hover:text-blue-400">← Admin</Link>}
      />

      {!admin && (
        <div className="text-sm text-amber-300 bg-amber-950/30 border border-amber-800/50 rounded-lg px-4 py-2.5">
          Sign in as an <b>admin</b> GM to save changes — the editor opens but Save is blocked otherwise.
        </div>
      )}

      <form className="flex gap-2" action="/admin/contracts">
        <input name="q" defaultValue={q} placeholder="Search player by name…"
          className="flex-1 max-w-sm bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm" />
        <button className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-semibold">Search</button>
      </form>

      <Card bodyClassName="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-slate-500 text-xs uppercase tracking-wider bg-slate-800/30">
                <th className="px-4 py-3 text-left font-medium">Player</th>
                <th className="px-3 py-3 text-left font-medium">Team</th>
                <th className="px-4 py-3 text-right font-medium">Cap Hit</th>
                <th className="px-4 py-3 text-center font-medium">Years</th>
                <th className="px-4 py-3 text-center font-medium">Expiry</th>
                <th className="px-4 py-3 text-right font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {players.map((player) => (
                <tr key={player.id} className="border-b border-slate-800/40 hover:bg-slate-800/30 transition-colors last:border-0">
                  <td className="px-4 py-3 font-medium">{player.name} <span className="text-slate-600 text-xs">{player.position}</span></td>
                  <td className="px-3 py-3 text-slate-400">{player.team.code ?? player.team.name}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{player.capHit ? money(player.capHit) : "—"}</td>
                  <td className="px-4 py-3 text-center text-slate-400">{player.contractYears ?? "—"}</td>
                  <td className="px-4 py-3 text-center text-slate-400">{player.contractExpiry ?? "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/admin/contracts/${player.slug}`} className="text-blue-400 hover:text-blue-300">Edit</Link>
                  </td>
                </tr>
              ))}
              {players.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">No players match “{q}”.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
      {!q && <p className="text-xs text-slate-500 px-1">Showing the 60 biggest cap hits — search to find any player.</p>}
    </div>
  );
}
