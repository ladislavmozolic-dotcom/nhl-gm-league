import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { loadTeamLines, autoLines } from "@/lib/sim/lines";
import { loadSettings, chemistryNeutralPoint } from "@/lib/sim/settings";
import { PLAY_CON } from "@/lib/sim/season";
import { canManageTeam } from "@/lib/auth";
import { cleanName, captaincyFromName } from "@/lib/playerName";
import LineEditor from "@/components/LineEditor";
import { saveLines, suggestLinesAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function LinesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const team = await prisma.team.findUnique({
    where: { slug },
    include: { parentTeam: { select: { slug: true } } },
  });
  if (!team) notFound();

  // require login as this team, OR any admin GM (who can manage every team)
  if (!(await canManageTeam(team.id))) redirect(`/teams/${slug}/login`);

  const rosterType = team.league === "AHL" ? "AHL" : "NHL";
  // scratched = a healthy scratch (pro-scratched for NHL, farm-scratched for AHL) —
  // not in tonight's lineup at all, so he has no business showing up as a pickable
  // option for a forward line / D pair / PP-PK slot here. Roster Moves is where a
  // GM decides who's dressed vs scratched; Lines only arranges the dressed players.
  const [skaterRows, goalieRows] = await Promise.all([
    prisma.player.findMany({
      where: { teamId: team.id, rosterType, isGoalie: false, scratched: false },
      select: { id: true, name: true, position: true, shoots: true, overall: true, injuryDaysLeft: true, suspendedGames: true, df: true, condition: true, captaincy: true, pa: true, sk: true, sc: true, ck: true, fo: true, st: true, en: true, weight: true, ph: true, number: true },
      orderBy: { overall: "desc" },
    }),
    prisma.player.findMany({
      where: { teamId: team.id, rosterType, isGoalie: true, scratched: false },
      select: { id: true, name: true, position: true, photoUrl: true, overall: true, injuryDaysLeft: true, suspendedGames: true, condition: true, captaincy: true, number: true },
      orderBy: { overall: "desc" },
    }),
  ]);
  // captaincy: GM-set `captaincy` field is the source of truth; fall back to the legacy
  // name marker only for a club that never set it (matches Rosters / League → Captains).
  const capHasField = [...skaterRows, ...goalieRows].some((p) => p.captaincy === "C" || p.captaincy === "A");
  const capOf = (p: { captaincy: string | null; name: string }) => (capHasField ? ((p.captaincy as "C" | "A" | null) ?? null) : captaincyFromName(p.name));
  const players = skaterRows.map((p) => ({ id: p.id, name: cleanName(p.name), position: p.position, shoots: p.shoots, overall: p.overall ?? 0, injured: (p.injuryDaysLeft ?? 0) > 0 || p.suspendedGames > 0, df: p.df, con: Math.round(p.condition ?? 100), cap: capOf(p), pa: p.pa, sk: p.sk, sc: p.sc, ck: p.ck, fo: p.fo, st: p.st, en: p.en, weight: p.weight, ph: p.ph, number: p.number }));
  const goalies = goalieRows.map((p) => ({ id: p.id, name: cleanName(p.name), position: "G", photoUrl: p.photoUrl, overall: p.overall ?? 0, injured: (p.injuryDaysLeft ?? 0) > 0 || p.suspendedGames > 0, tired: (p.condition ?? 100) < PLAY_CON, con: Math.round(p.condition ?? 100), cap: capOf(p), number: p.number }));

  // Back-to-back: the sim sits a GM-picked starter on the second night of a back-to-back
  // (he started the game-day before the team's next game) — flag who that is so the GM
  // isn't surprised when the backup gets the net.
  const nextGame = await prisma.game.findFirst({
    where: { season: "2026-27", status: "SCHEDULED", seriesId: null, league: rosterType, round: { not: null }, OR: [{ homeTeamId: team.id }, { awayTeamId: team.id }] },
    orderBy: { round: "asc" }, select: { round: true },
  });
  const b2bRows = nextGame?.round != null && goalieRows.length
    ? await prisma.goalieGameStat.findMany({
        where: { playerId: { in: goalieRows.map((g) => g.id) }, started: true, game: { season: "2026-27", status: "FINAL", seriesId: null, round: nextGame.round - 1 } },
        select: { playerId: true },
      })
    : [];
  const goalieB2b = Object.fromEntries(b2bRows.map((r) => [r.playerId, true as const]));

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
      jerseyTeamSlug={team.league === "AHL" ? (team.parentTeam?.slug ?? slug) : slug}
      players={players}
      goalies={goalies}
      goalieB2b={goalieB2b}
      initial={lines}
      chemistry={chemistry}
      chemBase={settings.chemistryBase}
      chemNeutral={chemistryNeutralPoint(settings.chemistryCurve)}
      chemEnabled={settings.chemistryEnabled}
      onSave={saveLines}
      onSuggest={suggestLinesAction}
    />
  );
}
