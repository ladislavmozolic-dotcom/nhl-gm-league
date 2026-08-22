import Link from "next/link";
import { prisma } from "@/lib/prisma";
import RosterTable, { type RosterPlayer } from "@/components/RosterTable";
import { PageHeader, Card, SectionTitle } from "@/components/ui";
import { money } from "@/lib/finance";
import { cleanName, epSearchName, captaincyFromName } from "@/lib/playerName";

export const dynamic = "force-dynamic";

const ROUNDS = [1, 2, 3, 4, 5, 6, 7];

export default async function AllRostersPage({ searchParams }: { searchParams: Promise<{ team?: string }> }) {
  const teams = await prisma.team.findMany({
    where: { league: "NHL", isAffiliate: false },
    select: { id: true, name: true, code: true, slug: true, logoUrl: true, profinhlLogoId: true },
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
  // draft picks carry ownerLogoId = the owner's profinhlLogoId (1-32 ordinal), NOT team.id
  const logoByProfinhl = new Map(teams.map((t) => [t.profinhlLogoId, t]));
  const realMode = cfg?.rosterMode === "real";
  // goalie-only attrs (sz/ag/rb/hs/rt) live on GoalieRating — merge them onto the row.
  // In Real NHL Rosters mode show the REAL contract (cap hit) so the column isn't a
  // profinhl/real mix — capHit already holds the real value in that mode.
  // captaincy: GM-set field is the source of truth; fall back to the legacy name
  // marker only for a club that never set the field (matches League → Captains).
  const nhlHasField = full.players.some((p) => p.captaincy === "C" || p.captaincy === "A");
  const farmHasField = (full.affiliateTeams[0]?.players ?? []).some((p) => p.captaincy === "C" || p.captaincy === "A");
  const toRP = (p: (typeof full.players)[number], hasField: boolean): RosterPlayer => {
    const row = { ...(p as unknown as RosterPlayer), ...(p.goalieRating ?? {}), capRole: hasField ? (p.captaincy ?? null) : captaincyFromName(p.name) };
    return realMode ? { ...row, contractText: p.capHit ? money(p.capHit) : (row.contractText ?? null) } : row;
  };
  // one skaters table: forwards first (best → worst), then defensemen, then goalies.
  // Players arrive ordered by overall desc, so filtering preserves that within each group.
  const isDefPos = (pos: string) => /(^|\/)D(\/|$)/.test(pos) || pos === "D";
  const isFwd = (p: { isGoalie: boolean; position: string | null }) => !p.isGoalie && !isDefPos(p.position ?? "");
  const isDef = (p: { isGoalie: boolean; position: string | null }) => !p.isGoalie && isDefPos(p.position ?? "");
  const skaters = [...full.players.filter(isFwd), ...full.players.filter(isDef)];
  const goalies = full.players.filter((p) => p.isGoalie);
  const farm = full.affiliateTeams[0]?.players ?? [];
  const farmSkaters = [...farm.filter(isFwd), ...farm.filter(isDef)];
  const farmGoalies = farm.filter((p) => p.isGoalie);

  // Prospects, alphabetical, WITHOUT anyone already on the NHL or AHL roster — a
  // player who's dressing (e.g. Florian Xhekaj, Sasha Pastujov) is a roster player,
  // not a prospect, even if EliteProspects still lists him "in the system".
  // A player is NOT a prospect if he's on this org's roster OR he already graduated
  // by the games-played rule (≥10 NHL, ≥15 AHL, or ≥5 AHL for goalies) anywhere.
  // pKey strips (R)/''A''/(NTC) suffixes AND accents so names match reliably.
  const pKey = (n: string) => epSearchName(n).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
  const graduated = await prisma.player.findMany({
    where: { OR: [{ lastSeasonGP: { gte: 10 } }, { lastSeasonAhlGP: { gte: 15 } }, { AND: [{ isGoalie: true }, { lastSeasonAhlGP: { gte: 5 } }] }] },
    select: { name: true },
  });
  const notProspect = new Set([...full.players, ...farm, ...graduated].map((p) => pKey(p.name)));
  const prospects = full.prospects
    .filter((p) => !notProspect.has(pKey(p.name)))
    .sort((a, b) => cleanName(a.name).localeCompare(cleanName(b.name)));

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
        <RosterTable title="Skaters" players={skaters.map((p) => toRP(p, nhlHasField))} />
        <RosterTable title="Goalies" players={goalies.map((p) => toRP(p, nhlHasField))} goalie />
      </div>

      <div>
        <SectionTitle accent="text-emerald-300">AHL Roster {full.affiliateTeams[0] ? `— ${full.affiliateTeams[0].name}` : ""}</SectionTitle>
        <RosterTable title="Skaters" players={farmSkaters.map((p) => toRP(p, farmHasField))} />
        <RosterTable title="Goalies" players={farmGoalies.map((p) => toRP(p, farmHasField))} goalie />
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
                {prospects.length === 0 && <tr><td colSpan={3} className="px-4 py-3 text-slate-600">no prospects</td></tr>}
                {prospects.map((p) => (
                  <tr key={p.id} className="border-b border-slate-800/40 hover:bg-slate-800/30 transition-colors last:border-0">
                    <td className="px-4 py-3 font-medium">{cleanName(p.name)}</td>
                    {(p as any).undrafted && !p.draftYear ? (
                      <td colSpan={2} className="px-4 py-3 text-center text-slate-500 italic">Undrafted</td>
                    ) : (<>
                      <td className="px-4 py-3 text-center text-slate-400 tabular-nums">{p.draftYear ?? "—"}</td>
                      <td className="px-4 py-3 text-center text-slate-400 tabular-nums">{p.overallPick ? `#${p.overallPick}` : "—"}</td>
                    </>)}
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
                              const owner = logoByProfinhl.get(pk.ownerLogoId);
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
