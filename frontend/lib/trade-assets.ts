import { prisma } from "@/lib/prisma";
import { cleanName } from "@/lib/playerName";

/** Everything one club could put into a trade — its NHL roster + AHL affiliate
 *  roster, draft picks, and prospects. Shared by the 2-team and 3-team builders. */
export async function teamAssets(teamId: number, prospectSource: "real" | "profinhl") {
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
  // A pick's ownerLogoId is the ORIGINAL team it belongs to — not necessarily who
  // currently holds it (it may already have changed hands once via an earlier
  // trade). "2027 R3" alone doesn't say whose pick it is, so label + logo it with
  // that team, same treatment as /trades/[id] and /trades/commish.
  const origTeams = picks.length
    ? await prisma.team.findMany({ where: { profinhlLogoId: { in: picks.map((p) => p.ownerLogoId).filter((x): x is number => x != null) } }, select: { profinhlLogoId: true, code: true, name: true, logoUrl: true } })
    : [];
  const teamByLogoId = new Map(origTeams.map((t) => [t.profinhlLogoId, t]));

  const byName = <T extends { name: string }>(a: T, b: T) => cleanName(a.name).localeCompare(cleanName(b.name), "sk");
  return {
    players: players.slice().sort(byName).map((p) => ({ id: p.id, name: p.name, position: p.position, capHit: p.capHit ?? 0, farm: p.rosterType === "AHL", clause: p.tradeClause, noTradeTeams: p.noTradeTeams })),
    picks: picks.map((p) => {
      const orig = teamByLogoId.get(p.ownerLogoId);
      return { id: p.id, label: `${p.year} R${p.round}${orig ? ` (${orig.code ?? orig.name})` : ""}`, logoUrl: orig?.logoUrl ?? null };
    }),
    prospects: prospects.slice().sort(byName).map((p) => ({ id: p.id, label: p.draftYear || p.overallPick ? `${p.name} (${p.draftYear ?? "?"}${p.overallPick ? ` #${p.overallPick}` : ""})` : p.name })),
  };
}
