import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card } from "@/components/ui";
import { cleanName } from "@/lib/playerName";
import HistorySeasonTabs from "@/components/HistorySeasonTabs";
import HistoryNav from "@/components/HistoryNav";
import { ACTIVE_SEASON } from "@/lib/career-server";
import { computeSeasonFinalists } from "@/lib/awards";

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

export default async function HistoryPage() {
  const [records, awards, preRecords, teams, topPlayers, topGoalies] = await Promise.all([
    prisma.seasonRecord.findMany(),
    prisma.seasonAward.findMany(),
    prisma.seasonPreseasonRecord.findMany(),
    prisma.team.findMany({ select: { id: true, name: true, slug: true, logoUrl: true, league: true, isAffiliate: true, coach: true, gm: true } }),
    prisma.player.findMany({
      where: { isGoalie: false },
      orderBy: { overall: "desc" },
      take: 20,
      select: { id: true, name: true, slug: true, position: true, overall: true, teamId: true },
    }),
    prisma.player.findMany({
      where: { isGoalie: true },
      orderBy: { overall: "desc" },
      take: 10,
      select: { id: true, name: true, slug: true, position: true, overall: true, teamId: true },
    }),
  ]);

  const teamMap = new Map(teams.map((t) => [t.id, t]));
  const isFreshLeague = records.length === 0;

  const nhlTeams = teams.filter((t) => !t.isAffiliate);
  const ahlTeams = teams.filter((t) => t.isAffiliate);

  let activeRecords = records;
  let activeAwards = awards;
  let activePreRecords = preRecords;

  if (isFreshLeague) {
    activeRecords = [
      {
        id: 1,
        season: ACTIVE_SEASON,
        league: "NHL",
        presidentsTeamId: nhlTeams[0]?.id ?? null,
        championTeamId: nhlTeams[0]?.id ?? null,
        runnerUpTeamId: nhlTeams[1]?.id ?? null,
        createdAt: new Date(),
      },
      {
        id: 2,
        season: ACTIVE_SEASON,
        league: "AHL",
        presidentsTeamId: ahlTeams[0]?.id ?? null,
        championTeamId: ahlTeams[0]?.id ?? null,
        runnerUpTeamId: ahlTeams[1]?.id ?? null,
        createdAt: new Date(),
      },
    ];

    const dmen = topPlayers.filter((p) => p.position.includes("D"));
    const fwds = topPlayers.filter((p) => !p.position.includes("D") && p.position !== "G");
    const topG = topGoalies[0];
    const topD = dmen[0] ?? topPlayers[1];
    const topF = fwds[0] ?? topPlayers[0];
    const fwd2 = fwds[1] ?? topPlayers[2];
    const fwd3 = fwds[2] ?? topPlayers[3];

    activeAwards = [
      // NHL awards preview
      { id: 101, season: ACTIVE_SEASON, league: "NHL", category: "Hart", playerId: topF?.id ?? null, playerName: topF?.name ?? "Connor McDavid", teamId: topF?.teamId ?? nhlTeams[0]?.id, detail: "138 pts (Priebežne)" },
      { id: 102, season: ACTIVE_SEASON, league: "NHL", category: "Art Ross", playerId: topF?.id ?? null, playerName: topF?.name ?? "Connor McDavid", teamId: topF?.teamId ?? nhlTeams[0]?.id, detail: "138 pts" },
      { id: 103, season: ACTIVE_SEASON, league: "NHL", category: "Rocket Richard", playerId: fwd2?.id ?? null, playerName: fwd2?.name ?? "Auston Matthews", teamId: fwd2?.teamId ?? nhlTeams[1]?.id, detail: "62 G" },
      { id: 104, season: ACTIVE_SEASON, league: "NHL", category: "Norris", playerId: topD?.id ?? null, playerName: topD?.name ?? "Cale Makar", teamId: topD?.teamId ?? nhlTeams[2]?.id, detail: "92 pts, +34" },
      { id: 105, season: ACTIVE_SEASON, league: "NHL", category: "Vezina", playerId: topG?.id ?? null, playerName: topG?.name ?? "Igor Shesterkin", teamId: topG?.teamId ?? nhlTeams[0]?.id, detail: "92.8% SV%, 2.15 GAA" },
      { id: 106, season: ACTIVE_SEASON, league: "NHL", category: "Calder", playerId: fwd3?.id ?? null, playerName: fwd3?.name ?? "Macklin Celebrini", teamId: fwd3?.teamId ?? nhlTeams[3]?.id, detail: "74 pts" },
      { id: 107, season: ACTIVE_SEASON, league: "NHL", category: "Selke", playerId: topF?.id ?? null, playerName: topF?.name ?? "Aleksander Barkov", teamId: topF?.teamId ?? nhlTeams[0]?.id, detail: "+38, 4 SHG, 98 BLK" },
      { id: 108, season: ACTIVE_SEASON, league: "NHL", category: "Lady Byng", playerId: topD?.id ?? null, playerName: topD?.name ?? "Jaccob Slavin", teamId: topD?.teamId ?? nhlTeams[1]?.id, detail: "54 pts, 6 PIM" },
      { id: 109, season: ACTIVE_SEASON, league: "NHL", category: "Jack Adams", playerId: null, playerName: nhlTeams[0]?.coach || "Hlavný tréner", teamId: nhlTeams[0]?.id ?? null, detail: "118 pts · Best record" },
      { id: 110, season: ACTIVE_SEASON, league: "NHL", category: "Conn Smythe", playerId: topF?.id ?? null, playerName: topF?.name ?? "Nathan MacKinnon", teamId: topF?.teamId ?? nhlTeams[0]?.id, detail: "32 pts (22 GP)" },

      // AHL awards preview
      { id: 201, season: ACTIVE_SEASON, league: "AHL", category: "Hart", playerId: topPlayers[4]?.id ?? null, playerName: topPlayers[4]?.name ?? "AHL Top Scorer", teamId: ahlTeams[0]?.id ?? null, detail: "96 pts" },
      { id: 202, season: ACTIVE_SEASON, league: "AHL", category: "Art Ross", playerId: topPlayers[4]?.id ?? null, playerName: topPlayers[4]?.name ?? "AHL Top Scorer", teamId: ahlTeams[0]?.id ?? null, detail: "96 pts" },
      { id: 203, season: ACTIVE_SEASON, league: "AHL", category: "Rocket Richard", playerId: topPlayers[5]?.id ?? null, playerName: topPlayers[5]?.name ?? "AHL Top Sniper", teamId: ahlTeams[1]?.id ?? null, detail: "44 G" },
      { id: 204, season: ACTIVE_SEASON, league: "AHL", category: "Norris", playerId: dmen[1]?.id ?? null, playerName: dmen[1]?.name ?? "AHL Top Defenseman", teamId: ahlTeams[0]?.id ?? null, detail: "68 pts" },
      { id: 205, season: ACTIVE_SEASON, league: "AHL", category: "Vezina", playerId: topGoalies[1]?.id ?? null, playerName: topGoalies[1]?.name ?? "AHL Top Goalie", teamId: ahlTeams[0]?.id ?? null, detail: "92.4% SV%, 2.20 GAA" },
      { id: 206, season: ACTIVE_SEASON, league: "AHL", category: "Calder", playerId: topPlayers[6]?.id ?? null, playerName: topPlayers[6]?.name ?? "AHL Top Rookie", teamId: ahlTeams[2]?.id ?? null, detail: "62 pts" },
      { id: 207, season: ACTIVE_SEASON, league: "AHL", category: "Selke", playerId: topPlayers[7]?.id ?? null, playerName: topPlayers[7]?.name ?? "AHL Def Forward", teamId: ahlTeams[1]?.id ?? null, detail: "+26, 3 SHG" },
      { id: 208, season: ACTIVE_SEASON, league: "AHL", category: "Lady Byng", playerId: topPlayers[8]?.id ?? null, playerName: topPlayers[8]?.name ?? "AHL Gentleman", teamId: ahlTeams[0]?.id ?? null, detail: "58 pts, 8 PIM" },
      { id: 209, season: ACTIVE_SEASON, league: "AHL", category: "Jack Adams", playerId: null, playerName: ahlTeams[0]?.coach || "Tréner farmy", teamId: ahlTeams[0]?.id ?? null, detail: "Best farm record" },
      { id: 210, season: ACTIVE_SEASON, league: "AHL", category: "Conn Smythe", playerId: topPlayers[4]?.id ?? null, playerName: topPlayers[4]?.name ?? "AHL Playoff MVP", teamId: ahlTeams[0]?.id ?? null, detail: "26 pts (19 GP)" },
    ];

    activePreRecords = [
      {
        id: 1,
        season: ACTIVE_SEASON,
        league: "NHL",
        gamesPlayed: 18,
        bestTeamId: nhlTeams[0]?.id ?? null,
        topScorerId: topF?.id ?? null,
        topScorerName: topF?.name ?? "Connor McDavid",
        topScorerPoints: 9,
        createdAt: new Date(),
      },
      {
        id: 2,
        season: ACTIVE_SEASON,
        league: "AHL",
        gamesPlayed: 12,
        bestTeamId: ahlTeams[0]?.id ?? null,
        topScorerId: topPlayers[4]?.id ?? null,
        topScorerName: topPlayers[4]?.name ?? "AHL Top Scorer",
        topScorerPoints: 7,
        createdAt: new Date(),
      },
    ];
  }

  const pids = [...new Set([
    ...activeAwards.map((a) => a.playerId),
    ...activePreRecords.map((r) => r.topScorerId),
  ].filter((x): x is number => !!x))];

  const pRows = pids.length
    ? await prisma.player.findMany({ where: { id: { in: pids } }, select: { id: true, name: true, slug: true } })
    : [];
  const playerMap = new Map(pRows.map((p) => [p.id, p]));

  const seasons = [...new Set(activeRecords.map((r) => r.season))].sort().reverse();

  const TeamChip = ({ id, label, tone }: { id: number | null; label: string; tone: string }) => {
    const t = id ? teamMap.get(id) : null;
    return (
      <div className="flex items-center gap-2">
        <span className={`text-[10px] font-bold uppercase tracking-wider w-24 shrink-0 ${tone}`}>{label}</span>
        {t ? (
          <Link href={`/teams/${t.slug}`} className="flex items-center gap-2 group">
            {t.logoUrl && <img src={t.logoUrl} alt="" className="w-6 h-6 object-contain" />}
            <span className="text-sm font-semibold text-slate-200 group-hover:text-blue-400">{t.name}</span>
          </Link>
        ) : (
          <span className="text-sm text-slate-500">—</span>
        )}
      </div>
    );
  };

  const AwardRow = ({ a }: { a: (typeof activeAwards)[number] }) => {
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

  const LeagueBlock = ({ season, league }: { season: string; league: string }) => {
    const rec = activeRecords.find((r) => r.season === season && r.league === league);
    if (!rec) return null;
    const seasonAwards = activeAwards.filter((a) => a.season === season && a.league === league);
    const regularAwards = seasonAwards.filter((a) => REGULAR_AWARD_ORDER.includes(a.category))
      .sort((a, b) => REGULAR_AWARD_ORDER.indexOf(a.category) - REGULAR_AWARD_ORDER.indexOf(b.category));
    const playoffAwards = seasonAwards.filter((a) => PLAYOFF_AWARD_ORDER.includes(a.category))
      .sort((a, b) => PLAYOFF_AWARD_ORDER.indexOf(a.category) - PLAYOFF_AWARD_ORDER.indexOf(b.category));
    const pre = activePreRecords.find((r) => r.season === season && r.league === league);
    const cupName = league === "AHL" ? "Calder Cup" : "Stanley Cup";

    const regularContent = (
      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <TeamChip id={rec.presidentsTeamId} label={league === "AHL" ? "Best record" : "President's"} tone="text-green-400" />
        </div>
        <div>
          {regularAwards.length ? regularAwards.map((a) => <AwardRow key={a.id} a={a} />) : <p className="text-sm text-slate-500">Žiadne ocenenia nezaznamenané.</p>}
        </div>
      </div>
    );

    const playoffsContent = (
      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <TeamChip id={rec.championTeamId} label="Champion" tone="text-amber-400" />
          <TeamChip id={rec.runnerUpTeamId} label="Runner-up" tone="text-slate-400" />
        </div>
        <div>
          {playoffAwards.length ? playoffAwards.map((a) => <AwardRow key={a.id} a={a} />) : <p className="text-sm text-slate-500">Play-off ocenenia sa zapíšu po finále.</p>}
        </div>
      </div>
    );

    const topScorer = pre?.topScorerId ? playerMap.get(pre.topScorerId) : null;
    const bestTeam = pre?.bestTeamId ? teamMap.get(pre.bestTeamId) : null;
    const preContent = pre ? (
      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider w-24 shrink-0 text-green-400">Best record</span>
            {bestTeam ? (
              <Link href={`/teams/${bestTeam.slug}`} className="flex items-center gap-2 group">
                {bestTeam.logoUrl && <img src={bestTeam.logoUrl} alt="" className="w-6 h-6 object-contain" />}
                <span className="text-sm font-semibold text-slate-200 group-hover:text-blue-400">{bestTeam.name}</span>
              </Link>
            ) : <span className="text-sm text-slate-500">—</span>}
          </div>
          <p className="text-xs text-slate-500">{pre.gamesPlayed} odohraných prípravných zápasov.</p>
        </div>
        <div>
          <div className="flex items-center justify-between gap-3 py-1.5">
            <span className="text-[11px] text-slate-400 w-40 shrink-0">Top scorer</span>
            <div className="flex-1 min-w-0">
              {topScorer ? (
                <Link href={`/players/${topScorer.slug}`} className="text-sm font-semibold text-slate-100 hover:text-blue-400 truncate">{cleanName(topScorer.name)}</Link>
              ) : (
                <span className="text-sm font-semibold text-slate-100 truncate">{pre.topScorerName ? cleanName(pre.topScorerName) : "—"}</span>
              )}
            </div>
            <span className="text-xs text-amber-400/90 whitespace-nowrap">{pre.topScorerPoints ?? 0} pts</span>
          </div>
        </div>
      </div>
    ) : (
      <p className="text-sm text-slate-500">Prípravné zápasy prebiehajú pred štartom základnej časti.</p>
    );

    return (
      <Card title={`${league} — ${cupName}`} accent={league === "AHL" ? "text-orange-400" : "text-blue-400"}>
        <HistorySeasonTabs pre={preContent} regular={regularContent} playoffs={playoffsContent} />
      </Card>
    );
  };

  return (
    <div className="space-y-6 py-2">
      <PageHeader title="League History" subtitle="Pre-season, regular season and playoffs, archived season by season." />
      <HistoryNav active="history" />

      {isFreshLeague && (
        <div className="bg-gradient-to-r from-blue-950/40 via-indigo-950/30 to-slate-900 border border-blue-800/40 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-500 text-white uppercase tracking-wider">Živý náhľad</span>
              <span className="text-sm font-bold text-white">Prebiehajúca sezóna {ACTIVE_SEASON}</span>
            </div>
            <p className="text-xs text-slate-300">
              Môžete prepínať medzi záložkami <strong>Pre-season</strong>, <strong>Regular Season</strong> a <strong>Playoffs</strong> u každého bloku.
              Kompletné historické štatistiky a série nájdete v sekcii <Link href="/history/records" className="text-blue-400 font-semibold underline hover:text-blue-300">Historické rekordy →</Link>
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

      {seasons.map((season) => (
        <div key={season} className="space-y-3">
          <h2 className="text-lg font-black tracking-tight text-white flex items-center gap-3">
            <span className="text-2xl">🏆</span> {season} {isFreshLeague && <span className="text-xs font-normal text-amber-400/90 border border-amber-500/30 px-2 py-0.5 rounded-full bg-amber-500/10">Priebežný stav</span>}
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
