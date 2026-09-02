import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import RosterMover from "@/components/RosterMover";
import { saveRosterMoves, releasePlayer, placeOnWaiversFromRoster } from "@/app/teams/[slug]/rosters/actions";

export const dynamic = "force-dynamic";

export default async function AdminRosterMovesPage({ searchParams }: { searchParams: Promise<{ team?: string }> }) {
  if (!(await isAdmin())) redirect("/login");

  const teams = await prisma.team.findMany({
    where: { league: "NHL", isAffiliate: false },
    select: { id: true, name: true, code: true, slug: true, logoUrl: true },
    orderBy: { name: "asc" },
  });
  if (teams.length === 0) return <div className="py-2">No teams.</div>;

  const wanted = (await searchParams).team;
  const team = teams.find((t) => t.slug === wanted) ?? teams[0];

  const full = await prisma.team.findUnique({
    where: { id: team.id },
    include: { affiliateTeams: { select: { id: true, name: true } } },
  });
  if (!full) return <div className="py-2">Team not found.</div>;
  const affiliate = full.affiliateTeams[0] ?? null;
  const orgTeamIds = [team.id, ...(affiliate ? [affiliate.id] : [])];

  const players = await prisma.player.findMany({
    // only real roster players (NHL/AHL) — released UFAs, prospects and retirees keep a
    // team id (schema requires one) but must never surface in the roster manager.
    where: { teamId: { in: orgTeamIds }, rosterType: { in: ["NHL", "AHL"] } },
    select: { id: true, name: true, position: true, overall: true, isGoalie: true, rosterType: true, contractType: true, capHit: true, scratched: true, teamId: true, waiverStatus: true },
    orderBy: [{ isGoalie: "asc" }, { overall: "desc" }],
  });

  return (
    <div className="space-y-6 py-2">
      <PageHeader title="Roster Moves — All Clubs" subtitle="Commissioner override: manage any club's dress/scratch/farm/waivers, same tools its own GM has."
        right={<Link href="/admin" className="text-sm text-slate-400 hover:text-blue-400 whitespace-nowrap">← Admin</Link>}
      />

      {/* team logo switcher — same mechanism as All Rosters / All Goalies */}
      <div className="flex flex-wrap gap-1.5 border border-slate-800 bg-slate-900/70 rounded-2xl p-2 sticky top-14 z-20 backdrop-blur shadow-lg shadow-black/20">
        {teams.map((t) => (
          <Link key={t.id} href={`/admin/roster-moves?team=${t.slug}`} title={t.name}
            className={`p-1 rounded transition-colors ${t.id === team.id ? "bg-blue-600/30 ring-1 ring-blue-500" : "hover:bg-slate-800"}`}>
            {t.logoUrl ? <img src={t.logoUrl} alt={t.code ?? ""} className="w-7 h-7 object-contain" />
              : <span className="w-7 h-7 grid place-items-center text-[10px] text-slate-400">{t.code}</span>}
          </Link>
        ))}
      </div>

      <RosterMover
        teamName={full.name}
        teamSlug={full.slug}
        affiliateName={affiliate?.name ?? "(no affiliate)"}
        hasAffiliate={!!affiliate}
        players={players.map((p) => ({
          id: p.id, name: p.name, position: p.position, overall: p.overall ?? 0,
          isGoalie: p.isGoalie,
          side: (p.rosterType === "AHL" ? (p.scratched ? "farm-scratched" : "farm") : (p.scratched ? "pro-scratched" : "pro")) as "pro" | "pro-scratched" | "farm" | "farm-scratched",
          contractType: (p.contractType as "ONE_WAY" | "TWO_WAY" | null) ?? null,
          capHit: p.capHit ?? 0,
          onWaivers: p.waiverStatus === "ON_WAIVERS",
        }))}
        onSave={saveRosterMoves}
        onRelease={releasePlayer}
        onWaiver={placeOnWaiversFromRoster}
      />
    </div>
  );
}
