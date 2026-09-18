import { prisma } from "@/lib/prisma";
import PlayerCompare, { type ComparePlayer } from "@/components/PlayerCompare";
import { cleanName } from "@/lib/playerName";
import { isLoggedIn } from "@/lib/auth";
import { redactAttrs } from "@/lib/player-attrs";

export const dynamic = "force-dynamic";

export default async function ComparePage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const { p: pParam } = await searchParams;
  const initialId = pParam ? Number(pParam) : null;
  const [rows, teams, loggedIn] = await Promise.all([
    prisma.player.findMany({
      where: { rosterType: { in: ["NHL", "AHL", "UFA"] } },
      select: {
        id: true, name: true, position: true, isGoalie: true, teamId: true, rosterType: true, age: true, overall: true, contractText: true, condition: true, mo: true,
        ck: true, fg: true, di: true, sk: true, st: true, en: true, du: true, ph: true, fo: true, pa: true, sc: true, df: true, ps: true, ex: true, ld: true,
        goalieRating: {
          select: {
            sk: true, du: true, en: true, sz: true, ag: true, rb: true, sc: true, hs: true, rt: true, ph: true, ps: true, ex: true, ld: true, mo: true, overall: true,
          },
        },
      },
      orderBy: { overall: "desc" },
    }),
    prisma.team.findMany({ select: { id: true, code: true } }),
    isLoggedIn(),
  ]);
  const codeById = new Map(teams.map((t) => [t.id, t.code]));
  const toCP = (p: (typeof rows)[number]): ComparePlayer => {
    const isGoalie = p.isGoalie || p.position === "G";
    const gr = p.goalieRating;
    const attrs = isGoalie && gr
      ? {
          sk: gr.sk,
          du: gr.du,
          en: gr.en,
          sz: gr.sz,
          ag: gr.ag,
          rb: gr.rb,
          sc: gr.sc,
          hs: gr.hs,
          rt: gr.rt,
          ph: gr.ph,
          ps: gr.ps,
          ex: gr.ex,
          ld: gr.ld,
          mo: p.mo ?? gr.mo,
        }
      : {
          ck: p.ck,
          fg: p.fg,
          di: p.di,
          sk: p.sk,
          st: p.st,
          en: p.en,
          du: p.du,
          ph: p.ph,
          fo: p.fo,
          pa: p.pa,
          sc: p.sc,
          df: p.df,
          ps: p.ps,
          ex: p.ex,
          ld: p.ld,
          mo: p.mo,
        };

    return {
      id: p.id,
      name: cleanName(p.name),
      position: p.position,
      teamCode: p.rosterType === "UFA" ? "UFA" : (p.teamId ? codeById.get(p.teamId) ?? null : null),
      age: p.age,
      overall: isGoalie && gr?.overall != null ? gr.overall : p.overall,
      contractText: p.contractText,
      condition: p.condition,
      goalie: isGoalie,
      ...attrs,
    } as unknown as ComparePlayer;
  };
  const redact = (p: ComparePlayer) => redactAttrs(p as unknown as Record<string, unknown>, !loggedIn) as unknown as ComparePlayer;
  const all = rows.map(toCP).map(redact);
  const skaters = all.filter((p) => !p.goalie);
  const goalies = all.filter((p) => p.goalie);

  return <div className="py-2"><PlayerCompare skaters={skaters} goalies={goalies} initialId={initialId} hideAttrs={!loggedIn} /></div>;
}
