import Link from "next/link";
import { prisma } from "@/lib/prisma";
import RosterTable, { type RosterPlayer } from "@/components/RosterTable";
import { PageHeader, Card, SectionTitle } from "@/components/ui";

export const dynamic = "force-dynamic";

const ROUNDS = [1, 2, 3, 4, 5, 6, 7];

export default async function AllRostersPage({ searchParams }: { searchParams: Promise<{ team?: string }> }) {
  const teams = await prisma.team.findMany({
    where: { league: "NHL", isAffiliate: false },
    select: { id: true, name: true, code: true, slug: true, logoUrl: true },
    orderBy: { name: "asc" },
  });
  if (teams.length === 0) return <div className="py-2">No teams.</div>;

  const wanted = (await searchParams).team;
  const team = teams.find((t) => t.slug === wanted) ?? teams[0];

  const cfg = await prisma.leagueConfig.findUnique({ where: { id: 1 } });
  const prospectSource = cfg?.rosterMode === "real" ? "real" : "profinhl";

  const full = await prisma.team.findUnique({
    where: { id: team.id },
    include: {
      players: { orderBy: { overall: "desc" }, include: { goalieRating: true } },
      prospects: { where: { source: prospectSource }, orderBy: [{ name: "asc" }] },
      draftPicks: { where: { source: prospectSource }, orderBy: [{ year: "asc" }, { round: "asc" }] },
      affiliateTeams: { include: { players: { orderBy: { overall: "desc" }, include: { goalieRating: true } } } },
    },
  });
  if (!full) return <div className="py-2">Team not found.</div>;

  const logoById = new Map(teams.map((t) => [t.id, t]));
  // goalie-only attrs (sz/ag/rb/hs/rt) live on GoalieRating — merge them onto the row
  const toRP = (p: (typeof full.players)[number]): RosterPlayer => ({ ...(p as unknown as RosterPlayer), ...(p.goalieRating ?? {}) });
  // forwards first (best → worst), then defensemen, then goalies — the players
  // arrive already ordered by overall desc, so filtering preserves that within each group.
  const isDefPos = (pos: string) => /(^|\/)D(\/|$)/.test(pos) || pos === "D";
  const isFwd = (p: (typeof full.players)[number]) => !p.isGoalie && !isDefPos(p.position ?? "");
  const isDef = (p: (typeof full.players)[number]) => !p.isGoalie && isDefPos(p.position ?? "");
  const forwards = full.players.filter(isFwd);
  const defense = full.players.filter(isDef);
  const goalies = full.players.filter((p) => p.isGoalie);
  const farm = full.affiliateTeams[0]?.players ?? [];
  const farmForwards = farm.filter((p) => !p.isGoalie && !isDefPos(p.position ?? ""));
  const farmDefense = farm.filter((p) => !p.isGoalie && isDefPos(p.position ?? ""));
  const farmGoalies = farm.filter((p) => p.isGoalie);

  const conditions = await prisma.tradeCondition.findMany({
    where: { OR: [{ fromTeamId: team.id }, { toTeamId: team.id }] },
    orderBy: { createdAt: "desc" },
  });
  const nameOf = (id: number) => logoById.get(id)?.name ?? `#${id}`;

  const years = [...new Set(full.draftPicks.map((p) => p.year))].sort();
  const pickAt = (year: number, round: number) => full.draftPicks.filter((p) => p.year === year && p.round === round);

  return (
    <div className="space-y-6 py-2">
      <PageHeader title="All Rosters" subtitle="Complete rosters, prospects, picks and conditions for every club." />

      {/* team logo switcher */}
      <div className="flex flex-wrap gap-1.5 border border-slate-800 bg-slate-900/70 rounded-2xl p-2 sticky top-14 z-20 backdrop-blur shadow-lg shadow-black/20">
        {teams.map((t) => (
          <Link key={t.id} href={`/tools/all-rosters?team=${t.slug}`} title={t.name}
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
        <SectionTitle accent="text-blue-400">NHL Roster</SectionTitle>
        <RosterTable title="Forwards" players={forwards.map(toRP)} />
        <RosterTable title="Defensemen" players={defense.map(toRP)} />
        <RosterTable title="Goalies" players={goalies.map(toRP)} goalie />
      </div>

      <div>
        <SectionTitle accent="text-emerald-300">AHL Roster {full.affiliateTeams[0] ? `— ${full.affiliateTeams[0].name}` : ""}</SectionTitle>
        <RosterTable title="Forwards" players={farmForwards.map(toRP)} />
        <RosterTable title="Defensemen" players={farmDefense.map(toRP)} />
        <RosterTable title="Goalies" players={farmGoalies.map(toRP)} goalie />
      </div>

      <div>
        <SectionTitle accent="text-blue-400">Prospects</SectionTitle>
        <Card bodyClassName="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[520px]">
              <thead><tr className="text-xs text-slate-500 uppercase tracking-wider border-b border-slate-800 bg-slate-800/30">
                <th className="px-4 py-3 text-left font-medium">Prospect</th><th className="px-4 py-3 text-center font-medium">Draft Year</th><th className="px-4 py-3 text-center font-medium">Overall Pick</th>
              </tr></thead>
              <tbody>
                {full.prospects.length === 0 && <tr><td colSpan={3} className="px-4 py-3 text-slate-600">no prospects</td></tr>}
                {full.prospects.map((p) => (
                  <tr key={p.id} className="border-b border-slate-800/40 hover:bg-slate-800/30 transition-colors last:border-0">
                    <td className="px-4 py-3 font-medium">{p.name}</td>
                    <td className="px-4 py-3 text-center text-slate-400 tabular-nums">{p.draftYear ?? "—"}</td>
                    <td className="px-4 py-3 text-center text-slate-400 tabular-nums">{p.overallPick ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <div>
        <SectionTitle accent="text-blue-400">Draft Picks</SectionTitle>
        <Card bodyClassName="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[760px]">
              <thead><tr className="text-xs text-slate-500 uppercase tracking-wider border-b border-slate-800 bg-slate-800/30">
                <th className="px-4 py-3 text-left font-medium w-16">Year</th>
                {ROUNDS.map((r) => <th key={r} className="px-2 py-3 text-center font-medium">Round {r}</th>)}
              </tr></thead>
              <tbody>
                {years.length === 0 && <tr><td colSpan={8} className="px-4 py-3 text-slate-600">no picks</td></tr>}
                {years.map((year) => (
                  <tr key={year} className="border-b border-slate-800/40 last:border-0">
                    <td className="px-4 py-3 font-bold text-white tabular-nums">{year}</td>
                    {ROUNDS.map((round) => {
                      const picks = pickAt(year, round);
                      return (
                        <td key={round} className="px-2 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {picks.map((pk) => {
                              const owner = logoById.get(pk.ownerLogoId);
                              return owner?.logoUrl
                                ? <img key={pk.id} src={owner.logoUrl} alt={owner.code ?? ""} title={owner.name} className="w-6 h-6 object-contain" />
                                : <span key={pk.id} className="text-[10px] text-slate-500">{owner?.code ?? "•"}</span>;
                            })}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <div>
        <SectionTitle accent="text-blue-400">Conditions</SectionTitle>
        <Card bodyClassName="p-0">
          {conditions.length === 0 ? (
            <p className="px-4 py-3 text-slate-600 text-sm">No trade conditions involving this team.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-xs text-slate-500 uppercase tracking-wider border-b border-slate-800 bg-slate-800/30">
                  <th className="px-4 py-3 text-left font-medium">Condition</th><th className="px-4 py-3 text-left font-medium">From → To</th><th className="px-4 py-3 text-center font-medium">Status</th>
                </tr></thead>
                <tbody>
                  {conditions.map((c) => (
                    <tr key={c.id} className="border-b border-slate-800/40 hover:bg-slate-800/30 transition-colors last:border-0">
                      <td className="px-4 py-3">{c.description}</td>
                      <td className="px-4 py-3 text-slate-400">{nameOf(c.fromTeamId)} → {nameOf(c.toTeamId)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${c.status === "FULFILLED" ? "bg-green-500/20 text-green-400" : c.status === "EXPIRED" ? "bg-red-500/20 text-red-400" : "bg-amber-500/20 text-amber-400"}`}>{c.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
