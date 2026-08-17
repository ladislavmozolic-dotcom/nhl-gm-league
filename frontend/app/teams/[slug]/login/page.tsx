import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { login } from "./actions";

export const dynamic = "force-dynamic";

export default async function TeamLoginPage({
  params, searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string; submitted?: string }>;
}) {
  const { slug } = await params;
  const { error, submitted } = await searchParams;
  const team = await prisma.team.findUnique({ where: { slug }, select: { id: true, name: true, logoUrl: true, passwordHash: true } });
  if (!team) notFound();
  const firstTime = !team.passwordHash;
  const pending = firstTime
    ? await prisma.joinRequest.findFirst({ where: { teamId: team.id, status: "pending" }, select: { nickname: true } })
    : null;

  return (
    <div className="max-w-sm mx-auto px-4 py-12">
      <div className="flex items-center gap-3 mb-6">
        {team.logoUrl && <img src={team.logoUrl} alt="" className="w-12 h-12 object-contain" />}
        <div>
          <h1 className="text-xl font-bold">{team.name}</h1>
          <p className="text-sm text-slate-400">{firstTime ? "Request to manage this team" : "GM sign-in"}</p>
        </div>
      </div>

      {submitted && (
        <div className="mb-4 rounded-xl border border-green-500/40 bg-green-500/10 px-4 py-3 text-sm text-green-200">
          ✅ <b>Žiadosť odoslaná!</b> Komisár ju musí schváliť — potom sa budeš môcť prihlásiť týmto heslom.
        </div>
      )}

      {firstTime && pending && !submitted && (
        <div className="mb-4 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          ⏳ Pre tento tím už čaká žiadosť (<b>{pending.nickname}</b>) na schválenie komisárom.
        </div>
      )}

      <form action={login} className="space-y-3 bg-slate-900/50 border border-slate-800 rounded-xl p-5">
        <input type="hidden" name="slug" value={slug} />
        {firstTime && (
          <>
            <p className="text-xs text-slate-500">Registrácia — vyplň svoj GM profil. <b>Nickname</b> sa zobrazuje na stránke. Žiadosť schvaľuje komisár.</p>
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
            <label className="block text-sm"><span className="text-slate-300">Message to commissioner <span className="text-slate-600">(optional)</span></span>
              <textarea name="note" rows={2} placeholder="e.g. who you are" className="mt-1 w-full bg-slate-900 border border-slate-700 rounded px-3 py-2" /></label>
          </>
        )}
        <label className="block text-sm">
          <span className="text-slate-300">{firstTime ? "Choose a password" : "Password"}</span>
          <input type="password" name="password" autoFocus={!firstTime} required
            className="mt-1 w-full bg-slate-900 border border-slate-700 rounded px-3 py-2" />
        </label>
        {error === "wrong" && <p className="text-sm text-red-400">Wrong password.</p>}
        {error === "short" && <p className="text-sm text-red-400">Password must be at least 3 characters.</p>}
        {error === "profile" && <p className="text-sm text-red-400">Please fill in all profile fields.</p>}
        {error === "pending" && <p className="text-sm text-amber-400">Pre tento tím už čaká žiadosť na schválenie.</p>}
        <button className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-500 font-semibold text-sm">
          {firstTime ? "Send join request" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
