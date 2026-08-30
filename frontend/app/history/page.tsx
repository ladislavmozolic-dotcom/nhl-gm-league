import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card } from "@/components/ui";
import ComingSoon from "@/components/ComingSoon";
import { cleanName } from "@/lib/playerName";
import HistorySeasonTabs from "@/components/HistorySeasonTabs";

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
  const [records, awards, preRecords, teams] = await Promise.all([
    prisma.seasonRecord.findMany(),
    prisma.seasonAward.findMany(),
    prisma.seasonPreseasonRecord.findMany(),
    prisma.team.findMany({ select: { id: true, name: true, slug: true, logoUrl: true } }),
  ]);

  if (records.length === 0) {
    return (
      <div className="space-y-6 py-2">
        <PageHeader title="League History" subtitle="Pre-season, regular season and playoffs, archived season by season." />
        <ComingSoon title="No seasons archived yet" points={[
          "Finish a season (regular season → playoffs) then archive it from Admin → Season Control.",
          "Each entry captures Stanley Cup & Calder Cup champions, President's Trophy, the major award winners, and a pre-season summary.",
          "Once archived, seasons appear here newest-first, with Pre-season / Regular Season / Playoffs tabs.",
        ]} />
      </div>
    );
  }

  const teamMap = new Map(teams.map((t) => [t.id, t]));
  // resolve player names/slugs referenced by awards + pre-season top scorers
  const pids = [...new Set([
    ...awards.map((a) => a.playerId),
    ...preRecords.map((r) => r.topScorerId),
  ].filter((x): x is number => !!x))];
  const pRows = pids.length
    ? await prisma.player.findMany({ where: { id: { in: pids } }, select: { id: true, name: true, slug: true } })
    : [];
  const playerMap = new Map(pRows.map((p) => [p.id, p]));

  // group by season -> league
  const seasons = [...new Set(records.map((r) => r.season))].sort().reverse();

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

  const AwardRow = ({ a }: { a: (typeof awards)[number] }) => {
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
    const rec = records.find((r) => r.season === season && r.league === league);
    if (!rec) return null;
    const seasonAwards = awards.filter((a) => a.season === season && a.league === league);
    const regularAwards = seasonAwards.filter((a) => REGULAR_AWARD_ORDER.includes(a.category))
      .sort((a, b) => REGULAR_AWARD_ORDER.indexOf(a.category) - REGULAR_AWARD_ORDER.indexOf(b.category));
    const playoffAwards = seasonAwards.filter((a) => PLAYOFF_AWARD_ORDER.includes(a.category))
      .sort((a, b) => PLAYOFF_AWARD_ORDER.indexOf(a.category) - PLAYOFF_AWARD_ORDER.indexOf(b.category));
    const pre = preRecords.find((r) => r.season === season && r.league === league);
    const cupName = league === "AHL" ? "Calder Cup" : "Stanley Cup";

    const regularContent = (
      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <TeamChip id={rec.presidentsTeamId} label={league === "AHL" ? "Best record" : "President's"} tone="text-green-400" />
        </div>
        <div>
          {regularAwards.length ? regularAwards.map((a) => <AwardRow key={a.id} a={a} />) : <p className="text-sm text-slate-500">No awards recorded.</p>}
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
          {playoffAwards.length ? playoffAwards.map((a) => <AwardRow key={a.id} a={a} />) : <p className="text-sm text-slate-500">No playoff awards recorded.</p>}
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
          <p className="text-xs text-slate-500">{pre.gamesPlayed} exhibition games played.</p>
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
      <p className="text-sm text-slate-500">No pre-season recorded for this season.</p>
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
      {seasons.map((season) => (
        <div key={season} className="space-y-3">
          <h2 className="text-lg font-black tracking-tight text-white flex items-center gap-3">
            <span className="text-2xl">🏆</span> {season}
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
