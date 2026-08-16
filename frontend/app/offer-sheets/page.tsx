import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card } from "@/components/ui";
import { getLeagueClock } from "@/lib/calendar-server";
import { cleanName } from "@/lib/playerName";

export const dynamic = "force-dynamic";

const M = (c: number | null) => (c != null ? `$${(c / 1_000_000).toFixed(1)}M` : "—");

export default async function OfferSheetsPage() {
  const clock = await getLeagueClock();
  // OS submission window: July 1–8 (the first 8 days of the off-season frenzy)
  const osWindow = clock.frenzyOpen && clock.frenzyDay >= 1 && clock.frenzyDay <= 8;

  // RFA-age (≤26) players whose deal is ending (final year / expired)
  const rfas = await prisma.player.findMany({
    where: { rosterType: { in: ["NHL", "AHL"] }, age: { lte: 26 }, contractYears: { not: null, lte: 1 } },
    select: { id: true, name: true, position: true, age: true, capHit: true, teamId: true, franchiseTag: true, resignStatus: true },
    orderBy: [{ capHit: "desc" }],
  });
  const teams = await prisma.team.findMany({ where: { id: { in: [...new Set(rfas.map((r) => r.teamId))] } }, select: { id: true, code: true, slug: true } });
  const tById = new Map(teams.map((t) => [t.id, t]));

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 space-y-5">
      <PageHeader title="Offer Sheets" subtitle="RFAs who may become available to rival clubs after the season" />
      <Card>
        <p className="text-sm text-slate-400">Restricted free agents (26 or younger) whose contracts are ending. A club re-signs its RFA during the season; if it doesn&apos;t and the player isn&apos;t <b className="text-fuchsia-300">Franchise-tagged</b>, he opens up to <b className="text-emerald-300">offer sheets</b>. Rival clubs may submit an offer <b>July 1–8</b>; each player decides by July 10 (no counter — he signs the best offer that beats his own club, or declines).</p>
        {!osWindow && <p className="text-xs text-slate-500 mt-2">The offer-sheet window opens July 1.</p>}
      </Card>

      {rfas.length === 0 ? (
        <Card><p className="text-sm text-slate-500">No RFAs with expiring deals right now.</p></Card>
      ) : (
        <Card bodyClassName="p-0">
          <div className="divide-y divide-slate-800/60">
            {rfas.map((p) => {
              const t = tById.get(p.teamId);
              const eligible = p.resignStatus === "osEligible" && !p.franchiseTag;
              let status: { label: string; cls: string; green?: boolean };
              if (p.franchiseTag) status = { label: "Franchise — 2 rounds first", cls: "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30" };
              else if (eligible && osWindow) status = { label: "Offer Contract", cls: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40", green: true };
              else if (eligible) status = { label: "Will be available for OS", cls: "bg-sky-500/15 text-sky-300 border-sky-500/30" };
              else status = { label: "Non eligible for OS", cls: "bg-slate-700/40 text-slate-400 border-slate-600/40" };
              return (
                <div key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <Link href={`/players/${p.id}`} className="text-sm font-semibold hover:text-blue-400">{cleanName(p.name)}</Link>
                    <span className="ml-1.5 text-[11px] text-slate-500">{p.position} · {p.age}y · {M(p.capHit)}</span>
                    {t && <Link href={`/teams/${t.slug}`} className="ml-1.5 text-[11px] text-slate-500 hover:text-blue-400">{t.code}</Link>}
                  </div>
                  {status.green ? (
                    <button title="Offer-sheet submission opens with the OS engine (next stage)" disabled
                      className="shrink-0 text-xs px-3 py-1.5 rounded-lg bg-emerald-600/80 text-white font-semibold disabled:opacity-70">Offer Contract</button>
                  ) : (
                    <span className={`shrink-0 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded border ${status.cls}`}>{status.label}</span>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
