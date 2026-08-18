import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card } from "@/components/ui";
import { getTeamSession, isAdmin } from "@/lib/auth";
import { createThread } from "../../actions";
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
    <div className="space-y-5 py-2 max-w-4xl">
      <PageHeader title={m.label} subtitle={m.desc} right={<Link href="/forum" className="text-sm text-slate-400 hover:text-blue-400">← Board index</Link>} />

      {error === "admin" && <Card><p className="text-center text-amber-400 text-sm py-2">Do tohto podfóra môže vlákna zakladať len komisár.</p></Card>}
      {error === "empty" && <Card><p className="text-center text-rose-400 text-sm py-2">Vlákno musí mať názov aj text.</p></Card>}

      {canPost && (
        <Card title="Nové vlákno" accent="text-emerald-400">
          <form action={createThread} className="space-y-2.5">
            <input type="hidden" name="category" value={category} />
            <input name="title" required maxLength={140} placeholder="Názov vlákna…" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500" />
            <textarea name="body" required rows={3} maxLength={5000} placeholder="Text…" className="w-full resize-none bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500" />
            <div className="flex justify-end"><button className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold">Pridať vlákno</button></div>
          </form>
        </Card>
      )}
      {me != null && m.adminOnly && !admin && (
        <Card><p className="text-center text-slate-500 text-sm py-3">Do Comish Corner môže zakladať vlákna len komisár. Odpovedať môžeš.</p></Card>
      )}

      <Card bodyClassName="p-0">
        {threads.length === 0 ? (
          <p className="text-center text-slate-500 py-10 text-sm">Zatiaľ žiadne vlákna.</p>
        ) : threads.map((t) => (
          <Link key={t.id} href={`/forum/${t.id}`} className="flex items-center gap-3 px-4 py-3 border-b border-slate-800/60 last:border-0 hover:bg-slate-800/30 transition-colors">
            {t.team.logoUrl && <img src={t.team.logoUrl} alt="" className="w-8 h-8 object-contain shrink-0" />}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                {t.pinned && <span className="text-amber-400 text-xs" title="Pinned">📌</span>}
                <span className="text-sm font-semibold text-slate-100 truncate">{t.title}</span>
              </div>
              <div className="text-[11px] text-slate-500 truncate">by {t.team.gmNickname || t.team.code || t.team.name} · {ago(t.lastPostAt)}</div>
            </div>
            <span className="text-xs text-slate-500 tabular-nums shrink-0">{t._count.posts} 💬</span>
          </Link>
        ))}
      </Card>
    </div>
  );
}
