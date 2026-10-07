import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getTeamSession } from "@/lib/auth";
import StatsTabs from "@/components/StatsTabs";
import StatHeroDeck, { type HeroCardItem } from "@/components/StatHeroDeck";
import StatTable, { type Col } from "@/components/StatTable";
import { PageHeader } from "@/components/ui";
import { careerLeaderboard } from "@/lib/career-server";
import { getLang } from "@/lib/lang-server";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

// League-wide career totals: every finished season from the frozen archive
// (PlayerSeasonStat / GoalieSeasonStat) + the active season live. Only games
// played in OUR league count — not a player's real-life NHL history.
const SKATER_COLS: Col[] = [
  { key: "name", label: "Player", title: "Player Name", frozen: true, link: true },
  { key: "teamCode", label: "Team", title: "Current team", team: true },
  { key: "pos", label: "Pos", title: "Position" },
  { key: "seasons", label: "Szn", title: "Seasons played in the league", num: true },
  { key: "gp", label: "GP", title: "Games Played", num: true },
  { key: "goals", label: "G", title: "Goals", num: true },
  { key: "assists", label: "A", title: "Assists", num: true },
  { key: "points", label: "P", title: "Points", num: true },
  { key: "ppg", label: "P/GP", title: "Points per game", num: true, format: "dec2" },
  { key: "plusMinus", label: "+/-", title: "Plus / Minus", num: true, format: "plusMinus" },
  { key: "pim", label: "PIM", title: "Penalty Minutes", num: true },
  { key: "shots", label: "S", title: "Shots", num: true },
  { key: "ppGoals", label: "PPG", title: "Power-Play Goals", num: true, defaultHidden: true },
  { key: "shGoals", label: "SHG", title: "Short-Handed Goals", num: true, defaultHidden: true },
  { key: "gwg", label: "GWG", title: "Game-Winning Goals", num: true, defaultHidden: true },
  { key: "hits", label: "HIT", title: "Hits", num: true, defaultHidden: true },
  { key: "blocks", label: "BLK", title: "Blocked Shots", num: true, defaultHidden: true },
];

const GOALIE_COLS: Col[] = [
  { key: "name", label: "Goalie", title: "Goalie Name", frozen: true, link: true },
  { key: "teamCode", label: "Team", title: "Current team", team: true },
  { key: "seasons", label: "Szn", title: "Seasons played in the league", num: true },
  { key: "gp", label: "GS", title: "Games Started", num: true },
  { key: "wins", label: "W", title: "Wins", num: true },
  { key: "losses", label: "L", title: "Losses", num: true },
  { key: "otl", label: "OTL", title: "Overtime / Shootout Losses", num: true },
  { key: "shutouts", label: "SO", title: "Shutouts", num: true },
  { key: "svPct", label: "SV%", title: "Save Percentage", num: true, format: "pct3" },
  { key: "gaa", label: "GAA", title: "Goals-Against Average", num: true, format: "dec2" },
  { key: "shotsAgainst", label: "SA", title: "Shots Against", num: true, defaultHidden: true },
  { key: "goalsAgainst", label: "GA", title: "Goals Against", num: true, defaultHidden: true },
];

export default async function CareerStatsPage({ searchParams }: { searchParams: Promise<{ league?: string; type?: string; phase?: string }> }) {
  const lang = await getLang();
  const sp = await searchParams;
  const league = sp.league === "AHL" ? "AHL" : "NHL";
  const type = sp.type === "goalies" ? "goalies" : "skaters";
  const playoffs = sp.phase === "playoffs";

  const sessionTeamId = await getTeamSession();
  const [data, managedTeams] = await Promise.all([
    careerLeaderboard(league, playoffs),
    sessionTeamId == null
      ? Promise.resolve([])
      : prisma.team.findMany({ where: { OR: [{ id: sessionTeamId }, { parentTeamId: sessionTeamId }] }, select: { id: true } }),
  ]);
  const managedTeamIds = new Set(managedTeams.map((t) => t.id));
  const { skaters, goalies } = data;

  const qs = (over: Record<string, string>) => {
    const q = new URLSearchParams({ ...(league === "AHL" ? { league } : {}), type, ...(playoffs ? { phase: "playoffs" } : {}), ...over });
    for (const [k, v] of [...q.entries()]) if (!v) q.delete(k);
    return `/stats/career?${q.toString()}`;
  };
  const pill = (active: boolean) =>
    `px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${
      active
        ? "bg-blue-600 border-blue-500 text-white shadow-md shadow-blue-500/20"
        : "bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800/60"
    }`;

  let heroCards: HeroCardItem[] = [];
  if (type === "skaters" && skaters.length > 0) {
    const ptsLeader = [...skaters].sort((a, b) => b.points - a.points)[0];
    const goalsLeader = [...skaters].sort((a, b) => b.goals - a.goals)[0];
    const gpLeader = [...skaters].sort((a, b) => b.gp - a.gp)[0];

    if (ptsLeader) {
      heroCards.push({
        badge: t(lang, "stats.badge.allTimeScorer"),
        subBadge: t(lang, "stats.subBadge.allTimePoints"),
        playerId: ptsLeader.playerId,
        slug: ptsLeader.slug,
        name: ptsLeader.name,
        photoUrl: ptsLeader.photoUrl,
        position: ptsLeader.position,
        teamId: ptsLeader.teamId,
        teamCode: ptsLeader.teamCode,
        teamSlug: ptsLeader.teamSlug,
        teamLogo: ptsLeader.teamLogo,
        value: ptsLeader.points,
        unit: "PTS",
        sub: `${ptsLeader.goals} G · ${ptsLeader.assists} A (${ptsLeader.gp} GP)`,
        accentColor: "amber",
      });
    }
    if (goalsLeader) {
      heroCards.push({
        badge: t(lang, "stats.badge.allTimeSniper"),
        subBadge: t(lang, "stats.subBadge.allTimeGoals"),
        playerId: goalsLeader.playerId,
        slug: goalsLeader.slug,
        name: goalsLeader.name,
        photoUrl: goalsLeader.photoUrl,
        position: goalsLeader.position,
        teamId: goalsLeader.teamId,
        teamCode: goalsLeader.teamCode,
        teamSlug: goalsLeader.teamSlug,
        teamLogo: goalsLeader.teamLogo,
        value: goalsLeader.goals,
        unit: "G",
        sub: `${goalsLeader.points} PTS (${goalsLeader.gp} GP)`,
        accentColor: "rose",
      });
    }
    if (gpLeader) {
      heroCards.push({
        badge: t(lang, "stats.badge.ironMan"),
        subBadge: t(lang, "stats.subBadge.mostGames"),
        playerId: gpLeader.playerId,
        slug: gpLeader.slug,
        name: gpLeader.name,
        photoUrl: gpLeader.photoUrl,
        position: gpLeader.position,
        teamId: gpLeader.teamId,
        teamCode: gpLeader.teamCode,
        teamSlug: gpLeader.teamSlug,
        teamLogo: gpLeader.teamLogo,
        value: gpLeader.gp,
        unit: "GP",
        sub: `${gpLeader.seasons} ${t(lang, "stats.career.seasonsPlayed")}`,
        accentColor: "sky",
      });
    }
  } else if (type === "goalies" && goalies.length > 0) {
    const winsLeader = [...goalies].sort((a, b) => b.wins - a.wins)[0];
    const soLeader = [...goalies].sort((a, b) => b.shutouts - a.shutouts)[0];
    const gpLeader = [...goalies].sort((a, b) => b.gp - a.gp)[0];

    if (winsLeader) {
      heroCards.push({
        badge: t(lang, "stats.badge.allTimeWins"),
        subBadge: t(lang, "stats.subBadge.allTimeWins"),
        playerId: winsLeader.playerId,
        slug: winsLeader.slug,
        name: winsLeader.name,
        photoUrl: winsLeader.photoUrl,
        position: "G",
        teamId: winsLeader.teamId,
        teamCode: winsLeader.teamCode,
        teamSlug: winsLeader.teamSlug,
        teamLogo: winsLeader.teamLogo,
        value: winsLeader.wins,
        unit: "W",
        sub: `${winsLeader.wins}-${winsLeader.losses}-${winsLeader.otl} (${winsLeader.gp} GP)`,
        accentColor: "amber",
      });
    }
    if (soLeader) {
      heroCards.push({
        badge: t(lang, "stats.badge.allTimeShutouts"),
        subBadge: t(lang, "stats.subBadge.shutouts"),
        playerId: soLeader.playerId,
        slug: soLeader.slug,
        name: soLeader.name,
        photoUrl: soLeader.photoUrl,
        position: "G",
        teamId: soLeader.teamId,
        teamCode: soLeader.teamCode,
        teamSlug: soLeader.teamSlug,
        teamLogo: soLeader.teamLogo,
        value: soLeader.shutouts,
        unit: "SO",
        sub: `${soLeader.gp} ${t(lang, "stats.career.gamesPlayed")}`,
        accentColor: "emerald",
      });
    }
    if (gpLeader) {
      heroCards.push({
        badge: t(lang, "stats.badge.ironGoalie"),
        subBadge: t(lang, "stats.subBadge.mostStarts"),
        playerId: gpLeader.playerId,
        slug: gpLeader.slug,
        name: gpLeader.name,
        photoUrl: gpLeader.photoUrl,
        position: "G",
        teamId: gpLeader.teamId,
        teamCode: gpLeader.teamCode,
        teamSlug: gpLeader.teamSlug,
        teamLogo: gpLeader.teamLogo,
        value: gpLeader.gp,
        unit: "GS",
        sub: `${gpLeader.seasons} ${t(lang, "stats.career.seasonsPlayedGoalie")}`,
        accentColor: "sky",
      });
    }
  }

  const skaterRows = skaters.map((s) => ({
    _pid: s.playerId, _slug: s.slug, name: s.name, teamCode: s.teamCode ?? "—", _teamSlug: s.teamSlug ?? "", _teamLogo: s.teamLogo ?? "", pos: s.position,
    seasons: s.seasons, gp: s.gp, goals: s.goals, assists: s.assists, points: s.points, ppg: s.gp ? s.points / s.gp : 0,
    plusMinus: s.plusMinus, pim: s.pim, shots: s.shots, ppGoals: s.ppGoals, shGoals: s.shGoals, gwg: s.gwg, hits: s.hits, blocks: s.blocks,
  }));
  const goalieRows = goalies.map((g) => ({
    _pid: g.playerId, _slug: g.slug, name: g.name, teamCode: g.teamCode ?? "—", _teamSlug: g.teamSlug ?? "", _teamLogo: g.teamLogo ?? "",
    seasons: g.seasons, gp: g.gp, wins: g.wins, losses: g.losses, otl: g.otl, shutouts: g.shutouts, svPct: g.svPct, gaa: g.gaa,
    shotsAgainst: g.shotsAgainst, goalsAgainst: g.goalsAgainst,
  }));

  return (
    <div className="space-y-6 py-2">
      <PageHeader
        title="Statistics"
        subtitle={`${t(lang, "stats.career.subtitle")} — ${league} ${playoffs ? t(lang, "phase.playoffs").toLowerCase() : t(lang, "phase.regular").toLowerCase()}`}
      />
      <StatsTabs active="career" league={league} />

      <div className="flex flex-wrap gap-2">
        <Link href={qs({ type: "skaters" })} className={pill(type === "skaters")}>{t(lang, "stats.career.skaters")}</Link>
        <Link href={qs({ type: "goalies" })} className={pill(type === "goalies")}>{t(lang, "stats.career.goalies")}</Link>
        <span className="w-px bg-slate-800 mx-1" />
        <Link href={qs({ phase: "" })} className={pill(!playoffs)}>{t(lang, "stats.career.regularSeason")}</Link>
        <Link href={qs({ phase: "playoffs" })} className={pill(playoffs)}>{t(lang, "stats.career.playoffs")}</Link>
      </div>

      {/* Hero Spotlight Cards */}
      {heroCards.length > 0 && (
        <StatHeroDeck cards={heroCards} managedTeamIds={managedTeamIds} />
      )}

      <p className="text-slate-400 text-sm">
        {t(lang, "stats.career.note")}
      </p>

      {type === "skaters"
        ? <StatTable cols={SKATER_COLS} rows={skaterRows} initialSort="points" minWidth={900} showRank />
        : <StatTable cols={GOALIE_COLS} rows={goalieRows} initialSort="wins" minWidth={760} showRank />}
    </div>
  );
}
