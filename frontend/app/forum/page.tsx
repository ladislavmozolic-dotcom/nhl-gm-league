import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card } from "@/components/ui";
import { CATEGORIES, CAT_META } from "./categories";

export const dynamic = "force-dynamic";

const ago = (d: Date) => {
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

export default async function ForumPage() {
  const cats = await Promise.all(CATEGORIES.map(async (cat) => {
    const [topics, posts, last] = await Promise.all([
      prisma.forumThread.count({ where: { category: cat } }),
      prisma.forumPost.count({ where: { thread: { category: cat } } }),
      prisma.forumPost.findFirst({
        where: { thread: { category: cat } },
        orderBy: { id: "desc" },
        select: { createdAt: true, thread: { select: { id: true, title: true } }, team: { select: { code: true, gmNickname: true } } },
      }),
    ]);
    return { cat, topics, posts, last };
  }));

  return (
    <div className="space-y-5 py-2 max-w-4xl">
      <PageHeader title="League Forum" subtitle="Board index — pick a sub-forum." />

      <Card bodyClassName="p-0">
        <div className="hidden sm:flex items-center px-4 py-2 text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-800">
          <span className="flex-1">Forum</span>
          <span className="w-16 text-center">Topics</span>
          <span className="w-16 text-center">Posts</span>
          <span className="w-48">Last post</span>
        </div>
        {cats.map(({ cat, topics, posts, last }) => {
          const m = CAT_META[cat];
          return (
            <div key={cat} className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-800/60 last:border-0 hover:bg-slate-800/20 transition-colors">
              <div className="min-w-0 flex-1">
                <Link href={`/forum/c/${cat}`} className={`font-bold ${m.color} hover:underline`}>{m.label}</Link>
                <div className="text-xs text-slate-500">{m.desc}{m.adminOnly && <span className="ml-1.5 text-amber-500/70">· len komisár zakladá</span>}</div>
              </div>
              <span className="hidden sm:block w-16 text-center text-sm text-slate-300 tabular-nums">{topics}</span>
              <span className="hidden sm:block w-16 text-center text-sm text-slate-300 tabular-nums">{posts}</span>
              <div className="hidden sm:block w-48 text-[11px] text-slate-500 truncate">
                {last ? (
                  <>
                    <Link href={`/forum/${last.thread.id}`} className="text-slate-300 hover:text-blue-400 block truncate">{last.thread.title}</Link>
                    by {last.team.gmNickname || last.team.code || "GM"} · {ago(last.createdAt)}
                  </>
                ) : <span className="text-slate-600">No posts yet</span>}
              </div>
            </div>
          );
        })}
      </Card>
    </div>
  );
}
