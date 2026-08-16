import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { computeStandings, powerRanking } from "@/lib/sim/standings";
import StandingsTable from "@/components/StandingsTable";
import type { TeamStanding, PowerRow } from "@/lib/sim/standings";
import { PageHeader, Card } from "@/components/ui";

export const dynamic = "force-dynamic";
const SEASON = "2026-27";
type View = "league" | "conference" | "division" | "power";
type TeamMeta = Map<number, { logoUrl: string | null; slug: string }>;

export default async function StandingsPage({ searchParams }: { searchParams: Promise<{ league?: string; view?: string }> }) {
  const sp = await searchParams;
  const league = sp.league === "AHL" ? "AHL" : "NHL";
  const view: View = sp.view === "league" || sp.view === "division" || sp.view === "power" ? sp.view : "conference";
  const [standings, power, teams] = await Promise.all([
    computeStandings(SEASON, league),
    powerRanking(SEASON, league, 10),
    prisma.team.findMany({ select: { id: true, logoUrl: true, slug: true } }),
  ]);
  const meta: TeamMeta = new Map(teams.map((t) => [t.id, { logoUrl: t.logoUrl, slug: t.slug }]));
  const played = standings.reduce((t, s) => t + s.gp, 0) / 2;
  const q = (v: View) => `/standings?${league === "AHL" ? "league=AHL&" : ""}view=${v}`;

  // group into sections based on the selected view
  const groups: { title: string; color: string; teams: TeamStanding[] }[] = [];
  if (view === "conference") {
    const by = (name: string) => standings.filter((s) => s.conference?.trim().toLowerCase() === name);
    const east = by("eastern conference"), west = by("western conference");
    const rest = standings.filter((s) => !east.includes(s) && !west.includes(s));
    if (east.length) groups.push({ title: "Eastern Conference", color: "text-blue-400", teams: east });
    if (west.length) groups.push({ title: "Western Conference", color: "text-red-400", teams: west });
    if (rest.length) groups.push({ title: "League", color: "text-slate-400", teams: rest });
  } else if (view === "division") {
    const divs = [...new Set(standings.map((s) => s.division ?? "—"))].sort();
    for (const d of divs) groups.push({ title: d, color: "text-emerald-400", teams: standings.filter((s) => (s.division ?? "—") === d) });
  } else {
    groups.push({ title: "League", color: "text-slate-300", teams: standings });
  }

  const Tab = ({ v, label }: { v: View; label: string }) => (
    <Link href={q(v)} className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${view === v ? "bg-blue-600 text-white" : "border border-slate-700 text-slate-400 hover:bg-slate-800"}`}>{label}</Link>
  );

  return (
    <div className="space-y-8 py-2">
      <PageHeader
        title={`${league} Standings`}
        subtitle={`${SEASON} • ${played} games played`}
        right={
          <div className="flex gap-2 flex-wrap">
            <Tab v="league" label="League" />
            <Tab v="conference" label="Conference" />
            <Tab v="division" label="Division" />
            <Tab v="power" label="⚡ Power Ranking" />
          </div>
        }
      />

      {view === "power" ? (
        <section>
          <p className="text-slate-500 text-xs mb-4">Auto-ranked by results over each team&apos;s last 10 games (best form first).</p>
          <PowerTable rows={power} meta={meta} />
        </section>
      ) : (
        groups.map((g) => (
          <section key={g.title}>
            <h2 className={`text-lg font-bold ${g.color} mb-4`}>{g.title}</h2>
            <StandingsTable rows={g.teams.map((t) => ({ teamId: t.teamId, name: t.name, gp: t.gp, w: t.w, l: t.l, otl: t.otl, points: t.points, gf: t.gf, ga: t.ga, diff: t.diff, logoUrl: meta.get(t.teamId)?.logoUrl ?? null, slug: meta.get(t.teamId)?.slug ?? null }))} />
          </section>
        ))
      )}
    </div>
  );
}

function TeamCell({ id, name, meta }: { id: number; name: string; meta: TeamMeta }) {
  const m = meta.get(id);
  const inner = (
    <span className="flex items-center gap-2 min-w-0">
      {m?.logoUrl && <img src={m.logoUrl} alt="" className="w-5 h-5 object-contain shrink-0" />}
      <span className="font-medium truncate">{name}</span>
    </span>
  );
  return m?.slug ? <Link href={`/teams/${m.slug}`} className="hover:text-blue-400 transition-colors">{inner}</Link> : inner;
}

function FormPips({ form }: { form: string }) {
  const marks = form ? form.split(" ") : [];
  return (
    <div className="flex gap-1 justify-center">
      {marks.map((m, i) => (
        <span key={i} title={m}
          className={`w-4 h-4 rounded-full text-[8px] font-bold grid place-items-center ${m === "W" ? "bg-green-600 text-white" : m === "OTL" ? "bg-amber-600 text-white" : "bg-slate-700 text-slate-300"}`}>
          {m === "OTL" ? "O" : m}
        </span>
      ))}
    </div>
  );
}

function PowerTable({ rows, meta }: { rows: PowerRow[]; meta: TeamMeta }) {
  return (
    <Card bodyClassName="p-0">
      <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[640px]">
        <thead>
          <tr className="border-b border-slate-800 bg-slate-800/30 text-slate-500 text-xs uppercase tracking-wider">
            <th className="px-4 py-3 text-left font-medium">#</th>
            <th className="px-4 py-3 text-left font-medium">Team</th>
            <th className="px-3 py-3 text-center font-medium">Last 10</th>
            <th className="px-3 py-3 text-center font-medium">PTS</th>
            <th className="px-3 py-3 text-center font-medium">Diff</th>
            <th className="px-4 py-3 text-center font-medium">Form (old → new)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((t, i) => (
            <tr key={t.teamId} className="border-b border-slate-800/40 hover:bg-slate-800/30 transition-colors last:border-0">
              <td className="px-4 py-2.5 font-bold text-slate-500">{i + 1}</td>
              <td className="px-4 py-2.5"><TeamCell id={t.teamId} name={t.name} meta={meta} /></td>
              <td className="px-3 py-2.5 text-center tabular-nums">{t.w}-{t.l}-{t.otl}</td>
              <td className="px-3 py-2.5 text-center font-bold text-white tabular-nums">{t.points}</td>
              <td className={`px-3 py-2.5 text-center tabular-nums ${t.diff > 0 ? "text-green-400" : t.diff < 0 ? "text-red-400" : "text-slate-400"}`}>{t.diff > 0 ? `+${t.diff}` : t.diff}</td>
              <td className="px-4 py-2.5"><FormPips form={t.form} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </Card>
  );
}
