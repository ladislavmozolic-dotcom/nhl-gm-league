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
  const org = await prisma.team.findUnique({ where: { id: teamId }, select: { affiliateTeams: { select: { id: true } } } });
  const orgIds = [teamId, ...(org?.affiliateTeams.map((a) => a.id) ?? [])];
  await Promise.all(orgIds.map((id) => ensureRfaCases(id)));
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
    select: { id: true, name: true, age: true, capHit: true, contractYears: true, contractText: true, position: true, isGoalie: true, df: true, lastSeasonGP: true, lastSeasonPts: true, lastSeasonSvPct: true, rosterType: true, franchiseTag: true, birthDate: true, rightsReleased: true },
    orderBy: { capHit: "desc" },
  });
  const rfaCases = await prisma.rfaCase.findMany({ where: { playerId: { in: expiring.map((p) => p.id) }, status: { in: ["QO_DUE", "QO_TENDERED", "NEGOTIATING", "ARB_FILED", "AWARDED", "OS_ELIGIBLE"] } }, select: { playerId: true, status: true, qoAmount: true, qoDueAt: true } });
  const rfaByPlayer = new Map(rfaCases.map((c) => [c.playerId, c]));

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

  return (
    <div className="space-y-4">
      <Card title={`Contracts — up for renewal (${expiring.length})`} accent="text-amber-400">
        <div className="flex flex-wrap gap-4 text-sm">
          <span className="text-red-400 font-semibold">UFA {groups.UFA.length}</span>
          <span className="text-blue-400 font-semibold">RFA {groups.RFA.length}</span>
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
            players={groups[g].map((p) => {
              const rfa = rfaByPlayer.get(p.id);
              return { id: p.id, name: p.name, capHit: p.capHit, contractYears: p.contractYears, contractText: p.contractText, farm: p.rosterType === "AHL", franchiseTag: p.franchiseTag, rightsReleased: p.rightsReleased, rfaStatus: rfa?.status, qoAmount: rfa?.qoAmount, qoDueAt: rfa?.qoDueAt?.toISOString() };
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
