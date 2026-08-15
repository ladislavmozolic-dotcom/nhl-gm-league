import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { updateContract } from "../actions";
import { PageHeader, Card } from "@/components/ui";
import { money } from "@/lib/finance";

export const dynamic = "force-dynamic";

export default async function ContractEditPage({
  params, searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { slug } = await params;
  const saved = (await searchParams).saved === "1";
  const player = await prisma.player.findFirst({
    where: { slug },
    select: { id: true, name: true, slug: true, position: true, capHit: true, contractYears: true, contractExpiry: true, contractText: true, team: { select: { name: true } } },
  });

  if (!player) {
    return (
      <div className="space-y-6 py-2">
        <PageHeader title="Player not found" right={<Link href="/admin/contracts" className="text-sm text-slate-400 hover:text-blue-400">← Contracts</Link>} />
      </div>
    );
  }

  const inputCls = "w-full bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500";

  return (
    <div className="space-y-6 py-2">
      <PageHeader
        title={player.name}
        subtitle={`${player.position ?? ""} · ${player.team.name}`}
        right={<Link href="/admin/contracts" className="text-sm text-slate-400 hover:text-blue-400">← Contracts</Link>}
      />
      {saved && <div className="text-sm text-green-300 bg-green-950/30 border border-green-800/40 rounded-lg px-4 py-2.5">Contract saved.</div>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Edit Contract">
          <form action={updateContract} className="space-y-4">
            <input type="hidden" name="slug" value={player.slug} />
            <div>
              <label className="block text-xs uppercase tracking-wide text-slate-400 mb-1">Cap Hit — full-season salary in $ (e.g. 9000000)</label>
              <input type="number" step="100000" min="0" name="capHit" defaultValue={player.capHit ?? ""} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wide text-slate-400 mb-1">Contract Length (years left)</label>
              <input type="number" min="0" max="8" name="contractYears" defaultValue={player.contractYears ?? ""} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wide text-slate-400 mb-1">Expiry year (optional)</label>
              <input type="number" name="contractExpiry" defaultValue={player.contractExpiry ?? ""} className={inputCls} />
            </div>
            <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium">Save Contract</button>
          </form>
        </Card>

        <Card title="Current Contract">
          <div className="divide-y divide-slate-800/60 text-sm">
            <div className="flex justify-between py-2"><span className="text-slate-400">Cap Hit</span><span className="tabular-nums font-semibold">{player.capHit ? money(player.capHit) : "—"}</span></div>
            <div className="flex justify-between py-2"><span className="text-slate-400">Years Left</span><span className="tabular-nums">{player.contractYears ?? "—"}</span></div>
            <div className="flex justify-between py-2"><span className="text-slate-400">Expiry</span><span className="tabular-nums">{player.contractExpiry ?? "—"}</span></div>
            <div className="flex justify-between py-2"><span className="text-slate-400">Shown as</span><span className="text-slate-300">{player.contractText ?? "—"}</span></div>
          </div>
        </Card>
      </div>
    </div>
  );
}
