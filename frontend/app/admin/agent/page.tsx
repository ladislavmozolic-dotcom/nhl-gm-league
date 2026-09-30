import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card, BackPill } from "@/components/ui";
import { cleanName } from "@/lib/playerName";
import DeleteFaOfferButton from "@/components/DeleteFaOfferButton";
import AdminResignTable, { type ResignRowData } from "@/components/admin/AdminResignTable";
import { getLeagueClock } from "@/lib/calendar-server";
import { loadSettings } from "@/lib/sim/settings";
import {
  loadMarketPool,
  teamContentionMap,
  teamChurnMap,
  teamAsk,
  ufaAtExpiry,
} from "@/lib/free-agency-server";
import { slotLabel } from "@/lib/free-agency";

export const dynamic = "force-dynamic";

const ACTIVE_OFFERS = ["PENDING", "COUNTERED", "SHORTLISTED"];
const fmtM = (c: number) => `$${(c / 1e6).toFixed(2)}M`;
const fmtDate = (d: Date) =>
  d.toLocaleString("sk-SK", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

export default async function AdminAgentPage() {
  const clock = await getLeagueClock();

  // 1. Free Agent Frenzy: open-market standing offers
  const rawOffers = await prisma.faOffer.findMany({
    where: { status: { in: ACTIVE_OFFERS } },
    orderBy: { updatedAt: "desc" },
  });

  const [offerPlayers, offerTeams] = await Promise.all([
    prisma.player.findMany({
      where: { id: { in: rawOffers.map((o) => o.playerId) } },
      select: { id: true, name: true, slug: true, position: true, overall: true },
    }),
    prisma.team.findMany({
      where: { id: { in: rawOffers.map((o) => o.teamId) } },
      select: { id: true, name: true, code: true, logoUrl: true },
    }),
  ]);

  const offerPlayerById = new Map(offerPlayers.map((p) => [p.id, p]));
  const offerTeamById = new Map(offerTeams.map((t) => [t.id, t]));
  const marketOffers = rawOffers
    .map((o) => ({
      ...o,
      player: offerPlayerById.get(o.playerId),
      team: offerTeamById.get(o.teamId),
    }))
    .filter(
      (o): o is typeof o & {
        player: NonNullable<typeof o.player>;
        team: NonNullable<typeof o.team>;
      } => !!o.player && !!o.team
    );

  // 2. Team Re-signings: own-club live or stalled extension talks
  const [resigns, settings, marketPool, cmap, churnMap] = await Promise.all([
    prisma.player.findMany({
      where: {
        OR: [
          { resignStatus: { in: ["open", "countered", "walkedToUFA", "osEligible"] } },
          { resignRound: { gt: 0 } },
        ],
      },
      select: {
        id: true,
        name: true,
        slug: true,
        position: true,
        age: true,
        birthDate: true,
        overall: true,
        capHit: true,
        contractYears: true,
        teamId: true,
        resignStatus: true,
        resignRound: true,
        resignOfferSalary: true,
        resignOfferAt: true,
        resignCounterSalary: true,
        resignCounterYears: true,
        faDemandOverride: true,
        franchiseTag: true,
        rfaOsUsed: true,
        rightsReleased: true,
        disgruntled: true,
        tradeRequested: true,
        iceWarnedAt: true,
        promiseWarnGame: true,
        team: {
          select: { id: true, name: true, code: true, logoUrl: true },
        },
      },
      orderBy: [{ resignStatus: "asc" }, { id: "desc" }],
    }),
    loadSettings(),
    loadMarketPool(),
    teamContentionMap(),
    teamChurnMap(),
  ]);

  // Load lowballs for players currently in talks
  const lowballRows = await prisma.faLowball.findMany({
    where: { playerId: { in: resigns.map((p) => p.id) } },
  });
  const lowballMap = new Map<string, number>(
    lowballRows.map((l) => [`${l.playerId}_${l.teamId}`, l.bump])
  );

  // Deep AI valuation evaluation for each player
  const resignRows: ResignRowData[] = await Promise.all(
    resigns.map(async (p) => {
      const isUfa = settings.faMode === "simple" || ufaAtExpiry(p);
      const cbaStatus: "UFA" | "RFA" = isUfa ? "UFA" : "RFA";
      const bump = p.teamId ? lowballMap.get(`${p.id}_${p.teamId}`) ?? 1 : 1;

      let aiAskSalary: number | null = null;
      let aiFloorSalary: number | null = null;
      let aiMinYears: number | null = null;
      let aiMaxYears: number | null = null;
      let desiredRole: string | null = null;

      if (p.teamId) {
        try {
          const info = await teamAsk(p.id, p.teamId, marketPool, cmap, undefined, churnMap);
          if (info) {
            aiAskSalary = info.ask.salary;
            aiFloorSalary = info.ask.floorSalary;
            aiMinYears = info.ask.minYears;
            aiMaxYears = info.ask.maxYears;
            desiredRole = `${slotLabel(info.slot)}${info.desired.wantPP ? " (PP)" : ""}${info.desired.wantPK ? " (PK)" : ""}`;
          }
        } catch {
          // ignore valuation error if edge case occurs
        }
      }

      return {
        id: p.id,
        name: p.name,
        slug: p.slug,
        position: p.position,
        age: p.age,
        overall: p.overall,
        capHit: p.capHit,
        contractYears: p.contractYears,
        teamId: p.teamId,
        teamCode: p.team?.code ?? null,
        teamName: p.team?.name ?? null,
        teamLogoUrl: p.team?.logoUrl ?? null,
        resignStatus: p.resignStatus,
        resignRound: p.resignRound,
        resignOfferSalary: p.resignOfferSalary,
        resignOfferAt: p.resignOfferAt,
        resignCounterSalary: p.resignCounterSalary,
        resignCounterYears: p.resignCounterYears,
        faDemandOverride: p.faDemandOverride,
        lowballBump: bump,
        cbaStatus,
        franchiseTag: p.franchiseTag,
        rfaOsUsed: p.rfaOsUsed,
        disgruntled: p.disgruntled,
        tradeRequested: p.tradeRequested,
        iceWarnedAt: p.iceWarnedAt,
        promiseWarnGame: p.promiseWarnGame,
        aiAskSalary,
        aiFloorSalary,
        aiMinYears,
        aiMaxYears,
        desiredRole,
      };
    })
  );

  // Summary KPI counters
  const activeNegotiations = resignRows.filter((r) =>
    ["open", "countered"].includes(r.resignStatus ?? "")
  ).length;
  const stalledNegotiations = resignRows.filter((r) =>
    ["walkedToUFA", "osEligible"].includes(r.resignStatus ?? "")
  ).length;
  const insultedCount = resignRows.filter((r) => r.lowballBump > 1).length;

  const phaseLabel: Record<string, string> = {
    regular: "Základná časť",
    playoffs: "Play-off",
    frenzy: "Free Agent Frenzy",
    offseason: "Medzisezóna",
    draft: "Draft",
  };

  return (
    <div className="space-y-6 py-2">
      {/* Page Header */}
      <PageHeader
        title="🤖 AI Agent & Vyjednávania"
        subtitle="Riadenie a dohľad nad automatickým vyjednávacím enginom ligy (Free Agent Frenzy & Team Re-signings)."
        right={
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-slate-800 text-sky-400 border border-slate-700">
              {phaseLabel[clock.phase] ?? clock.phase}
            </span>
            <BackPill href="/admin">Admin</BackPill>
          </div>
        }
      />

      {/* KPI Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-lg shadow-black/20">
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold uppercase tracking-wider mb-2">
            <span>Trh FA Frenzy</span>
            <span className="text-blue-400">🌐</span>
          </div>
          <div className="text-2xl font-black text-white">{marketOffers.length}</div>
          <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
            <span>{rawOffers.filter((o) => o.status === "PENDING").length} čakajúcich</span>
            <span>•</span>
            <span>{rawOffers.filter((o) => o.status === "COUNTERED").length} protinávrhov</span>
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-lg shadow-black/20">
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold uppercase tracking-wider mb-2">
            <span>Aktívne predĺženia</span>
            <span className="text-emerald-400">🤝</span>
          </div>
          <div className="text-2xl font-black text-emerald-400">{activeNegotiations}</div>
          <div className="text-xs text-slate-500 mt-1">
            {resignRows.filter((r) => r.resignStatus === "countered").length} s aktívnym protinávrhom
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-lg shadow-black/20">
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold uppercase tracking-wider mb-2">
            <span>Prerušené / UFA</span>
            <span className="text-rose-400">🛑</span>
          </div>
          <div className="text-2xl font-black text-rose-400">{stalledNegotiations}</div>
          <div className="text-xs text-slate-500 mt-1">
            {resignRows.filter((r) => r.resignStatus === "walkedToUFA").length} odišlo na trh UFA
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-lg shadow-black/20">
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold uppercase tracking-wider mb-2">
            <span>Nálada & Morálka</span>
            <span className="text-amber-400">😠</span>
          </div>
          <div className="text-2xl font-black text-amber-400">{insultedCount}</div>
          <div className="text-xs text-slate-500 mt-1">
            {resignRows.filter((r) => r.tradeRequested).length} žiada trade
          </div>
        </div>
      </div>

      {/* Card 1: Team Re-signings (Promoted to Primary Position) */}
      <Card
        title="Predlžovanie zmlúv v kluboch (Team Re-signings)"
        accent="text-emerald-400"
        right={
          <span className="text-xs text-slate-400 font-normal">
            Celkovo {resignRows.length} sledovaných hráčov
          </span>
        }
      >
        <AdminResignTable rows={resignRows} />
      </Card>

      {/* Card 2: Free Agent Frenzy Market Offers */}
      <Card
        title="Otvorený trh: Free Agent Frenzy"
        accent="text-blue-400"
        right={
          <span className="text-xs text-slate-400 font-normal">
            {marketOffers.length} otvorených ponúk na trhu
          </span>
        }
      >
        {marketOffers.length === 0 ? (
          <div className="text-center py-10 px-4 border border-dashed border-slate-800 rounded-2xl mx-4 my-2">
            <p className="text-slate-500 text-sm font-medium">Momentálne na trhu nie sú žiadne aktívne ponuky.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[760px]">
              <thead>
                <tr className="text-xs text-slate-400 uppercase tracking-wider border-b border-slate-800 bg-slate-800/40">
                  <th className="text-left px-4 py-3 font-semibold">Hráč</th>
                  <th className="text-left px-3 py-3 font-semibold">Klub</th>
                  <th className="text-left px-3 py-3 font-semibold">Stav ponuky</th>
                  <th className="text-right px-3 py-3 font-semibold">Výška & Dĺžka</th>
                  <th className="text-right px-3 py-3 font-semibold">Podaná / Zmena</th>
                  <th className="text-right px-4 py-3 font-semibold">Akcia</th>
                </tr>
              </thead>
              <tbody>
                {marketOffers.map((o) => {
                  let statusBadge = (
                    <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-slate-700/50 text-slate-300">
                      {o.status}
                    </span>
                  );
                  if (o.status === "PENDING") {
                    statusBadge = (
                      <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30">
                        Čaká na rozhodnutie
                      </span>
                    );
                  } else if (o.status === "COUNTERED") {
                    statusBadge = (
                      <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        Protinávrh
                      </span>
                    );
                  } else if (o.status === "SHORTLISTED") {
                    statusBadge = (
                      <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                        Užší výber (Shortlist)
                      </span>
                    );
                  }

                  return (
                    <tr
                      key={o.id}
                      className="border-b border-slate-800/40 last:border-0 hover:bg-slate-800/30 transition"
                    >
                      <td className="px-4 py-3 font-medium">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/admin/bids/${o.playerId}`}
                            className="font-bold text-white hover:text-blue-400 transition"
                            title="Zobraziť históriu ponúk"
                          >
                            {cleanName(o.player.name)}
                          </Link>
                          {o.player.position && (
                            <span className="text-[11px] font-semibold px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
                              {o.player.position}
                            </span>
                          )}
                          {o.player.overall && (
                            <span className="text-[11px] font-black px-1.5 py-0.2 rounded bg-blue-950/60 text-blue-300 border border-blue-900/50">
                              {o.player.overall}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          <Link
                            href={`/players/${o.player.slug ?? o.player.id}`}
                            className="hover:text-blue-400 transition"
                          >
                            profil hráča →
                          </Link>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          {o.team.logoUrl ? (
                            <Image
                              src={o.team.logoUrl}
                              alt={o.team.code ?? "Team"}
                              width={20}
                              height={20}
                              className="object-contain shrink-0"
                            />
                          ) : null}
                          <div>
                            <span className="font-bold text-slate-200">
                              {o.team.code ?? o.team.name}
                            </span>
                            {o.team.code && (
                              <span className="text-[11px] text-slate-500 block truncate max-w-[120px]">
                                {o.team.name}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">{statusBadge}</td>
                      <td className="px-3 py-3 text-right tabular-nums font-mono">
                        <span className="font-bold text-white">{fmtM(o.salary)}</span>
                        <span className="text-slate-400 text-xs ml-1">× {o.years}r</span>
                      </td>
                      <td className="px-3 py-3 text-right text-xs tabular-nums whitespace-nowrap font-mono">
                        <div className="font-semibold text-slate-200">
                          {fmtDate(o.createdAt)}
                        </div>
                        {o.updatedAt && Math.abs(new Date(o.updatedAt).getTime() - new Date(o.createdAt).getTime()) > 60_000 && (
                          <div className="text-[10px] text-slate-400">
                            zmena {fmtDate(o.updatedAt)}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <DeleteFaOfferButton offerId={o.id} name={cleanName(o.player.name)} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

