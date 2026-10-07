import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getTeamSession, isAdmin, isCommission } from "@/lib/auth";
import { money } from "@/lib/finance";
import { PageHeader } from "@/components/ui";
import { displayName, epProfileUrl } from "@/lib/playerName";
import TradesClientView, {
  type EnrichedTrade,
  type EnrichedGroup,
  type EnrichedTradeAsset,
  type EnrichedTeam,
} from "@/components/TradesClientView";

export const dynamic = "force-dynamic";

export default async function TradesPage() {
  const [session, admin, commission, trades, teams] = await Promise.all([
    getTeamSession(),
    isAdmin(),
    isCommission(),
    // 3-team trade legs (groupId set) are shown separately below, with their own
    // group-level accept/decline.
    prisma.trade.findMany({ where: { groupId: null }, take: 100, orderBy: { createdAt: "desc" } }),
    prisma.team.findMany({
      select: {
        id: true,
        name: true,
        code: true,
        logoUrl: true,
        rookieGm: true,
        gm: true,
        gmNickname: true,
        slug: true,
      },
    }),
  ]);

  const commishQueue = await prisma.trade.count({
    where: { status: { in: ["AWAITING_COMMISH", "MODIFIED"] } },
  });

  const teamById = new Map(teams.map((t) => [t.id, t]));
  const assets = await prisma.tradeAsset.findMany({
    where: { tradeId: { in: trades.map((t) => t.id) } },
  });

  // Batch-resolve players, prospects, and draft picks
  const playerIds = assets.filter((a) => a.playerId).map((a) => a.playerId!) as number[];
  const prospectIds = assets.filter((a) => a.prospectId).map((a) => a.prospectId!) as number[];
  const pickIds = assets.filter((a) => a.draftPickId).map((a) => a.draftPickId!) as number[];

  const [players, prospects, picks] = await Promise.all([
    prisma.player.findMany({
      where: { id: { in: playerIds } },
      select: { id: true, name: true, photoUrl: true, position: true, capHit: true, slug: true },
    }),
    prisma.prospect.findMany({
      where: { id: { in: prospectIds } },
      select: { id: true, name: true, position: true, epUrl: true },
    }),
    prisma.draftPick.findMany({
      where: { id: { in: pickIds } },
      select: { id: true, year: true, round: true, ownerLogoId: true },
    }),
  ]);

  const pMap = new Map(players.map((p) => [p.id, p]));
  const proMap = new Map(prospects.map((p) => [p.id, p]));

  // Resolve original pick owner teams
  const origTeams = picks.length
    ? await prisma.team.findMany({
        where: { profinhlLogoId: { in: picks.map((p) => p.ownerLogoId).filter((x): x is number => x != null) } },
        select: { profinhlLogoId: true, code: true, name: true, logoUrl: true },
      })
    : [];
  const teamByLogoId = new Map(origTeams.map((t) => [t.profinhlLogoId, t]));
  const pickInfo = new Map(
    picks.map((p) => [
      p.id,
      {
        year: p.year,
        round: p.round,
        label: `${p.year} R${p.round}`,
        origTeam: teamByLogoId.get(p.ownerLogoId) ?? null,
      },
    ])
  );

  const labelsFor = (tradeId: number, side: "FROM" | "TO"): EnrichedTradeAsset[] =>
    assets
      .filter((a) => a.tradeId === tradeId && a.side === side)
      .map((a): EnrichedTradeAsset => {
        if (a.assetType === "PLAYER") {
          const p = pMap.get(a.playerId ?? -1);
          const pNameClean = displayName(p?.name ?? "Player");
          return {
            assetType: "PLAYER",
            name: pNameClean,
            text: `${pNameClean}${a.retentionPct ? ` (${a.retentionPct}% ret.)` : ""}`,
            photoUrl: p?.photoUrl ?? null,
            position: p?.position ?? null,
            capHit: p?.capHit ?? null,
            retentionPct: a.retentionPct ?? null,
            href: p?.slug ? `/players/${p.slug}` : p?.id ? `/players/${p.id}` : null,
          };
        }
        if (a.assetType === "PROSPECT") {
          const pro = proMap.get(a.prospectId ?? -1);
          const proNameClean = displayName(pro?.name ?? "Prospect");
          return {
            assetType: "PROSPECT",
            name: proNameClean,
            text: `⭐ ${proNameClean}`,
            position: pro?.position ?? null,
            href: pro?.epUrl ?? epProfileUrl(proNameClean),
            external: true,
          };
        }
        if (a.assetType === "PICK") {
          const info = pickInfo.get(a.draftPickId ?? -1);
          const orig = info?.origTeam;
          return {
            assetType: "PICK",
            text: `🎫 ${info?.label ?? "Pick"}${orig ? ` (${orig.code ?? orig.name})` : ""}`,
            pickYear: info?.year ?? null,
            pickRound: info?.round ?? null,
            origTeamCode: orig?.code ?? orig?.name ?? null,
            origTeamLogo: orig?.logoUrl ?? null,
          };
        }
        if (a.assetType === "CASH") {
          return {
            assetType: "CASH",
            text: `💵 ${money(a.cashAmount ?? 0)}`,
            cashAmount: a.cashAmount ?? null,
          };
        }
        return {
          assetType: "OTHER",
          text: a.assetType,
        };
      });

  const fmtDate = (d: Date) =>
    `${d.getUTCDate()}.${d.getUTCMonth() + 1}.${d.getUTCFullYear()}`;

  const enriched: EnrichedTrade[] = trades.map((t) => {
    const fromT = teamById.get(t.fromTeamId);
    const toT = teamById.get(t.toTeamId);
    return {
      id: t.id,
      status: t.status,
      condition: t.condition,
      createdAtStr: fmtDate(t.createdAt),
      respondedAtStr: t.respondedAt ? fmtDate(t.respondedAt) : null,
      declinedBy: (t as any).declinedBy ?? null,
      fromTeamId: t.fromTeamId,
      toTeamId: t.toTeamId,
      fromTeam: fromT
        ? {
            id: fromT.id,
            name: fromT.name,
            code: fromT.code,
            logoUrl: fromT.logoUrl,
            rookieGm: fromT.rookieGm,
            gm: fromT.gm,
            gmNickname: fromT.gmNickname,
            slug: fromT.slug,
          }
        : null,
      toTeam: toT
        ? {
            id: toT.id,
            name: toT.name,
            code: toT.code,
            logoUrl: toT.logoUrl,
            rookieGm: toT.rookieGm,
            gm: toT.gm,
            gmNickname: toT.gmNickname,
            slug: toT.slug,
          }
        : null,
      fromLabels: labelsFor(t.id, "FROM"),
      toLabels: labelsFor(t.id, "TO"),
      action:
        session === t.toTeamId ? "receiver" : session === t.fromTeamId ? "proposer" : null,
    };
  });

  // Security & visibility:
  // Completed deals are public league history. Pending proposals AND declined/cancelled
  // trades are private — visible only to the two involved clubs (+ commissioner).
  const involvedOrAdmin = (t: { fromTeamId: number; toTeamId: number }) =>
    admin || session === t.fromTeamId || session === t.toTeamId;

  const visibleTrades = enriched.filter((t) => {
    if (t.status === "ACCEPTED" || t.status === "COMPLETED") return true;
    return involvedOrAdmin(t);
  });

  // Sort visible trades: pending & review first, then recent completed/declined
  const sortedTrades = [...visibleTrades].sort((a, b) => {
    const aPriority = a.status === "PENDING" ? 2 : ["AWAITING_COMMISH", "MODIFY", "MODIFIED"].includes(a.status) ? 1 : 0;
    const bPriority = b.status === "PENDING" ? 2 : ["AWAITING_COMMISH", "MODIFY", "MODIFIED"].includes(b.status) ? 1 : 0;
    if (aPriority !== bPriority) return bPriority - aPriority;
    return b.id - a.id;
  });

  // ---- 3-team trade groups ----
  const groups = await prisma.tradeGroup.findMany({
    where: { status: { in: ["PENDING", "AWAITING_COMMISH", "COMPLETED", "ACCEPTED"] } },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  const groupIds = groups.map((g) => g.id);
  const [groupLegs, groupResponses] = groupIds.length
    ? await Promise.all([
        prisma.trade.findMany({ where: { groupId: { in: groupIds } } }),
        prisma.tradeGroupResponse.findMany({ where: { groupId: { in: groupIds } } }),
      ])
    : [[], []];

  const groupLegAssets = groupLegs.length
    ? await prisma.tradeAsset.findMany({ where: { tradeId: { in: groupLegs.map((l) => l.id) } } })
    : [];
  const glPlayerIds = groupLegAssets.filter((a) => a.playerId).map((a) => a.playerId!) as number[];
  const glProspectIds = groupLegAssets.filter((a) => a.prospectId).map((a) => a.prospectId!) as number[];
  const glPickIds = groupLegAssets.filter((a) => a.draftPickId).map((a) => a.draftPickId!) as number[];

  const [glPlayers, glProspects, glPicks] = await Promise.all([
    prisma.player.findMany({
      where: { id: { in: glPlayerIds } },
      select: { id: true, name: true, photoUrl: true, position: true, capHit: true, slug: true },
    }),
    prisma.prospect.findMany({
      where: { id: { in: glProspectIds } },
      select: { id: true, name: true, epUrl: true, position: true },
    }),
    prisma.draftPick.findMany({
      where: { id: { in: glPickIds } },
      select: { id: true, year: true, round: true, ownerLogoId: true },
    }),
  ]);

  const glPMap = new Map(glPlayers.map((p) => [p.id, p]));
  const glProMap = new Map(glProspects.map((p) => [p.id, p]));
  const glOrigTeams = glPicks.length
    ? await prisma.team.findMany({
        where: { profinhlLogoId: { in: glPicks.map((p) => p.ownerLogoId).filter((x): x is number => x != null) } },
        select: { profinhlLogoId: true, code: true, name: true, logoUrl: true },
      })
    : [];
  const glTeamByLogoId = new Map(glOrigTeams.map((t) => [t.profinhlLogoId, t]));
  const glPickInfo = new Map(
    glPicks.map((p) => [
      p.id,
      {
        year: p.year,
        round: p.round,
        label: `${p.year} R${p.round}`,
        origTeam: glTeamByLogoId.get(p.ownerLogoId) ?? null,
      },
    ])
  );

  const legAssetLabels = (legId: number): EnrichedTradeAsset[] =>
    groupLegAssets
      .filter((a) => a.tradeId === legId)
      .map((a): EnrichedTradeAsset => {
        if (a.assetType === "PLAYER") {
          const p = glPMap.get(a.playerId ?? -1);
          const pNameClean = displayName(p?.name ?? "Player");
          return {
            assetType: "PLAYER",
            name: pNameClean,
            text: pNameClean,
            photoUrl: p?.photoUrl ?? null,
            position: p?.position ?? null,
            capHit: p?.capHit ?? null,
            href: p?.slug ? `/players/${p.slug}` : p?.id ? `/players/${p.id}` : null,
          };
        }
        if (a.assetType === "PROSPECT") {
          const pro = glProMap.get(a.prospectId ?? -1);
          const proNameClean = displayName(pro?.name ?? "Prospect");
          return {
            assetType: "PROSPECT",
            name: proNameClean,
            text: `⭐ ${proNameClean}`,
            position: pro?.position ?? null,
            href: pro?.epUrl ?? epProfileUrl(proNameClean),
            external: true,
          };
        }
        if (a.assetType === "PICK") {
          const info = glPickInfo.get(a.draftPickId ?? -1);
          const orig = info?.origTeam;
          return {
            assetType: "PICK",
            text: `🎫 ${info?.label ?? "Pick"}${orig ? ` (${orig.code ?? orig.name})` : ""}`,
            pickYear: info?.year ?? null,
            pickRound: info?.round ?? null,
            origTeamCode: orig?.code ?? orig?.name ?? null,
            origTeamLogo: orig?.logoUrl ?? null,
          };
        }
        if (a.assetType === "CASH") {
          return {
            assetType: "CASH",
            text: `💵 ${money(a.cashAmount ?? 0)}`,
            cashAmount: a.cashAmount ?? null,
          };
        }
        return {
          assetType: "OTHER",
          text: a.assetType,
        };
      });

  const myGroupIds = session
    ? groupResponses.filter((r) => r.teamId === session).map((r) => r.groupId)
    : [];

  const enrichedGroups: EnrichedGroup[] = groups
    .filter((g) => {
      if (g.status === "COMPLETED" || g.status === "ACCEPTED") return true;
      return admin || myGroupIds.includes(g.id);
    })
    .map((g) => {
      const legs = groupLegs
        .filter((l) => l.groupId === g.id)
        .map((l) => {
          const fromT = teamById.get(l.fromTeamId);
          const toT = teamById.get(l.toTeamId);
          return {
            id: l.id,
            fromTeam: fromT
              ? {
                  id: fromT.id,
                  name: fromT.name,
                  code: fromT.code,
                  logoUrl: fromT.logoUrl,
                  rookieGm: fromT.rookieGm,
                  slug: fromT.slug,
                }
              : null,
            toTeam: toT
              ? {
                  id: toT.id,
                  name: toT.name,
                  code: toT.code,
                  logoUrl: toT.logoUrl,
                  rookieGm: toT.rookieGm,
                  slug: toT.slug,
                }
              : null,
            assetLabels: legAssetLabels(l.id),
          };
        });

      const responses = groupResponses
        .filter((r) => r.groupId === g.id)
        .map((r) => {
          const tm = teamById.get(r.teamId);
          return {
            teamId: r.teamId,
            status: r.status,
            team: tm ? { name: tm.name, code: tm.code, logoUrl: tm.logoUrl } : null,
          };
        });

      const myResponse = session ? responses.find((r) => r.teamId === session) : undefined;
      const canRespond = admin || myResponse?.status === "PENDING";

      return {
        id: g.id,
        status: g.status,
        createdAtStr: fmtDate(g.createdAt),
        legs,
        responses,
        canRespond,
        isCommishReview: admin && g.status === "AWAITING_COMMISH",
      };
    });

  return (
    <div className="space-y-6 py-2">
      <PageHeader
        title="Výmeny (Trades)"
        subtitle="Prehľad uskutočnených dohôd, aktívnych návrhov a 3-tímových výmen"
      />

      <TradesClientView
        trades={sortedTrades}
        groups={enrichedGroups}
        sessionTeamId={session}
        isAdmin={admin}
        isCommission={commission}
        commishQueueCount={commishQueue}
      />
    </div>
  );
}
