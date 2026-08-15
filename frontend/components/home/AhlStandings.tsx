import Image from "next/image";
import { prisma } from "@/lib/prisma";

type TeamRow = {
  id: number;
  name: string;
  code: string | null;
  logoUrl: string | null;
  division: string | null;
};

function groupByDivision(teams: TeamRow[]) {
  const groups = new Map<string, TeamRow[]>();
  for (const team of teams) {
    const key = team.division ?? "Other";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(team);
  }
  return Array.from(groups.entries());
}

function StandingsTable({ teams }: { teams: TeamRow[] }) {
  const divisions = groupByDivision(teams);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[1fr_repeat(5,32px)] items-center px-1 pb-1 border-b border-slate-700/50">
        <span className="text-[10px] uppercase text-slate-500">Team</span>
        <span className="text-[10px] uppercase text-slate-500 text-center">GP</span>
        <span className="text-[10px] uppercase text-slate-500 text-center">W</span>
        <span className="text-[10px] uppercase text-slate-500 text-center">L</span>
        <span className="text-[10px] uppercase text-slate-500 text-center">OTL</span>
        <span className="text-[10px] uppercase text-slate-500 text-center">PTS</span>
      </div>

      {divisions.map(([division, divTeams], divIdx) => (
        <div
          key={division}
          className={
            divIdx < divisions.length - 1
              ? "pb-3 border-b-2 border-red-700/70"
              : ""
          }
        >
          <div className="space-y-2">
            {divTeams.map((team) => (
              <div
                key={team.id}
                className="grid grid-cols-[1fr_repeat(5,32px)] items-center"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {team.logoUrl ? (
                    <Image
                      src={team.logoUrl}
                      alt={team.name}
                      width={22}
                      height={22}
                      className="h-[22px] w-[22px] rounded-full object-cover shrink-0"
                    />
                  ) : (
                    <div className="h-[22px] w-[22px] rounded-full bg-slate-700 shrink-0" />
                  )}
                  <span className="text-xs text-white truncate">
                    {team.code ?? team.name}
                  </span>
                </div>
                <span className="text-xs text-slate-400 text-center">0</span>
                <span className="text-xs text-slate-400 text-center">0</span>
                <span className="text-xs text-slate-400 text-center">0</span>
                <span className="text-xs text-slate-400 text-center">0</span>
                <span className="text-xs font-bold text-white text-center">0</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default async function AhlStandings() {
  const eastTeams = await prisma.team.findMany({
    where: {
      conference: "Eastern Conference",
      league: "AHL",
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true, code: true, logoUrl: true, division: true },
  });

  const westTeams = await prisma.team.findMany({
    where: {
      conference: "Western Conference",
      league: "AHL",
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true, code: true, logoUrl: true, division: true },
  });

  const noDataAtAll = eastTeams.length === 0 && westTeams.length === 0;

  return (
    <div className="card p-4">
      <h2 className="text-sm font-bold text-white mb-4">🏆 AHL Standings</h2>

      {noDataAtAll && (
        <p className="text-xs text-amber-400 mb-4">
          Žiadne AHL tímy nenájdené. Skontroluj, či máš v tabuľke Team
          stĺpec <code className="bg-slate-800 px-1 rounded">league</code> s hodnotou <code className="bg-slate-800 px-1 rounded">"AHL"</code>.
        </p>
      )}

      {eastTeams.length > 0 && (
        <div className="mb-6">
          <h3 className="text-xs font-bold text-blue-400 uppercase mb-3">
            Eastern Conference
          </h3>
          <StandingsTable teams={eastTeams} />
        </div>
      )}

      {westTeams.length > 0 && (
        <div>
          <h3 className="text-xs font-bold text-orange-400 uppercase mb-3">
            Western Conference
          </h3>
          <StandingsTable teams={westTeams} />
        </div>
      )}
    </div>
  );
}
