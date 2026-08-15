import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { cleanName } from "@/lib/playerName";
import PlayerAvatar from "@/components/playerAvatar";
import { PageHeader, Card } from "@/components/ui";

export const dynamic = "force-dynamic";

const SEASON = "2026-27";

const thBase = "text-left font-medium px-4 py-3";
const headRow = "bg-slate-800/30 border-b border-slate-800 text-slate-500 text-xs uppercase tracking-wider";
const bodyRow = "border-b border-slate-800/40 hover:bg-slate-800/30 transition-colors last:border-0";

// Same game filter used everywhere: NHL, regular season, completed games.
const GAME_FILTER = { season: SEASON, league: "NHL", status: "FINAL", seriesId: null } as const;

type Cand = { playerId: number; score: number };
type Tally = { firsts: number; seconds: number; thirds: number };

export default async function ThreeStarsPage() {
  // Load every skater + goalie box line for the season in two flat queries,
  // then group by game in JS (season spans ~40k rows — one query each).
  const [skaterStats, goalieStats] = await Promise.all([
    prisma.playerGameStat.findMany({
      where: { game: GAME_FILTER },
      select: { gameId: true, playerId: true, goals: true, assists: true, plusMinus: true, shots: true, gwg: true },
    }),
    prisma.goalieGameStat.findMany({
      where: { game: GAME_FILTER },
      select: { gameId: true, playerId: true, started: true, saves: true, shotsAgainst: true, goalsAgainst: true },
    }),
  ]);

  // gameId -> candidate stars (skaters + starting goalies), scored per GameView.
  const byGame = new Map<number, Cand[]>();
  const push = (gameId: number, c: Cand) => {
    const arr = byGame.get(gameId);
    if (arr) arr.push(c); else byGame.set(gameId, [c]);
  };

  for (const s of skaterStats) {
    if (!s.goals && !s.assists && !s.shots) continue; // GameView skips empty lines
    const score = s.goals * 3.2 + s.assists * 2 + s.plusMinus * 0.4 + s.shots * 0.08 + s.gwg * 1.5;
    push(s.gameId, { playerId: s.playerId, score });
  }
  for (const g of goalieStats) {
    if (!g.started || g.shotsAgainst < 15) continue; // starter with a real workload
    // Goalies earn stars on SAVE % only, above a 91.5% baseline (league median is ~90%,
    // so an average night scores ≤ 0 → goalies are stars far less often, mainly when
    // SV% clears ~94%). In low-scoring games GA is low → SV% high → both goalies can rank.
    const savesAbove = g.saves - g.shotsAgainst * 0.915;
    const shutout = g.goalsAgainst === 0 ? 2 : 0;
    const score = savesAbove * 3 + shutout;
    push(g.gameId, { playerId: g.playerId, score });
  }

  // Award 1st/2nd/3rd star per game, tally per player.
  const tally = new Map<number, Tally>();
  const bump = (playerId: number, star: 0 | 1 | 2) => {
    let t = tally.get(playerId);
    if (!t) { t = { firsts: 0, seconds: 0, thirds: 0 }; tally.set(playerId, t); }
    if (star === 0) t.firsts++; else if (star === 1) t.seconds++; else t.thirds++;
  };
  for (const cands of byGame.values()) {
    cands.sort((a, b) => b.score - a.score);
    for (let i = 0; i < 3 && i < cands.length; i++) bump(cands[i].playerId, i as 0 | 1 | 2);
  }

  const points = (t: Tally) => t.firsts * 7 + t.seconds * 4 + t.thirds * 2;

  const ids = [...tally.keys()];
  const players = await prisma.player.findMany({
    where: { id: { in: ids } },
    select: { id: true, slug: true, name: true, position: true, photoUrl: true, team: { select: { code: true, slug: true, logoUrl: true } } },
  });
  const pMap = new Map(players.map((p) => [p.id, p]));

  const rows = ids
    .map((id) => ({ p: pMap.get(id), t: tally.get(id)!, pts: points(tally.get(id)!) }))
    .filter((r) => r.p)
    .sort((a, b) => b.pts - a.pts || b.t.firsts - a.t.firsts || b.t.seconds - a.t.seconds)
    .slice(0, 100);

  return (
    <div className="space-y-6 py-2">
      <PageHeader
        title="Three Stars"
        subtitle={`Season-wide three-stars leaders — NHL ${SEASON} regular season`}
      />
      <p className="text-slate-400 text-sm">
        Stars are recomputed for every game (skaters &amp; starting goalies) and tallied across the season.
        Scoring: <span className="text-amber-400 font-medium">1st = 7 pts, 2nd = 4, 3rd = 2.</span> Top 100 shown.
      </p>

      {rows.length === 0 ? (
        <Card>
          <div className="p-8 text-center">
            <p className="text-slate-500 text-lg">No games played yet this season.</p>
          </div>
        </Card>
      ) : (
        <Card bodyClassName="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className={headRow}>
                  <th className={`${thBase} text-right w-12`}>#</th>
                  <th className={thBase}>Player</th>
                  <th className={thBase}>Team</th>
                  <th className={thBase}>Pos</th>
                  <th className={`${thBase} text-right`}>⭐ 1st</th>
                  <th className={`${thBase} text-right`}>2nd</th>
                  <th className={`${thBase} text-right`}>3rd</th>
                  <th className={`${thBase} text-right`}>Total Pts</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const p = r.p!;
                  return (
                    <tr key={p.id} className={bodyRow}>
                      <td className="px-4 py-3 text-right text-slate-500 font-semibold tabular-nums">{i + 1}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <PlayerAvatar src={p.photoUrl} alt={p.name} size={32} />
                          <Link href={`/players/${p.slug}`} className="font-medium hover:text-blue-400 transition-colors">
                            {cleanName(p.name)}
                          </Link>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {p.team ? (
                          <Link href={`/teams/${p.team.slug}`} className="flex items-center gap-2 hover:text-blue-400 transition-colors">
                            {p.team.logoUrl && <img src={p.team.logoUrl} alt={p.team.code ?? ""} className="w-5 h-5 object-contain" />}
                            <span className="font-medium">{p.team.code}</span>
                          </Link>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-400">{p.position}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-amber-400 font-semibold">{r.t.firsts}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-300">{r.t.seconds}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-400">{r.t.thirds}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-bold">{r.pts}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
