import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { getTeamSession } from "@/lib/auth";
import TradeBuilder from "@/components/TradeBuilder";
import { proposeTrade, resubmitModifiedTrade } from "./actions";
import { packageFromTrade, type TradePackage } from "@/lib/trade-exec";
import { PageHeader, Card } from "@/components/ui";
import { cleanName } from "@/lib/playerName";

export const dynamic = "force-dynamic";

async function teamAssets(teamId: number, prospectSource: "real" | "profinhl") {
  const org = await prisma.team.findUnique({ where: { id: teamId }, select: { affiliateTeams: { select: { id: true } } } });
  const affIds = org?.affiliateTeams.map((a) => a.id) ?? [];
  const [players, picks, prospects] = await Promise.all([
    prisma.player.findMany({
      where: { OR: [{ teamId, rosterType: "NHL" }, { teamId: { in: affIds }, rosterType: "AHL" }] },
      select: { id: true, name: true, position: true, capHit: true, contractYears: true, rosterType: true, tradeClause: true, noTradeTeams: true },
      orderBy: [{ rosterType: "asc" }, { capHit: "desc" }],
    }),
    prisma.draftPick.findMany({ where: { teamId }, orderBy: [{ year: "asc" }, { round: "asc" }] }),
    prisma.prospect.findMany({ where: { teamId, source: prospectSource }, orderBy: [{ overallPick: "asc" }, { name: "asc" }] }),
  ]);
  const byName = <T extends { name: string }>(a: T, b: T) => cleanName(a.name).localeCompare(cleanName(b.name), "sk");
  return {
    players: players.slice().sort(byName).map((p) => ({ id: p.id, name: p.name, position: p.position, capHit: p.capHit ?? 0, farm: p.rosterType === "AHL", clause: p.tradeClause, noTradeTeams: p.noTradeTeams })),
    picks: picks.map((p) => ({ id: p.id, label: `${p.year} R${p.round}` })),
    prospects: prospects.slice().sort(byName).map((p) => ({ id: p.id, label: p.draftYear || p.overallPick ? `${p.name} (${p.draftYear ?? "?"}${p.overallPick ? ` #${p.overallPick}` : ""})` : p.name })),
  };
}

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
      prisma.team.findUnique({ where: { id: trade!.fromTeamId }, select: { id: true, name: true } }),
      prisma.team.findUnique({ where: { id: trade!.toTeamId }, select: { id: true, name: true } }),
    ]);
    const [mine, theirs] = await Promise.all([teamAssets(fromT!.id, src), teamAssets(toT!.id, src)]);
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
        <TradeBuilder me={{ id: fromT!.id, name: fromT!.name }} opp={{ id: toT!.id, name: toT!.name }} mine={mine} theirs={theirs} initial={initial} submitLabel="Resubmit to commission" onPropose={submitEdit} />
      </div>
    );
  }

  const teams = await prisma.team.findMany({
    where: { league: "NHL", isAffiliate: false, id: { not: myTeam.id } },
    select: { id: true, name: true }, orderBy: { name: "asc" },
  });

  const { opp } = await searchParams;
  const oppId = opp ? Number(opp) : null;
  const oppTeam = oppId ? await prisma.team.findUnique({ where: { id: oppId }, select: { id: true, name: true, logoUrl: true } }) : null;

  if (!oppTeam) {
    return (
      <div className="space-y-6 py-2">
        <PageHeader title="Trade Room" subtitle={`You are ${myTeam.name}. Pick a team to trade with.`} />
        <Card>
          <form className="flex gap-3">
            <select name="opp" defaultValue="" className="flex-1 bg-slate-900 border border-slate-700 rounded px-3 py-2">
              <option value="" disabled>Select a team…</option>
              {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <button className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 font-semibold text-sm">Open</button>
          </form>
        </Card>
      </div>
    );
  }

  const cfg = await prisma.leagueConfig.findUnique({ where: { id: 1 }, select: { rosterMode: true } });
  const prospectSource = cfg?.rosterMode === "real" ? "real" : "profinhl";
  const [mine, theirs] = await Promise.all([teamAssets(myTeam.id, prospectSource), teamAssets(oppTeam.id, prospectSource)]);

  return (
    <TradeBuilder
      me={{ id: myTeam.id, name: myTeam.name }}
      opp={{ id: oppTeam.id, name: oppTeam.name }}
      mine={mine}
      theirs={theirs}
      onPropose={proposeTrade}
    />
  );
}
