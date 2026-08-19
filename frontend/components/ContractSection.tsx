import { prisma } from "@/lib/prisma";
import { canManageTeam } from "@/lib/auth";
import { Card } from "@/components/ui";
import ReSignPanel from "@/components/ReSignPanel";
import ElcApplyButton from "@/components/ElcApplyButton";
import { computeELC } from "@/lib/elc";
import { faPosGroup } from "@/lib/free-agency";
import { loadSettings } from "@/lib/sim/settings";
import { getLeagueClock } from "@/lib/calendar-server";
import { cleanName } from "@/lib/playerName";

// A player entering his final year is up for renewal. Status by age (our rule):
// under 26 at June 30 → RFA, 26+ → UFA; the youngest cheap deals are still ELC
// (entry-level — an auto-contract formula will handle those).
type Group = "ELC" | "RFA" | "UFA";
// ProfiNHL Čl. 32: RFA = contract expiring and 26-or-younger at June 30; UFA = 27+.
// The very youngest (entry-level age) are still on an ELC auto-formula.
function statusOf(age: number | null): Group {
  const a = age ?? 27;
  if (a <= 21) return "ELC";
  return a <= 26 ? "RFA" : "UFA";
}

const META: Record<Group, { title: string; blurb: string; accent: string }> = {
  UFA: { title: "UFA — Unrestricted", blurb: "27+ at June 30 — free to sign anywhere if they reach the market. Re-sign to keep them.", accent: "text-red-400" },
  RFA: { title: "RFA — Restricted", blurb: "26 or younger at June 30 — you hold their rights. Re-sign before they reach free agency.", accent: "text-blue-400" },
  ELC: { title: "ELC — Entry-Level", blurb: "Entry-level age (≤21) — their next deal is set by the ELC auto-formula (base + performance bonus).", accent: "text-green-400" },
};

export default async function ContractSection({ teamId }: { teamId: number }) {
  const canManage = await canManageTeam(teamId);
  const franchiseEnabled = (await loadSettings()).faMode === "full";
  // extensions only open once the regular season is underway (final contract year)
  const phase = (await getLeagueClock()).phase;
  const canNegotiate = phase === "regular" || phase === "playoffs";
  // include the club's AHL/farm players whose deals are up too
  const org = await prisma.team.findUnique({ where: { id: teamId }, select: { affiliateTeams: { select: { id: true } } } });
  const orgIds = [teamId, ...(org?.affiliateTeams.map((a) => a.id) ?? [])];
  // players in the FINAL YEAR of their deal (1 left) or already expired (0). Minor-league
  // ($100k, sub-NHL-minimum) farm deals are excluded — they renew automatically every
  // off-season (a farm body who makes the NHL simply signs an ELC), so a GM never has to
  // re-sign them and they don't clutter this list.
  const NHL_MIN = 775_000;
  const expiring = await prisma.player.findMany({
    where: { teamId: { in: orgIds }, rosterType: { in: ["NHL", "AHL"] }, contractYears: { not: null, lte: 1 }, NOT: { capHit: { gt: 0, lt: NHL_MIN } } },
    select: { id: true, name: true, age: true, capHit: true, contractYears: true, contractText: true, position: true, isGoalie: true, df: true, lastSeasonGP: true, lastSeasonPts: true, lastSeasonSvPct: true, rosterType: true, franchiseTag: true },
    orderBy: { capHit: "desc" },
  });

  if (expiring.length === 0) {
    return (
      <Card title="Contracts" accent="text-amber-400">
        <p className="text-sm text-slate-500">No contracts are up for renewal — nobody is in the final year of their deal.</p>
      </Card>
    );
  }

  const groups: Record<Group, typeof expiring> = { UFA: [], RFA: [], ELC: [] };
  for (const p of expiring) groups[statusOf(p.age)].push(p);

  return (
    <div className="space-y-4">
      <Card title={`Contracts — up for renewal (${expiring.length})`} accent="text-amber-400">
        <div className="flex flex-wrap gap-4 text-sm">
          <span className="text-red-400 font-semibold">UFA {groups.UFA.length}</span>
          <span className="text-blue-400 font-semibold">RFA {groups.RFA.length}</span>
          <span className="text-green-400 font-semibold">ELC {groups.ELC.length}</span>
          {!canManage && <span className="text-slate-500 text-xs ml-auto self-center">Sign in as this club&apos;s GM to re-sign.</span>}
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
                    <span className="font-medium">{cleanName(p.name)}</span>
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

      {(["UFA", "RFA"] as Group[]).map((g) =>
        groups[g].length === 0 ? null : canManage ? (
          <ReSignPanel key={g} teamId={teamId} title={META[g].title} blurb={META[g].blurb} accent={META[g].accent} group={g} franchiseEnabled={franchiseEnabled} canNegotiate={canNegotiate}
            players={groups[g].map((p) => ({ id: p.id, name: p.name, capHit: p.capHit, contractYears: p.contractYears, contractText: p.contractText, farm: p.rosterType === "AHL", franchiseTag: p.franchiseTag }))} />
        ) : (
          <Card key={g} title={`${META[g].title} (${groups[g].length})`} accent={META[g].accent}>
            <div className="divide-y divide-slate-800/50">
              {groups[g].map((p) => (
                <div key={p.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="font-medium">{p.name}</span>
                  <span className="text-xs text-slate-500">{p.contractText ?? (p.capHit ? `$${(p.capHit / 1e6).toFixed(2)}M × ${p.contractYears}yr` : "—")}</span>
                </div>
              ))}
            </div>
          </Card>
        )
      )}
    </div>
  );
}
