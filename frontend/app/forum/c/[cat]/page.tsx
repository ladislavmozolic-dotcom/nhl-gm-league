import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card } from "@/components/ui";
import { getTeamSession, isAdmin } from "@/lib/auth";
import { createThread, markForumSeen } from "../../actions";
import { CATEGORIES, CAT_META, type Category } from "../../categories";

export const dynamic = "force-dynamic";

const ago = (d: Date) => {
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

export default async function CategoryPage({ params, searchParams }: { params: Promise<{ cat: string }>; searchParams: Promise<{ error?: string }> }) {
  const { cat } = await params;
  const { error } = await searchParams;
  if (!(CATEGORIES as readonly string[]).includes(cat)) notFound();
  const category = cat as Category;
  const m = CAT_META[category];
  await markForumSeen();
  const [me, admin, threads] = await Promise.all([
    getTeamSession(), isAdmin(),
    prisma.forumThread.findMany({
      where: { category },
      orderBy: [{ pinned: "desc" }, { lastPostAt: "desc" }],
      take: 200,
      select: { id: true, title: true, pinned: true, lastPostAt: true, team: { select: { code: true, name: true, logoUrl: true, gmNickname: true } }, _count: { select: { posts: true } } },
    }),
  ]);
  const canPost = me != null && (!m.adminOnly || admin);

  return (
    <div className="space-y-5 py-2">
      <PageHeader
        title={<span className="flex items-center gap-2.5"><span className="text-3xl">{m.icon}</span>{m.label}</span>}
        subtitle={m.desc}
        right={<Link href="/forum" className="text-sm text-slate-400 hover:text-blue-400 whitespace-nowrap">← Board index</Link>}
      />

      {error === "admin" && <Card><p className="text-center text-amber-400 text-sm py-2">Do tohto podfóra môže vlákna zakladať len komisár.</p></Card>}
      {error === "empty" && <Card><p className="text-center text-rose-400 text-sm py-2">Vlákno musí mať názov aj text.</p></Card>}

      {canPost && (
        <Card title="Nové vlákno" accent="text-emerald-400">
          <form action={createThread} className="space-y-2.5">
            <input type="hidden" name="category" value={category} />
            <input name="title" required maxLength={140} placeholder="Názov vlákna…" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500" />
            <textarea name="body" required rows={3} maxLength={5000} placeholder="Text…" className="w-full resize-none bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500" />
            <div className="flex justify-end"><button className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold">Pridať vlákno</button></div>
          </form>
        </Card>
      )}
      {me != null && m.adminOnly && !admin && (
        <Card><p className="text-center text-slate-500 text-sm py-3">Do Comish Corner môže zakladať vlákna len komisár. Odpovedať môžeš.</p></Card>
      )}

      {threads.length === 0 ? (
        <Card><p className="text-center text-slate-500 py-12 text-sm">Zatiaľ žiadne vlákna — buď prvý. 👆</p></Card>
      ) : (
        <div className="space-y-2.5">
          {threads.map((t) => (
            <Link
              key={t.id}
              href={`/forum/${t.id}`}
              className={`group flex items-center gap-4 rounded-2xl border bg-slate-900/70 px-4 sm:px-5 py-4 shadow-lg shadow-black/20 transition-all hover:-translate-y-0.5 hover:shadow-xl ${t.pinned ? "border-amber-500/40 bg-amber-950/10" : "border-slate-800 hover:border-slate-600"}`}
            >
              {t.team.logoUrl
                ? <img src={t.team.logoUrl} alt="" className="w-12 h-12 object-contain shrink-0" />
                : <div className="w-12 h-12 rounded-full bg-slate-800 grid place-items-center text-sm text-slate-400 shrink-0">{(t.team.gmNickname || t.team.code || "?").slice(0, 2)}</div>}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  {t.pinned && <span className="text-amber-400 text-sm shrink-0" title="Pripnuté">📌</span>}
                  <span className="text-base font-bold text-slate-100 truncate group-hover:text-white">{t.title}</span>
                </div>
                <div className="text-xs text-slate-500 truncate mt-0.5">
                  {t.team.gmNickname || t.team.code || t.team.name} · posledná aktivita {ago(t.lastPostAt)}
                </div>
              </div>
              <div className="shrink-0 flex flex-col items-center gap-0.5 rounded-xl bg-slate-800/60 border border-slate-700/50 px-3.5 py-2 min-w-[64px]">
                <span className="text-lg font-black text-slate-100 leading-none tabular-nums">{t._count.posts}</span>
                <span className="text-[10px] uppercase tracking-wider text-slate-500">{t._count.posts === 1 ? "post" : "postov"}</span>
              </div>
              <span className="hidden sm:block text-slate-600 text-xl group-hover:text-slate-300 transition-colors shrink-0">→</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
