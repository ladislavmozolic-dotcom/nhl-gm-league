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

export const dynamic = "force-dynamic";

export default async function TradeBuildPage({ searchParams }: { searchParams: Promise<{ opp?: string; edit?: string }> }) {
  const session = await getTeamSession();
  if (!session) redirect("/login");
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
        <TradeBuilder me={{ id: fromT!.id, name: fromT!.name, logoUrl: fromT!.logoUrl }} opp={{ id: toT!.id, name: toT!.name, logoUrl: toT!.logoUrl }} mine={mine} theirs={theirs} meCap={mineCap} oppCap={theirsCap} initial={initial} submitLabel="Resubmit to commission" onPropose={submitEdit} />
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
    return (
      <div className="space-y-6 py-2">
        <PageHeader title="Trade Room" subtitle={`You are ${myTeam.name}. Pick a team to trade with.`}
          right={<Link href="/trades/build3" className="text-sm text-slate-400 hover:text-blue-400">+ Add a 3rd team</Link>} />
        <Card>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {teams.map((t) => (
              <Link key={t.id} href={`/trades/build?opp=${t.id}`}
                className="flex items-center gap-3 bg-slate-900/70 border border-slate-800 rounded-2xl shadow-lg shadow-black/20 px-4 py-3 hover:border-slate-600 transition-colors">
                {t.logoUrl && <img src={t.logoUrl} alt="" className="w-8 h-8 object-contain shrink-0" />}
                <span className="font-medium text-sm">{t.name}</span>
              </Link>
            ))}
          </div>
        </Card>
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
    />
  );
}
