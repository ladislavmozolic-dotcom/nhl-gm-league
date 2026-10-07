import { prisma } from "@/lib/prisma";
import { captaincyFromName } from "@/lib/playerName";
import { PageHeader } from "@/components/ui";
import { getLang } from "@/lib/lang-server";
import CaptainsShowcase, { type TeamLeadership, type CaptainPlayer } from "@/components/CaptainsShowcase";

export const dynamic = "force-dynamic";

const captaincyFilter = {
  OR: [
    { captaincy: { not: null } },
    { name: { contains: "''C''" } },
    { name: { contains: "''A''" } },
  ],
};

function buildCards<
  T extends {
    id: number;
    name: string;
    code: string | null;
    logoUrl: string | null;
    slug: string;
    conference?: string | null;
    players: {
      id: number;
      name: string;
      slug: string;
      photoUrl: string | null;
      position: string | null;
      number: number | null;
      captaincy: string | null;
    }[];
  }
>(teams: T[], league: string): TeamLeadership[] {
  return teams.map((t) => {
    const hasField = t.players.some((p) => p.captaincy === "C" || p.captaincy === "A");
    const roleOf = (p: { captaincy: string | null; name: string }) =>
      hasField ? (p.captaincy as "C" | "A" | null) : captaincyFromName(p.name);

    const marked: CaptainPlayer[] = t.players.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      photoUrl: p.photoUrl,
      position: p.position,
      number: p.number,
      role: roleOf(p),
    }));

    const captain = marked.find((p) => p.role === "C");
    const assistants = marked.filter((p) => p.role === "A");

    return {
      id: t.id,
      name: t.name,
      code: t.code,
      logoUrl: t.logoUrl,
      slug: t.slug,
      conference: t.conference ?? null,
      league,
      captain,
      assistants,
    };
  });
}

export default async function CaptainsPage() {
  const [lang, nhlTeams, ahlTeams] = await Promise.all([
    getLang(),
    prisma.team.findMany({
      where: { league: "NHL", isAffiliate: false },
      select: {
        id: true,
        name: true,
        code: true,
        logoUrl: true,
        slug: true,
        conference: true,
        players: {
          where: { rosterType: "NHL", ...captaincyFilter },
          select: {
            id: true,
            name: true,
            slug: true,
            photoUrl: true,
            position: true,
            number: true,
            captaincy: true,
          },
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.team.findMany({
      where: { league: "AHL" },
      select: {
        id: true,
        name: true,
        code: true,
        logoUrl: true,
        slug: true,
        players: {
          where: { rosterType: "AHL", ...captaincyFilter },
          select: {
            id: true,
            name: true,
            slug: true,
            photoUrl: true,
            position: true,
            number: true,
            captaincy: true,
          },
        },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  const isCs = lang === "cs";

  const nhlCards = buildCards(nhlTeams, "NHL");
  const ahlCards = buildCards(ahlTeams, "AHL");

  return (
    <div className="space-y-6 py-2">
      <PageHeader
        title={isCs ? "Kapitáni & Asistenti" : "Captains & Alternates"}
        subtitle={
          isCs
            ? "Lídri a vedenie kabíny vo všetkých kluboch NHL a farmárskej AHL"
            : "Team leadership groups across all NHL and AHL farm clubs"
        }
      />

      <CaptainsShowcase nhlTeams={nhlCards} ahlTeams={ahlCards} lang={lang} />
    </div>
  );
}
