import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getTeamSession } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import LoginForm from "@/components/LoginForm";

export const dynamic = "force-dynamic";

export default async function GmLoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const [teams, session] = await Promise.all([
    prisma.team.findMany({
      where: { league: "NHL", isAffiliate: false },
      select: { id: true, name: true, slug: true, logoUrl: true, passwordHash: true },
      orderBy: { name: "asc" },
    }),
    getTeamSession(),
  ]);
  const current = session ? teams.find((t) => t.id === session) : null;
  // teams still open for a new GM to claim (registration) — the only reason to pick a team
  const openTeams = teams.filter((t) => !t.passwordHash);

  return (
    <div className="space-y-6 py-2 max-w-3xl">
      <PageHeader title="GM Sign In" subtitle="Sign in with your email or nickname — you go straight to your roster." />

      {current && (
        <div className="flex items-center gap-3 bg-green-500/10 border border-green-500/30 rounded-xl px-4 py-3 text-sm">
          {current.logoUrl && <img src={current.logoUrl} alt="" className="w-8 h-8 object-contain" />}
          <span>Signed in as GM <b>{current.name}</b>.</span>
          <Link href={`/teams/${current.slug}/roster`} className="ml-auto text-green-300 hover:underline">Open roster →</Link>
        </div>
      )}

      {/* direct sign-in — registered GMs don't pick a team */}
      <LoginForm initialError={error} />

      {/* new GM registration — the only place a team is picked */}
      {openTeams.length > 0 && (
        <div className="space-y-3 pt-2">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">New GM? Pick a free team</h2>
          <p className="text-xs text-slate-500">Registration is only needed the first time — pick an unclaimed club and send a request to the commissioner. After that you sign in above.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {openTeams.map((t) => (
              <Link key={t.id} href={`/teams/${t.slug}/login`}
                className="flex items-center gap-3 bg-slate-900/70 border border-slate-800 rounded-2xl shadow-lg shadow-black/20 px-4 py-3 hover:border-slate-600 transition-colors">
                {t.logoUrl && <img src={t.logoUrl} alt="" className="w-8 h-8 object-contain" />}
                <span className="font-medium text-sm">{t.name}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-slate-500">
        Admin (league operations) is separate — see <Link href="/admin/season" className="text-blue-400 hover:underline">Admin</Link>.
      </p>
    </div>
  );
}
