import { prisma } from "@/lib/prisma";
import PlayerLink from "@/components/PlayerLink";
import Link from "next/link";
import { PageHeader, Card } from "@/components/ui";
import SortableTable, { type SortCol } from "@/components/SortableTable";
import { posGroup, ratingColor, ovColor } from "@/lib/ratingBands";
import { demandForPlayers, loadMarketPool } from "@/lib/free-agency-server";
import { getLeagueClock, getLeagueDate } from "@/lib/calendar-server";
import { cleanName } from "@/lib/playerName";
import { getTeamSession, isAdmin, isComishTier } from "@/lib/auth";
import { loadSettings } from "@/lib/sim/settings";
import FaSignLockToggle from "@/components/FaSignLockToggle";
import type { InterestCtx } from "@/components/InterestButton";
import FrenzyBar from "@/components/FrenzyBar";

export const dynamic = "force-dynamic";

type FAType = "skaters" | "goalies";

const SKATER_ATTRS = ["ck", "fg", "di", "sk", "st", "en", "du", "ph", "fo", "pa", "sc", "df", "ps", "ex", "ld", "mo"];
const GOALIE_ATTRS = ["sk", "du", "en", "sz", "ag", "rb", "sc", "hs", "rt", "ph", "ps", "ex", "ld", "mo"];
const ovrColor = (v: number) => (v >= 80 ? "text-green-400" : v >= 70 ? "text-blue-400" : v >= 60 ? "text-yellow-400" : "text-slate-400");

export default async function FreeAgentsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const sp = await searchParams;
  const type: FAType = sp.type === "goalies" ? "goalies" : "skaters";
  const isGoalie = type === "goalies";

  const cfg = await prisma.leagueConfig.findUnique({ where: { id: 1 } });
  const isReal = cfg?.rosterMode === "real";

  // free agents = players not on an active NHL/AHL roster and not retired
  const freeAgents = await prisma.player.findMany({
    where: {
      rosterType: { notIn: ["NHL", "AHL", "RETIRED", "PROSPECT", "RELEASED"] },
      isGoalie,
      // real-dataset-only players (real free agents) are hidden in ProfiNHL mode
      ...(isReal ? {} : { realOnly: false }),
    },
    include: { goalieRating: true },
    orderBy: { overall: "desc" },
    take: 300,
  });

  const retiredCount = isReal
    ? await prisma.player.count({ where: { rosterType: "RETIRED" } })
    : 0;

  // market-value engine: value every free agent against the whole league of
  // signed contracts (sim-weighted SC/PA/DF comparables), then age/trend-adjust.
  const pool = await loadMarketPool();
  const demands = await demandForPlayers(freeAgents as any, pool);

  // signing context: who am I acting for, and is the market open?
  const [clock, sessionTeamId, admin, comishTier, faSettings] = await Promise.all([getLeagueClock(), getTeamSession(), isAdmin(), isComishTier(), loadSettings()]);
  const isComish = admin || comishTier;
  const faSignLock = faSettings.faSignLock;
  let interestCtx: InterestCtx | null = null;
  if (sessionTeamId != null) {
    const teams = admin
      ? await prisma.team.findMany({ where: { league: "NHL" }, select: { id: true, code: true, name: true }, orderBy: { name: "asc" } })
      : await prisma.team.findMany({ where: { id: sessionTeamId }, select: { id: true, code: true, name: true } });
    const actingTeamId = teams.some((t) => t.id === sessionTeamId) ? sessionTeamId : (teams[0]?.id ?? null);
    interestCtx = { frenzyOpen: clock.faWindow.open, immediate: clock.faWindow.immediate, ownOnly: clock.faWindow.ownOnly, actingTeamId, teams: teams.map((t) => ({ ...t, code: t.code ?? "" })) };
  }

  // in-season deliberation: free agents currently weighing offers (7-day window, then
  // a counter round). Show who's deciding + how many clubs are in + days left.
  const deliberators = freeAgents.filter((p: any) => p.faDecisionAt);
  const leagueDate = await getLeagueDate();
  const offerCounts = deliberators.length
    ? await prisma.faOffer.groupBy({ by: ["playerId"], where: { playerId: { in: deliberators.map((p) => p.id) }, status: { in: ["PENDING", "COUNTERED", "SHORTLISTED"] } }, _count: true })
    : [];
  const offerCountBy = new Map(offerCounts.map((o) => [o.playerId, o._count]));
  const deliberating = deliberators.map((p: any) => ({
    id: p.id, name: cleanName(p.name),
    days: Math.max(0, Math.ceil((new Date(p.faDecisionAt).getTime() - leagueDate.getTime()) / 86400000)),
    offers: offerCountBy.get(p.id) ?? 0, countered: p.faCountered,
  })).sort((a, b) => a.days - b.days);

  const attrs = isGoalie ? GOALIE_ATTRS : SKATER_ATTRS;
  const cols: SortCol[] = [
    { key: "name", label: "Player", kind: "player", sticky: true },
    { key: "pos", label: "Pos", kind: "text" },
    { key: "age", label: "Age", kind: "num" },
    { key: "ovr", label: "OVR", kind: "ovr" as const },
    { key: "lspts", label: "LS·P", kind: "num" as const, title: "Last-season points (real, imported from the Players Calculator)" },
    { key: "demand", label: "Market", kind: "money" as const, title: "Open-market value — median cap hit of comparable signed players, age/trend-adjusted" },
    { key: "term", label: "Term", kind: "num" as const, title: "Contract length the player is looking for (years); a down season → 1yr prove-it deal" },
    ...(interestCtx ? [{ key: "interest", label: "Sign", kind: "interest" as const, title: "Register interest / make an offer" }] : []),
    ...attrs.map((a) => ({ key: a, label: a.toUpperCase(), kind: "num" as const })),
  ];
  const rows = freeAgents.map((p) => {
    const rr: any = isGoalie ? { ...p, ...(p.goalieRating ?? {}) } : p;
    const ovr = isGoalie ? p.goalieRating?.overall ?? p.overall : p.overall;
    const grp = isGoalie ? ("G" as const) : posGroup(p.position, false);
    const d = demands.get(p.id)?.demand;
    return {
      _id: p.id, name: p.name, slug: p.slug, photo: p.photoUrl,
      pos: p.position, age: p.age,
      ...Object.fromEntries(attrs.map((a) => [a, rr[a]])),
      ...Object.fromEntries(attrs.map((a) => [`_c_${a}`, ratingColor(grp, a, rr[a])])),
      ovr, _c_ovr: ovColor(grp, ovr), lspts: p.lastSeasonPts ?? 0, demand: d?.salary ?? 0, term: d?.years ?? 0,
    };
  });

  const tab = (key: FAType, label: string) => {
    const active = type === key;
    const href = key === "skaters" ? "/free-agents" : "/free-agents?type=goalies";
    return (
      <Link
        key={key}
        href={href}
        className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
          active
            ? "bg-blue-600 text-white"
            : "bg-slate-800/60 text-slate-400 hover:text-slate-200"
        }`}
      >
        {label}
      </Link>
    );
  };

  return (
    <div className="space-y-6 py-2">
      <PageHeader
        title="Free Agent Frenzy"
        subtitle="Off-season market — open-market value from sim-weighted comparables"
        right={retiredCount > 0 ? (
          <Link href="/retired" className="text-sm text-slate-400 hover:text-blue-400 whitespace-nowrap">
            Retired players ({retiredCount}) →
          </Link>
        ) : undefined}
      />

      <FaSignLockToggle locked={faSignLock} comish={isComish} />

      <FrenzyBar
        frenzyOpen={clock.frenzyOpen}
        frenzyDay={clock.frenzyDay}
        frenzyRound={clock.frenzyRound}
        phaseLabel={clock.phaseLabel}
        isAdmin={admin}
        inSeasonOpen={!clock.frenzyOpen && clock.faWindow.open}
        ownOnly={clock.faWindow.ownOnly}
      />

      {deliberating.length > 0 && (
        <div className="rounded-xl border border-amber-700/40 bg-amber-950/20 px-4 py-3">
          <div className="text-xs font-bold uppercase tracking-wider text-amber-400/90 mb-1.5">🕒 Weighing offers ({deliberating.length})</div>
          <div className="flex flex-wrap gap-2">
            {deliberating.map((d) => (
              <span key={d.id} className="text-xs rounded-lg border border-slate-700 bg-slate-900/60 px-2.5 py-1">
                <b className="text-slate-200"><PlayerLink id={d.id} name={d.name} clean={false} /></b>
                <span className="text-slate-500"> · {d.offers} offer{d.offers === 1 ? "" : "s"} · {d.countered ? "countered, " : ""}decides in {d.days}d</span>
              </span>
            ))}
          </div>
          <p className="text-[11px] text-slate-500 mt-2">In-season UFAs take a week to weigh their offers (more clubs can bid), then counter the bidders — they sign a few days later. Get your offer in before the clock runs out.</p>
        </div>
      )}

      <div className="flex items-center gap-2">
        {tab("skaters", "Skaters")}
        {tab("goalies", "Goalies")}
      </div>

      {freeAgents.length === 0 ? (
        <Card>
          <div className="p-8 text-center">
            <p className="text-slate-500 text-lg">
              No free agent {isGoalie ? "goalies" : "skaters"} available
            </p>
            <p className="text-slate-600 text-sm mt-2">All players are currently under contract</p>
          </div>
        </Card>
      ) : (
        <Card bodyClassName="p-2">
          <SortableTable cols={cols} rows={rows} initialSort="demand" minWidth={isGoalie ? 950 : 1050} interestCtx={interestCtx ?? undefined} />
          <p className="text-[11px] text-slate-600 px-2 pt-1">Click any column to sort. <b>Market</b> is the player&apos;s open-market value — the median cap hit of comparably-rated signed players (weighted by the attributes the sim rewards: SC/PA for forwards, DF/PA for defense, AG/RB for goalies), adjusted for age &amp; trajectory. His actual asking price at <em>your</em> club (role &amp; contention) shows on <b>Interest</b>.</p>
        </Card>
      )}
    </div>
  );
}
