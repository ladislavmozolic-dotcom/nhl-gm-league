import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui";
import { setProspectGradeAction, backfillBirthDatesAction } from "./actions";
import { projectProspect } from "@/lib/prospect-projection";
import WorldLeagueSetup from "@/components/WorldLeagueSetup";

export const dynamic = "force-dynamic";

export default async function AdminWorldDataPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  if (!(await isAdmin())) redirect("/");
  const cfg = await prisma.leagueConfig.findUnique({ where: { id: 1 }, select: { rosterMode: true } });
  const activeSource = cfg?.rosterMode === "real" ? "real" : "profinhl";

  const [leagues, totalProspects, linkedProspects, unlinkedProspects] = await Promise.all([
    prisma.worldLeague.findMany({
      include: { _count: { select: { teams: true, stats: true } } },
      orderBy: [{ region: "asc" }, { name: "asc" }],
    }),
    prisma.prospect.count({ where: { source: activeSource } }),
    prisma.prospect.count({ where: { source: activeSource, worldPlayerId: { not: null } } }),
    prisma.prospect.findMany({
      where: { source: activeSource, worldPlayerId: null },
      select: { id: true, name: true, position: true, epUrl: true, team: { select: { name: true } } },
      orderBy: { name: "asc" },
      take: 300,
    }),
  ]);

  const query = q.trim();
  const gradeRows = await prisma.prospect.findMany({
    where: { source: activeSource, ...(query ? { name: { contains: query, mode: "insensitive" } } : { gradeOverride: { not: null } }) },
    include: { team: { select: { code: true } }, worldPlayer: { include: { stats: { orderBy: [{ season: "desc" }, { gamesPlayed: "desc" }], include: { league: true } } } } },
    orderBy: { name: "asc" },
    take: 40,
  });

  return (
    <div className="space-y-6 py-2">
      <PageHeader
        title="Around the World Data"
        subtitle="Manage real-world prospect sync across junior leagues, AHL, NCAA, Europe and manual links."
      />
      <WorldLeagueSetup
        leagues={leagues}
        totalProspects={totalProspects}
        linkedProspects={linkedProspects}
        unlinkedProspects={unlinkedProspects}
      />
      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
        <h2 className="text-base font-black">Prospect grade overrides</h2>
        <p className="mt-1 text-xs text-slate-500">The grade is computed from draft capital, age and stats. When it is wrong (e.g. a top pick with no stats yet), set it by hand here — it wins everywhere. Choose “Auto” to go back to the computed grade.</p>
        <form action={backfillBirthDatesAction} className="mt-3">
          <button className="rounded-lg bg-violet-500/20 px-3 py-1.5 text-xs font-bold text-violet-300">Fill missing birth dates (NHL API)</button>
        </form>
        <form className="mt-3 flex gap-2">
          <input name="q" defaultValue={query} placeholder="Search prospect…" className="w-64 rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm" />
          <button className="rounded-lg bg-sky-500/20 px-3 py-1.5 text-sm font-bold text-sky-300">Search</button>
        </form>
        <div className="mt-3 divide-y divide-slate-800/60">
          {gradeRows.length === 0 && <p className="py-3 text-sm text-slate-500">{query ? "No prospects match." : "No manual grades set yet — search for a prospect."}</p>}
          {gradeRows.map((p) => {
            const w = p.worldPlayer;
            const auto = projectProspect({ position: p.position ?? w?.position, draftYear: p.draftYear, overallPick: p.overallPick, birthDate: w?.birthDate, stats: w?.stats });
            return (
              <form key={p.id} action={setProspectGradeAction} className="flex flex-wrap items-center gap-3 py-2 text-sm">
                <input type="hidden" name="prospectId" value={p.id} />
                <span className="w-48 font-bold">{p.name}</span>
                <span className="w-12 text-slate-500">{p.team?.code}</span>
                <span className="w-28 text-xs text-slate-500">{p.overallPick ? `Pick ${p.overallPick}, ${p.draftYear}` : "Undrafted"}</span>
                <span className="w-24 text-xs text-slate-400">Auto: <b>{auto.grade}</b> ({auto.score})</span>
                <select name="grade" defaultValue={p.gradeOverride ?? ""} className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1">
                  <option value="">Auto</option>
                  {["A", "B", "C", "D", "F"].map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
                <button className="rounded-lg bg-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-300">Save</button>
              </form>
            );
          })}
        </div>
      </section>
    </div>
  );
}
