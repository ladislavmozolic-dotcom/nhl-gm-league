import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card } from "@/components/ui";
import { CoachesTable } from "@/components/CoachesTable";

export const dynamic = "force-dynamic";

export default async function CoachesPage({ searchParams }: { searchParams: Promise<{ league?: string; view?: string }> }) {
  const sp = await searchParams;
  const view = sp.view === "FA" ? "FA" : sp.league === "AHL" ? "AHL" : "NHL";

  type Row = { team?: { name: string; slug: string; logoUrl: string | null }; coach: { name: string; country: string | null; style: string; ph: number; df: number; of: number; pd: number; ex: number; ld: number; overall: number; age: number | null } | null };
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

  const Tab = ({ v, label, href }: { v: string; label: string; href: string }) => (
    <Link href={href} className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${view === v ? "bg-blue-600 text-white" : "border border-slate-700 text-slate-400 hover:bg-slate-800"}`}>{label}</Link>
  );

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

      <Card bodyClassName="p-0 pt-3">
        <CoachesTable rows={rows} view={view} />
      </Card>

      {view !== "FA" && (
        <p className="text-xs text-slate-500 px-1">
          A coach nudges the whole team: <span className="text-rose-300">OF</span> lifts scoring, <span className="text-sky-300">DF</span> tightens defense,
          <span className="text-slate-300"> PD</span> (Player Discipline) means fewer penalties, <span className="text-slate-300">EX</span> steadies the club late in games,
          and the <b>style</b> rewards a matching game plan. Check the <Link href="/coaches?view=FA" className="text-blue-400">Available</Link> pool to upgrade your bench.
        </p>
      )}
    </div>
  );
}
