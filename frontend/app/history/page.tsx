import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card } from "@/components/ui";
import { cleanName } from "@/lib/playerName";
import HistorySeasonTabs from "@/components/HistorySeasonTabs";
import HistoryNav from "@/components/HistoryNav";
import { ACTIVE_SEASON } from "@/lib/career-server";
import { PRE_SEASON, REGULAR_SEASON } from "@/lib/phase";

export const dynamic = "force-dynamic";

const REGULAR_AWARD_ORDER = ["Hart", "Art Ross", "Rocket Richard", "Norris", "Vezina", "Calder", "Selke", "Lady Byng", "Jack Adams"];
const PLAYOFF_AWARD_ORDER = ["Conn Smythe"];
const AWARD_LABEL: Record<string, string> = {
  Hart: "Hart (MVP)",
  "Art Ross": "Art Ross (Points)",
  "Rocket Richard": "Rocket Richard (Goals)",
  Norris: "Norris (Defense)",
  Vezina: "Vezina (Goalie)",
  Calder: "Calder (Rookie)",
  Selke: "Selke (Def. Fwd)",
  "Lady Byng": "Lady Byng",
  "Conn Smythe": "Conn Smythe (Playoffs)",
  "Jack Adams": "Jack Adams (Coach)",
};

type PreseasonTeamSummary = {
  id: number;
  name: string;
  code: string | null;
  slug: string | null;
  logoUrl: string | null;
  gp: number;
  w: number;
  l: number;
  otl: number;
  points: number;
};

export default async function HistoryPage() {
  const [
    archivedRecords,
    archivedAwards,
    archivedPreRecords,
    allTeams,
    preFinalGames,
    preSkaterStats,
    preGoalieStats,
  ] = await Promise.all([
    prisma.seasonRecord.findMany({ orderBy: { season: "desc" } }),
    prisma.seasonAward.findMany(),
    prisma.seasonPreseasonRecord.findMany(),
    prisma.team.findMany({
      select: { id: true, name: true, code: true, slug: true, logoUrl: true, league: true, isAffiliate: true, coach: true, gm: true },
    }),
    prisma.game.findMany({
      where: { season: PRE_SEASON, status: "FINAL" },
      select: {
        id: true,
        league: true,
        homeTeamId: true,
        awayTeamId: true,
        homeGoals: true,
        awayGoals: true,
        endedIn: true,
        winnerTeamId: true,
      },
    }),
    prisma.playerGameStat.findMany({
      where: { game: { season: PRE_SEASON, status: "FINAL" } },
      select: {
        playerId: true,
        teamId: true,
        goals: true,
        assists: true,
        points: true,
        game: { select: { league: true } },
      },
    }),
    prisma.goalieGameStat.findMany({
      where: { game: { season: PRE_SEASON, status: "FINAL" }, started: true },
      select: {
        playerId: true,
        teamId: true,
        saves: true,
        decision: true,
        goalsAgainst: true,
        game: { select: { league: true } },
      },
    }),
  ]);

  const teamMap = new Map(allTeams.map((t) => [t.id, t]));

  // Cache players from pre-season stats
  const prePlayerIds = [
    ...new Set([
      ...preSkaterStats.map((s) => s.playerId),
      ...preGoalieStats.map((g) => g.playerId),
      ...archivedAwards.map((a) => a.playerId).filter((id): id is number => id != null),
    ]),
  ];

  const players = prePlayerIds.length
    ? await prisma.player.findMany({
        where: { id: { in: prePlayerIds } },
        select: { id: true, name: true, slug: true, position: true, isGoalie: true, teamId: true },
      })
    : [];

  const playerMap = new Map(players.map((p) => [p.id, p]));

  // Helper: compute pre-season standings & top scorers from real DB games
  const computePreseasonStats = (league: "NHL" | "AHL") => {
    const leagueGames = preFinalGames.filter((g) => g.league === league);
    const leagueTeams = allTeams.filter((t) => (league === "AHL" ? t.isAffiliate : !t.isAffiliate));

    const teamAcc = new Map<number, PreseasonTeamSummary>();
    for (const t of leagueTeams) {
      teamAcc.set(t.id, {
        id: t.id,
        name: t.name,
        code: t.code,
        slug: t.slug,
        logoUrl: t.logoUrl,
        gp: 0,
        w: 0,
        l: 0,
        otl: 0,
        points: 0,
      });
    }

    for (const g of leagueGames) {
      const h = teamAcc.get(g.homeTeamId);
      const a = teamAcc.get(g.awayTeamId);
      const hg = g.homeGoals ?? 0;
      const ag = g.awayGoals ?? 0;
      const isOt = g.endedIn != null && g.endedIn !== "";

      if (h) {
        h.gp += 1;
        if (hg > ag) {
          h.w += 1;
          h.points += 2;
        } else if (isOt) {
          h.otl += 1;
          h.points += 1;
        } else {
          h.l += 1;
        }
      }

      if (a) {
        a.gp += 1;
        if (ag > hg) {
          a.w += 1;
          a.points += 2;
        } else if (isOt) {
          a.otl += 1;
          a.points += 1;
        } else {
          a.l += 1;
        }
      }
    }

    const sortedTeams = [...teamAcc.values()]
      .filter((t) => t.gp > 0)
      .sort((a, b) => b.points - a.points || b.w - a.w || a.l - b.l);

    const bestTeam = sortedTeams[0] ?? null;

    // Top Skater in Preseason
    const skAcc = new Map<number, { playerId: number; teamId: number | null; goals: number; assists: number; points: number; gp: number }>();
    for (const s of preSkaterStats) {
      if (s.game.league !== league) continue;
      if (!skAcc.has(s.playerId)) {
        skAcc.set(s.playerId, { playerId: s.playerId, teamId: s.teamId, goals: 0, assists: 0, points: 0, gp: 0 });
      }
      const acc = skAcc.get(s.playerId)!;
      acc.gp += 1;
      acc.goals += s.goals;
      acc.assists += s.assists;
      acc.points += s.points;
      if (s.teamId) acc.teamId = s.teamId;
    }

    const sortedSkaters = [...skAcc.values()]
      .filter((s) => s.points > 0 || s.goals > 0)
      .sort((a, b) => b.points - a.points || b.goals - a.goals);

    const topScorer = sortedSkaters[0] ?? null;
    const topScorerPlayer = topScorer ? playerMap.get(topScorer.playerId) : null;
    const topScorerTeam = topScorer?.teamId ? teamMap.get(topScorer.teamId) : null;

    // Top Goalie in Preseason
    const glAcc = new Map<number, { playerId: number; teamId: number | null; wins: number; saves: number; ga: number; shutouts: number; gp: number }>();
    for (const g of preGoalieStats) {
      if (g.game.league !== league) continue;
      if (!glAcc.has(g.playerId)) {
        glAcc.set(g.playerId, { playerId: g.playerId, teamId: g.teamId, wins: 0, saves: 0, ga: 0, shutouts: 0, gp: 0 });
      }
      const acc = glAcc.get(g.playerId)!;
      acc.gp += 1;
      acc.saves += g.saves;
      acc.ga += g.goalsAgainst;
      if (g.decision === "W") acc.wins += 1;
      if (g.goalsAgainst === 0) acc.shutouts += 1;
      if (g.teamId) acc.teamId = g.teamId;
    }

    const sortedGoalies = [...glAcc.values()]
      .filter((g) => g.gp > 0)
      .sort((a, b) => b.wins - a.wins || b.saves - a.saves);

    const topGoalie = sortedGoalies[0] ?? null;
    const topGoaliePlayer = topGoalie ? playerMap.get(topGoalie.playerId) : null;
    const topGoalieTeam = topGoalie?.teamId ? teamMap.get(topGoalie.teamId) : null;

    return {
      gamesPlayed: leagueGames.length,
      bestTeam,
      topScorer: topScorer ? { ...topScorer, player: topScorerPlayer, team: topScorerTeam } : null,
      topGoalie: topGoalie ? { ...topGoalie, player: topGoaliePlayer, team: topGoalieTeam } : null,
    };
  };

  const nhlPreStats = computePreseasonStats("NHL");
  const ahlPreStats = computePreseasonStats("AHL");

  const seasonsList = archivedRecords.length > 0
    ? [...new Set(archivedRecords.map((r) => r.season))].sort().reverse()
    : [ACTIVE_SEASON];

  const isCurrentFirstSeason = archivedRecords.length === 0;

  const AwardRow = ({ a }: { a: (typeof archivedAwards)[number] }) => {
    const p = a.playerId ? playerMap.get(a.playerId) : null;
    const name = p ? cleanName(p.name) : a.playerName ? cleanName(a.playerName) : "—";
    const team = a.teamId ? teamMap.get(a.teamId) : null;
    return (
      <div className="flex items-center justify-between gap-3 py-1.5 border-b border-slate-800/60 last:border-0">
        <span className="text-[11px] text-slate-400 w-40 shrink-0">{AWARD_LABEL[a.category] ?? a.category}</span>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {team?.logoUrl && <img src={team.logoUrl} alt="" className="w-4 h-4 object-contain shrink-0" />}
          {p ? (
            <Link href={`/players/${p.slug}`} className="text-sm font-semibold text-slate-100 hover:text-blue-400 truncate">{name}</Link>
          ) : (
            <span className="text-sm font-semibold text-slate-100 truncate">{name}</span>
          )}
        </div>
        <span className="text-xs text-amber-400/90 whitespace-nowrap">{a.detail}</span>
      </div>
    );
  };

  const LeagueBlock = ({ season, league }: { season: string; league: "NHL" | "AHL" }) => {
    const cupName = league === "AHL" ? "Calder Cup" : "Stanley Cup";
    const isLiveSeason = season === ACTIVE_SEASON && isCurrentFirstSeason;
    const preStats = league === "AHL" ? ahlPreStats : nhlPreStats;

    if (isLiveSeason) {
      // PRE-SEASON TAB (Live Real Data)
      const preContent = (
        <div className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2 p-3 rounded-xl bg-slate-800/40 border border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-green-400">Najlepší tím prípravy</span>
                {preStats.bestTeam && (
                  <span className="text-xs text-slate-400 font-semibold">({preStats.bestTeam.points} b · {preStats.bestTeam.w}-{preStats.bestTeam.l}-{preStats.bestTeam.otl})</span>
                )}
              </div>
              {preStats.bestTeam ? (
                <Link href={`/teams/${preStats.bestTeam.slug}`} className="flex items-center gap-2.5 group">
                  {preStats.bestTeam.logoUrl && <img src={preStats.bestTeam.logoUrl} alt="" className="w-7 h-7 object-contain" />}
                  <span className="text-sm font-bold text-white group-hover:text-blue-400">{preStats.bestTeam.name}</span>
                </Link>
              ) : (
                <span className="text-sm text-slate-500">Prípravné zápasy prebiehajú</span>
              )}
              <p className="text-xs text-slate-400">{preStats.gamesPlayed} odohraných zápasov v príprave.</p>
            </div>

            <div className="space-y-2 p-3 rounded-xl bg-slate-800/40 border border-slate-800">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">Líder bodovania prípravy</span>
              {preStats.topScorer && preStats.topScorer.player ? (
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    {preStats.topScorer.team?.logoUrl && <img src={preStats.topScorer.team.logoUrl} alt="" className="w-5 h-5 object-contain shrink-0" />}
                    <Link href={`/players/${preStats.topScorer.player.slug}`} className="text-sm font-bold text-slate-100 hover:text-blue-400 truncate">
                      {cleanName(preStats.topScorer.player.name)}
                    </Link>
                  </div>
                  <span className="text-xs font-bold text-amber-300 whitespace-nowrap bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded">
                    {preStats.topScorer.points} b ({preStats.topScorer.goals}G + {preStats.topScorer.assists}A)
                  </span>
                </div>
              ) : (
                <span className="text-sm text-slate-500">Zatiaľ žiadne body</span>
              )}

              {preStats.topGoalie && preStats.topGoalie.player && (
                <div className="flex items-center justify-between gap-3 pt-1 border-t border-slate-800">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Najlepší brankár:</span>
                    <Link href={`/players/${preStats.topGoalie.player.slug}`} className="text-xs font-semibold text-slate-200 hover:text-blue-400 truncate">
                      {cleanName(preStats.topGoalie.player.name)}
                    </Link>
                  </div>
                  <span className="text-[11px] font-semibold text-slate-300 whitespace-nowrap">
                    {preStats.topGoalie.wins} W · {preStats.topGoalie.saves} zákrokov
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      );

      // REGULAR SEASON TAB (Live Status)
      const regularContent = (
        <div className="p-4 rounded-xl bg-slate-800/30 border border-slate-800 text-center space-y-2">
          <p className="text-sm font-semibold text-slate-200">
            Základná časť sezóny {ACTIVE_SEASON} odštartuje po skončení prípravy (Pre-season).
          </p>
          <p className="text-xs text-slate-400">
            Po odohraní prvých zápasov základnej časti sa tu začnú v reálnom čase zobrazovať tabuľky, víťaz President&apos;s Trophy a nominácie na ligové ocenenia.
          </p>
        </div>
      );

      // PLAYOFFS TAB (Live Status)
      const playoffsContent = (
        <div className="p-4 rounded-xl bg-slate-800/30 border border-slate-800 text-center space-y-2">
          <p className="text-sm font-semibold text-slate-200">
            Play-off a súboje o {cupName} sezóny {ACTIVE_SEASON} začnú po ukončení základnej časti.
          </p>
          <p className="text-xs text-slate-400">
            Víťaz {cupName}u a ocenenie Conn Smythe Trophy budú zapísané do histórie po finálovej sérii.
          </p>
        </div>
      );

      return (
        <Card title={`${league} — ${cupName}`} accent={league === "AHL" ? "text-orange-400" : "text-blue-400"}>
          <HistorySeasonTabs pre={preContent} regular={regularContent} playoffs={playoffsContent} />
        </Card>
      );
    }

    // Historical archived season block
    const rec = archivedRecords.find((r) => r.season === season && r.league === league);
    const seasonAwards = archivedAwards.filter((a) => a.season === season && a.league === league);
    const regularAwards = seasonAwards.filter((a) => REGULAR_AWARD_ORDER.includes(a.category))
      .sort((a, b) => REGULAR_AWARD_ORDER.indexOf(a.category) - REGULAR_AWARD_ORDER.indexOf(b.category));
    const playoffAwards = seasonAwards.filter((a) => PLAYOFF_AWARD_ORDER.includes(a.category))
      .sort((a, b) => PLAYOFF_AWARD_ORDER.indexOf(a.category) - PLAYOFF_AWARD_ORDER.indexOf(b.category));
    const pre = archivedPreRecords.find((r) => r.season === season && r.league === league);

    const presTeam = rec?.presidentsTeamId ? teamMap.get(rec.presidentsTeamId) : null;
    const champTeam = rec?.championTeamId ? teamMap.get(rec.championTeamId) : null;
    const runnerTeam = rec?.runnerUpTeamId ? teamMap.get(rec.runnerUpTeamId) : null;
    const preTeam = pre?.bestTeamId ? teamMap.get(pre.bestTeamId) : null;

    const regularContent = (
      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider w-24 shrink-0 text-green-400">
              {league === "AHL" ? "Best record" : "President's"}
            </span>
            {presTeam ? (
              <Link href={`/teams/${presTeam.slug}`} className="flex items-center gap-2 group">
                {presTeam.logoUrl && <img src={presTeam.logoUrl} alt="" className="w-6 h-6 object-contain" />}
                <span className="text-sm font-semibold text-slate-200 group-hover:text-blue-400">{presTeam.name}</span>
              </Link>
            ) : <span className="text-sm text-slate-500">—</span>}
          </div>
        </div>
        <div>
          {regularAwards.length ? regularAwards.map((a) => <AwardRow key={a.id} a={a} />) : <p className="text-sm text-slate-500">Žiadne ocenenia nezaznamenané.</p>}
        </div>
      </div>
    );

    const playoffsContent = (
      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider w-24 shrink-0 text-amber-400">Champion</span>
            {champTeam ? (
              <Link href={`/teams/${champTeam.slug}`} className="flex items-center gap-2 group">
                {champTeam.logoUrl && <img src={champTeam.logoUrl} alt="" className="w-6 h-6 object-contain" />}
                <span className="text-sm font-semibold text-slate-200 group-hover:text-blue-400">{champTeam.name}</span>
              </Link>
            ) : <span className="text-sm text-slate-500">—</span>}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider w-24 shrink-0 text-slate-400">Runner-up</span>
            {runnerTeam ? (
              <Link href={`/teams/${runnerTeam.slug}`} className="flex items-center gap-2 group">
                {runnerTeam.logoUrl && <img src={runnerTeam.logoUrl} alt="" className="w-6 h-6 object-contain" />}
                <span className="text-sm font-semibold text-slate-200 group-hover:text-blue-400">{runnerTeam.name}</span>
              </Link>
            ) : <span className="text-sm text-slate-500">—</span>}
          </div>
        </div>
        <div>
          {playoffAwards.length ? playoffAwards.map((a) => <AwardRow key={a.id} a={a} />) : <p className="text-sm text-slate-500">Play-off ocenenia sa zapíšu po finále.</p>}
        </div>
      </div>
    );

    const preContent = pre ? (
      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider w-24 shrink-0 text-green-400">Best record</span>
            {preTeam ? (
              <Link href={`/teams/${preTeam.slug}`} className="flex items-center gap-2 group">
                {preTeam.logoUrl && <img src={preTeam.logoUrl} alt="" className="w-6 h-6 object-contain" />}
                <span className="text-sm font-semibold text-slate-200 group-hover:text-blue-400">{preTeam.name}</span>
              </Link>
            ) : <span className="text-sm text-slate-500">—</span>}
          </div>
          <p className="text-xs text-slate-500">{pre.gamesPlayed} odohraných prípravných zápasov.</p>
        </div>
        <div>
          <div className="flex items-center justify-between gap-3 py-1.5">
            <span className="text-[11px] text-slate-400 w-40 shrink-0">Top scorer</span>
            <div className="flex-1 min-w-0">
              <span className="text-sm font-semibold text-slate-100 truncate">{pre.topScorerName ? cleanName(pre.topScorerName) : "—"}</span>
            </div>
            <span className="text-xs text-amber-400/90 whitespace-nowrap">{pre.topScorerPoints ?? 0} pts</span>
          </div>
        </div>
      </div>
    ) : (
      <p className="text-sm text-slate-500">Žiadne záznamy z prípravy.</p>
    );

    return (
      <Card title={`${league} — ${cupName}`} accent={league === "AHL" ? "text-orange-400" : "text-blue-400"}>
        <HistorySeasonTabs pre={preContent} regular={regularContent} playoffs={playoffsContent} />
      </Card>
    );
  };

  return (
    <div className="space-y-6 py-2">
      <PageHeader title="História ligy" subtitle="Príprava, základná časť a play-off uNHL & uAHL archivované po sezónach." />
      <HistoryNav active="history" />

      {isCurrentFirstSeason && (
        <div className="bg-gradient-to-r from-blue-950/40 via-indigo-950/30 to-slate-900 border border-blue-800/40 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-500 text-white uppercase tracking-wider">Úvodný ročník</span>
              <span className="text-sm font-bold text-white">Prebieha 1. sezóna {ACTIVE_SEASON}</span>
            </div>
            <p className="text-xs text-slate-300">
              Aktuálne prebiehajú zápasy <strong>Prípravy (Pre-season)</strong>. Po ich skončení nadviaže <strong>Základná časť</strong> a <strong>Play-off</strong>.
            </p>
          </div>
          <Link
            href="/history/records"
            className="shrink-0 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-sm shadow-blue-500/20"
          >
            📜 Zobraziť rekordy ligy
          </Link>
        </div>
      )}

      {seasonsList.map((season) => (
        <div key={season} className="space-y-3">
          <h2 className="text-lg font-black tracking-tight text-white flex items-center gap-3">
            <span className="text-2xl">🏆</span> {season} {isCurrentFirstSeason && <span className="text-xs font-normal text-amber-400/90 border border-amber-500/30 px-2 py-0.5 rounded-full bg-amber-500/10">Prebiehajúca sezóna</span>}
          </h2>
          <div className="grid gap-4">
            <LeagueBlock season={season} league="NHL" />
            <LeagueBlock season={season} league="AHL" />
          </div>
        </div>
      ))}
    </div>
  );
}
