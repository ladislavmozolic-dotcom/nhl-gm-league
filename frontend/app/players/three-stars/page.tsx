import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui";
import { getLang } from "@/lib/lang-server";
import ThreeStarsView, { type ThreeStarRow } from "@/components/ThreeStarsView";

export const dynamic = "force-dynamic";

const SEASON = "2026-27";

// Same game filter used everywhere: NHL, regular season, completed games.
const GAME_FILTER = { season: SEASON, league: "NHL", status: "FINAL", seriesId: null } as const;

type Cand = { playerId: number; score: number };
type Tally = { firsts: number; seconds: number; thirds: number };

export default async function ThreeStarsPage() {
  const [lang, skaterStats, goalieStats] = await Promise.all([
    getLang(),
    prisma.playerGameStat.findMany({
      where: { game: GAME_FILTER },
      select: { gameId: true, playerId: true, goals: true, assists: true, plusMinus: true, shots: true, gwg: true },
    }),
    prisma.goalieGameStat.findMany({
      where: { game: GAME_FILTER },
      select: { gameId: true, playerId: true, started: true, saves: true, shotsAgainst: true, goalsAgainst: true },
    }),
  ]);

  const isCs = lang === "cs";

  // gameId -> candidate stars (skaters + starting goalies), scored per GameView.
  const byGame = new Map<number, Cand[]>();
  const push = (gameId: number, c: Cand) => {
    const arr = byGame.get(gameId);
    if (arr) arr.push(c);
    else byGame.set(gameId, [c]);
  };

  for (const s of skaterStats) {
    if (!s.goals && !s.assists && !s.shots) continue;
    const score = s.goals * 3.2 + s.assists * 2 + s.plusMinus * 0.4 + s.shots * 0.08 + s.gwg * 1.5;
    push(s.gameId, { playerId: s.playerId, score });
  }
  for (const g of goalieStats) {
    if (!g.started || g.shotsAgainst < 15) continue;
    const savesAbove = g.saves - g.shotsAgainst * 0.915;
    const shutout = g.goalsAgainst === 0 ? 2 : 0;
    const score = savesAbove * 3 + shutout;
    push(g.gameId, { playerId: g.playerId, score });
  }

  // Award 1st/2nd/3rd star per game, tally per player.
  const tally = new Map<number, Tally>();
  const bump = (playerId: number, star: 0 | 1 | 2) => {
    let t = tally.get(playerId);
    if (!t) {
      t = { firsts: 0, seconds: 0, thirds: 0 };
      tally.set(playerId, t);
    }
    if (star === 0) t.firsts++;
    else if (star === 1) t.seconds++;
    else t.thirds++;
  };
  for (const cands of byGame.values()) {
    cands.sort((a, b) => b.score - a.score);
    for (let i = 0; i < 3 && i < cands.length; i++) bump(cands[i].playerId, i as 0 | 1 | 2);
  }

  const points = (t: Tally) => t.firsts * 7 + t.seconds * 4 + t.thirds * 2;

  const ids = [...tally.keys()];
  const players = await prisma.player.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      slug: true,
      name: true,
      position: true,
      photoUrl: true,
      team: { select: { code: true, slug: true, logoUrl: true } },
    },
  });
  const pMap = new Map(players.map((p) => [p.id, p]));

  const rows: ThreeStarRow[] = ids
    .map((id) => {
      const p = pMap.get(id);
      const t = tally.get(id)!;
      return {
        id,
        slug: p?.slug ?? String(id),
        name: p?.name ?? "—",
        position: p?.position ?? "—",
        photoUrl: p?.photoUrl ?? null,
        teamCode: p?.team?.code ?? null,
        teamSlug: p?.team?.slug ?? null,
        teamLogoUrl: p?.team?.logoUrl ?? null,
        firsts: t.firsts,
        seconds: t.seconds,
        thirds: t.thirds,
        pts: points(t),
      };
    })
    .filter((r) => r.name !== "—")
    .sort((a, b) => b.pts - a.pts || b.firsts - a.firsts || b.seconds - a.seconds)
    .slice(0, 100);

  return (
    <div className="space-y-6 py-2">
      <PageHeader
        title={isCs ? "Tri hviezdy zápasov" : "Three Stars of the Game"}
        subtitle={
          isCs
            ? `Celoligový rebríček troch hviezd za zápasy NHL ${SEASON}`
            : `Season-wide Three Stars leaderboard — NHL ${SEASON}`
        }
      />

      <ThreeStarsView
        rows={rows}
        season={SEASON}
        lang={lang}
      />
    </div>
  );
}
