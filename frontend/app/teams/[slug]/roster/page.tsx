import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import RosterView from "@/components/RosterView";
import { isAdmin } from "@/lib/auth";
import AutoFillButton from "@/components/AutoFillButton";
import RosterTabs from "@/components/RosterTabs";

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

  return (
    <div className="space-y-6">
      <RosterTabs slug={slug} />
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
      <RosterView players={team.players} />
    </div>
  );
}
