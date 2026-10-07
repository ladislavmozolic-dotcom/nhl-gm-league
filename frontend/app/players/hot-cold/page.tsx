import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui";
import { getLang } from "@/lib/lang-server";
import HotColdView, { type HotColdForm } from "@/components/HotColdView";

export const dynamic = "force-dynamic";

const SEASON = "2026-27";
const DAY = 24 * 60 * 60 * 1000;

const GAME_FILTER = { season: SEASON, league: "NHL", status: "FINAL", seriesId: null } as const;

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
  id: number;
  slug: string;
  name: string;
  position: string;
  photoUrl: string | null;
  team: { code: string | null; slug: string; logoUrl: string | null } | null;
};

export default async function HotColdPage() {
  const [lang, refRow] = await Promise.all([
    getLang(),
    prisma.game.findFirst({
      where: { ...GAME_FILTER, gameDate: { not: null } },
      orderBy: { gameDate: "desc" },
      select: { gameDate: true },
    }),
  ]);
  const isCs = lang === "cs";

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
    if (arr) arr.push(g);
    else games.set(s.playerId, [g]);
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
    for (let i = list.length - 1; i >= 0; i--) {
      if (list[i].goals >= 1) goalStreak++;
      else break;
    }
    let pointStreak = 0;
    for (let i = list.length - 1; i >= 0; i--) {
      if (list[i].points >= 1) pointStreak++;
      else break;
    }

    let thisWeek = 0;
    let thisMonth = 0;
    let thisYear = 0;
    let gamesLast14 = 0;
    let playedLast7 = false;
    for (const g of list) {
      thisYear += g.points;
      if (ref) {
        if (g.date >= weekStart && g.date <= refMs) {
          thisWeek += g.points;
          playedLast7 = true;
        }
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
    select: {
      id: true,
      slug: true,
      name: true,
      position: true,
      photoUrl: true,
      team: { select: { code: true, slug: true, logoUrl: true } },
    },
  });
  const pMap = new Map<number, Player>(players.map((p) => [p.id, p]));

  const skaterForms = [...forms.values()].filter((f) => pMap.has(f.id));

  const mapToForm = (f: Form): HotColdForm => {
    const p = pMap.get(f.id)!;
    return {
      ...f,
      name: p.name,
      slug: p.slug,
      position: p.position,
      photoUrl: p.photoUrl,
      teamCode: p.team?.code ?? null,
      teamSlug: p.team?.slug ?? null,
      teamLogoUrl: p.team?.logoUrl ?? null,
    };
  };

  const hot: HotColdForm[] = skaterForms
    .filter((f) => f.playedLast7)
    .sort((a, b) => b.pointStreak - a.pointStreak || b.thisWeek - a.thisWeek || b.thisMonth - a.thisMonth)
    .slice(0, 30)
    .map(mapToForm);

  const cold: HotColdForm[] = skaterForms
    .filter((f) => f.gamesLast14 >= 3 && f.thisWeek === 0)
    .sort((a, b) => a.thisWeek - b.thisWeek || b.gamesLast14 - a.gamesLast14 || b.gp - a.gp)
    .slice(0, 30)
    .map(mapToForm);

  const refLabel = ref
    ? ref.toLocaleDateString(isCs ? "sk-SK" : "en-US", { year: "numeric", month: "long", day: "numeric" })
    : "—";

  return (
    <div className="space-y-6 py-2">
      <PageHeader
        title={isCs ? "Horúci & Studení hráči" : "Hot & Cold Players"}
        subtitle={
          isCs
            ? `Aktuálna strelecká a bodová fazóna k ${refLabel} — NHL ${SEASON}`
            : `Scoring form as of ${refLabel} (latest completed game) — NHL ${SEASON}`
        }
      />

      <HotColdView
        hot={hot}
        cold={cold}
        refLabel={refLabel}
        season={SEASON}
        lang={lang}
      />
    </div>
  );
}
