import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card, SectionTitle } from "@/components/ui";
import PlayerLink from "@/components/PlayerLink";
import { money } from "@/lib/finance";
import { computeELC } from "@/lib/elc";
import { faPosGroup } from "@/lib/free-agency";
import { getLeagueClock } from "@/lib/calendar-server";
import { CONTRACT_GROUP_META, type ContractGroup } from "@/lib/contract-status";
import { ufaAtExpiry } from "@/lib/free-agency-server";

export const dynamic = "force-dynamic";

const TABS: Array<{ key: "all" | ContractGroup; label: string }> = [
  { key: "all", label: "All" },
  { key: "UFA", label: "UFA" },
  { key: "RFA", label: "RFA" },
  { key: "ELC", label: "ELC" },
];

export default async function AllContractsPage({
  searchParams,
}: {
  searchParams: Promise<{ team?: string; status?: string }>;
}) {
  const teams = await prisma.team.findMany({
    where: { league: "NHL", isAffiliate: false },
    select: { id: true, name: true, code: true, slug: true, logoUrl: true },
    orderBy: { name: "asc" },
  });
  if (teams.length === 0) return <div className="py-2">No teams.</div>;

  const sp = await searchParams;
  const team = teams.find((t) => t.slug === sp.team) ?? teams[0];
  const status = (["UFA", "RFA", "ELC"] as const).includes(sp.status as ContractGroup) ? (sp.status as ContractGroup) : "all";

  const org = await prisma.team.findUnique({ where: { id: team.id }, select: { affiliateTeams: { select: { id: true } } } });
  const orgIds = [team.id, ...(org?.affiliateTeams.map((a) => a.id) ?? [])];

  const phase = (await getLeagueClock()).phase;
  const showFinalYear = phase === "regular" || phase === "playoffs";
  const yearsFilter = showFinalYear ? { not: null, lte: 1 } : { equals: 0 };

  const expiring = await prisma.player.findMany({
    where: { teamId: { in: orgIds }, rosterType: { in: ["NHL", "AHL", "NONROSTER"] }, contractYears: yearsFilter, extCapHit: null, NOT: { capHit: 100_000 } },
    select: {
      id: true, name: true, slug: true, age: true, capHit: true, contractYears: true, position: true, isGoalie: true,
      df: true, lastSeasonGP: true, lastSeasonPts: true, lastSeasonSvPct: true, birthDate: true, rosterType: true, rightsReleased: true,
    },
    orderBy: { capHit: "desc" },
  });

  const rows = expiring.map((p) => ({
    ...p,
    // finishing a contract ⇒ RFA/UFA (at June 30 of the expiry year) — never an ELC
    group: (ufaAtExpiry(p) ? "UFA" : "RFA") as ContractGroup,
  }));
  const counts: Record<ContractGroup, number> = { UFA: 0, RFA: 0, ELC: 0 };
  for (const r of rows) counts[r.group]++;
  const shown = status === "all" ? rows : rows.filter((r) => r.group === status);

  const qs = (over: { status?: string; team?: string }) => {
    const p = new URLSearchParams();
    p.set("team", over.team ?? team.slug);
    if ((over.status ?? status) !== "all") p.set("status", over.status ?? status);
    return `/tools/all-contracts?${p.toString()}`;
  };

  return (
    <div className="space-y-6 py-2">
      <PageHeader title="All Contracts" subtitle="Every club's expiring contracts (UFA / RFA / ELC) in one place." />

      {/* team logo switcher — same pattern as All Rosters */}
      <div className="flex flex-wrap gap-1.5 border border-slate-800 bg-slate-900/70 rounded-2xl p-2 sticky top-14 z-20 backdrop-blur shadow-lg shadow-black/20">
        {teams.map((t) => (
          <Link key={t.id} href={qs({ team: t.slug })} title={t.name}
            className={`p-1 rounded transition-colors ${t.id === team.id ? "bg-blue-600/30 ring-1 ring-blue-500" : "hover:bg-slate-800"}`}>
            {t.logoUrl ? <img src={t.logoUrl} alt={t.code ?? ""} className="w-7 h-7 object-contain" />
              : <span className="w-7 h-7 grid place-items-center text-[10px] text-slate-400">{t.code}</span>}
          </Link>
        ))}
      </div>

      <Link href={`/teams/${team.slug}`} className="flex items-center gap-3 w-fit group">
        {team.logoUrl && <img src={team.logoUrl} alt="" className="w-9 h-9 object-contain" />}
        <h2 className="text-xl font-bold group-hover:text-blue-400 transition-colors">{team.name}</h2>
      </Link>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link key={t.key} href={qs({ status: t.key })}
            className={`text-sm font-semibold px-3 py-1.5 rounded-lg transition-colors ${
              status === t.key ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}>
            {t.label}
            {t.key !== "all" && <span className="ml-1.5 text-xs opacity-80">{counts[t.key as ContractGroup]}</span>}
          </Link>
        ))}
      </div>

      {shown.length === 0 ? (
        <Card><p className="text-slate-500 text-center py-8">No expiring contracts in this group.</p></Card>
      ) : (
        <div>
          <SectionTitle accent="text-amber-400">{team.name} — {shown.length} expiring</SectionTitle>
          <Card bodyClassName="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="text-xs text-slate-500 uppercase tracking-wider border-b border-slate-800 bg-slate-800/30">
                    <th className="px-4 py-3 text-left font-medium">Player</th>
                    <th className="px-4 py-3 text-center font-medium">Pos</th>
                    <th className="px-4 py-3 text-center font-medium">Age</th>
                    <th className="px-4 py-3 text-center font-medium">Status</th>
                    <th className="px-4 py-3 text-right font-medium">Current</th>
                    <th className="px-4 py-3 text-right font-medium">ELC preview</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((p) => {
                    const meta = CONTRACT_GROUP_META[p.group];
                    const elc = p.group === "ELC"
                      ? computeELC({
                          pos: p.isGoalie ? "G" : faPosGroup(p.position, false),
                          age: p.age, df: p.df, lastSeasonGP: p.lastSeasonGP, lastSeasonPts: p.lastSeasonPts, lastSeasonSvPct: p.lastSeasonSvPct,
                        })
                      : null;
                    return (
                      <tr key={p.id} className="border-b border-slate-800/40 hover:bg-slate-800/30 transition-colors last:border-0">
                        <td className="px-4 py-3 font-medium"><PlayerLink id={p.id} slug={p.slug} name={p.name} /></td>
                        <td className="px-4 py-3 text-center text-slate-400">{p.isGoalie ? "G" : p.position || "—"}</td>
                        <td className="px-4 py-3 text-center text-slate-400">{p.age ?? "—"}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-xs font-bold ${meta.accent}`}>{p.group}</span>
                        </td>
                        <td className="px-4 py-3 text-right text-slate-400">{p.capHit ? money(p.capHit) : "—"}</td>
                        <td className="px-4 py-3 text-right text-slate-400">
                          {elc ? (elc.eligible ? `${money(elc.capHit)} × ${elc.years}yr` : `${p.lastSeasonGP ?? 0} GP — needs 10`) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
