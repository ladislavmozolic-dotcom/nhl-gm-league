import Link from "next/link";
import { prisma } from "@/lib/prisma";
import RosterTable, { type RosterPlayer } from "@/components/RosterTable";
import { PageHeader, SectionTitle } from "@/components/ui";
import { money } from "@/lib/finance";
import { captaincyFromName } from "@/lib/playerName";

export const dynamic = "force-dynamic";

export default async function AllGoaliesPage({ searchParams }: { searchParams: Promise<{ team?: string }> }) {
  const teams = await prisma.team.findMany({
    where: { league: "NHL", isAffiliate: false },
    select: { id: true, name: true, code: true, slug: true, logoUrl: true },
    orderBy: { name: "asc" },
  });
  if (teams.length === 0) return <div className="py-2">No teams.</div>;

  const wanted = (await searchParams).team;
  const team = teams.find((t) => t.slug === wanted) ?? teams[0];

  const cfg = await prisma.leagueConfig.findUnique({ where: { id: 1 } });
  const realMode = cfg?.rosterMode === "real";

  const full = await prisma.team.findUnique({
    where: { id: team.id },
    include: {
      // rosterType-filtered — a goalie parked as PROSPECT/UFA/RETIRED/RELEASED
      // keeps his teamId (schema requires one) but must never show as active.
      players: { where: { rosterType: "NHL", isGoalie: true }, orderBy: { overall: "desc" }, include: { goalieRating: true } },
      affiliateTeams: { include: { players: { where: { rosterType: "AHL", isGoalie: true }, orderBy: { overall: "desc" }, include: { goalieRating: true } } } },
    },
  });
  if (!full) return <div className="py-2">Team not found.</div>;

  // goalie-only attrs (sz/ag/rb/hs/rt) live on GoalieRating — merge them onto the row.
  // captaincy: GM-set field is the source of truth; fall back to the legacy name
  // marker only for a club that never set the field (matches League → Captains).
  const nhlHasField = full.players.some((p) => p.captaincy === "C" || p.captaincy === "A");
  const farm = full.affiliateTeams[0]?.players ?? [];
  const farmHasField = farm.some((p) => p.captaincy === "C" || p.captaincy === "A");
  const toRP = (p: (typeof full.players)[number], hasField: boolean): RosterPlayer => {
    const row = { ...(p as unknown as RosterPlayer), ...(p.goalieRating ?? {}), capRole: hasField ? (p.captaincy ?? null) : captaincyFromName(p.name) };
    return realMode ? { ...row, contractText: p.capHit ? money(p.capHit) : (row.contractText ?? null), contractYears: p.realContractYears ?? row.contractYears ?? null } : row;
  };

  return (
    <div className="space-y-6 py-2">
      <PageHeader title="All Goalies" subtitle="Every club's NHL and AHL goaltenders, one team at a time."
        right={<Link href="/tools/all-rosters" className="text-sm text-slate-400 hover:text-blue-400 whitespace-nowrap">← All Rosters</Link>}
      />

      {/* team logo switcher — same mechanism as All Rosters */}
      <div className="flex flex-wrap gap-1.5 border border-slate-800 bg-slate-900/70 rounded-2xl p-2 sticky top-14 z-20 backdrop-blur shadow-lg shadow-black/20">
        {teams.map((t) => (
          <Link key={t.id} href={`/tools/all-goalies?team=${t.slug}`} title={t.name}
            className={`p-1 rounded transition-colors ${t.id === team.id ? "bg-blue-600/30 ring-1 ring-blue-500" : "hover:bg-slate-800"}`}>
            {t.logoUrl ? <img src={t.logoUrl} alt={t.code ?? ""} className="w-7 h-7 object-contain" />
              : <span className="w-7 h-7 grid place-items-center text-[10px] text-slate-400">{t.code}</span>}
          </Link>
        ))}
      </div>

      <div className="flex items-center gap-3">
        {team.logoUrl && <img src={team.logoUrl} alt="" className="w-9 h-9 object-contain" />}
        <h2 className="text-xl font-bold">{team.name}</h2>
      </div>

      <div>
        <SectionTitle accent="text-blue-400">NHL Goalies</SectionTitle>
        <RosterTable title="Goalies" players={full.players.map((p) => toRP(p, nhlHasField))} goalie />
      </div>

      <div>
        <SectionTitle accent="text-emerald-300">AHL Goalies {full.affiliateTeams[0] ? `— ${full.affiliateTeams[0].name}` : ""}</SectionTitle>
        <RosterTable title="Goalies" players={farm.map((p) => toRP(p, farmHasField))} goalie />
      </div>
    </div>
  );
}
