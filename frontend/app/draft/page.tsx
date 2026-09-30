import { prisma } from "@/lib/prisma";
import { PageHeader, Card } from "@/components/ui";
import { countryFlag } from "@/lib/flags";
import { currentDraftYear } from "@/lib/draft-class-import";
import { currentDraftSourceWhere } from "@/lib/draft-source";
import DraftAvailableBoard, { type BoardProspect } from "@/components/DraftAvailableBoard";

export const dynamic = "force-dynamic";

export default async function UpcomingDraftPage({ searchParams }: { searchParams?: Promise<{ year?: string }> }) {
  const sp = searchParams ? await searchParams : {};
  const curYear = await currentDraftYear();
  const src = await currentDraftSourceWhere();
  
  // Find all years with prospects
  const availableYears = await prisma.draftProspect.findMany({
    where: { draftedByTeamId: null, ...src },
    select: { draftYear: true },
    distinct: ["draftYear"],
    orderBy: { draftYear: "desc" },
  });
  const years = availableYears.map((y) => y.draftYear);
  if (!years.includes(curYear)) years.unshift(curYear);

  const year = sp.year ? Number(sp.year) : (years.find((y) => y !== curYear) ?? curYear);

  const up = await prisma.draftProspect.findMany({
    where: { draftYear: year, draftedByTeamId: null, ...src },
    orderBy: [{ potential: "desc" }, { ov: "desc" }],
  });
  const board: BoardProspect[] = up.map((p) => ({
    id: p.id, name: p.name, position: p.position, country: p.country, shoots: p.shoots,
    amateurLeague: p.amateurLeague, amateurClub: p.amateurClub, flag: countryFlag(p.country),
    heightIn: p.heightIn, weightLb: p.weightLb,
  }));

  return (
    <div className="space-y-6 py-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageHeader
          title="Upcoming Draft"
          subtitle={up.length ? `${year} class · ${up.length} available prospects · NHL Central Scouting rankings` : `${year} NHL Entry Draft`}
        />
        <div className="flex items-center gap-2">
          {years.map((y) => (
            <a
              key={y}
              href={`/draft?year=${y}`}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold border transition-all ${
                y === year
                  ? "border-sky-500 bg-sky-600/20 text-sky-300 font-bold"
                  : "border-slate-800 bg-slate-900/60 text-slate-400 hover:text-white"
              }`}
            >
              {y}
            </a>
          ))}
          <a
            href="/draft/rankings"
            className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-sm font-bold text-amber-300 hover:bg-amber-500/20 transition-all"
          >
            📋 Draft Rankings →
          </a>
        </div>
      </div>
      {up.length > 0 ? (
        <DraftAvailableBoard prospects={board} canPick={false} />
      ) : (
        <Card>
          <div className="text-center py-12 space-y-3">
            <div className="text-4xl" aria-hidden>🏒</div>
            <p className="text-slate-200 font-semibold">The {year} draft class isn&apos;t published yet.</p>
            <p className="text-sm text-slate-500 max-w-lg mx-auto">
              NHL Central Scouting releases the {year} rankings during the season — a mid-term list around January, the final ranking in the spring. The league imports and refreshes them automatically, and the first prospects will show up here as soon as they&apos;re out.
            </p>
            <p className="text-xs text-slate-600">This board fills in with the same {year} class the live Draft Room uses — browse it here early, then pick from it there.</p>
          </div>
        </Card>
      )}
    </div>
  );
}
