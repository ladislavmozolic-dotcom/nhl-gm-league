import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getTeamSession } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { directLogin } from "./actions";

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
      <PageHeader title="GM Sign In" subtitle="Prihlás sa svojím emailom alebo prezývkou — dostaneš sa rovno na svoj roster." />

      {current && (
        <div className="flex items-center gap-3 bg-green-500/10 border border-green-500/30 rounded-xl px-4 py-3 text-sm">
          {current.logoUrl && <img src={current.logoUrl} alt="" className="w-8 h-8 object-contain" />}
          <span>Prihlásený ako GM <b>{current.name}</b>.</span>
          <Link href={`/teams/${current.slug}/roster`} className="ml-auto text-green-300 hover:underline">Otvoriť roster →</Link>
        </div>
      )}

      {/* direct sign-in — registered GMs don't pick a team */}
      <form action={directLogin} className="space-y-3 bg-slate-900/50 border border-slate-800 rounded-2xl p-6 max-w-sm shadow-lg shadow-black/20">
        <label className="block text-sm"><span className="text-slate-300">Email alebo prezývka</span>
          <input name="identifier" autoFocus autoComplete="username" required
            className="mt-1 w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 focus:border-blue-500 outline-none" /></label>
        <label className="block text-sm"><span className="text-slate-300">Heslo</span>
          <input type="password" name="password" autoComplete="current-password" required
            className="mt-1 w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 focus:border-blue-500 outline-none" /></label>
        {error === "bad" && <p className="text-sm text-red-400">Nesprávny email/prezývka alebo heslo.</p>}
        <button className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-500 font-semibold text-sm">Prihlásiť sa</button>
      </form>

      {/* new GM registration — the only place a team is picked */}
      {openTeams.length > 0 && (
        <div className="space-y-3 pt-2">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">Nový GM? Vyber si voľný tím</h2>
          <p className="text-xs text-slate-500">Registrácia je len prvýkrát — vyber neobsadený klub a pošli žiadosť komisárovi. Potom sa už prihlasuješ hore.</p>
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
        Admin (league operations) je oddelený — pozri <Link href="/admin/season" className="text-blue-400 hover:underline">Admin</Link>.
      </p>
    </div>
  );
}
