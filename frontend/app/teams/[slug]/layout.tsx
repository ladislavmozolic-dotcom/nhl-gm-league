import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { canManageTeam } from "@/lib/auth";
import { computeStandings } from "@/lib/sim/standings";
import TeamSubNav from "@/components/TeamSubNav";
import { teamManagerLabel } from "@/lib/team-gm";
import { fmtM } from "@/components/TeamRosterTable";
import { teamCapStatus } from "@/lib/cap";
import { money } from "@/lib/finance";

const SEASON = "2026-27";

function getTeamColors(codeOrSlug = "") {
  const c = codeOrSlug.toUpperCase();
  if (c.includes("PIT")) {
    return {
      border: "border-amber-500/40",
      glow1: "bg-amber-500/20",
      glow2: "bg-yellow-600/15",
      badge: "text-amber-400 bg-amber-500/10 border-amber-500/20",
      logoBox: "border-amber-500/50 shadow-amber-500/10",
    };
  }
  if (c.includes("EDM") || c.includes("NYI")) {
    return {
      border: "border-orange-500/40",
      glow1: "bg-orange-500/20",
      glow2: "bg-blue-600/15",
      badge: "text-orange-400 bg-orange-500/10 border-orange-500/20",
      logoBox: "border-orange-500/50 shadow-orange-500/10",
    };
  }
  if (c.includes("TOR") || c.includes("TBL") || c.includes("VAN") || c.includes("WPG")) {
    return {
      border: "border-blue-500/40",
      glow1: "bg-blue-500/20",
      glow2: "bg-sky-600/15",
      badge: "text-blue-400 bg-blue-500/10 border-blue-500/20",
      logoBox: "border-blue-500/50 shadow-blue-500/10",
    };
  }
  if (c.includes("MTL") || c.includes("CAR") || c.includes("DET") || c.includes("WSH") || c.includes("CGY") || c.includes("OTT") || c.includes("NJD") || c.includes("CHI") || c.includes("FLA")) {
    return {
      border: "border-rose-500/40",
      glow1: "bg-rose-500/20",
      glow2: "bg-red-600/15",
      badge: "text-rose-400 bg-rose-500/10 border-rose-500/20",
      logoBox: "border-rose-500/50 shadow-rose-500/10",
    };
  }
  if (c.includes("DAL") || c.includes("MIN")) {
    return {
      border: "border-emerald-500/40",
      glow1: "bg-emerald-500/20",
      glow2: "bg-green-600/15",
      badge: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
      logoBox: "border-emerald-500/50 shadow-emerald-500/10",
    };
  }
  if (c.includes("VGK") || c.includes("BOS") || c.includes("NSH")) {
    return {
      border: "border-amber-500/40",
      glow1: "bg-amber-500/20",
      glow2: "bg-yellow-600/15",
      badge: "text-amber-400 bg-amber-500/10 border-amber-500/20",
      logoBox: "border-amber-500/50 shadow-amber-500/10",
    };
  }
  if (c.includes("COL")) {
    return {
      border: "border-rose-700/40",
      glow1: "bg-rose-700/20",
      glow2: "bg-sky-700/15",
      badge: "text-rose-300 bg-rose-600/10 border-rose-600/20",
      logoBox: "border-rose-600/50 shadow-rose-600/10",
    };
  }
  if (c.includes("SJS") || c.includes("SEA")) {
    return {
      border: "border-teal-500/40",
      glow1: "bg-teal-500/20",
      glow2: "bg-cyan-600/15",
      badge: "text-teal-400 bg-teal-500/10 border-teal-500/20",
      logoBox: "border-teal-500/50 shadow-teal-500/10",
    };
  }
  return {
    border: "border-amber-500/40",
    glow1: "bg-amber-500/20",
    glow2: "bg-yellow-600/15",
    badge: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    logoBox: "border-amber-500/50 shadow-amber-500/10",
  };
}

export default async function TeamLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const team = await prisma.team.findUnique({
    where: { slug },
    include: {
      affiliateTeams: { select: { slug: true }, take: 1 },
      parentTeam: { select: { slug: true, gm: true, gmNickname: true, gmFirstName: true, gmLastName: true, passwordHash: true } },
      headCoach: { select: { name: true } },
      players: { where: { rosterType: "NHL" }, select: { capHit: true, retainedSalary: true } },
    },
  });
  if (!team) return <>{children}</>; // page handles notFound()
  const farmSlug = team.affiliateTeams[0]?.slug ?? null;
  const parentSlug = team.parentTeam?.slug ?? null;

  const [standings, canManage, lastGames, cfg] = await Promise.all([
    computeStandings(SEASON, team.league).catch(() => []),
    canManageTeam(team.id),
    prisma.game.findMany({
      where: { season: SEASON, league: team.league ?? "NHL", status: "FINAL", seriesId: null, OR: [{ homeTeamId: team.id }, { awayTeamId: team.id }] },
      orderBy: [{ gameDate: "desc" }, { id: "desc" }],
      take: 5,
      select: { winnerTeamId: true, endedIn: true },
    }),
    prisma.leagueConfig.findUnique({ where: { id: 1 }, select: { realCapUpper: true, profinhlCapUpper: true, rosterMode: true } }),
  ]);
  const isGm = canManage;

  // Expansion protection nudge — only worth a query for a signed-in GM of an NHL club.
  let pendingExpansion = 0;
  if (isGm && team.league === "NHL" && !team.isAffiliate) {
    const openDrafts = await prisma.expansionDraftState.findMany({ where: { status: "SETUP", NOT: { teamId: team.id } }, select: { id: true } });
    if (openDrafts.length > 0) {
      const submitted = await prisma.expansionProtection.count({ where: { teamId: team.id, expansionDraftId: { in: openDrafts.map((d) => d.id) } } });
      pendingExpansion = openDrafts.length - submitted;
    }
  }

  // this team's record + rank
  const row = standings.find((s: any) => s.teamId === team.id) as any;
  const confRows = row?.conference ? standings.filter((s: any) => s.conference === row.conference) : [];
  const rank = row ? confRows.findIndex((s: any) => s.teamId === team.id) + 1 : 0;
  const divRows = row?.division ? standings.filter((s: any) => s.division === row.division) : [];
  const divRank = row ? divRows.findIndex((s: any) => s.teamId === team.id) + 1 : 0;
  const ord = (n: number) => {
    const s = ["th", "st", "nd", "rd"], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };

  // Streak calculation
  let streakType = "";
  let streakCount = 0;
  for (const g of lastGames) {
    const won = g.winnerTeamId === team.id;
    const curType = won ? "W" : (g.endedIn && g.endedIn !== "REG" ? "OTL" : "L");
    if (!streakType) {
      streakType = curType;
      streakCount = 1;
    } else if (streakType === curType) {
      streakCount++;
    } else {
      break;
    }
  }
  const streakLabel = streakType ? `${streakType}${streakCount}` : "—";

  // Cap space
  const isNhl = team.league === "NHL" && !team.isAffiliate;
  const capStatus = isNhl ? await teamCapStatus(team.id).catch(() => null) : null;
  let capSpaceStr: string | null = null;
  let capSpaceSub = "under the cap";
  let capSpaceColor = "text-emerald-400";
  let capStatusLabel = "Compliant ✓";
  let capStatusColor = "text-emerald-400 border-emerald-500/30 bg-emerald-500/10";

  if (capStatus) {
    const space = capStatus.strictSpace;
    const absM = `$${(Math.abs(space) / 1_000_000).toFixed(2)}M`;
    if (space < 0) {
      capSpaceStr = `-${absM}`;
      capSpaceSub = "over the cap";
      capSpaceColor = "text-rose-400";
    } else if (capStatus.underFloorBy > 0) {
      capSpaceStr = absM;
      capSpaceSub = "under the floor";
      capSpaceColor = "text-amber-400";
    } else {
      capSpaceStr = absM;
      capSpaceSub = "under the cap";
      capSpaceColor = "text-emerald-400";
    }

    if (capStatus.overBy > 0) {
      capStatusLabel = `Over Cap (${fmtM(capStatus.overBy)})`;
      capStatusColor = "text-rose-400 border-rose-500/30 bg-rose-500/10";
    } else if (capStatus.underFloorBy > 0) {
      capStatusLabel = `Below Floor (${fmtM(capStatus.underFloorBy)})`;
      capStatusColor = "text-amber-400 border-amber-500/30 bg-amber-500/10";
    } else {
      capStatusLabel = "Compliant ✓";
      capStatusColor = "text-emerald-400 border-emerald-500/30 bg-emerald-500/10";
    }
  }

  const theme = getTeamColors(team.code || team.slug);

  return (
    <div className="space-y-6 py-2">
      {/* 1. AMBIENT HERO BANNER (FARBY KLUBU & DYNAMICKÉ ZÁHLAVIE) */}
      <div className={`relative overflow-hidden rounded-2xl border ${theme.border} bg-gradient-to-r from-black via-[#10141d] to-[#070b12] p-5 sm:p-7 shadow-2xl`}>
        {/* Glow ambient background with team colors */}
        <div className={`absolute -top-16 -left-12 w-64 h-64 ${theme.glow1} rounded-full blur-[80px] pointer-events-none`} />
        <div className={`absolute -bottom-16 right-10 w-72 h-72 ${theme.glow2} rounded-full blur-[90px] pointer-events-none`} />

        <div className="relative flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Team Identity */}
          <div className="flex items-center gap-5 text-center md:text-left flex-col md:flex-row">
            <div className={`w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-950 to-black border-2 ${theme.logoBox} p-3 flex items-center justify-center shrink-0 shadow-xl group`}>
              {team.logoUrl ? (
                <img src={team.logoUrl} alt={team.name} className="w-full h-full object-contain filter drop-shadow" />
              ) : (
                <div className="text-2xl font-black text-amber-400">{team.code || team.name[0]}</div>
              )}
            </div>
            <div>
              <div className="flex items-center justify-center md:justify-start gap-2 flex-wrap">
                {team.division && (
                  <span className={`text-xs font-mono font-bold uppercase tracking-wider ${theme.badge} px-2 py-0.5 rounded border`}>
                    {team.division.replace(/\s+division$/i, "")} Division
                  </span>
                )}
                {team.conference && (
                  <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                    {team.conference.replace(/\s+conference$/i, "")} Conference
                  </span>
                )}
                {divRank > 0 && (
                  <span className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    {(() => { const n = divRank; const sfx = n % 100 >= 11 && n % 100 <= 13 ? "th" : n % 10 === 1 ? "st" : n % 10 === 2 ? "nd" : n % 10 === 3 ? "rd" : "th"; return `${n}${sfx} in Division`; })()}
                  </span>
                )}
                {(team.league === "AHL" || team.isAffiliate) && (
                  <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 text-[10px] font-bold uppercase tracking-wider border border-emerald-500/20">
                    AHL
                  </span>
                )}
                {isGm && (
                  <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 text-[10px] font-bold uppercase tracking-wider border border-blue-500/30">
                    GM Mode
                  </span>
                )}
              </div>
              <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white mt-1.5 uppercase">
                {team.name}
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 mt-1 flex items-center justify-center md:justify-start gap-2.5 flex-wrap">
                {team.arena && (
                  <span>🏟️ {team.arena} {team.capacity ? `(${team.capacity.toLocaleString()})` : ""}</span>
                )}
                {team.arena && <span>•</span>}
                <span>👤 GM: {teamManagerLabel(team)}</span>
                <span>•</span>
                <span>👔 Coach: {team.headCoach?.name || team.coach || "TBD"}</span>
              </p>
            </div>
          </div>

          {/* Quick Season Snapshot / Pills */}
          <div className="flex items-center gap-3 shrink-0 flex-wrap justify-center">
            {row && (
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl px-4 py-2.5 text-center min-w-[90px]">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">RECORD</span>
                <span className="text-lg font-black text-white tabular-nums">{row.w}-{row.l}-{row.otl}</span>
                <span className="text-[10px] text-emerald-400 font-bold block">{row.points} {row.points === 1 ? "pt" : "pts"}</span>
              </div>
            )}
            {streakType && (
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl px-4 py-2.5 text-center min-w-[90px]">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">FORM</span>
                <span className={`text-lg font-black tabular-nums ${streakType === "W" ? "text-amber-400" : "text-rose-400"}`}>{streakLabel}</span>
                <span className="text-[10px] text-slate-400 block">{streakType === "W" ? `${streakCount}-game win streak` : `${streakCount}-game losing streak`}</span>
              </div>
            )}
            {capSpaceStr && (
              <Link
                href={`/teams/${slug}/salary`}
                className="bg-slate-900/90 hover:bg-slate-800/90 border border-slate-800 hover:border-slate-700 rounded-xl px-4 py-2.5 text-center min-w-[90px] transition-colors group"
                title={capStatus ? `Salary cap: ${money(capStatus.ceiling)}, Committed: ${money(capStatus.committed)}` : undefined}
              >
                <span className="text-[10px] font-bold text-slate-500 group-hover:text-slate-400 uppercase tracking-wider block">CAP SPACE</span>
                <span className={`text-lg font-black tabular-nums ${capSpaceColor}`}>{capSpaceStr}</span>
                <span className="text-[10px] text-slate-400 block">{capSpaceSub}</span>
              </Link>
            )}
            {capStatus && (
              <Link
                href="/salary-cap"
                className={`border rounded-xl px-4 py-2.5 text-center min-w-[90px] transition-colors hover:brightness-110 ${capStatusColor}`}
                title="Cap and floor compliance status in Cap Central"
              >
                <span className="text-[10px] font-bold uppercase tracking-wider block opacity-80">STATUS</span>
                <span className="text-xs font-black block mt-1">{capStatusLabel}</span>
              </Link>
            )}
            {!isGm && (
              <Link href={`/teams/${slug}/login`} className="bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 rounded-xl px-4 py-2.5 text-center group transition-colors min-w-[90px]">
                <span className="text-[10px] font-bold text-slate-400 group-hover:text-amber-400 uppercase tracking-wider block">PRIHLÁSENIE</span>
                <span className="text-xs font-bold text-white block mt-0.5">GM Login →</span>
              </Link>
            )}
          </div>
        </div>
      </div>

      {pendingExpansion > 0 && (
        <Link href={`/teams/${slug}/expansion-protection`}
          className="block rounded-lg border border-amber-700/60 bg-amber-950/30 px-4 py-2.5 text-sm text-amber-300 hover:bg-amber-950/50 transition-colors">
          🏒 Expansion draft protection list open — submit your protected players →
        </Link>
      )}

      <TeamSubNav slug={slug} isGm={isGm} isAffiliate={team.league === "AHL" || team.isAffiliate} farmSlug={farmSlug} parentSlug={parentSlug} />

      {children}
    </div>
  );
}
