import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui";
import { countryFlag } from "@/lib/flags";
import { currentDraftYear } from "@/lib/draft-class-import";
import { seasonForDraftYear } from "@/lib/draft-lottery";
import { PICKS_PER_ROUND } from "@/lib/draft-order";
import DraftHistoryBrowser, { type HistDraft } from "@/components/DraftHistoryBrowser";

export const dynamic = "force-dynamic";

export default async function DraftHistoryPage() {
  const currentYear = await currentDraftYear();
  const cfg = await prisma.leagueConfig.findUnique({ where: { id: 1 }, select: { rosterMode: true } });
  const realMode = cfg?.rosterMode === "real";
  // Real NHL draft history belongs to the real-roster world; this league's own drafts
  // belong to ProfiNHL mode. Show only the set that matches the active roster source.
  const sourceFilter = realMode ? { source: "real" } : { OR: [{ source: null }, { source: "profinhl" }] };

  const rows = await prisma.draftProspect.findMany({
    where: { draftYear: { lte: currentYear }, draftedByTeamId: { not: null }, overallPick: { not: null }, ...sourceFilter },
    orderBy: [{ draftYear: "desc" }, { overallPick: "asc" }],
    select: { id: true, name: true, position: true, country: true, overallPick: true, draftYear: true, draftedByTeamId: true, amateurLeague: true },
  });
  const teams = await prisma.team.findMany({ where: { league: "NHL", isAffiliate: false }, select: { id: true, code: true, logoUrl: true } });
  const teamOf = new Map(teams.map((t) => [t.id, t]));

  // one tab per draft year. In ProfiNHL mode always include the live league draft (a
  // placeholder until it finishes); in real mode just show the years with real data.
  const byYear = new Map<number, typeof rows>();
  for (const r of rows) { (byYear.get(r.draftYear) ?? byYear.set(r.draftYear, []).get(r.draftYear)!).push(r); }
  const years = [...new Set([...(realMode ? [] : [currentYear]), ...byYear.keys()])].sort((a, b) => b - a);

  const drafts: HistDraft[] = years.map((year) => {
    const picks = byYear.get(year) ?? [];
    const maxPick = picks.reduce((m, p) => Math.max(m, p.overallPick ?? 0), 0);
    return {
      year,
      season: seasonForDraftYear(year),
      complete: maxPick > 6 * PICKS_PER_ROUND, // reached round 7 ⇒ the draft is done
      picks: picks.map((p) => {
        const t = p.draftedByTeamId ? teamOf.get(p.draftedByTeamId) : undefined;
        return {
          id: p.id, pick: p.overallPick ?? 0, name: p.name, position: p.position,
          flag: countryFlag(p.country), teamCode: t?.code ?? "—", teamLogo: t?.logoUrl ?? null,
          league: p.amateurLeague ?? p.country ?? "",
        };
      }),
    };
  });

  return (
    <div className="space-y-6 py-2">
      <PageHeader title="Draft History" subtitle="Every NHL Entry Draft, by season. Search a player to jump straight to his draft and pick." />
      <DraftHistoryBrowser drafts={drafts} />
    </div>
  );
}
