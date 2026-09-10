import Link from "next/link";
import PlayerLink from "@/components/PlayerLink";
import { prisma } from "@/lib/prisma";
import { captaincyFromName } from "@/lib/playerName";
import { PageHeader, Card } from "@/components/ui";

export const dynamic = "force-dynamic";

const captaincyFilter = { OR: [{ captaincy: { not: null } }, { name: { contains: "''C''" } }, { name: { contains: "''A''" } }] };

function buildCards<T extends { id: number; players: { id: number; name: string; position: string | null; number: number | null; captaincy: string | null }[] }>(teams: T[]) {
  return teams.map((t) => {
    // The GM-set `captaincy` field is the source of truth. Only when NO player on the
    // club has it set do we fall back to the letters embedded in the imported name.
    const hasField = t.players.some((p) => p.captaincy === "C" || p.captaincy === "A");
    const roleOf = (p: { captaincy: string | null; name: string }) =>
      hasField ? (p.captaincy as "C" | "A" | null) : captaincyFromName(p.name);
    const marked = t.players.map((p) => ({ ...p, role: roleOf(p) }));
    return { ...t, captain: marked.find((p) => p.role === "C"), assistants: marked.filter((p) => p.role === "A") };
  });
}

export default async function CaptainsPage() {
  const [nhlTeams, ahlTeams] = await Promise.all([
    prisma.team.findMany({
      where: { league: "NHL", isAffiliate: false },
      select: {
        id: true, name: true, code: true, logoUrl: true, slug: true, conference: true,
        players: { where: { rosterType: "NHL", ...captaincyFilter }, select: { id: true, name: true, position: true, number: true, captaincy: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.team.findMany({
      where: { league: "AHL" },
      select: {
        id: true, name: true, code: true, logoUrl: true, slug: true,
        players: { where: { rosterType: "AHL", ...captaincyFilter }, select: { id: true, name: true, position: true, number: true, captaincy: true } },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  const nhlCards = buildCards(nhlTeams);
  const ahlCards = buildCards(ahlTeams);

  const Grid = ({ cards }: { cards: typeof nhlCards | typeof ahlCards }) => (
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
                <p className="text-sm">{t.captain.number != null && <span className="text-slate-500 mr-1">#{t.captain.number}</span>}<PlayerLink id={t.captain.id} name={t.captain.name} /> <span className="text-slate-500 text-xs">{t.captain.position}</span></p>
              ) : <p className="text-sm text-slate-600">—</p>}
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Assistants</span>
              {t.assistants.length ? t.assistants.map((a) => (
                <p key={a.id} className="text-sm">{a.number != null && <span className="text-slate-500 mr-1">#{a.number}</span>}<PlayerLink id={a.id} name={a.name} /> <span className="text-slate-500 text-xs">{a.position}</span></p>
              )) : <p className="text-sm text-slate-600">—</p>}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );

  return (
    <div className="space-y-6 py-2">
      <PageHeader title="Captains & Assistants" subtitle="Leadership groups across all NHL and AHL clubs." />
      <Grid cards={nhlCards} />
      {ahlCards.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-emerald-400 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" /> AHL / Farm Clubs
          </h2>
          <Grid cards={ahlCards} />
        </div>
      )}
    </div>
  );
}
