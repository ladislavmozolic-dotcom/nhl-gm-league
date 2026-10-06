import { prisma } from "@/lib/prisma";
import PlayerLink from "@/components/PlayerLink";
import { canManageTeam } from "@/lib/auth";
import { Card } from "@/components/ui";
import ReSignPanel from "@/components/ReSignPanel";
import ElcApplyButton from "@/components/ElcApplyButton";
import { computeELC } from "@/lib/elc";
import { faPosGroup } from "@/lib/free-agency";
import { loadSettings } from "@/lib/sim/settings";
import { getLeagueClock } from "@/lib/calendar-server";
import { cleanName } from "@/lib/playerName";
import { CONTRACT_GROUP_META as META, type ContractGroup as Group } from "@/lib/contract-status";
import { ufaAtExpiry, resignLockedUntil } from "@/lib/free-agency-server";
import { ensureRfaCases } from "@/lib/rfa-server";
import { CURRENT_SEASON_START } from "@/lib/finance";

export default async function ContractSection({ teamId }: { teamId: number }) {
  const canManage = await canManageTeam(teamId);
  const franchiseEnabled = (await loadSettings()).faMode === "full";
  // A club can negotiate its OWN pending UFA/RFA at any time — that's the whole
  // point of the exclusive window a team holds before a player reaches the open
  // market. Blocked only during the Free Agent Frenzy itself, which has its own
  // dedicated offer/counter flow for players who've actually reached free agency.
  const phase = (await getLeagueClock()).phase;
  const lockedUntil = await resignLockedUntil(teamId);
  const canNegotiate = phase !== "frenzy" && !lockedUntil;
  // include the club's AHL/farm players whose deals are up too
  const org = await prisma.team.findUnique({
    where: { id: teamId },
    select: { franchiseTagUsedSeason: true, affiliateTeams: { select: { id: true } } },
  });
  const orgIds = [teamId, ...(org?.affiliateTeams.map((a) => a.id) ?? [])];
  await Promise.all(orgIds.map((id) => ensureRfaCases(id)));

  // Check if any player in the org currently holds the franchise tag and whether it's already been used
  const taggedOrgPlayer = await prisma.player.findFirst({
    where: { teamId: { in: orgIds }, franchiseTag: true },
    select: { id: true, name: true, resignRound: true, resignStatus: true, extCapHit: true },
  });
  const franchiseTagUsed = org?.franchiseTagUsedSeason === CURRENT_SEASON_START || Boolean(
    taggedOrgPlayer && (
      (taggedOrgPlayer.resignRound ?? 0) > 0 ||
      taggedOrgPlayer.resignStatus === "extended" ||
      taggedOrgPlayer.extCapHit != null ||
      taggedOrgPlayer.resignStatus === "osEligible" ||
      taggedOrgPlayer.resignStatus === "walkedToUFA"
    )
  );
  const franchiseTaggedPlayer = taggedOrgPlayer ? { id: taggedOrgPlayer.id, name: taggedOrgPlayer.name } : null;
  // players in the FINAL YEAR of their deal (1 left) or already expired (0). Minor-league
  // ($100k) farm deals are excluded — they renew automatically every off-season (a farm
  // body who makes the NHL simply signs an ELC), so a GM never has to re-sign them and
  // they don't clutter this list. A real two-way deal below the NHL minimum (e.g.
  // $600k-774k) is NOT a farm deal — it belongs in this list like any other contract.
  // Before the regular season actually starts (pre-season/off-season/frenzy), show ONLY
  // already-expired deals (0 years) — the 1-year "final year" group only makes sense once
  // a real season is underway (so a "1 year left" deal genuinely means this season). Once
  // regular season or playoffs begins, both groups show.
  const SHOW_FINAL_YEAR = phase === "regular" || phase === "playoffs";
  const yearsFilter = SHOW_FINAL_YEAR ? { not: null, lte: 1 } : { equals: 0 };
  // Re-signed players drop off: an expired (0-year) deal is replaced at once, and an
  // in-season final-year extension is parked in ext* (starts next season).
  const expiring = await prisma.player.findMany({
    // NONROSTER: an RFA-age player benched at regular-season opening day for staying
    // unsigned (see sweepUnsignedRfasToNonRoster) — still owned by this club and must
    // stay visible here, since re-signing him is the ONLY way he gets un-benched.
    where: { teamId: { in: orgIds }, rosterType: { in: ["NHL", "AHL", "NONROSTER"] }, contractYears: yearsFilter, extCapHit: null, NOT: { capHit: 100_000 } },
    select: { id: true, name: true, age: true, capHit: true, contractYears: true, contractText: true, position: true, isGoalie: true, df: true, lastSeasonGP: true, lastSeasonPts: true, lastSeasonSvPct: true, rosterType: true, franchiseTag: true, birthDate: true, rightsReleased: true, resignRound: true, resignStatus: true, resignOfferSalary: true, resignCounterSalary: true, resignCounterYears: true },
    orderBy: { capHit: "desc" },
  });
  const rfaCases = await prisma.rfaCase.findMany({ where: { playerId: { in: expiring.map((p) => p.id) }, status: { in: ["QO_DUE", "QO_TENDERED", "NEGOTIATING", "ARB_FILED", "AWARDED", "OS_ELIGIBLE"] } }, select: { playerId: true, status: true, qoAmount: true, qoDueAt: true } });
  const rfaByPlayer = new Map(rfaCases.map((c) => [c.playerId, c]));
  // Keep the latest actual offer alongside a player so returning to Re-sign after
  // a rejection shows the GM exactly what was offered and what the player countered.
  const negotiationRows = expiring.length ? await prisma.negotiationLog.findMany({
    where: { playerId: { in: expiring.map((p) => p.id) }, kind: "OFFER" },
    orderBy: { id: "desc" },
    select: { playerId: true, round: true, offerSalary: true, offerYears: true, offerLine: true, offerPP: true, offerPK: true, offerClause: true, offerTwoWay: true, counterSalary: true, counterYears: true, note: true },
  }) : [];
  const negotiationByPlayer = new Map<number, typeof negotiationRows[number]>();
  for (const row of negotiationRows) if (!negotiationByPlayer.has(row.playerId)) negotiationByPlayer.set(row.playerId, row);

  if (expiring.length === 0) {
    return (
      <Card title="Contracts" accent="text-amber-400">
        <p className="text-sm text-slate-500">No contracts are up for renewal — nobody is in the final year of their deal.</p>
      </Card>
    );
  }

  const groups: Record<Group, typeof expiring> = { UFA: [], RFA: [], ELC: [] };
  // everyone on this list is finishing a contract → his next one is an RFA/UFA deal,
  // never an ELC (that's only a first contract). Status at June 30 of the expiry year.
  for (const p of expiring) groups[ufaAtExpiry(p) ? "UFA" : "RFA"].push(p);
  const expiringCap = expiring.reduce((sum, p) => sum + (p.capHit ?? 0), 0);

  return (
    <div className="space-y-4">
      <Card title={`Contracts — up for renewal (${expiring.length})`} accent="text-amber-400">
        <div className="grid grid-cols-3 gap-2 text-sm sm:max-w-xl">
          <div className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2"><div className="text-[10px] font-bold uppercase text-slate-500">Expiring AAV</div><div className="font-black text-amber-300">${(expiringCap / 1e6).toFixed(1)}M</div></div>
          <div className="rounded-lg border border-red-500/15 bg-red-500/5 px-3 py-2"><div className="text-[10px] font-bold uppercase text-red-300">UFA</div><div className="font-black text-red-200">{groups.UFA.length}</div></div>
          <div className="rounded-lg border border-blue-500/15 bg-blue-500/5 px-3 py-2"><div className="text-[10px] font-bold uppercase text-blue-300">RFA</div><div className="font-black text-blue-200">{groups.RFA.length}</div></div>
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-sm">
          {!canManage && <span className="text-slate-500 text-xs ml-auto self-center">Sign in as this club&apos;s GM to re-sign.</span>}
          {lockedUntil && <span className="text-amber-300 text-xs ml-auto self-center">🔒 Extensions open on {lockedUntil.toISOString().slice(0, 10)} (first days of the regular season are closed)</span>}
        </div>
      </Card>

      {groups.ELC.length > 0 && (
        <Card title={`${META.ELC.title} (${groups.ELC.length})`} accent={META.ELC.accent}>
          <p className="text-xs text-slate-500 mb-3">{META.ELC.blurb}</p>
          <div className="divide-y divide-slate-800/50">
            {groups.ELC.map((p) => {
              const pos = p.isGoalie ? ("G" as const) : faPosGroup(p.position, false);
              const c = computeELC({ pos, age: p.age, df: p.df, lastSeasonGP: p.lastSeasonGP, lastSeasonPts: p.lastSeasonPts, lastSeasonSvPct: p.lastSeasonSvPct });
              return (
                <div key={p.id} className="flex items-center justify-between py-2 gap-3 text-sm">
                  <div className="min-w-0">
                    <PlayerLink id={p.id} name={p.name} className="font-medium" />
                    <span className="text-xs text-slate-500 ml-2">
                      {c.eligible ? (<>
                        ELC: $0.90M + ${(c.bonus / 1e6).toFixed(2)}M bonus = <b className="text-green-400">${(c.capHit / 1e6).toFixed(2)}M</b> × {c.years}yr
                        {c.ppg != null && <span className="text-slate-600"> · {c.ppg.toFixed(2)} PPG{c.bonusEligible ? "" : " · <40 GP → base only"}</span>}
                      </>) : <span className="text-amber-400/80">only {p.lastSeasonGP ?? 0} GP — needs 10 to sign</span>}
                    </span>
                  </div>
                  {canManage && c.eligible && <ElcApplyButton playerId={p.id} />}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {canManage && (() => {
        const soon = new Date(Date.now() + 14 * 86_400_000);
        const missing = expiring.filter((p) => { const c = rfaByPlayer.get(p.id); return c?.status === "QO_DUE" && c.qoDueAt >= new Date(Date.now() - 86_400_000) && c.qoDueAt <= soon; });
        if (!missing.length) return null;
        const first = missing.map((p) => rfaByPlayer.get(p.id)!.qoDueAt).sort((a, b) => a.getTime() - b.getTime())[0];
        return (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            <b>⚠️ QO deadline {first.toISOString().slice(0, 10)}</b> — {missing.length} RFA{missing.length === 1 ? "" : "s"} still without a qualifying offer: {missing.map((p) => p.name).join(", ")}.
            Tender it in RFA Central, or start negotiating with the player (that tenders it automatically). Past the deadline his rights are released and he becomes a UFA.
          </div>
        );
      })()}

      {(["UFA", "RFA"] as Group[]).map((g) =>
        groups[g].length === 0 ? null : canManage ? (
          <ReSignPanel key={g} teamId={teamId} title={META[g].title} blurb={META[g].blurb} accent={META[g].accent} group={g} franchiseEnabled={franchiseEnabled} canNegotiate={canNegotiate}
            franchiseTagUsed={franchiseTagUsed} franchiseTaggedPlayer={franchiseTaggedPlayer}
            players={groups[g].map((p) => {
              const rfa = rfaByPlayer.get(p.id);
              const negotiation = negotiationByPlayer.get(p.id);
              return { id: p.id, name: p.name, capHit: p.capHit, contractYears: p.contractYears, contractText: p.contractText, farm: p.rosterType === "AHL", franchiseTag: p.franchiseTag, rightsReleased: p.rightsReleased, rfaStatus: rfa?.status, qoAmount: rfa?.qoAmount, qoDueAt: rfa?.qoDueAt?.toISOString(), resignRound: p.resignRound, resignStatus: p.resignStatus, resignOfferSalary: p.resignOfferSalary, resignCounterSalary: p.resignCounterSalary, resignCounterYears: p.resignCounterYears, negotiation: negotiation ? { round: negotiation.round, offerSalary: negotiation.offerSalary, offerYears: negotiation.offerYears, offerLine: negotiation.offerLine, offerPP: negotiation.offerPP, offerPK: negotiation.offerPK, offerClause: negotiation.offerClause, offerTwoWay: negotiation.offerTwoWay, counterSalary: negotiation.counterSalary, counterYears: negotiation.counterYears, note: negotiation.note } : undefined };
            })} />
        ) : (
          <Card key={g} title={`${META[g].title} (${groups[g].length})`} accent={META[g].accent}>
            <div className="divide-y divide-slate-800/50">
              {groups[g].map((p) => (
                <div key={p.id} className="flex items-center justify-between py-2 text-sm">
                  <PlayerLink id={p.id} name={p.name} className="font-medium" />
                  <span className="text-xs text-slate-500">{p.capHit ? `$${(p.capHit / 1e6).toFixed(2)}M · last year` : "—"}</span>
                </div>
              ))}
            </div>
          </Card>
        )
      )}
    </div>
  );
}
