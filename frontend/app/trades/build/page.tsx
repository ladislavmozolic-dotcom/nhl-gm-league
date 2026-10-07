import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { getTeamSession } from "@/lib/auth";
import TradeBuilder from "@/components/TradeBuilder";
import { proposeTrade, resubmitModifiedTrade } from "./actions";
import { packageFromTrade, type TradePackage } from "@/lib/trade-exec";
import { PageHeader, Card } from "@/components/ui";
import { teamAssets } from "@/lib/trade-assets";
import { teamCapStatus } from "@/lib/cap";
import { getLang } from "@/lib/lang-server";

export const dynamic = "force-dynamic";

export default async function TradeBuildPage({ searchParams }: { searchParams: Promise<{ opp?: string; edit?: string }> }) {
  const session = await getTeamSession();
  if (!session) redirect("/login");
  const lang = await getLang();
  const myTeam = await prisma.team.findUnique({ where: { id: session }, select: { id: true, name: true, logoUrl: true, slug: true } });
  if (!myTeam) redirect("/login");

  const cfgSrc = await prisma.leagueConfig.findUnique({ where: { id: 1 }, select: { rosterMode: true } });
  const src = cfgSrc?.rosterMode === "real" ? "real" : "profinhl";

  // ── MODIFY mode: a rookie GM re-opens a trade the commission asked to rebalance ──
  const { edit } = await searchParams;
  const editId = edit ? Number(edit) : null;
  if (editId) {
    const trade = await prisma.trade.findUnique({ where: { id: editId } });
    if (!trade || trade.status !== "MODIFY" || (session !== trade.fromTeamId && session !== trade.toTeamId)) redirect("/trades");
    const [fromT, toT] = await Promise.all([
      prisma.team.findUnique({ where: { id: trade!.fromTeamId }, select: { id: true, name: true, logoUrl: true } }),
      prisma.team.findUnique({ where: { id: trade!.toTeamId }, select: { id: true, name: true, logoUrl: true } }),
    ]);
    const [mine, theirs, mineCap, theirsCap] = await Promise.all([teamAssets(fromT!.id, src), teamAssets(toT!.id, src), teamCapStatus(fromT!.id), teamCapStatus(toT!.id)]);
    const pkg = await packageFromTrade(editId);
    const initial = {
      mineP: Object.fromEntries(pkg.fromPlayers.map((p) => [p.playerId, p.retentionPct || 0])),
      theirsP: Object.fromEntries(pkg.toPlayers.map((p) => [p.playerId, p.retentionPct || 0])),
      minePk: pkg.fromPicks, theirsPk: pkg.toPicks, minePro: pkg.fromProspects, theirsPro: pkg.toProspects,
      mineCash: pkg.fromCash, theirsCash: pkg.toCash, condition: pkg.condition,
    };
    async function submitEdit(p: TradePackage) { "use server"; const r = await resubmitModifiedTrade(p, editId!); return { tradeId: r.tradeId }; }
    return (
      <div className="space-y-4 py-2">
        <PageHeader title={`Modify trade #${editId}`} subtitle={`${fromT!.name} ↔ ${toT!.name} — the commission asked you to rebalance this deal. Adjust the assets and resubmit for review.`} />
        {trade!.commishNote && <Card><p className="text-sm text-amber-300">✏️ Commission note: {trade!.commishNote}</p></Card>}
        <TradeBuilder me={{ id: fromT!.id, name: fromT!.name, logoUrl: fromT!.logoUrl }} opp={{ id: toT!.id, name: toT!.name, logoUrl: toT!.logoUrl }} mine={mine} theirs={theirs} meCap={mineCap} oppCap={theirsCap} initial={initial} submitLabel="Resubmit to commission" onPropose={submitEdit} lang={lang} />
      </div>
    );
  }

  const teams = await prisma.team.findMany({
    where: { league: "NHL", isAffiliate: false, id: { not: myTeam.id } },
    select: { id: true, name: true, logoUrl: true }, orderBy: { name: "asc" },
  });

  const { opp } = await searchParams;
  const oppId = opp ? Number(opp) : null;
  const oppTeam = oppId ? await prisma.team.findUnique({ where: { id: oppId }, select: { id: true, name: true, logoUrl: true } }) : null;

  if (!oppTeam) {
    const isSk = lang === "cs";
    return (
      <div className="max-w-7xl mx-auto space-y-6 py-2 px-3 sm:px-6">
        <PageHeader
          title={isSk ? "Trade Room — Výber partnera" : "Trade Room — Pick Opponent"}
          subtitle={
            isSk
              ? `Ste manažérom ${myTeam.name}. Vyberte klub, s ktorým chcete zahájiť vyjednávanie o výmene.`
              : `You are managing ${myTeam.name}. Select a team to enter the Trade Room with.`
          }
          right={
            <div className="flex items-center gap-3">
              <Link
                href="/trades"
                className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-white hover:border-slate-700 transition-colors"
              >
                {isSk ? "← Späť na Výměny" : "← Back to Trades"}
              </Link>
              <Link
                href="/trades/build3"
                className="px-3 py-1.5 rounded-xl bg-cyan-950/60 border border-cyan-800/60 text-xs font-bold text-cyan-300 hover:bg-cyan-900/60 transition-colors"
              >
                {isSk ? "+ Pridať 3. tím" : "+ Add a 3rd team"}
              </Link>
            </div>
          }
        />
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 shadow-xl backdrop-blur-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {teams.map((t) => (
              <Link
                key={t.id}
                href={`/trades/build?opp=${t.id}`}
                className="flex items-center gap-3 bg-slate-950/60 border border-slate-800/90 rounded-2xl p-3.5 hover:border-cyan-500/60 hover:bg-slate-900/80 transition-all duration-200 group shadow-md"
              >
                <div className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-800/80 p-1 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  {t.logoUrl ? (
                    <img src={t.logoUrl} alt={t.name} className="w-7 h-7 object-contain" />
                  ) : (
                    <span>🏒</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-sm text-white truncate group-hover:text-cyan-300 transition-colors">
                    {t.name}
                  </div>
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                    {isSk ? "Začať rokovania →" : "Trade Room →"}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const cfg = await prisma.leagueConfig.findUnique({ where: { id: 1 }, select: { rosterMode: true } });
  const prospectSource = cfg?.rosterMode === "real" ? "real" : "profinhl";
  const [mine, theirs, mineCap, theirsCap] = await Promise.all([
    teamAssets(myTeam.id, prospectSource), teamAssets(oppTeam.id, prospectSource),
    teamCapStatus(myTeam.id), teamCapStatus(oppTeam.id),
  ]);

  return (
    <TradeBuilder
      me={{ id: myTeam.id, name: myTeam.name, logoUrl: myTeam.logoUrl }}
      opp={{ id: oppTeam.id, name: oppTeam.name, logoUrl: oppTeam.logoUrl }}
      mine={mine}
      theirs={theirs}
      meCap={mineCap}
      oppCap={theirsCap}
      onPropose={proposeTrade}
      lang={lang}
    />
  );
}
