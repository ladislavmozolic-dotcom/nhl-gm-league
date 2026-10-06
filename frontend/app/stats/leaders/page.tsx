import Link from "next/link";
import { prisma } from "@/lib/prisma";
import PlayerLink from "@/components/PlayerLink";
import PlayerAvatar from "@/components/playerAvatar";
import { skaterTotals, goalieTotals, type SkaterTotal, type GoalieTotal } from "@/lib/stats-server";
import StatsTabs from "@/components/StatsTabs";
import PhaseTabs from "@/components/PhaseTabs";
import { seasonForPhase } from "@/lib/phase";
import { defaultStatsPhase } from "@/lib/calendar-server";
import { PageHeader, SectionTitle } from "@/components/ui";
import { getTeamSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

type Row = {
  playerId: number;
  name: string;
  slug?: string | null;
  photoUrl?: string | null;
  position?: string;
  teamId: number | null;
  teamCode: string | null;
  teamSlug: string | null;
  teamLogo: string | null;
  value: React.ReactNode;
  sub?: string;
};

function LeaderCard({
  title,
  icon,
  unit,
  rows,
  managedTeamIds,
  league,
}: {
  title: string;
  icon?: string;
  unit?: string;
  rows: Row[];
  managedTeamIds: Set<number>;
  league: string;
}) {
  const top1 = rows[0];
  const rest = rows.slice(1);
  const isMineTop = top1?.teamId != null && managedTeamIds.has(top1.teamId);

  return (
    <div className="bg-[#0b1120] border border-slate-800 rounded-2xl overflow-hidden shadow-xl hover:border-slate-700/80 transition-all flex flex-col justify-between group">
      <div>
        {/* Header */}
        <div className="bg-slate-950/80 px-4 py-2.5 border-b border-slate-800/80 flex items-center justify-between">
          <span className="text-xs font-black uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
            {icon && <span>{icon}</span>}
            <span>{title}</span>
          </span>
          <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Top {rows.length}</span>
        </div>

        {/* Top 1 Hero Box */}
        {top1 ? (
          <div
            className={`p-4 border-b border-slate-800/80 relative transition-colors ${
              isMineTop
                ? "bg-emerald-950/20 border-b-emerald-500/30"
                : "bg-gradient-to-br from-amber-500/10 via-[#0b1120] to-[#0c1c31]"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative shrink-0">
                  <div
                    className={`rounded-full p-0.5 overflow-hidden shadow-lg ${
                      isMineTop
                        ? "ring-2 ring-emerald-400 bg-emerald-950"
                        : "ring-2 ring-amber-400/80 bg-slate-900 shadow-amber-500/10"
                    }`}
                  >
                    <PlayerAvatar src={top1.photoUrl ?? null} alt={top1.name} size={50} />
                  </div>
                  <span
                    className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full text-slate-950 font-black text-[10px] flex items-center justify-center border border-slate-950 shadow font-mono ${
                      isMineTop ? "bg-emerald-400" : "bg-amber-400"
                    }`}
                  >
                    1
                  </span>
                </div>

                <div className="min-w-0">
                  <div className="font-black text-white text-sm sm:text-base hover:text-blue-400 cursor-pointer truncate">
                    <PlayerLink
                      id={top1.playerId}
                      name={top1.name}
                      clean={false}
                      className={isMineTop ? "text-emerald-300 font-bold hover:text-emerald-200" : undefined}
                    />
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-0.5 flex-wrap">
                    {top1.teamCode && (
                      <Link
                        href={top1.teamSlug ? `/teams/${top1.teamSlug}` : "#"}
                        className="inline-flex items-center gap-1 text-slate-300 hover:text-blue-400 transition-colors font-bold"
                      >
                        {top1.teamLogo && <img src={top1.teamLogo} alt="" className="w-3.5 h-3.5 object-contain shrink-0" />}
                        <span>{top1.teamCode}</span>
                      </Link>
                    )}
                    {top1.position && <span className="text-slate-500">· {top1.position}</span>}
                    {top1.sub && <span className="text-slate-500 font-mono text-[11px]">· {top1.sub}</span>}
                  </div>
                </div>
              </div>

              {/* Stat Value */}
              <div className="text-right shrink-0">
                <div
                  className={`text-2xl sm:text-3xl font-black font-mono tracking-tight ${
                    isMineTop ? "text-emerald-300" : "text-amber-400"
                  }`}
                >
                  {top1.value}
                </div>
                {unit && (
                  <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider block">
                    {unit}
                  </span>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="p-6 text-center text-xs text-slate-600">no data</div>
        )}

        {/* Rows 2 - 10 */}
        {rest.length > 0 && (
          <div className="divide-y divide-slate-800/60 text-xs font-medium">
            {rest.map((r, idx) => {
              const isMine = r.teamId != null && managedTeamIds.has(r.teamId);
              const rank = idx + 2;
              return (
                <div
                  key={`${r.playerId}:${r.teamId ?? "none"}`}
                  className={`flex items-center gap-2.5 px-4 py-2 transition-colors ${
                    isMine
                      ? "bg-emerald-500/10 ring-1 ring-inset ring-emerald-400/25 hover:bg-emerald-500/15"
                      : "hover:bg-slate-900/40"
                  }`}
                >
                  <span className="w-4 text-right tabular-nums text-slate-500 font-mono text-xs">{rank}</span>
                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    {r.teamLogo ? (
                      <img src={r.teamLogo} alt="" className="w-4 h-4 object-contain shrink-0" />
                    ) : r.teamCode ? (
                      <span className="text-[10px] text-slate-500 font-mono">{r.teamCode}</span>
                    ) : null}
                    <span className="truncate">
                      <PlayerLink
                        id={r.playerId}
                        name={r.name}
                        clean={false}
                        className={isMine ? "text-emerald-300 font-semibold hover:text-emerald-200" : "text-slate-200 hover:text-blue-400"}
                      />
                    </span>
                  </div>
                  {r.sub && <span className="tabular-nums text-[10px] text-slate-500 shrink-0 font-mono">{r.sub}</span>}
                  <span className="tabular-nums font-black text-white font-mono text-right min-w-[24px]">{r.value}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="px-4 py-2 bg-slate-950/40 border-t border-slate-800/80 text-[11px] text-right">
        <Link
          href={`/stats/players${league === "AHL" ? "?league=AHL" : ""}`}
          className="text-blue-400 hover:text-blue-300 font-medium"
        >
          Full stats →
        </Link>
      </div>
    </div>
  );
}

const top = <T,>(arr: T[], key: (t: T) => number, n = 10, tie?: (t: T) => number) =>
  [...arr].sort((a, b) => key(b) - key(a) || (tie ? tie(b) - tie(a) : 0)).slice(0, n);

const skRow = (s: SkaterTotal, value: React.ReactNode, sub?: string): Row => ({
  playerId: s.playerId,
  name: s.name,
  slug: s.slug,
  photoUrl: s.photoUrl,
  position: s.position,
  teamId: s.teamId,
  teamCode: s.teamCode,
  teamSlug: s.teamSlug,
  teamLogo: s.teamLogo,
  value,
  sub,
});

const gkRow = (g: GoalieTotal, value: React.ReactNode, sub?: string): Row => ({
  playerId: g.playerId,
  name: g.name,
  slug: g.slug,
  photoUrl: g.photoUrl,
  position: "G",
  teamId: g.teamId,
  teamCode: g.teamCode,
  teamSlug: g.teamSlug,
  teamLogo: g.teamLogo,
  value,
  sub,
});

export default async function LeadersPage({
  searchParams,
}: {
  searchParams: Promise<{ league?: string; phase?: string }>;
}) {
  const sp = await searchParams;
  const league = sp.league === "AHL" ? "AHL" : "NHL";
  const explicit = sp.phase === "pre" || sp.phase === "regular" ? sp.phase : null;
  const auto = league === "NHL" ? await defaultStatsPhase() : "regular";
  const phase: "pre" | "regular" = league !== "NHL" ? "regular" : explicit ?? (auto === "playoffs" ? "regular" : auto);
  const SEASON = seasonForPhase(phase);
  const sessionTeamId = await getTeamSession();

  const [sk, gk, finals, managedTeams] = await Promise.all([
    skaterTotals(SEASON, league),
    goalieTotals(SEASON, league),
    prisma.game.findMany({ where: { season: SEASON, league, status: "FINAL" }, select: { homeTeamId: true, awayTeamId: true } }),
    sessionTeamId == null
      ? Promise.resolve([])
      : prisma.team.findMany({ where: { OR: [{ id: sessionTeamId }, { parentTeamId: sessionTeamId }] }, select: { id: true } }),
  ]);
  const managedTeamIds = new Set(managedTeams.map((t) => t.id));
  const mins = (toi: number) => Math.round(toi / 60);

  // Games completed per team for rate qualifier
  const teamGP = new Map<number, number>();
  for (const g of finals) {
    teamGP.set(g.homeTeamId, (teamGP.get(g.homeTeamId) ?? 0) + 1);
    teamGP.set(g.awayTeamId, (teamGP.get(g.awayTeamId) ?? 0) + 1);
  }

  const skaterCards: Array<{ title: string; icon: string; unit: string; rows: Row[] }> = [
    { title: "Goals", icon: "🎯", unit: "Goals", rows: top(sk, (s) => s.goals).map((s) => skRow(s, String(s.goals), `${s.gp} GP`)) },
    { title: "Assists", icon: "🏒", unit: "Assists", rows: top(sk, (s) => s.assists).map((s) => skRow(s, String(s.assists), `${s.gp} GP`)) },
    { title: "Points", icon: "👑", unit: "Points", rows: top(sk, (s) => s.points, 10, (s) => s.goals).map((s) => skRow(s, String(s.points), `${s.goals}G+${s.assists}A`)) },
    { title: "Defensemen (points)", icon: "🛡️", unit: "Points", rows: top(sk.filter((s) => s.position.includes("D")), (s) => s.points, 10, (s) => s.goals).map((s) => skRow(s, String(s.points), `${s.goals}G+${s.assists}A`)) },
    { title: "Rookies (points)", icon: "🌟", unit: "Points", rows: top(sk.filter((s) => s.rookie), (s) => s.points, 10, (s) => s.goals).map((s) => skRow(s, String(s.points), `${s.goals}G+${s.assists}A`)) },
    { title: "Plus / Minus (5-on-5)", icon: "⚖️", unit: "+/-", rows: top(sk, (s) => s.plusMinus5v5).map((s) => skRow(s, <span className={s.plusMinus5v5 > 0 ? "text-emerald-400 font-medium" : s.plusMinus5v5 < 0 ? "text-rose-400 font-medium" : "text-slate-400"}>{(s.plusMinus5v5 > 0 ? "+" : "") + s.plusMinus5v5}</span>, `${s.gp} GP`)) },
    { title: "Goals Above Expected", icon: "⚡", unit: "G-xG", rows: top(sk, (s) => s.goals - s.xg).map((s) => skRow(s, (s.goals - s.xg).toFixed(1), `${s.goals}G · ${s.xg.toFixed(1)} xG`)) },
    { title: "Minutes Played", icon: "⏱️", unit: "Min", rows: top(sk, (s) => s.toi).map((s) => skRow(s, String(mins(s.toi)), `${s.gp} GP`)) },
    { title: "Penalty Minutes", icon: "🥊", unit: "PIM", rows: top(sk, (s) => s.pim).map((s) => skRow(s, String(s.pim), `${s.gp} GP`)) },
    { title: "Shots", icon: "🚀", unit: "Shots", rows: top(sk, (s) => s.shots).map((s) => skRow(s, String(s.shots), `${s.gp} GP`)) },
    { title: "Power-Play Goals", icon: "🔥", unit: "PPG", rows: top(sk, (s) => s.ppGoals).map((s) => skRow(s, String(s.ppGoals), `${s.gp} GP`)) },
    { title: "Short-Handed Goals", icon: "💎", unit: "SHG", rows: top(sk, (s) => s.shGoals).map((s) => skRow(s, String(s.shGoals), `${s.gp} GP`)) },
    { title: "Game-Winning Goals", icon: "🏆", unit: "GWG", rows: top(sk, (s) => s.gwg).map((s) => skRow(s, String(s.gwg), `${s.gp} GP`)) },
    { title: "Hits", icon: "💥", unit: "Hits", rows: top(sk, (s) => s.hits).map((s) => skRow(s, String(s.hits), `${s.gp} GP`)) },
    { title: "Shots Blocked", icon: "🧱", unit: "Blocks", rows: top(sk, (s) => s.blocks).map((s) => skRow(s, String(s.blocks), `${s.gp} GP`)) },
  ];

  const QUAL_PCT = 0.2;
  const gkMinFor = (tid: number | null) => {
    const tg = (tid != null ? teamGP.get(tid) : 0) ?? 0;
    return Math.max(1, Math.round(QUAL_PCT * tg));
  };
  const qualGk = gk.filter((g) => g.gp >= gkMinFor(g.teamId));
  const maxTeamGP = Math.max(0, ...teamGP.values());
  const repMin = Math.max(1, Math.round(QUAL_PCT * maxTeamGP));

  const goalieCards: Array<{ title: string; icon: string; unit: string; rows: Row[] }> = [
    { title: "Wins", icon: "🏆", unit: "Wins", rows: top(gk, (g) => g.wins).map((g) => gkRow(g, String(g.wins), `${g.gp} GP`)) },
    { title: "Steals (Ukradnuté zápasy)", icon: "🥷", unit: "Steals", rows: top(gk.filter((g) => g.steals > 0), (g) => g.steals).map((g) => gkRow(g, String(g.steals), `${g.wins} W · ${g.gp} GP`)) },
    { title: "Goals Saved Above Expected (GSAx)", icon: "📈", unit: "GSAx", rows: top(gk, (g) => g.gsax).map((g) => gkRow(g, (g.gsax > 0 ? "+" : "") + g.gsax.toFixed(1), `${g.goalsAgainst} GA · ${g.xga.toFixed(1)} xGA`)) },
    { title: "Save Percentage", icon: "🧤", unit: "SV%", rows: top(qualGk, (g) => g.svPct).map((g) => gkRow(g, g.svPct.toFixed(3).replace(/^0/, ""), `${g.gp} GP`)) },
    { title: "Goals-Against Average", icon: "🔒", unit: "GAA", rows: top(qualGk, (g) => -g.gaa).map((g) => gkRow(g, g.gaa.toFixed(2), `${g.gp} GP`)) },
    { title: "Shutouts", icon: "🚫", unit: "SO", rows: top(gk, (g) => g.shutouts).map((g) => gkRow(g, String(g.shutouts), `${g.gp} GP`)) },
  ];

  // Top 3 League Trophy Showcase (Art Ross, Rocket Richard, Vezina / Wins)
  const pointsLeader = skaterCards.find((c) => c.title === "Points")?.rows[0];
  const goalsLeader = skaterCards.find((c) => c.title === "Goals")?.rows[0];
  const goalieLeader = goalieCards.find((c) => c.title === "Wins")?.rows[0];

  return (
    <div className="space-y-6 py-2">
      <PageHeader title="Statistics" subtitle="League leaders across skaters and goalies" />
      <StatsTabs active="leaders" league={league} />
      <PhaseTabs active={phase} league={league} basePath="/stats/leaders" showPlayoffs={false} />
      {phase === "pre" && (
        <p className="text-xs text-amber-400/90">
          Pre-season (exhibition) — these stats don&apos;t count toward player profiles or careers.
        </p>
      )}

      {/* TOP STAR TROPHY PODIUM (Shown when season has active games) */}
      {pointsLeader && goalsLeader && goalieLeader && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* ART ROSS */}
          <div className="bg-gradient-to-br from-amber-500/15 via-[#0b1120] to-[#0c1c31] border border-amber-500/30 rounded-2xl p-4 sm:p-5 relative overflow-hidden shadow-xl flex flex-col justify-between">
            <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  👑 ART ROSS LEADER
                </span>
                <span className="text-xs font-mono font-bold text-slate-400">#1 BODOVANIE</span>
              </div>
              <div className="flex items-center gap-3.5">
                <div className="w-14 h-14 rounded-2xl bg-slate-900 border-2 border-amber-400/80 overflow-hidden shadow-lg shrink-0">
                  <PlayerAvatar src={pointsLeader.photoUrl ?? null} alt={pointsLeader.name} size={56} />
                </div>
                <div className="min-w-0">
                  <h3 className="font-black text-base sm:text-lg text-white leading-tight truncate">
                    <PlayerLink id={pointsLeader.playerId} name={pointsLeader.name} clean={false} />
                  </h3>
                  <div className="flex items-center gap-1.5 text-xs text-slate-300 mt-1">
                    {pointsLeader.teamLogo && <img src={pointsLeader.teamLogo} className="w-4 h-4 object-contain" alt="" />}
                    <span>{pointsLeader.teamCode}</span>
                    {pointsLeader.position && <span>· {pointsLeader.position}</span>}
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-amber-500/20 flex items-center justify-between">
              <span className="text-xs text-slate-400 font-mono">{pointsLeader.sub}</span>
              <span className="text-2xl sm:text-3xl font-black font-mono text-amber-400">{pointsLeader.value} PTS</span>
            </div>
          </div>

          {/* ROCKET RICHARD */}
          <div className="bg-gradient-to-br from-red-500/15 via-[#0b1120] to-[#0c1c31] border border-red-500/30 rounded-2xl p-4 sm:p-5 relative overflow-hidden shadow-xl flex flex-col justify-between">
            <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-red-500/10 rounded-full blur-2xl pointer-events-none" />
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/30">
                  🎯 ROCKET RICHARD
                </span>
                <span className="text-xs font-mono font-bold text-slate-400">#1 STRELEC</span>
              </div>
              <div className="flex items-center gap-3.5">
                <div className="w-14 h-14 rounded-2xl bg-slate-900 border-2 border-red-400/80 overflow-hidden shadow-lg shrink-0">
                  <PlayerAvatar src={goalsLeader.photoUrl ?? null} alt={goalsLeader.name} size={56} />
                </div>
                <div className="min-w-0">
                  <h3 className="font-black text-base sm:text-lg text-white leading-tight truncate">
                    <PlayerLink id={goalsLeader.playerId} name={goalsLeader.name} clean={false} />
                  </h3>
                  <div className="flex items-center gap-1.5 text-xs text-slate-300 mt-1">
                    {goalsLeader.teamLogo && <img src={goalsLeader.teamLogo} className="w-4 h-4 object-contain" alt="" />}
                    <span>{goalsLeader.teamCode}</span>
                    {goalsLeader.position && <span>· {goalsLeader.position}</span>}
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-red-500/20 flex items-center justify-between">
              <span className="text-xs text-slate-400 font-mono">{goalsLeader.sub}</span>
              <span className="text-2xl sm:text-3xl font-black font-mono text-red-400">{goalsLeader.value} G</span>
            </div>
          </div>

          {/* TOP GOALIE */}
          <div className="bg-gradient-to-br from-emerald-500/15 via-[#0b1120] to-[#0c1c31] border border-emerald-500/30 rounded-2xl p-4 sm:p-5 relative overflow-hidden shadow-xl flex flex-col justify-between">
            <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  🛡️ VEZINA LEADER
                </span>
                <span className="text-xs font-mono font-bold text-slate-400">#1 BRANKÁR</span>
              </div>
              <div className="flex items-center gap-3.5">
                <div className="w-14 h-14 rounded-2xl bg-slate-900 border-2 border-emerald-400/80 overflow-hidden shadow-lg shrink-0">
                  <PlayerAvatar src={goalieLeader.photoUrl ?? null} alt={goalieLeader.name} size={56} />
                </div>
                <div className="min-w-0">
                  <h3 className="font-black text-base sm:text-lg text-white leading-tight truncate">
                    <PlayerLink id={goalieLeader.playerId} name={goalieLeader.name} clean={false} />
                  </h3>
                  <div className="flex items-center gap-1.5 text-xs text-slate-300 mt-1">
                    {goalieLeader.teamLogo && <img src={goalieLeader.teamLogo} className="w-4 h-4 object-contain" alt="" />}
                    <span>{goalieLeader.teamCode}</span>
                    <span>· G</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-emerald-500/20 flex items-center justify-between">
              <span className="text-xs text-slate-400 font-mono">{goalieLeader.sub}</span>
              <span className="text-2xl sm:text-3xl font-black font-mono text-emerald-400">{goalieLeader.value} WINS</span>
            </div>
          </div>
        </div>
      )}

      {/* SKATERS SECTION */}
      <section className="space-y-3">
        <SectionTitle accent="text-blue-400">Skater Leaders — {league} {SEASON}</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {skaterCards.map((c) => (
            <LeaderCard
              key={c.title}
              title={c.title}
              icon={c.icon}
              unit={c.unit}
              rows={c.rows}
              managedTeamIds={managedTeamIds}
              league={league}
            />
          ))}
        </div>
      </section>

      {/* GOALIES SECTION */}
      <section className="space-y-3">
        <SectionTitle accent="text-red-400">
          Goalie Leaders — SV%/GAA need ≥20% of team games ({repMin}+ GP)
        </SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {goalieCards.map((c) => (
            <LeaderCard
              key={c.title}
              title={c.title}
              icon={c.icon}
              unit={c.unit}
              rows={c.rows}
              managedTeamIds={managedTeamIds}
              league={league}
            />
          ))}
        </div>
      </section>

      <div className="space-y-1 pt-2">
        <p className="text-xs text-slate-600">
          Penalty-shot goals and penalty-shot % are not tracked by the sim engine yet.
        </p>
        <p className="text-xs text-slate-600">
          <Link href={`/stats/players${league === "AHL" ? "?league=AHL" : ""}`} className="hover:text-blue-400">
            Full player stats →
          </Link>
        </p>
      </div>
    </div>
  );
}
