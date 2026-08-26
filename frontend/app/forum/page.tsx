import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui";
import { CATEGORIES, CAT_META } from "./categories";
import { markForumSeen } from "./actions";

export const dynamic = "force-dynamic";

const ago = (d: Date) => {
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

export default async function ForumPage() {
  await markForumSeen();
  const cats = await Promise.all(CATEGORIES.map(async (cat) => {
    const [topics, posts, last] = await Promise.all([
      prisma.forumThread.count({ where: { category: cat } }),
      prisma.forumPost.count({ where: { thread: { category: cat } } }),
      prisma.forumPost.findFirst({
        where: { thread: { category: cat } },
        orderBy: { id: "desc" },
        select: { createdAt: true, thread: { select: { id: true, title: true } }, team: { select: { code: true, logoUrl: true, gmNickname: true } } },
      }),
    ]);
    return { cat, topics, posts, last };
  }));

  const totalTopics = cats.reduce((n, c) => n + c.topics, 0);
  const totalPosts = cats.reduce((n, c) => n + c.posts, 0);

  return (
    <div className="space-y-6 py-2">
      <PageHeader
        title="League Forum"
        subtitle="Board index — vyber si podfórum."
        right={
          <div className="hidden sm:flex gap-2">
            <div className="rounded-xl bg-slate-800/50 border border-slate-700/60 px-4 py-2 text-center">
              <div className="text-2xl font-black text-white leading-none tabular-nums">{totalTopics}</div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500 mt-1">Vlákien</div>
            </div>
            <div className="rounded-xl bg-slate-800/50 border border-slate-700/60 px-4 py-2 text-center">
              <div className="text-2xl font-black text-white leading-none tabular-nums">{totalPosts}</div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500 mt-1">Príspevkov</div>
            </div>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {cats.map(({ cat, topics, posts, last }) => {
          const m = CAT_META[cat];
          return (
            <Link
              key={cat}
              href={`/forum/c/${cat}`}
              className={`group relative overflow-hidden rounded-2xl border ${m.ring} bg-slate-900/70 shadow-lg shadow-black/20 transition-all hover:shadow-xl hover:-translate-y-0.5`}
            >
              <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${m.glow} to-transparent opacity-60`} />
              <div className="relative p-5 sm:p-6">
                <div className="flex items-start gap-4">
                  <div className="shrink-0 grid place-items-center w-14 h-14 rounded-2xl bg-slate-800/70 border border-slate-700/60 text-3xl">
                    {m.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className={`text-xl font-black tracking-tight ${m.color} group-hover:underline`}>{m.label}</h2>
                      {m.adminOnly && <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-500/80 bg-amber-500/10 ring-1 ring-amber-500/30 rounded px-1.5 py-0.5">len komisár</span>}
                    </div>
                    <p className="text-sm text-slate-400 mt-1">{m.desc}</p>
                    <div className="flex items-center gap-2 mt-3">
                      <span className={`text-xs font-semibold rounded-full px-2.5 py-1 ${m.chip}`}>{topics} vlákien</span>
                      <span className={`text-xs font-semibold rounded-full px-2.5 py-1 ${m.chip}`}>{posts} príspevkov</span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-slate-800/70">
                  {last ? (
                    <div className="flex items-center gap-3">
                      {last.team.logoUrl
                        ? <img src={last.team.logoUrl} alt="" className="w-9 h-9 object-contain shrink-0" />
                        : <div className="w-9 h-9 rounded-full bg-slate-800 grid place-items-center text-xs text-slate-400 shrink-0">{(last.team.gmNickname || last.team.code || "?").slice(0, 2)}</div>}
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-slate-200 truncate group-hover:text-white">{last.thread.title}</div>
                        <div className="text-[11px] text-slate-500">{last.team.gmNickname || last.team.code || "GM"} · {ago(last.createdAt)}</div>
                      </div>
                      <span className="text-slate-600 text-lg group-hover:text-slate-400 transition-colors">→</span>
                    </div>
                  ) : (
                    <div className="text-sm text-slate-600 italic">Zatiaľ žiadne príspevky — buď prvý.</div>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
