import { prisma } from "@/lib/prisma";
import { cleanName } from "@/lib/playerName";
import { liveCapHit } from "@/lib/finance";
import { loadSettings } from "@/lib/sim/settings";
import { getLeagueDate } from "@/lib/calendar-server";
import { regularSeasonDaysBetween } from "@/lib/trade-exec";

/** Everything one club could put into a trade — its NHL roster + AHL affiliate
 *  roster, draft picks, and prospects. Shared by the 2-team and 3-team builders. */
export async function teamAssets(teamId: number, prospectSource: "real" | "profinhl") {
  const org = await prisma.team.findUnique({ where: { id: teamId }, select: { affiliateTeams: { select: { id: true } } } });
  const affIds = org?.affiliateTeams.map((a) => a.id) ?? [];
  const [players, picks, prospects, settings, nowLeagueDate] = await Promise.all([
    prisma.player.findMany({
      where: { OR: [{ teamId, rosterType: "NHL" }, { teamId: { in: affIds }, rosterType: "AHL" }] },
      select: { id: true, name: true, position: true, capHit: true, retainedSalary: true, contractYears: true, rosterType: true, tradeClause: true, noTradeTeams: true },
      orderBy: [{ rosterType: "asc" }, { capHit: "desc" }],
    }),
    prisma.draftPick.findMany({ where: { teamId }, orderBy: [{ year: "asc" }, { round: "asc" }] }),
    prisma.prospect.findMany({ where: { teamId, source: prospectSource }, orderBy: [{ overallPick: "asc" }, { name: "asc" }] }),
    loadSettings(),
    getLeagueDate(),
  ]);
  // League house rule: once a contract has had a retention transaction, the
  // player himself can't be traded again — with or without more retention —
  // until retentionCooldownDays have passed since the most recent one (see
  // lib/trade-exec.ts's movePlayers, which enforces this server-side; this is
  // the same read, surfaced up front so a GM sees it before drafting a deal
  // instead of only at submit time).
  const retentionHistory = players.length
    ? await prisma.buyout.findMany({
        where: { playerId: { in: players.map((p) => p.id) }, totalCost: 0 },
        select: { playerId: true, leagueDate: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      })
    : [];
  const lastRetentionByPlayer = new Map<number, Date>();
  for (const r of retentionHistory) lastRetentionByPlayer.set(r.playerId!, r.leagueDate ?? r.createdAt);
  const freezeDaysLeft = (playerId: number): number => {
    const last = lastRetentionByPlayer.get(playerId);
    if (!last) return 0;
    const elapsed = regularSeasonDaysBetween(last, nowLeagueDate);
    return Math.max(0, settings.retentionCooldownDays - elapsed);
  };
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
    // `capHit` here is what THIS club actually pays — net of any retention it
    // already benefits from (a player someone else is already partly paying
    // for) — same net figure the team cap page shows as "Salary after
    // Retention". A fresh retention slider in the trade builder multiplies
    // against this, so retaining MORE on an already-retained player is a % of
    // what's left, not the player's full original salary (see trade-exec.ts).
    // name is pre-cleaned here (strips baked-in ''C''/''A''/(NTC)/(NMC) markers
    // some imported raw names carry) so every consumer of this list — including
    // ones that don't go through displayName() themselves, like the trade
    // summary panel — is safe by default. `clause`/`noTradeTeams` stay on the
    // object for the real waiver-consent flow, never rendered as a badge here.
    players: players.slice().sort(byName).map((p) => ({ id: p.id, name: cleanName(p.name), position: p.position, capHit: Math.max(0, liveCapHit(p) - (p.retainedSalary ?? 0)), farm: p.rosterType === "AHL", clause: p.tradeClause, noTradeTeams: p.noTradeTeams, retainedAmount: p.retainedSalary ?? 0, tradeFreezeDaysLeft: freezeDaysLeft(p.id) })),
    picks: picks.map((p) => {
      const orig = teamByLogoId.get(p.ownerLogoId);
      return { id: p.id, round: p.round, label: `${p.year} R${p.round}${orig ? ` (${orig.code ?? orig.name})` : ""}`, logoUrl: orig?.logoUrl ?? null, locked: p.lockedByConditionId != null };
    }),
    prospects: prospects.slice().sort(byName).map((p) => ({ id: p.id, label: p.draftYear || p.overallPick ? `${p.name} (${p.draftYear ?? "?"}${p.overallPick ? ` #${p.overallPick}` : ""})` : p.name })),
  };
}
