import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { cleanName, captaincyFromName } from "@/lib/playerName";
import { PageHeader, Card } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function CaptainsPage() {
  const teams = await prisma.team.findMany({
    where: { league: "NHL", isAffiliate: false },
    select: {
      id: true, name: true, code: true, logoUrl: true, slug: true, conference: true,
      players: {
        where: { rosterType: "NHL", OR: [{ name: { contains: "''C''" } }, { name: { contains: "''A''" } }] },
        select: { id: true, name: true, position: true },
      },
    },
    orderBy: { name: "asc" },
  });

  const cards = teams.map((t) => {
    const marked = t.players.map((p) => ({ ...p, role: captaincyFromName(p.name) }));
    return { ...t, captain: marked.find((p) => p.role === "C"), assistants: marked.filter((p) => p.role === "A") };
  });

  return (
    <div className="space-y-6 py-2">
      <PageHeader title="Captains & Assistants" subtitle="Leadership groups across all NHL clubs." />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((t) => (
          <Card key={t.id} bodyClassName="p-0">
            <Link href={`/teams/${t.slug}`} className="flex items-center gap-2 px-4 py-2.5 bg-slate-800/30 border-b border-slate-800 hover:bg-slate-800/60 transition-colors">
              {t.logoUrl && <img src={t.logoUrl} alt="" className="w-6 h-6 object-contain" />}
              <span className="font-semibold text-sm">{t.name}</span>
            </Link>
            <div className="p-4 space-y-2">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wide text-amber-400">Captain</span>
                {t.captain ? (
                  <p className="text-sm">{cleanName(t.captain.name)} <span className="text-slate-500 text-xs">{t.captain.position}</span></p>
                ) : <p className="text-sm text-slate-600">—</p>}
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Assistants</span>
                {t.assistants.length ? t.assistants.map((a) => (
                  <p key={a.id} className="text-sm">{cleanName(a.name)} <span className="text-slate-500 text-xs">{a.position}</span></p>
                )) : <p className="text-sm text-slate-600">—</p>}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
