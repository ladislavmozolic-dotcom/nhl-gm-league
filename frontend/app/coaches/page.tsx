import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card } from "@/components/ui";

export const dynamic = "force-dynamic";

const STYLE_CLASS: Record<string, string> = {
  Offensive: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  Defensive: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  Physical: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  Balanced: "bg-slate-500/15 text-slate-300 border-slate-500/30",
};
const ratColor = (v: number) => (v >= 90 ? "text-emerald-400" : v >= 82 ? "text-slate-200" : v >= 70 ? "text-slate-400" : "text-slate-500");

type Coach = { name: string; country: string | null; style: string; ph: number; df: number; of: number; pd: number; ex: number; ld: number; overall: number; age: number | null };
type Row = { team?: { name: string; slug: string; logoUrl: string | null }; coach: Coach | null };

export default async function CoachesPage({ searchParams }: { searchParams: Promise<{ league?: string; view?: string }> }) {
  const sp = await searchParams;
  const view = sp.view === "FA" ? "FA" : sp.league === "AHL" ? "AHL" : "NHL";

  let rows: Row[] = [];
  if (view === "FA") {
    const fa = await prisma.coach.findMany({ where: { teamId: null }, orderBy: [{ overall: "desc" }, { name: "asc" }] });
    rows = fa.map((c) => ({ coach: c }));
  } else {
    const teams = await prisma.team.findMany({
      where: { league: view, isAffiliate: view === "NHL" ? false : undefined },
      select: { name: true, slug: true, logoUrl: true, headCoach: true },
      orderBy: { name: "asc" },
    });
    rows = teams.map((t) => ({ team: { name: t.name, slug: t.slug, logoUrl: t.logoUrl }, coach: t.headCoach }));
  }

  const cols: { key: "of" | "df" | "pd" | "ph" | "ex" | "ld"; label: string; title: string }[] = [
    { key: "of", label: "OF", title: "Offense" },
    { key: "df", label: "DF", title: "Defense" },
    { key: "pd", label: "PD", title: "Discipline" },
    { key: "ph", label: "PH", title: "Physical" },
    { key: "ex", label: "EX", title: "Experience" },
    { key: "ld", label: "LD", title: "Leadership" },
  ];

  const Tab = ({ v, label, href }: { v: string; label: string; href: string }) => (
    <Link href={href} className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${view === v ? "bg-blue-600 text-white" : "border border-slate-700 text-slate-400 hover:bg-slate-800"}`}>{label}</Link>
  );

  const firstColHead = view === "FA" ? "Available Coach" : "Team";

  return (
    <div className="space-y-6 py-2">
      <PageHeader title="Coaches" subtitle="Head coaches and their ratings — a global modifier for the whole bench" />
      <div className="flex gap-2 flex-wrap">
        <Tab v="NHL" label="NHL Coaches" href="/coaches" />
        <Tab v="AHL" label="Farm Coaches" href="/coaches?league=AHL" />
        <Tab v="FA" label={`Available (${view === "FA" ? rows.length : "free agents"})`} href="/coaches?view=FA" />
      </div>

      {view === "FA" && (
        <p className="text-xs text-slate-400 px-1">Unsigned coaches available to hire, sorted by overall. Hire or fire from your club&apos;s <span className="text-slate-300">Team → Head Coach</span> page — firing pays out the coach&apos;s full remaining contract (salary × years) from the bank.</p>
      )}

      <Card bodyClassName="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[880px]">
            <thead>
              <tr className="text-xs text-slate-500 uppercase tracking-wider border-b border-slate-800 bg-slate-800/30">
                <th className="text-left px-4 py-3 font-medium">{firstColHead}</th>
                {view !== "FA" && <th className="text-left px-3 py-3 font-medium">Head Coach</th>}
                {view === "FA" && <th className="text-left px-3 py-3 font-medium">Country</th>}
                <th className="text-left px-3 py-3 font-medium">Style</th>
                {cols.map((c) => <th key={c.key} className="text-right px-2.5 py-3 font-medium" title={c.title}>{c.label}</th>)}
                <th className="text-right px-3 py-3 font-medium" title="Overall">OV</th>
                <th className="text-right px-4 py-3 font-medium">Age</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const c = r.coach;
                return (
                  <tr key={r.team?.slug ?? `${c?.name}-${i}`} className="border-b border-slate-800/40 hover:bg-slate-800/30 transition-colors last:border-0">
                    <td className="px-4 py-3">
                      {r.team ? (
                        <Link href={`/teams/${r.team.slug}`} className="flex items-center gap-2 hover:text-blue-400 transition-colors">
                          {r.team.logoUrl && <img src={r.team.logoUrl} alt="" className="w-6 h-6 object-contain" />}
                          <span className="font-medium">{r.team.name}</span>
                        </Link>
                      ) : (
                        <span className="font-medium">{c?.name ?? "—"}</span>
                      )}
                    </td>
                    {view !== "FA" && <td className="px-3 py-3 font-medium">{c?.name ?? <span className="text-slate-600">— vacant —</span>}</td>}
                    {view === "FA" && <td className="px-3 py-3 text-slate-400">{c?.country ?? "—"}</td>}
                    <td className="px-3 py-3">
                      {c ? <span className={`inline-block px-2 py-0.5 rounded border text-xs font-semibold ${STYLE_CLASS[c.style] ?? STYLE_CLASS.Balanced}`}>{c.style}</span> : <span className="text-slate-600">—</span>}
                    </td>
                    {cols.map((col) => (
                      <td key={col.key} className={`px-2.5 py-3 text-right tabular-nums ${c ? ratColor(c[col.key]) : "text-slate-600"}`}>{c ? c[col.key] : "—"}</td>
                    ))}
                    <td className={`px-3 py-3 text-right tabular-nums font-bold ${c ? ratColor(c.overall) : "text-slate-600"}`}>{c?.overall ?? "—"}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-400">{c?.age ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
      {view !== "FA" && (
        <p className="text-xs text-slate-500 px-1">
          A coach nudges the whole team: <span className="text-rose-300">OF</span> lifts scoring, <span className="text-sky-300">DF</span> tightens defense,
          <span className="text-slate-300"> PD</span> means fewer penalties, <span className="text-slate-300">EX</span> steadies the club late in games,
          and the <b>style</b> rewards a matching game plan. Check the <Link href="/coaches?view=FA" className="text-blue-400">Available</Link> pool to upgrade your bench.
        </p>
      )}
    </div>
  );
}
