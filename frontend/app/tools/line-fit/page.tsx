import { prisma } from "@/lib/prisma";
import { isLoggedIn, getTeamSession } from "@/lib/auth";
import { loadTeamSystem } from "@/lib/sim/lines";
import { DEFAULT_TACTICS } from "@/lib/sim/tactics";
import { positionPopulations } from "@/lib/line-builder-server";
import { cleanName } from "@/lib/playerName";
import LineFitFinder from "@/components/LineFitFinder";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function LineFitPage() {
  const loggedIn = await isLoggedIn();
  if (!loggedIn) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-2">
        <PageHeader title="Line Fit Finder" subtitle="Preview chemistry & tactical fit for any combination of players" />
        <p className="text-slate-400 text-sm mt-4">🔒 Sign in as a GM to use this tool.</p>
      </div>
    );
  }

  const teamId = await getTeamSession();

  const [rows, tactics, chemRow, pops] = await Promise.all([
    prisma.player.findMany({
      where: { rosterType: { in: ["NHL", "AHL", "UFA"] }, isGoalie: false },
      select: {
        id: true, name: true, slug: true, position: true, shoots: true, overall: true,
        teamId: true, rosterType: true,
        pa: true, sc: true, sk: true, ck: true, df: true, st: true, fo: true, en: true, weight: true,
      },
      orderBy: { overall: "desc" },
    }),
    teamId != null ? loadTeamSystem(teamId) : Promise.resolve(null),
    teamId != null ? prisma.teamLines.findUnique({ where: { teamId }, select: { chemistry: true } }) : Promise.resolve(null),
    positionPopulations(),
  ]);

  const teams = await prisma.team.findMany({ select: { id: true, code: true } });
  const codeById = new Map(teams.map((t) => [t.id, t.code]));

  const players = rows.map((r) => ({
    id: r.id, name: cleanName(r.name), slug: r.slug, position: r.position, shoots: r.shoots, overall: r.overall ?? 0,
    teamCode: r.rosterType === "UFA" ? "UFA" : (r.teamId ? codeById.get(r.teamId) ?? null : null),
    a: { pa: r.pa ?? 50, sc: r.sc ?? 50, sk: r.sk ?? 50, ck: r.ck ?? 50, df: r.df ?? 50, st: r.st ?? 50, fo: r.fo ?? 50, en: r.en ?? 50, weight: r.weight ?? 90 },
  }));
  const chem = ((chemRow?.chemistry ?? {}) as Record<string, number>) || {};

  return (
    <div className="max-w-5xl mx-auto px-4 pb-16">
      <PageHeader title="Line Fit Finder" subtitle="Pick any players — your own roster, a UFA, or a trade target on another team — and preview the chemistry & tactical fit if they lined up together" />
      <LineFitFinder players={players} chem={chem} tactics={tactics ?? DEFAULT_TACTICS} pops={pops} hasTeam={teamId != null} />
    </div>
  );
}
