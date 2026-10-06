import { prisma } from "@/lib/prisma";
import PlayerLink from "@/components/PlayerLink";
import Link from "next/link";
import { PageHeader, Card } from "@/components/ui";
import SortableTable, { type SortCol, type SortRow } from "@/components/SortableTable";
import { posGroup, ratingColor, ovColor } from "@/lib/ratingBands";
import { demandForPlayers, loadMarketPool, ufaAtExpiry } from "@/lib/free-agency-server";
import { getLeagueClock, getLeagueDate } from "@/lib/calendar-server";
import { cleanName } from "@/lib/playerName";
import { getTeamSession, isAdmin, isComishTier } from "@/lib/auth";
import { loadSettings } from "@/lib/sim/settings";
import FaSignLockToggle from "@/components/FaSignLockToggle";
import FrenzyAutoOpenControl from "@/components/FrenzyAutoOpenControl";
import InterestButton, { type InterestCtx } from "@/components/InterestButton";
import FrenzyBar from "@/components/FrenzyBar";
import { isWorthyGoalie } from "@/lib/goalie-rule";
import { getLang } from "@/lib/lang-server";
import FreeAgentsNav, { type FAView } from "@/components/FreeAgentsNav";
import FreeAgentSpotlight, { type SpotlightPlayer } from "@/components/FreeAgentSpotlight";
import PendingFreeAgentsView, { type PendingStats, type TeamOption } from "@/components/PendingFreeAgentsView";
import PlayerAvatar from "@/components/playerAvatar";

export const dynamic = "force-dynamic";

type FAType = "skaters" | "goalies";

const SKATER_ATTRS = ["ck", "fg", "di", "sk", "st", "en", "du", "ph", "fo", "pa", "sc", "df", "ps", "ex", "ld", "mo"];
const GOALIE_ATTRS = ["sk", "du", "en", "sz", "ag", "rb", "sc", "hs", "rt", "ph", "ps", "ex", "ld", "mo"];
const fmtM = (v: number) => (v > 0 ? `$${(v / 1_000_000).toFixed(2)}M` : "—");

export default async function FreeAgentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    type?: string;
    focus?: string;
    view?: string;
    status?: string;
    team?: string;
  }>;
}) {
  const sp = await searchParams;
  const lang = await getLang();
  const isEn = lang !== "cs";

  const view: FAView = sp.view === "pending" || sp.view === "deliberating" ? sp.view : "active";
  const type: FAType = sp.type === "goalies" ? "goalies" : "skaters";
  const isGoalie = type === "goalies";
  const focusId = sp.focus ? Number(sp.focus) : undefined;

  const cfg = await prisma.leagueConfig.findUnique({ where: { id: 1 } });
  const isReal = cfg?.rosterMode === "real";

  // Context: acting team session, commissioner, clocks
  const [clock, sessionTeamId, admin, comishTier, faSettings] = await Promise.all([
    getLeagueClock(),
    getTeamSession(),
    isAdmin(),
    isComishTier(),
    loadSettings(),
  ]);
  const isComish = admin || comishTier;
  const faSignLock = faSettings.faSignLock;
  const effWindow = clock.faWindow;

  let interestCtx: InterestCtx | null = null;
  if (sessionTeamId != null) {
    const teams = admin
      ? await prisma.team.findMany({ where: { league: "NHL" }, select: { id: true, code: true, name: true }, orderBy: { name: "asc" } })
      : await prisma.team.findMany({ where: { id: sessionTeamId }, select: { id: true, code: true, name: true } });
    const actingTeamId = teams.some((t) => t.id === sessionTeamId) ? sessionTeamId : (teams[0]?.id ?? null);
    interestCtx = {
      frenzyOpen: effWindow.open,
      immediate: effWindow.immediate,
      ownOnly: effWindow.ownOnly,
      improvementOnly: clock.frenzyOpen && clock.frenzyStage === "IMPROVEMENT",
      actingTeamId,
      teams: teams.map((t) => ({ ...t, code: t.code ?? "" })),
    };
  }

  // Pre-load market comparison pool for computing values
  const pool = await loadMarketPool();

  // Counts for tabs
  const retiredCount = isReal ? await prisma.player.count({ where: { rosterType: "RETIRED" } }) : 0;
  const myOffersCount = sessionTeamId != null
    ? await prisma.faOffer.count({
        where: { teamId: sessionTeamId, status: { in: ["PENDING", "COUNTERED", "SHORTLISTED", "ACCEPTED"] } },
      })
    : undefined;

  const pendingNhlCount = await prisma.player.count({
    where: {
      contractYears: { not: null, lte: 1 },
      rosterType: "NHL",
      team: { league: "NHL" },
    },
  });

  // =========================================================================
  // VIEW: PENDING FREE AGENTS (Expiring contracts across the league)
  // =========================================================================
  if (view === "pending") {
    const nhlTeams = await prisma.team.findMany({
      where: { league: "NHL", isAffiliate: false },
      select: { id: true, slug: true, name: true, code: true, logoUrl: true, contractPriorities: true },
      orderBy: { name: "asc" },
    });

    const selectedTeamObj = nhlTeams.find((t) => t.slug === sp.team) ?? null;
    const selectedStatus = sp.status ?? "all";
    const selectedType = sp.type ?? "all";

    const pendingPlayers = await prisma.player.findMany({
      where: {
        contractYears: { not: null, lte: 1 },
        rosterType: "NHL",
        team: { league: "NHL" },
        ...(selectedTeamObj ? { teamId: selectedTeamObj.id } : {}),
        ...(selectedType === "goalies" ? { isGoalie: true } : selectedType === "skaters" ? { isGoalie: false } : {}),
      },
      include: {
        goalieRating: true,
        team: { select: { id: true, name: true, code: true, logoUrl: true, slug: true, contractPriorities: true } },
      },
      orderBy: { overall: "desc" },
      take: 500,
    });

    // Market demands for pending players
    const pendingDemands = await demandForPlayers(pendingPlayers as any, pool);

    const stats: PendingStats = {
      total: pendingPlayers.length,
      ufa: pendingPlayers.filter((p) => ufaAtExpiry(p)).length,
      rfa: pendingPlayers.filter((p) => !ufaAtExpiry(p)).length,
      extensions: pendingPlayers.filter((p) => p.extCapHit != null).length,
    };

    const filteredPlayers = pendingPlayers.filter((p) => {
      const isUfa = ufaAtExpiry(p);
      if (selectedStatus === "ufa") return isUfa;
      if (selectedStatus === "rfa") return !isUfa;
      if (selectedStatus === "unsigned") return p.extCapHit == null;
      return true;
    });

    const pendingCols: SortCol[] = [
      { key: "name", label: isEn ? "Player" : "Hráč", kind: "player", sticky: true },
      { key: "teamCode", label: isEn ? "Team" : "Klub", kind: "team" },
      { key: "pos", label: isEn ? "Pos" : "Poz", kind: "text" },
      { key: "age", label: isEn ? "Age" : "Vek", kind: "num" },
      { key: "ovr", label: "OVR", kind: "ovr" },
      { key: "statusBadge", label: isEn ? "Expiry" : "Status", kind: "text" },
      { key: "capHit", label: "Cap Hit", kind: "money" },
      { key: "demand", label: isEn ? "Market Value" : "Odhad AAV", kind: "money", title: isEn ? "Projected open-market demand" : "Odhadovaná trhová hodnota" },
      { key: "term", label: isEn ? "Term" : "Termín", kind: "num" },
      { key: "extStatus", label: isEn ? "Extension Status" : "Stav zmluvy", kind: "text" },
    ];

    const pendingRows: SortRow[] = filteredPlayers.map((p) => {
      const ovr = p.isGoalie ? p.goalieRating?.overall ?? p.overall : p.overall;
      const isUfa = ufaAtExpiry(p);
      const d = pendingDemands.get(p.id)?.demand;
      const isPriority = p.team?.contractPriorities?.includes(p.id) ?? false;
      const hasExt = p.extCapHit != null;

      const statusBadge = (
        <span
          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold font-mono border ${
            isUfa
              ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
              : "bg-blue-500/15 text-blue-300 border-blue-500/30"
          }`}
        >
          {isUfa ? "UFA 2027" : "RFA 2027"}
        </span>
      );

      const extStatus = hasExt ? (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-mono">
          ✍️ {fmtM(p.extCapHit ?? 0)} × {p.extYears}y
        </span>
      ) : isPriority ? (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
          📌 {isEn ? "TOP Priority" : "TOP Priorita"}
        </span>
      ) : (
        <span className="text-slate-500 text-xs">{isEn ? "Eligible" : "Otvorený"}</span>
      );

      return {
        _id: p.id,
        name: p.name,
        slug: p.slug,
        photo: p.photoUrl,
        teamCode: p.team?.code ?? "",
        teamLogo: p.team?.logoUrl ?? null,
        teamSlug: p.team?.slug ?? null,
        pos: p.position,
        age: p.age,
        ovr,
        statusBadge,
        _sort_statusBadge: isUfa ? "UFA" : "RFA",
        capHit: p.capHit ?? 0,
        demand: d?.salary ?? 0,
        term: d?.years ?? 0,
        extStatus,
        _sort_extStatus: hasExt ? "Extended" : isPriority ? "Priority" : "Eligible",
      };
    });

    const teamOptions: TeamOption[] = nhlTeams.map((t) => ({
      id: t.id,
      name: t.name,
      code: t.code,
      slug: t.slug,
    }));

    return (
      <div className="space-y-6 py-2">
        <PageHeader
          title={isEn ? "Free Agent Frenzy" : "Free Agent Frenzy"}
          subtitle={
            isEn
              ? "Off-season market — open-market value from sim-weighted comparables"
              : "Trh voľných hráčov ligy — trhové hodnoty odvodené zo štatistík a porovnateľných zmlúv"
          }
        />

        <FreeAgentsNav
          view={view}
          activeCount={300}
          pendingCount={pendingNhlCount}
          deliberatingCount={0}
          myOffersCount={myOffersCount}
          retiredCount={retiredCount}
          isComish={isComish}
          isEn={isEn}
        />

        <PendingFreeAgentsView
          cols={pendingCols}
          rows={pendingRows}
          stats={stats}
          teams={teamOptions}
          selectedStatus={selectedStatus}
          selectedTeam={sp.team}
          selectedType={selectedType}
          isEn={isEn}
        />
      </div>
    );
  }

  // =========================================================================
  // VIEW: ACTIVE FREE AGENTS & WEIGHING OFFERS
  // =========================================================================
  const freeAgents = await prisma.player.findMany({
    where: {
      rosterType: { notIn: ["NHL", "AHL", "RETIRED", "PROSPECT", "RELEASED", "NONROSTER"] },
      isGoalie,
      ...(isReal ? {} : { realOnly: false }),
    },
    include: { goalieRating: true },
    orderBy: { overall: "desc" },
    take: 300,
  });

  const demands = await demandForPlayers(freeAgents as any, pool);

  // Players currently weighing offers
  const deliberators = freeAgents.filter((p: any) => p.faDecisionAt);
  const leagueDate = await getLeagueDate();
  const deadlineBase = (clock.frenzyOpen || clock.postFrenzyOpen) ? Date.now() : leagueDate.getTime();
  const offerCounts = deliberators.length
    ? await prisma.faOffer.groupBy({
        by: ["playerId"],
        where: { playerId: { in: deliberators.map((p) => p.id) }, status: { in: ["PENDING", "COUNTERED", "SHORTLISTED"] } },
        _count: true,
      })
    : [];
  const offerCountBy = new Map(offerCounts.map((o) => [o.playerId, o._count]));
  const deliberating = deliberators.map((p: any) => {
    const remainingMs = Math.max(0, new Date(p.faDecisionAt).getTime() - deadlineBase);
    return {
      id: p.id,
      name: cleanName(p.name),
      slug: p.slug,
      photoUrl: p.photoUrl,
      position: p.position,
      age: p.age,
      overall: isGoalie ? p.goalieRating?.overall ?? p.overall : p.overall,
      remainingMs,
      remaining: clock.postFrenzyOpen
        ? `${Math.ceil(remainingMs / 3_600_000)}h`
        : `${Math.ceil(remainingMs / 86_400_000)}d`,
      offers: offerCountBy.get(p.id) ?? 0,
      countered: p.faCountered,
    };
  }).sort((a, b) => a.remainingMs - b.remainingMs);

  const actingTeamId = interestCtx?.actingTeamId ?? sessionTeamId;
  const myDeciderIds = actingTeamId != null && deliberators.length
    ? new Set(
        (
          await prisma.faOffer.findMany({
            where: { playerId: { in: deliberators.map((p) => p.id) }, teamId: actingTeamId, status: { in: ["PENDING", "COUNTERED", "SHORTLISTED", "ACCEPTED"] } },
            select: { playerId: true },
          })
        ).map((o) => o.playerId)
      )
    : new Set<number>();

  const listedFreeAgents = freeAgents.filter((p: any) => !p.faDecisionAt || !p.faCountered || myDeciderIds.has(p.id));

  // Spotlight targets: top 4 available players
  const spotlightTargets: SpotlightPlayer[] = listedFreeAgents.slice(0, 4).map((p) => {
    const ovr = (isGoalie ? p.goalieRating?.overall ?? p.overall : p.overall) ?? 0;
    const d = demands.get(p.id)?.demand;
    const del = deliberating.find((x) => x.id === p.id);
    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      photoUrl: p.photoUrl,
      position: p.position,
      age: p.age,
      overall: ovr,
      lastSeasonPts: p.lastSeasonPts,
      demandSalary: d?.salary ?? 0,
      demandYears: d?.years ?? 1,
      deliberating: del ? { offers: del.offers, remaining: del.remaining, countered: del.countered } : null,
      isGoalie,
    };
  });

  // Table columns & rows
  const attrs = sessionTeamId != null ? (isGoalie ? GOALIE_ATTRS : SKATER_ATTRS) : [];
  const cols: SortCol[] = [
    { key: "name", label: isEn ? "Player" : "Hráč", kind: "player", sticky: true },
    { key: "pos", label: isEn ? "Pos" : "Poz", kind: "text" },
    { key: "age", label: isEn ? "Age" : "Vek", kind: "num" },
    { key: "ovr", label: "OVR", kind: "ovr" as const },
    { key: "lspts", label: "LS·P", kind: "num" as const, title: isEn ? "Last-season points (real)" : "Body v minulej sezóne" },
    { key: "demand", label: isEn ? "Market" : "Trh AAV", kind: "money" as const, title: isEn ? "Open-market value — median cap hit of comparable signed players" : "Trhová hodnota odhadnutá modelom" },
    { key: "term", label: isEn ? "Term" : "Termín", kind: "num" as const, title: isEn ? "Contract length requested (years)" : "Dĺžka zmluvy požadovaná hráčom" },
    ...(interestCtx ? [{ key: "interest", label: isEn ? "Sign" : "Ponuka", kind: "interest" as const, title: isEn ? "Register interest / make an offer" : "Podať ponuku" }] : []),
    ...attrs.map((a) => ({ key: a, label: a.toUpperCase(), kind: "num" as const })),
  ];

  const rows: SortRow[] = listedFreeAgents.map((p) => {
    const rr: any = isGoalie ? { ...p, ...(p.goalieRating ?? {}), mo: p.mo } : p;
    const ovr = isGoalie ? p.goalieRating?.overall ?? p.overall : p.overall;
    const grp = isGoalie ? ("G" as const) : posGroup(p.position, false);
    const d = demands.get(p.id)?.demand;
    const worthy = isGoalie && isWorthyGoalie({ overall: ovr, lastSeasonGP: p.lastSeasonGP, lastSeasonSvPct: p.lastSeasonSvPct });
    return {
      _id: p.id,
      name: p.name,
      slug: p.slug,
      photo: p.photoUrl,
      pos: p.position,
      age: p.age,
      ...Object.fromEntries(attrs.map((a) => [a, rr[a]])),
      ...Object.fromEntries(attrs.map((a) => [`_c_${a}`, ratingColor(grp, a, rr[a])])),
      ovr,
      _c_ovr: ovColor(grp, ovr),
      lspts: p.lastSeasonPts ?? 0,
      demand: d?.salary ?? 0,
      term: d?.years ?? 0,
      ...(worthy ? { _badge: <span className="ml-1 text-green-400" title="Worthy goalie — meets minimum rule">●</span> } : {}),
    };
  });

  const tab = (key: FAType, label: string) => {
    const active = type === key;
    const href = key === "skaters" ? "/free-agents?view=active" : "/free-agents?view=active&type=goalies";
    return (
      <Link
        key={key}
        href={href}
        className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
          active
            ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
            : "bg-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-700/60"
        }`}
      >
        {label}
      </Link>
    );
  };

  // Dedicated Deliberating View
  if (view === "deliberating") {
    return (
      <div className="space-y-6 py-2">
        <PageHeader
          title={isEn ? "Free Agent Frenzy" : "Free Agent Frenzy"}
          subtitle={
            isEn
              ? "Players currently weighing offers and nearing decision windows"
              : "Hráči, ktorí posudzujú ponuky od tímov a blíži sa ich rozhodnutie"
          }
        />

        <FreeAgentsNav
          view={view}
          activeCount={listedFreeAgents.length}
          pendingCount={pendingNhlCount}
          deliberatingCount={deliberating.length}
          myOffersCount={myOffersCount}
          retiredCount={retiredCount}
          isComish={isComish}
          isEn={isEn}
        />

        <div className="space-y-4">
          <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-950/20 via-[#0c1c31]/90 to-slate-900/90 p-5 shadow-xl">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <span>🕒</span> {isEn ? "Active Negotiations & Offer Deadlines" : "Prebiehajúce rokovania a časovače ponúk"}
            </h3>
            <p className="text-xs text-slate-300 mt-1 max-w-3xl leading-relaxed">
              {clock.postFrenzyOpen
                ? isEn
                  ? "Post-Frenzy: The first offer starts a 24-hour clock. Contested players open a 24-hour Improvement Stage for existing bidders."
                  : "Post-Frenzy trh: Prvá ponuka otvára 24-hodinové okno. Ak sa pridá ďalší klub, existujúci záujemcovia dostávajú ďalších 24 hodín vo fáze vylepšenia (Improvement Stage)."
                : isEn
                ? "Frenzy improvement stage: only clubs already negotiating with the player may raise before the Agent decides."
                : "Frenzy fáza vylepšenia: Iba kluby, ktoré už podali ponuku, ju môžu pred rozhodnutím agenta vylepšiť."}
            </p>
          </div>

          {deliberating.length === 0 ? (
            <Card>
              <div className="p-8 text-center text-slate-500">
                <p className="text-base">{isEn ? "No players are currently weighing offers." : "Momentálne žiadny hráč neposudzuje ponuku."}</p>
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {deliberating.map((d) => (
                <div key={d.id} className="rounded-2xl border border-amber-500/40 bg-slate-900/90 p-5 space-y-4 shadow-xl">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <PlayerAvatar src={d.photoUrl ?? null} alt={d.name} size={48} />
                      <div>
                        <Link href={d.slug ? `/players/${d.slug}` : "#"} className="font-bold text-white text-base hover:text-blue-400 transition-colors">
                          {cleanName(d.name)}
                        </Link>
                        <p className="text-xs text-slate-400">
                          {d.position} · {d.age != null ? `${d.age} ${isEn ? "yo" : "rokov"}` : ""} · <span className="font-bold text-emerald-400 font-mono">{d.overall} OVR</span>
                        </p>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono">
                      ⏱️ {d.remaining}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-400">{isEn ? "Offers received:" : "Počet ponúk:"}</span>
                      <span className="font-bold text-white font-mono">{d.offers} {isEn ? "club(s)" : "klub(y)"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">{isEn ? "Current stage:" : "Aktuálna fáza:"}</span>
                      <span className={d.countered ? "font-bold text-emerald-400 uppercase tracking-wider text-[11px]" : "font-semibold text-blue-400"}>
                        {d.countered ? (isEn ? "Improvement Stage" : "Fáza vylepšenia") : (isEn ? "Initial Bidding" : "Zber prvých ponúk")}
                      </span>
                    </div>
                  </div>

                  {interestCtx && (
                    <InterestButton
                      playerId={d.id}
                      name={cleanName(d.name)}
                      ctx={interestCtx}
                      label={d.countered ? (isEn ? "Improve Offer" : "Navýšiť ponuku") : (isEn ? "Make Offer / Join" : "Podať ponuku")}
                      className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition shadow-md shadow-blue-600/20 text-center block"
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Active Free Agents standard view
  return (
    <div className="space-y-6 py-2">
      <PageHeader
        title={isEn ? "Free Agent Frenzy" : "Free Agent Frenzy"}
        subtitle={
          isEn
            ? "Off-season market — open-market value from sim-weighted comparables"
            : "Trh voľných hráčov ligy — trhové hodnoty odvodené zo štatistík a porovnateľných zmlúv"
        }
      />

      <FreeAgentsNav
        view={view}
        activeCount={listedFreeAgents.length}
        pendingCount={pendingNhlCount}
        deliberatingCount={deliberating.length}
        myOffersCount={myOffersCount}
        retiredCount={retiredCount}
        isComish={isComish}
        isEn={isEn}
        type={type}
      />

      <FaSignLockToggle locked={faSignLock} comish={isComish} />
      <FrenzyAutoOpenControl at={cfg?.frenzyAutoOpenAt?.toISOString() ?? null} comish={isComish} faOpen={!!cfg?.faOpen} />

      <FrenzyBar
        frenzyOpen={clock.frenzyOpen}
        frenzyDay={clock.frenzyDay}
        frenzyRound={clock.frenzyRound}
        frenzyStage={clock.frenzyStage}
        postFrenzyOpen={clock.postFrenzyOpen}
        phaseLabel={clock.phaseLabel}
        isAdmin={admin}
        inSeasonOpen={!clock.frenzyOpen && effWindow.open}
        ownOnly={effWindow.ownOnly}
        frenzyRoundStartedAt={clock.frenzyRoundStartedAt}
      />

      {/* WEIGHING OFFERS QUICK TICKER */}
      {deliberating.length > 0 && (
        <div className="rounded-2xl border border-amber-700/40 bg-amber-950/20 px-4 py-3 shadow-lg">
          <div className="text-xs font-bold uppercase tracking-wider text-amber-400/90 mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <span>🕒</span> {isEn ? `Weighing offers (${deliberating.length})` : `Posudzujú ponuky (${deliberating.length})`}
            </span>
            <Link href="/free-agents?view=deliberating" className="text-[11px] text-amber-400 hover:text-amber-300 font-semibold lowercase">
              {isEn ? "view countdowns →" : "zobraziť odpočty →"}
            </Link>
          </div>
          <div className="flex flex-wrap gap-2">
            {deliberating.map((d) => (
              <span key={d.id} className="text-xs rounded-xl border border-slate-700/80 bg-slate-900/80 px-3 py-1.5 flex items-center gap-2">
                <b className="text-slate-200">
                  <PlayerLink id={d.id} name={d.name} clean={false} />
                </b>
                <span className="text-slate-400">
                  · {d.offers} {isEn ? (d.offers === 1 ? "offer" : "offers") : (d.offers === 1 ? "ponuka" : "ponuky")} ·{" "}
                  {d.countered ? (isEn ? "improvement stage, " : "vylepšenie, ") : ""}
                  {isEn ? "decides in" : "rozhodnutie za"} <b className="text-amber-300 font-mono">{d.remaining}</b>
                </span>
              </span>
            ))}
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            {clock.postFrenzyOpen
              ? isEn
                ? "Post-Frenzy: the first offer opens 24 hours; a contested player then gives existing bidders another 24 hours to improve."
                : "Post-Frenzy: prvá ponuka otvára 24 hodín; napadnutý hráč dáva existujúcim záujemcom ďalších 24 hodín na vylepšenie."
              : clock.frenzyOpen
              ? isEn
                ? "Frenzy improvement stage: only clubs already negotiating with the player may raise before the Agent decides."
                : "Frenzy fáza vylepšenia: iba kluby rokujúce s hráčom môžu pred rozhodnutím navýšiť ponuku."
              : isEn
              ? "In-season UFAs take a week to weigh offers, then give their bidders a 3-day improvement stage."
              : "Počas sezóny trvá posúdenie týždeň, potom nasleduje 3-dňová fáza vylepšenia."}
          </p>
        </div>
      )}

      {/* TOP TARGETS SPOTLIGHT CARDS */}
      <FreeAgentSpotlight players={spotlightTargets} interestCtx={interestCtx} isEn={isEn} />

      {/* POSITION FILTER TABS */}
      <div className="flex items-center gap-2 pt-2">
        {tab("skaters", isEn ? "Skaters" : "Korčuliari")}
        {tab("goalies", isEn ? "Goalies" : "Brankári")}
      </div>

      {/* DATA TABLE */}
      {freeAgents.length === 0 ? (
        <Card>
          <div className="p-8 text-center">
            <p className="text-slate-500 text-lg">
              {isEn
                ? `No free agent ${isGoalie ? "goalies" : "skaters"} available`
                : `Žiadni voľní ${isGoalie ? "brankári" : "korčuliari"} nie sú k dispozícii`}
            </p>
            <p className="text-slate-600 text-sm mt-2">
              {isEn ? "All players are currently under contract" : "Všetci hráči majú momentálne platnú zmluvu"}
            </p>
          </div>
        </Card>
      ) : (
        <Card bodyClassName="p-2">
          <SortableTable
            cols={cols}
            rows={rows}
            initialSort="demand"
            minWidth={isGoalie ? 950 : 1050}
            interestCtx={interestCtx ?? undefined}
            focusId={focusId}
            csvFilename="active-free-agents"
          />
          <p className="text-[11px] text-slate-600 px-2 pt-1">
            {isEn
              ? "Click any column to sort. Market is the player's open-market value — the median cap hit of comparably-rated signed players, adjusted for age & trajectory. His asking price at your club shows on Sign."
              : "Kliknutím na záhlavie zoradíte tabuľku. Trh AAV je odhadovaná trhová hodnota z porovnateľných zmlúv upravená o vek a trajektóriu. Konkrétne požiadavky pre váš klub nájdete pod tlačidlom Ponuka."}
          </p>
        </Card>
      )}
    </div>
  );
}
