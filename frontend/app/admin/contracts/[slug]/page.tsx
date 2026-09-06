import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { updateContract, markLtir, sendToProspects, activateFromReserve } from "../actions";
import { PageHeader, Card } from "@/components/ui";
import { money } from "@/lib/finance";
import { isComishOrCoComish } from "@/lib/auth";
import DeletePlayerButton from "@/components/DeletePlayerButton";

export const dynamic = "force-dynamic";

export default async function ContractEditPage({
  params, searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { slug } = await params;
  const saved = (await searchParams).saved === "1";
  const [player, canOverride] = await Promise.all([
    prisma.player.findFirst({
      where: { slug },
      select: { id: true, name: true, slug: true, position: true, capHit: true, contractYears: true, contractExpiry: true, contractText: true, contractType: true, rosterType: true, ltir: true, team: { select: { name: true } } },
    }),
    isComishOrCoComish(),
  ]);

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
              <label className="block text-xs uppercase tracking-wide text-slate-400 mb-1">Cap Hit — full-season salary in $, any exact amount (e.g. 1325000)</label>
              <input type="number" step="1" min="0" name="capHit" defaultValue={player.capHit ?? ""} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wide text-slate-400 mb-1">Contract Length (years left)</label>
              <input type="number" min="0" max="8" name="contractYears" defaultValue={player.contractYears ?? ""} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wide text-slate-400 mb-1">Expiry year — auto-calculated from Contract Length, no need to set by hand</label>
              <input type="number" className={`${inputCls} opacity-60 cursor-not-allowed`} value={player.contractExpiry ?? ""} disabled readOnly />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wide text-slate-400 mb-1">Contract Type</label>
              <select name="contractType" defaultValue={player.contractType ?? ""} className={inputCls}>
                <option value="">— Unset</option>
                <option value="ONE_WAY">One-way (full salary in the NHL or AHL)</option>
                <option value="TWO_WAY">Two-way (lower salary if sent to the AHL)</option>
              </select>
            </div>
            <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium">Save Contract</button>
          </form>
        </Card>

        <Card title="Current Contract">
          <div className="divide-y divide-slate-800/60 text-sm">
            <div className="flex justify-between py-2"><span className="text-slate-400">Cap Hit</span><span className="tabular-nums font-semibold">{player.capHit ? money(player.capHit) : "—"}</span></div>
            <div className="flex justify-between py-2"><span className="text-slate-400">Years Left</span><span className="tabular-nums">{player.contractYears ?? "—"}</span></div>
            <div className="flex justify-between py-2"><span className="text-slate-400">Expiry</span><span className="tabular-nums">{player.contractExpiry ?? "—"}</span></div>
            <div className="flex justify-between py-2"><span className="text-slate-400">Contract Type</span><span className="text-slate-300">{player.contractType === "ONE_WAY" ? "One-way" : player.contractType === "TWO_WAY" ? "Two-way" : "—"}</span></div>
            <div className="flex justify-between py-2"><span className="text-slate-400">Shown as</span><span className="text-slate-300">{player.contractText ?? "—"}</span></div>
          </div>
        </Card>

        <Card title="Roster Status">
          <div className="space-y-3 text-sm">
            <div className="flex justify-between py-1">
              <span className="text-slate-400">Status</span>
              <span className="font-semibold">
                {player.rosterType === "PROSPECT" ? (player.ltir ? "Reserve List" : "Prospect Pool") : (player.rosterType ?? "—")}
                {player.ltir && <span className="ml-2 text-[10px] font-bold uppercase tracking-wider text-amber-400 bg-amber-500/10 ring-1 ring-amber-500/30 rounded px-1.5 py-0.5">LTIR</span>}
              </span>
            </div>
            {!canOverride && (
              <p className="text-xs text-amber-300 bg-amber-950/30 border border-amber-800/50 rounded-lg px-3 py-2">
                Only the Comish or Co-Comish can change this.
              </p>
            )}
            {canOverride && player.rosterType === "PROSPECT" ? (
              <div className="flex flex-wrap gap-2">
                <form action={activateFromReserve.bind(null, slug, "NHL")}>
                  <button type="submit" className="text-xs px-3 py-1.5 rounded-lg bg-emerald-900/70 hover:bg-emerald-800 text-emerald-200 font-medium">↑ Activate to NHL</button>
                </form>
                <form action={activateFromReserve.bind(null, slug, "AHL")}>
                  <button type="submit" className="text-xs px-3 py-1.5 rounded-lg bg-slate-700/70 hover:bg-slate-600 text-slate-200 font-medium">↑ Activate to AHL</button>
                </form>
              </div>
            ) : canOverride && (
              <div className="flex flex-wrap gap-2">
                <form action={markLtir.bind(null, slug)}>
                  <button type="submit" className="text-xs px-3 py-1.5 rounded-lg bg-sky-900/70 hover:bg-sky-800 text-sky-200 font-medium">Mark LTIR</button>
                </form>
                <form action={sendToProspects.bind(null, slug)}>
                  <button type="submit" className="text-xs px-3 py-1.5 rounded-lg bg-slate-700/70 hover:bg-slate-600 text-slate-200 font-medium">Send to Prospects</button>
                </form>
              </div>
            )}
            <p className="text-[11px] text-slate-500">
              <b>Mark LTIR</b> — injured, off the cap, parked in the Reserve List. <b>Send to Prospects</b> — left the NHL by choice (e.g. a move to Europe), no injury implication, parked in the Prospect Pool. Both are off the cap; use the activate buttons to bring him back.
            </p>
          </div>
        </Card>

        {canOverride && (
          <Card title="Danger Zone">
            <div className="space-y-2">
              <p className="text-[11px] text-slate-500">Permanently remove this player from the database — irreversible. His game history, contract and ratings are gone for good.</p>
              <DeletePlayerButton slug={player.slug} name={player.name} />
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
