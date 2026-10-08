import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import RosterTabs from "@/components/RosterTabs";
import { canManageTeam } from "@/lib/auth";
import { currentInjuries, seasonInjuries } from "@/lib/injuries-server";
import { CurrentInjuryTable, SeasonInjuryTable } from "@/components/InjuryTables";
import { getLang } from "@/lib/lang-server";

export const dynamic = "force-dynamic";
const SEASON = "2026-27";

export default async function TeamInjuriesPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const { slug } = await params;
  const lang = await getLang();
  const isCs = lang === "cs";

  const view = (await searchParams).view === "all" ? "all" : "current";
  const team = await prisma.team.findUnique({ where: { slug }, select: { id: true, name: true } });
  if (!team) notFound();

  const [current, all] =
    view === "current"
      ? [await currentInjuries({ teamId: team.id }), []]
      : [[], await seasonInjuries(SEASON, { teamId: team.id })];

  const Tab = ({ id, label, count }: { id: string; label: string; count?: number }) => (
    <Link
      href={`/teams/${slug}/injuries?view=${id}`}
      className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 ${
        view === id
          ? "bg-blue-600 text-white shadow-md shadow-blue-600/30 ring-1 ring-blue-400/40"
          : "bg-slate-900/70 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800/80"
      }`}
    >
      <span>{label}</span>
      {count != null && count > 0 && (
        <span
          className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-black ${
            view === id ? "bg-white/20 text-white" : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
          }`}
        >
          {count}
        </span>
      )}
    </Link>
  );

  return (
    <div className="space-y-6">
      <RosterTabs slug={slug} isGm={await canManageTeam(team.id)} />

      {/* Tabs bar */}
      <div className="flex items-center gap-2 p-1.5 bg-slate-900/60 border border-slate-800/80 rounded-2xl w-fit backdrop-blur-md">
        <Tab id="current" label={isCs ? "Aktuálne zranenia" : "Current Injuries"} count={current.length} />
        <Tab id="all" label={isCs ? "Všetky zranenia (sezóna)" : "All Injuries (season)"} />
      </div>

      {/* Content wrapper */}
      <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-4 sm:p-5 shadow-xl backdrop-blur-md">
        {view === "current" ? (
          <CurrentInjuryTable rows={current} showTeam={false} lang={lang} />
        ) : (
          <SeasonInjuryTable rows={all} showTeam={false} lang={lang} />
        )}
      </div>
    </div>
  );
}
