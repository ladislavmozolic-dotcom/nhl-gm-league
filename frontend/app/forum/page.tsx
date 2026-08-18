import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card } from "@/components/ui";
import { getTeamSession } from "@/lib/auth";
import { createThread } from "./actions";
import { CATEGORIES } from "./categories";

export const dynamic = "force-dynamic";

const CAT_LABEL: Record<string, string> = { general: "General", trades: "Trade Talk", league: "League", offtopic: "Off-topic" };
const CAT_COLOR: Record<string, string> = { general: "text-blue-400", trades: "text-emerald-400", league: "text-amber-400", offtopic: "text-slate-400" };

const ago = (d: Date) => {
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

export default async function ForumPage({ searchParams }: { searchParams: Promise<{ cat?: string }> }) {
  const { cat } = await searchParams;
  const me = await getTeamSession();
  const where = cat && CATEGORIES.includes(cat as never) ? { category: cat } : {};
  const threads = await prisma.forumThread.findMany({
    where,
    orderBy: [{ pinned: "desc" }, { lastPostAt: "desc" }],
    take: 100,
    select: { id: true, title: true, category: true, pinned: true, lastPostAt: true, team: { select: { code: true, name: true, logoUrl: true, gmNickname: true } }, _count: { select: { posts: true } } },
  });

  return (
    <div className="space-y-5 py-2 max-w-4xl">
      <PageHeader title="League Forum" subtitle="Public discussion for every GM — trade talk, debates, off-topic." />

      <div className="flex flex-wrap gap-2">
        <Link href="/forum" className={`text-xs px-3 py-1.5 rounded-full ${!cat ? "bg-blue-600 text-white" : "bg-slate-800/70 text-slate-300 hover:bg-slate-700"}`}>All</Link>
        {CATEGORIES.map((c) => (
          <Link key={c} href={`/forum?cat=${c}`} className={`text-xs px-3 py-1.5 rounded-full ${cat === c ? "bg-blue-600 text-white" : "bg-slate-800/70 text-slate-300 hover:bg-slate-700"}`}>{CAT_LABEL[c]}</Link>
        ))}
      </div>

      {me && (
        <Card title="Start a thread" accent="text-emerald-400">
          <form action={createThread} className="space-y-2.5">
            <div className="flex gap-2">
              <input name="title" required maxLength={140} placeholder="Thread title…" className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500" />
              <select name="category" className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200">
                {CATEGORIES.map((c) => <option key={c} value={c}>{CAT_LABEL[c]}</option>)}
              </select>
            </div>
            <textarea name="body" required rows={3} maxLength={5000} placeholder="What's on your mind?" className="w-full resize-none bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500" />
            <div className="flex justify-end">
              <button className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold">Post thread</button>
            </div>
          </form>
        </Card>
      )}

      <Card bodyClassName="p-0">
        {threads.length === 0 ? (
          <p className="text-center text-slate-500 py-10 text-sm">No threads yet{cat ? " in this category" : ""} — start one above.</p>
        ) : threads.map((t) => (
          <Link key={t.id} href={`/forum/${t.id}`} className="flex items-center gap-3 px-4 py-3 border-b border-slate-800/60 last:border-0 hover:bg-slate-800/30 transition-colors">
            {t.team.logoUrl && <img src={t.team.logoUrl} alt="" className="w-8 h-8 object-contain shrink-0" />}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                {t.pinned && <span className="text-amber-400 text-xs" title="Pinned">📌</span>}
                <span className="text-sm font-semibold text-slate-100 truncate">{t.title}</span>
              </div>
              <div className="text-[11px] text-slate-500 truncate">
                <span className={CAT_COLOR[t.category]}>{CAT_LABEL[t.category] ?? t.category}</span> · by {t.team.gmNickname || t.team.code || t.team.name} · {ago(t.lastPostAt)}
              </div>
            </div>
            <span className="text-xs text-slate-500 tabular-nums shrink-0">{t._count.posts} 💬</span>
          </Link>
        ))}
      </Card>
    </div>
  );
}
