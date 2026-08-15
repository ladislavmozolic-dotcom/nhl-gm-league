import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { getTeamSession } from "@/lib/auth";
import { updateProfile } from "./actions";
import { Card } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function GmProfilePage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ error?: string; ok?: string }> }) {
  const { slug } = await params;
  const { error, ok } = await searchParams;
  const team = await prisma.team.findUnique({
    where: { slug },
    select: { id: true, name: true, logoUrl: true, gm: true, gmFirstName: true, gmLastName: true, gmNickname: true, gmEmail: true },
  });
  if (!team) notFound();

  const session = await getTeamSession();
  if (session !== team.id) redirect(`/teams/${slug}/login`);

  const inp = "mt-1 w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 focus:outline-none focus:border-blue-500";

  return (
    <div className="max-w-lg mx-auto py-2 space-y-5">
      <div className="flex items-center gap-3">
        {team.logoUrl && <img src={team.logoUrl} alt="" className="w-12 h-12 object-contain" />}
        <div>
          <h1 className="text-2xl font-black tracking-tight">GM Profile</h1>
          <p className="text-sm text-slate-400">{team.name}</p>
        </div>
      </div>

      {ok && <div className="text-sm text-green-400 bg-green-500/10 border border-green-500/30 rounded-lg px-4 py-2">Profile saved.</div>}
      {error === "pw" && <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2">Current password is incorrect.</div>}
      {error === "short" && <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2">New password must be at least 3 characters.</div>}
      {error === "fields" && <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2">Please fill in all profile fields.</div>}

      <form action={updateProfile}>
        <input type="hidden" name="slug" value={slug} />
        <Card title="Details" accent="text-blue-400">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm"><span className="text-slate-300">First name</span>
                <input name="firstName" required defaultValue={team.gmFirstName ?? ""} className={inp} /></label>
              <label className="block text-sm"><span className="text-slate-300">Last name</span>
                <input name="lastName" required defaultValue={team.gmLastName ?? ""} className={inp} /></label>
            </div>
            <label className="block text-sm"><span className="text-slate-300">Nickname <span className="text-slate-500">(shown across the site)</span></span>
              <input name="nickname" required defaultValue={team.gmNickname ?? team.gm ?? ""} className={inp} /></label>
            <label className="block text-sm"><span className="text-slate-300">Email</span>
              <input type="email" name="email" required defaultValue={team.gmEmail ?? ""} className={inp} /></label>
          </div>
        </Card>

        <div className="mt-4">
          <Card title="Change password" accent="text-amber-400">
            <p className="text-xs text-slate-500 mb-3">Leave blank to keep your current password.</p>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm"><span className="text-slate-300">Current password</span>
                <input type="password" name="currentPassword" autoComplete="current-password" className={inp} /></label>
              <label className="block text-sm"><span className="text-slate-300">New password</span>
                <input type="password" name="newPassword" autoComplete="new-password" className={inp} /></label>
            </div>
          </Card>
        </div>

        <button className="mt-4 w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 font-semibold text-sm">Save profile</button>
      </form>
    </div>
  );
}
