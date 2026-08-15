import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { login } from "./actions";

export const dynamic = "force-dynamic";

export default async function TeamLoginPage({
  params, searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { slug } = await params;
  const { error } = await searchParams;
  const team = await prisma.team.findUnique({ where: { slug }, select: { name: true, logoUrl: true, passwordHash: true } });
  if (!team) notFound();
  const firstTime = !team.passwordHash;

  return (
    <div className="max-w-sm mx-auto px-4 py-12">
      <div className="flex items-center gap-3 mb-6">
        {team.logoUrl && <img src={team.logoUrl} alt="" className="w-12 h-12 object-contain" />}
        <div>
          <h1 className="text-xl font-bold">{team.name}</h1>
          <p className="text-sm text-slate-400">GM sign-in</p>
        </div>
      </div>

      <form action={login} className="space-y-3 bg-slate-900/50 border border-slate-800 rounded-xl p-5">
        <input type="hidden" name="slug" value={slug} />
        {firstTime && (
          <>
            <p className="text-xs text-slate-500">First sign-in — create your GM profile. Your <b>nickname</b> is shown across the site.</p>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-sm"><span className="text-slate-300">First name</span>
                <input name="firstName" required className="mt-1 w-full bg-slate-900 border border-slate-700 rounded px-3 py-2" /></label>
              <label className="block text-sm"><span className="text-slate-300">Last name</span>
                <input name="lastName" required className="mt-1 w-full bg-slate-900 border border-slate-700 rounded px-3 py-2" /></label>
            </div>
            <label className="block text-sm"><span className="text-slate-300">Nickname</span>
              <input name="nickname" required placeholder="shown in the menu" className="mt-1 w-full bg-slate-900 border border-slate-700 rounded px-3 py-2" /></label>
            <label className="block text-sm"><span className="text-slate-300">Email</span>
              <input type="email" name="email" required className="mt-1 w-full bg-slate-900 border border-slate-700 rounded px-3 py-2" /></label>
          </>
        )}
        <label className="block text-sm">
          <span className="text-slate-300">{firstTime ? "Set a password" : "Password"}</span>
          <input type="password" name="password" autoFocus={!firstTime} required
            className="mt-1 w-full bg-slate-900 border border-slate-700 rounded px-3 py-2" />
        </label>
        {error === "wrong" && <p className="text-sm text-red-400">Wrong password.</p>}
        {error === "short" && <p className="text-sm text-red-400">Password must be at least 3 characters.</p>}
        {error === "profile" && <p className="text-sm text-red-400">Please fill in all profile fields.</p>}
        <button className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-500 font-semibold text-sm">
          {firstTime ? "Create profile & sign in" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
