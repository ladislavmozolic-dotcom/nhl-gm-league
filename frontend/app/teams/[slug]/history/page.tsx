import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ComingSoon from "@/components/ComingSoon";
import { Card } from "@/components/ui";
import { cleanName } from "@/lib/playerName";

export const dynamic = "force-dynamic";

const AWARD_LABEL: Record<string, string> = {
  Hart: "Hart (MVP)", "Art Ross": "Art Ross", "Rocket Richard": "Rocket Richard",
  Norris: "Norris", Vezina: "Vezina", Calder: "Calder", Selke: "Selke",
  "Lady Byng": "Lady Byng", "Conn Smythe": "Conn Smythe", "Jack Adams": "Jack Adams",
};

export default async function TeamHistoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const team = await prisma.team.findUnique({ where: { slug } });
  if (!team) notFound();

  const [records, awards] = await Promise.all([
    prisma.seasonRecord.findMany({
      where: { OR: [{ championTeamId: team.id }, { runnerUpTeamId: team.id }, { presidentsTeamId: team.id }] },
    }),
    prisma.seasonAward.findMany({ where: { teamId: team.id } }),
  ]);

  if (records.length === 0 && awards.length === 0) {
    return (
      <div className="space-y-6">
        <ComingSoon
          title="Team History"
          points={[
            "Championships, finals appearances and President's Trophies",
            "Award winners from this franchise",
            "Fills in automatically once seasons are archived (Admin → Season Control)",
          ]}
        />
      </div>
    );
  }

  const pids = [...new Set(awards.map((a) => a.playerId).filter((x): x is number => !!x))];
  const pRows = pids.length ? await prisma.player.findMany({ where: { id: { in: pids } }, select: { id: true, name: true, slug: true } }) : [];
  const pMap = new Map(pRows.map((p) => [p.id, p]));

  const champs = records.filter((r) => r.championTeamId === team.id);
  const runnersUp = records.filter((r) => r.runnerUpTeamId === team.id);
  const presidents = records.filter((r) => r.presidentsTeamId === team.id);

  const Trophy = ({ n, label, seasons, tone }: { n: number; label: string; seasons: string[]; tone: string }) => (
    <div className="bg-slate-800/40 rounded-xl p-4 text-center">
      <div className={`text-3xl font-black ${tone}`}>{n}</div>
      <div className="text-xs uppercase tracking-wide text-slate-400 mt-1">{label}</div>
      {seasons.length > 0 && <div className="text-[11px] text-slate-500 mt-1">{seasons.join(", ")}</div>}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-3">
        <Trophy n={champs.length} label={champs.some((c) => c.league === "AHL") ? "Cups" : "Stanley Cups"} tone="text-amber-400" seasons={champs.map((c) => c.season)} />
        <Trophy n={runnersUp.length} label="Finals Losses" tone="text-slate-300" seasons={runnersUp.map((c) => c.season)} />
        <Trophy n={presidents.length} label="Best Records" tone="text-green-400" seasons={presidents.map((c) => c.season)} />
      </div>

      {awards.length > 0 && (
        <Card title="Individual Awards" accent="text-blue-400">
          <div className="divide-y divide-slate-800/60">
            {awards.sort((a, b) => b.season.localeCompare(a.season)).map((a) => {
              const p = a.playerId ? pMap.get(a.playerId) : null;
              const name = p ? cleanName(p.name) : a.playerName ? cleanName(a.playerName) : "—";
              return (
                <div key={a.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="text-xs text-slate-500 w-16 shrink-0">{a.season}</span>
                  <span className="text-[11px] text-amber-400/90 w-28 shrink-0">{AWARD_LABEL[a.category] ?? a.category}</span>
                  {p ? (
                    <Link href={`/players/${p.slug}`} className="text-sm font-semibold text-slate-100 hover:text-blue-400 flex-1 truncate">{name}</Link>
                  ) : (
                    <span className="text-sm font-semibold text-slate-100 flex-1 truncate">{name}</span>
                  )}
                  <span className="text-xs text-slate-400 whitespace-nowrap">{a.detail}</span>
                  <span className="text-[10px] text-slate-600">{a.league}</span>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
