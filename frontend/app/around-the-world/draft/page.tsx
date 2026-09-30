import { prisma } from "@/lib/prisma";
import { BackPill, Card, PageHeader } from "@/components/ui";
import WorldCompetitionNav from "@/components/WorldCompetitionNav";
import { currentDraftYear } from "@/lib/draft-class-import";
import { currentDraftSourceWhere } from "@/lib/draft-source";
import { normalizeWorldName } from "@/lib/world-player-identity";
import { countryFlag } from "@/lib/flags";
import { epProfileUrl } from "@/lib/playerName";

export const dynamic = "force-dynamic";

/** The upcoming draft class in board order, each prospect joined (by unique name) to his
 *  live Around the World season line. Stats refresh whenever the world importers sync. */
export default async function WorldDraftBoardPage() {
  const year = await currentDraftYear();
  const src = await currentDraftSourceWhere();
  const prospects = await prisma.draftProspect.findMany({
    where: { draftYear: year, ...src }, orderBy: [{ potential: "desc" }, { ov: "desc" }, { id: "asc" }],
  });
  const world = await prisma.worldPlayer.findMany({
    where: { normalizedName: { in: prospects.map((p) => normalizeWorldName(p.name)) } },
    include: { stats: { include: { league: true, team: true }, orderBy: { season: "desc" } } },
  });
  const byName = new Map<string, typeof world>();
  for (const w of world) byName.set(w.normalizedName, [...(byName.get(w.normalizedName) ?? []), w]);

  const rows = prospects.map((p, i) => {
    const matches = byName.get(normalizeWorldName(p.name)) ?? [];
    const w = matches.length === 1 ? matches[0] : null;
    const latestSeason = w?.stats[0]?.season;
    const lines = w && latestSeason ? w.stats.filter((s) => s.season === latestSeason) : [];
    return { p, rank: i + 1, w, lines, season: latestSeason };
  });
  const withStats = rows.filter((r) => r.lines.length).length;

  return (
    <div className="space-y-6 py-2">
      <BackPill href="/around-the-world">Around the World</BackPill>
      <PageHeader title={`${year} Draft Board`} subtitle={`${rows.length} prospects in board order · ${withStats} with live stats from Around the World`} />
      <WorldCompetitionNav />
      <Card>
        {rows.length === 0 ? <p className="py-8 text-center text-sm text-slate-400">No draft class loaded yet.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wider text-slate-500">
                <tr><th className="p-2 text-left">#</th><th className="p-2 text-left">Player</th><th className="p-2 text-left">Pos</th><th className="p-2 text-left">League / team</th>
                  <th className="p-2 text-right">GP</th><th className="p-2 text-right">G</th><th className="p-2 text-right">A</th><th className="p-2 text-right">P</th><th className="p-2 text-right">PIM</th><th className="p-2 text-right">SV% / GAA</th><th className="p-2 text-left">Season</th></tr>
              </thead>
              <tbody>
                {rows.map(({ p, rank, w, lines, season }) => {
                  const l = lines[0];
                  const sum = (k: "gamesPlayed" | "goals" | "assists" | "points" | "penaltyMinutes") => lines.reduce((a, s) => a + s[k], 0);
                  return (
                    <tr key={p.id} className="border-t border-slate-800/70 hover:bg-slate-800/30">
                      <td className="p-2 text-slate-500 tabular-nums">{rank}</td>
                      <td className="p-2"><a href={w?.epUrl ?? epProfileUrl(p.name)} target="_blank" rel="noreferrer" className="font-medium text-slate-100 hover:text-blue-400">{countryFlag(p.country)} {p.name}</a>
                        {p.draftedByTeamId != null && <span className="ml-2 text-[10px] text-emerald-400">drafted</span>}</td>
                      <td className="p-2 text-slate-300">{p.position}</td>
                      <td className="p-2 text-slate-400">{l ? `${l.league.code}${l.team ? ` · ${l.team.name}` : ""}` : (p.amateurLeague ?? "—")}</td>
                      <td className="p-2 text-right tabular-nums">{l ? sum("gamesPlayed") : "—"}</td>
                      <td className="p-2 text-right tabular-nums">{l && !l.isGoalie ? sum("goals") : "—"}</td>
                      <td className="p-2 text-right tabular-nums">{l && !l.isGoalie ? sum("assists") : "—"}</td>
                      <td className="p-2 text-right tabular-nums font-semibold text-slate-100">{l && !l.isGoalie ? sum("points") : "—"}</td>
                      <td className="p-2 text-right tabular-nums text-slate-400">{l && !l.isGoalie ? sum("penaltyMinutes") : "—"}</td>
                      <td className="p-2 text-right tabular-nums text-slate-300">{l?.isGoalie ? `${l.savePercentage != null ? l.savePercentage.toFixed(3) : "—"} / ${l.goalsAgainstAverage != null ? l.goalsAgainstAverage.toFixed(2) : "—"}` : "—"}</td>
                      <td className="p-2 text-slate-500">{season ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
