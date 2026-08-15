import { prisma } from "@/lib/prisma";
import { PageHeader, Card } from "@/components/ui";
import { countryFlag } from "@/lib/flags";
import { nextDraftYear } from "@/lib/draft-class-import";
import { currentDraftSourceWhere } from "@/lib/draft-source";
import DraftAvailableBoard, { type BoardProspect } from "@/components/DraftAvailableBoard";

export const dynamic = "force-dynamic";

export default async function UpcomingDraftPage() {
  const year = await nextDraftYear();
  const up = await prisma.draftProspect.findMany({
    where: { draftYear: year, draftedByTeamId: null, ...(await currentDraftSourceWhere()) },
    orderBy: [{ potential: "desc" }, { ov: "desc" }],
  });
  const board: BoardProspect[] = up.map((p) => ({
    id: p.id, name: p.name, position: p.position, country: p.country, shoots: p.shoots,
    amateurLeague: p.amateurLeague, amateurClub: p.amateurClub, flag: countryFlag(p.country),
    heightIn: p.heightIn, weightLb: p.weightLb,
  }));

  return (
    <div className="space-y-6 py-2">
      <PageHeader
        title="Upcoming Draft"
        subtitle={up.length ? `${year} class · ${up.length} prospects · NHL Central Scouting rankings` : `${year} NHL Entry Draft`}
      />
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
            <p className="text-xs text-slate-600">The {year} draft becomes the live Draft Room once the {year - 1}-{String(year).slice(2)} season ends.</p>
          </div>
        </Card>
      )}
    </div>
  );
}
