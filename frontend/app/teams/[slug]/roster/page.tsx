import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import RosterView from "@/components/RosterView";
import { isAdmin, canManageTeam } from "@/lib/auth";
import AutoFillButton from "@/components/AutoFillButton";
import RosterTabs from "@/components/RosterTabs";
import { captaincyFromName } from "@/lib/playerName";

export const dynamic = "force-dynamic";

// Read-only roster — main (NHL/pro) roster only. Farm / prospects / draft picks
// live on their own sub-nav pages. GM editing is at /teams/[slug]/roster/edit.
const isDefPos = (p: string) => /(^|\/)D(\/|$)/.test(p) || p === "D";

export default async function TeamRosterPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const team = await prisma.team.findUnique({
    where: { slug },
    include: { players: { orderBy: { overall: "desc" }, include: { goalieRating: true } } },
  });
  if (!team) notFound();

  // roster-legality check (STHS: a game dresses 12 F + 6 D + 2 G). This is the
  // OWNED roster; if it's short the farm auto-fills the missing spots at game
  // time, so the shortfall never stops a game — it's just a heads-up to the GM.
  const rt = team.league === "AHL" ? "AHL" : "NHL";
  const roster = team.players.filter((p) => p.rosterType === rt);
  const nF = roster.filter((p) => !p.isGoalie && !isDefPos(p.position ?? "")).length;
  const nD = roster.filter((p) => !p.isGoalie && isDefPos(p.position ?? "")).length;
  const nG = roster.filter((p) => p.isGoalie).length;
  const short = [
    nF < 12 ? `${12 - nF}F` : null,
    nD < 6 ? `${6 - nD}D` : null,
    nG < 2 ? `${2 - nG}G` : null,
  ].filter(Boolean);
  const affiliate = team.league === "NHL"
    ? await prisma.team.findFirst({ where: { parentTeamId: team.id }, select: { name: true } })
    : null;
  const admin = await isAdmin();
  const isGm = await canManageTeam(team.id);

  // who is actually dressed in the current lineup? Everyone else on the roster
  // (healthy scratches, players left out of the lines, and the injured) drops to
  // the Non-roster section so the main tables show the iced team only.
  const lines = await prisma.teamLines.findUnique({
    where: { teamId: team.id },
    select: { forwardLines: true, defensePairs: true, situations: true },
  });
  const dressed = new Set<number>();
  if (lines) {
    for (const l of (lines.forwardLines as any[]) ?? []) for (const id of [l?.lw, l?.c, l?.rw]) if (id != null) dressed.add(id);
    for (const p of (lines.defensePairs as any[]) ?? []) for (const id of [p?.ld, p?.rd]) if (id != null) dressed.add(id);
    const others = (lines.situations as any)?.others;
    if (others?.starter != null) dressed.add(others.starter);
    if (others?.backup != null) dressed.add(others.backup);

    // The saved lineup can go stale after roster moves — it may still list players who
    // were sent down or traded away (ghost ids) and omit newly called-up ones, wrongly
    // pushing real roster players into "non-roster". Drop the ghosts, then mirror the
    // sim's auto-fill: promote the best healthy, un-slotted players until the dressed
    // minimum (12F / 6D / 2G) is met. On a roster bigger than 20 this also yields a
    // sensible default dressed 20 — the leftover healthy players become the scratches.
    const byIdRoster = new Map(roster.map((p) => [p.id, p]));
    for (const id of [...dressed]) { const rp = byIdRoster.get(id); if (!rp || rp.scratched) dressed.delete(id); } // drop ghosts + explicit scratches
    const bucketOf = (p: (typeof roster)[number]) => (p.isGoalie ? "G" : isDefPos(p.position ?? "") ? "D" : "F");
    const minNeed: Record<"F" | "D" | "G", number> = { F: 12, D: 6, G: 2 };
    const have: Record<"F" | "D" | "G", number> = { F: 0, D: 0, G: 0 };
    // a healthy, un-scratched player is eligible to be promoted into the dressed 20
    const healthy = roster.filter((p) => (p.injuryDaysLeft ?? 0) === 0 && !p.scratched); // roster is overall-desc
    for (const p of healthy) if (dressed.has(p.id)) have[bucketOf(p)]++;
    for (const b of ["F", "D", "G"] as const)
      for (const p of healthy) {
        if (have[b] >= minNeed[b]) break;
        if (bucketOf(p) === b && !dressed.has(p.id)) { dressed.add(p.id); have[b]++; }
      }
  }

  // captaincy: the GM-set `captaincy` field is the source of truth. Fall back to the
  // legacy name marker (''C''/''A'') ONLY for a club that has never set the field, so
  // teams the GM already edited show exactly what he chose (matches League → Captains).
  const capHasField = team.players.some((p) => p.captaincy === "C" || p.captaincy === "A");
  const rosterWithCap = team.players.map((p) => ({ ...p, capRole: capHasField ? p.captaincy : captaincyFromName(p.name) }));

  return (
    <div className="space-y-6">
      <RosterTabs slug={slug} isGm={isGm} />
      {short.length > 0 && (
        <div className="text-sm text-amber-200 bg-amber-950/25 border border-amber-800/40 rounded-lg px-4 py-2.5">
          <div>
            <b>Below the minimum lineup</b> (12F / 6D / 2G) — you own <b>{nF}F · {nD}D · {nG}G</b>.
            {affiliate
              ? <> The next simulation promotes the missing <b>{short.join(" · ")}</b> from the farm (<b>{affiliate.name}</b>) onto this roster — <b>they count against the cap and stay until you send them down</b>. Sign or trade to ice your own.</>
              : <> Missing <b>{short.join(" · ")}</b> — add players to field a full lineup.</>}
          </div>
          {admin && affiliate && <div className="mt-2"><AutoFillButton /></div>}
        </div>
      )}
      <RosterView players={rosterWithCap} dressedIds={[...dressed]} />
    </div>
  );
}
