import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { loadTeamLines, autoLines } from "@/lib/sim/lines";
import { loadSettings } from "@/lib/sim/settings";
import { canManageTeam } from "@/lib/auth";
import { cleanName, captaincyFromName } from "@/lib/playerName";
import LineEditor from "@/components/LineEditor";
import { saveLines, suggestLinesAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function LinesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const team = await prisma.team.findUnique({ where: { slug } });
  if (!team) notFound();

  // require login as this team, OR any admin GM (who can manage every team)
  if (!(await canManageTeam(team.id))) redirect(`/teams/${slug}/login`);

  const rosterType = team.league === "AHL" ? "AHL" : "NHL";
  const [skaterRows, goalieRows] = await Promise.all([
    prisma.player.findMany({
      where: { teamId: team.id, rosterType, isGoalie: false },
      select: { id: true, name: true, position: true, overall: true, injuryDaysLeft: true, df: true, condition: true, captaincy: true, pa: true, sk: true, sc: true, ck: true, fo: true, st: true },
      orderBy: { overall: "desc" },
    }),
    prisma.player.findMany({
      where: { teamId: team.id, rosterType, isGoalie: true },
      select: { id: true, name: true, position: true, overall: true, injuryDaysLeft: true, condition: true, captaincy: true },
      orderBy: { overall: "desc" },
    }),
  ]);
  // captaincy: GM-set `captaincy` field is the source of truth; fall back to the legacy
  // name marker only for a club that never set it (matches Rosters / League → Captains).
  const capHasField = [...skaterRows, ...goalieRows].some((p) => p.captaincy === "C" || p.captaincy === "A");
  const capOf = (p: { captaincy: string | null; name: string }) => (capHasField ? ((p.captaincy as "C" | "A" | null) ?? null) : captaincyFromName(p.name));
  const players = skaterRows.map((p) => ({ id: p.id, name: cleanName(p.name), position: p.position, overall: p.overall ?? 0, injured: (p.injuryDaysLeft ?? 0) > 0, df: p.df, con: Math.round(p.condition ?? 100), cap: capOf(p), pa: p.pa, sk: p.sk, sc: p.sc, ck: p.ck, fo: p.fo, st: p.st }));
  const goalies = goalieRows.map((p) => ({ id: p.id, name: cleanName(p.name), position: "G", overall: p.overall ?? 0, injured: (p.injuryDaysLeft ?? 0) > 0, con: Math.round(p.condition ?? 100), cap: capOf(p) }));

  const saved = await loadTeamLines(team.id);
  const lines = saved ?? autoLines(players, goalies);

  // line chemistry (pairwise bonds) + settings for the "gelled" thresholds
  const [linesRow, settings] = await Promise.all([
    prisma.teamLines.findUnique({ where: { teamId: team.id }, select: { chemistry: true } }),
    loadSettings(),
  ]);
  const chemistry = (linesRow?.chemistry as Record<string, number> | null) ?? {};

  return (
    <LineEditor
      teamName={team.name}
      teamSlug={slug}
      players={players}
      goalies={goalies}
      initial={lines}
      chemistry={chemistry}
      chemBase={settings.chemistryBase}
      chemNeutral={settings.chemistryNeutral}
      chemEnabled={settings.chemistryEnabled}
      onSave={saveLines}
      onSuggest={suggestLinesAction}
    />
  );
}
