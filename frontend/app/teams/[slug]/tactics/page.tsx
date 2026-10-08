import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { canManageTeam } from "@/lib/auth";
import SystemEditor from "@/components/SystemEditor";
import CoachAdvice from "@/components/CoachAdvice";
import { loadSimTeam } from "@/lib/sim";
import { loadTeamSystem } from "@/lib/sim/lines";
import { mergeTactics } from "@/lib/sim/tactics";
import { coachAdvice } from "@/lib/coach-advice";
import { getLang } from "@/lib/lang-server";
import BackLink from "@/components/BackLink";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function TeamTacticsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const lang = await getLang();
  const isCs = lang === "cs";

  const team = await prisma.team.findUnique({
    where: { slug },
    include: { headCoach: { select: { name: true } } },
  });
  if (!team) notFound();
  if (!(await canManageTeam(team.id))) redirect(`/teams/${slug}/login`);

  const [sim, system] = await Promise.all([loadSimTeam(team.id), loadTeamSystem(team.id)]);
  const current = mergeTactics(system);
  const advice = coachAdvice(sim.profile, current, sim.coachEx);

  return (
    <div className="space-y-6 pb-20">
      {/* Hero Header */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 sm:p-5 shadow-xl backdrop-blur-md">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-sm shadow-blue-500/80 ring-2 ring-blue-500/20" />
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white uppercase">
                {isCs ? "Herný systém tímu" : "Team System & Tactics"}
              </h1>
              <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700/60">
                {team.name}
              </span>
            </div>

            <div className="flex gap-4 text-xs mt-2 items-center">
              <BackLink fallback={`/teams/${slug}`} label={isCs ? "tím" : "team"} />
              <Link href={`/teams/${slug}/lines`} className="text-slate-400 hover:text-blue-400 transition-colors">
                {isCs ? "Zostavy (Lines) →" : "Lines →"}
              </Link>
              <Link href={`/teams/${slug}/roster`} className="text-slate-400 hover:text-blue-400 transition-colors">
                {isCs ? "Súpiska (Roster) →" : "Roster →"}
              </Link>
            </div>
          </div>
        </div>

        <p className="text-xs text-slate-400 mt-3 leading-relaxed max-w-3xl">
          {isCs
            ? "Nastavte strategickú identitu svojho klubu. Každé nastavenie prináša taktické výhody aj reálne náklady na ľade. Správny súlad s profilom vašich hráčov zosilňuje výkon a prináša lepšie výsledky v simulácii."
            : "Set your club's strategic identity. Every tactical dial has an upside and real cost on the ice. Aligning your system with your roster's attributes amplifies benefits and drives winning results in the sim."}
        </p>
      </div>

      {/* Head Coach Advice */}
      <CoachAdvice
        teamId={team.id}
        suggestions={advice}
        canManage
        coachName={team.headCoach?.name || team.coach}
        coachEx={sim.coachEx}
      />

      {/* Interactive System Editor */}
      <SystemEditor
        teamId={team.id}
        profile={sim.profile}
        initial={current}
        coachEx={sim.coachEx}
      />
    </div>
  );
}
