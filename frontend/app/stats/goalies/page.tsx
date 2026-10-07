import { prisma } from "@/lib/prisma";
import { getTeamSession } from "@/lib/auth";
import { goalieTotals, type GoalieTotal } from "@/lib/stats-server";
import StatsTabs from "@/components/StatsTabs";
import PhaseTabs from "@/components/PhaseTabs";
import StatHeroDeck, { type HeroCardItem } from "@/components/StatHeroDeck";
import { seasonForPhase } from "@/lib/phase";
import { defaultStatsPhase } from "@/lib/calendar-server";
import StatTable, { type Col } from "@/components/StatTable";
import { PageHeader } from "@/components/ui";
import { getLang } from "@/lib/lang-server";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

const COLS: Col[] = [
  { key: "name", label: "Goalie", title: "Goalie Name", frozen: true, link: true },
  { key: "teamCode", label: "Team", title: "Team", team: true },
  { key: "gp", label: "GP", title: "Games Played", num: true },
  { key: "wins", label: "W", title: "Wins", num: true },
  { key: "losses", label: "L", title: "Losses", num: true },
  { key: "otl", label: "OTL", title: "Overtime Losses", num: true },
  { key: "svPct", label: "PCT", title: "Save Percentage", num: true, format: "pct3" },
  { key: "gaa", label: "GAA", title: "Goals-Against Average", num: true, format: "dec2" },
  { key: "gsax", label: "GSAx", title: "Goals Saved Above Expected (xGA − GA)", num: true, format: "plusDec1", info: "Goals Saved Above Expected (xGA − GA). Positive values mean the goalie stopped more goals than expected given shot danger." },
  { key: "steals", label: "STL", title: "Steals (Ukradnuté zápasy)", num: true, info: "Ukradnuté zápasy (Steals): Zápasy s výhrou, kde brankárov GSAx prevýšil gólový náskok tímu (bez gólov do prázdnej brány)." },
  { key: "mp", label: "MP", title: "Minutes Played", num: true },
  { key: "shutouts", label: "SO", title: "Shutouts", num: true },
  { key: "goalsAgainst", label: "GA", title: "Goals Against", num: true },
  { key: "shotsAgainst", label: "SA", title: "Shots Against", num: true },
  { key: "saves", label: "SV", title: "Saves", num: true },
  { key: "xga", label: "xGA", title: "Expected Goals Against", num: true, format: "dec1", defaultHidden: true },
  { key: "pim", label: "PIM", title: "Penalty Minutes (not tracked)", num: true, format: "dash", defaultHidden: true },
  { key: "a", label: "A", title: "Assists (not tracked)", num: true, format: "dash", defaultHidden: true },
  { key: "eg", label: "EG", title: "Empty-Net Goals Against (not tracked)", num: true, format: "dash", defaultHidden: true },
  { key: "psPct", label: "PS %", title: "Penalty-Shot Save % (not tracked)", num: true, format: "dash", defaultHidden: true },
  { key: "psa", label: "PSA", title: "Penalty Shots Against (not tracked)", num: true, format: "dash", defaultHidden: true },
  { key: "st", label: "ST", title: "Shootout attempts (not tracked)", num: true, format: "dash", defaultHidden: true },
  { key: "bg", label: "BG", title: "Shootout goals against (not tracked)", num: true, format: "dash", defaultHidden: true },
  { key: "s1", label: "S1", title: "Shootout round 1 (not tracked)", num: true, format: "dash", defaultHidden: true },
  { key: "s2", label: "S2", title: "Shootout round 2 (not tracked)", num: true, format: "dash", defaultHidden: true },
  { key: "s3", label: "S3", title: "Shootout round 3 (not tracked)", num: true, format: "dash", defaultHidden: true },
];

export default async function GoalieStatsPage({ searchParams }: { searchParams: Promise<{ league?: string; phase?: string }> }) {
  const sp = await searchParams;
  const league = sp.league === "AHL" ? "AHL" : "NHL";
  const explicit = sp.phase === "pre" || sp.phase === "regular" ? sp.phase : null;
  const auto = league === "NHL" ? await defaultStatsPhase() : "regular";
  const phase: "pre" | "regular" = league !== "NHL" ? "regular" : explicit ?? (auto === "playoffs" ? "regular" : auto);
  const SEASON = seasonForPhase(phase);

  const sessionTeamId = await getTeamSession();
  const lang = await getLang();
  const [gk, managedTeams] = await Promise.all([
    goalieTotals(SEASON, league),
    sessionTeamId == null
      ? Promise.resolve([])
      : prisma.team.findMany({ where: { OR: [{ id: sessionTeamId }, { parentTeamId: sessionTeamId }] }, select: { id: true } }),
  ]);
  const managedTeamIds = new Set(managedTeams.map((t) => t.id));

  // Compute Top 4 Goalie Spotlight Cards
  let heroCards: HeroCardItem[] = [];
  if (gk.length > 0) {
    const sortedW = [...gk].sort((a, b) => b.wins - a.wins || b.svPct - a.svPct);
    const sortedGsax = [...gk].sort((a, b) => b.gsax - a.gsax || b.wins - a.wins);
    const sortedStl = [...gk].sort((a, b) => b.steals - a.steals || b.wins - a.wins);

    // Filter minimum workload for SV% leader
    const maxSa = Math.max(0, ...gk.map((g) => g.shotsAgainst));
    const minSa = Math.max(15, Math.round(maxSa * 0.25));
    const qualGk = gk.filter((g) => g.shotsAgainst >= minSa);
    const sortedSv = [...(qualGk.length ? qualGk : gk)].sort((a, b) => b.svPct - a.svPct || a.gaa - b.gaa);

    const wLeader = sortedW[0];
    const svLeader = sortedSv[0];
    const gsaxLeader = sortedGsax[0];
    const stlLeader = sortedStl[0];

    if (wLeader) {
      heroCards.push({
        badge: t(lang, "stats.badge.mostWins"),
        subBadge: t(lang, "stats.subBadge.wins"),
        playerId: wLeader.playerId,
        slug: wLeader.slug,
        name: wLeader.name,
        photoUrl: wLeader.photoUrl,
        position: "G",
        teamId: wLeader.teamId,
        teamCode: wLeader.teamCode,
        teamSlug: wLeader.teamSlug,
        teamLogo: wLeader.teamLogo,
        value: wLeader.wins,
        unit: "W",
        sub: `${wLeader.wins}-${wLeader.losses}-${wLeader.otl} (${wLeader.gp} GP)`,
        accentColor: "amber",
      });
    }
    if (svLeader) {
      heroCards.push({
        badge: t(lang, "stats.badge.savePct"),
        subBadge: t(lang, "stats.subBadge.savePct"),
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
        sub: `${svLeader.gaa.toFixed(2)} GAA (${svLeader.gp} GP)`,
        accentColor: "sky",
      });
    }
    if (gsaxLeader) {
      heroCards.push({
        badge: t(lang, "stats.badge.gsax"),
        subBadge: t(lang, "stats.subBadge.aboveExpected"),
        playerId: gsaxLeader.playerId,
        slug: gsaxLeader.slug,
        name: gsaxLeader.name,
        photoUrl: gsaxLeader.photoUrl,
        position: "G",
        teamId: gsaxLeader.teamId,
        teamCode: gsaxLeader.teamCode,
        teamSlug: gsaxLeader.teamSlug,
        teamLogo: gsaxLeader.teamLogo,
        value: (gsaxLeader.gsax > 0 ? "+" : "") + gsaxLeader.gsax.toFixed(1),
        unit: "GSAx",
        sub: `${gsaxLeader.goalsAgainst} GA · ${gsaxLeader.xga.toFixed(1)} xGA`,
        accentColor: "emerald",
      });
    }
    if (stlLeader) {
      heroCards.push({
        badge: t(lang, "stats.badge.steals"),
        subBadge: t(lang, "stats.subBadge.steals"),
        playerId: stlLeader.playerId,
        slug: stlLeader.slug,
        name: stlLeader.name,
        photoUrl: stlLeader.photoUrl,
        position: "G",
        teamId: stlLeader.teamId,
        teamCode: stlLeader.teamCode,
        teamSlug: stlLeader.teamSlug,
        teamLogo: stlLeader.teamLogo,
        value: stlLeader.steals,
        unit: "STL",
        sub: `${stlLeader.wins} W · ${stlLeader.gp} GP`,
        accentColor: "purple",
      });
    }
  }

  const rows = gk.map((g) => ({
    _pid: g.playerId, _slug: g.slug, name: g.name, teamCode: g.teamCode ?? "—", _teamSlug: g.teamSlug ?? "", _teamLogo: g.teamLogo ?? "", gp: g.gp, wins: g.wins, losses: g.losses, otl: g.otl,
    svPct: g.svPct, gaa: g.gaa, gsax: g.gsax, steals: g.steals, mp: g.toiMin, pim: 0, shutouts: g.shutouts,
    goalsAgainst: g.goalsAgainst, shotsAgainst: g.shotsAgainst, saves: g.saves,
    xga: g.xga,
    a: 0, eg: 0, psPct: 0, psa: 0, st: 0, bg: 0, s1: 0, s2: 0, s3: 0,
  }));

  return (
    <div className="space-y-6 py-2">
      <PageHeader
        title={t(lang, "menu.stats") || "Statistics"}
        subtitle={lang === "cs"
          ? `Brankári — ${league} ${phase === "pre" ? "príprava" : "základná časť"}`
          : `All goalies — ${league} ${phase === "pre" ? "pre-season (exhibition)" : "regular season"}`}
      />
      <StatsTabs active="goalies" league={league} />
      <PhaseTabs active={phase} league={league} basePath="/stats/goalies" showPlayoffs={false} />

      {/* Hero Spotlight Cards */}
      {heroCards.length > 0 && (
        <StatHeroDeck cards={heroCards} managedTeamIds={managedTeamIds} />
      )}

      <p className="text-slate-400 text-sm">
        {lang === "cs"
          ? "Kliknutím na stĺpec zotriediš tabuľku; použi vyhľadávanie alebo zobrazenie stĺpcov."
          : "Click a header to sort; use live search or Show / Hide Columns to customize."}
        {phase === "pre"
          ? (lang === "cs" ? " Zápasy z prípravy sa nezapočítavajú do profilov/kariéry." : " Pre-season stats don't count toward profiles/careers.")
          : ""}
      </p>
      <StatTable cols={COLS} rows={rows} initialSort="wins" minWidth={1160} showRank />
      <p className="text-xs text-slate-600">
        Columns showing “—” (PIM, A, EG, PS %, PSA, ST, BG, S1–S3) are stat fields the sim engine doesn’t record yet.
      </p>
    </div>
  );
}
