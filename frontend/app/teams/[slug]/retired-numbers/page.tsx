import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui";
import { canManageTeam, isAdmin } from "@/lib/auth";
import { loadSettings } from "@/lib/sim/settings";
import { retiredNumbersOf, retireCandidates } from "@/lib/retired-numbers-server";
import { RetireNumberForm, UnretireButton } from "@/components/RetireNumberForm";

export const dynamic = "force-dynamic";

export default async function RetiredNumbersPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const team = await prisma.team.findUnique({ where: { slug }, select: { id: true, name: true, league: true, logoUrl: true } });
  if (!team) notFound();
  const [rows, gm, admin, s] = await Promise.all([retiredNumbersOf(team.id), canManageTeam(team.id), isAdmin(), loadSettings()]);
  const candidates = gm ? await retireCandidates(team.id) : [];
  const unhl = rows.filter((r) => !r.historic);
  const hist = rows.filter((r) => r.historic);
  const Banner = ({ r }: { r: (typeof rows)[number] }) => (
    <div className="relative rounded-b-xl border border-slate-700 bg-gradient-to-b from-slate-800 to-slate-900 px-3 pt-3 pb-5 text-center shadow-lg border-t-4 border-t-amber-500/70">
      {team.logoUrl && <img src={team.logoUrl} alt="" className="mx-auto mb-1 h-6 w-6 object-contain opacity-80" />}
      <div className="text-4xl font-black text-white tabular-nums leading-none">{r.number}</div>
      <div className="mt-2 text-xs font-bold uppercase tracking-wide text-slate-200 leading-tight">{r.playerName}</div>
      {r.note && <div className="mt-1 text-[10px] text-slate-500">{r.note}</div>}
      {!r.historic && r.season && <div className="mt-1 text-[10px] text-amber-400">UNHL {r.season}</div>}
      {admin && <div className="absolute top-1 right-1.5"><UnretireButton slug={slug} id={r.id} /></div>}
    </div>
  );
  return (
    <div className="space-y-6">
      {unhl.length > 0 && (
        <Card title="🎽 Retired in the UNHL" accent="text-amber-400">
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 lg:grid-cols-6">{unhl.map((r) => <Banner key={r.id} r={r} />)}</div>
        </Card>
      )}
      <Card title={`🏛️ Franchise history — ${hist.length} retired number${hist.length === 1 ? "" : "s"}`} accent="text-slate-300">
        {hist.length ? <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 lg:grid-cols-6">{hist.map((r) => <Banner key={r.id} r={r} />)}</div> : <p className="text-sm text-slate-500">No retired numbers yet.</p>}
        <p className="text-[11px] text-slate-500 mt-3">Real NHL history. A retired number can&apos;t be given to another player on this club.</p>
      </Card>
      {gm && (
        <Card title="Retire a number" accent="text-amber-400">
          {candidates.length ? <RetireNumberForm slug={slug} candidates={candidates} />
            : <p className="text-sm text-slate-400">No eligible player yet. A player qualifies once he has retired (or entered the Hall of Fame){s.retireMinGames > 0 ? ` with at least ${s.retireMinGames} UNHL games for ${team.name}` : " — Hall of Famers only"}.</p>}
        </Card>
      )}
    </div>
  );
}
