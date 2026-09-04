import { prisma } from "@/lib/prisma";
import PlayerCompare, { type ComparePlayer } from "@/components/PlayerCompare";
import { cleanName } from "@/lib/playerName";
import { isLoggedIn } from "@/lib/auth";
import { redactAttrs } from "@/lib/player-attrs";

export const dynamic = "force-dynamic";

export default async function ComparePage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const { p: pParam } = await searchParams;
  const initialId = pParam ? Number(pParam) : null;
  const [rows, teams, loggedIn] = await Promise.all([
    prisma.player.findMany({
      where: { rosterType: { in: ["NHL", "AHL", "UFA"] } },
      select: {
        id: true, name: true, position: true, isGoalie: true, teamId: true, rosterType: true, age: true, overall: true, contractText: true, condition: true,
        ck: true, fg: true, di: true, sk: true, st: true, en: true, du: true, ph: true, fo: true, pa: true, sc: true, df: true, ps: true, ex: true, ld: true, mo: true,
        goalieRating: { select: { sz: true, ag: true, rb: true, hs: true, rt: true } },
      },
      orderBy: { overall: "desc" },
    }),
    prisma.team.findMany({ select: { id: true, code: true } }),
    isLoggedIn(),
  ]);
  const codeById = new Map(teams.map((t) => [t.id, t.code]));
  const toCP = (p: (typeof rows)[number]): ComparePlayer => ({
    ...(p as unknown as Record<string, number | string | null>),
    ...(p.goalieRating ?? {}), // goalie-only attrs (sz/ag/rb/hs/rt) live on GoalieRating
    id: p.id, name: cleanName(p.name), position: p.position,
    // a UFA's teamId is a leftover, not meaningful (see roster-real-gaps notes) — show
    // "UFA" instead of whatever stale/ignored team happens to still be linked.
    teamCode: p.rosterType === "UFA" ? "UFA" : (p.teamId ? codeById.get(p.teamId) ?? null : null),
    age: p.age, overall: p.overall, contractText: p.contractText, condition: p.condition, goalie: p.isGoalie,
  } as ComparePlayer);
  const redact = (p: ComparePlayer) => redactAttrs(p as unknown as Record<string, unknown>, !loggedIn) as unknown as ComparePlayer;
  const all = rows.map(toCP).map(redact);
  const skaters = all.filter((p) => !p.goalie);
  const goalies = all.filter((p) => p.goalie);

  return <div className="py-2"><PlayerCompare skaters={skaters} goalies={goalies} initialId={initialId} hideAttrs={!loggedIn} /></div>;
}
