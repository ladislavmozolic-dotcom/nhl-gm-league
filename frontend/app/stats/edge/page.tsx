import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getTeamSession } from "@/lib/auth";
import { skaterEdge, goalieEdge, teamEdge } from "@/lib/stats-server";
import StatsTabs from "@/components/StatsTabs";
import StatHeroDeck, { type HeroCardItem } from "@/components/StatHeroDeck";
import StatTable, { type Col } from "@/components/StatTable";
import { PageHeader } from "@/components/ui";
import PhaseTabs from "@/components/PhaseTabs";
import { seasonForPhase } from "@/lib/phase";
import { defaultStatsPhase } from "@/lib/calendar-server";
import { getLang } from "@/lib/lang-server";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

type View = "teams" | "skaters" | "goalies";
const VIEWS: { key: View; label: string; icon: string }[] = [
  { key: "skaters", label: "Skaters", icon: "👤" },
  { key: "goalies", label: "Goalies", icon: "🧤" },
  { key: "teams", label: "Teams", icon: "🛡️" },
];

const SKATER_COLS: Col[] = [
  { key: "name", label: "Player", title: "Player", frozen: true, link: true },
  { key: "teamCode", label: "Team", title: "Team", team: true },
  { key: "pos", label: "Pos", title: "Position" },
  { key: "gp", label: "GP", title: "Games Played", num: true },
  { key: "topSkate", label: "Top Speed", title: "Top skating speed, mph (modelled from SK rating)", num: true, format: "dec1" },
  { key: "bursts", label: "22+ Bursts", title: "Speed bursts over 22 mph (modelled)", num: true },
  { key: "miles", label: "Distance", title: "Skating distance, miles (modelled from ice time)", num: true, format: "dec1" },
  { key: "topShot", label: "Top Shot", title: "Fastest shot on goal, mph (tracked)", num: true, format: "dec1" },
  { key: "hits", label: "Hits", title: "Hits", num: true },
];

const GOALIE_COLS: Col[] = [
  { key: "name", label: "Goalie", title: "Goalie", frozen: true, link: true },
  { key: "teamCode", label: "Team", title: "Team", team: true },
  { key: "gp", label: "GP", title: "Games Played", num: true },
  { key: "svPct", label: "SV%", title: "Overall Save %", num: true, format: "pct3" },
  { key: "hdSv", label: "HD SV%", title: "High-danger save % (slot / net-front)", num: true, format: "pct3" },
  { key: "mdSv", label: "MD SV%", title: "Mid-danger save %", num: true, format: "pct3" },
  { key: "ldSv", label: "LD SV%", title: "Low-danger save % (point / perimeter)", num: true, format: "pct3" },
  { key: "hdShotsAg", label: "HDSA", title: "High-danger shots against", num: true },
];

const TEAM_COLS: Col[] = [
  { key: "name", label: "Team", title: "Team", frozen: true, team: true },
  { key: "gp", label: "GP", title: "Games Played", num: true },
  { key: "ozPct", label: "OZ%", title: "Offensive-zone time %", num: true, format: "dec1" },
  { key: "nzPct", label: "NZ%", title: "Neutral-zone time %", num: true, format: "dec1" },
  { key: "dzPct", label: "DZ%", title: "Defensive-zone time %", num: true, format: "dec1" },
  { key: "avgShot", label: "Avg Shot", title: "Average shot speed, mph", num: true, format: "dec1" },
  { key: "topShot", label: "Top Shot", title: "Fastest shot, mph", num: true, format: "dec1" },
  { key: "hitsPg", label: "Hits/G", title: "Hits per game", num: true, format: "dec1" },
  { key: "skate", label: "Avg Speed", title: "Roster average top skating speed, mph (modelled)", num: true, format: "dec1" },
];

export default async function EdgeStatsPage({ searchParams }: { searchParams: Promise<{ league?: string; view?: string; phase?: string }> }) {
  const lang = await getLang();
  const sp = await searchParams;
  const league = sp.league === "AHL" ? "AHL" : "NHL";
  const explicit = sp.phase === "pre" || sp.phase === "regular" ? sp.phase : null;
  const auto = league === "NHL" ? await defaultStatsPhase() : "regular";
  const phase: "pre" | "regular" = league !== "NHL" ? "regular" : explicit ?? (auto === "playoffs" ? "regular" : auto);
  const SEASON = seasonForPhase(phase);
  const view: View = sp.view === "goalies" ? "goalies" : sp.view === "teams" ? "teams" : "skaters";
  const q = `${league === "AHL" ? "&league=AHL" : ""}&phase=${phase}`;

  const sessionTeamId = await getTeamSession();
  const managedTeams = sessionTeamId == null
    ? []
    : await prisma.team.findMany({ where: { OR: [{ id: sessionTeamId }, { parentTeamId: sessionTeamId }] }, select: { id: true } });
  const managedTeamIds = new Set(managedTeams.map((t) => t.id));

  let rows: Record<string, string | number | null | undefined>[] = [];
  let cols = SKATER_COLS;
  let initialSort = "topShot";
  let minNote = "";
  let heroCards: HeroCardItem[] = [];

  if (view === "skaters") {
    const sk = await skaterEdge(SEASON, league);
    const maxGp = sk.reduce((m, s) => Math.max(m, s.gp), 0);
    const skMin = Math.min(10, Math.max(1, Math.ceil(maxGp * 0.4)));
    const filtered = sk.filter((s) => s.gp >= skMin);
    rows = filtered.map((s) => ({
      _pid: s.playerId, _slug: s.slug, name: s.name, teamCode: s.teamCode ?? "—", _teamSlug: s.teamSlug ?? "", _teamLogo: s.teamLogo ?? "", pos: s.position, gp: s.gp,
      topSkate: s.topSkateSpeed, bursts: s.bursts, miles: s.miles, topShot: s.topShot, hits: s.hits,
    }));
    cols = SKATER_COLS; initialSort = "topShot";
    minNote = `Minimum ${skMin} GP (scales up to 10). Top Shot is tracked; Top Speed / bursts / distance are modelled.`;

    if (filtered.length > 0) {
      const fastest = [...filtered].sort((a, b) => b.topSkateSpeed - a.topSkateSpeed)[0];
      const hardest = [...filtered].sort((a, b) => b.topShot - a.topShot)[0];
      const dist = [...filtered].sort((a, b) => b.miles - a.miles)[0];

      if (fastest) {
        heroCards.push({
          badge: t(lang, "stats.badge.topSkaterSpeed"),
          subBadge: t(lang, "stats.subBadge.speed"),
          playerId: fastest.playerId,
          slug: fastest.slug,
          name: fastest.name,
          photoUrl: fastest.photoUrl,
          position: fastest.position,
          teamId: fastest.teamId,
          teamCode: fastest.teamCode,
          teamSlug: fastest.teamSlug,
          teamLogo: fastest.teamLogo,
          value: fastest.topSkateSpeed.toFixed(1),
          unit: "mph",
          sub: `${fastest.bursts} ${t(lang, "stats.edge.bursts")}`,
          accentColor: "sky",
        });
      }
      if (hardest) {
        heroCards.push({
          badge: t(lang, "stats.badge.hardestShot"),
          subBadge: t(lang, "stats.subBadge.shotSpeed"),
          playerId: hardest.playerId,
          slug: hardest.slug,
          name: hardest.name,
          photoUrl: hardest.photoUrl,
          position: hardest.position,
          teamId: hardest.teamId,
          teamCode: hardest.teamCode,
          teamSlug: hardest.teamSlug,
          teamLogo: hardest.teamLogo,
          value: hardest.topShot.toFixed(1),
          unit: "mph",
          sub: `${hardest.hits} ${t(lang, "stats.edge.hitsWithGp")} (${hardest.gp} GP)`,
          accentColor: "rose",
        });
      }
      if (dist) {
        heroCards.push({
          badge: t(lang, "stats.badge.marathonSkater"),
          subBadge: t(lang, "stats.subBadge.distanceSkated"),
          playerId: dist.playerId,
          slug: dist.slug,
          name: dist.name,
          photoUrl: dist.photoUrl,
          position: dist.position,
          teamId: dist.teamId,
          teamCode: dist.teamCode,
          teamSlug: dist.teamSlug,
          teamLogo: dist.teamLogo,
          value: dist.miles.toFixed(1),
          unit: "mi",
          sub: `${(dist.toi / 60).toFixed(0)} ${t(lang, "stats.edge.minOnIce")}`,
          accentColor: "emerald",
        });
      }
    }
  } else if (view === "goalies") {
    const gk = await goalieEdge(SEASON, league);
    const maxSa = gk.reduce((m, g) => Math.max(m, g.hdShotsAg + g.mdShotsAg + g.ldShotsAg), 0);
    const saMin = Math.min(150, Math.max(1, Math.ceil(maxSa * 0.4)));
    minNote = `Minimum ${saMin} shots against (scales up to 150). Real NHL: HD ≈ .80, MD ≈ .92, LD ≈ .98.`;
    const filtered = gk.filter((g) => g.hdShotsAg + g.mdShotsAg + g.ldShotsAg >= saMin);
    rows = filtered.map((g) => ({
      _pid: g.playerId, _slug: g.slug, name: g.name, teamCode: g.teamCode ?? "—", _teamSlug: g.teamSlug ?? "", _teamLogo: g.teamLogo ?? "", gp: g.gp, svPct: g.svPct,
      hdSv: g.hdSvPct, mdSv: g.mdSvPct, ldSv: g.ldSvPct, hdShotsAg: g.hdShotsAg,
    }));
    cols = GOALIE_COLS; initialSort = "hdSv";

    if (filtered.length > 0) {
      const hdLeader = [...filtered].sort((a, b) => b.hdSvPct - a.hdSvPct)[0];
      const svLeader = [...filtered].sort((a, b) => b.svPct - a.svPct)[0];
      const mdLeader = [...filtered].sort((a, b) => b.mdSvPct - a.mdSvPct)[0];

      if (hdLeader) {
        heroCards.push({
          badge: t(lang, "stats.badge.hdLockdown"),
          subBadge: t(lang, "stats.subBadge.slotSaves"),
          playerId: hdLeader.playerId,
          slug: hdLeader.slug,
          name: hdLeader.name,
          photoUrl: hdLeader.photoUrl,
          position: "G",
          teamId: hdLeader.teamId,
          teamCode: hdLeader.teamCode,
          teamSlug: hdLeader.teamSlug,
          teamLogo: hdLeader.teamLogo,
          value: hdLeader.hdSvPct.toFixed(3).replace(/^0/, ""),
          unit: "HD SV%",
          sub: `${hdLeader.hdShotsAg} ${t(lang, "stats.edge.slotShots")}`,
          accentColor: "emerald",
        });
      }
      if (svLeader) {
        heroCards.push({
          badge: t(lang, "stats.badge.overallSvPct"),
          subBadge: t(lang, "stats.subBadge.overallSv"),
          playerId: svLeader.playerId,
          slug: svLeader.slug,
          name: svLeader.name,
          photoUrl: svLeader.photoUrl,
          position: "G",
          teamId: svLeader.teamId,
          teamCode: svLeader.teamCode,
          teamSlug: svLeader.teamSlug,
          teamLogo: svLeader.teamLogo,
          value: svLeader.svPct.toFixed(3).replace(/^0/, ""),
          unit: "SV%",
          sub: `${svLeader.gp} ${t(lang, "stats.edge.gamesPlayedGoalie")}`,
          accentColor: "sky",
        });
      }
      if (mdLeader) {
        heroCards.push({
          badge: t(lang, "stats.badge.mdWall"),
          subBadge: t(lang, "stats.subBadge.midRangeSaves"),
          playerId: mdLeader.playerId,
          slug: mdLeader.slug,
          name: mdLeader.name,
          photoUrl: mdLeader.photoUrl,
          position: "G",
          teamId: mdLeader.teamId,
          teamCode: mdLeader.teamCode,
          teamSlug: mdLeader.teamSlug,
          teamLogo: mdLeader.teamLogo,
          value: mdLeader.mdSvPct.toFixed(3).replace(/^0/, ""),
          unit: "MD SV%",
          sub: `${mdLeader.mdShotsAg} ${t(lang, "stats.edge.midRangeShots")}`,
          accentColor: "amber",
        });
      }
    }
  } else {
    const te = await teamEdge(SEASON, league);
    rows = te.map((t) => ({
      name: t.name, _teamSlug: t.slug ?? "", _teamLogo: t.logoUrl ?? "", gp: t.gp, ozPct: t.ozPct, nzPct: t.nzPct, dzPct: t.dzPct,
      avgShot: t.avgShot, topShot: t.topShot, hitsPg: t.hitsPerGame, skate: t.avgSkateSpeed,
    }));
    cols = TEAM_COLS; initialSort = "ozPct";

    if (te.length > 0) {
      const ozLeader = [...te].sort((a, b) => b.ozPct - a.ozPct)[0];
      const shotLeader = [...te].sort((a, b) => b.topShot - a.topShot)[0];
      const skateLeader = [...te].sort((a, b) => b.avgSkateSpeed - a.avgSkateSpeed)[0];

      if (ozLeader) {
        heroCards.push({
          badge: t(lang, "stats.badge.ozTime"),
          subBadge: t(lang, "stats.subBadge.ozTime"),
          name: ozLeader.name,
          teamId: ozLeader.teamId,
          teamSlug: ozLeader.slug,
          teamLogo: ozLeader.logoUrl,
          teamCode: ozLeader.code,
          value: ozLeader.ozPct.toFixed(1),
          unit: "OZ%",
          sub: `${ozLeader.gp} ${t(lang, "stats.edge.gamesPlayedTeam")}`,
          accentColor: "amber",
        });
      }
      if (shotLeader) {
        heroCards.push({
          badge: t(lang, "stats.badge.teamHardestShot"),
          subBadge: t(lang, "stats.subBadge.teamShotSpeed"),
          name: shotLeader.name,
          teamId: shotLeader.teamId,
          teamSlug: shotLeader.slug,
          teamLogo: shotLeader.logoUrl,
          teamCode: shotLeader.code,
          value: shotLeader.topShot.toFixed(1),
          unit: "mph",
          sub: `${t(lang, "stats.edge.teamAvgShot")} ${shotLeader.avgShot.toFixed(1)} mph`,
          accentColor: "rose",
        });
      }
      if (skateLeader) {
        heroCards.push({
          badge: t(lang, "stats.badge.fastestRoster"),
          subBadge: t(lang, "stats.subBadge.teamSpeed"),
          name: skateLeader.name,
          teamId: skateLeader.teamId,
          teamSlug: skateLeader.slug,
          teamLogo: skateLeader.logoUrl,
          teamCode: skateLeader.code,
          value: skateLeader.avgSkateSpeed.toFixed(1),
          unit: "mph",
          sub: `${skateLeader.hitsPerGame.toFixed(1)} ${t(lang, "stats.edge.hitsPerGame")}`,
          accentColor: "sky",
        });
      }
    }
  }

  const viewLabels: Record<View, string> = {
    skaters: t(lang, "stats.edge.viewSkaters"),
    goalies: t(lang, "stats.edge.viewGoalies"),
    teams: t(lang, "stats.edge.viewTeams"),
  };

  return (
    <div className="space-y-6 py-2">
      <PageHeader
        title="Statistics"
        subtitle={`${t(lang, "stats.edge.subtitle")} · ${league} 2026-27 ${phase === "pre" ? t(lang, "phase.pre").toLowerCase() : t(lang, "phase.regular").toLowerCase()}`}
      />
      <StatsTabs active="edge" league={league} />
      <PhaseTabs active={phase} league={league} basePath="/stats/edge" showPlayoffs={false} keep={`view=${view}`} />

      {/* View Switcher Pills */}
      <div className="flex flex-wrap gap-2">
        {VIEWS.map((v) => (
          <Link
            key={v.key}
            href={`/stats/edge?view=${v.key}${q}`}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-[13px] font-bold transition-all ${
              view === v.key
                ? "bg-sky-600 text-white shadow-md shadow-sky-500/20"
                : "bg-slate-900/60 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800/60"
            }`}
          >
            <span>{v.icon}</span>
            <span>{viewLabels[v.key] ?? v.label}</span>
          </Link>
        ))}
      </div>

      {/* Hero Spotlight Cards */}
      {heroCards.length > 0 && (
        <StatHeroDeck cards={heroCards} managedTeamIds={managedTeamIds} />
      )}

      <p className="text-slate-400 text-sm">
        {view === "skaters" && t(lang, "stats.edge.skatersNote")}
        {view === "goalies" && t(lang, "stats.edge.goaliesNote")}
        {view === "teams" && t(lang, "stats.edge.teamsNote")}
      </p>

      <StatTable cols={cols} rows={rows} initialSort={initialSort} minWidth={820} showRank />

      {minNote && <p className="text-xs text-slate-600">{minNote}</p>}
    </div>
  );
}
