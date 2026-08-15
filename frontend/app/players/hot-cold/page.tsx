import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { cleanName } from "@/lib/playerName";
import PlayerAvatar from "@/components/playerAvatar";
import { PageHeader, Card, SectionTitle } from "@/components/ui";

export const dynamic = "force-dynamic";

const SEASON = "2026-27";
const DAY = 24 * 60 * 60 * 1000;

const GAME_FILTER = { season: SEASON, league: "NHL", status: "FINAL", seriesId: null } as const;

const thBase = "text-left font-medium px-4 py-3";
const headRow = "bg-slate-800/30 border-b border-slate-800 text-slate-500 text-xs uppercase tracking-wider";
const bodyRow = "border-b border-slate-800/40 hover:bg-slate-800/30 transition-colors last:border-0";

type Game = { date: number; goals: number; points: number };
type Form = {
  id: number;
  goalStreak: number;
  pointStreak: number;
  thisWeek: number;
  thisMonth: number;
  thisYear: number;
  gp: number;
  playedLast7: boolean;
  gamesLast14: number;
};
type Player = {
  id: number; slug: string; name: string; position: string; photoUrl: string | null;
  team: { code: string | null; slug: string; logoUrl: string | null } | null;
};

export default async function HotColdPage() {
  // "Now" = the latest completed game's date, not the wall clock.
  const refRow = await prisma.game.findFirst({
    where: { ...GAME_FILTER, gameDate: { not: null } },
    orderBy: { gameDate: "desc" },
    select: { gameDate: true },
  });
  const ref = refRow?.gameDate ?? null;

  const stats = await prisma.playerGameStat.findMany({
    where: { game: GAME_FILTER },
    select: { playerId: true, goals: true, points: true, game: { select: { gameDate: true } } },
  });

  // Group box lines per player.
  const games = new Map<number, Game[]>();
  for (const s of stats) {
    const d = s.game.gameDate ? s.game.gameDate.getTime() : 0;
    const arr = games.get(s.playerId);
    const g = { date: d, goals: s.goals, points: s.points };
    if (arr) arr.push(g); else games.set(s.playerId, [g]);
  }

  const refMs = ref ? ref.getTime() : 0;
  const weekStart = refMs - 7 * DAY;
  const twoWeekStart = refMs - 14 * DAY;
  const refYear = ref?.getFullYear();
  const refMonth = ref?.getMonth();

  const forms = new Map<number, Form>();
  for (const [id, list] of games) {
    list.sort((a, b) => a.date - b.date); // oldest -> newest

    // Streaks over the most recent games.
    let goalStreak = 0;
    for (let i = list.length - 1; i >= 0; i--) { if (list[i].goals >= 1) goalStreak++; else break; }
    let pointStreak = 0;
    for (let i = list.length - 1; i >= 0; i--) { if (list[i].points >= 1) pointStreak++; else break; }

    let thisWeek = 0, thisMonth = 0, thisYear = 0, gamesLast14 = 0, playedLast7 = false;
    for (const g of list) {
      thisYear += g.points;
      if (ref) {
        if (g.date >= weekStart && g.date <= refMs) { thisWeek += g.points; playedLast7 = true; }
        if (g.date >= twoWeekStart && g.date <= refMs) gamesLast14++;
        const gd = new Date(g.date);
        if (gd.getFullYear() === refYear && gd.getMonth() === refMonth) thisMonth += g.points;
      }
    }
    forms.set(id, { id, goalStreak, pointStreak, thisWeek, thisMonth, thisYear, gp: list.length, playedLast7, gamesLast14 });
  }

  // Skaters only.
  const players = await prisma.player.findMany({
    where: { id: { in: [...forms.keys()] }, isGoalie: false },
    select: { id: true, slug: true, name: true, position: true, photoUrl: true, team: { select: { code: true, slug: true, logoUrl: true } } },
  });
  const pMap = new Map<number, Player>(players.map((p) => [p.id, p]));

  const skaterForms = [...forms.values()].filter((f) => pMap.has(f.id));

  const hot = skaterForms
    .filter((f) => f.playedLast7)
    .sort((a, b) => b.pointStreak - a.pointStreak || b.thisWeek - a.thisWeek || b.thisMonth - a.thisMonth)
    .slice(0, 25);

  const cold = skaterForms
    .filter((f) => f.gamesLast14 >= 3 && f.thisWeek === 0)
    .sort((a, b) => a.thisWeek - b.thisWeek || b.gamesLast14 - a.gamesLast14 || b.gp - a.gp)
    .slice(0, 25);

  const refLabel = ref
    ? ref.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : "—";

  const Table = ({ forms: rows, tone }: { forms: Form[]; tone: "hot" | "cold" }) => {
    const streakColor = tone === "hot" ? "text-amber-400" : "text-blue-400";
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className={headRow}>
              <th className={thBase}>Player</th>
              <th className={thBase}>Team</th>
              <th className={thBase}>Pos</th>
              <th className={`${thBase} text-right`}>Goal Streak</th>
              <th className={`${thBase} text-right`}>Point Streak</th>
              <th className={`${thBase} text-right`}>This Week</th>
              <th className={`${thBase} text-right`}>This Month</th>
              <th className={`${thBase} text-right`}>This Year</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((f) => {
              const p = pMap.get(f.id)!;
              return (
                <tr key={f.id} className={bodyRow}>
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
                  <td className={`px-4 py-3 text-right tabular-nums font-semibold ${f.goalStreak > 0 ? streakColor : "text-slate-500"}`}>{f.goalStreak}</td>
                  <td className={`px-4 py-3 text-right tabular-nums font-semibold ${f.pointStreak > 0 ? streakColor : "text-slate-500"}`}>{f.pointStreak}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-bold">{f.thisWeek}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-300">{f.thisMonth}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-400">{f.thisYear}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="space-y-6 py-2">
      <PageHeader
        title="Hot &amp; Cold"
        subtitle={`Scoring form as of ${refLabel} (latest completed game) — NHL ${SEASON} regular season`}
      />

      <div className="space-y-3">
        <SectionTitle accent="text-amber-400">🔥 Hot — riding a scoring streak</SectionTitle>
        {hot.length === 0 ? (
          <Card><div className="p-8 text-center"><p className="text-slate-500">No recent games to rank.</p></div></Card>
        ) : (
          <Card bodyClassName="p-0"><Table forms={hot} tone="hot" /></Card>
        )}
      </div>

      <div className="space-y-3">
        <SectionTitle accent="text-blue-400">🧊 Cold — pointless of late (3+ games in last 14, 0 pts this week)</SectionTitle>
        {cold.length === 0 ? (
          <Card><div className="p-8 text-center"><p className="text-slate-500">Nobody's gone cold — everyone active is on the board.</p></div></Card>
        ) : (
          <Card bodyClassName="p-0"><Table forms={cold} tone="cold" /></Card>
        )}
      </div>
    </div>
  );
}
