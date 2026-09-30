import { prisma } from "@/lib/prisma";
import { BackPill, Card, PageHeader } from "@/components/ui";
import WorldCompetitionNav from "@/components/WorldCompetitionNav";
import { currentDraftYear } from "@/lib/draft-class-import";
import { currentDraftSourceWhere } from "@/lib/draft-source";
import { normalizeWorldName } from "@/lib/world-player-identity";
import { countryFlag } from "@/lib/flags";
import { epProfileUrl } from "@/lib/playerName";
import Link from "next/link";
import { getTeamSession } from "@/lib/auth";
import { loadBoard } from "@/lib/draft-rankings-server";

export const dynamic = "force-dynamic";

/** The upcoming draft class in board order, each prospect joined (by unique name) to his
 *  live Around the World season line. Stats refresh whenever the world importers sync. */
export default async function WorldDraftBoardPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const sp = await searchParams;
  const teamId = await getTeamSession();
  const year = await currentDraftYear();
  const src = await currentDraftSourceWhere();
  const prospects = await prisma.draftProspect.findMany({
    where: { draftYear: year, ...src }, orderBy: [{ potential: "desc" }, { ov: "desc" }, { id: "asc" }],
  });
  // the signed-in GM's own private board (Draft Rankings): queue first, then watchlist
  const mine = teamId != null ? await loadBoard(teamId, year) : [];
  const myByProspect = new Map(mine.filter((m) => m.prospectId != null).map((m) => [m.prospectId as number, m]));
  const myView = mine.length > 0 && sp.view !== "class";
  const world = await prisma.worldPlayer.findMany({
    where: { normalizedName: { in: [...prospects.map((p) => p.name), ...mine.map((m) => m.name)].map(normalizeWorldName) } },
    include: { stats: { include: { league: true, team: true }, orderBy: { season: "desc" } } },
  });
  const byName = new Map<string, typeof world>();
  for (const w of world) byName.set(w.normalizedName, [...(byName.get(w.normalizedName) ?? []), w]);

  type Row = { key: string; n: number; name: string; position: string; country: string | null; league: string | null; drafted: boolean; myRank: number | null; tier: string | null; note: string | null; custom: boolean; saved: boolean };
  const base: Row[] = myView
    ? mine.map((m, i) => ({ key: `m${m.id}`, n: i + 1, name: m.name, position: m.position, country: m.country, league: m.amateurLeague, drafted: m.drafted, myRank: m.rank || null, tier: m.tier, note: m.note, custom: m.custom, saved: true }))
    : prospects.map((p, i) => { const m = myByProspect.get(p.id); return { key: `p${p.id}`, n: i + 1, name: p.name, position: p.position, country: p.country, league: p.amateurLeague, drafted: p.draftedByTeamId != null, myRank: m ? (m.rank || null) : null, tier: m?.tier ?? null, note: m?.note ?? null, custom: false, saved: !!m }; });
  const rows = base.map((r) => {
    const matches = byName.get(normalizeWorldName(r.name)) ?? [];
    const w = matches.length === 1 ? matches[0] : null;
    const latestSeason = w?.stats[0]?.season;
    const lines = w && latestSeason ? w.stats.filter((s) => s.season === latestSeason) : [];
    return { r, w, lines, season: latestSeason };
  });
  const withStats = rows.filter((r) => r.lines.length).length;

  return (
    <div className="space-y-6 py-2">
      <BackPill href="/around-the-world">Around the World</BackPill>
      <PageHeader title={`${year} Draft Board`} subtitle={myView ? `Your private board (Draft Rankings) · ${rows.length} players · ${withStats} with live stats` : `${rows.length} prospects in board order · ${withStats} with live stats from Around the World`} />
      {mine.length > 0 && (
        <div className="flex items-center gap-2 text-sm">
          <Link href="/around-the-world/draft" className={`rounded-lg border px-3 py-1.5 font-semibold ${myView ? "border-blue-500 bg-blue-600 text-white" : "border-slate-800 bg-slate-900/50 text-slate-300"}`}>My board</Link>
          <Link href="/around-the-world/draft?view=class" className={`rounded-lg border px-3 py-1.5 font-semibold ${!myView ? "border-blue-500 bg-blue-600 text-white" : "border-slate-800 bg-slate-900/50 text-slate-300"}`}>Full class</Link>
          <Link href="/draft/rankings" className="ml-auto text-slate-400 hover:text-blue-400">Edit my board →</Link>
        </div>
      )}
      <WorldCompetitionNav />
      <Card>
        {rows.length === 0 ? <p className="py-8 text-center text-sm text-slate-400">No draft class loaded yet.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wider text-slate-500">
                <tr><th className="p-2 text-left">#</th>{teamId != null && <th className="p-2 text-left">Mine</th>}<th className="p-2 text-left">Player</th><th className="p-2 text-left">Pos</th><th className="p-2 text-left">League / team</th>
                  <th className="p-2 text-right">GP</th><th className="p-2 text-right">G</th><th className="p-2 text-right">A</th><th className="p-2 text-right">P</th><th className="p-2 text-right">PIM</th><th className="p-2 text-right">SV% / GAA</th><th className="p-2 text-left">Season</th></tr>
              </thead>
              <tbody>
                {rows.map(({ r, w, lines, season }) => {
                  const l = lines[0];
                  const sum = (k: "gamesPlayed" | "goals" | "assists" | "points" | "penaltyMinutes") => lines.reduce((a, s) => a + s[k], 0);
                  return (
                    <tr key={r.key} className="border-t border-slate-800/70 hover:bg-slate-800/30">
                      <td className="p-2 text-slate-500 tabular-nums">{r.n}</td>
                      {teamId != null && <td className="p-2 text-xs text-slate-300 whitespace-nowrap">{r.myRank ? <b className="text-blue-300">#{r.myRank}</b> : r.saved ? "★" : ""}{r.tier ? <span className="ml-1 text-amber-300">{r.tier}</span> : null}{r.note ? <span className="ml-1 text-slate-500" title={r.note}>📝</span> : null}</td>}
                      <td className="p-2"><a href={w?.epUrl ?? epProfileUrl(r.name)} target="_blank" rel="noreferrer" className="font-medium text-slate-100 hover:text-blue-400">{r.custom ? "✍️" : countryFlag(r.country)} {r.name}</a>
                        {r.drafted && <span className="ml-2 text-[10px] text-emerald-400">drafted</span>}</td>
                      <td className="p-2 text-slate-300">{r.position}</td>
                      <td className="p-2 text-slate-400">{l ? `${l.league.code}${l.team ? ` · ${l.team.name}` : ""}` : (r.league ?? "—")}</td>
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
