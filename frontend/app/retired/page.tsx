import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { PageHeader, Card } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function RetiredPage() {
  const cfg = await prisma.leagueConfig.findUnique({ where: { id: 1 } });
  const isReal = cfg?.rosterMode === "real";

  // Retired = real players with no NHL/AHL games in the latest season (e.g. Carey Price, Shea Weber).
  // Only relevant in the Real NHL dataset.
  const retired = isReal
    ? await prisma.player.findMany({
        where: { rosterType: "RETIRED" },
        orderBy: { name: "asc" },
      })
    : [];

  return (
    <div className="space-y-6 py-2">
      <PageHeader
        title="Retired"
        subtitle="Real players no longer active (no NHL/AHL games last season)"
        right={
          <Link href="/free-agents" className="text-sm text-slate-400 hover:text-blue-400 whitespace-nowrap">
            ← Free agents
          </Link>
        }
      />

      {retired.length === 0 ? (
        <Card>
          <div className="p-8 text-center">
            <p className="text-slate-500 text-lg">No retired players</p>
            <p className="text-slate-600 text-sm mt-2">
              {isReal
                ? "No inactive players in the current dataset"
                : "Retired players are only tracked in the Real NHL roster mode"}
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid gap-3">
          {retired.map((player) => (
            <Link
              key={player.id}
              href={`/players/${player.slug}`}
              className="flex items-center gap-4 p-4 bg-slate-900/70 border border-slate-800 rounded-2xl shadow-lg shadow-black/20 hover:border-slate-600 transition-colors group"
            >
              {player.photoUrl ? (
                <img
                  src={player.photoUrl}
                  alt={player.name}
                  className="w-12 h-12 rounded-full object-cover bg-slate-800 grayscale"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-sm font-bold text-slate-500">
                  {player.name[0]}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold group-hover:text-blue-400 transition-colors">{player.name}</p>
                <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                  <span>{player.position}</span>
                  {player.birthDate && (
                    <>
                      <span>•</span>
                      <span>b. {player.birthDate.slice(0, 4)}</span>
                    </>
                  )}
                </div>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-600/30 text-slate-400">
                RETIRED
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
